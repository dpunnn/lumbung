package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/lumbung/notif-svc/internal/domain"
	"github.com/lumbung/notif-svc/internal/repository"
)

type NotifService struct {
	repo *repository.NotifRepository
}

func NewNotifService(repo *repository.NotifRepository) *NotifService {
	return &NotifService{repo: repo}
}

func (s *NotifService) Create(ctx context.Context, n *domain.Notifikasi) error {
	return s.repo.Create(ctx, n)
}

func (s *NotifService) List(ctx context.Context) ([]*domain.Notifikasi, error) {
	return s.repo.FindAll(ctx)
}

func (s *NotifService) TandaiDibaca(ctx context.Context, id uuid.UUID) error {
	return s.repo.TandaiDibaca(ctx, id)
}
