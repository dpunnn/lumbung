// Command gateway adalah API gateway LUMBUNG: titik masuk tunggal dari frontend.
//
// Tanggung jawab:
//  1. Verifikasi JWT (Bearer) untuk route non-publik.
//  2. Inject header identitas (X-Tenant-ID/X-User-ID/X-Role) ke request downstream.
//  3. Rate limiting per IP (Redis, fixed window).
//  4. Reverse proxy ke service internal berdasarkan prefix path /api/...
package main

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"

	"github.com/lumbung/gateway/internal/config"
	"github.com/lumbung/gateway/internal/proxy"
	"github.com/lumbung/gateway/internal/ratelimit"
	sharedauth "github.com/lumbung/shared/auth"
	"github.com/lumbung/shared/httpx"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	// Redis untuk rate limiting (opsional — fail-open jika tidak tersedia).
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	limiter := ratelimit.New(rdb, 120, time.Minute) // 120 req/menit/IP

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(httpx.RequestID)
	r.Use(httpx.Recoverer)
	r.Use(corsMiddleware)
	r.Use(limiter.Middleware)

	// Route publik (tanpa JWT).
	publicPaths := map[string]bool{
		"/api/auth/login":    true,
		"/api/auth/register": true,
		"/api/auth/refresh":  true,
		"/api/auth/logout":   true,
	}
	isPublic := func(r *http.Request) bool {
		path := r.URL.Path
		if publicPaths[path] {
			return true
		}
		// Health endpoints selalu publik.
		if strings.HasPrefix(path, "/health/") {
			return true
		}
		// GET katalog produk, redeem pass, dan list koperasi bersifat publik.
		if r.Method == http.MethodGet &&
			(strings.HasPrefix(path, "/api/produk") ||
				strings.HasPrefix(path, "/api/pass/") ||
				path == "/api/koperasi") {
			return true
		}
		return false
	}

	// Verifikasi JWT lalu inject header identity ke downstream.
	r.Use(sharedauth.Verifier([]byte(cfg.JWTSecret), isPublic))
	r.Use(sharedauth.InjectHeaders)

	// Health gateway.
	r.Get("/health/live", httpx.HealthLive)
	r.Get("/health/ready", httpx.HealthReady(map[string]httpx.ReadyCheck{
		"redis": func(ctx context.Context) error { return rdb.Ping(ctx).Err() },
	}))

	// Routing ke upstream service.
	r.Mount("/api/auth", proxy.New(cfg.AuthSvcURL))
	r.Mount("/api/koperasi", proxy.New(cfg.TenantSvcURL))
	r.Mount("/api/anggota", proxy.New(cfg.MemberSvcURL))
	r.Mount("/api/simpanan", proxy.New(cfg.SimpanpinjamSvcURL))
	r.Mount("/api/pinjaman", proxy.New(cfg.SimpanpinjamSvcURL))
	r.Mount("/api/kelayakan", proxy.New(cfg.SimpanpinjamSvcURL))
	r.Mount("/api/lens", proxy.New(cfg.SimpanpinjamSvcURL))
	r.Mount("/api/stok", proxy.New(cfg.InventoriSvcURL))
	r.Mount("/api/intake", proxy.New(cfg.InventoriSvcURL))
	r.Mount("/api/pengadaan", proxy.New(cfg.InventoriSvcURL))
	r.Mount("/api/pass", proxy.New(cfg.PassSvcURL))
	r.Mount("/api/anomali", proxy.New(cfg.GuardSvcURL))
	r.Mount("/api/produk", proxy.New(cfg.MarketplaceSvcURL))
	r.Mount("/api/order", proxy.New(cfg.MarketplaceSvcURL))
	r.Mount("/api/notif", proxy.New(cfg.NotifSvcURL))
	r.Mount("/api/ai", proxy.New(cfg.AiSvcURL))

	slog.Info("gateway listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("gateway error", "err", err)
	}
}
