// Command guard-svc adalah layanan audit & deteksi anomali (fraud guard) LUMBUNG.
// Ia mengonsumsi seluruh event domain, menulis jejak audit, dan menandai pola
// transaksi mencurigakan. Analisis naratif anomali memakai Claude Haiku.
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
	"github.com/lumbung/guard-svc/internal/consumer"
	"github.com/lumbung/guard-svc/internal/handler"
	"github.com/lumbung/guard-svc/internal/repository"
	"github.com/lumbung/guard-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("guard-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	auditRepo := repository.NewAuditRepository(db)
	anomalyRepo := repository.NewAnomalyRepository(db)

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	svc := service.NewGuardService(auditRepo, anomalyRepo, apiKey)
	h := handler.NewGuardHandler(svc)

	// Consumer semua event domain -> audit + deteksi anomali (goroutine terpisah).
	startConsumer(cfg.RabbitURL, anomalyRepo)

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
		r.Use(sharedauth.FromHeaders)

		// Read terbuka untuk identitas koperasi (pengurus melihat audit/anomali).
		r.Get("/audit", h.ListAuditLog)
		r.Get("/anomali", h.ListAnomalies)

		// Analisis AI dibatasi pengurus.
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus))
			r.Post("/anomali/{id}/analisis", h.AnalisisAnomali)
		})
	})

	slog.Info("guard-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("guard-svc error", "err", err)
	}
}

// startConsumer menyiapkan consumer semua event domain di goroutine terpisah.
func startConsumer(rabbitURL string, anomalyRepo *repository.AnomalyRepository) {
	cons, err := events.NewConsumer(rabbitURL, "guard-svc")
	if err != nil {
		slog.Warn("guard-svc: gagal koneksi RabbitMQ consumer, audit/anomali tidak aktif", "err", err)
		return
	}
	ec := consumer.NewEventsConsumer(cons, anomalyRepo)
	go func() {
		slog.Info("guard-svc: consumer event domain mulai")
		if err := ec.Start(); err != nil {
			slog.Error("guard-svc: consumer berhenti", "err", err)
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
	slog.Info("guard-svc: migrations applied")
}
