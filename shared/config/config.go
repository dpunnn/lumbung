// Package config memuat konfigurasi service dari environment variable.
// Semua service Go memanggil config.Load() saat startup. Tidak ada file
// config di disk — 12-factor: konfigurasi via env (docker-compose / k8s).
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config adalah konfigurasi gabungan yang dipakai mayoritas service.
// Service tertentu boleh hanya memakai sebagian field (mis. gateway tidak
// butuh DBDsn). Field di-load dari env saat Load() dipanggil.
type Config struct {
	// ServiceName dipakai untuk logging & nama queue/consumer RabbitMQ.
	ServiceName string
	// HTTPPort port listen HTTP service (mis. ":8081").
	HTTPPort string

	// DBDsn DSN Postgres untuk koneksi GORM (per-service database).
	// Contoh: postgres://lumbung_auth:pass@postgres:5432/lumbung_auth?sslmode=disable
	DBDsn string

	// RabbitURL URL koneksi RabbitMQ (amqp://user:pass@rabbitmq:5672/).
	RabbitURL string

	// RedisURL alamat Redis (host:port). Password & DB terpisah.
	RedisAddr     string
	RedisPassword string
	RedisDB       int

	// JWTSecret kunci HMAC untuk sign/verify access token (min 256 bit).
	JWTSecret string
	// AccessTokenTTL masa hidup access token (default 15 menit).
	AccessTokenTTL time.Duration
	// RefreshTokenTTL masa hidup refresh token opaque (default 7 hari).
	RefreshTokenTTL time.Duration

	// Env mode jalan: "dev" | "prod". Mempengaruhi logging & AutoMigrate.
	Env string
}

// Load membaca semua env var dan mengembalikan Config terisi.
// Mengembalikan error jika ada env var WAJIB yang kosong (fail-fast saat boot).
func Load() (*Config, error) {
	cfg := &Config{
		ServiceName:     getEnv("SERVICE_NAME", "lumbung-svc"),
		HTTPPort:        normalizePort(getEnv("HTTP_PORT", "8080")),
		DBDsn:           os.Getenv("DB_DSN"),
		RabbitURL:       getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:   os.Getenv("REDIS_PASSWORD"),
		RedisDB:         getEnvInt("REDIS_DB", 0),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		AccessTokenTTL:  getEnvDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL: getEnvDuration("REFRESH_TOKEN_TTL", 7*24*time.Hour),
		Env:             getEnv("APP_ENV", "dev"),
	}

	// JWT secret wajib di semua service yang verify token.
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config: JWT_SECRET wajib di-set")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("config: JWT_SECRET minimal 32 byte (256 bit), saat ini %d", len(cfg.JWTSecret))
	}
	return cfg, nil
}

// MustLoad seperti Load tetapi panic jika gagal — dipakai di main() saat boot.
func MustLoad() *Config {
	cfg, err := Load()
	if err != nil {
		panic(err)
	}
	return cfg
}

// normalizePort memastikan port berbentuk ":8080".
func normalizePort(p string) string {
	if p == "" {
		return ":8080"
	}
	if p[0] != ':' {
		return ":" + p
	}
	return p
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
