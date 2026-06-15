package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/guard-svc/internal/domain"
)

// AnomalyModel representasi tabel anomaly untuk GORM.
type AnomalyModel struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	Pola       string    `gorm:"size:50;not null"`
	RecordID   uuid.UUID `gorm:"type:uuid;not null;column:record_id"`
	Tabel      string    `gorm:"size:50;not null"`
	Keterangan string    `gorm:"type:text;not null"`
	Severity   string    `gorm:"size:10;not null;default:medium"`
	Status     string    `gorm:"size:20;not null;default:open"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// TableName memetakan model ke tabel anomaly.
func (AnomalyModel) TableName() string { return "anomaly" }

// AnomalyRepository menyediakan operasi data anomaly + pemrosesan event audit.
type AnomalyRepository struct {
	db *gorm.DB
}

// NewAnomalyRepository membuat repository baru.
func NewAnomalyRepository(db *gorm.DB) *AnomalyRepository {
	return &AnomalyRepository{db: db}
}

// DetectedAnomaly adalah hasil deteksi yang akan disimpan bila ada.
type DetectedAnomaly struct {
	Pola       string
	RecordID   uuid.UUID
	Tabel      string
	Keterangan string
	Severity   string
}

// ProcessAuditEvent memproses satu event domain secara idempoten & atomik:
//  1. Cek processed_events (skip jika sudah diproses) -> already=true
//  2. Tulis audit_log (jejak event-sourced)
//  3. Bila ada anomali terdeteksi -> insert ke tabel anomaly
//  4. Catat ke processed_events
//
// Consumer tidak punya HTTP context, jadi tenant di-set manual dari koperasiID.
func (r *AnomalyRepository) ProcessAuditEvent(
	ctx context.Context,
	eventID, consumerName string,
	koperasiID uuid.UUID,
	audit AuditInsert,
	anomalies []DetectedAnomaly,
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
		return true, nil
	}
	if errFind != gorm.ErrRecordNotFound {
		tx.Rollback()
		return false, apperr.Internal("gagal cek idempotency").WithCause(errFind)
	}

	// Tulis audit_log.
	diffRaw, mErr := json.Marshal(audit.FieldDiff)
	if mErr != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal serialisasi field_diff").WithCause(mErr)
	}
	am := &AuditLogModel{
		ID:         uuid.New(),
		KoperasiID: koperasiID,
		Aksi:       audit.Aksi,
		Tabel:      audit.Tabel,
		RecordID:   audit.RecordID,
		FieldDiff:  datatypes.JSON(diffRaw),
		ActorID:    audit.ActorID,
	}
	if err := tx.Create(am).Error; err != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal menulis audit log").WithCause(err)
	}

	// Insert anomali yang terdeteksi.
	for _, a := range anomalies {
		severity := a.Severity
		if severity == "" {
			severity = domain.SeverityMedium
		}
		anm := &AnomalyModel{
			ID:         uuid.New(),
			KoperasiID: koperasiID,
			Pola:       a.Pola,
			RecordID:   a.RecordID,
			Tabel:      a.Tabel,
			Keterangan: a.Keterangan,
			Severity:   severity,
			Status:     domain.StatusOpen,
		}
		if err := tx.Create(anm).Error; err != nil {
			tx.Rollback()
			return false, apperr.Internal("gagal menyimpan anomali").WithCause(err)
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
		return false, apperr.Internal("gagal commit proses audit").WithCause(err)
	}
	return false, nil
}

// FindOpen mengambil anomali berstatus open untuk koperasi (RLS).
func (r *AnomalyRepository) FindOpen(ctx context.Context) ([]*domain.Anomaly, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []AnomalyModel
	if err := tx.Where("status = ?", domain.StatusOpen).
		Order("created_at DESC").
		Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil anomali").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query anomali").WithCause(err)
	}
	out := make([]*domain.Anomaly, 0, len(models))
	for i := range models {
		out = append(out, anomalyToDomain(&models[i]))
	}
	return out, nil
}

// FindByID mengambil satu anomali by ID (RLS).
func (r *AnomalyRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Anomaly, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m AnomalyModel
	err = tx.Where("id = ?", id).First(&m).Error
	if err == gorm.ErrRecordNotFound {
		tx.Rollback()
		return nil, apperr.NotFound("anomali tidak ditemukan")
	}
	if err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil anomali").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query anomali").WithCause(err)
	}
	return anomalyToDomain(&m), nil
}

func anomalyToDomain(m *AnomalyModel) *domain.Anomaly {
	return &domain.Anomaly{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		Pola:       m.Pola,
		RecordID:   m.RecordID,
		Tabel:      m.Tabel,
		Keterangan: m.Keterangan,
		Severity:   m.Severity,
		Status:     m.Status,
		CreatedAt:  m.CreatedAt,
		UpdatedAt:  m.UpdatedAt,
	}
}
