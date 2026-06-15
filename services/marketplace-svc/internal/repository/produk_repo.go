// Package repository berisi akses data marketplace-svc (GORM) dengan RLS.
package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	apperr "github.com/lumbung/shared/errors"
	sharedmw "github.com/lumbung/shared/middleware"
	"github.com/lumbung/marketplace-svc/internal/domain"
)

// ProdukModel adalah representasi tabel produk untuk GORM.
type ProdukModel struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	KoperasiID uuid.UUID  `gorm:"type:uuid;not null;column:koperasi_id"`
	Slug       string     `gorm:"size:200;not null"`
	Nama       string     `gorm:"size:300;not null"`
	Deskripsi  string     `gorm:"type:text"`
	Harga      float64    `gorm:"type:numeric(15,2);not null"`
	Stok       int        `gorm:"not null;default:0"`
	Kategori   string     `gorm:"size:50;not null;default:ternak"`
	FotoURL    string     `gorm:"type:text;column:foto_url"`
	Aktif      bool       `gorm:"not null;default:true"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  *time.Time `gorm:"column:deleted_at"`
}

// TableName memetakan model ke tabel produk.
func (ProdukModel) TableName() string { return "produk" }

// ProdukRepository menyediakan operasi data produk.
type ProdukRepository struct {
	db *gorm.DB
}

// NewProdukRepository membuat repository baru.
func NewProdukRepository(db *gorm.DB) *ProdukRepository {
	return &ProdukRepository{db: db}
}

// openPublicTx membuka transaksi dengan app.current_tenant dikosongkan secara
// eksplisit, sehingga policy RLS produk_tenant lolos untuk membaca katalog publik.
func (r *ProdukRepository) openPublicTx(ctx context.Context) (*gorm.DB, error) {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, apperr.Internal("gagal membuka transaksi publik").WithCause(tx.Error)
	}
	if err := tx.Exec("SELECT set_config('app.current_tenant', '', true)").Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal set konteks publik").WithCause(err)
	}
	return tx, nil
}

// FindAll mengambil produk. Jika publik=true, query lintas tenant (katalog) dan
// hanya menampilkan produk aktif. Jika publik=false, gunakan RLS tenant (admin).
func (r *ProdukRepository) FindAll(ctx context.Context, publik bool) ([]*domain.Produk, error) {
	var tx *gorm.DB
	var err error
	if publik {
		tx, err = r.openPublicTx(ctx)
	} else {
		tx, err = sharedmw.OpenTenantTx(ctx, r.db)
	}
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	q := tx.Where("deleted_at IS NULL")
	if publik {
		q = q.Where("aktif = ?", true)
	}

	var models []ProdukModel
	if err := q.Order("created_at DESC").Find(&models).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil produk").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query produk").WithCause(err)
	}
	out := make([]*domain.Produk, 0, len(models))
	for i := range models {
		out = append(out, produkToDomain(&models[i]))
	}
	return out, nil
}

// FindBySlug mengambil satu produk aktif via slug (endpoint publik, lintas tenant).
func (r *ProdukRepository) FindBySlug(ctx context.Context, slug string) (*domain.Produk, error) {
	tx, err := r.openPublicTx(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m ProdukModel
	if err := tx.Where("slug = ? AND deleted_at IS NULL", slug).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("produk tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil produk").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query produk").WithCause(err)
	}
	return produkToDomain(&m), nil
}

// FindByIDPublic mengambil satu produk via ID lintas tenant (konteks publik),
// dipakai saat validasi order dari pembeli luar (tanpa identity HTTP).
func (r *ProdukRepository) FindByIDPublic(ctx context.Context, id uuid.UUID) (*domain.Produk, error) {
	tx, err := r.openPublicTx(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m ProdukModel
	if err := tx.Where("id = ? AND deleted_at IS NULL", id).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("produk tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil produk").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query produk").WithCause(err)
	}
	return produkToDomain(&m), nil
}

// SlugExists mengecek apakah slug sudah dipakai produk aktif (lintas tenant).
func (r *ProdukRepository) SlugExists(ctx context.Context, slug string) (bool, error) {
	tx, err := r.openPublicTx(ctx)
	if err != nil {
		return false, err
	}
	defer rollbackOnPanic(tx)

	var count int64
	if err := tx.Model(&ProdukModel{}).
		Where("slug = ? AND deleted_at IS NULL", slug).
		Count(&count).Error; err != nil {
		tx.Rollback()
		return false, apperr.Internal("gagal cek slug").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return false, apperr.Internal("gagal commit cek slug").WithCause(err)
	}
	return count > 0, nil
}

// Create menyimpan produk baru milik koperasi pemanggil (RLS tenant).
func (r *ProdukRepository) Create(ctx context.Context, p *domain.Produk) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	m := domainToProdukModel(p)
	if err := tx.Create(m).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat produk").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit produk").WithCause(err)
	}
	p.CreatedAt = m.CreatedAt
	p.UpdatedAt = m.UpdatedAt
	return nil
}

// FindByID mengambil produk milik koperasi pemanggil (RLS tenant).
func (r *ProdukRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Produk, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var m ProdukModel
	if err := tx.Where("id = ? AND deleted_at IS NULL", id).First(&m).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("produk tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil produk").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query produk").WithCause(err)
	}
	return produkToDomain(&m), nil
}

// Update memperbarui produk milik koperasi pemanggil (RLS tenant).
func (r *ProdukRepository) Update(ctx context.Context, p *domain.Produk) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	res := tx.Model(&ProdukModel{}).
		Where("id = ? AND deleted_at IS NULL", p.ID).
		Updates(map[string]any{
			"nama":       p.Nama,
			"deskripsi":  p.Deskripsi,
			"harga":      p.Harga,
			"stok":       p.Stok,
			"kategori":   p.Kategori,
			"foto_url":   p.FotoURL,
			"aktif":      p.Aktif,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal memperbarui produk").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("produk tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit update produk").WithCause(err)
	}
	return nil
}

// SoftDelete menandai produk terhapus (set deleted_at) milik koperasi pemanggil.
func (r *ProdukRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	now := time.Now()
	res := tx.Model(&ProdukModel{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]any{"deleted_at": now, "aktif": false, "updated_at": now})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal menghapus produk").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("produk tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit hapus produk").WithCause(err)
	}
	return nil
}

// DecrStok mengurangi stok produk dalam transaksi yang sudah men-set tenant.
// Mengembalikan error bila stok tidak mencukupi (guard atomik via WHERE stok>=qty).
func DecrStok(tx *gorm.DB, produkID uuid.UUID, qty int) error {
	res := tx.Model(&ProdukModel{}).
		Where("id = ? AND deleted_at IS NULL AND stok >= ?", produkID, qty).
		Updates(map[string]any{
			"stok":       gorm.Expr("stok - ?", qty),
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return apperr.Internal("gagal mengurangi stok").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		return apperr.Conflict("stok produk tidak mencukupi")
	}
	return nil
}

func produkToDomain(m *ProdukModel) *domain.Produk {
	return &domain.Produk{
		ID:         m.ID,
		KoperasiID: m.KoperasiID,
		Slug:       m.Slug,
		Nama:       m.Nama,
		Deskripsi:  m.Deskripsi,
		Harga:      m.Harga,
		Stok:       m.Stok,
		Kategori:   m.Kategori,
		FotoURL:    m.FotoURL,
		Aktif:      m.Aktif,
		CreatedAt:  m.CreatedAt,
		UpdatedAt:  m.UpdatedAt,
	}
}

func domainToProdukModel(p *domain.Produk) *ProdukModel {
	return &ProdukModel{
		ID:         p.ID,
		KoperasiID: p.KoperasiID,
		Slug:       p.Slug,
		Nama:       p.Nama,
		Deskripsi:  p.Deskripsi,
		Harga:      p.Harga,
		Stok:       p.Stok,
		Kategori:   p.Kategori,
		FotoURL:    p.FotoURL,
		Aktif:      p.Aktif,
	}
}

// rollbackOnPanic adalah helper defer untuk rollback transaksi saat panic.
func rollbackOnPanic(tx *gorm.DB) {
	if p := recover(); p != nil {
		tx.Rollback()
		panic(p)
	}
}
