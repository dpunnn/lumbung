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

type TernakModel struct {
	ID                  uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	KoperasiID          uuid.UUID  `gorm:"type:uuid;not null"`
	Kode                string     `gorm:"size:50;not null"`
	Jenis               string     `gorm:"size:100;not null"`
	UmurBulan           *int
	Status              string     `gorm:"size:20;not null;default:sehat"`
	VaksinTerakhir      *time.Time
	NilaiEstimasi       int64      `gorm:"default:0"`
	FotoURL             *string
	JumlahKlaim         int        `gorm:"default:1"`
	JumlahTerverifikasi int        `gorm:"default:0"`
	Terverifikasi       bool       `gorm:"default:false"`
	TanggalMati         *time.Time
	DicatatMatiOleh     *uuid.UUID `gorm:"type:uuid"`
	CreatedAt           time.Time
}

func (TernakModel) TableName() string { return "ternak" }

type TernakRepository struct{ db *gorm.DB }

func NewTernakRepository(db *gorm.DB) *TernakRepository { return &TernakRepository{db: db} }

func (r *TernakRepository) tenantDB(ctx context.Context) (*gorm.DB, error) {
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

func (r *TernakRepository) FindAll(ctx context.Context) ([]*domain.Ternak, error) {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	var rows []TernakModel
	if err := q.Order("created_at desc").Find(&rows).Error; err != nil {
		return nil, apperr.Internal("gagal mengambil data ternak").WithCause(err)
	}
	out := make([]*domain.Ternak, len(rows))
	for i, m := range rows {
		out[i] = toDomainTernak(&m)
	}
	return out, nil
}

func (r *TernakRepository) FindByID(ctx context.Context, id uuid.UUID) (*domain.Ternak, error) {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return nil, err
	}
	var m TernakModel
	if err := q.Where("id = ?", id).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("ternak tidak ditemukan")
		}
		return nil, apperr.Internal("gagal mengambil ternak").WithCause(err)
	}
	return toDomainTernak(&m), nil
}

func (r *TernakRepository) Create(ctx context.Context, t *domain.Ternak) error {
	id, ok := sharedauth.FromContext(ctx)
	if !ok || id.TenantID == "" {
		return apperr.TenantMissing()
	}
	kid, _ := uuid.Parse(id.TenantID)
	t.KoperasiID = kid
	m := toModelTernak(t)
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return apperr.Internal("gagal menyimpan ternak").WithCause(err)
	}
	t.ID = m.ID
	t.CreatedAt = m.CreatedAt
	return nil
}

func (r *TernakRepository) Update(ctx context.Context, t *domain.Ternak) error {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return err
	}
	m := toModelTernak(t)
	if err := q.Where("id = ?", t.ID).Save(m).Error; err != nil {
		return apperr.Internal("gagal mengupdate ternak").WithCause(err)
	}
	return nil
}

func (r *TernakRepository) Delete(ctx context.Context, id uuid.UUID) error {
	q, err := r.tenantDB(ctx)
	if err != nil {
		return err
	}
	if err := q.Where("id = ?", id).Delete(&TernakModel{}).Error; err != nil {
		return apperr.Internal("gagal menghapus ternak").WithCause(err)
	}
	return nil
}

func toDomainTernak(m *TernakModel) *domain.Ternak {
	return &domain.Ternak{
		ID: m.ID, KoperasiID: m.KoperasiID, Kode: m.Kode, Jenis: m.Jenis,
		UmurBulan: m.UmurBulan, Status: m.Status, VaksinTerakhir: m.VaksinTerakhir,
		NilaiEstimasi: m.NilaiEstimasi, FotoURL: m.FotoURL,
		JumlahKlaim: m.JumlahKlaim, JumlahTerverifikasi: m.JumlahTerverifikasi,
		Terverifikasi: m.Terverifikasi, TanggalMati: m.TanggalMati,
		DicatatMatiOleh: m.DicatatMatiOleh, CreatedAt: m.CreatedAt,
	}
}

func toModelTernak(t *domain.Ternak) *TernakModel {
	return &TernakModel{
		ID: t.ID, KoperasiID: t.KoperasiID, Kode: t.Kode, Jenis: t.Jenis,
		UmurBulan: t.UmurBulan, Status: t.Status, VaksinTerakhir: t.VaksinTerakhir,
		NilaiEstimasi: t.NilaiEstimasi, FotoURL: t.FotoURL,
		JumlahKlaim: t.JumlahKlaim, JumlahTerverifikasi: t.JumlahTerverifikasi,
		Terverifikasi: t.Terverifikasi, TanggalMati: t.TanggalMati,
		DicatatMatiOleh: t.DicatatMatiOleh,
	}
}
