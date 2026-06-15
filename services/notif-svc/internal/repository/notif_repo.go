// Package repository berisi akses data notif-svc (GORM) dengan RLS.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/notif-svc/internal/domain"
)

// NotifikasiModel adalah representasi tabel notifikasi untuk GORM.
type NotifikasiModel struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID  `gorm:"type:uuid;not null;column:koperasi_id"`
	UserID     *uuid.UUID `gorm:"type:uuid;column:user_id"`
	Tipe       string     `gorm:"size:30;not null"`
	Judul      string     `gorm:"size:200;not null"`
	Pesan      string     `gorm:"type:text;not null"`
	Dibaca     bool       `gorm:"not null;default:false"`
	CreatedAt  time.Time
}

// TableName memetakan model ke tabel notifikasi.
func (NotifikasiModel) TableName() string { return "notifikasi" }

// ProcessedEventModel mencatat event yang sudah dikonsumsi (idempotency).
type ProcessedEventModel struct {
	EventID      string    `gorm:"primaryKey;column:event_id;size:36"`
	ConsumerName string    `gorm:"column:consumer_name;size:100;not null"`
	ProcessedAt  time.Time `gorm:"column:processed_at"`
}

// TableName memetakan model ke tabel processed_events.
func (ProcessedEventModel) TableName() string { return "processed_events" }

// NotifRepository menyediakan operasi data notifikasi.
type NotifRepository struct {
	db *gorm.DB
}

// NewNotifRepository membuat repository baru.
func NewNotifRepository(db *gorm.DB) *NotifRepository {
	return &NotifRepository{db: db}
}

// CreateFromConsumer menyimpan notifikasi secara idempoten dari sebuah event.
// Karena consumer tidak punya HTTP context, tenant di-set manual dari koperasiID.
// Mengembalikan already=true jika event sudah pernah diproses (skip).
func (r *NotifRepository) CreateFromConsumer(
	ctx context.Context,
	eventID, consumerName string,
	n *domain.Notifikasi,
) (already bool, err error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return false, apperr.Internal("gagal membuka transaksi consumer").WithCause(tx.Error)
	}
	defer rollbackOnPanic(tx)

	if err := tx.Exec("SELECT set_config('app.current_tenant', ?, true)", n.KoperasiID.String()).Error; err != nil {
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

	m := domainToModel(n)
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal menyimpan notifikasi").WithCause(err)
	}
	n.ID = m.ID
	n.CreatedAt = m.CreatedAt

	if err := tx.Create(&ProcessedEventModel{
		EventID:      eventID,
		ConsumerName: consumerName,
		ProcessedAt:  time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal mencatat processed event").WithCause(err)
	}

	if err := tx.Commit().Error; err != nil {
		return false, apperr.Internal("gagal commit notifikasi").WithCause(err)
	}
	return false, nil
}

// Create menyimpan satu notifikasi dalam konteks tenant pemanggil (RLS via context).
// Dipakai jalur HTTP/service biasa; untuk jalur consumer gunakan CreateFromConsumer
// yang sekaligus menjamin idempotency.
func (r *NotifRepository) Create(ctx context.Context, n *domain.Notifikasi) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	m := domainToModel(n)
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal menyimpan notifikasi").WithCause(err)
	}
	n.ID = m.ID
	n.CreatedAt = m.CreatedAt

	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit notifikasi").WithCause(err)
	}
	return nil
}

// FindAll mengambil notifikasi koperasi pemanggil (RLS). Belum dibaca diprioritaskan,
// lalu terbaru dulu. Dibatasi 50 baris.
func (r *NotifRepository) FindAll(ctx context.Context) ([]*domain.Notifikasi, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var models []NotifikasiModel
	if err := tx.Order("dibaca ASC, created_at DESC").Limit(50).Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil notifikasi").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query notifikasi").WithCause(err)
	}
	out := make([]*domain.Notifikasi, 0, len(models))
	for i := range models {
		out = append(out, modelToDomain(&models[i]))
	}
	return out, nil
}

// TandaiDibaca menandai notifikasi terbaca (RLS tenant).
func (r *NotifRepository) TandaiDibaca(ctx context.Context, id uuid.UUID) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	res := tx.Model(&NotifikasiModel{}).
		Where("id = ?", id).
		Update("dibaca", true)
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal menandai notifikasi").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("notifikasi tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit tandai notifikasi").WithCause(err)
	}
	return nil
}

func domainToModel(n *domain.Notifikasi) *NotifikasiModel {
	id := n.ID
	if id == uuid.Nil {
		id = uuid.New()
	}
	return &NotifikasiModel{
		ID:         id,
		KoperasiID: n.KoperasiID,
		UserID:     n.UserID,
		Tipe:       n.Tipe,
		Judul:      n.Judul,
		Pesan:      n.Pesan,
		Dibaca:     n.Dibaca,
	}
}

func modelToDomain(m *NotifikasiModel) *domain.Notifikasi {
	return &domain.Notifikasi{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		UserID:     m.UserID,
		Tipe:       m.Tipe,
		Judul:      m.Judul,
		Pesan:      m.Pesan,
		Dibaca:     m.Dibaca,
		CreatedAt:  m.CreatedAt,
	}
}

// rollbackOnPanic adalah helper defer untuk rollback transaksi saat panic.
func rollbackOnPanic(tx *gorm.DB) {
	if p := recover(); p != nil {
		tx.Rollback()
		panic(p)
	}
}
