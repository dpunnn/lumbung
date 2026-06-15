// Package repository berisi akses data tenant-svc (GORM).
package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"

	"github.com/lumbung/tenant-svc/internal/domain"
	apperr "github.com/lumbung/shared/errors"
)

// KoperasiModel adalah representasi tabel koperasi untuk GORM.
type KoperasiModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey"`
	Nama      string         `gorm:"size:200;not null"`
	Jenis     string         `gorm:"size:50;not null;default:ternak"`
	Komoditas string         `gorm:"size:100"`
	Modules   pq.StringArray `gorm:"type:text[];not null;default:'{}'"`
	Wilayah   string         `gorm:"size:200"`
	Alamat    string         `gorm:"type:text"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time `gorm:"index"`
}

// TableName memetakan model ke tabel koperasi.
func (KoperasiModel) TableName() string { return "koperasi" }

// KoperasiRepository menyediakan operasi data koperasi.
type KoperasiRepository struct {
	db *gorm.DB
}

// NewKoperasiRepository membuat repository baru.
func NewKoperasiRepository(db *gorm.DB) *KoperasiRepository {
	return &KoperasiRepository{db: db}
}

// Create menyimpan koperasi baru.
func (r *KoperasiRepository) Create(ctx context.Context, k *domain.Koperasi) error {
	m := toModel(k)
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return apperr.Internal("gagal membuat koperasi").WithCause(err)
	}
	*k = *toDomain(m)
	return nil
}

// FindAll mengambil semua koperasi yang belum dihapus.
func (r *KoperasiRepository) FindAll(ctx context.Context) ([]*domain.Koperasi, error) {
	var models []KoperasiModel
	if err := r.db.WithContext(ctx).
		Where("deleted_at IS NULL").
		Order("created_at DESC").
		Find(&models).Error; err != nil {
		return nil, apperr.Internal("gagal mengambil daftar koperasi").WithCause(err)
	}
	out := make([]*domain.Koperasi, 0, len(models))
	for i := range models {
		out = append(out, toDomain(&models[i]))
	}
	return out, nil
}

// FindByID mengambil koperasi berdasarkan ID.
func (r *KoperasiRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Koperasi, error) {
	var m KoperasiModel
	if err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("koperasi tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil koperasi").WithCause(err)
	}
	return toDomain(&m), nil
}

// Update memperbarui field koperasi.
func (r *KoperasiRepository) Update(ctx context.Context, k *domain.Koperasi) error {
	m := toModel(k)
	res := r.db.WithContext(ctx).
		Model(&KoperasiModel{}).
		Where("id = ? AND deleted_at IS NULL", k.ID).
		Updates(map[string]any{
			"nama":       m.Nama,
			"jenis":      m.Jenis,
			"komoditas":  m.Komoditas,
			"wilayah":    m.Wilayah,
			"alamat":     m.Alamat,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return apperr.Internal("gagal memperbarui koperasi").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("koperasi tidak ditemukan")
	}
	return nil
}

// PatchModules memperbarui daftar modul aktif koperasi.
func (r *KoperasiRepository) PatchModules(ctx context.Context, id uuid.UUID, modules []string) error {
	res := r.db.WithContext(ctx).
		Model(&KoperasiModel{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]any{
			"modules":    pq.StringArray(modules),
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return apperr.Internal("gagal memperbarui modul koperasi").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound("koperasi tidak ditemukan")
	}
	return nil
}

func toModel(k *domain.Koperasi) *KoperasiModel {
	mods := k.Modules
	if mods == nil {
		mods = []string{}
	}
	return &KoperasiModel{
		ID:        k.ID,
		Nama:      k.Nama,
		Jenis:     k.Jenis,
		Komoditas: k.Komoditas,
		Modules:   pq.StringArray(mods),
		Wilayah:   k.Wilayah,
		Alamat:    k.Alamat,
	}
}

func toDomain(m *KoperasiModel) *domain.Koperasi {
	return &domain.Koperasi{
		ID:        m.ID,
		Nama:      m.Nama,
		Jenis:     m.Jenis,
		Komoditas: m.Komoditas,
		Modules:   []string(m.Modules),
		Wilayah:   m.Wilayah,
		Alamat:    m.Alamat,
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}
