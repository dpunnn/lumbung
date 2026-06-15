// Package domain berisi model domain auth-svc, bebas dari detail GORM/DB.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// User adalah representasi domain pengguna. GORM model terpisah di repository.
type User struct {
	ID           uuid.UUID
	KoperasiID   uuid.UUID // uuid.Nil bila super_admin (lintas tenant)
	Username     string
	Email        string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
