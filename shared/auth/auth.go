// Package auth menyediakan penerbitan & verifikasi access token JWT (HS256),
// ekstraksi claims (tenant_id, user_id, role) ke context, serta middleware chi.
//
// Dua mode pemakaian:
//  1. Gateway memverifikasi JWT penuh (ParseToken) lalu meng-inject header
//     X-Tenant-ID / X-User-ID / X-Role ke request downstream.
//  2. Internal service TIDAK mem-parse JWT lagi (tidak terekspos internet);
//     cukup membaca header tepercaya via FromHeaders middleware.
package auth

import (
	"context"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	apperr "github.com/lumbung/shared/errors"
)

// Nama header propagasi claim dari gateway ke service internal.
const (
	HeaderTenantID = "X-Tenant-ID"
	HeaderUserID   = "X-User-ID"
	HeaderRole     = "X-Role"
)

// Role adalah peran pengguna dalam koperasi (claim & otorisasi).
type Role string

const (
	RoleSuperAdmin Role = "super_admin" // operator platform lintas tenant
	RolePengurus   Role = "pengurus"    // admin koperasi (tenant)
	RoleKasir      Role = "kasir"       // input transaksi
	RoleAnggota    Role = "anggota"     // member biasa
	RolePemkab     Role = "pemkab"      // pemerintah kabupaten (lintas tenant)
	RolePengawas   Role = "pengawas"    // pengawas koperasi
)

// isPlatformRole mengembalikan true untuk role yang tidak terikat satu tenant.
func isPlatformRole(role Role) bool {
	return role == RoleSuperAdmin || role == RolePemkab
}

// Claims adalah payload JWT access token LUMBUNG.
type Claims struct {
	TenantID string `json:"tenant_id"`
	Role     Role   `json:"role"`
	jwt.RegisteredClaims
}

// Identity adalah hasil ekstraksi identitas yang disimpan di context.
type Identity struct {
	UserID   string // = subject (sub)
	TenantID string
	Role     Role
}

// ctxKey privat agar tidak bentrok dengan paket lain.
type ctxKey string

const identityKey ctxKey = "lumbung_identity"

// IssueAccessToken menerbitkan access token JWT HS256.
// subject = user ID, tenantID = koperasi, role = peran. ttl masa hidup token.
func IssueAccessToken(secret []byte, userID, tenantID string, role Role, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		TenantID: tenantID,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Issuer:    "lumbung-auth-svc",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", apperr.Internal("gagal menandatangani token").WithCause(err)
	}
	return signed, nil
}

// ParseToken memverifikasi signature & masa berlaku, mengembalikan Claims.
// Menolak token dengan signing method selain HMAC (cegah alg-confusion).
func ParseToken(secret []byte, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, apperr.Unauthorized("metode signing token tidak valid")
		}
		return secret, nil
	}, jwt.WithLeeway(30*time.Second)) // toleransi clock skew 30 detik
	if err != nil || !token.Valid {
		return nil, apperr.Unauthorized("token tidak valid atau kedaluwarsa")
	}
	if claims.Subject == "" {
		return nil, apperr.Unauthorized("token tidak membawa identitas lengkap")
	}
	if claims.TenantID == "" && !isPlatformRole(claims.Role) {
		return nil, apperr.Unauthorized("token tidak membawa identitas lengkap")
	}
	return claims, nil
}

// Verifier adalah middleware chi untuk GATEWAY: verifikasi Bearer JWT,
// ekstrak claims, simpan Identity ke context. isPublic mengizinkan route
// tertentu (mis. /auth/login) lewat tanpa token.
func Verifier(secret []byte, isPublic func(r *http.Request) bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isPublic != nil && isPublic(r) {
				next.ServeHTTP(w, r)
				return
			}
			tokenStr := bearerToken(r)
			if tokenStr == "" {
				apperr.Write(w, apperr.Unauthorized("header Authorization Bearer wajib"))
				return
			}
			claims, err := ParseToken(secret, tokenStr)
			if err != nil {
				apperr.Write(w, err)
				return
			}
			id := Identity{UserID: claims.Subject, TenantID: claims.TenantID, Role: claims.Role}
			next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), id)))
		})
	}
}

// InjectHeaders middleware menulis Identity dari context ke header request
// agar diteruskan ke service downstream (dipakai gateway sebelum proxy).
func InjectHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id, ok := FromContext(r.Context()); ok {
			r.Header.Set(HeaderUserID, id.UserID)
			r.Header.Set(HeaderTenantID, id.TenantID)
			r.Header.Set(HeaderRole, string(id.Role))
		}
		next.ServeHTTP(w, r)
	})
}

// FromHeaders middleware untuk SERVICE INTERNAL: membaca Identity dari header
// tepercaya yang di-set gateway (tidak parse JWT). Menolak bila user kosong.
// Platform roles (super_admin, pemkab) boleh tanpa TenantID.
func FromHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get(HeaderUserID)
		if userID == "" {
			apperr.Write(w, apperr.Unauthorized("identitas tidak ada (header X-User-ID kosong)"))
			return
		}
		role := Role(r.Header.Get(HeaderRole))
		tenantID := r.Header.Get(HeaderTenantID)
		if tenantID == "" && !isPlatformRole(role) {
			apperr.Write(w, apperr.Unauthorized("identitas tidak ada (header X-Tenant-ID kosong)"))
			return
		}
		id := Identity{
			UserID:   userID,
			TenantID: tenantID,
			Role:     role,
		}
		next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), id)))
	})
}

// RequireRole middleware membatasi akses hanya untuk role tertentu.
func RequireRole(allowed ...Role) func(http.Handler) http.Handler {
	allowSet := make(map[Role]struct{}, len(allowed))
	for _, r := range allowed {
		allowSet[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id, ok := FromContext(r.Context())
			if !ok {
				apperr.Write(w, apperr.Unauthorized("identitas tidak ditemukan"))
				return
			}
			if _, allowed := allowSet[id.Role]; !allowed {
				apperr.Write(w, apperr.Forbidden("peran tidak diizinkan mengakses sumber daya ini"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// WithIdentity menyisipkan Identity ke context.
func WithIdentity(ctx context.Context, id Identity) context.Context {
	return context.WithValue(ctx, identityKey, id)
}

// FromContext mengambil Identity dari context.
func FromContext(ctx context.Context) (Identity, bool) {
	id, ok := ctx.Value(identityKey).(Identity)
	return id, ok
}

// bearerToken mengekstrak token dari header "Authorization: Bearer <token>".
func bearerToken(r *http.Request) string {
	const prefix = "Bearer "
	h := r.Header.Get("Authorization")
	if len(h) > len(prefix) && h[:len(prefix)] == prefix {
		return h[len(prefix):]
	}
	return ""
}
