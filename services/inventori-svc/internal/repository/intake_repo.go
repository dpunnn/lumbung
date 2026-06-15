package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/inventori-svc/internal/domain"
)

// IntakeBatchModel representasi tabel intake_batch untuk GORM.
type IntakeBatchModel struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID  uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	AnggotaID   uuid.UUID `gorm:"type:uuid;not null;column:anggota_id"`
	Komoditas   string    `gorm:"size:50;not null"`
	Jumlah      float64   `gorm:"type:numeric(15,3);not null"`
	Mutu        string    `gorm:"size:5"`
	Skor        float64   `gorm:"type:numeric(5,2)"`
	FotoURL     string    `gorm:"type:text;column:foto_url"`
	ReceiptHash string    `gorm:"size:64;column:receipt_hash"`
	AiMode      string    `gorm:"size:20;not null;default:server;column:ai_mode"`
	Status      string    `gorm:"size:20;not null;default:pending"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// TableName memetakan model ke tabel intake_batch.
func (IntakeBatchModel) TableName() string { return "intake_batch" }

// ProcessedEventModel representasi tabel processed_events (idempotency consumer).
type ProcessedEventModel struct {
	EventID      string    `gorm:"size:36;primaryKey;column:event_id"`
	ConsumerName string    `gorm:"size:100;not null;column:consumer_name"`
	ProcessedAt  time.Time `gorm:"column:processed_at"`
}

// TableName memetakan model ke tabel processed_events.
func (ProcessedEventModel) TableName() string { return "processed_events" }

// IntakeRepository menyediakan operasi data intake batch.
type IntakeRepository struct {
	db *gorm.DB
}

// NewIntakeRepository membuat repository baru.
func NewIntakeRepository(db *gorm.DB) *IntakeRepository {
	return &IntakeRepository{db: db}
}

// Create menyimpan intake batch baru (RLS via HTTP context).
func (r *IntakeRepository) Create(ctx context.Context, in *domain.IntakeBatch) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	m := intakeToModel(in)
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat intake batch").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit intake batch").WithCause(err)
	}
	*in = *intakeToDomain(m)
	return nil
}

// FindAll mengambil semua intake batch koperasi (RLS).
func (r *IntakeRepository) FindAll(ctx context.Context) ([]*domain.IntakeBatch, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []IntakeBatchModel
	if err := tx.Order("created_at DESC").Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil intake batch").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query intake").WithCause(err)
	}
	out := make([]*domain.IntakeBatch, 0, len(models))
	for i := range models {
		out = append(out, intakeToDomain(&models[i]))
	}
	return out, nil
}

// ProcessIntakeEvent memproses event intake.recorded secara idempoten & atomik:
//  1. Cek processed_events (skip jika sudah diproses) -> mengembalikan already=true
//  2. Tambah stok komoditas (TambahJumlahTx)
//  3. Update intake_batch.status=confirmed jika batchID valid
//  4. Catat ke processed_events
//
// Karena consumer tidak punya HTTP context, tenant di-set manual dari koperasiID.
func (r *IntakeRepository) ProcessIntakeEvent(
	ctx context.Context,
	eventID, consumerName string,
	batchID *uuid.UUID,
	koperasiID uuid.UUID,
	komoditas, mutu string,
	jumlah, skor float64,
) (already bool, err error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return false, apperr.Internal("gagal membuka transaksi consumer").WithCause(tx.Error)
	}
	defer rollbackOnPanic(tx)

	// Set tenant agar RLS lolos untuk operasi di bawah.
	if err := tx.Exec("SELECT set_config('app.current_tenant', ?, true)", koperasiID.String()).Error; err != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal set tenant context consumer").WithCause(err)
	}

	// Idempotency check.
	var existing ProcessedEventModel
	errFind := tx.Where("event_id = ?", eventID).First(&existing).Error
	if errFind == nil {
		tx.Rollback()
		return true, nil // sudah diproses
	}
	if errFind != gorm.ErrRecordNotFound {
		tx.Rollback()
		return false, apperr.Internal("gagal cek idempotency").WithCause(errFind)
	}

	// Tambah stok. Nama default = komoditas (intake umumnya tidak bawa nama spesifik).
	nama := komoditas
	if err := TambahJumlahTx(tx, koperasiID, komoditas, nama, satuanDefault(komoditas), mutu, jumlah); err != nil {
		tx.Rollback()
		return false, err
	}

	// Update status batch jika ada.
	if batchID != nil && *batchID != uuid.Nil {
		if err := tx.Model(&IntakeBatchModel{}).
			Where("id = ?", *batchID).
			Updates(map[string]any{
				"status":     domain.IntakeConfirmed,
				"skor":       skor,
				"mutu":       mutu,
				"updated_at": time.Now(),
			}).Error; err != nil {
			tx.Rollback()
			return false, apperr.Internal("gagal konfirmasi intake batch").WithCause(err)
		}
	}

	// Catat processed_events.
	if err := tx.Create(&ProcessedEventModel{
		EventID:      eventID,
		ConsumerName: consumerName,
		ProcessedAt:  time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal mencatat processed event").WithCause(err)
	}

	if err := tx.Commit().Error; err != nil {
		return false, apperr.Internal("gagal commit proses intake").WithCause(err)
	}
	return false, nil
}

// satuanDefault memetakan komoditas ke satuan default untuk baris stok baru.
func satuanDefault(komoditas string) string {
	switch komoditas {
	case "ternak":
		return "ekor"
	case "beras", "pupuk":
		return "sak"
	case "sayur":
		return "kg"
	case "air":
		return "liter"
	default:
		return "unit"
	}
}

func intakeToModel(in *domain.IntakeBatch) *IntakeBatchModel {
	aiMode := in.AiMode
	if aiMode == "" {
		aiMode = domain.AiModeServer
	}
	status := in.Status
	if status == "" {
		status = domain.IntakePending
	}
	return &IntakeBatchModel{
		ID:          in.ID,
		KoperasiID:  in.KoperasiID,
		AnggotaID:   in.AnggotaID,
		Komoditas:   in.Komoditas,
		Jumlah:      in.Jumlah,
		Mutu:        in.Mutu,
		Skor:        in.Skor,
		FotoURL:     in.FotoURL,
		ReceiptHash: in.ReceiptHash,
		AiMode:      aiMode,
		Status:      status,
	}
}

func intakeToDomain(m *IntakeBatchModel) *domain.IntakeBatch {
	return &domain.IntakeBatch{
		ID:          m.ID,
		KoperasiID:  m.KoperasiID,
		AnggotaID:   m.AnggotaID,
		Komoditas:   m.Komoditas,
		Jumlah:      m.Jumlah,
		Mutu:        m.Mutu,
		Skor:        m.Skor,
		FotoURL:     m.FotoURL,
		ReceiptHash: m.ReceiptHash,
		AiMode:      m.AiMode,
		Status:      m.Status,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}
