// Package config memuat konfigurasi gateway: base config (shared) + peta URL
// upstream service internal di jaringan docker.
package config

import (
	"os"

	sharedcfg "github.com/lumbung/shared/config"
)

// GatewayConfig menyatukan konfigurasi shared dengan daftar URL upstream.
type GatewayConfig struct {
	*sharedcfg.Config

	AuthSvcURL         string
	TenantSvcURL       string
	MemberSvcURL       string
	SimpanpinjamSvcURL string
	InventoriSvcURL    string
	PassSvcURL         string
	GuardSvcURL        string
	MarketplaceSvcURL  string
	NotifSvcURL        string
	AiSvcURL           string
}

// Load membaca shared config lalu menimpa URL upstream dari env (dengan default
// berbasis nama service di jaringan docker compose).
func Load() (*GatewayConfig, error) {
	base, err := sharedcfg.Load()
	if err != nil {
		return nil, err
	}
	return &GatewayConfig{
		Config:             base,
		AuthSvcURL:         getEnv("AUTH_SVC_URL", "http://auth-svc:8081"),
		TenantSvcURL:       getEnv("TENANT_SVC_URL", "http://tenant-svc:8082"),
		MemberSvcURL:       getEnv("MEMBER_SVC_URL", "http://member-svc:8083"),
		SimpanpinjamSvcURL: getEnv("SIMPANPINJAM_SVC_URL", "http://simpanpinjam-svc:8084"),
		InventoriSvcURL:    getEnv("INVENTORI_SVC_URL", "http://inventori-svc:8085"),
		PassSvcURL:         getEnv("PASS_SVC_URL", "http://pass-svc:8086"),
		GuardSvcURL:        getEnv("GUARD_SVC_URL", "http://guard-svc:8087"),
		MarketplaceSvcURL:  getEnv("MARKETPLACE_SVC_URL", "http://marketplace-svc:8088"),
		NotifSvcURL:        getEnv("NOTIF_SVC_URL", "http://notif-svc:8089"),
		AiSvcURL:           getEnv("AI_SVC_URL", "http://ai-svc:8000"),
	}, nil
}

func getEnv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
