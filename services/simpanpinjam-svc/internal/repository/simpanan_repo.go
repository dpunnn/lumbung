// Package repository berisi akses data simpanpinjam-svc (GORM) dengan RLS.
package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/simpanpinjam-svc/internal/domain"
)

// SimpananModel representasi tabel simpanan untuk GORM.
type SimpananModel struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID  `gorm:"type:uuid;not null;column:koperasi_id"`
	AnggotaID  uuid.UUID  `gorm:"type:uuid;not null;column:anggota_id"`
	Jenis      string     `gorm:"size:20;not null;default:pokok"`
	Jumlah     float64    `gorm:"type:numeric(15,2);not null"`
	Status     string     `gorm:"size:20;not null;default:pending"`
	ApproverID *uuid.UUID `gorm:"type:uuid;column:approver_id"`
	WitnessID  *uuid.UUID `gorm:"type:uuid;column:witness_id"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// TableName memetakan model ke tabel simpanan.
func (SimpananModel) TableName() string { return "simpanan" }

// SimpananRepository menyediakan operasi data simpanan.
type SimpananRepository struct {
	db *gorm.DB
}

// NewSimpananRepository membuat repository baru.
func NewSimpananRepository(db *gorm.DB) *SimpananRepository {
	return &SimpananRepository{db: db}
}

// Create menyimpan simpanan baru (RLS aktif).
func (r *SimpananRepository) Create(ctx context.Context, s *domain.Simpanan) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	m := simpananToModel(s)
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat simpanan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit simpanan").WithCause(err)
	}
	*s = *simpananToDomain(m)
	return nil
}

// FindByAnggota mengambil simpanan koperasi, opsional difilter anggota.
func (r *SimpananRepository) FindByAnggota(ctx context.Context, anggotaID *uuid.UUID) ([]*domain.Simpanan, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	q := tx.Order("created_at DESC")
	if anggotaID != nil {
		q = q.Where("anggota_id = ?", *anggotaID)
	}
	var models []SimpananModel
	if err := q.Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil simpanan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query simpanan").WithCause(err)
	}
	out := make([]*domain.Simpanan, 0, len(models))
	for i := range models {
		out = append(out, simpananToDomain(&models[i]))
	}
	return out, nil
}

// FindByID mengambil satu simpanan.
func (r *SimpananRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Simpanan, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m SimpananModel
	if err := tx.Where("id = ?", id).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("simpanan tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil simpanan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query simpanan").WithCause(err)
	}
	return simpananToDomain(&m), nil
}

// Approve menandai simpanan confirmed dengan approver tertentu.
func (r *SimpananRepository) Approve(ctx context.Context, id, approverID uuid.UUID) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	res := tx.Model(&SimpananModel{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":      domain.SimpananConfirmed,
			"approver_id": approverID,
			"updated_at":  time.Now(),
		})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal menyetujui simpanan").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("simpanan tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit approve simpanan").WithCause(err)
	}
	return nil
}

// TotalConfirmed mengembalikan total nominal simpanan berstatus confirmed di tenant.
func (r *SimpananRepository) TotalConfirmed(ctx context.Context) (float64, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return 0, err
	}
	defer rollbackOnPanic(tx)

	var total float64
	if err := tx.Model(&SimpananModel{}).
		Where("status = ?", domain.SimpananConfirmed).
		Select("COALESCE(SUM(jumlah), 0)").
		Scan(&total).Error; err != nil {
		tx.Rollback()
		return 0, apperr.Internal("gagal menghitung total simpanan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return 0, apperr.Internal("gagal commit total simpanan").WithCause(err)
	}
	return total, nil
}

func simpananToModel(s *domain.Simpanan) *SimpananModel {
	return &SimpananModel{
		ID:         s.ID,
		KoperasiID: s.KoperasiID,
		AnggotaID:  s.AnggotaID,
		Jenis:      s.Jenis,
		Jumlah:     s.Jumlah,
		Status:     s.Status,
		ApproverID: s.ApproverID,
		WitnessID:  s.WitnessID,
	}
}

func simpananToDomain(m *SimpananModel) *domain.Simpanan {
	return &domain.Simpanan{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		AnggotaID:  m.AnggotaID,
		Jenis:      m.Jenis,
		Jumlah:     m.Jumlah,
		Status:     m.Status,
		ApproverID: m.ApproverID,
		WitnessID:  m.WitnessID,
		CreatedAt:  m.CreatedAt,
		UpdatedAt:  m.UpdatedAt,
	}
}

// rollbackOnPanic adalah helper defer untuk rollback transaksi saat panic.
func rollbackOnPanic(tx *gorm.DB) {
	if p := recover(); p != nil {
		tx.Rollback()
		panic(p)
	}
}
