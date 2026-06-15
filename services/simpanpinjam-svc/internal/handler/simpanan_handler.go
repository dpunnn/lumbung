// Package handler berisi HTTP handler simpanpinjam-svc (chi).
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/simpanpinjam-svc/internal/domain"
	"github.com/lumbung/simpanpinjam-svc/internal/service"
)

// SimpananHandler menangani endpoint /api/simpanan/*.
type SimpananHandler struct {
	svc *service.SimpananService
}

// NewSimpananHandler membuat handler baru.
func NewSimpananHandler(svc *service.SimpananService) *SimpananHandler {
	return &SimpananHandler{svc: svc}
}

type simpananResponse struct {
	ID         string  `json:"id"`
	KoperasiID string  `json:"koperasi_id"`
	AnggotaID  string  `json:"anggota_id"`
	Jenis      string  `json:"jenis"`
	Jumlah     float64 `json:"jumlah"`
	Status     string  `json:"status"`
	ApproverID string  `json:"approver_id,omitempty"`
	WitnessID  string  `json:"witness_id,omitempty"`
}

type createSimpananRequest struct {
	AnggotaID string  `json:"anggota_id"`
	Jenis     string  `json:"jenis"`
	Jumlah    float64 `json:"jumlah"`
}

// CreateSimpanan menangani POST /api/simpanan.
func (h *SimpananHandler) CreateSimpanan(w http.ResponseWriter, r *http.Request) {
	var req createSimpananRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	anggotaID, err := uuid.Parse(req.AnggotaID)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("anggota_id bukan UUID valid"))
		return
	}
	sp, err := h.svc.CreateSimpanan(r.Context(), service.CreateSimpananInput{
		AnggotaID: anggotaID,
		Jenis:     req.Jenis,
		Jumlah:    req.Jumlah,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toSimpananResponse(sp))
}

// ListSimpanan menangani GET /api/simpanan?anggota_id=.
func (h *SimpananHandler) ListSimpanan(w http.ResponseWriter, r *http.Request) {
	var anggotaID *uuid.UUID
	if raw := r.URL.Query().Get("anggota_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.WriteError(w, apperr.BadRequest("anggota_id bukan UUID valid"))
			return
		}
		anggotaID = &id
	}
	items, err := h.svc.ListSimpanan(r.Context(), anggotaID)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]simpananResponse, 0, len(items))
	for _, sp := range items {
		out = append(out, toSimpananResponse(sp))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// ApproveSimpanan menangani POST /api/simpanan/{id}/approve.
func (h *SimpananHandler) ApproveSimpanan(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id", "simpanan")
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	sp, err := h.svc.ApproveSimpanan(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toSimpananResponse(sp))
}

func toSimpananResponse(sp *domain.Simpanan) simpananResponse {
	resp := simpananResponse{
		ID:         sp.ID.String(),
		KoperasiID: sp.KoperasiID.String(),
		AnggotaID:  sp.AnggotaID.String(),
		Jenis:      sp.Jenis,
		Jumlah:     sp.Jumlah,
		Status:     sp.Status,
	}
	if sp.ApproverID != nil {
		resp.ApproverID = sp.ApproverID.String()
	}
	if sp.WitnessID != nil {
		resp.WitnessID = sp.WitnessID.String()
	}
	return resp
}

// parseID adalah helper bersama: parse URL param UUID dengan label entitas.
func parseID(r *http.Request, param, entitas string) (uuid.UUID, error) {
	raw := chi.URLParam(r, param)
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, apperr.BadRequest("id " + entitas + " bukan UUID valid")
	}
	return id, nil
}
