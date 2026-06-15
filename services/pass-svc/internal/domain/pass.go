// Package domain berisi entitas inti pass-svc: Pass (consent-based data sharing)
// dan Receipt (bukti transaksi ber-rantai HMAC, tamper-proof).
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Status pass.
const (
	PassAktif   = "aktif"
	PassDicabut = "dicabut"
)

// Pass adalah "kartu identitas digital" koperasi: snapshot data anggota/koperasi
// yang dibagikan ke mitra (bank, dinas) secara consent-based dan tamper-proof.
//
// Token dipakai sebagai akses publik (tanpa auth) ke subset field dalam Consent.
// Hash = SHA-256 dari Fields agar mitra dapat memverifikasi data tidak diubah.
type Pass struct {
	ID            uuid.UUID
	KoperasiID    uuid.UUID
	Token         string         // URL-safe random token untuk akses publik
	Consent       []string       // field yang diizinkan dibagikan
	Fields        map[string]any // snapshot data (jsonb)
	Hash          string         // SHA-256 dari Fields (tamper-proof)
	Tujuan        string
	Mitra         string
	BerlakuSampai time.Time
	Status        string // aktif|dicabut
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
