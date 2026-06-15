package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/inventori-svc/internal/domain"
)

// PengadaanModel representasi tabel pengadaan untuk GORM.
type PengadaanModel struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	Komoditas  string    `gorm:"size:50;not null"`
	Jumlah     float64   `gorm:"type:numeric(15,3);not null"`
	Satuan     string    `gorm:"size:20;not null"`
	Harga      float64   `gorm:"type:numeric(15,2);not null"`
	Supplier   string    `gorm:"size:200"`
	Status     string    `gorm:"size:20;not null;default:pending"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// TableName memetakan model ke tabel pengadaan.
func (PengadaanModel) TableName() string { return "pengadaan" }

// PengadaanRepository menyediakan operasi data pengadaan.
type PengadaanRepository struct {
	db *gorm.DB
}

// NewPengadaanRepository membuat repository baru.
func NewPengadaanRepository(db *gorm.DB) *PengadaanRepository {
	return &PengadaanRepository{db: db}
}

// Create menyimpan pengadaan baru (RLS).
func (r *PengadaanRepository) Create(ctx context.Context, p *domain.Pengadaan) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	m := pengadaanToModel(p)
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat pengadaan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit pengadaan").WithCause(err)
	}
	*p = *pengadaanToDomain(m)
	return nil
}

// FindAll mengambil semua pengadaan koperasi (RLS).
func (r *PengadaanRepository) FindAll(ctx context.Context) ([]*domain.Pengadaan, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []PengadaanModel
	if err := tx.Order("created_at DESC").Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil pengadaan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query pengadaan").WithCause(err)
	}
	out := make([]*domain.Pengadaan, 0, len(models))
	for i := range models {
		out = append(out, pengadaanToDomain(&models[i]))
	}
	return out, nil
}

// Finalisasi menandai pengadaan finalisasi dan menambah stok komoditas secara
// atomik (dalam satu transaksi RLS). Idempoten: pengadaan yang sudah finalisasi
// tidak menambah stok dua kali.
func (r *PengadaanRepository) Finalisasi(ctx context.Context, id uuid.UUID) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	var m PengadaanModel
	if err := tx.Where("id = ?", id).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.NotFound("pengadaan tidak ditemukan")
		}
		return apperr.Internal("gagal mengambil pengadaan").WithCause(err)
	}
	if m.Status == domain.PengadaanFinalisasi {
		tx.Rollback()
		return apperr.Conflict("pengadaan sudah difinalisasi")
	}

	// Tambah stok komoditas (nama = komoditas).
	if err := TambahJumlahTx(tx, m.KoperasiID, m.Komoditas, m.Komoditas, m.Satuan, "", m.Jumlah); err != nil {
		tx.Rollback()
		return err
	}

	res := tx.Model(&PengadaanModel{}).
		Where("id = ?", id).
		Updates(map[string]any{"status": domain.PengadaanFinalisasi, "updated_at": time.Now()})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal finalisasi pengadaan").WithCause(res.Error)
	}

	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit finalisasi pengadaan").WithCause(err)
	}
	return nil
}

func pengadaanToModel(p *domain.Pengadaan) *PengadaanModel {
	status := p.Status
	if status == "" {
		status = domain.PengadaanPending
	}
	return &PengadaanModel{
		ID:         p.ID,
		KoperasiID: p.KoperasiID,
		Komoditas:  p.Komoditas,
		Jumlah:     p.Jumlah,
		Satuan:     p.Satuan,
		Harga:      p.Harga,
		Supplier:   p.Supplier,
		Status:     status,
	}
}

func pengadaanToDomain(m *PengadaanModel) *domain.Pengadaan {
	return &domain.Pengadaan{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		Komoditas:  m.Komoditas,
		Jumlah:     m.Jumlah,
		Satuan:     m.Satuan,
		Harga:      m.Harga,
		Supplier:   m.Supplier,
		Status:     m.Status,
		CreatedAt:  m.CreatedAt,
		UpdatedAt:  m.UpdatedAt,
	}
}
