// Package domain berisi entitas inti notif-svc.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Tipe notifikasi berdasarkan event sumber.
const (
	TipeIntake   = "intake"
	TipeSimpanan = "simpanan"
	TipePinjaman = "pinjaman"
	TipeAnomali  = "anomali"
	TipeStok     = "stok"
	TipeProduk   = "produk"
	TipePass     = "pass"
)

// Notifikasi adalah pemberitahuan untuk koperasi (broadcast) atau user tertentu.
type Notifikasi struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	UserID     *uuid.UUID // nil = broadcast ke seluruh koperasi
	Tipe       string     // intake|simpanan|pinjaman|anomali|stok|produk|pass
	Judul      string
	Pesan      string
	Dibaca     bool
	CreatedAt  time.Time
}
