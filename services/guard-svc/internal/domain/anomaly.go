package domain

import (
	"time"

	"github.com/google/uuid"
)

// Pola anomali yang dideteksi guard-svc.
const (
	PolaDispute            = "dispute"
	PolaClaim              = "claim"
	PolaHapusFinansial     = "hapus_finansial"
	PolaUbahNominal        = "ubah_nominal"
	PolaPembatalanLuarJam  = "pembatalan_luar_jam"
)

// Tingkat keparahan anomali.
const (
	SeverityLow    = "low"
	SeverityMedium = "medium"
	SeverityHigh   = "high"
)

// Status penanganan anomali.
const (
	StatusOpen      = "open"
	StatusReviewed  = "reviewed"
	StatusDismissed = "dismissed"
)

// Anomaly adalah pola transaksi mencurigakan yang terdeteksi dari event domain.
type Anomaly struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	Pola       string // dispute|claim|hapus_finansial|ubah_nominal|pembatalan_luar_jam
	RecordID   uuid.UUID
	Tabel      string
	Keterangan string
	Severity   string // low|medium|high
	Status     string // open|reviewed|dismissed
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
