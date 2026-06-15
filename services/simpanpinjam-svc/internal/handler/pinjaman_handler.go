package handler

import (
	"net/http"

	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/simpanpinjam-svc/internal/domain"
	"github.com/lumbung/simpanpinjam-svc/internal/service"
)

// PinjamanHandler menangani endpoint /api/pinjaman/* dan /api/lens/ringkasan.
type PinjamanHandler struct {
	svc         *service.PinjamanService
	simpananSvc *service.SimpananService
}

// NewPinjamanHandler membuat handler baru. simpananSvc dipakai untuk ringkasan Lens.
func NewPinjamanHandler(svc *service.PinjamanService, simpananSvc *service.SimpananService) *PinjamanHandler {
	return &PinjamanHandler{svc: svc, simpananSvc: simpananSvc}
}

type pinjamanResponse struct {
	ID               string  `json:"id"`
	KoperasiID       string  `json:"koperasi_id"`
	AnggotaID        string  `json:"anggota_id"`
	Pokok            float64 `json:"pokok"`
	Tenor            int     `json:"tenor"`
	AngsuranPerBulan float64 `json:"angsuran_per_bulan"`
	BungaPersen      float64 `json:"bunga_persen"`
	Status           string  `json:"status"`
}

type angsuranResponse struct {
	ID           string  `json:"id"`
	PinjamanID   string  `json:"pinjaman_id"`
	KoperasiID   string  `json:"koperasi_id"`
	BulanKe      int     `json:"bulan_ke"`
	JumlahBayar  float64 `json:"jumlah_bayar"`
	Status       string  `json:"status"`
	TanggalBayar string  `json:"tanggal_bayar,omitempty"`
}

type createPinjamanRequest struct {
	AnggotaID   string  `json:"anggota_id"`
	Pokok       float64 `json:"pokok"`
	Tenor       int     `json:"tenor"`
	BungaPersen float64 `json:"bunga_persen"`
}

type bayarAngsuranRequest struct {
	BulanKe int `json:"bulan_ke"`
}

type ringkasanResponse struct {
	TotalSimpanan          float64 `json:"total_simpanan"`
	TotalPinjamanAktif     int64   `json:"total_pinjaman_aktif"`
	AnggotaDenganTunggakan int64   `json:"anggota_dengan_tunggakan"`
}

// CreatePinjaman menangani POST /api/pinjaman.
func (h *PinjamanHandler) CreatePinjaman(w http.ResponseWriter, r *http.Request) {
	var req createPinjamanRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	anggotaID, err := uuid.Parse(req.AnggotaID)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("anggota_id bukan UUID valid"))
		return
	}
	p, err := h.svc.CreatePinjaman(r.Context(), service.CreatePinjamanInput{
		AnggotaID:   anggotaID,
		Pokok:       req.Pokok,
		Tenor:       req.Tenor,
		BungaPersen: req.BungaPersen,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toPinjamanResponse(p))
}

// ListPinjaman menangani GET /api/pinjaman.
func (h *PinjamanHandler) ListPinjaman(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPinjaman(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]pinjamanResponse, 0, len(items))
	for _, p := range items {
		out = append(out, toPinjamanResponse(p))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// BayarAngsuran menangani POST /api/pinjaman/{id}/angsuran.
func (h *PinjamanHandler) BayarAngsuran(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id", "pinjaman")
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	var req bayarAngsuranRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	angsuran, err := h.svc.BayarAngsuran(r.Context(), id, req.BulanKe)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toAngsuranResponse(angsuran))
}

// ListAngsuran menangani GET /api/pinjaman/{id}/angsuran.
func (h *PinjamanHandler) ListAngsuran(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id", "pinjaman")
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	items, err := h.svc.ListAngsuran(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]angsuranResponse, 0, len(items))
	for _, a := range items {
		out = append(out, toAngsuranResponse(a))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Ringkasan menangani GET /api/lens/ringkasan untuk dashboard Lens.
func (h *PinjamanHandler) Ringkasan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	totalSimpanan, err := h.simpananSvc.TotalSimpanan(ctx)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	aktif, tunggakan, err := h.svc.RingkasanPinjaman(ctx)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ringkasanResponse{
		TotalSimpanan:          totalSimpanan,
		TotalPinjamanAktif:     aktif,
		AnggotaDenganTunggakan: tunggakan,
	})
}

func toPinjamanResponse(p *domain.Pinjaman) pinjamanResponse {
	return pinjamanResponse{
		ID:               p.ID.String(),
		KoperasiID:       p.KoperasiID.String(),
		AnggotaID:        p.AnggotaID.String(),
		Pokok:            p.Pokok,
		Tenor:            p.Tenor,
		AngsuranPerBulan: p.AngsuranPerBulan,
		BungaPersen:      p.BungaPersen,
		Status:           p.Status,
	}
}

func toAngsuranResponse(a *domain.Angsuran) angsuranResponse {
	resp := angsuranResponse{
		ID:          a.ID.String(),
		PinjamanID:  a.PinjamanID.String(),
		KoperasiID:  a.KoperasiID.String(),
		BulanKe:     a.BulanKe,
		JumlahBayar: a.JumlahBayar,
		Status:      a.Status,
	}
	if a.TanggalBayar != nil {
		resp.TanggalBayar = a.TanggalBayar.Format("2006-01-02T15:04:05Z07:00")
	}
	return resp
}
