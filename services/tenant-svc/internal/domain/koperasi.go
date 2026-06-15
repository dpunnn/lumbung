// Package domain berisi model domain tenant-svc.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Koperasi adalah tenant dalam platform LUMBUNG.
type Koperasi struct {
	ID        uuid.UUID
	Nama      string
	Jenis     string   // ternak|sayur|beras|pupuk|air
	Komoditas string
	Modules   []string // daftar modul aktif
	Wilayah   string
	Alamat    string
	CreatedAt time.Time
	UpdatedAt time.Time
}
