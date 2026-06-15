// Package repository berisi akses data auth-svc (GORM).
package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/lumbung/auth-svc/internal/domain"
	apperr "github.com/lumbung/shared/errors"
)

// UserModel adalah representasi tabel users untuk GORM.
type UserModel struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey"`
	KoperasiID   *uuid.UUID `gorm:"type:uuid"`
	Username     string     `gorm:"size:100;not null"`
	Email        string     `gorm:"size:200;not null"`
	PasswordHash string     `gorm:"size:200;not null"`
	Role         string     `gorm:"size:50;not null;default:anggota"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time `gorm:"index"`
}

// TableName memetakan model ke tabel users.
func (UserModel) TableName() string { return "users" }

// UserRepository menyediakan operasi CRUD user.
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository membuat repository baru.
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create menyimpan user baru. Konflik unique => Conflict error.
func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	m := &UserModel{
		ID:           u.ID,
		Username:     u.Username,
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		Role:         u.Role,
	}
	if u.KoperasiID != uuid.Nil {
		kid := u.KoperasiID
		m.KoperasiID = &kid
	}
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return apperr.Conflict("email atau username sudah digunakan").WithCause(err)
	}
	u.ID = m.ID
	u.CreatedAt = m.CreatedAt
	u.UpdatedAt = m.UpdatedAt
	return nil
}

// FindByEmail mencari user berdasarkan email (opsional difilter koperasi).
func (r *UserRepository) FindByEmail(ctx context.Context, email string, koperasiID uuid.UUID) (*domain.User, error) {
	var m UserModel
	q := r.db.WithContext(ctx).Where("email = ? AND deleted_at IS NULL", email)
	if koperasiID != uuid.Nil {
		q = q.Where("koperasi_id = ?", koperasiID)
	}
	// Jika koperasiID tidak diberikan, cari berdasarkan email saja (tanpa filter koperasi).
	if err := q.First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("pengguna tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil data pengguna").WithCause(err)
	}
	return toDomain(&m), nil
}

// FindByID mencari user berdasarkan ID.
func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var m UserModel
	if err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("pengguna tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil data pengguna").WithCause(err)
	}
	return toDomain(&m), nil
}

func toDomain(m *UserModel) *domain.User {
	u := &domain.User{
		ID:           m.ID,
		Username:     m.Username,
		Email:        m.Email,
		PasswordHash: m.PasswordHash,
		Role:         m.Role,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
	if m.KoperasiID != nil {
		u.KoperasiID = *m.KoperasiID
	}
	return u
}
