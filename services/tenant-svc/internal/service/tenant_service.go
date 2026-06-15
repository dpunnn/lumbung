// Package service berisi logika bisnis tenant-svc (CRUD koperasi & modul).
package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/lumbung/tenant-svc/internal/domain"
	"github.com/lumbung/tenant-svc/internal/repository"
	apperr "github.com/lumbung/shared/errors"
)

// jenisValid adalah himpunan jenis koperasi yang diizinkan.
var jenisValid = map[string]struct{}{
	"ternak": {}, "sayur": {}, "beras": {}, "pupuk": {}, "air": {},
}

// CreateInput masukan pembuatan koperasi.
type CreateInput struct {
	Nama      string
	Jenis     string
	Komoditas string
	Modules   []string
	Wilayah   string
	Alamat    string
}

// UpdateInput masukan pembaruan koperasi.
type UpdateInput struct {
	Nama      string
	Jenis     string
	Komoditas string
	Wilayah   string
	Alamat    string
}

// TenantService mengkoordinasi repository koperasi.
type TenantService struct {
	repo *repository.KoperasiRepository
}

// NewTenantService membuat service baru.
func NewTenantService(repo *repository.KoperasiRepository) *TenantService {
	return &TenantService{repo: repo}
}

// CreateKoperasi membuat koperasi baru.
func (s *TenantService) CreateKoperasi(ctx context.Context, in CreateInput) (*domain.Koperasi, error) {
	in.Nama = strings.TrimSpace(in.Nama)
	if in.Nama == "" {
		return nil, apperr.Validation("nama koperasi wajib diisi")
	}
	jenis := strings.ToLower(strings.TrimSpace(in.Jenis))
	if jenis == "" {
		jenis = "ternak"
	}
	if _, ok := jenisValid[jenis]; !ok {
		return nil, apperr.Validation("jenis koperasi tidak valid (ternak|sayur|beras|pupuk|air)")
	}
	k := &domain.Koperasi{
		Nama:      in.Nama,
		Jenis:     jenis,
		Komoditas: in.Komoditas,
		Modules:   in.Modules,
		Wilayah:   in.Wilayah,
		Alamat:    in.Alamat,
	}
	if err := s.repo.Create(ctx, k); err != nil {
		return nil, err
	}
	return k, nil
}

// ListKoperasi mengembalikan semua koperasi.
func (s *TenantService) ListKoperasi(ctx context.Context) ([]*domain.Koperasi, error) {
	return s.repo.FindAll(ctx)
}

// GetKoperasi mengambil satu koperasi.
func (s *TenantService) GetKoperasi(ctx context.Context, id uuid.UUID) (*domain.Koperasi, error) {
	return s.repo.FindByID(ctx, id)
}

// UpdateKoperasi memperbarui koperasi yang ada.
func (s *TenantService) UpdateKoperasi(ctx context.Context, id uuid.UUID, in UpdateInput) (*domain.Koperasi, error) {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if v := strings.TrimSpace(in.Nama); v != "" {
		existing.Nama = v
	}
	if v := strings.ToLower(strings.TrimSpace(in.Jenis)); v != "" {
		if _, ok := jenisValid[v]; !ok {
			return nil, apperr.Validation("jenis koperasi tidak valid (ternak|sayur|beras|pupuk|air)")
		}
		existing.Jenis = v
	}
	existing.Komoditas = in.Komoditas
	existing.Wilayah = in.Wilayah
	existing.Alamat = in.Alamat

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// PatchModules mengganti daftar modul aktif koperasi.
func (s *TenantService) PatchModules(ctx context.Context, id uuid.UUID, modules []string) error {
	if modules == nil {
		modules = []string{}
	}
	return s.repo.PatchModules(ctx, id, modules)
}
