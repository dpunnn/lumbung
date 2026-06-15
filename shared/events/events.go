// Package events menyediakan event bus LUMBUNG di atas RabbitMQ
// (wagslane/go-rabbitmq) dengan pola topic exchange + dead-letter.
//
// Arsitektur:
//
//	Producer --> exchange "lumbung.events" (topic) --routing key=eventType--> queue per service
//	queue "lumbung.<svc>"  --(reject/nack)--> exchange "lumbung.dlx" --> queue "lumbung.dead-letter"
//
// Setiap pesan dibungkus Envelope agar konsumen punya metadata seragam
// (event ID untuk idempotency, tenant ID untuk RLS, occurred_at untuk audit).
package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	rabbitmq "github.com/wagslane/go-rabbitmq"
)

// Nama topologi RabbitMQ.
const (
	ExchangeEvents     = "lumbung.events"   // topic exchange utama
	ExchangeDLX        = "lumbung.dlx"       // dead-letter exchange
	QueueDeadLetter    = "lumbung.dead-letter"
	dlxRoutingKey      = "dead"
)

// Envelope adalah amplop standar setiap event di bus.
type Envelope struct {
	EventID    string          `json:"event_id"`
	TenantID   string          `json:"tenant_id"`
	Type       string          `json:"type"`
	Payload    json.RawMessage `json:"payload"`
	OccurredAt time.Time       `json:"occurred_at"`
}

// Publisher membungkus rabbitmq.Publisher untuk menerbitkan event.
type Publisher struct {
	conn *rabbitmq.Conn
	pub  *rabbitmq.Publisher
}

// NewPublisher membuat koneksi + publisher ke exchange "lumbung.events".
// Publisher confirms diaktifkan agar Publish menunggu ack broker.
// DLX (lumbung.dlx + queue lumbung.dead-letter) di-deklarasikan di sisi consumer
// (queue dibuat consumer), namun exchange DLX dipastikan ada di sini juga.
func NewPublisher(url string) (*Publisher, error) {
	conn, err := rabbitmq.NewConn(url, rabbitmq.WithConnectionOptionsLogging)
	if err != nil {
		return nil, fmt.Errorf("events: gagal koneksi RabbitMQ: %w", err)
	}

	pub, err := rabbitmq.NewPublisher(
		conn,
		rabbitmq.WithPublisherOptionsExchangeName(ExchangeEvents),
		rabbitmq.WithPublisherOptionsExchangeKind("topic"),
		rabbitmq.WithPublisherOptionsExchangeDurable,
		rabbitmq.WithPublisherOptionsExchangeDeclare,
		rabbitmq.WithPublisherOptionsConfirm,
	)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("events: gagal membuat publisher: %w", err)
	}

	// Pastikan DLX exchange tercipta (publisher kedua, ringan, lalu ditutup).
	dlxPub, err := rabbitmq.NewPublisher(
		conn,
		rabbitmq.WithPublisherOptionsExchangeName(ExchangeDLX),
		rabbitmq.WithPublisherOptionsExchangeKind("topic"),
		rabbitmq.WithPublisherOptionsExchangeDurable,
		rabbitmq.WithPublisherOptionsExchangeDeclare,
	)
	if err != nil {
		pub.Close()
		conn.Close()
		return nil, fmt.Errorf("events: gagal membuat DLX exchange: %w", err)
	}
	dlxPub.Close()

	return &Publisher{conn: conn, pub: pub}, nil
}

// Publish membungkus payload ke Envelope dan menerbitkannya ke exchange utama
// dengan routing key = eventType. Menunggu konfirmasi broker (publisher confirms).
func (p *Publisher) Publish(ctx context.Context, tenantID, eventType string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("events: gagal marshal payload: %w", err)
	}
	env := Envelope{
		EventID:    uuid.NewString(),
		TenantID:   tenantID,
		Type:       eventType,
		Payload:    raw,
		OccurredAt: time.Now().UTC(),
	}
	body, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("events: gagal marshal envelope: %w", err)
	}

	return p.pub.PublishWithContext(
		ctx,
		body,
		[]string{eventType},
		rabbitmq.WithPublishOptionsExchange(ExchangeEvents),
		rabbitmq.WithPublishOptionsContentType("application/json"),
		rabbitmq.WithPublishOptionsPersistentDelivery,
		rabbitmq.WithPublishOptionsMessageID(env.EventID),
		rabbitmq.WithPublishOptionsTimestamp(env.OccurredAt),
	)
}

// Close menutup publisher dan koneksinya.
func (p *Publisher) Close() error {
	if p.pub != nil {
		p.pub.Close()
	}
	if p.conn != nil {
		return p.conn.Close()
	}
	return nil
}

