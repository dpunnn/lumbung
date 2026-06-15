package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
)

// RiwayatKreditModel representasi tabel riwayat_kredit (lintas-tenant, TANPA RLS).
type RiwayatKreditModel struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	NikHash    string    `gorm:"size:64;not null;column:nik_hash"`
	KoperasiID uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	Skor       int       `gorm:"not null"`
	Keterangan string    `gorm:"type:text"`
	CreatedAt  time.Time
}

// TableName memetakan model ke tabel riwayat_kredit.
func (RiwayatKreditModel) TableName() string { return "riwayat_kredit" }

// RiwayatKreditRepository menyediakan operasi skoring kredit lintas-tenant.
// Tabel ini TIDAK memakai RLS, jadi query dijalankan langsung (tanpa OpenTenantTx).
type RiwayatKreditRepository struct {
	db *gorm.DB
}

// NewRiwayatKreditRepository membuat repository baru.
func NewRiwayatKreditRepository(db *gorm.DB) *RiwayatKreditRepository {
	return &RiwayatKreditRepository{db: db}
}

// AvgSkor mengembalikan rata-rata skor lintas koperasi untuk sebuah nik_hash,
// beserta jumlah catatan yang ditemukan.
func (r *RiwayatKreditRepository) AvgSkor(ctx context.Context, nikHash string) (avg float64, count int64, err error) {
	type result struct {
		Avg   float64
		Total int64
	}
	var res result
	if err := r.db.WithContext(ctx).
		Model(&RiwayatKreditModel{}).
		Where("nik_hash = ?", nikHash).
		Select("COALESCE(AVG(skor), 0) AS avg, COUNT(*) AS total").
		Scan(&res).Error; err != nil {
		return 0, 0, apperr.Internal("gagal menghitung skor kredit").WithCause(err)
	}
	return res.Avg, res.Total, nil
}

// Record menambahkan satu catatan skor kredit untuk nik_hash di sebuah koperasi.
func (r *RiwayatKreditRepository) Record(ctx context.Context, nikHash string, koperasiID uuid.UUID, skor int, keterangan string) error {
	m := &RiwayatKreditModel{
		ID:         uuid.New(),
		NikHash:    nikHash,
		KoperasiID: koperasiID,
		Skor:       skor,
		Keterangan: keterangan,
	}
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return apperr.Internal("gagal mencatat skor kredit").WithCause(err)
	}
	return nil
}
