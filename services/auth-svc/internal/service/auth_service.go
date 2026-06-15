// Package service berisi logika bisnis auth-svc: registrasi, login, refresh
// token (rotasi), logout, dan profil. Access token = JWT HS256 (15m default),
// refresh token = UUID opaque tersimpan di Redis (7 hari default).
package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/lumbung/auth-svc/internal/domain"
	"github.com/lumbung/auth-svc/internal/repository"
	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
)

const (
	bcryptCost       = 12
	refreshKeyPrefix = "refresh:"
)

// RegisterInput adalah masukan registrasi.
type RegisterInput struct {
	Username   string
	Email      string
	Password   string
	KoperasiID uuid.UUID // uuid.Nil untuk super_admin
	Role       string
}

// LoginInput adalah masukan login.
type LoginInput struct {
	Email      string
	Password   string
	KoperasiID uuid.UUID
}

// TokenPair adalah pasangan access + refresh token.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

// AuthService mengkoordinasi repository, Redis, dan penerbitan token.
type AuthService struct {
	repo            *repository.UserRepository
	rdb             *redis.Client
	jwtSecret       []byte
	accessTTL       time.Duration
	refreshTTL      time.Duration
}

// NewAuthService membuat service auth.
func NewAuthService(repo *repository.UserRepository, rdb *redis.Client, jwtSecret []byte, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		repo:       repo,
		rdb:        rdb,
		jwtSecret:  jwtSecret,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

// Register membuat user baru dengan password ter-hash bcrypt.
func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*domain.User, error) {
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	in.Username = strings.TrimSpace(in.Username)
	if in.Email == "" || in.Username == "" {
		return nil, apperr.Validation("username dan email wajib diisi")
	}
	if len(in.Password) < 8 {
		return nil, apperr.Validation("password minimal 8 karakter")
	}
	role := in.Role
	if role == "" {
		role = string(sharedauth.RoleAnggota)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcryptCost)
	if err != nil {
		return nil, apperr.Internal("gagal mengenkripsi password").WithCause(err)
	}

	u := &domain.User{
		ID:           uuid.New(),
		KoperasiID:   in.KoperasiID,
		Username:     in.Username,
		Email:        in.Email,
		PasswordHash: string(hash),
		Role:         role,
	}
	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// Login memverifikasi kredensial dan menerbitkan TokenPair.
func (s *AuthService) Login(ctx context.Context, in LoginInput) (*TokenPair, error) {
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	if in.Email == "" || in.Password == "" {
		return nil, apperr.Validation("email dan password wajib diisi")
	}

	u, err := s.repo.FindByEmail(ctx, in.Email, in.KoperasiID)
	if err != nil {
		// Samakan pesan agar tidak membocorkan eksistensi akun.
		return nil, apperr.Unauthorized("email atau password salah")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)); err != nil {
		return nil, apperr.Unauthorized("email atau password salah")
	}

	return s.issueTokenPair(ctx, u)
}

// Refresh memutar refresh token: validasi lama, terbitkan baru, hapus lama.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*TokenPair, error) {
	if refreshToken == "" {
		return nil, apperr.Unauthorized("refresh token tidak ada")
	}
	key := refreshKeyPrefix + refreshToken
	val, err := s.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, apperr.Unauthorized("refresh token tidak valid atau kedaluwarsa")
	}
	if err != nil {
		return nil, apperr.Internal("gagal memvalidasi refresh token").WithCause(err)
	}

	userID, tenantID, role, ok := parseRefreshValue(val)
	if !ok {
		return nil, apperr.Unauthorized("refresh token rusak")
	}

	// Rotasi: hapus token lama lebih dahulu (one-time use).
	if err := s.rdb.Del(ctx, key).Err(); err != nil {
		return nil, apperr.Internal("gagal merotasi refresh token").WithCause(err)
	}

	access, err := sharedauth.IssueAccessToken(s.jwtSecret, userID, tenantID, sharedauth.Role(role), s.accessTTL)
	if err != nil {
		return nil, err
	}
	newRefresh, err := s.storeRefresh(ctx, userID, tenantID, role)
	if err != nil {
		return nil, err
	}
	return &TokenPair{AccessToken: access, RefreshToken: newRefresh}, nil
}

// Logout menghapus refresh token dari Redis (idempoten).
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	if err := s.rdb.Del(ctx, refreshKeyPrefix+refreshToken).Err(); err != nil {
		return apperr.Internal("gagal logout").WithCause(err)
	}
	return nil
}

// GetMe mengambil profil user berdasarkan ID.
func (s *AuthService) GetMe(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return s.repo.FindByID(ctx, userID)
}

// issueTokenPair menerbitkan access token + menyimpan refresh token baru.
func (s *AuthService) issueTokenPair(ctx context.Context, u *domain.User) (*TokenPair, error) {
	tenantID := ""
	if u.KoperasiID != uuid.Nil {
		tenantID = u.KoperasiID.String()
	}
	access, err := sharedauth.IssueAccessToken(s.jwtSecret, u.ID.String(), tenantID, sharedauth.Role(u.Role), s.accessTTL)
	if err != nil {
		return nil, err
	}
	refresh, err := s.storeRefresh(ctx, u.ID.String(), tenantID, u.Role)
	if err != nil {
		return nil, err
	}
	return &TokenPair{AccessToken: access, RefreshToken: refresh}, nil
}

// storeRefresh membuat refresh token opaque dan menyimpannya di Redis.
// value = "<userID>:<tenantID>:<role>".
func (s *AuthService) storeRefresh(ctx context.Context, userID, tenantID, role string) (string, error) {
	token := uuid.NewString()
	val := userID + ":" + tenantID + ":" + role
	if err := s.rdb.Set(ctx, refreshKeyPrefix+token, val, s.refreshTTL).Err(); err != nil {
		return "", apperr.Internal("gagal menyimpan refresh token").WithCause(err)
	}
	return token, nil
}

// parseRefreshValue memecah "userID:tenantID:role". tenantID boleh kosong.
func parseRefreshValue(val string) (userID, tenantID, role string, ok bool) {
	parts := strings.SplitN(val, ":", 3)
	if len(parts) != 3 {
		return "", "", "", false
	}
	return parts[0], parts[1], parts[2], true
}
