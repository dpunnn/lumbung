// Package domain berisi entitas inti marketplace-svc (produk & order).
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Kategori produk yang valid pada katalog marketplace koperasi.
const (
	KategoriTernak = "ternak"
	KategoriBeras  = "beras"
	KategoriSayur  = "sayur"
	KategoriPupuk  = "pupuk"
	KategoriOlahan = "olahan"
)

// Produk adalah item yang dijual koperasi di marketplace publik.
type Produk struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	Slug       string // URL-safe, unik per platform (produk aktif)
	Nama       string
	Deskripsi  string
	Harga      float64
	Stok       int
	Kategori   string // ternak|beras|sayur|pupuk|olahan
	FotoURL    string
	Aktif      bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// KategoriValid mengecek apakah kategori termasuk yang diizinkan.
func KategoriValid(k string) bool {
	switch k {
	case KategoriTernak, KategoriBeras, KategoriSayur, KategoriPupuk, KategoriOlahan:
		return true
	default:
		return false
	}
}
