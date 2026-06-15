package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status intake batch.
const (
	IntakePending   = "pending"
	IntakeConfirmed = "confirmed"
)

// Mode AI penilaian mutu.
const (
	AiModeServer   = "server"
	AiModeOnDevice = "on_device"
)

// IntakeBatch adalah setoran komoditas dari anggota (di-witness Saksi AI).
type IntakeBatch struct {
	ID          uuid.UUID
	KoperasiID  uuid.UUID
	AnggotaID   uuid.UUID
	Komoditas   string
	Jumlah      float64
	Mutu        string
	Skor        float64 // skor mutu 0-100 dari ai-svc
	FotoURL     string
	ReceiptHash string // HMAC receipt dari pass-svc
	AiMode      string // server|on_device
	Status      string // pending|confirmed
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
