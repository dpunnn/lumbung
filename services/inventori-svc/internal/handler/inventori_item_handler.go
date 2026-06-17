package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
	"github.com/lumbung/shared/httpx"
)

// InventoriItemModel adalah model GORM untuk tabel inventori_item.
type InventoriItemModel struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	KoperasiID   uuid.UUID  `gorm:"type:uuid;not null"`
	Nama         string     `gorm:"size:200;not null"`
	Kategori     string     `gorm:"size:50;not null;default:umum"`
	Stok         float64    `gorm:"type:numeric(15,2);default:0"`
	Satuan       string     `gorm:"size:20;not null;default:pcs"`
	HargaBeli    int64      `gorm:"default:0"`
	HargaJual    int64      `gorm:"default:0"`
	BatasMinimum float64    `gorm:"type:numeric(15,2);default:0"`
	Kadaluwarsa  *time.Time
	Lokasi       *string
	Keterangan   *string
	UpdatedAt    time.Time
}

func (InventoriItemModel) TableName() string { return "inventori_item" }

type itemResponse struct {
	ID           string  `json:"id"`
	KoperasiID   string  `json:"koperasi_id"`
	Nama         string  `json:"nama"`
	Kategori     string  `json:"kategori"`
	Stok         float64 `json:"stok"`
	Satuan       string  `json:"satuan"`
	HargaBeli    int64   `json:"harga_beli"`
	HargaJual    int64   `json:"harga_jual"`
	BatasMinimum float64 `json:"batas_minimum"`
	Kadaluwarsa  *string `json:"kadaluwarsa"`
	Lokasi       *string `json:"lokasi"`
	Keterangan   *string `json:"keterangan"`
	UpdatedAt    string  `json:"updated_at"`
}

type createItemRequest struct {
	KoperasiID   string  `json:"koperasi_id,omitempty"`
	Nama         string  `json:"nama"`
	Kategori     string  `json:"kategori"`
	Stok         float64 `json:"stok"`
	Satuan       string  `json:"satuan"`
	HargaBeli    int64   `json:"harga_beli"`
	HargaJual    int64   `json:"harga_jual"`
	BatasMinimum float64 `json:"batas_minimum"`
	Kadaluwarsa  *string `json:"kadaluwarsa"`
	Lokasi       *string `json:"lokasi"`
	Keterangan   *string `json:"keterangan"`
	UpdatedAt    string  `json:"updated_at,omitempty"`
}

type InventoriItemHandler struct{ db *gorm.DB }

func NewInventoriItemHandler(db *gorm.DB) *InventoriItemHandler {
	return &InventoriItemHandler{db: db}
}

func (h *InventoriItemHandler) tenantDB(ctx interface{ Value(key any) any }) (uuid.UUID, error) {
	return uuid.Nil, nil // placeholder — real logic below
}

func (h *InventoriItemHandler) getKid(r *http.Request) (uuid.UUID, error) {
	id, ok := sharedauth.FromContext(r.Context())
	if !ok || id.TenantID == "" {
		return uuid.Nil, apperr.TenantMissing()
	}
	return uuid.Parse(id.TenantID)
}

func (h *InventoriItemHandler) List(w http.ResponseWriter, r *http.Request) {
	kid, err := h.getKid(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	var rows []InventoriItemModel
	if err := h.db.WithContext(r.Context()).Where("koperasi_id = ?", kid).Order("nama asc").Find(&rows).Error; err != nil {
		httpx.WriteError(w, apperr.Internal("gagal mengambil inventori").WithCause(err))
		return
	}
	out := make([]itemResponse, len(rows))
	for i, m := range rows {
		out[i] = toItemResponse(&m)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *InventoriItemHandler) Create(w http.ResponseWriter, r *http.Request) {
	kid, err := h.getKid(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	var req createItemRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	if req.Nama == "" {
		httpx.WriteError(w, apperr.Validation("nama wajib diisi"))
		return
	}
	m := &InventoriItemModel{
		KoperasiID: kid, Nama: req.Nama, Kategori: req.Kategori,
		Stok: req.Stok, Satuan: req.Satuan, HargaBeli: req.HargaBeli,
		HargaJual: req.HargaJual, BatasMinimum: req.BatasMinimum,
		Lokasi: req.Lokasi, Keterangan: req.Keterangan, UpdatedAt: time.Now(),
	}
	if req.Kadaluwarsa != nil && *req.Kadaluwarsa != "" {
		if t, err := time.Parse("2006-01-02", *req.Kadaluwarsa); err == nil {
			m.Kadaluwarsa = &t
		}
	}
	if req.Kategori == "" {
		m.Kategori = "umum"
	}
	if req.Satuan == "" {
		m.Satuan = "pcs"
	}
	if err := h.db.WithContext(r.Context()).Create(m).Error; err != nil {
		httpx.WriteError(w, apperr.Internal("gagal menyimpan item").WithCause(err))
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toItemResponse(m))
}

func (h *InventoriItemHandler) Update(w http.ResponseWriter, r *http.Request) {
	kid, err := h.getKid(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id bukan UUID valid"))
		return
	}
	var req createItemRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, err)
		return
	}
	m := &InventoriItemModel{
		ID: id, KoperasiID: kid, Nama: req.Nama, Kategori: req.Kategori,
		Stok: req.Stok, Satuan: req.Satuan, HargaBeli: req.HargaBeli,
		HargaJual: req.HargaJual, BatasMinimum: req.BatasMinimum,
		Lokasi: req.Lokasi, Keterangan: req.Keterangan, UpdatedAt: time.Now(),
	}
	if req.Kadaluwarsa != nil && *req.Kadaluwarsa != "" {
		if t, err := time.Parse("2006-01-02", *req.Kadaluwarsa); err == nil {
			m.Kadaluwarsa = &t
		}
	}
	if err := h.db.WithContext(r.Context()).Where("id = ? AND koperasi_id = ?", id, kid).Save(m).Error; err != nil {
		httpx.WriteError(w, apperr.Internal("gagal mengupdate item").WithCause(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toItemResponse(m))
}

func (h *InventoriItemHandler) Delete(w http.ResponseWriter, r *http.Request) {
	kid, err := h.getKid(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, apperr.BadRequest("id bukan UUID valid"))
		return
	}
	if err := h.db.WithContext(r.Context()).Where("id = ? AND koperasi_id = ?", id, kid).Delete(&InventoriItemModel{}).Error; err != nil {
		httpx.WriteError(w, apperr.Internal("gagal menghapus item").WithCause(err))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func toItemResponse(m *InventoriItemModel) itemResponse {
	resp := itemResponse{
		ID: m.ID.String(), KoperasiID: m.KoperasiID.String(),
		Nama: m.Nama, Kategori: m.Kategori, Stok: m.Stok, Satuan: m.Satuan,
		HargaBeli: m.HargaBeli, HargaJual: m.HargaJual, BatasMinimum: m.BatasMinimum,
		Lokasi: m.Lokasi, Keterangan: m.Keterangan, UpdatedAt: m.UpdatedAt.Format(time.RFC3339),
	}
	if m.Kadaluwarsa != nil {
		s := m.Kadaluwarsa.Format("2006-01-02")
		resp.Kadaluwarsa = &s
	}
	return resp
}
