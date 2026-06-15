// Command auth-svc adalah layanan autentikasi LUMBUNG.
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
	"github.com/redis/go-redis/v9"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/lumbung/auth-svc/internal/handler"
	"github.com/lumbung/auth-svc/internal/repository"
	"github.com/lumbung/auth-svc/internal/service"
	sharedauth "github.com/lumbung/shared/auth"
	sharedcfg "github.com/lumbung/shared/config"
	"github.com/lumbung/shared/httpx"
)

func main() {
	cfg := sharedcfg.MustLoad()

	if cfg.DBDsn == "" {
		panic("auth-svc: DB_DSN wajib di-set")
	}

	// Jalankan migrasi sebelum koneksi GORM.
	runMigrations(cfg.DBDsn)

	db, err := gorm.Open(gormpg.Open(cfg.DBDsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	repo := repository.NewUserRepository(db)
	svc := service.NewAuthService(repo, rdb, []byte(cfg.JWTSecret), cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	h := handler.NewAuthHandler(svc)

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
		"redis": func(ctx context.Context) error { return rdb.Ping(ctx).Err() },
	}))

	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Post("/refresh", h.Refresh)
		r.Post("/logout", h.Logout)
		r.With(sharedauth.FromHeaders).Get("/me", h.GetMe)
	})

	slog.Info("auth-svc listen", "port", cfg.HTTPPort)
	if err := http.ListenAndServe(cfg.HTTPPort, r); err != nil {
		slog.Error("auth-svc error", "err", err)
	}
}

// runMigrations menjalankan golang-migrate Up dari folder ./migrations.
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
	slog.Info("auth-svc: migrations applied")
}
