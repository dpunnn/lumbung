package domain

import (
	"time"

	"github.com/google/uuid"
)

type Pakan struct {
	ID           uuid.UUID
	KoperasiID   uuid.UUID
	Nama         string
	Stok         float64
	Satuan       string
	BatasMinimum float64
	UpdatedAt    time.Time
}
