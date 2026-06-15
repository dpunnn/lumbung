package service

import (
	"context"
	"log/slog"
	"math"

	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/simpanpinjam-svc/internal/domain"
	"github.com/lumbung/simpanpinjam-svc/internal/repository"
)

// CreatePinjamanInput masukan pengajuan pinjaman.
type CreatePinjamanInput struct {
	AnggotaID   uuid.UUID
	Pokok       float64
	Tenor       int
	BungaPersen float64
}

// PinjamanService mengkoordinasi pinjaman + angsuran + penerbitan event.
type PinjamanService struct {
	pinjamanRepo *repository.PinjamanRepository
	angsuranRepo *repository.AngsuranRepository
	pub          EventPublisher
}

// NewPinjamanService membuat service baru.
func NewPinjamanService(
	pinjamanRepo *repository.PinjamanRepository,
	angsuranRepo *repository.AngsuranRepository,
	pub EventPublisher,
) *PinjamanService {
	return &PinjamanService{pinjamanRepo: pinjamanRepo, angsuranRepo: angsuranRepo, pub: pub}
}

// hitungAngsuran menghitung angsuran per bulan: (pokok + bunga total) / tenor.
// Bunga flat: pokok * (bungaPersen/100) dibayar merata selama tenor.
func hitungAngsuran(pokok float64, tenor int, bungaPersen float64) float64 {
	if tenor <= 0 {
		return 0
	}
	bungaTotal := pokok * (bungaPersen / 100.0)
	total := pokok + bungaTotal
	angsuran := total / float64(tenor)
	// Pembulatan ke 2 desimal (rupiah).
	return math.Round(angsuran*100) / 100
}

// CreatePinjaman membuat pinjaman + jadwal angsuran, lalu publish event.
func (s *PinjamanService) CreatePinjaman(ctx context.Context, in CreatePinjamanInput) (*domain.Pinjaman, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	if in.AnggotaID == uuid.Nil {
		return nil, apperr.Validation("anggota_id wajib diisi")
	}
	if in.Pokok <= 0 {
		return nil, apperr.Validation("pokok pinjaman harus lebih dari 0")
	}
	if in.Tenor <= 0 {
		return nil, apperr.Validation("tenor harus lebih dari 0 bulan")
	}
	if in.BungaPersen < 0 {
		return nil, apperr.Validation("bunga tidak boleh negatif")
	}

	angsuranPerBulan := hitungAngsuran(in.Pokok, in.Tenor, in.BungaPersen)

	p := &domain.Pinjaman{
		KoperasiID:       kid,
		AnggotaID:        in.AnggotaID,
		Pokok:            in.Pokok,
		Tenor:            in.Tenor,
		AngsuranPerBulan: angsuranPerBulan,
		BungaPersen:      in.BungaPersen,
		Status:           domain.PinjamanAktif,
	}

	// Bangun jadwal angsuran (status pending per bulan).
	jadwal := make([]*domain.Angsuran, 0, in.Tenor)
	for bulan := 1; bulan <= in.Tenor; bulan++ {
		jadwal = append(jadwal, &domain.Angsuran{
			KoperasiID:  kid,
			BulanKe:     bulan,
			JumlahBayar: angsuranPerBulan,
			Status:      domain.AngsuranPending,
		})
	}

	if err := s.pinjamanRepo.CreateWithAngsuran(ctx, p, jadwal); err != nil {
		return nil, err
	}

	s.publish(ctx, kid.String(), "pinjaman.created", map[string]any{
		"pinjaman_id": p.ID.String(),
		"anggota_id":  p.AnggotaID.String(),
		"koperasi_id": p.KoperasiID.String(),
		"pokok":       p.Pokok,
		"tenor":       p.Tenor,
	})
	return p, nil
}

// ListPinjaman mengembalikan semua pinjaman koperasi.
func (s *PinjamanService) ListPinjaman(ctx context.Context) ([]*domain.Pinjaman, error) {
	return s.pinjamanRepo.FindAll(ctx)
}

// ListAngsuran mengembalikan jadwal angsuran sebuah pinjaman.
func (s *PinjamanService) ListAngsuran(ctx context.Context, pinjamanID uuid.UUID) ([]*domain.Angsuran, error) {
	// Pastikan pinjaman ada di tenant (RLS).
	if _, err := s.pinjamanRepo.FindByID(ctx, pinjamanID); err != nil {
		return nil, err
	}
	return s.angsuranRepo.FindByPinjaman(ctx, pinjamanID)
}

// BayarAngsuran membayar angsuran bulan tertentu. Jika seluruh angsuran lunas,
// status pinjaman diubah menjadi lunas. Publish event angsuran.paid.
func (s *PinjamanService) BayarAngsuran(ctx context.Context, pinjamanID uuid.UUID, bulanKe int) (*domain.Angsuran, error) {
	kid, err := tenantID(ctx)
	if err != nil {
		return nil, err
	}
	if bulanKe <= 0 {
		return nil, apperr.Validation("bulan_ke harus lebih dari 0")
	}
	// Pastikan pinjaman ada di tenant.
	if _, err := s.pinjamanRepo.FindByID(ctx, pinjamanID); err != nil {
		return nil, err
	}

	angsuran, sisa, err := s.angsuranRepo.BayarBulan(ctx, pinjamanID, bulanKe)
	if err != nil {
		return nil, err
	}

	// Jika tidak ada angsuran tersisa, tandai pinjaman lunas.
	if sisa == 0 {
		if err := s.pinjamanRepo.SetStatus(ctx, pinjamanID, domain.PinjamanLunas); err != nil {
			slog.Warn("gagal menandai pinjaman lunas", "pinjaman_id", pinjamanID, "err", err)
		}
	}

	s.publish(ctx, kid.String(), "angsuran.paid", map[string]any{
		"angsuran_id":  angsuran.ID.String(),
		"pinjaman_id":  angsuran.PinjamanID.String(),
		"koperasi_id":  kid.String(),
		"bulan_ke":     angsuran.BulanKe,
		"jumlah_bayar": angsuran.JumlahBayar,
	})
	return angsuran, nil
}

// Ringkasan mengembalikan agregat simpan-pinjam untuk Lens dashboard.
type Ringkasan struct {
	TotalSimpanan          float64
	TotalPinjamanAktif     int64
	AnggotaDenganTunggakan int64
}

// RingkasanPinjaman mengembalikan jumlah pinjaman aktif & anggota dengan tunggakan.
func (s *PinjamanService) RingkasanPinjaman(ctx context.Context) (aktif, tunggakan int64, err error) {
	aktif, err = s.pinjamanRepo.CountAktif(ctx)
	if err != nil {
		return 0, 0, err
	}
	tunggakan, err = s.angsuranRepo.CountAnggotaTunggakan(ctx)
	if err != nil {
		return 0, 0, err
	}
	return aktif, tunggakan, nil
}

// publish menerbitkan event non-blocking; kegagalan hanya di-log.
func (s *PinjamanService) publish(ctx context.Context, tenantID, eventType string, payload any) {
	if s.pub == nil {
		return
	}
	if err := s.pub.Publish(ctx, tenantID, eventType, payload); err != nil {
		slog.Warn("gagal publish event", "type", eventType, "err", err)
	}
}
