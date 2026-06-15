// Package domain berisi model domain member-svc.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status anggota yang diizinkan.
const (
	StatusAktif    = "aktif"
	StatusNonaktif = "nonaktif"
	StatusPending  = "pending"
)

// Anggota adalah anggota koperasi (member). NIK disimpan sebagai hash SHA-256
// (privacy-preserving) -- NIK mentah tidak pernah dipersistensi.
type Anggota struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	Nama       string
	NikHash    string // SHA-256 hex NIK
	Alamat     string
	Telepon    string
	Status     string // aktif|nonaktif|pending
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
