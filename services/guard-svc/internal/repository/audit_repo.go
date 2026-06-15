// Package repository berisi akses data guard-svc (GORM) dengan RLS.
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

// AuditLogModel representasi tabel audit_log untuk GORM.
type AuditLogModel struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID      `gorm:"type:uuid;not null;column:koperasi_id"`
	Aksi       string         `gorm:"size:20;not null"`
	Tabel      string         `gorm:"size:50;not null"`
	RecordID   uuid.UUID      `gorm:"type:uuid;not null;column:record_id"`
	FieldDiff  datatypes.JSON `gorm:"type:jsonb;column:field_diff"`
	ActorID    *uuid.UUID     `gorm:"type:uuid;column:actor_id"`
	CreatedAt  time.Time
}

// TableName memetakan model ke tabel audit_log.
func (AuditLogModel) TableName() string { return "audit_log" }

// ProcessedEventModel representasi tabel processed_events (idempotency consumer).
type ProcessedEventModel struct {
	EventID      string    `gorm:"size:36;primaryKey;column:event_id"`
	ConsumerName string    `gorm:"size:100;not null;column:consumer_name"`
	ProcessedAt  time.Time `gorm:"column:processed_at"`
}

// TableName memetakan model ke tabel processed_events.
func (ProcessedEventModel) TableName() string { return "processed_events" }

// AuditRepository menyediakan operasi data audit_log + idempotency.
type AuditRepository struct {
	db *gorm.DB
}

// NewAuditRepository membuat repository baru.
func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// AuditInsert adalah baris audit yang ditulis oleh consumer.
type AuditInsert struct {
	KoperasiID uuid.UUID
	Aksi       string
	Tabel      string
	RecordID   uuid.UUID
	FieldDiff  map[string]any
	ActorID    *uuid.UUID
}

// FindAll mengambil audit log koperasi (RLS), opsional difilter tabel & record.
func (r *AuditRepository) FindAll(ctx context.Context, tabel string, recordID *uuid.UUID) ([]*domain.AuditLog, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	q := tx.Order("created_at DESC")
	if tabel != "" {
		q = q.Where("tabel = ?", tabel)
	}
	if recordID != nil {
		q = q.Where("record_id = ?", *recordID)
	}

	var models []AuditLogModel
	if err := q.Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil audit log").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query audit").WithCause(err)
	}
	out := make([]*domain.AuditLog, 0, len(models))
	for i := range models {
		d, err := auditToDomain(&models[i])
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

func auditToDomain(m *AuditLogModel) (*domain.AuditLog, error) {
	diff := map[string]any{}
	if len(m.FieldDiff) > 0 {
		if err := json.Unmarshal(m.FieldDiff, &diff); err != nil {
			return nil, apperr.Internal("gagal deserialisasi field_diff").WithCause(err)
		}
	}
	return &domain.AuditLog{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		Aksi:       m.Aksi,
		Tabel:      m.Tabel,
		RecordID:   m.RecordID,
		FieldDiff:  diff,
		ActorID:    m.ActorID,
		CreatedAt:  m.CreatedAt,
	}, nil
}

// rollbackOnPanic adalah helper defer untuk rollback transaksi saat panic.
func rollbackOnPanic(tx *gorm.DB) {
	if p := recover(); p != nil {
		tx.Rollback()
		panic(p)
	}
}
