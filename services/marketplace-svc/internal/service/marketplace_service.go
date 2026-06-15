// Package service berisi logika bisnis marketplace-svc.
package service

import (
	"context"
	"log/slog"
	"regexp"
	"strings"

	"github.com/google/uuid"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/marketplace-svc/internal/domain"
	"github.com/lumbung/marketplace-svc/internal/repository"
)

// EventPublisher adalah abstraksi penerbit event (shared/events.Publisher).
type EventPublisher interface {
	Publish(ctx context.Context, tenantID, eventType string, payload any) error
}

var nonAlphaNum = regexp.MustCompile(`[^a-z0-9-]`)

// toSlug mengubah nama produk menjadi slug URL-safe.
func toSlug(nama string) string {
	s := strings.ToLower(strings.TrimSpace(nama))
	s = strings.ReplaceAll(s, " ", "-")
	s = nonAlphaNum.ReplaceAllString(s, "")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return strings.Trim(s, "-")
}

// CreateProdukInput masukan pembuatan produk.
type CreateProdukInput struct {
	Nama      string
	Deskripsi string
	Harga     float64
	Stok      int
	Kategori  string
	FotoURL   string
}

// UpdateProdukInput masukan pembaruan produk (field opsional via pointer).
type UpdateProdukInput struct {
	Nama      *string
	Deskripsi *string
	Harga     *float64
	Stok      *int
	Kategori  *string
	FotoURL   *string
	Aktif     *bool
}

// BuatOrderItemInput satu baris item dalam permintaan order.
type BuatOrderItemInput struct {
	ProdukID uuid.UUID
	Qty      int
}

// BuatOrderInput masukan pembuatan order dari pembeli publik.
type BuatOrderInput struct {
	KoperasiID   uuid.UUID
	PembeliNama  string
	PembeliEmail string
	Items        []BuatOrderItemInput
}

// MarketplaceService mengkoordinasi produk, order, dan publikasi event.
type MarketplaceService struct {
	produkRepo *repository.ProdukRepository
	orderRepo  *repository.OrderRepository
	pub        EventPublisher
}

// NewMarketplaceService membuat service baru.
func NewMarketplaceService(
	produkRepo *repository.ProdukRepository,
	orderRepo *repository.OrderRepository,
	pub EventPublisher,
) *MarketplaceService {
	return &MarketplaceService{produkRepo: produkRepo, orderRepo: orderRepo, pub: pub}
}

// ListProduk mengembalikan katalog produk (publik) atau produk koperasi (admin).
func (s *MarketplaceService) ListProduk(ctx context.Context, publik bool) ([]*domain.Produk, error) {
	return s.produkRepo.FindAll(ctx, publik)
}

// GetProdukBySlug mengambil satu produk via slug (publik).
func (s *MarketplaceService) GetProdukBySlug(ctx context.Context, slug string) (*domain.Produk, error) {
	if strings.TrimSpace(slug) == "" {
		return nil, apperr.BadRequest("slug wajib diisi")
	}
	return s.produkRepo.FindBySlug(ctx, slug)
}

// CreateProduk membuat produk baru milik koperasi pemanggil, dengan slug unik.
func (s *MarketplaceService) CreateProduk(ctx context.Context, in CreateProdukInput) (*domain.Produk, error) {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.TenantID == "" {
		return nil, apperr.TenantMissing()
	}
	koperasiID, err := uuid.Parse(id.TenantID)
	if err != nil {
		return nil, apperr.BadRequest("tenant_id bukan UUID valid")
	}
	if strings.TrimSpace(in.Nama) == "" {
		return nil, apperr.BadRequest("nama produk wajib diisi")
	}
	if in.Harga < 0 {
		return nil, apperr.BadRequest("harga tidak boleh negatif")
	}
	if in.Stok < 0 {
		return nil, apperr.BadRequest("stok tidak boleh negatif")
	}
	kategori := in.Kategori
	if kategori == "" {
		kategori = domain.KategoriTernak
	}
	if !domain.KategoriValid(kategori) {
		return nil, apperr.BadRequest("kategori tidak valid")
	}

	slug, err := s.uniqueSlug(ctx, in.Nama)
	if err != nil {
		return nil, err
	}

	p := &domain.Produk{
		ID:         uuid.New(),
		KoperasiID: koperasiID,
		Slug:       slug,
		Nama:       in.Nama,
		Deskripsi:  in.Deskripsi,
		Harga:      in.Harga,
		Stok:       in.Stok,
		Kategori:   kategori,
		FotoURL:    in.FotoURL,
		Aktif:      true,
	}
	if err := s.produkRepo.Create(ctx, p); err != nil {
		return nil, err
	}
	s.publishProdukChanged(ctx, koperasiID, p.ID, "created")
	return p, nil
}

// uniqueSlug menghasilkan slug dari nama, menambah suffix pendek bila bentrok.
func (s *MarketplaceService) uniqueSlug(ctx context.Context, nama string) (string, error) {
	base := toSlug(nama)
	if base == "" {
		base = "produk"
	}
	exists, err := s.produkRepo.SlugExists(ctx, base)
	if err != nil {
		return "", err
	}
	if !exists {
		return base, nil
	}
	suffix := strings.Split(uuid.NewString(), "-")[0] // 8 hex chars
	return base + "-" + suffix, nil
}

