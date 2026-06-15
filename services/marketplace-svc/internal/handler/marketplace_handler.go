// Package handler berisi HTTP handler marketplace-svc (chi).
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/marketplace-svc/internal/domain"
	"github.com/lumbung/marketplace-svc/internal/service"
)

// MarketplaceHandler menangani endpoint /api/produk dan /api/order.
type MarketplaceHandler struct {
	svc *service.MarketplaceService
}

// NewMarketplaceHandler membuat handler baru.
func NewMarketplaceHandler(svc *service.MarketplaceService) *MarketplaceHandler {
	return &MarketplaceHandler{svc: svc}
}

// --- DTO response ---

type produkResponse struct {
	ID         string  `json:"id"`
	KoperasiID string  `json:"koperasi_id"`
	Slug       string  `json:"slug"`
	Nama       string  `json:"nama"`
	Deskripsi  string  `json:"deskripsi,omitempty"`
	Harga      float64 `json:"harga"`
	Stok       int     `json:"stok"`
	Kategori   string  `json:"kategori"`
	FotoURL    string  `json:"foto_url,omitempty"`
	Aktif      bool    `json:"aktif"`
}

type orderItemResponse struct {
	ID       string  `json:"id"`
	ProdukID string  `json:"produk_id"`
	Qty      int     `json:"qty"`
	Harga    float64 `json:"harga"`
}

type orderResponse struct {
	ID           string              `json:"id"`
	KoperasiID   string              `json:"koperasi_id"`
	PembeliNama  string              `json:"pembeli_nama"`
	PembeliEmail string              `json:"pembeli_email,omitempty"`
	Total        float64             `json:"total"`
	Status       string              `json:"status"`
	Items        []orderItemResponse `json:"items"`
}

// --- DTO request ---

type createProdukRequest struct {
	Nama      string  `json:"nama"`
	Deskripsi string  `json:"deskripsi"`
	Harga     float64 `json:"harga"`
	Stok      int     `json:"stok"`
	Kategori  string  `json:"kategori"`
	FotoURL   string  `json:"foto_url"`
}

type updateProdukRequest struct {
	Nama      *string  `json:"nama"`
	Deskripsi *string  `json:"deskripsi"`
	Harga     *float64 `json:"harga"`
	Stok      *int     `json:"stok"`
	Kategori  *string  `json:"kategori"`
	FotoURL   *string  `json:"foto_url"`
	Aktif     *bool    `json:"aktif"`
}

type buatOrderItemRequest struct {
	ProdukID string `json:"produk_id"`
	Qty      int    `json:"qty"`
}

type buatOrderRequest struct {
	KoperasiID   string                 `json:"koperasi_id"`
	PembeliNama  string                 `json:"pembeli_nama"`
	PembeliEmail string                 `json:"pembeli_email"`
	Items        []buatOrderItemRequest `json:"items"`
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

// --- Handler produk ---

// ListProduk menangani GET /api/produk (publik).
func (h *MarketplaceHandler) ListProduk(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListProduk(r.Context(), true)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]produkResponse, 0, len(items))
	for _, p := range items {
		out = append(out, toProdukResponse(p))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// ListProdukAdmin menangani GET produk milik koperasi (auth).
func (h *MarketplaceHandler) ListProdukAdmin(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListProduk(r.Context(), false)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]produkResponse, 0, len(items))
	for _, p := range items {
		out = append(out, toProdukResponse(p))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// GetProdukBySlug menangani GET /api/produk/{slug} (publik).
func (h *MarketplaceHandler) GetProdukBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	p, err := h.svc.GetProdukBySlug(r.Context(), slug)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toProdukResponse(p))
}

