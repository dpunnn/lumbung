// Package consumer berisi konsumen event RabbitMQ untuk inventori-svc.
//
// inventori-svc berlangganan event intake.recorded (dari pass-svc atau dari
// dirinya sendiri di gelombang ini) dan menambah stok komoditas secara idempoten.
package consumer

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"

	"github.com/lumbung/shared/events"
	"github.com/lumbung/inventori-svc/internal/repository"
)

// consumerName dipakai untuk audit di tabel processed_events.
const consumerName = "inventori-svc.intake"

// IntakeRecordedPayload adalah bentuk payload event intake.recorded.
type IntakeRecordedPayload struct {
	BatchID    string  `json:"batch_id"`
	KoperasiID string  `json:"koperasi_id"`
	Komoditas  string  `json:"komoditas"`
	Jumlah     float64 `json:"jumlah"`
	Mutu       string  `json:"mutu"`
	Skor       float64 `json:"skor"`
}

// EventPublisher abstraksi penerbit event (untuk publish stok.changed).
type EventPublisher interface {
	Publish(ctx context.Context, tenantID, eventType string, payload any) error
}

// IntakeConsumer mengonsumsi intake.recorded dan memutakhirkan stok.
type IntakeConsumer struct {
	consumer   *events.Consumer
	intakeRepo *repository.IntakeRepository
	pub        EventPublisher
}

// NewIntakeConsumer membuat consumer baru.
func NewIntakeConsumer(consumer *events.Consumer, intakeRepo *repository.IntakeRepository, pub EventPublisher) *IntakeConsumer {
	return &IntakeConsumer{consumer: consumer, intakeRepo: intakeRepo, pub: pub}
}

// Start berlangganan routing key "intake.recorded" dan memproses setiap event.
// Pemanggilan ini blocking (consumer.Run di dalam Subscribe), jadi panggil di goroutine.
func (c *IntakeConsumer) Start() error {
	return c.consumer.Subscribe([]string{"intake.recorded"}, c.handle)
}

// handle memproses satu event intake.recorded.
//
// Mengembalikan error -> pesan dialihkan ke DLX (Nack tanpa requeue).
// Mengembalikan nil  -> Ack.
func (c *IntakeConsumer) handle(ctx context.Context, env events.Envelope) error {
	var payload IntakeRecordedPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		// Payload rusak: log lalu Ack-discard (return nil agar tidak loop).
		slog.Error("intake.recorded payload tidak valid", "event_id", env.EventID, "err", err)
		return nil
	}

	koperasiID, err := uuid.Parse(payload.KoperasiID)
	if err != nil {
		slog.Error("intake.recorded koperasi_id tidak valid", "event_id", env.EventID, "koperasi_id", payload.KoperasiID)
		return nil
	}

	var batchID *uuid.UUID
	if payload.BatchID != "" {
		if bid, err := uuid.Parse(payload.BatchID); err == nil {
			batchID = &bid
		}
	}

	already, err := c.intakeRepo.ProcessIntakeEvent(
		ctx,
		env.EventID,
		consumerName,
		batchID,
		koperasiID,
		payload.Komoditas,
		payload.Mutu,
		payload.Jumlah,
		payload.Skor,
	)
	if err != nil {
		// Gagal proses (DB error). Return error -> alihkan ke DLX untuk inspeksi.
		slog.Error("gagal memproses intake.recorded", "event_id", env.EventID, "err", err)
		return err
	}
	if already {
		slog.Info("intake.recorded sudah diproses (idempotent skip)", "event_id", env.EventID)
		return nil
	}

	// Publish stok.changed sebagai notifikasi perubahan stok.
	if c.pub != nil {
		if err := c.pub.Publish(ctx, payload.KoperasiID, "stok.changed", map[string]any{
			"koperasi_id": payload.KoperasiID,
			"sumber":      "intake",
			"batch_id":    payload.BatchID,
			"komoditas":   payload.Komoditas,
			"jumlah":      payload.Jumlah,
		}); err != nil {
			slog.Warn("gagal publish stok.changed", "event_id", env.EventID, "err", err)
		}
	}

	slog.Info("intake.recorded diproses", "event_id", env.EventID, "komoditas", payload.Komoditas, "jumlah", payload.Jumlah)
	return nil
}
