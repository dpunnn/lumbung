package handler

import (
	"net/http"

	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/simpanpinjam-svc/internal/service"
)

// KelayakanHandler menangani endpoint /api/kelayakan.
type KelayakanHandler struct {
	svc *service.KelayakanService
}

// NewKelayakanHandler membuat handler baru.
func NewKelayakanHandler(svc *service.KelayakanService) *KelayakanHandler {
	return &KelayakanHandler{svc: svc}
}

type kelayakanRequest struct {
	NikHash string `json:"nik_hash"`
}

type kelayakanResponse struct {
	Skor       int    `json:"skor"`
	Keterangan string `json:"keterangan"`
}

// CekKelayakan menangani POST /api/kelayakan.
func (h *KelayakanHandler) CekKelayakan(w http.ResponseWriter, r *http.Request) {
	var req kelayakanRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	hasil, err := h.svc.CekKelayakan(r.Context(), req.NikHash)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, kelayakanResponse{
		Skor:       hasil.Skor,
		Keterangan: hasil.Keterangan,
	})
}