// Consumer membungkus rabbitmq.Consumer untuk menerima event.
type Consumer struct {
	conn        *rabbitmq.Conn
	url         string
	serviceName string
	queueName   string
	consumer    *rabbitmq.Consumer
}

// NewConsumer membuat koneksi consumer untuk sebuah service. Queue diberi nama
// "lumbung.<serviceName>" dan di-bind ke exchange "lumbung.events" saat Subscribe.
// Queue dikonfigurasi dengan dead-letter ke exchange "lumbung.dlx".
func NewConsumer(url, serviceName string) (*Consumer, error) {
	conn, err := rabbitmq.NewConn(url, rabbitmq.WithConnectionOptionsLogging)
	if err != nil {
		return nil, fmt.Errorf("events: gagal koneksi RabbitMQ (consumer): %w", err)
	}

	// Pastikan DLX + dead-letter queue ada.
	if err := setupDLX(conn); err != nil {
		conn.Close()
		return nil, err
	}

	return &Consumer{
		conn:        conn,
		url:         url,
		serviceName: serviceName,
		queueName:   "lumbung." + serviceName,
	}, nil
}

// setupDLX mendeklarasikan dead-letter exchange + queue dan mem-bind-nya.
func setupDLX(conn *rabbitmq.Conn) error {
	// no-op handler — hanya deklarasikan topologi, tidak proses pesan.
	noop := func(d rabbitmq.Delivery) rabbitmq.Action { return rabbitmq.Ack }
	dlxConsumer, err := rabbitmq.NewConsumer(
		conn,
		noop,
		QueueDeadLetter,
		rabbitmq.WithConsumerOptionsExchangeName(ExchangeDLX),
		rabbitmq.WithConsumerOptionsExchangeKind("topic"),
		rabbitmq.WithConsumerOptionsExchangeDurable,
		rabbitmq.WithConsumerOptionsExchangeDeclare,
		rabbitmq.WithConsumerOptionsRoutingKey("#"),
		rabbitmq.WithConsumerOptionsQueueDurable,
	)
	if err != nil {
		return fmt.Errorf("events: gagal setup DLX queue: %w", err)
	}
	dlxConsumer.Close()
	return nil
}

// Subscribe mengikat queue service ke routing keys yang diberikan dan menjalankan
// handler untuk setiap pesan. Queue dikonfigurasi dead-letter ke lumbung.dlx.
//
// Idempotency: handler bertanggung jawab melakukan cek idempotency menggunakan
// env.EventID terhadap DB consumer (mis. tabel processed_events), karena hanya
// consumer yang punya akses ke DB-nya sendiri.
//
// Semantik return handler:
//   - nil          => Ack (pesan selesai diproses)
//   - error        => Nack tanpa requeue => pesan dialihkan ke DLX
func (c *Consumer) Subscribe(routingKeys []string, handler func(ctx context.Context, env Envelope) error) error {
	if len(routingKeys) == 0 {
		return fmt.Errorf("events: routingKeys tidak boleh kosong")
	}

	opts := []func(*rabbitmq.ConsumerOptions){
		rabbitmq.WithConsumerOptionsExchangeName(ExchangeEvents),
		rabbitmq.WithConsumerOptionsExchangeKind("topic"),
		rabbitmq.WithConsumerOptionsExchangeDurable,
		rabbitmq.WithConsumerOptionsExchangeDeclare,
		rabbitmq.WithConsumerOptionsQueueDurable,
		rabbitmq.WithConsumerOptionsQueueArgs(rabbitmq.Table{
			"x-dead-letter-exchange":    ExchangeDLX,
			"x-dead-letter-routing-key": dlxRoutingKey,
		}),
	}
	for _, rk := range routingKeys {
		opts = append(opts, rabbitmq.WithConsumerOptionsRoutingKey(rk))
	}

	// wagslane/go-rabbitmq: handler adalah arg ke-2, queue adalah arg ke-3.
	// Consumer langsung mulai consume saat dibuat (tidak perlu .Run()).
	rabbitHandler := func(d rabbitmq.Delivery) rabbitmq.Action {
		var env Envelope
		if err := json.Unmarshal(d.Body, &env); err != nil {
			return rabbitmq.NackDiscard
		}
		ctx := context.Background()
		if err := handler(ctx, env); err != nil {
			return rabbitmq.NackDiscard
		}
		return rabbitmq.Ack
	}

	consumer, err := rabbitmq.NewConsumer(c.conn, rabbitHandler, c.queueName, opts...)
	if err != nil {
		return fmt.Errorf("events: gagal membuat consumer untuk queue %s: %w", c.queueName, err)
	}
	c.consumer = consumer
	return nil
}

// Close menutup consumer dan koneksinya.
func (c *Consumer) Close() error {
	if c.consumer != nil {
		c.consumer.Close()
	}
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}
