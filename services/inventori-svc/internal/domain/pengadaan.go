package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status pengadaan.
const (
	PengadaanPending    = "pending"
	PengadaanFinalisasi = "finalisasi"
)

// Pengadaan adalah pembelian komoditas dari distributor/supplier.
type Pengadaan struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	Komoditas  string
	Jumlah     float64
	Satuan     string
	Harga      float64
	Supplier   string
	Status     string // pending|finalisasi
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
