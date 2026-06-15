// Command member-svc adalah layanan manajemen anggota koperasi LUMBUNG.
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
	"github.com/lumbung/shared/httpx"
	"github.com/lumbung/member-svc/internal/handler"
	"github.com/lumbung/member-svc/internal/repository"
	"github.com/lumbung/member-svc/internal/service"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("member-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	repo := repository.NewAnggotaRepository(db)
	svc := service.NewMemberService(repo)
	h := handler.NewMemberHandler(svc)

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

	r.Route("/api/anggota", func(r chi.Router) {
		// Semua endpoint butuh identity dari gateway.
		r.Use(sharedauth.FromHeaders)

		r.Get("/", h.ListAnggota)
		r.Get("/{id}", h.GetAnggota)
		r.Get("/{id}/valid", h.ValidateExists)

		// Mutasi dibatasi pengurus/kasir.
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus, sharedauth.RoleKasir))
			r.Post("/", h.CreateAnggota)
		})
		// Update hanya pengurus.
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.RequireRole(sharedauth.RolePengurus))
			r.Put("/{id}", h.UpdateAnggota)
		})
	})

	slog.Info("member-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("member-svc error", "err", err)
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
	slog.Info("member-svc: migrations applied")
}
