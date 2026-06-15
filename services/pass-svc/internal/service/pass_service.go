// Package service berisi logika bisnis pass-svc: penerbitan Pass consent-based
// dan Receipt ber-rantai HMAC (tamper-proof) untuk hero feature "Saksi AI".
package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/pass-svc/internal/domain"
	"github.com/lumbung/pass-svc/internal/repository"
)

// EventPublisher adalah abstraksi penerbit event (shared/events.Publisher).
type EventPublisher interface {
	Publish(ctx context.Context, tenantID, eventType string, payload any) error
}

// PassService mengkoordinasi pass + receipt + event.
type PassService struct {
	passRepo    *repository.PassRepository
	receiptRepo *repository.ReceiptRepository
	pub         EventPublisher
	hmacSecret  []byte
}

// NewPassService membuat service baru. hmacSecret dipakai untuk menandatangani
// rantai receipt; jika kosong, caller wajib mengisinya (mis. dari JWT_SECRET).
func NewPassService(
	passRepo *repository.PassRepository,
	receiptRepo *repository.ReceiptRepository,
	pub EventPublisher,
	hmacSecret []byte,
) *PassService {
	return &PassService{
		passRepo:    passRepo,
		receiptRepo: receiptRepo,
		pub:         pub,
		hmacSecret:  hmacSecret,
	}
}

// CreatePassInput masukan pembuatan pass.
type CreatePassInput struct {
	Consent       []string
	Fields        map[string]any // snapshot data; bila kosong dibuat default
	Tujuan        string
	Mitra         string
	BerlakuSampai time.Time
}

// IntakeReceiptInput masukan pembuatan receipt intake (hasil Saksi AI).
type IntakeReceiptInput struct {
	BatchID    uuid.UUID // ID intake di inventori (= tx_id)
	Komoditas  string
	Jumlah     float64
	Mutu       string
	Skor       float64
	ApproverID *uuid.UUID
	WitnessID  *uuid.UUID
	AiMode     string // server|on_device
}

// CreatePass membangun snapshot Fields, menghitung hash SHA-256, men-generate
// token publik, lalu menyimpan pass. Pada gelombang ini pass-svc tidak query
// service lain; bila Fields kosong, diisi snapshot default dari konteks.
func (s *PassService) CreatePass(ctx context.Context, in CreatePassInput) (*domain.Pass, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}

	berlaku := in.BerlakuSampai
	if berlaku.IsZero() {
		berlaku = time.Now().Add(30 * 24 * time.Hour) // default 30 hari
	}
	if berlaku.Before(time.Now()) {
		return nil, apperr.Validation("berlaku_sampai harus di masa depan")
	}

	fields := in.Fields
	if fields == nil {
		fields = map[string]any{}
	}
	// Tambahkan metadata snapshot agar mitra punya konteks penerbit.
	fields["koperasi_id"] = kid.String()
	fields["diterbitkan_pada"] = time.Now().UTC().Format(time.RFC3339)

	hash, err := hashFields(fields)
	if err != nil {
		return nil, err
	}

	token, err := generateToken()
	if err != nil {
		return nil, err
	}

	consent := normalizeConsent(in.Consent)

	p := &domain.Pass{
		KoperasiID:    kid,
		Token:         token,
		Consent:       consent,
		Fields:        fields,
		Hash:          hash,
		Tujuan:        strings.TrimSpace(in.Tujuan),
		Mitra:         strings.TrimSpace(in.Mitra),
		BerlakuSampai: berlaku,
		Status:        domain.PassAktif,
	}
	if err := s.passRepo.Create(ctx, p); err != nil {
		return nil, err
	}

	s.publish(ctx, kid.String(), "pass.issued", map[string]any{
		"pass_id":     p.ID.String(),
		"koperasi_id": kid.String(),
		"token":       p.Token,
		"mitra":       p.Mitra,
		"tujuan":      p.Tujuan,
	})
	return p, nil
}

// ListPass mengembalikan seluruh pass koperasi aktif.
func (s *PassService) ListPass(ctx context.Context) ([]*domain.Pass, error) {
	return s.passRepo.FindAll(ctx)
}

// GetPassPublic mengambil pass by token (endpoint publik, tanpa auth).
// Hanya mengembalikan field yang ada di Consent; menolak pass kedaluwarsa/dicabut.
func (s *PassService) GetPassPublic(ctx context.Context, token string) (*domain.Pass, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, apperr.BadRequest("token wajib diisi")
	}
	p, err := s.passRepo.FindByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if p.Status != domain.PassAktif {
		return nil, apperr.Forbidden("pass telah dicabut")
	}
	if p.BerlakuSampai.Before(time.Now()) {
		return nil, apperr.Forbidden("pass telah kedaluwarsa")
	}

	// Saring Fields: hanya yang diizinkan Consent yang dibagikan ke publik.
	filtered := map[string]any{}
	allow := map[string]struct{}{}
	for _, c := range p.Consent {
		allow[c] = struct{}{}
	}
	for k, v := range p.Fields {
		if _, ok := allow[k]; ok {
			filtered[k] = v
		}
	}
	p.Fields = filtered
	return p, nil
}

