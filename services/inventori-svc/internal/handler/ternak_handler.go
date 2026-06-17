package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/lumbung/inventori-svc/internal/domain"
	"github.com/lumbung/inventori-svc/internal/repository"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
)

type TernakHandler struct {
	repo *repository.TernakRepository
}

func NewTernakHandler(repo *repository.TernakRepository) *TernakHandler {
	return &TernakHandler{repo: repo}
}

type ternakResponse struct {
	ID                  string  `json:"id"`
	KoperasiID          string  `json:"koperasi_id"`
	Kode                string  `json:"kode"`
	Jenis               string  `json:"jenis"`
	UmurBulan           *int    `json:"umur_bulan"`
	Status              string  `json:"status"`
	VaksinTerakhir      *string `json:"vaksin_terakhir"`
	NilaiEstimasi       int64   `json:"nilai_estimasi"`
	FotoURL             *string `json:"foto_url"`
	JumlahKlaim         int     `json:"jumlah_klaim"`
	JumlahTerverifikasi int     `json:"jumlah_terverifikasi"`
	Terverifikasi       bool    `json:"terverifikasi"`
	TanggalMati         *string `json:"tanggal_mati"`
	DicatatMatiOleh     *string `json:"dicatat_mati_oleh"`
	CreatedAt           string  `json:"created_at"`
}

type createTernakRequest struct {
	Kode            string  `json:"kode"`
	Jenis           string  `json:"jenis"`
	UmurBulan       *int    `json:"umur_bulan"`
	Status          string  `json:"status"`
	VaksinTerakhir  *string `json:"vaksin_terakhir"`
	NilaiEstimasi   int64   `json:"nilai_estimasi"`
	FotoURL         *string `json:"foto_url"`
}

func (h *TernakHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.FindAll(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]ternakResponse, len(items))
	for i, t := range items {
		out[i] = toTernakResponse(t)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *TernakHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id bukan UUID valid"))
		return
	}
	t, err := h.repo.FindByID(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toTernakResponse(t))
}

func (h *TernakHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createTernakRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if req.Kode == "" || req.Jenis == "" {
		httpx.WriteError(w, apperr.Validation("kode dan jenis wajib diisi"))
		return
	}
	status := req.Status
	if status == "" {
		status = "sehat"
	}
	t := &domain.Ternak{
		Kode: req.Kode, Jenis: req.Jenis, UmurBulan: req.UmurBulan,
		Status: status, NilaiEstimasi: req.NilaiEstimasi,
		FotoURL: req.FotoURL, JumlahKlaim: 1,
	}
	if req.VaksinTerakhir != nil && *req.VaksinTerakhir != "" {
		parsed, err := time.Parse("2006-01-02", *req.VaksinTerakhir)
		if err == nil {
			t.VaksinTerakhir = &parsed
		}
	}
	if err := h.repo.Create(r.Context(), t); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toTernakResponse(t))
}

func (h *TernakHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id bukan UUID valid"))
		return
	}
	existing, err := h.repo.FindByID(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	var req createTernakRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if req.Kode != "" {
		existing.Kode = req.Kode
	}
	if req.Jenis != "" {
		existing.Jenis = req.Jenis
	}
	if req.Status != "" {
		existing.Status = req.Status
	}
	if req.UmurBulan != nil {
		existing.UmurBulan = req.UmurBulan
	}
	existing.NilaiEstimasi = req.NilaiEstimasi
	existing.FotoURL = req.FotoURL
	if req.VaksinTerakhir != nil && *req.VaksinTerakhir != "" {
		parsed, err := time.Parse("2006-01-02", *req.VaksinTerakhir)
		if err == nil {
			existing.VaksinTerakhir = &parsed
		}
	}
	if err := h.repo.Update(r.Context(), existing); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toTernakResponse(existing))
}

func (h *TernakHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id bukan UUID valid"))
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func toTernakResponse(t *domain.Ternak) ternakResponse {
	resp := ternakResponse{
		ID: t.ID.String(), KoperasiID: t.KoperasiID.String(),
		Kode: t.Kode, Jenis: t.Jenis, UmurBulan: t.UmurBulan, Status: t.Status,
		NilaiEstimasi: t.NilaiEstimasi, FotoURL: t.FotoURL,
		JumlahKlaim: t.JumlahKlaim, JumlahTerverifikasi: t.JumlahTerverifikasi,
		Terverifikasi: t.Terverifikasi, CreatedAt: t.CreatedAt.Format(time.RFC3339),
	}
	if t.VaksinTerakhir != nil {
		s := t.VaksinTerakhir.Format("2006-01-02")
		resp.VaksinTerakhir = &s
	}
	if t.TanggalMati != nil {
		s := t.TanggalMati.Format("2006-01-02")
		resp.TanggalMati = &s
	}
	if t.DicatatMatiOleh != nil {
		s := t.DicatatMatiOleh.String()
		resp.DicatatMatiOleh = &s
	}
	return resp
}
