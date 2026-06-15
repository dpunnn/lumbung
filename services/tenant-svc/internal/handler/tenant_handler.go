// Package handler berisi HTTP handler tenant-svc (chi).
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/lumbung/tenant-svc/internal/domain"
	"github.com/lumbung/tenant-svc/internal/service"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
)

// TenantHandler menangani endpoint /api/koperasi/*.
type TenantHandler struct {
	svc *service.TenantService
}

// NewTenantHandler membuat handler baru.
func NewTenantHandler(svc *service.TenantService) *TenantHandler {
	return &TenantHandler{svc: svc}
}

type koperasiResponse struct {
	ID        string   `json:"id"`
	Nama      string   `json:"nama"`
	Jenis     string   `json:"jenis"`
	Komoditas string   `json:"komoditas,omitempty"`
	Modules   []string `json:"modules"`
	Wilayah   string   `json:"wilayah,omitempty"`
	Alamat    string   `json:"alamat,omitempty"`
}

type createRequest struct {
	Nama      string   `json:"nama"`
	Jenis     string   `json:"jenis"`
	Komoditas string   `json:"komoditas"`
	Modules   []string `json:"modules"`
	Wilayah   string   `json:"wilayah"`
	Alamat    string   `json:"alamat"`
}

type updateRequest struct {
	Nama      string `json:"nama"`
	Jenis     string `json:"jenis"`
	Komoditas string `json:"komoditas"`
	Wilayah   string `json:"wilayah"`
	Alamat    string `json:"alamat"`
}

type modulesRequest struct {
	Modules []string `json:"modules"`
}

type modulesResponse struct {
	Modules []string `json:"modules"`
}

// List menangani GET /api/koperasi.
func (h *TenantHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListKoperasi(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]koperasiResponse, 0, len(items))
	for _, k := range items {
		out = append(out, toResponse(k))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Create menangani POST /api/koperasi.
func (h *TenantHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	k, err := h.svc.CreateKoperasi(r.Context(), service.CreateInput{
		Nama:      req.Nama,
		Jenis:     req.Jenis,
		Komoditas: req.Komoditas,
		Modules:   req.Modules,
		Wilayah:   req.Wilayah,
		Alamat:    req.Alamat,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toResponse(k))
}

// Get menangani GET /api/koperasi/{id}.
func (h *TenantHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	k, err := h.svc.GetKoperasi(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toResponse(k))
}

// Update menangani PUT /api/koperasi/{id}.
func (h *TenantHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	k, err := h.svc.UpdateKoperasi(r.Context(), id, service.UpdateInput{
		Nama:      req.Nama,
		Jenis:     req.Jenis,
		Komoditas: req.Komoditas,
		Wilayah:   req.Wilayah,
		Alamat:    req.Alamat,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toResponse(k))
}

// PatchModules menangani PATCH /api/koperasi/{id}/modules.
func (h *TenantHandler) PatchModules(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	var req modulesRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if err := h.svc.PatchModules(r.Context(), id, req.Modules); err != nil {
		httpx.WriteError(w, err)
		return
	}
	mods := req.Modules
	if mods == nil {
		mods = []string{}
	}
	httpx.WriteJSON(w, http.StatusOK, modulesResponse{Modules: mods})
}

func parseID(r *http.Request) (uuid.UUID, error) {
	raw := chi.URLParam(r, "id")
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, apperr.BadRequest("id koperasi bukan UUID valid")
	}
	return id, nil
}

func toResponse(k *domain.Koperasi) koperasiResponse {
	mods := k.Modules
	if mods == nil {
		mods = []string{}
	}
	return koperasiResponse{
		ID:        k.ID.String(),
		Nama:      k.Nama,
		Jenis:     k.Jenis,
		Komoditas: k.Komoditas,
		Modules:   mods,
		Wilayah:   k.Wilayah,
		Alamat:    k.Alamat,
	}
}
