// Command tenant-svc adalah layanan manajemen koperasi (tenant) LUMBUNG.
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

	"github.com/lumbung/tenant-svc/internal/handler"
	"github.com/lumbung/tenant-svc/internal/repository"
	"github.com/lumbung/tenant-svc/internal/service"
	sharedauth "github.com/lumbung/shared/auth"
	sharedcfg "github.com/lumbung/shared/config"
	"github.com/lumbung/shared/httpx"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("tenant-svc: DB_DSN wajib di-set")
	}

	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	repo := repository.NewKoperasiRepository(db)
	svc := service.NewTenantService(repo)
	h := handler.NewTenantHandler(svc)

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

	r.Route("/api/koperasi", func(r chi.Router) {
		// GET list & detail: publik (tidak butuh identity).
		r.Get("/", h.List)
		r.Get("/{id}", h.Get)

		// Mutasi: butuh identity dan role.
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.FromHeaders)
			r.Use(sharedauth.RequireRole(sharedauth.RoleSuperAdmin, sharedauth.RolePengurus))
			r.Put("/{id}", h.Update)
			r.Patch("/{id}/modules", h.PatchModules)
		})

		// Pembuatan koperasi hanya super_admin (operator platform).
		r.Group(func(r chi.Router) {
			r.Use(sharedauth.FromHeaders)
			r.Use(sharedauth.RequireRole(sharedauth.RoleSuperAdmin))
			r.Post("/", h.Create)
		})
	})

	slog.Info("tenant-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("tenant-svc error", "err", err)
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
	slog.Info("tenant-svc: migrations applied")
}
