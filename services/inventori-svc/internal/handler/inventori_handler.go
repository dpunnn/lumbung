// Package handler berisi HTTP handler inventori-svc (chi).
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/inventori-svc/internal/domain"
	"github.com/lumbung/inventori-svc/internal/service"
)

// InventoriHandler menangani endpoint /api/stok, /api/intake, /api/pengadaan.
type InventoriHandler struct {
	svc *service.InventoriService
}

// NewInventoriHandler membuat handler baru.
func NewInventoriHandler(svc *service.InventoriService) *InventoriHandler {
	return &InventoriHandler{svc: svc}
}

type stokResponse struct {
	ID         string  `json:"id"`
	KoperasiID string  `json:"koperasi_id"`
	Komoditas  string  `json:"komoditas"`
	Nama       string  `json:"nama"`
	Satuan     string  `json:"satuan"`
	Jumlah     float64 `json:"jumlah"`
	Mutu       string  `json:"mutu,omitempty"`
}

type intakeResponse struct {
	ID          string  `json:"id"`
	KoperasiID  string  `json:"koperasi_id"`
	AnggotaID   string  `json:"anggota_id"`
	Komoditas   string  `json:"komoditas"`
	Jumlah      float64 `json:"jumlah"`
	Mutu        string  `json:"mutu,omitempty"`
	Skor        float64 `json:"skor"`
	FotoURL     string  `json:"foto_url,omitempty"`
	ReceiptHash string  `json:"receipt_hash,omitempty"`
	AiMode      string  `json:"ai_mode"`
	Status      string  `json:"status"`
}

type pengadaanResponse struct {
	ID         string  `json:"id"`
	KoperasiID string  `json:"koperasi_id"`
	Komoditas  string  `json:"komoditas"`
	Jumlah     float64 `json:"jumlah"`
	Satuan     string  `json:"satuan"`
	Harga      float64 `json:"harga"`
	Supplier   string  `json:"supplier,omitempty"`
	Status     string  `json:"status"`
}

type createIntakeRequest struct {
	AnggotaID string  `json:"anggota_id"`
	Komoditas string  `json:"komoditas"`
	Jumlah    float64 `json:"jumlah"`
	Mutu      string  `json:"mutu"`
	Skor      float64 `json:"skor"`
	FotoURL   string  `json:"foto_url"`
	AiMode    string  `json:"ai_mode"`
}

type createPengadaanRequest struct {
	Komoditas string  `json:"komoditas"`
	Jumlah    float64 `json:"jumlah"`
	Satuan    string  `json:"satuan"`
	Harga     float64 `json:"harga"`
	Supplier  string  `json:"supplier"`
}

// ListStok menangani GET /api/stok.
func (h *InventoriHandler) ListStok(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListStok(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]stokResponse, 0, len(items))
	for _, it := range items {
		out = append(out, toStokResponse(it))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// CreateIntake menangani POST /api/intake.
func (h *InventoriHandler) CreateIntake(w http.ResponseWriter, r *http.Request) {
	var req createIntakeRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	anggotaID, err := uuid.Parse(req.AnggotaID)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("anggota_id bukan UUID valid"))
		return
	}
	batch, err := h.svc.CreateIntake(r.Context(), service.IntakeInput{
		AnggotaID: anggotaID,
		Komoditas: req.Komoditas,
		Jumlah:    req.Jumlah,
		Mutu:      req.Mutu,
		Skor:      req.Skor,
		FotoURL:   req.FotoURL,
		AiMode:    req.AiMode,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toIntakeResponse(batch))
}

// ListIntake menangani GET /api/intake.
func (h *InventoriHandler) ListIntake(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListIntake(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]intakeResponse, 0, len(items))
	for _, it := range items {
		out = append(out, toIntakeResponse(it))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// ListPengadaan menangani GET /api/pengadaan.
func (h *InventoriHandler) ListPengadaan(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPengadaan(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]pengadaanResponse, 0, len(items))
	for _, it := range items {
		out = append(out, toPengadaanResponse(it))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// CreatePengadaan menangani POST /api/pengadaan.
func (h *InventoriHandler) CreatePengadaan(w http.ResponseWriter, r *http.Request) {
	var req createPengadaanRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	p, err := h.svc.CreatePengadaan(r.Context(), service.PengadaanInput{
		Komoditas: req.Komoditas,
		Jumlah:    req.Jumlah,
		Satuan:    req.Satuan,
		Harga:     req.Harga,
		Supplier:  req.Supplier,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toPengadaanResponse(p))
}

// FinalisasiPengadaan menangani POST /api/pengadaan/{id}/finalisasi.
func (h *InventoriHandler) FinalisasiPengadaan(w http.ResponseWriter, r *http.Request) {
	raw := chi.URLParam(r, "id")
	id, err := uuid.Parse(raw)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id pengadaan bukan UUID valid"))
		return
	}
	if err := h.svc.FinalisasiPengadaan(r.Context(), id); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id.String(), "status": domain.PengadaanFinalisasi})
}

func toStokResponse(it *domain.StokItem) stokResponse {
	return stokResponse{
		ID:         it.ID.String(),
		KoperasiID: it.KoperasiID.String(),
		Komoditas:  it.Komoditas,
		Nama:       it.Nama,
		Satuan:     it.Satuan,
		Jumlah:     it.Jumlah,
		Mutu:       it.Mutu,
	}
}

func toIntakeResponse(it *domain.IntakeBatch) intakeResponse {
	return intakeResponse{
		ID:          it.ID.String(),
		KoperasiID:  it.KoperasiID.String(),
		AnggotaID:   it.AnggotaID.String(),
		Komoditas:   it.Komoditas,
		Jumlah:      it.Jumlah,
		Mutu:        it.Mutu,
		Skor:        it.Skor,
		FotoURL:     it.FotoURL,
		ReceiptHash: it.ReceiptHash,
		AiMode:      it.AiMode,
		Status:      it.Status,
	}
}

func toPengadaanResponse(it *domain.Pengadaan) pengadaanResponse {
	return pengadaanResponse{
		ID:         it.ID.String(),
		KoperasiID: it.KoperasiID.String(),
		Komoditas:  it.Komoditas,
		Jumlah:     it.Jumlah,
		Satuan:     it.Satuan,
		Harga:      it.Harga,
		Supplier:   it.Supplier,
		Status:     it.Status,
	}
}
