// Package repository berisi akses data pass-svc (GORM) dengan RLS.
package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/pass-svc/internal/domain"
)

// PassModel representasi tabel pass untuk GORM.
type PassModel struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey"`
	KoperasiID    uuid.UUID      `gorm:"type:uuid;not null;column:koperasi_id"`
	Token         string         `gorm:"size:64;not null;uniqueIndex"`
	Consent       pq.StringArray `gorm:"type:text[]"`
	Fields        datatypes.JSON `gorm:"type:jsonb"`
	Hash          string         `gorm:"size:64;not null"`
	Tujuan        string         `gorm:"size:200"`
	Mitra         string         `gorm:"size:200"`
	BerlakuSampai time.Time      `gorm:"column:berlaku_sampai;not null"`
	Status        string         `gorm:"size:20;not null;default:aktif"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// TableName memetakan model ke tabel pass.
func (PassModel) TableName() string { return "pass" }

// PassRepository menyediakan operasi data pass.
type PassRepository struct {
	db *gorm.DB
}

// NewPassRepository membuat repository baru.
func NewPassRepository(db *gorm.DB) *PassRepository {
	return &PassRepository{db: db}
}

// Create menyimpan pass baru (RLS via HTTP context).
func (r *PassRepository) Create(ctx context.Context, in *domain.Pass) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	m, err := passToModel(in)
	if err != nil {
		tx.Rollback()
		return err
	}
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat pass").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit pass").WithCause(err)
	}
	out, err := passToDomain(m)
	if err != nil {
		return err
	}
	*in = *out
	return nil
}

// FindAll mengambil semua pass koperasi aktif (RLS).
func (r *PassRepository) FindAll(ctx context.Context) ([]*domain.Pass, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []PassModel
	if err := tx.Order("created_at DESC").Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil pass").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query pass").WithCause(err)
	}
	out := make([]*domain.Pass, 0, len(models))
	for i := range models {
		d, err := passToDomain(&models[i])
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

// FindByToken mengambil pass berdasarkan token TANPA konteks tenant.
//
// Endpoint publik (mitra memindai QR) tidak membawa identity, sehingga query
// ini tidak dapat memakai OpenTenantTx. Token bersifat acak panjang (unguessable)
// dan unik, jadi berfungsi sebagai kapabilitas akses ke satu pass spesifik.
func (r *PassRepository) FindByToken(ctx context.Context, token string) (*domain.Pass, error) {
	var m PassModel
	err := r.db.WithContext(ctx).Where("token = ?", token).First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, apperr.NotFound("pass tidak ditemukan")
	}
	if err != nil {
		return nil, apperr.Internal("gagal mengambil pass").WithCause(err)
	}
	return passToDomain(&m)
}

// RevokeByToken mengubah status pass menjadi 'dicabut' (RLS via context).
func (r *PassRepository) RevokeByToken(ctx context.Context, token string) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	res := tx.Model(&PassModel{}).
		Where("token = ?", token).
		Updates(map[string]any{
			"status":     domain.PassDicabut,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal mencabut pass").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("pass tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit pencabutan pass").WithCause(err)
	}
	return nil
}

func passToModel(in *domain.Pass) (*PassModel, error) {
	fields, err := jsonMarshal(in.Fields)
	if err != nil {
		return nil, apperr.Internal("gagal serialisasi fields pass").WithCause(err)
	}
	status := in.Status
	if status == "" {
		status = domain.PassAktif
	}
	return &PassModel{
		ID:            in.ID,
		KoperasiID:    in.KoperasiID,
		Token:         in.Token,
		Consent:       pq.StringArray(in.Consent),
		Fields:        datatypes.JSON(fields),
		Hash:          in.Hash,
		Tujuan:        in.Tujuan,
		Mitra:         in.Mitra,
		BerlakuSampai: in.BerlakuSampai,
		Status:        status,
	}, nil
}

func passToDomain(m *PassModel) (*domain.Pass, error) {
	fields := map[string]any{}
	if len(m.Fields) > 0 {
		if err := jsonUnmarshal(m.Fields, &fields); err != nil {
			return nil, apperr.Internal("gagal deserialisasi fields pass").WithCause(err)
		}
	}
	return &domain.Pass{
		ID:            m.ID,
		KoperasiID:    m.KoperasiID,
		Token:         m.Token,
		Consent:       []string(m.Consent),
		Fields:        fields,
		Hash:          m.Hash,
		Tujuan:        m.Tujuan,
		Mitra:         m.Mitra,
		BerlakuSampai: m.BerlakuSampai,
		Status:        m.Status,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}, nil
}

// rollbackOnPanic adalah helper defer untuk rollback transaksi saat panic.
func rollbackOnPanic(tx *gorm.DB) {
	if p := recover(); p != nil {
		tx.Rollback()
		panic(p)
	}
}
