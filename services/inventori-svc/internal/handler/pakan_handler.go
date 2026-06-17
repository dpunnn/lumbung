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

type PakanHandler struct {
	repo *repository.PakanRepository
}

func NewPakanHandler(repo *repository.PakanRepository) *PakanHandler {
	return &PakanHandler{repo: repo}
}

type pakanResponse struct {
	ID           string  `json:"id"`
	KoperasiID   string  `json:"koperasi_id"`
	Nama         string  `json:"nama"`
	Stok         float64 `json:"stok"`
	Satuan       string  `json:"satuan"`
	BatasMinimum float64 `json:"batas_minimum"`
	UpdatedAt    string  `json:"updated_at"`
}

type createPakanRequest struct {
	Nama         string  `json:"nama"`
	Stok         float64 `json:"stok"`
	Satuan       string  `json:"satuan"`
	BatasMinimum float64 `json:"batas_minimum"`
}

func (h *PakanHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.FindAll(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]pakanResponse, len(items))
	for i, p := range items {
		out[i] = toPakanResponse(p)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *PakanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createPakanRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if req.Nama == "" {
		httpx.WriteError(w, apperr.Validation("nama pakan wajib diisi"))
		return
	}
	satuan := req.Satuan
	if satuan == "" {
		satuan = "kg"
	}
	p := &domain.Pakan{Nama: req.Nama, Stok: req.Stok, Satuan: satuan, BatasMinimum: req.BatasMinimum}
	if err := h.repo.Create(r.Context(), p); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toPakanResponse(p))
}

func (h *PakanHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	var req createPakanRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if req.Nama != "" {
		existing.Nama = req.Nama
	}
	existing.Stok = req.Stok
	existing.BatasMinimum = req.BatasMinimum
	if req.Satuan != "" {
		existing.Satuan = req.Satuan
	}
	if err := h.repo.Update(r.Context(), existing); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toPakanResponse(existing))
}

func (h *PakanHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

func toPakanResponse(p *domain.Pakan) pakanResponse {
	return pakanResponse{
		ID: p.ID.String(), KoperasiID: p.KoperasiID.String(),
		Nama: p.Nama, Stok: p.Stok, Satuan: p.Satuan,
		BatasMinimum: p.BatasMinimum, UpdatedAt: p.UpdatedAt.Format(time.RFC3339),
	}
}
