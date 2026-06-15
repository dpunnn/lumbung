// Package handler berisi HTTP handler guard-svc (chi).
package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/guard-svc/internal/domain"
	"github.com/lumbung/guard-svc/internal/service"
)

// GuardHandler menangani endpoint /api/anomali dan /api/audit.
type GuardHandler struct {
	svc *service.GuardService
}

// NewGuardHandler membuat handler baru.
func NewGuardHandler(svc *service.GuardService) *GuardHandler {
	return &GuardHandler{svc: svc}
}

type anomalyResponse struct {
	ID         string    `json:"id"`
	KoperasiID string    `json:"koperasi_id"`
	Pola       string    `json:"pola"`
	RecordID   string    `json:"record_id"`
	Tabel      string    `json:"tabel"`
	Keterangan string    `json:"keterangan"`
	Severity   string    `json:"severity"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

type auditResponse struct {
	ID         string         `json:"id"`
	KoperasiID string         `json:"koperasi_id"`
	Aksi       string         `json:"aksi"`
	Tabel      string         `json:"tabel"`
	RecordID   string         `json:"record_id"`
	FieldDiff  map[string]any `json:"field_diff"`
	ActorID    string         `json:"actor_id,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
}

// ListAnomalies menangani GET /api/anomali.
func (h *GuardHandler) ListAnomalies(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListAnomalies(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]anomalyResponse, 0, len(items))
	for _, it := range items {
		out = append(out, toAnomalyResponse(it))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// AnalisisAnomali menangani POST /api/anomali/{id}/analisis.
func (h *GuardHandler) AnalisisAnomali(w http.ResponseWriter, r *http.Request) {
	raw := chi.URLParam(r, "id")
	id, err := uuid.Parse(raw)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id anomali bukan UUID valid"))
		return
	}
	analisis, err := h.svc.AnalisisAnomali(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"analisis": analisis})
}

// ListAuditLog menangani GET /api/audit (filter opsional: tabel, record_id).
func (h *GuardHandler) ListAuditLog(w http.ResponseWriter, r *http.Request) {
	tabel := r.URL.Query().Get("tabel")
	var recordID *uuid.UUID
	if raw := r.URL.Query().Get("record_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.WriteError(w, apperr.BadRequest("record_id bukan UUID valid"))
			return
		}
		recordID = &id
	}

	items, err := h.svc.ListAuditLog(r.Context(), tabel, recordID)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]auditResponse, 0, len(items))
	for _, it := range items {
		out = append(out, toAuditResponse(it))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func toAnomalyResponse(it *domain.Anomaly) anomalyResponse {
	return anomalyResponse{
		ID:         it.ID.String(),
		KoperasiID: it.KoperasiID.String(),
		Pola:       it.Pola,
		RecordID:   it.RecordID.String(),
		Tabel:      it.Tabel,
		Keterangan: it.Keterangan,
		Severity:   it.Severity,
		Status:     it.Status,
		CreatedAt:  it.CreatedAt,
	}
}

func toAuditResponse(it *domain.AuditLog) auditResponse {
	resp := auditResponse{
		ID:         it.ID.String(),
		KoperasiID: it.KoperasiID.String(),
		Aksi:       it.Aksi,
		Tabel:      it.Tabel,
		RecordID:   it.RecordID.String(),
		FieldDiff:  it.FieldDiff,
		CreatedAt:  it.CreatedAt,
	}
	if it.ActorID != nil {
		resp.ActorID = it.ActorID.String()
	}
	return resp
}
