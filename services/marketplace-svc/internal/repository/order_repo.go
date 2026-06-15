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

// OrderModel adalah representasi tabel orders untuk GORM.
type OrderModel struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	KoperasiID   uuid.UUID `gorm:"type:uuid;not null;column:koperasi_id"`
	PembeliNama  string    `gorm:"size:200;not null;column:pembeli_nama"`
	PembeliEmail string    `gorm:"size:200;column:pembeli_email"`
	Total        float64   `gorm:"type:numeric(15,2);not null"`
	Status       string    `gorm:"size:30;not null;default:pending"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// TableName memetakan model ke tabel orders.
func (OrderModel) TableName() string { return "orders" }

// OrderItemModel adalah representasi tabel order_item untuk GORM.
type OrderItemModel struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey"`
	OrderID  uuid.UUID `gorm:"type:uuid;not null;column:order_id"`
	ProdukID uuid.UUID `gorm:"type:uuid;not null;column:produk_id"`
	Qty      int       `gorm:"not null"`
	Harga    float64   `gorm:"type:numeric(15,2);not null"`
}

// TableName memetakan model ke tabel order_item.
func (OrderItemModel) TableName() string { return "order_item" }

// OrderRepository menyediakan operasi data order.
type OrderRepository struct {
	db *gorm.DB
}

// NewOrderRepository membuat repository baru.
func NewOrderRepository(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

// Create menyimpan order + item dalam satu transaksi atomik dan mengurangi stok
// tiap produk. Order datang dari pembeli publik (tanpa konteks tenant HTTP),
// sehingga tenant di-set manual dari o.KoperasiID agar RLS lolos.
//
// Jika stok salah satu produk tidak cukup, seluruh transaksi di-rollback.
func (r *OrderRepository) Create(ctx context.Context, o *domain.Order) error {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return apperr.Internal("gagal membuka transaksi order").WithCause(tx.Error)
	}
	defer rollbackOnPanic(tx)

	// Set tenant dari koperasi pemilik order (RLS untuk orders/order_item/produk).
	if err := tx.Exec("SELECT set_config('app.current_tenant', ?, true)", o.KoperasiID.String()).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal set tenant order").WithCause(err)
	}

	om := &OrderModel{
		ID:           o.ID,
		KoperasiID:   o.KoperasiID,
		PembeliNama:  o.PembeliNama,
		PembeliEmail: o.PembeliEmail,
		Total:        o.Total,
		Status:       o.Status,
	}
	if err := tx.Create(om).Error; err != nil {
		tx.Rollback()
		return apperr.Internal("gagal membuat order").WithCause(err)
	}

	for i := range o.Items {
		it := &o.Items[i]
		// Kurangi stok atomik; gagal jika tidak cukup.
		if err := DecrStok(tx, it.ProdukID, it.Qty); err != nil {
			tx.Rollback()
			return err
		}
		im := &OrderItemModel{
			ID:       it.ID,
			OrderID:  o.ID,
			ProdukID: it.ProdukID,
			Qty:      it.Qty,
			Harga:    it.Harga,
		}
		if err := tx.Create(im).Error; err != nil {
			tx.Rollback()
			return apperr.Internal("gagal membuat item order").WithCause(err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit order").WithCause(err)
	}
	o.CreatedAt = om.CreatedAt
	o.UpdatedAt = om.UpdatedAt
	return nil
}

// FindAll mengambil semua order koperasi pemanggil beserta itemnya (RLS tenant).
func (r *OrderRepository) FindAll(ctx context.Context) ([]*domain.Order, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var orders []OrderModel
	if err := tx.Order("created_at DESC").Find(&orders).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil order").WithCause(err)
	}

	out := make([]*domain.Order, 0, len(orders))
	for i := range orders {
		var items []OrderItemModel
		if err := tx.Where("order_id = ?", orders[i].ID).Find(&items).Error; err != nil {
			tx.Rollback()
			return nil, apperr.Internal("gagal mengambil item order").WithCause(err)
		}
		out = append(out, orderToDomain(&orders[i], items))
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query order").WithCause(err)
	}
	return out, nil
}

// FindByID mengambil satu order beserta itemnya (RLS tenant).
func (r *OrderRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return nil, err
	}
	defer rollbackOnPanic(tx)

	var om OrderModel
	if err := tx.Where("id = ?", id).First(&om).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("order tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil order").WithCause(err)
	}
	var items []OrderItemModel
	if err := tx.Where("order_id = ?", id).Find(&items).Error; err != nil {
		tx.Rollback()
		return nil, apperr.Internal("gagal mengambil item order").WithCause(err)
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperr.Internal("gagal commit query order").WithCause(err)
	}
	return orderToDomain(&om, items), nil
}

// UpdateStatus mengubah status order milik koperasi pemanggil (RLS tenant).
func (r *OrderRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	tx, err := sharedmw.OpenTenantTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer rollbackOnPanic(tx)

	res := tx.Model(&OrderModel{}).
		Where("id = ?", id).
		Updates(map[string]any{"status": status, "updated_at": time.Now()})
	if res.Error != nil {
		tx.Rollback()
		return apperr.Internal("gagal memperbarui status order").WithCause(res.Error)
	}
	if res.RowsAffected == 0 {
		tx.Rollback()
		return apperr.NotFound("order tidak ditemukan")
	}
	if err := tx.Commit().Error; err != nil {
		return apperr.Internal("gagal commit status order").WithCause(err)
	}
	return nil
}

func orderToDomain(m *OrderModel, items []OrderItemModel) *domain.Order {
	out := &domain.Order{
		ID:           m.ID,
		KoperasiID:   m.KoperasiID,
		PembeliNama:  m.PembeliNama,
		PembeliEmail: m.PembeliEmail,
		Total:        m.Total,
		Status:       m.Status,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
	out.Items = make([]domain.OrderItem, 0, len(items))
	for i := range items {
		out.Items = append(out.Items, domain.OrderItem{
			ID:       items[i].ID,
			OrderID:  items[i].OrderID,
			ProdukID: items[i].ProdukID,
			Qty:      items[i].Qty,
			Harga:    items[i].Harga,
		})
	}
	return out
}
