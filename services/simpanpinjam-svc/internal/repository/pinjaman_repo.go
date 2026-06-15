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

// PinjamanModel representasi tabel pinjaman untuk GORM.
type PinjamanModel struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID       uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	AnggotaID        uuid.UUID `gorm:"type:uuid;not null;column:anggota_id"`
	Pokok            float64   `gorm:"type:numeric(15,2);not null"`
	Tenor            int       `gorm:"not null"`
	AngsuranPerBulan float64   `gorm:"type:numeric(15,2);not null;column:angsuran_per_bulan"`
	BungaPersen      float64   `gorm:"type:numeric(5,2);not null;default:0;column:bunga_persen"`
	Status           string    `gorm:"size:20;not null;default:aktif"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// TableName memetakan model ke tabel pinjaman.
func (PinjamanModel) TableName() string { return "pinjaman" }

// PinjamanRepository menyediakan operasi data pinjaman.
type PinjamanRepository struct {
	db *gorm.DB
}

// NewPinjamanRepository membuat repository baru.
func NewPinjamanRepository(db *gorm.DB) *PinjamanRepository {
	return &PinjamanRepository{db: db}
}

// CreateWithAngsuran membuat pinjaman + jadwal angsuran dalam satu transaksi.
func (r *PinjamanRepository) CreateWithAngsuran(ctx context.Context, p *domain.Pinjaman, jadwal []*domain.Angsuran) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	pm := pinjamanToModel(p)
	if pm.ID == uuid.Nil {
		pm.ID = uuid.New()
	}
	if err := tx.Create(pm).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat pinjaman").WithCause(err)
	}

	for _, a := range jadwal {
		a.PinjamanID = pm.ID
		am := angsuranToModel(a)
		if am.ID == uuid.Nil {
			am.ID = uuid.New()
		}
		if err := tx.Create(am).Error; err != nil {
			tx.Rollback()
			return apperr.Internal("gagal membuat jadwal angsuran").WithCause(err)
		}
		*a = *angsuranToDomain(am)
	}

	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit pinjaman").WithCause(err)
	}
	*p = *pinjamanToDomain(pm)
	return nil
}

// FindAll mengambil semua pinjaman koperasi.
func (r *PinjamanRepository) FindAll(ctx context.Context) ([]*domain.Pinjaman, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []PinjamanModel
	if err := tx.Order("created_at DESC").Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil pinjaman").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query pinjaman").WithCause(err)
	}
	out := make([]*domain.Pinjaman, 0, len(models))
	for i := range models {
		out = append(out, pinjamanToDomain(&models[i]))
	}
	return out, nil
}

// FindByID mengambil satu pinjaman.
func (r *PinjamanRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Pinjaman, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m PinjamanModel
	if err := tx.Where("id = ?", id).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("pinjaman tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil pinjaman").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query pinjaman").WithCause(err)
	}
	return pinjamanToDomain(&m), nil
}

// SetStatus mengubah status pinjaman.
func (r *PinjamanRepository) SetStatus(ctx context.Context, id uuid.UUID, status string) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	res := tx.Model(&PinjamanModel{}).
		Where("id = ?", id).
		Updates(map[string]any{"status": status, "updated_at": time.Now()})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal mengubah status pinjaman").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("pinjaman tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit status pinjaman").WithCause(err)
	}
	return nil
}

// CountAktif menghitung jumlah pinjaman berstatus aktif di tenant.
func (r *PinjamanRepository) CountAktif(ctx context.Context) (int64, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return 0, err
	}
	defer rollbackOnPanic(tx)

	var count int64
	if err := tx.Model(&PinjamanModel{}).
		Where("status = ?", domain.PinjamanAktif).
		Count(&count).Error; err != nil {
		tx.Rollback()
		return 0, apperr.Internal("gagal menghitung pinjaman aktif").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return 0, apperr.Internal("gagal commit hitung pinjaman").WithCause(err)
	}
	return count, nil
}

func pinjamanToModel(p *domain.Pinjaman) *PinjamanModel {
	return &PinjamanModel{
		ID:               p.ID,
		KoperasiID:       p.KoperasiID,
		AnggotaID:        p.AnggotaID,
		Pokok:            p.Pokok,
		Tenor:            p.Tenor,
		AngsuranPerBulan: p.AngsuranPerBulan,
		BungaPersen:      p.BungaPersen,
		Status:           p.Status,
	}
}

func pinjamanToDomain(m *PinjamanModel) *domain.Pinjaman {
	return &domain.Pinjaman{
		ID:               m.ID,
		KoperasiID:       m.KoperasiID,
		AnggotaID:        m.AnggotaID,
		Pokok:            m.Pokok,
		Tenor:            m.Tenor,
		AngsuranPerBulan: m.AngsuranPerBulan,
		BungaPersen:      m.BungaPersen,
		Status:           m.Status,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}
