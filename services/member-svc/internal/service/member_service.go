// Package service berisi logika bisnis member-svc (CRUD anggota + hashing NIK).
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/google/uuid"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/member-svc/internal/domain"
	"github.com/lumbung/member-svc/internal/repository"
)

// statusValid adalah himpunan status anggota yang diizinkan.
var statusValid = map[string]struct{}{
	domain.StatusAktif:    {},
	domain.StatusNonaktif: {},
	domain.StatusPending:  {},
}

// CreateInput masukan pembuatan anggota. NIK mentah akan di-hash sebelum simpan.
type CreateInput struct {
	Nama    string
	NIK     string // NIK mentah (akan di-hash SHA-256)
	Alamat  string
	Telepon string
	Status  string
}

// UpdateInput masukan pembaruan anggota.
type UpdateInput struct {
	Nama    string
	Alamat  string
	Telepon string
	Status  string
}

// MemberService mengkoordinasi repository anggota.
type MemberService struct {
	repo *repository.AnggotaRepository
}

// NewMemberService membuat service baru.
func NewMemberService(repo *repository.AnggotaRepository) *MemberService {
	return &MemberService{repo: repo}
}

// hashNIK menghasilkan SHA-256 hex dari NIK (privacy-preserving). Kosong -> "".
func hashNIK(nik string) string {
	nik = strings.TrimSpace(nik)
	if nik == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(nik))
	return hex.EncodeToString(sum[:])
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

// CreateAnggota membuat anggota baru pada koperasi aktif.
func (s *MemberService) CreateAnggota(ctx context.Context, in CreateInput) (*domain.Anggota, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	in.Nama = strings.TrimSpace(in.Nama)
	if in.Nama == "" {
		return nil, apperr.Validation("nama anggota wajib diisi")
	}
	status := strings.ToLower(strings.TrimSpace(in.Status))
	if status == "" {
		status = domain.StatusAktif
	}
	if _, ok := statusValid[status]; !ok {
		return nil, apperr.Validation("status anggota tidak valid (aktif|nonaktif|pending)")
	}

	a := &domain.Anggota{
		KoperasiID: kid,
		Nama:       in.Nama,
		NikHash:    hashNIK(in.NIK),
		Alamat:     strings.TrimSpace(in.Alamat),
		Telepon:    strings.TrimSpace(in.Telepon),
		Status:     status,
	}
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

// ListAnggota mengembalikan semua anggota koperasi aktif.
func (s *MemberService) ListAnggota(ctx context.Context) ([]*domain.Anggota, error) {
	return s.repo.FindAll(ctx)
}

// GetAnggota mengambil satu anggota.
func (s *MemberService) GetAnggota(ctx context.Context, id uuid.UUID) (*domain.Anggota, error) {
	return s.repo.FindByID(ctx, id)
}

// UpdateAnggota memperbarui anggota yang ada.
func (s *MemberService) UpdateAnggota(ctx context.Context, id uuid.UUID, in UpdateInput) (*domain.Anggota, error) {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if v := strings.TrimSpace(in.Nama); v != "" {
		existing.Nama = v
	}
	existing.Alamat = strings.TrimSpace(in.Alamat)
	existing.Telepon = strings.TrimSpace(in.Telepon)
	if v := strings.ToLower(strings.TrimSpace(in.Status)); v != "" {
		if _, ok := statusValid[v]; !ok {
			return nil, apperr.Validation("status anggota tidak valid (aktif|nonaktif|pending)")
		}
		existing.Status = v
	}
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// ValidateExists memastikan anggota ada di tenant aktif (dipanggil service lain).
func (s *MemberService) ValidateExists(ctx context.Context, id uuid.UUID) error {
	return s.repo.ValidateExists(ctx, id)
}
