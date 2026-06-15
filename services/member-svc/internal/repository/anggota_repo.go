// Package repository berisi akses data member-svc (GORM) dengan RLS per tenant.
package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/member-svc/internal/domain"
)

// AnggotaModel adalah representasi tabel anggota untuk GORM.
type AnggotaModel struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	Nama       string    `gorm:"size:200;not null"`
	NikHash    string    `gorm:"size:64;column:nik_hash"`
	Alamat     string    `gorm:"type:text"`
	Telepon    string    `gorm:"size:20"`
	Status     string    `gorm:"size:20;not null;default:aktif"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  *time.Time `gorm:"index"`
}

// TableName memetakan model ke tabel anggota.
func (AnggotaModel) TableName() string { return "anggota" }

// AnggotaRepository menyediakan operasi data anggota.
type AnggotaRepository struct {
	db *gorm.DB
}

// NewAnggotaRepository membuat repository baru.
func NewAnggotaRepository(db *gorm.DB) *AnggotaRepository {
	return &AnggotaRepository{db: db}
}

// Create menyimpan anggota baru dalam transaksi tenant (RLS aktif).
func (r *AnggotaRepository) Create(ctx context.Context, a *domain.Anggota) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	m := toModel(a)
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat anggota").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit anggota").WithCause(err)
	}
	*a = *toDomain(m)
	return nil
}

// FindAll mengambil semua anggota koperasi (difilter RLS).
func (r *AnggotaRepository) FindAll(ctx context.Context) ([]*domain.Anggota, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	var models []AnggotaModel
	if err := tx.Where("deleted_at IS NULL").
		Order("created_at DESC").
		Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil daftar anggota").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query anggota").WithCause(err)
	}

	out := make([]*domain.Anggota, 0, len(models))
	for i := range models {
		out = append(out, toDomain(&models[i]))
	}
	return out, nil
}

// FindByID mengambil satu anggota berdasarkan ID (difilter RLS).
func (r *AnggotaRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Anggota, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	var m AnggotaModel
	if err := tx.Where("id = ? AND deleted_at IS NULL", id).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("anggota tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil anggota").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query anggota").WithCause(err)
	}
	return toDomain(&m), nil
}

// Update memperbarui field anggota (difilter RLS).
func (r *AnggotaRepository) Update(ctx context.Context, a *domain.Anggota) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	res := tx.Model(&AnggotaModel{}).
		Where("id = ? AND deleted_at IS NULL", a.ID).
		Updates(map[string]any{
			"nama":       a.Nama,
			"alamat":     a.Alamat,
			"telepon":    a.Telepon,
			"status":     a.Status,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal memperbarui anggota").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("anggota tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit update anggota").WithCause(err)
	}
	return nil
}

// SetStatus mengubah status anggota (difilter RLS).
func (r *AnggotaRepository) SetStatus(ctx context.Context, id uuid.UUID, status string) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	res := tx.Model(&AnggotaModel{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]any{
			"status":     status,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal mengubah status anggota").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("anggota tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit status anggota").WithCause(err)
	}
	return nil
}

// ValidateExists memastikan anggota dengan id tertentu ada di tenant aktif.
// Dipanggil service lain via gateway (header X-Tenant-ID sudah ada), tetap
// memakai OpenTenantTx agar RLS menegakkan isolasi tenant.
func (r *AnggotaRepository) ValidateExists(ctx context.Context, id uuid.UUID) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	var count int64
	if err := tx.Model(&AnggotaModel{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Count(&count).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal validasi anggota").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit validasi anggota").WithCause(err)
	}
	if count == 0 {
		return apperr.NotFound("anggota tidak ditemukan")
	}
	return nil
}

func toModel(a *domain.Anggota) *AnggotaModel {
	return &AnggotaModel{
		ID:         a.ID,
		KoperasiID: a.KoperasiID,
		Nama:       a.Nama,
		NikHash:    a.NikHash,
		Alamat:     a.Alamat,
		Telepon:    a.Telepon,
		Status:     a.Status,
	}
}

func toDomain(m *AnggotaModel) *domain.Anggota {
	return &domain.Anggota{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		Nama:       m.Nama,
		NikHash:    m.NikHash,
		Alamat:     m.Alamat,
		Telepon:    m.Telepon,
		Status:     m.Status,
		CreatedAt:  m.CreatedAt,
		UpdatedAt:  m.UpdatedAt,
	}
}
