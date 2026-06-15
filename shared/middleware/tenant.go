// Package middleware menyediakan helper RLS (Row Level Security) untuk GORM.
//
// LUMBUNG memakai PostgreSQL RLS agar isolasi tenant ditegakkan di level DB,
// bukan hanya di kode aplikasi. Setiap tabel tenant-aware punya policy:
//
//	USING (koperasi_id = current_setting('app.current_tenant', true)::uuid)
//
// Variabel sesi 'app.current_tenant' di-set per transaksi via SET LOCAL.
// Karena SET LOCAL hanya berlaku dalam satu transaksi, semua query yang
// butuh RLS WAJIB dijalankan dalam tx hasil OpenTenantTx.
package middleware

import (
	"context"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"gorm.io/gorm"
)

// ctxTenantKey adalah key context privat untuk namespace aman (cadangan).
type ctxTenantKey struct{}

// OpenTenantTx membuka transaksi Postgres, men-set app.current_tenant dari
// Identity di context, lalu mengembalikan *gorm.DB transaksional.
//
// Setelah ini, semua query lewat tx akan otomatis difilter RLS policy.
// Caller WAJIB memanggil tx.Commit() (sukses) atau tx.Rollback() (gagal).
//
// Contoh:
//
//	tx, err := middleware.OpenTenantTx(ctx, db)
//	if err != nil { return err }
//	defer tx.Rollback() // no-op jika sudah Commit
//	if err := tx.Create(&row).Error; err != nil { return err }
//	return tx.Commit().Error
func OpenTenantTx(ctx context.Context, db *gorm.DB) (*gorm.DB, error) {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.TenantID == "" {
		return nil, apperr.TenantMissing()
	}
	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, apperr.Internal("gagal membuka transaksi DB").WithCause(tx.Error)
	}
	// SET LOCAL hanya berlaku dalam transaksi ini. Gunakan parameter binding
	// agar aman dari injeksi (tenant ID berasal dari header tepercaya, tetapi
	// tetap diperlakukan sebagai nilai).
	if err := tx.Exec("SELECT set_config('app.current_tenant', ?, true)", id.TenantID).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal set tenant context DB").WithCause(err)
	}
	return tx, nil
}

// WithTenantValue menyimpan tenant ID ke context (pelengkap; sumber utama tetap
// sharedauth.Identity). Disediakan agar paket lain bisa membaca tenant tanpa
// bergantung langsung ke paket auth bila diperlukan.
func WithTenantValue(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, ctxTenantKey{}, tenantID)
}

// TenantFromValue membaca tenant ID yang disimpan via WithTenantValue.
func TenantFromValue(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(ctxTenantKey{}).(string)
	return v, ok
}
