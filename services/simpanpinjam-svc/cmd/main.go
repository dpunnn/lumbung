// Command simpanpinjam-svc adalah layanan simpan-pinjam koperasi LUMBUNG.
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
	"github.com/lumbung/simpanpinjam-svc/internal/handler"
	"github.com/lumbung/simpanpinjam-svc/internal/repository"
	"github.com/lumbung/simpanpinjam-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("simpanpinjam-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	// Event publisher (RabbitMQ). Jika gagal, service tetap jalan tanpa event.
	var publisher service.EventPublisher
	pub, err := events.NewPublisher(cfg.RabbitURL)
	if err != nil {
		slog.Warn("simpanpinjam-svc: gagal koneksi RabbitMQ, event dinonaktifkan", "err", err)
	} else {
		publisher = pub
		defer pub.Close()
	}

	simpananRepo := repository.NewSimpananRepository(db)
	pinjamanRepo := repository.NewPinjamanRepository(db)
	angsuranRepo := repository.NewAngsuranRepository(db)
	riwayatRepo := repository.NewRiwayatKreditRepository(db)

	simpananSvc := service.NewSimpananService(simpananRepo, publisher)
	pinjamanSvc := service.NewPinjamanService(pinjamanRepo, angsuranRepo, publisher)
	kelayakanSvc := service.NewKelayakanService(riwayatRepo)

	simpananH := handler.NewSimpananHandler(simpananSvc)
	pinjamanH := handler.NewPinjamanHandler(pinjamanSvc, simpananSvc)
	kelayakanH := handler.NewKelayakanHandler(kelayakanSvc)

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
		// Semua endpoint butuh identity dari gateway.
		r.Use(sharedauth.FromHeaders)

		// Simpanan
		r.Get("/simpanan", simpananH.ListSimpanan)
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/simpanan", simpananH.CreateSimpanan)
			r.Post("/simpanan/{id}/approve", simpananH.ApproveSimpanan)
		})

		// Pinjaman
		r.Get("/pinjaman", pinjamanH.ListPinjaman)
		r.Get("/pinjaman/{id}/angsuran", pinjamanH.ListAngsuran)
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/pinjaman", pinjamanH.CreatePinjaman)
			r.Post("/pinjaman/{id}/angsuran", pinjamanH.BayarAngsuran)
		})

		// Kelayakan kredit (lintas-tenant scoring)
		r.Post("/kelayakan", kelayakanH.CekKelayakan)

		// Lens dashboard
		r.Get("/lens/ringkasan", pinjamanH.Ringkasan)
	})

	slog.Info("simpanpinjam-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("simpanpinjam-svc error", "err", err)
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
	slog.Info("simpanpinjam-svc: migrations applied")
}
