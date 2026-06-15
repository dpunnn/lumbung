// Package service berisi logika bisnis simpanpinjam-svc.
package service

import (
	"context"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/simpanpinjam-svc/internal/domain"
	"github.com/lumbung/simpanpinjam-svc/internal/repository"
)

// EventPublisher adalah abstraksi penerbit event (diimplementasi shared/events.Publisher).
type EventPublisher interface {
	Publish(ctx context.Context, tenantID, eventType string, payload any) error
}

// jenisSimpananValid himpunan jenis simpanan yang diizinkan.
var jenisSimpananValid = map[string]struct{}{
	domain.JenisPokok:    {},
	domain.JenisWajib:    {},
	domain.JenisSukarela: {},
}

// CreateSimpananInput masukan pencatatan simpanan.
type CreateSimpananInput struct {
	AnggotaID uuid.UUID
	Jenis     string
	Jumlah    float64
}

// SimpananService mengkoordinasi repository simpanan + penerbitan event.
type SimpananService struct {
	repo *repository.SimpananRepository
	pub  EventPublisher
}

// NewSimpananService membuat service baru.
func NewSimpananService(repo *repository.SimpananRepository, pub EventPublisher) *SimpananService {
	return &SimpananService{repo: repo, pub: pub}
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

// userID mengambil user (approver) dari identity di context, jika ada.
func userID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.UserID == "" {
		return uuid.Nil, false
	}
	uid, err := uuid.Parse(id.UserID)
	if err != nil {
		return uuid.Nil, false
	}
	return uid, true
}

// CreateSimpanan mencatat simpanan baru (status pending) lalu publish event.
func (s *SimpananService) CreateSimpanan(ctx context.Context, in CreateSimpananInput) (*domain.Simpanan, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	if in.AnggotaID == uuid.Nil {
		return nil, apperr.Validation("anggota_id wajib diisi")
	}
	if in.Jumlah <= 0 {
		return nil, apperr.Validation("jumlah simpanan harus lebih dari 0")
	}
	jenis := strings.ToLower(strings.TrimSpace(in.Jenis))
	if jenis == "" {
		jenis = domain.JenisPokok
	}
	if _, ok := jenisSimpananValid[jenis]; !ok {
		return nil, apperr.Validation("jenis simpanan tidak valid (pokok|wajib|sukarela)")
	}

	sp := &domain.Simpanan{
		KoperasiID: kid,
		AnggotaID:  in.AnggotaID,
		Jenis:      jenis,
		Jumlah:     in.Jumlah,
		Status:     domain.SimpananPending,
	}
	if err := s.repo.Create(ctx, sp); err != nil {
		return nil, err
	}

	s.publish(ctx, kid.String(), "simpanan.created", map[string]any{
		"simpanan_id": sp.ID.String(),
		"anggota_id":  sp.AnggotaID.String(),
		"koperasi_id": sp.KoperasiID.String(),
		"jenis":       sp.Jenis,
		"jumlah":      sp.Jumlah,
	})
	return sp, nil
}

// ListSimpanan mengembalikan simpanan, opsional difilter anggota.
func (s *SimpananService) ListSimpanan(ctx context.Context, anggotaID *uuid.UUID) ([]*domain.Simpanan, error) {
	return s.repo.FindByAnggota(ctx, anggotaID)
}

// ApproveSimpanan menyetujui (confirm) simpanan oleh kasir/pengurus.
func (s *SimpananService) ApproveSimpanan(ctx context.Context, id uuid.UUID) (*domain.Simpanan, error) {
	approver, ok := userID(ctx)
	if !ok {
		return nil, apperr.Unauthorized("identitas approver tidak ditemukan")
	}
	if err := s.repo.Approve(ctx, id, approver); err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, id)
}

// TotalSimpanan mengembalikan total nominal simpanan confirmed di tenant aktif.
func (s *SimpananService) TotalSimpanan(ctx context.Context) (float64, error) {
	return s.repo.TotalConfirmed(ctx)
}

// publish menerbitkan event non-blocking; kegagalan hanya di-log.
func (s *SimpananService) publish(ctx context.Context, tenantID, eventType string, payload any) {
	if s.pub == nil {
		return
	}
	if err := s.pub.Publish(ctx, tenantID, eventType, payload); err != nil {
		slog.Warn("gagal publish event", "type", eventType, "err", err)
	}
}
