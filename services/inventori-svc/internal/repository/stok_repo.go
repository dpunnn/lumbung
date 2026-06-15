// Package repository berisi akses data inventori-svc (GORM) dengan RLS.
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

// StokItemModel representasi tabel stok_item untuk GORM.
type StokItemModel struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	Komoditas  string    `gorm:"size:50;not null"`
	Nama       string    `gorm:"size:200;not null"`
	Satuan     string    `gorm:"size:20;not null"`
	Jumlah     float64   `gorm:"type:numeric(15,3);not null;default:0"`
	Mutu       string    `gorm:"size:5"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// TableName memetakan model ke tabel stok_item.
func (StokItemModel) TableName() string { return "stok_item" }

// StokRepository menyediakan operasi data stok.
type StokRepository struct {
	db *gorm.DB
}

// NewStokRepository membuat repository baru.
func NewStokRepository(db *gorm.DB) *StokRepository {
	return &StokRepository{db: db}
}

// FindAll mengambil semua stok koperasi (RLS aktif via HTTP context).
func (r *StokRepository) FindAll(ctx context.Context) ([]*domain.StokItem, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []StokItemModel
	if err := tx.Order("komoditas ASC, nama ASC").Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil stok").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query stok").WithCause(err)
	}
	out := make([]*domain.StokItem, 0, len(models))
	for i := range models {
		out = append(out, stokToDomain(&models[i]))
	}
	return out, nil
}

// TambahJumlahTx menambah jumlah stok untuk komoditas tertentu pada sebuah
// transaksi yang sudah men-set tenant. Jika belum ada baris untuk komoditas,
// dibuat baru. Dipakai dari consumer (intake.recorded) dan finalisasi pengadaan.
//
// tx WAJIB sudah men-set app.current_tenant agar RLS lolos.
func TambahJumlahTx(tx *gorm.DB, koperasiID uuid.UUID, komoditas, nama, satuan, mutu string, delta float64) error {
	// Coba update baris komoditas yang sudah ada (match koperasi + komoditas + nama).
	res := tx.Model(&StokItemModel{}).
		Where("koperasi_id = ? AND komoditas = ? AND nama = ?", koperasiID, komoditas, nama).
		Updates(map[string]any{
			"jumlah":     gorm.Expr("jumlah + ?", delta),
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return apperr.Internal("gagal menambah stok").WithCause(res.Error)
	}
	if res.RowsAffected > 0 {
		return nil
	}

	// Belum ada -> buat baris baru.
	m := &StokItemModel{
		ID:         uuid.New(),
		KoperasiID: koperasiID,
		Komoditas:  komoditas,
		Nama:       nama,
		Satuan:     satuan,
		Jumlah:     delta,
		Mutu:       mutu,
	}
	if err := tx.Create(m).Error; err != nil {
		return apperr.Internal("gagal membuat stok baru").WithCause(err)
	}
	return nil
}

// FindByKomoditas mengambil satu stok via koperasi + komoditas + nama (RLS).
func (r *StokRepository) FindByKomoditas(ctx context.Context, komoditas, nama string) (*domain.StokItem, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m StokItemModel
	if err := tx.Where("komoditas = ? AND nama = ?", komoditas, nama).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("stok tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil stok").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query stok").WithCause(err)
	}
	return stokToDomain(&m), nil
}

func stokToDomain(m *StokItemModel) *domain.StokItem {
	return &domain.StokItem{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		Komoditas:  m.Komoditas,
		Nama:       m.Nama,
		Satuan:     m.Satuan,
		Jumlah:     m.Jumlah,
		Mutu:       m.Mutu,
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
