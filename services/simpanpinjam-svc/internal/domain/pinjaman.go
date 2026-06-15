package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status pinjaman.
const (
	PinjamanAktif = "aktif"
	PinjamanLunas = "lunas"
	PinjamanMacet = "macet"
)

// Pinjaman adalah kredit yang diberikan koperasi kepada anggota.
type Pinjaman struct {
	ID               uuid.UUID
	KoperasiID       uuid.UUID
	AnggotaID        uuid.UUID
	Pokok            float64
	Tenor            int // bulan
	AngsuranPerBulan float64
	BungaPersen      float64
	Status           string // aktif|lunas|macet
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