// RevokePass mengubah status pass (by token) menjadi 'dicabut'.
func (s *PassService) RevokePass(ctx context.Context, token string) error {
	kid, err := tenantID(ctx)
	if err != nil {
		return err
	}
	if err := s.passRepo.RevokeByToken(ctx, strings.TrimSpace(token)); err != nil {
		return err
	}
	s.publish(ctx, kid.String(), "pass.revoked", map[string]any{
		"koperasi_id": kid.String(),
		"token":       strings.TrimSpace(token),
	})
	return nil
}

// CreateIntakeReceipt membuat receipt ber-rantai untuk satu intake (hasil Saksi AI),
// lalu menerbitkan event intake.recorded agar inventori-svc menambah stok.
//
// Rantai: PrevHash = hash receipt terakhir koperasi; Hash = HMAC-SHA256(secret,
// prevHash|txType|txID|amount|tanggalISO). Perhitungan HMAC dilakukan di dalam
// transaksi repo (CreateChained) agar PrevHash konsisten dengan data tersimpan.
func (s *PassService) CreateIntakeReceipt(ctx context.Context, in IntakeReceiptInput) (*domain.Receipt, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	if in.BatchID == uuid.Nil {
		return nil, apperr.Validation("batch_id intake wajib diisi")
	}
	komoditas := strings.ToLower(strings.TrimSpace(in.Komoditas))
	if komoditas == "" {
		return nil, apperr.Validation("komoditas wajib diisi")
	}
	if in.Jumlah <= 0 {
		return nil, apperr.Validation("jumlah harus lebih dari 0")
	}
	aiMode := strings.TrimSpace(in.AiMode)
	if aiMode == "" {
		aiMode = "server"
	}

	tanggal := time.Now().UTC().Format(time.RFC3339)
	amountStr := strconv.FormatFloat(in.Jumlah, 'f', 2, 64)

	rec := &domain.Receipt{
		KoperasiID: kid,
		TxType:     domain.TxTypeIntake,
		TxID:       in.BatchID,
		Amount:     in.Jumlah,
		ApproverID: in.ApproverID,
		WitnessID:  in.WitnessID,
	}

	hasher := func(prevHash string) string {
		return computeHMAC(s.hmacSecret, prevHash, domain.TxTypeIntake, in.BatchID.String(), amountStr, tanggal)
	}
	if err := s.receiptRepo.CreateChained(ctx, rec, hasher); err != nil {
		return nil, err
	}

	// Publish intake.recorded -> inventori-svc menambah stok secara idempoten.
	s.publish(ctx, kid.String(), "intake.recorded", map[string]any{
		"batch_id":     in.BatchID.String(),
		"koperasi_id":  kid.String(),
		"komoditas":    komoditas,
		"jumlah":       in.Jumlah,
		"mutu":         in.Mutu,
		"skor":         in.Skor,
		"receipt_hash": rec.Hash,
		"ai_mode":      aiMode,
	})
	return rec, nil
}

// computeHMAC menghitung HMAC-SHA256 rantai receipt.
func computeHMAC(secret []byte, prevHash, txType, txID, amount, date string) string {
	message := prevHash + "|" + txType + "|" + txID + "|" + amount + "|" + date
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

// hashFields menghitung SHA-256 dari Fields (deterministik via JSON terurut).
func hashFields(fields map[string]any) (string, error) {
	raw, err := json.Marshal(fields)
	if err != nil {
		return "", apperr.Internal("gagal serialisasi fields untuk hash").WithCause(err)
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

// generateToken membuat token URL-safe acak 32 byte (64 hex char).
func generateToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", apperr.Internal("gagal membuat token pass").WithCause(err)
	}
	return hex.EncodeToString(buf), nil
}

// normalizeConsent membersihkan & deduplikasi daftar consent.
func normalizeConsent(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, c := range in {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}
	return out
}

// tenantID mengambil koperasi (tenant) dari identity di context.
func tenantID(ctx context.Context) (uuid.UUID, error) {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.TenantID == "" {
		return uuid.Nil, apperr.TenantMissing()
	}
	kid, err := uuid.Parse(id.TenantID)
	if err != nil {
		return uuid.Nil, apperr.BadRequest("tenant_id pada konteks bukan UUID valid")
	}
	return kid, nil
}

// publish menerbitkan event non-blocking; kegagalan hanya di-log.
func (s *PassService) publish(ctx context.Context, tenantID, eventType string, payload any) {
	if s.pub == nil {
		return
	}
	if err := s.pub.Publish(ctx, tenantID, eventType, payload); err != nil {
		slog.Warn("gagal publish event", "type", eventType, "err", err)
	}
}
