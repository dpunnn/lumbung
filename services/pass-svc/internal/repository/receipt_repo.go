package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/pass-svc/internal/domain"
)

// ReceiptModel representasi tabel receipt untuk GORM.
type ReceiptModel struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID  `gorm:"type:uuid;not null;column:koperasi_id"`
	TxType     string     `gorm:"size:30;not null;column:tx_type"`
	TxID       uuid.UUID  `gorm:"type:uuid;not null;column:tx_id"`
	Amount     float64    `gorm:"type:numeric(15,2);not null"`
	ApproverID *uuid.UUID `gorm:"type:uuid;column:approver_id"`
	WitnessID  *uuid.UUID `gorm:"type:uuid;column:witness_id"`
	PrevHash   string     `gorm:"size:64;not null;default:'';column:prev_hash"`
	Hash       string     `gorm:"size:64;not null"`
	Signature  string     `gorm:"size:64;not null"`
	CreatedAt  time.Time
}

// TableName memetakan model ke tabel receipt.
func (ReceiptModel) TableName() string { return "receipt" }

// ProcessedEventModel representasi tabel processed_events (idempotency consumer).
type ProcessedEventModel struct {
	EventID      string    `gorm:"size:36;primaryKey;column:event_id"`
	ConsumerName string    `gorm:"size:100;not null;column:consumer_name"`
	ProcessedAt  time.Time `gorm:"column:processed_at"`
}

// TableName memetakan model ke tabel processed_events.
func (ProcessedEventModel) TableName() string { return "processed_events" }

// ReceiptRepository menyediakan operasi data receipt (hash chain).
type ReceiptRepository struct {
	db *gorm.DB
}

// NewReceiptRepository membuat repository baru.
func NewReceiptRepository(db *gorm.DB) *ReceiptRepository {
	return &ReceiptRepository{db: db}
}

// LatestHash mengembalikan hash receipt terbaru pada sebuah transaksi (tx).
// Dipakai untuk menyusun PrevHash rantai. Mengembalikan "" jika belum ada.
func latestHashTx(tx *gorm.DB, koperasiID uuid.UUID) (string, error) {
	var m ReceiptModel
	err := tx.Where("koperasi_id = ?", koperasiID).
		Order("created_at DESC").
		First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", apperr.Internal("gagal mengambil hash receipt terakhir").WithCause(err)
	}
	return m.Hash, nil
}

// CreateChained membuat receipt baru dalam satu transaksi atomik:
//  1. ambil PrevHash (hash receipt terakhir koperasi)
//  2. hitung Hash via fn hasher(prevHash) yang disuntikkan service
//  3. simpan receipt
//
// hasher menerima prevHash dan mengembalikan hash final; ini menjaga logika
// kriptografi (HMAC + secret) tetap di service layer, repo hanya orkestrasi DB.
func (r *ReceiptRepository) CreateChained(
	ctx context.Context,
	in *domain.Receipt,
	hasher func(prevHash string) string,
) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	prevHash, err := latestHashTx(tx, in.KoperasiID)
	if err != nil {
		tx.Rollback()
		return err
	}
	in.PrevHash = prevHash
	in.Hash = hasher(prevHash)
	in.Signature = in.Hash

	m := receiptToModel(in)
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat receipt").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit receipt").WithCause(err)
	}
	*in = *receiptToDomain(m)
	return nil
}

func receiptToModel(in *domain.Receipt) *ReceiptModel {
	return &ReceiptModel{
		ID:         in.ID,
		KoperasiID: in.KoperasiID,
		TxType:     in.TxType,
		TxID:       in.TxID,
		Amount:     in.Amount,
		ApproverID: in.ApproverID,
		WitnessID:  in.WitnessID,
		PrevHash:   in.PrevHash,
		Hash:       in.Hash,
		Signature:  in.Signature,
	}
}

func receiptToDomain(m *ReceiptModel) *domain.Receipt {
	return &domain.Receipt{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		TxType:     m.TxType,
		TxID:       m.TxID,
		Amount:     m.Amount,
		ApproverID: m.ApproverID,
		WitnessID:  m.WitnessID,
		PrevHash:   m.PrevHash,
		Hash:       m.Hash,
		Signature:  m.Signature,
		CreatedAt:  m.CreatedAt,
	}
}

// jsonMarshal/jsonUnmarshal adalah pembungkus tipis encoding/json agar
// pemakaian di pass_repo lebih ringkas dan terpusat.
func jsonMarshal(v any) ([]byte, error)   { return json.Marshal(v) }
func jsonUnmarshal(b []byte, v any) error { return json.Unmarshal(b, v) }
