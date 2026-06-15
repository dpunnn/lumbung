package domain

import (
	"time"

	"github.com/google/uuid"
)

// Tipe transaksi yang dibuktikan oleh receipt.
const (
	TxTypeIntake   = "intake"
	TxTypeSimpanan = "simpanan"
	TxTypePinjaman = "pinjaman"
)

// Receipt adalah bukti transaksi ber-rantai (hash chain) ala blockchain ringan.
//
// Setiap receipt menyimpan PrevHash (hash receipt sebelumnya pada koperasi yang
// sama) sehingga membentuk rantai yang sulit dipalsukan: mengubah satu transaksi
// lama akan memutus seluruh rantai sesudahnya. Hash & Signature dihitung dengan
// HMAC-SHA256 memakai HMAC_SECRET server.
type Receipt struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	TxType     string     // intake|simpanan|pinjaman
	TxID       uuid.UUID  // ID transaksi asal
	Amount     float64
	ApproverID *uuid.UUID
	WitnessID  *uuid.UUID
	PrevHash   string // hash receipt sebelumnya (chain)
	Hash       string // HMAC-SHA256(prevHash|txType|txID|amount|tanggalISO)
	Signature  string // sama dengan Hash (HMAC)
	CreatedAt  time.Time
}
