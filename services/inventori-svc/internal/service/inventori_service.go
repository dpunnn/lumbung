// Package service berisi logika bisnis inventori-svc.
package service

import (
	"context"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/inventori-svc/internal/domain"
	"github.com/lumbung/inventori-svc/internal/repository"
)

// EventPublisher adalah abstraksi penerbit event (shared/events.Publisher).
type EventPublisher interface {
	Publish(ctx context.Context, tenantID, eventType string, payload any) error
}

// IntakeInput masukan pencatatan intake batch.
type IntakeInput struct {
	AnggotaID uuid.UUID
	Komoditas string
	Jumlah    float64
	Mutu      string
	Skor      float64
	FotoURL   string
	AiMode    string
}

// PengadaanInput masukan pembuatan pengadaan.
type PengadaanInput struct {
	Komoditas string
	Jumlah    float64
	Satuan    string
	Harga     float64
	Supplier  string
}

// InventoriService mengkoordinasi stok, intake, pengadaan + event.
type InventoriService struct {
	stokRepo      *repository.StokRepository
	intakeRepo    *repository.IntakeRepository
	pengadaanRepo *repository.PengadaanRepository
	pub           EventPublisher
}

// NewInventoriService membuat service baru.
func NewInventoriService(
	stokRepo *repository.StokRepository,
	intakeRepo *repository.IntakeRepository,
	pengadaanRepo *repository.PengadaanRepository,
	pub EventPublisher,
) *InventoriService {
	return &InventoriService{
		stokRepo:      stokRepo,
		intakeRepo:    intakeRepo,
		pengadaanRepo: pengadaanRepo,
		pub:           pub,
	}
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

// ListStok mengembalikan seluruh stok koperasi aktif.
func (s *InventoriService) ListStok(ctx context.Context) ([]*domain.StokItem, error) {
	return s.stokRepo.FindAll(ctx)
}

// CreateIntake mencatat intake batch (status pending) lalu publish intake.recorded.
// Pada gelombang ini belum ada pass-svc, jadi receipt_hash dibiarkan kosong;
// pass-svc nanti akan mengisinya dan menerbitkan event resmi.
func (s *InventoriService) CreateIntake(ctx context.Context, in IntakeInput) (*domain.IntakeBatch, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	if in.AnggotaID == uuid.Nil {
		return nil, apperr.Validation("anggota_id wajib diisi")
	}
	komoditas := strings.ToLower(strings.TrimSpace(in.Komoditas))
	if komoditas == "" {
		return nil, apperr.Validation("komoditas wajib diisi")
	}
	if in.Jumlah <= 0 {
		return nil, apperr.Validation("jumlah intake harus lebih dari 0")
	}
	aiMode := strings.TrimSpace(in.AiMode)
	if aiMode == "" {
		aiMode = domain.AiModeServer
	}

	batch := &domain.IntakeBatch{
		KoperasiID: kid,
		AnggotaID:  in.AnggotaID,
		Komoditas:  komoditas,
		Jumlah:     in.Jumlah,
		Mutu:       in.Mutu,
		Skor:       in.Skor,
		FotoURL:    in.FotoURL,
		AiMode:     aiMode,
		Status:     domain.IntakePending,
	}
	if err := s.intakeRepo.Create(ctx, batch); err != nil {
		return nil, err
	}

	// Publish intake.recorded; consumer (service ini sendiri) akan menambah stok
	// secara idempoten dan menandai batch confirmed.
	s.publish(ctx, kid.String(), "intake.recorded", map[string]any{
		"batch_id":    batch.ID.String(),
		"koperasi_id": batch.KoperasiID.String(),
		"komoditas":   batch.Komoditas,
		"jumlah":      batch.Jumlah,
		"mutu":        batch.Mutu,
		"skor":        batch.Skor,
	})
	return batch, nil
}

// ListIntake mengembalikan seluruh intake batch koperasi aktif.
func (s *InventoriService) ListIntake(ctx context.Context) ([]*domain.IntakeBatch, error) {
	return s.intakeRepo.FindAll(ctx)
}

// CreatePengadaan mencatat pengadaan baru (status pending).
func (s *InventoriService) CreatePengadaan(ctx context.Context, in PengadaanInput) (*domain.Pengadaan, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	komoditas := strings.ToLower(strings.TrimSpace(in.Komoditas))
	if komoditas == "" {
		return nil, apperr.Validation("komoditas wajib diisi")
	}
	if in.Jumlah <= 0 {
		return nil, apperr.Validation("jumlah pengadaan harus lebih dari 0")
	}
	satuan := strings.TrimSpace(in.Satuan)
	if satuan == "" {
		return nil, apperr.Validation("satuan wajib diisi")
	}
	if in.Harga < 0 {
		return nil, apperr.Validation("harga tidak boleh negatif")
	}

	p := &domain.Pengadaan{
		KoperasiID: kid,
		Komoditas:  komoditas,
		Jumlah:     in.Jumlah,
		Satuan:     satuan,
		Harga:      in.Harga,
		Supplier:   strings.TrimSpace(in.Supplier),
		Status:     domain.PengadaanPending,
	}
	if err := s.pengadaanRepo.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// ListPengadaan mengembalikan seluruh pengadaan koperasi aktif.
func (s *InventoriService) ListPengadaan(ctx context.Context) ([]*domain.Pengadaan, error) {
	return s.pengadaanRepo.FindAll(ctx)
}

// FinalisasiPengadaan menandai pengadaan selesai & menambah stok otomatis,
// lalu publish stok.changed.
func (s *InventoriService) FinalisasiPengadaan(ctx context.Context, id uuid.UUID) error {
	kid, err := tenantID(ctx)
	if err != nil {
		return err
	}
	if err := s.pengadaanRepo.Finalisasi(ctx, id); err != nil {
		return err
	}
	s.publish(ctx, kid.String(), "stok.changed", map[string]any{
		"koperasi_id": kid.String(),
		"sumber":      "pengadaan",
		"pengadaan_id": id.String(),
	})
	return nil
}

// publish menerbitkan event non-blocking; kegagalan hanya di-log.
func (s *InventoriService) publish(ctx context.Context, tenantID, eventType string, payload any) {
	if s.pub == nil {
		return
	}
	if err := s.pub.Publish(ctx, tenantID, eventType, payload); err != nil {
		slog.Warn("gagal publish event", "type", eventType, "err", err)
	}
}
