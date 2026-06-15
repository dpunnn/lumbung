// Command notif-svc menjalankan service notifikasi LUMBUNG: HTTP API (list,
// tandai dibaca, SSE stream) plus consumer event bus yang mengubah event domain
// menjadi notifikasi per-tenant secara realtime.
package main

import (
	"database/sql"
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
	"github.com/lumbung/shared/httpx"

	"github.com/lumbung/notif-svc/internal/consumer"
	"github.com/lumbung/notif-svc/internal/handler"
	"github.com/lumbung/notif-svc/internal/hub"
	"github.com/lumbung/notif-svc/internal/repository"
	"github.com/lumbung/notif-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	runMigrations(cfg.DBDsn)

	h := hub.New()
	repo := repository.NewNotifRepository(db)
	svc := service.NewNotifService(repo)
	hdlr := handler.NewNotifHandler(svc, h)

	// Consumer event bus dijalankan di goroutine terpisah. Kegagalan init bersifat
	// non-fatal: HTTP API tetap melayani; consumer bisa di-restart oleh orkestrator.
	evConsumer, err := consumer.NewEventsConsumer(db, cfg.RabbitURL, h)
	if err != nil {
		slog.Error("notif-svc: gagal init consumer", "err", err)
	} else {
		go func() {
			if err := evConsumer.Start(); err != nil {
				slog.Error("notif-svc: consumer error", "err", err)
			}
		}()
		defer evConsumer.Close()
	}

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(httpx.RequestID)
	r.Use(httpx.Recoverer)

	r.Get("/health/live", httpx.HealthLive)

	r.Route("/api/notif", func(r chi.Router) {
		r.Use(sharedauth.FromHeaders)
		r.Get("/", hdlr.List)
		r.Get("/stream", hdlr.Stream)
		r.Patch("/{id}/baca", hdlr.TandaiDibaca)
	})

	slog.Info("notif-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("notif-svc error", "err", err)
	}
}

// runMigrations menerapkan migrasi SQL (file://migrations) ke database.
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

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		panic(err)
	}
	slog.Info("notif-svc: migrations applied")
}
