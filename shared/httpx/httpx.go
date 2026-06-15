// Package httpx berisi helper HTTP lintas service: penulisan JSON,
// request ID, recover panic, dan endpoint health check standar.
package httpx

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/google/uuid"
	apperr "github.com/lumbung/shared/errors"
)

// ctxKey adalah tipe privat agar key context tidak bentrok dengan paket lain.
type ctxKey string

const requestIDKey ctxKey = "request_id"

// HeaderRequestID adalah nama header korelasi request antar service.
const HeaderRequestID = "X-Request-ID"

// WriteJSON menulis v sebagai JSON dengan status code tertentu.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		if err := json.NewEncoder(w).Encode(v); err != nil {
			slog.Error("httpx: gagal encode JSON response", "err", err)
		}
	}
}

// WriteError menulis error dalam format AppError konsisten (delegasi ke errors.Write).
func WriteError(w http.ResponseWriter, err error) {
	apperr.Write(w, err)
}

// DecodeJSON membaca body request ke dst. Mengembalikan AppError BadRequest bila gagal.
func DecodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return apperr.BadRequest("body JSON tidak valid").WithCause(err)
	}
	return nil
}

// RequestID middleware memastikan setiap request punya ID korelasi.
// Reuse header dari upstream (gateway) bila ada, jika tidak generate baru.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get(HeaderRequestID)
		if rid == "" {
			rid = uuid.NewString()
		}
		w.Header().Set(HeaderRequestID, rid)
		ctx := context.WithValue(r.Context(), requestIDKey, rid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID mengambil request ID dari context (kosong jika tidak ada).
func GetRequestID(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDKey).(string); ok {
		return v
	}
	return ""
}

// Recoverer middleware menangkap panic, mencatatnya, dan mengembalikan 500 JSON
// alih-alih menutup koneksi. Stack trace hanya masuk log, tidak ke klien.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("httpx: panic dipulihkan",
					"err", rec,
					"path", r.URL.Path,
					"request_id", GetRequestID(r.Context()),
					"stack", string(debug.Stack()),
				)
				WriteError(w, apperr.Internal("terjadi kesalahan internal"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// HealthLive selalu mengembalikan 200 — menandakan proses hidup.
func HealthLive(w http.ResponseWriter, _ *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]string{"status": "live"})
}

// ReadyCheck adalah fungsi pengecekan kesiapan satu dependency (DB/MQ/Redis).
type ReadyCheck func(ctx context.Context) error

// HealthReady membangun handler /health/ready yang menjalankan semua check.
// 200 jika semua sehat, 503 jika ada yang gagal (beserta nama yang gagal).
func HealthReady(checks map[string]ReadyCheck) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results := make(map[string]string, len(checks))
		healthy := true
		for name, check := range checks {
			if err := check(r.Context()); err != nil {
				results[name] = "down: " + err.Error()
				healthy = false
			} else {
				results[name] = "ok"
			}
		}
		status := http.StatusOK
		if !healthy {
			status = http.StatusServiceUnavailable
		}
		WriteJSON(w, status, map[string]any{"ready": healthy, "checks": results})
	}
}
