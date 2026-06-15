package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/simpanpinjam-svc/internal/domain"
)

// AngsuranModel representasi tabel angsuran untuk GORM.
type AngsuranModel struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey"`
	PinjamanID   uuid.UUID  `gorm:"type:uuid;not null;column:pinjaman_id"`
	KoperasiID   uuid.UUID  `gorm:"type:uuid;not null;column:koperasi_id"`
	BulanKe      int        `gorm:"not null;column:bulan_ke"`
	JumlahBayar  float64    `gorm:"type:numeric(15,2);not null;column:jumlah_bayar"`
	Status       string     `gorm:"size:20;not null;default:pending"`
	TanggalBayar *time.Time `gorm:"column:tanggal_bayar"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// TableName memetakan model ke tabel angsuran.
func (AngsuranModel) TableName() string { return "angsuran" }

// AngsuranRepository menyediakan operasi data angsuran.
type AngsuranRepository struct {
	db *gorm.DB
}

// NewAngsuranRepository membuat repository baru.
func NewAngsuranRepository(db *gorm.DB) *AngsuranRepository {
	return &AngsuranRepository{db: db}
}

// FindByPinjaman mengambil seluruh angsuran sebuah pinjaman urut bulan.
func (r *AngsuranRepository) FindByPinjaman(ctx context.Context, pinjamanID uuid.UUID) ([]*domain.Angsuran, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []AngsuranModel
	if err := tx.Where("pinjaman_id = ?", pinjamanID).
		Order("bulan_ke ASC").
		Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil angsuran").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query angsuran").WithCause(err)
	}
	out := make([]*domain.Angsuran, 0, len(models))
	for i := range models {
		out = append(out, angsuranToDomain(&models[i]))
	}
	return out, nil
}

// BayarBulan menandai angsuran bulan tertentu lunas; mengembalikan angsuran
// terupdate dan jumlah angsuran yang belum lunas tersisa pada pinjaman.
func (r *AngsuranRepository) BayarBulan(ctx context.Context, pinjamanID uuid.UUID, bulanKe int) (*domain.Angsuran, int64, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, 0, err
	}
	defer rollbackOnPanic(tx)

	now := time.Now()
	res := tx.Model(&AngsuranModel{}).
		Where("pinjaman_id = ? AND bulan_ke = ? AND status <> ?", pinjamanID, bulanKe, domain.AngsuranLunas).
		Updates(map[string]any{
			"status":        domain.AngsuranLunas,
			"tanggal_bayar": now,
			"updated_at":    now,
		})
	if res.Error != nil {
		tx.Rollback()
		return nil, 0, apperr.Internal("gagal membayar angsuran").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return nil, 0, apperr.NotFound("angsuran bulan tersebut tidak ditemukan atau sudah lunas")
	}

	var m AngsuranModel
	if err := tx.Where("pinjaman_id = ? AND bulan_ke = ?", pinjamanID, bulanKe).
		First(&m).Error; err != nil {
		tx.Rollback()
		return nil, 0, apperr.Internal("gagal mengambil angsuran terbayar").WithCause(err)
	}

	var sisa int64
	if err := tx.Model(&AngsuranModel{}).
		Where("pinjaman_id = ? AND status <> ?", pinjamanID, domain.AngsuranLunas).
		Count(&sisa).Error; err != nil {
		tx.Rollback()
		return nil, 0, apperr.Internal("gagal menghitung sisa angsuran").WithCause(err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, 0, apperr.Internal("gagal commit pembayaran angsuran").WithCause(err)
	}
	return angsuranToDomain(&m), sisa, nil
}

// CountAnggotaTunggakan menghitung jumlah anggota unik (via pinjaman) yang punya
// minimal satu angsuran belum lunas di tenant.
func (r *AngsuranRepository) CountAnggotaTunggakan(ctx context.Context) (int64, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return 0, err
	}
	defer rollbackOnPanic(tx)

	var count int64
	// Hitung anggota unik dari pinjaman yang punya angsuran belum lunas.
	if err := tx.Raw(`
		SELECT COUNT(DISTINCT p.anggota_id)
		FROM pinjaman p
		JOIN angsuran a ON a.pinjaman_id = p.id
		WHERE a.status <> ?
		  AND p.koperasi_id = current_setting('app.current_tenant', true)::uuid
	`, domain.AngsuranLunas).Scan(&count).Error; err != nil {
		tx.Rollback()
		return 0, apperr.Internal("gagal menghitung anggota tunggakan").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return 0, apperr.Internal("gagal commit hitung tunggakan").WithCause(err)
	}
	return count, nil
}

func angsuranToModel(a *domain.Angsuran) *AngsuranModel {
	return &AngsuranModel{
		ID:           a.ID,
		PinjamanID:   a.PinjamanID,
		KoperasiID:   a.KoperasiID,
		BulanKe:      a.BulanKe,
		JumlahBayar:  a.JumlahBayar,
		Status:       a.Status,
		TanggalBayar: a.TanggalBayar,
	}
}

func angsuranToDomain(m *AngsuranModel) *domain.Angsuran {
	return &domain.Angsuran{
		ID:           m.ID,
		PinjamanID:   m.PinjamanID,
		KoperasiID:   m.KoperasiID,
		BulanKe:      m.BulanKe,
		JumlahBayar:  m.JumlahBayar,
		Status:       m.Status,
		TanggalBayar: m.TanggalBayar,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
}
