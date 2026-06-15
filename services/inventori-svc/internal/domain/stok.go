// Package domain berisi model domain inventori-svc.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// StokItem adalah inventaris komoditas koperasi.
type StokItem struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	Komoditas  string // ternak|sayur|beras|pupuk|air
	Nama       string
	Satuan     string // ekor|kg|sak|liter
	Jumlah     float64
	Mutu       string // A|B|C (grade)
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
