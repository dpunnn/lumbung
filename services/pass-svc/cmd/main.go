// Command pass-svc adalah layanan Pass (consent-based data sharing) & Receipt
// ber-rantai HMAC (tamper-proof) untuk hero feature "Saksi AI" LUMBUNG.
package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/golang-migrate/migrate/v4"
	migratepg "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"

	sharedauth "github.com/lumbung/shared/auth"
	sharedcfg "github.com/lumbung/shared/config"
	"github.com/lumbung/shared/events"
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/pass-svc/internal/handler"
	"github.com/lumbung/pass-svc/internal/repository"
	"github.com/lumbung/pass-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("pass-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	passRepo := repository.NewPassRepository(db)
	receiptRepo := repository.NewReceiptRepository(db)

	// HMAC secret untuk rantai receipt. Fallback ke JWT_SECRET jika kosong.
	hmacSecret := []byte(os.Getenv("HMAC_SECRET"))
	if len(hmacSecret) == 0 {
		hmacSecret = []byte(cfg.JWTSecret)
	}

	// Event publisher (RabbitMQ). Jika gagal, service tetap jalan tanpa event.
	var publisher service.EventPublisher
	pub, err := events.NewPublisher(cfg.RabbitURL)
	if err != nil {
		slog.Warn("pass-svc: gagal koneksi RabbitMQ publisher, event dinonaktifkan", "err", err)
	} else {
		publisher = pub
		defer pub.Close()
	}

	svc := service.NewPassService(passRepo, receiptRepo, publisher, hmacSecret)
	h := handler.NewPassHandler(svc)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(httpx.RequestID)
	r.Use(httpx.Recoverer)

	r.Get("/health/live", httpx.HealthLive)
	r.Get("/health/ready", httpx.HealthReady(map[string]httpx.ReadyCheck{
		"postgres": func(ctx context.Context) error {
			sqlDB, err := db.DB()
			if err != nil {
				return err
			}
			return sqlDB.PingContext(ctx)
		},
	}))

	r.Route("/api", func(r chi.Router) {
		// Endpoint PUBLIK: mitra memindai QR pass tanpa autentikasi.
		// Tidak memakai FromHeaders agar tidak butuh identity.
		r.Get("/pass/{token}", h.GetPassPublic)

		// Endpoint terautentikasi (identity dari gateway).
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.FromHeaders)

			r.Get("/pass", h.ListPass)

			// Mutasi dibatasi pengurus/kasir.
			r.Group(func(r chi.Router) {
				r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
				r.Post("/pass", h.CreatePass)
				r.Delete("/pass/{token}", h.RevokePass)
				r.Post("/pass/intake", h.CreateIntakeReceipt)
			})
		})
	})

	slog.Info("pass-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("pass-svc error", "err", err)
	}
}

func runMigrations(dsn string) {
	sqlDB, err := sql.Open("postgres", dsn)
	if err != nil {
		panic(err)
	}
	defer sqlDB.Close()

	driver, err := migratepg.WithInstance(sqlDB, &migratepg.Config{})
	if err != nil {
		panic(err)
	}

	m, err := migrate.NewWithDatabaseInstance("file://migrations", "postgres", driver)
	if err != nil {
		panic(err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		panic(err)
	}
	slog.Info("pass-svc: migrations applied")
}
