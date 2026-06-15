// Package handler menyediakan HTTP endpoint notif-svc: list, tandai dibaca,
// dan stream realtime (SSE) per-tenant.
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/lumbung/notif-svc/internal/hub"
	"github.com/lumbung/notif-svc/internal/service"
	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
)

type NotifHandler struct {
	svc *service.NotifService
	hub *hub.Hub
}

func NewNotifHandler(svc *service.NotifService, h *hub.Hub) *NotifHandler {
	return &NotifHandler{svc: svc, hub: h}
}

// List mengembalikan notifikasi tenant pemanggil.
func (h *NotifHandler) List(w http.ResponseWriter, r *http.Request) {
	notifs, err := h.svc.List(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, notifs)
}

// TandaiDibaca menandai satu notifikasi sebagai terbaca.
func (h *NotifHandler) TandaiDibaca(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("ID tidak valid"))
		return
	}
	if err := h.svc.TandaiDibaca(r.Context(), id); err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Stream membuka koneksi SSE dan mengalirkan notifikasi realtime tenant.
func (h *NotifHandler) Stream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE tidak didukung", http.StatusInternalServerError)
		return
	}

	id, ok := sharedauth.FromContext(r.Context())
	if !ok || id.TenantID == "" {
		httpx.WriteError(w, apperr.Unauthorized("identitas tidak ditemukan"))
		return
	}

	ch := h.hub.Subscribe(id.TenantID)
	defer h.hub.Unsubscribe(id.TenantID, ch)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg := <-ch:
			data, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
