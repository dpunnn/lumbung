package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status angsuran.
const (
	AngsuranPending   = "pending"
	AngsuranLunas     = "lunas"
	AngsuranTerlambat = "terlambat"
)

// Angsuran adalah cicilan bulanan dari sebuah pinjaman.
type Angsuran struct {
	ID           uuid.UUID
	PinjamanID   uuid.UUID
	KoperasiID   uuid.UUID
	BulanKe      int
	JumlahBayar  float64
	Status       string // pending|lunas|terlambat
	TanggalBayar *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
