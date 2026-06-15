// Package domain berisi entitas inti guard-svc: AuditLog (jejak audit
// event-sourced) dan Anomaly (deteksi pola kecurangan).
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Jenis aksi yang dicatat audit.
const (
	AksiCreated = "created"
	AksiUpdated = "updated"
	AksiDeleted = "deleted"
)

// AuditLog adalah satu baris jejak audit yang berasal dari event domain.
// FieldDiff menyimpan before/after (jsonb) bila tersedia.
type AuditLog struct {
	ID         uuid.UUID
	KoperasiID uuid.UUID
	Aksi       string         // created|updated|deleted
	Tabel      string         // simpanan|pinjaman|intake|dll
	RecordID   uuid.UUID
	FieldDiff  map[string]any // {before: {...}, after: {...}}
	ActorID    *uuid.UUID
	CreatedAt  time.Time
}