// CreateProduk menangani POST /api/produk (auth pengurus).
func (h *MarketplaceHandler) CreateProduk(w http.ResponseWriter, r *http.Request) {
	var req createProdukRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	p, err := h.svc.CreateProduk(r.Context(), service.CreateProdukInput{
		Nama:      req.Nama,
		Deskripsi: req.Deskripsi,
		Harga:     req.Harga,
		Stok:      req.Stok,
		Kategori:  req.Kategori,
		FotoURL:   req.FotoURL,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toProdukResponse(p))
}

// UpdateProduk menangani PUT /api/produk/{id} (auth pengurus).
func (h *MarketplaceHandler) UpdateProduk(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id produk bukan UUID valid"))
		return
	}
	var req updateProdukRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	p, err := h.svc.UpdateProduk(r.Context(), id, service.UpdateProdukInput{
		Nama:      req.Nama,
		Deskripsi: req.Deskripsi,
		Harga:     req.Harga,
		Stok:      req.Stok,
		Kategori:  req.Kategori,
		FotoURL:   req.FotoURL,
		Aktif:     req.Aktif,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toProdukResponse(p))
}

// DeleteProduk menangani DELETE /api/produk/{id} (auth pengurus).
func (h *MarketplaceHandler) DeleteProduk(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id produk bukan UUID valid"))
		return
	}
	if err := h.svc.DeleteProduk(r.Context(), id); err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Handler order ---

// BuatOrder menangani POST /api/order (publik, pembeli luar).
func (h *MarketplaceHandler) BuatOrder(w http.ResponseWriter, r *http.Request) {
	var req buatOrderRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	koperasiID, err := uuid.Parse(req.KoperasiID)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("koperasi_id bukan UUID valid"))
		return
	}
	items := make([]service.BuatOrderItemInput, 0, len(req.Items))
	for _, it := range req.Items {
		pid, err := uuid.Parse(it.ProdukID)
		if err != nil {
			httpx.WriteError(w, apperr.BadRequest("produk_id bukan UUID valid"))
			return
		}
		items = append(items, service.BuatOrderItemInput{ProdukID: pid, Qty: it.Qty})
	}
	o, err := h.svc.BuatOrder(r.Context(), service.BuatOrderInput{
		KoperasiID:   koperasiID,
		PembeliNama:  req.PembeliNama,
		PembeliEmail: req.PembeliEmail,
		Items:        items,
	})
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toOrderResponse(o))
}

// ListOrder menangani GET /api/order (auth pengurus/kasir).
func (h *MarketplaceHandler) ListOrder(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListOrder(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]orderResponse, 0, len(items))
	for _, o := range items {
		out = append(out, toOrderResponse(o))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// UpdateStatusOrder menangani PATCH /api/order/{id}/status (auth pengurus).
func (h *MarketplaceHandler) UpdateStatusOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id order bukan UUID valid"))
		return
	}
	var req updateStatusRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if err := h.svc.UpdateStatusOrder(r.Context(), id, req.Status); err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id.String(), "status": req.Status})
}

// --- Mappers ---

func toProdukResponse(p *domain.Produk) produkResponse {
	return produkResponse{
		ID:         p.ID.String(),
		KoperasiID: p.KoperasiID.String(),
		Slug:       p.Slug,
		Nama:       p.Nama,
		Deskripsi:  p.Deskripsi,
		Harga:      p.Harga,
		Stok:       p.Stok,
		Kategori:   p.Kategori,
		FotoURL:    p.FotoURL,
		Aktif:      p.Aktif,
	}
}

func toOrderResponse(o *domain.Order) orderResponse {
	items := make([]orderItemResponse, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, orderItemResponse{
			ID:       it.ID.String(),
			ProdukID: it.ProdukID.String(),
			Qty:      it.Qty,
			Harga:    it.Harga,
		})
	}
	return orderResponse{
		ID:           o.ID.String(),
		KoperasiID:   o.KoperasiID.String(),
		PembeliNama:  o.PembeliNama,
		PembeliEmail: o.PembeliEmail,
		Total:        o.Total,
		Status:       o.Status,
		Items:        items,
	}
}
