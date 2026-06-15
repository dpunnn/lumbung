package service

import (
	"context"
	"strings"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/simpanpinjam-svc/internal/repository"
)

// KelayakanService menilai kelayakan kredit anggota lintas koperasi berdasarkan
// rata-rata skor pada riwayat_kredit (tabel lintas-tenant).
type KelayakanService struct {
	repo *repository.RiwayatKreditRepository
}

// NewKelayakanService membuat service baru.
func NewKelayakanService(repo *repository.RiwayatKreditRepository) *KelayakanService {
	return &KelayakanService{repo: repo}
}

// HasilKelayakan adalah hasil penilaian kelayakan kredit.
type HasilKelayakan struct {
	Skor       int
	Keterangan string
}

// CekKelayakan menghitung skor kelayakan dari rata-rata riwayat kredit nik_hash.
// Jika tidak ada riwayat, dianggap "baru" dengan skor netral 50.
func (s *KelayakanService) CekKelayakan(ctx context.Context, nikHash string) (*HasilKelayakan, error) {
	nikHash = strings.TrimSpace(nikHash)
	if nikHash == "" {
		return nil, apperr.Validation("nik_hash wajib diisi")
	}

	avg, count, err := s.repo.AvgSkor(ctx, nikHash)
	if err != nil {
		return nil, err
	}

	if count == 0 {
		// Tidak ada rekam jejak lintas koperasi.
		return &HasilKelayakan{Skor: 50, Keterangan: "tidak ada riwayat kredit (anggota baru)"}, nil
	}

	skor := int(avg + 0.5) // pembulatan
	return &HasilKelayakan{Skor: skor, Keterangan: keteranganSkor(skor)}, nil
}

// keteranganSkor memetakan skor numerik ke label kelayakan.
func keteranganSkor(skor int) string {
	switch {
	case skor >= 80:
		return "layak"
	case skor >= 60:
		return "dipertimbangkan"
	default:
		return "berisiko"
	}
}
