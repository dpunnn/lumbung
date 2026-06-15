// Package service berisi logika bisnis guard-svc: pengelolaan anomali &
// analisis pola fraud via Claude Haiku.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/guard-svc/internal/domain"
	"github.com/lumbung/guard-svc/internal/repository"
)

// GuardService menyediakan operasi anomali & analisis fraud.
type GuardService struct {
	auditRepo   *repository.AuditRepository
	anomalyRepo *repository.AnomalyRepository
	apiKey      string
	httpClient  *http.Client
}

// NewGuardService membuat service baru. apiKey = ANTHROPIC_API_KEY (boleh kosong;
// bila kosong, AnalisisAnomali mengembalikan fallback).
func NewGuardService(
	auditRepo *repository.AuditRepository,
	anomalyRepo *repository.AnomalyRepository,
	apiKey string,
) *GuardService {
	return &GuardService{
		auditRepo:   auditRepo,
		anomalyRepo: anomalyRepo,
		apiKey:      apiKey,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// ListAnomalies mengembalikan anomali open untuk koperasi aktif.
func (s *GuardService) ListAnomalies(ctx context.Context) ([]*domain.Anomaly, error) {
	return s.anomalyRepo.FindOpen(ctx)
}

// ListAuditLog mengembalikan audit log koperasi (opsional filter tabel/record).
func (s *GuardService) ListAuditLog(ctx context.Context, tabel string, recordID *uuid.UUID) ([]*domain.AuditLog, error) {
	return s.auditRepo.FindAll(ctx, tabel, recordID)
}

// AnalisisAnomali memanggil Claude Haiku untuk menganalisis sebuah anomali.
// Mengembalikan narasi 3 poin (penyebab, risiko, saran). Degradasi anggun bila
// Claude tidak tersedia.
func (s *GuardService) AnalisisAnomali(ctx context.Context, anomalyID uuid.UUID) (string, error) {
	a, err := s.anomalyRepo.FindByID(ctx, anomalyID)
	if err != nil {
		return "", err
	}

	prompt := fmt.Sprintf(
		"Analisis pola fraud ini: %s, %s, %s. "+
			"Berikan: (1) kemungkinan penyebab, (2) risiko, (3) saran tindakan. "+
			"Jawab 3 poin singkat dalam Bahasa Indonesia.",
		a.Pola, a.Keterangan, a.Severity,
	)

	if s.apiKey == "" {
		return fallbackAnalisis(a), nil
	}
	out, err := s.callClaudeHaiku(ctx, prompt)
	if err != nil || out == "" {
		return fallbackAnalisis(a), nil
	}
	return out, nil
}

// fallbackAnalisis memberi narasi deterministik bila Claude tidak tersedia.
func fallbackAnalisis(a *domain.Anomaly) string {
	return fmt.Sprintf(
		"(1) Kemungkinan penyebab: pola '%s' pada %s terdeteksi otomatis. "+
			"(2) Risiko: tingkat %s — perlu verifikasi pengurus. "+
			"(3) Saran: tinjau transaksi terkait dan konfirmasi ke anggota sebelum diproses lanjut.",
		a.Pola, a.Tabel, a.Severity,
	)
}

// anthropicRequest adalah body request Messages API.
type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// callClaudeHaiku memanggil Anthropic Messages API (model Haiku) via HTTP.
func (s *GuardService) callClaudeHaiku(ctx context.Context, prompt string) (string, error) {
	reqBody := anthropicRequest{
		Model:     "claude-haiku-4-5-20251001",
		MaxTokens: 512,
		Messages: []anthropicMessage{
			{Role: "user", Content: prompt},
		},
	}
	raw, err := json.Marshal(reqBody)
	if err != nil {
		return "", apperr.Internal("gagal serialisasi request Claude").WithCause(err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(raw))
	if err != nil {
		return "", apperr.Internal("gagal membuat request Claude").WithCause(err)
	}
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", apperr.Unavailable("layanan analisis tidak tersedia").WithCause(err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", apperr.Internal("gagal membaca respons Claude").WithCause(err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", apperr.Unavailable(fmt.Sprintf("Claude mengembalikan status %d", resp.StatusCode))
	}

	var parsed anthropicResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", apperr.Internal("gagal parse respons Claude").WithCause(err)
	}
	out := ""
	for _, c := range parsed.Content {
		if c.Type == "text" {
			out += c.Text
		}
	}
	return out, nil
}
