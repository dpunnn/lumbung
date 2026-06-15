// Package consumer mengonsumsi event domain LUMBUNG dari RabbitMQ dan
// menerjemahkannya menjadi notifikasi per-tenant, lalu menyiarkannya ke hub SSE.
package consumer

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	rabbitmq "github.com/wagslane/go-rabbitmq"
	"gorm.io/gorm"

	"github.com/lumbung/notif-svc/internal/domain"
	"github.com/lumbung/notif-svc/internal/hub"
	"github.com/lumbung/notif-svc/internal/repository"
	sharedevents "github.com/lumbung/shared/events"
)

const consumerName = "notif-svc"

// notifTemplate memetakan tipe event ke isi notifikasi.
type notifTemplate struct {
	Tipe  string
	Judul string
	Pesan string
}

// eventMap adalah tabel mapping event type -> template notifikasi.
var eventMap = map[string]notifTemplate{
	"intake.recorded":  {Tipe: domain.TipeIntake, Judul: "Setoran Diterima", Pesan: "Setoran komoditas baru diwakili Saksi AI"},
	"simpanan.created": {Tipe: domain.TipeSimpanan, Judul: "Simpanan Baru", Pesan: "Simpanan baru berhasil dicatat"},
	"pinjaman.created": {Tipe: domain.TipePinjaman, Judul: "Pengajuan Pinjaman", Pesan: "Pinjaman baru sedang diproses"},
	"angsuran.paid":    {Tipe: domain.TipePinjaman, Judul: "Angsuran Diterima", Pesan: "Pembayaran angsuran berhasil"},
	"stok.changed":     {Tipe: domain.TipeStok, Judul: "Stok Diperbarui", Pesan: "Perubahan stok komoditas koperasi"},
	"produk.changed":   {Tipe: domain.TipeProduk, Judul: "Produk Marketplace", Pesan: "Produk toko koperasi diperbarui"},
	"pass.issued":      {Tipe: domain.TipePass, Judul: "Pass Diterbitkan", Pesan: "Digital pass baru diterbitkan"},
	"pass.revoked":     {Tipe: domain.TipePass, Judul: "Pass Dicabut", Pesan: "Digital pass telah dicabut"},
}

// routingKeys adalah daftar event yang di-subscribe notif-svc.
var routingKeys = []string{
	"intake.recorded",
	"simpanan.created",
	"pinjaman.created",
	"angsuran.paid",
	"stok.changed",
	"produk.changed",
	"pass.issued",
	"pass.revoked",
}

// EventsConsumer mengonsumsi event bus dan membuat notifikasi.
type EventsConsumer struct {
	repo     *repository.NotifRepository
	consumer *rabbitmq.Consumer
	hub      *hub.Hub
}

// NewEventsConsumer membuat consumer RabbitMQ yang ter-bind ke exchange
// "lumbung.events" (topic) untuk seluruh routing key notif-svc.
func NewEventsConsumer(db *gorm.DB, rabbitURL string, h *hub.Hub) (*EventsConsumer, error) {
	ec := &EventsConsumer{
		repo: repository.NewNotifRepository(db),
		hub:  h,
	}

	conn, err := rabbitmq.NewConn(rabbitURL, rabbitmq.WithConnectionOptionsLogging)
	if err != nil {
		return nil, err
	}

	// wagslane/go-rabbitmq: handler adalah arg ke-2, queue ke-3.
	// Tidak ada .Run() — consumer langsung aktif saat dibuat.
	opts := []func(*rabbitmq.ConsumerOptions){
		rabbitmq.WithConsumerOptionsExchangeName(sharedevents.ExchangeEvents),
		rabbitmq.WithConsumerOptionsExchangeKind("topic"),
		rabbitmq.WithConsumerOptionsExchangeDurable,
		rabbitmq.WithConsumerOptionsExchangeDeclare,
		rabbitmq.WithConsumerOptionsQueueDurable,
	}
	for _, rk := range routingKeys {
		opts = append(opts, rabbitmq.WithConsumerOptionsRoutingKey(rk))
	}

	consumer, err := rabbitmq.NewConsumer(conn, ec.handle, "lumbung.notif-svc", opts...)
	if err != nil {
		conn.Close()
		return nil, err
	}

	ec.consumer = consumer
	return ec, nil
}

// Start adalah no-op — consumer sudah aktif sejak NewEventsConsumer.
// Dipertahankan agar cmd/main.go tidak perlu diubah.
func (c *EventsConsumer) Start() error {
	// Consumer wagslane sudah berjalan sejak dibuat (tidak perlu .Run()).
	// Block selamanya sampai Close() dipanggil — gunakan select{} di goroutine.
	select {}
}

// Close menghentikan consumer.
func (c *EventsConsumer) Close() {
	c.consumer.Close()
}

// handle memproses satu delivery: parse envelope, mapping ke notifikasi,
// simpan idempoten (processed_events), lalu broadcast ke hub.
//
// Semantik return:
//   - Ack         => sukses / event diabaikan / sudah pernah diproses (idempotent)
//   - NackDiscard => body rusak atau tipe tak dikenal (buang, jangan requeue/loop)
//   - NackRequeue => kegagalan transient (DB) — coba lagi nanti
func (c *EventsConsumer) handle(d rabbitmq.Delivery) rabbitmq.Action {
	var env sharedevents.Envelope
	if err := json.Unmarshal(d.Body, &env); err != nil {
		slog.Error("notif consumer: envelope rusak", "err", err)
		return rabbitmq.NackDiscard
	}

	tmpl, ok := eventMap[env.Type]
	if !ok {
		slog.Warn("notif consumer: tipe event tak dikenal", "type", env.Type)
		return rabbitmq.NackDiscard
	}

	koperasiID, err := uuid.Parse(env.TenantID)
	if err != nil {
		slog.Error("notif consumer: tenant_id bukan uuid valid", "tenant_id", env.TenantID, "err", err)
		return rabbitmq.NackDiscard
	}

	if env.EventID == "" {
		slog.Error("notif consumer: event_id kosong", "type", env.Type)
		return rabbitmq.NackDiscard
	}

	notif := &domain.Notifikasi{
		KoperasiID: koperasiID,
		UserID:     nil, // broadcast ke seluruh koperasi
		Tipe:       tmpl.Tipe,
		Judul:      tmpl.Judul,
		Pesan:      tmpl.Pesan,
		Dibaca:     false,
	}

	already, err := c.repo.CreateFromConsumer(context.Background(), env.EventID, consumerName, notif)
	if err != nil {
		slog.Error("notif consumer: gagal simpan notifikasi", "type", env.Type, "event_id", env.EventID, "err", err)
		return rabbitmq.NackRequeue
	}
	if already {
		// Sudah pernah diproses; jangan broadcast ganda.
		return rabbitmq.Ack
	}

	c.hub.Broadcast(env.TenantID, notif)
	slog.Info("notif consumer: notifikasi dibuat", "type", env.Type, "tenant", env.TenantID, "id", notif.ID)
	return rabbitmq.Ack
}
