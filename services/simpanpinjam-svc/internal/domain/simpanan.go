// Package domain berisi model domain simpanpinjam-svc.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Jenis simpanan yang diizinkan.
const (
	JenisPokok    = "pokok"
	JenisWajib    = "wajib"
	JenisSukarela = "sukarela"
)

// Status simpanan.
const (
	SimpananPending   = "pending"
	SimpananConfirmed = "confirmed"
	SimpananDisputed  = "disputed"
	SimpananClaimed   = "claimed"
)

// Simpanan adalah setoran simpanan anggota (pokok/wajib/sukarela).
type Simpanan struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	AnggotaID  uuid.UUID
	Jenis      string // pokok|wajib|sukarela
	Jumlah     float64
	Status     string // pending|confirmed|disputed|claimed
	ApproverID *uuid.UUID
	WitnessID  *uuid.UUID
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
