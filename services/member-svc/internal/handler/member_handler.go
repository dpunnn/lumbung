// Package handler berisi HTTP handler member-svc (chi).
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/member-svc/internal/domain"
	"github.com/lumbung/member-svc/internal/service"
)

// MemberHandler menangani endpoint /api/anggota/*.
type MemberHandler struct {
	svc *service.MemberService
}

// NewMemberHandler membuat handler baru.
func NewMemberHandler(svc *service.MemberService) *MemberHandler {
	return &MemberHandler{svc: svc}
}

type anggotaResponse struct {
	ID         string `json:"id"`
	KoperasiID string `json:"koperasi_id"`
	Nama       string `json:"nama"`
	NikHash    string `json:"nik_hash,omitempty"`
	Alamat     string `json:"alamat,omitempty"`
	Telepon    string `json:"telepon,omitempty"`
	Status     string `json:"status"`
}

type createRequest struct {
	Nama    string `json:"nama"`
	NIK     string `json:"nik"`
	Alamat  string `json:"alamat"`
	Telepon string `json:"telepon"`
	Status  string `json:"status"`
}

type updateRequest struct {
	Nama    string `json:"nama"`
	Alamat  string `json:"alamat"`
	Telepon string `json:"telepon"`
	Status  string `json:"status"`
}

type validResponse struct {
	Valid bool `json:"valid"`
}

// ListAnggota menangani GET /api/anggota.
func (h *MemberHandler) ListAnggota(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListAnggota(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]anggotaResponse, 0, len(items))
	for _, a := range items {
		out = append(out, toResponse(a))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// CreateAnggota menangani POST /api/anggota.
func (h *MemberHandler) CreateAnggota(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	a, err := h.svc.CreateAnggota(r.Context(), service.CreateInput{
		Nama:    req.Nama,
		NIK:     req.NIK,
		Alamat:  req.Alamat,
		Telepon: req.Telepon,
		Status:  req.Status,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toResponse(a))
}

// GetAnggota menangani GET /api/anggota/{id}.
func (h *MemberHandler) GetAnggota(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	a, err := h.svc.GetAnggota(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toResponse(a))
}

// UpdateAnggota menangani PUT /api/anggota/{id}.
func (h *MemberHandler) UpdateAnggota(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	var req updateRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	a, err := h.svc.UpdateAnggota(r.Context(), id, service.UpdateInput{
		Nama:    req.Nama,
		Alamat:  req.Alamat,
		Telepon: req.Telepon,
		Status:  req.Status,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toResponse(a))
}

// ValidateExists menangani GET /api/anggota/{id}/valid.
// Dipanggil service lain via gateway untuk memverifikasi anggota ada di tenant.
func (h *MemberHandler) ValidateExists(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	if err := h.svc.ValidateExists(r.Context(), id); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, validResponse{Valid: true})
}

func parseID(r *http.Request) (uuid.UUID, error) {
	raw := chi.URLParam(r, "id")
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, apperr.BadRequest("id anggota bukan UUID valid")
	}
	return id, nil
}

func toResponse(a *domain.Anggota) anggotaResponse {
	return anggotaResponse{
		ID:         a.ID.String(),
		KoperasiID: a.KoperasiID.String(),
		Nama:       a.Nama,
		NikHash:    a.NikHash,
		Alamat:     a.Alamat,
		Telepon:    a.Telepon,
		Status:     a.Status,
	}
}
