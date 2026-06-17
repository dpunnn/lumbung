package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/lumbung/inventori-svc/internal/domain"
	sharedauth "github.com/lumbung/shared/auth"
	apperr "github.com/lumbung/shared/errors"
)

type PakanModel struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	KoperasiID   uuid.UUID `gorm:"type:uuid;not null"`
	Nama         string    `gorm:"size:200;not null"`
	Stok         float64   `gorm:"type:numeric(15,2);default:0"`
	Satuan       string    `gorm:"size:20;not null;default:kg"`
	BatasMinimum float64   `gorm:"type:numeric(15,2);default:0"`
	UpdatedAt    time.Time
}

func (PakanModel) TableName() string { return "pakan" }

type PakanRepository struct{ db *gorm.DB }

func NewPakanRepository(db *gorm.DB) *PakanRepository { return &PakanRepository{db: db} }

func (r *PakanRepository) tenantDB(ctx context.Context) (*gorm.DB, error) {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.TenantID == "" {
		return nil, apperr.TenantMissing()
	}
	kid, err := uuid.Parse(id.TenantID)
	if err != nil {
		return nil, apperr.BadRequest("tenant_id bukan UUID valid")
	}
	return r.db.WithContext(ctx).Where("koperasi_id = ?", kid), nil
}

func (r *PakanRepository) FindAll(ctx context.Context) ([]*domain.Pakan, error) {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	var rows []PakanModel
	if err := q.Order("nama asc").Find(&rows).Error; err != nil {
		return nil, apperr.Internal("gagal mengambil data pakan").WithCause(err)
	}
	out := make([]*domain.Pakan, len(rows))
	for i, m := range rows {
		out[i] = toDomainPakan(&m)
	}
	return out, nil
}

func (r *PakanRepository) Create(ctx context.Context, p *domain.Pakan) error {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.TenantID == "" {
		return apperr.TenantMissing()
	}
	kid, _ := uuid.Parse(id.TenantID)
	p.KoperasiID = kid
	m := toModelPakan(p)
	m.UpdatedAt = time.Now()
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return apperr.Internal("gagal menyimpan pakan").WithCause(err)
	}
	p.ID = m.ID
	p.UpdatedAt = m.UpdatedAt
	return nil
}

func (r *PakanRepository) Update(ctx context.Context, p *domain.Pakan) error {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return err
	}
	p.UpdatedAt = time.Now()
	m := toModelPakan(p)
	if err := q.Where("id = ?", p.ID).Save(m).Error; err != nil {
		return apperr.Internal("gagal mengupdate pakan").WithCause(err)
	}
	return nil
}

func (r *PakanRepository) Delete(ctx context.Context, id uuid.UUID) error {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return err
	}
	if err := q.Where("id = ?", id).Delete(&PakanModel{}).Error; err != nil {
		return apperr.Internal("gagal menghapus pakan").WithCause(err)
	}
	return nil
}

func (r *PakanRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Pakan, error) {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	var m PakanModel
	if err := q.Where("id = ?", id).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("pakan tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil pakan").WithCause(err)
	}
	return toDomainPakan(&m), nil
}

func toDomainPakan(m *PakanModel) *domain.Pakan {
	return &domain.Pakan{
		ID: m.ID, KoperasiID: m.KoperasiID, Nama: m.Nama,
		Stok: m.Stok, Satuan: m.Satuan, BatasMinimum: m.BatasMinimum, UpdatedAt: m.UpdatedAt,
	}
}

func toModelPakan(p *domain.Pakan) *PakanModel {
	return &PakanModel{
		ID: p.ID, KoperasiID: p.KoperasiID, Nama: p.Nama,
		Stok: p.Stok, Satuan: p.Satuan, BatasMinimum: p.BatasMinimum, UpdatedAt: p.UpdatedAt,
	}
}
