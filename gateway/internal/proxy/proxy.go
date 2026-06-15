// Package proxy menyediakan reverse proxy dari gateway ke service upstream.
//
// Gateway memverifikasi JWT lalu meneruskan request apa adanya (termasuk path
// /api/... dan header identity X-Tenant-ID/X-User-ID/X-Role yang sudah di-inject)
// ke service tujuan. Service internal memakai prefix /api yang sama sehingga
// tidak perlu strip prefix.
package proxy

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
)

// New membuat http.Handler reverse proxy ke target (mis. "http://auth-svc:8081").
// Path diteruskan utuh. Error koneksi upstream dikembalikan sebagai AppError JSON.
func New(target string) http.Handler {
	u, err := url.Parse(target)
	if err != nil {
		// Konfigurasi salah saat boot: handler selalu mengembalikan 503.
		slog.Error("proxy: target URL tidak valid", "target", target, "err", err)
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			httpx.WriteError(w, apperr.Unavailable("konfigurasi upstream tidak valid"))
		})
	}

	rp := httputil.NewSingleHostReverseProxy(u)

	// Bungkus director default agar Host header diset ke target dan
	// X-Forwarded-Host dipertahankan.
	baseDirector := rp.Director
	rp.Director = func(req *http.Request) {
		baseDirector(req)
		req.Host = u.Host
	}

	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, e error) {
		slog.Error("proxy: gagal meneruskan ke upstream",
			"target", target,
			"path", r.URL.Path,
			"request_id", httpx.GetRequestID(r.Context()),
			"err", e,
		)
		httpx.WriteError(w, apperr.Unavailable("layanan upstream tidak tersedia"))
	}

	return rp
}
