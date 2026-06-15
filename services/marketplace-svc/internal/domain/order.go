package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status order yang valid sepanjang siklus hidupnya.
const (
	StatusPending     = "pending"
	StatusConfirmed   = "confirmed"
	StatusSelesai     = "selesai"
	StatusDibatalkan  = "dibatalkan"
)

// Order adalah pesanan pembeli (bisa pembeli luar tanpa akun) atas produk koperasi.
type Order struct {
	ID           uuid.UUID
	KoperasiID   uuid.UUID
	PembeliNama  string
	PembeliEmail string
	Total        float64
	Status       string // pending|confirmed|selesai|dibatalkan
	Items        []OrderItem
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// OrderItem adalah baris item dalam sebuah order dengan snapshot harga saat pemesanan.
type OrderItem struct {
	ID       uuid.UUID
	OrderID  uuid.UUID
	ProdukID uuid.UUID
	Qty      int
	Harga    float64 // harga saat order (snapshot, immutable)
}

// StatusOrderValid mengecek transisi status yang diizinkan.
func StatusOrderValid(s string) bool {
	switch s {
	case StatusPending, StatusConfirmed, StatusSelesai, StatusDibatalkan:
		return true
	default:
		return false
	}
}
