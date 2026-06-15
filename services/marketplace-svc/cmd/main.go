// Command marketplace-svc adalah layanan marketplace (katalog produk & order) LUMBUNG.
//
// Endpoint katalog (GET /api/produk, GET /api/produk/{slug}) dan pembuatan order
// (POST /api/order) bersifat PUBLIK — bisa diakses pembeli luar tanpa JWT.
// Endpoint manajemen (CRUD produk, kelola order) membutuhkan identitas tenant.
package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"

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
	"github.com/lumbung/marketplace-svc/internal/handler"
	"github.com/lumbung/marketplace-svc/internal/repository"
	"github.com/lumbung/marketplace-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("marketplace-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	produkRepo := repository.NewProdukRepository(db)
	orderRepo := repository.NewOrderRepository(db)

	// Event publisher (RabbitMQ). Jika gagal, service tetap jalan tanpa event.
	var publisher service.EventPublisher
	pub, err := events.NewPublisher(cfg.RabbitURL)
	if err != nil {
		slog.Warn("marketplace-svc: gagal koneksi RabbitMQ publisher, event dinonaktifkan", "err", err)
	} else {
		publisher = pub
		defer pub.Close()
	}

	svc := service.NewMarketplaceService(produkRepo, orderRepo, publisher)
	h := handler.NewMarketplaceHandler(svc)

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
		// --- Rute PUBLIK (tanpa JWT) ---
		// Katalog produk lintas koperasi & pembuatan order pembeli luar.
		r.Get("/produk", h.ListProduk)
		r.Get("/produk/{slug}", h.GetProdukBySlug)
		r.Post("/order", h.BuatOrder)

		// --- Rute TER-AUTENTIKASI (butuh identity dari gateway) ---
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.FromHeaders)

			// Daftar produk milik koperasi sendiri (admin view).
			// Path terpisah dari /produk/{slug} agar tidak bentrok router chi.
			r.Get("/produk-koperasi", h.ListProdukAdmin)
			// Order koperasi (pengurus/kasir).
			r.Get("/order", h.ListOrder)

			// Mutasi dibatasi pengurus.
			r.Group(func(r chi.Router) {
				r.Use(sharedauth.RequireRole(sharedauth.RolePengurus))
				r.Post("/produk", h.CreateProduk)
				r.Put("/produk/{id}", h.UpdateProduk)
				r.Delete("/produk/{id}", h.DeleteProduk)
				r.Patch("/order/{id}/status", h.UpdateStatusOrder)
			})
		})
	})

	slog.Info("marketplace-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("marketplace-svc error", "err", err)
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
	slog.Info("marketplace-svc: migrations applied")
}