// UpdateProduk memperbarui produk milik koperasi pemanggil.
func (s *MarketplaceService) UpdateProduk(ctx context.Context, id uuid.UUID, in UpdateProdukInput) (*domain.Produk, error) {
	p, err := s.produkRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Nama != nil {
		if strings.TrimSpace(*in.Nama) == "" {
			return nil, apperr.BadRequest("nama produk tidak boleh kosong")
		}
		p.Nama = *in.Nama
	}
	if in.Deskripsi != nil {
		p.Deskripsi = *in.Deskripsi
	}
	if in.Harga != nil {
		if *in.Harga < 0 {
			return nil, apperr.BadRequest("harga tidak boleh negatif")
		}
		p.Harga = *in.Harga
	}
	if in.Stok != nil {
		if *in.Stok < 0 {
			return nil, apperr.BadRequest("stok tidak boleh negatif")
		}
		p.Stok = *in.Stok
	}
	if in.Kategori != nil {
		if !domain.KategoriValid(*in.Kategori) {
			return nil, apperr.BadRequest("kategori tidak valid")
		}
		p.Kategori = *in.Kategori
	}
	if in.FotoURL != nil {
		p.FotoURL = *in.FotoURL
	}
	if in.Aktif != nil {
		p.Aktif = *in.Aktif
	}
	if err := s.produkRepo.Update(ctx, p); err != nil {
		return nil, err
	}
	s.publishProdukChanged(ctx, p.KoperasiID, p.ID, "updated")
	return p, nil
}

// DeleteProduk menghapus (soft) produk milik koperasi pemanggil.
func (s *MarketplaceService) DeleteProduk(ctx context.Context, id uuid.UUID) error {
	p, err := s.produkRepo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.produkRepo.SoftDelete(ctx, id); err != nil {
		return err
	}
	s.publishProdukChanged(ctx, p.KoperasiID, p.ID, "deleted")
	return nil
}

// BuatOrder memvalidasi stok, membuat order + item, mengurangi stok, lalu
// menerbitkan event produk.changed. Order datang dari pembeli publik.
func (s *MarketplaceService) BuatOrder(ctx context.Context, in BuatOrderInput) (*domain.Order, error) {
	if in.KoperasiID == uuid.Nil {
		return nil, apperr.BadRequest("koperasi_id wajib diisi")
	}
	if strings.TrimSpace(in.PembeliNama) == "" {
		return nil, apperr.BadRequest("nama pembeli wajib diisi")
	}
	if len(in.Items) == 0 {
		return nil, apperr.BadRequest("order harus memiliki minimal satu item")
	}

	// Ambil snapshot harga & validasi setiap produk milik koperasi yang sama.
	order := &domain.Order{
		ID:           uuid.New(),
		KoperasiID:   in.KoperasiID,
		PembeliNama:  in.PembeliNama,
		PembeliEmail: in.PembeliEmail,
		Status:       domain.StatusPending,
	}
	var total float64
	for _, item := range in.Items {
		if item.Qty <= 0 {
			return nil, apperr.BadRequest("qty harus lebih dari 0")
		}
		p, err := s.produkRepo.FindByIDPublic(ctx, item.ProdukID)
		if err != nil {
			return nil, err
		}
		if p.KoperasiID != in.KoperasiID {
			return nil, apperr.BadRequest("semua produk harus dari koperasi yang sama")
		}
		if !p.Aktif {
			return nil, apperr.Conflict("produk " + p.Nama + " tidak aktif")
		}
		if p.Stok < item.Qty {
			return nil, apperr.Conflict("stok produk " + p.Nama + " tidak mencukupi")
		}
		harga := p.Harga
		total += harga * float64(item.Qty)
		order.Items = append(order.Items, domain.OrderItem{
			ID:       uuid.New(),
			OrderID:  order.ID,
			ProdukID: p.ID,
			Qty:      item.Qty,
			Harga:    harga,
		})
	}
	order.Total = total

	if err := s.orderRepo.Create(ctx, order); err != nil {
		return nil, err
	}
	s.publishProdukChanged(ctx, in.KoperasiID, order.ID, "order")
	return order, nil
}

// ListOrder mengembalikan order koperasi pemanggil.
func (s *MarketplaceService) ListOrder(ctx context.Context) ([]*domain.Order, error) {
	return s.orderRepo.FindAll(ctx)
}

// UpdateStatusOrder mengubah status sebuah order milik koperasi pemanggil.
func (s *MarketplaceService) UpdateStatusOrder(ctx context.Context, id uuid.UUID, status string) error {
	if !domain.StatusOrderValid(status) {
		return apperr.BadRequest("status order tidak valid")
	}
	return s.orderRepo.UpdateStatus(ctx, id, status)
}

// publishProdukChanged menerbitkan event produk.changed (best-effort).
func (s *MarketplaceService) publishProdukChanged(ctx context.Context, koperasiID, recordID uuid.UUID, aksi string) {
	if s.pub == nil {
		return
	}
	payload := map[string]any{
		"produk_id":   recordID.String(),
		"koperasi_id": koperasiID.String(),
		"aksi":        aksi,
	}
	if err := s.pub.Publish(ctx, koperasiID.String(), "produk.changed", payload); err != nil {
		slog.Warn("marketplace-svc: gagal publish produk.changed", "err", err)
	}
}
