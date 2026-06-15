// Package handler berisi HTTP handler pass-svc (chi).
package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/pass-svc/internal/domain"
	"github.com/lumbung/pass-svc/internal/service"
)

// PassHandler menangani endpoint /api/pass dan /api/pass/intake.
type PassHandler struct {
	svc *service.PassService
}

// NewPassHandler membuat handler baru.
func NewPassHandler(svc *service.PassService) *PassHandler {
	return &PassHandler{svc: svc}
}

type createPassRequest struct {
	Consent       []string       `json:"consent"`
	Fields        map[string]any `json:"fields"`
	Tujuan        string         `json:"tujuan"`
	Mitra         string         `json:"mitra"`
	BerlakuSampai *time.Time     `json:"berlaku_sampai"`
}

type createPassResponse struct {
	ID            string    `json:"id"`
	Token         string    `json:"token"`
	BerlakuSampai time.Time `json:"berlaku_sampai"`
}

type passResponse struct {
	ID            string         `json:"id"`
	KoperasiID    string         `json:"koperasi_id"`
	Token         string         `json:"token"`
	Consent       []string       `json:"consent"`
	Fields        map[string]any `json:"fields"`
	Hash          string         `json:"hash"`
	Tujuan        string         `json:"tujuan,omitempty"`
	Mitra         string         `json:"mitra,omitempty"`
	BerlakuSampai time.Time      `json:"berlaku_sampai"`
	Status        string         `json:"status"`
}

type publicPassResponse struct {
	Token         string         `json:"token"`
	Consent       []string       `json:"consent"`
	Fields        map[string]any `json:"fields"`
	Hash          string         `json:"hash"`
	Mitra         string         `json:"mitra,omitempty"`
	Tujuan        string         `json:"tujuan,omitempty"`
	BerlakuSampai time.Time      `json:"berlaku_sampai"`
	Status        string         `json:"status"`
}

type createIntakeReceiptRequest struct {
	BatchID    string  `json:"batch_id"`
	Komoditas  string  `json:"komoditas"`
	Jumlah     float64 `json:"jumlah"`
	Mutu       string  `json:"mutu"`
	Skor       float64 `json:"skor"`
	ApproverID string  `json:"approver_id"`
	WitnessID  string  `json:"witness_id"`
	AiMode     string  `json:"ai_mode"`
}

type receiptResponse struct {
	ID         string  `json:"id"`
	KoperasiID string  `json:"koperasi_id"`
	TxType     string  `json:"tx_type"`
	TxID       string  `json:"tx_id"`
	Amount     float64 `json:"amount"`
	PrevHash   string  `json:"prev_hash"`
	Hash       string  `json:"hash"`
	Signature  string  `json:"signature"`
}

// CreatePass menangani POST /api/pass.
func (h *PassHandler) CreatePass(w http.ResponseWriter, r *http.Request) {
	var req createPassRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	in := service.CreatePassInput{
		Consent: req.Consent,
		Fields:  req.Fields,
		Tujuan:  req.Tujuan,
		Mitra:   req.Mitra,
	}
	if req.BerlakuSampai != nil {
		in.BerlakuSampai = *req.BerlakuSampai
	}
	p, err := h.svc.CreatePass(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, createPassResponse{
		ID:            p.ID.String(),
		Token:         p.Token,
		BerlakuSampai: p.BerlakuSampai,
	})
}

// ListPass menangani GET /api/pass.
func (h *PassHandler) ListPass(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPass(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	out := make([]passResponse, 0, len(items))
	for _, it := range items {
		out = append(out, toPassResponse(it))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// GetPassPublic menangani GET /api/pass/{token} (PUBLIC, tanpa auth).
func (h *PassHandler) GetPassPublic(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	p, err := h.svc.GetPassPublic(r.Context(), token)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, publicPassResponse{
		Token:         p.Token,
		Consent:       p.Consent,
		Fields:        p.Fields,
		Hash:          p.Hash,
		Mitra:         p.Mitra,
		Tujuan:        p.Tujuan,
		BerlakuSampai: p.BerlakuSampai,
		Status:        p.Status,
	})
}

// RevokePass menangani DELETE /api/pass/{token}.
func (h *PassHandler) RevokePass(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if err := h.svc.RevokePass(r.Context(), token); err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CreateIntakeReceipt menangani POST /api/pass/intake.
func (h *PassHandler) CreateIntakeReceipt(w http.ResponseWriter, r *http.Request) {
	var req createIntakeReceiptRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	batchID, err := uuid.Parse(req.BatchID)
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("batch_id bukan UUID valid"))
		return
	}

	in := service.IntakeReceiptInput{
		BatchID:   batchID,
		Komoditas: req.Komoditas,
		Jumlah:    req.Jumlah,
		Mutu:      req.Mutu,
		Skor:      req.Skor,
		AiMode:    req.AiMode,
	}
	if req.ApproverID != "" {
		if id, err := uuid.Parse(req.ApproverID); err == nil {
			in.ApproverID = &id
		} else {
			httpx.WriteError(w, apperr.BadRequest("approver_id bukan UUID valid"))
			return
		}
	}
	if req.WitnessID != "" {
		if id, err := uuid.Parse(req.WitnessID); err == nil {
			in.WitnessID = &id
		} else {
			httpx.WriteError(w, apperr.BadRequest("witness_id bukan UUID valid"))
			return
		}
	}

	rec, err := h.svc.CreateIntakeReceipt(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toReceiptResponse(rec))
}

func toPassResponse(it *domain.Pass) passResponse {
	return passResponse{
		ID:            it.ID.String(),
		KoperasiID:    it.KoperasiID.String(),
		Token:         it.Token,
		Consent:       it.Consent,
		Fields:        it.Fields,
		Hash:          it.Hash,
		Tujuan:        it.Tujuan,
		Mitra:         it.Mitra,
		BerlakuSampai: it.BerlakuSampai,
		Status:        it.Status,
	}
}

func toReceiptResponse(it *domain.Receipt) receiptResponse {
	return receiptResponse{
		ID:         it.ID.String(),
		KoperasiID: it.KoperasiID.String(),
		TxType:     it.TxType,
		TxID:       it.TxID.String(),
		Amount:     it.Amount,
		PrevHash:   it.PrevHash,
		Hash:       it.Hash,
		Signature:  it.Signature,
	}
}
