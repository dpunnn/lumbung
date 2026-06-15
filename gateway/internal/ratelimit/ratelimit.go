// Package ratelimit menyediakan middleware rate limiting berbasis Redis
// (fixed window per IP) untuk gateway.
package ratelimit

import (
	"net/http"
	"strconv"
	"time"

	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
	"github.com/redis/go-redis/v9"
)

// Limiter membatasi jumlah request per IP dalam jendela waktu tetap.
type Limiter struct {
	rdb    *redis.Client
	limit  int
	window time.Duration
}

// New membuat Limiter. Bila rdb nil, middleware menjadi no-op (dev tanpa Redis).
func New(rdb *redis.Client, limit int, window time.Duration) *Limiter {
	return &Limiter{rdb: rdb, limit: limit, window: window}
}

// Middleware menerapkan rate limit. Key = "ratelimit:<ip>".
func (l *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if l.rdb == nil {
			next.ServeHTTP(w, r)
			return
		}
		ip := clientIP(r)
		key := "ratelimit:" + ip

		ctx := r.Context()
		count, err := l.rdb.Incr(ctx, key).Result()
		if err != nil {
			// Redis down: fail-open agar gateway tetap melayani.
			next.ServeHTTP(w, r)
			return
		}
		if count == 1 {
			l.rdb.Expire(ctx, key, l.window)
		}
		if count > int64(l.limit) {
			w.Header().Set("Retry-After", strconv.Itoa(int(l.window.Seconds())))
			httpx.WriteError(w, apperr.New(apperr.CodeUnavailable, http.StatusTooManyRequests, "terlalu banyak permintaan, coba lagi nanti"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP mengambil IP klien dari X-Forwarded-For/X-Real-IP atau RemoteAddr.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Ambil IP pertama (klien asli).
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return xrip
	}
	host := r.RemoteAddr
	for i := len(host) - 1; i >= 0; i-- {
		if host[i] == ':' {
			return host[:i]
		}
	}
	return host
}
