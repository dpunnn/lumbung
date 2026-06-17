// Command inventori-svc adalah layanan inventaris & intake komoditas LUMBUNG.
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
	"github.com/lumbung/inventori-svc/internal/consumer"
	"github.com/lumbung/inventori-svc/internal/handler"
	"github.com/lumbung/inventori-svc/internal/repository"
	"github.com/lumbung/inventori-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("inventori-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	stokRepo := repository.NewStokRepository(db)
	intakeRepo := repository.NewIntakeRepository(db)
	pengadaanRepo := repository.NewPengadaanRepository(db)
	ternakRepo := repository.NewTernakRepository(db)
	pakanRepo := repository.NewPakanRepository(db)

	// Event publisher (RabbitMQ). Jika gagal, service tetap jalan tanpa event.
	var publisher service.EventPublisher
	pub, err := events.NewPublisher(cfg.RabbitURL)
	if err != nil {
		slog.Warn("inventori-svc: gagal koneksi RabbitMQ publisher, event dinonaktifkan", "err", err)
	} else {
		publisher = pub
		defer pub.Close()
	}

	svc := service.NewInventoriService(stokRepo, intakeRepo, pengadaanRepo, publisher)
	h := handler.NewInventoriHandler(svc)
	ternakH := handler.NewTernakHandler(ternakRepo)
	pakanH := handler.NewPakanHandler(pakanRepo)
	itemH := handler.NewInventoriItemHandler(db)

	// Consumer intake.recorded -> tambah stok (jalan di goroutine terpisah).
	startConsumer(cfg.RabbitURL, intakeRepo, publisher)

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

		// Stok generik internal (tidak di-expose ke frontend langsung).
		r.Get("/stok/internal", h.ListStok)

		// Inventori items CRUD (dipanggil frontend inventori page via /api/stok).
		r.Get("/stok", itemH.List)
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/stok", itemH.Create)
			r.Put("/stok/{id}", itemH.Update)
			r.Delete("/stok/{id}", itemH.Delete)
		})

		// Ternak CRUD.
		r.Get("/stok/ternak", ternakH.List)
		r.Get("/stok/ternak/{id}", ternakH.Get)
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/stok/ternak", ternakH.Create)
			r.Put("/stok/ternak/{id}", ternakH.Update)
			r.Delete("/stok/ternak/{id}", ternakH.Delete)
		})

		// Pakan CRUD.
		r.Get("/stok/pakan", pakanH.List)
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/stok/pakan", pakanH.Create)
			r.Put("/stok/pakan/{id}", pakanH.Update)
			r.Delete("/stok/pakan/{id}", pakanH.Delete)
		})

		// Intake.
		r.Get("/intake", h.ListIntake)
		// Pengadaan.
		r.Get("/pengadaan", h.ListPengadaan)

		// Mutasi intake/pengadaan dibatasi pengurus/kasir.
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/intake", h.CreateIntake)
			r.Post("/pengadaan", h.CreatePengadaan)
			r.Post("/pengadaan/{id}/finalisasi", h.FinalisasiPengadaan)
		})
	})

	slog.Info("inventori-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("inventori-svc error", "err", err)
	}
}

// startConsumer menyiapkan consumer intake.recorded di goroutine terpisah.
// Jika RabbitMQ tidak tersedia, service tetap jalan (hanya consumer dinonaktifkan).
func startConsumer(rabbitURL string, intakeRepo *repository.IntakeRepository, pub service.EventPublisher) {
	cons, err := events.NewConsumer(rabbitURL, "inventori-svc")
	if err != nil {
		slog.Warn("inventori-svc: gagal koneksi RabbitMQ consumer, intake event tidak dikonsumsi", "err", err)
		return
	}

	var cpub consumer.EventPublisher
	if pub != nil {
		cpub = pub
	}
	ic := consumer.NewIntakeConsumer(cons, intakeRepo, cpub)

	go func() {
		slog.Info("inventori-svc: consumer intake.recorded mulai")
		if err := ic.Start(); err != nil {
			slog.Error("inventori-svc: consumer berhenti", "err", err)
		}
	}()
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
	slog.Info("inventori-svc: migrations applied")
}
