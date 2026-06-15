// Package consumer berisi konsumen event RabbitMQ untuk guard-svc.
//
// guard-svc berlangganan SEMUA event domain LUMBUNG, menulis jejak audit
// (event-sourced), lalu menjalankan detektor anomali. Hasil deteksi disimpan
// ke tabel anomaly. Pemrosesan bersifat idempoten via tabel processed_events.
package consumer

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/lumbung/shared/events"
	"github.com/lumbung/guard-svc/internal/domain"
	"github.com/lumbung/guard-svc/internal/repository"
)

// consumerName dipakai untuk audit di tabel processed_events.
const consumerName = "guard-svc.audit"

// routingKeys adalah seluruh event domain yang dipantau guard-svc.
var routingKeys = []string{
	"simpanan.created",
	"pinjaman.created",
	"angsuran.paid",
	"intake.recorded",
	"stok.changed",
	"pass.issued",
	"pass.revoked",
}

// locWIB adalah zona waktu WIB (UTC+7) untuk deteksi jam operasional.
var locWIB = time.FixedZone("WIB", 7*3600)

// EventsConsumer mengonsumsi event domain dan menulis audit + anomali.
type EventsConsumer struct {
	consumer    *events.Consumer
	anomalyRepo *repository.AnomalyRepository
}

// NewEventsConsumer membuat consumer baru.
func NewEventsConsumer(consumer *events.Consumer, anomalyRepo *repository.AnomalyRepository) *EventsConsumer {
	return &EventsConsumer{consumer: consumer, anomalyRepo: anomalyRepo}
}

// Start berlangganan semua routing key domain. Blocking; panggil di goroutine.
func (c *EventsConsumer) Start() error {
	return c.consumer.Subscribe(routingKeys, c.handle)
}

// handle memproses satu event domain.
func (c *EventsConsumer) handle(ctx context.Context, env events.Envelope) error {
	koperasiID, recordID, ok := c.identify(env)
	if !ok {
		// Tenant/record tidak teridentifikasi: log lalu Ack (return nil) agar tidak loop.
		slog.Warn("guard-svc: event tanpa koperasi/record valid, dilewati", "event_id", env.EventID, "type", env.Type)
		return nil
	}

	tabel := tabelFromType(env.Type)
	aksi := aksiFromType(env.Type)

	// FieldDiff: simpan payload mentah sebagai konteks audit.
	var payloadMap map[string]any
	_ = json.Unmarshal(env.Payload, &payloadMap)
	fieldDiff := map[string]any{"event": payloadMap}

	audit := repository.AuditInsert{
		KoperasiID: koperasiID,
		Aksi:       aksi,
		Tabel:      tabel,
		RecordID:   recordID,
		FieldDiff:  fieldDiff,
	}

	anomalies := detectAnomalies(env, tabel, recordID, payloadMap)

	already, err := c.anomalyRepo.ProcessAuditEvent(ctx, env.EventID, consumerName, koperasiID, audit, anomalies)
	if err != nil {
		slog.Error("guard-svc: gagal memproses event", "event_id", env.EventID, "type", env.Type, "err", err)
		return err
	}
	if already {
		slog.Info("guard-svc: event sudah diproses (idempotent skip)", "event_id", env.EventID)
		return nil
	}

	if len(anomalies) > 0 {
		slog.Warn("guard-svc: anomali terdeteksi", "event_id", env.EventID, "type", env.Type, "jumlah", len(anomalies))
	}
	return nil
}

// identify mengekstrak koperasi_id dan record_id (ID entitas) dari envelope.
func (c *EventsConsumer) identify(env events.Envelope) (uuid.UUID, uuid.UUID, bool) {
	koperasiID, err := uuid.Parse(env.TenantID)
	if err != nil {
		return uuid.Nil, uuid.Nil, false
	}

	var p map[string]any
	if err := json.Unmarshal(env.Payload, &p); err != nil {
		return uuid.Nil, uuid.Nil, false
	}

	recordID := recordIDFromPayload(env.Type, p)
	if recordID == uuid.Nil {
		// Tidak ada record spesifik (mis. stok.changed bisa tanpa id): pakai nil-uuid
		// sebagai placeholder agar audit tetap tercatat.
		recordID = uuid.Nil
	}
	return koperasiID, recordID, true
}

// recordIDFromPayload memetakan tipe event ke field ID utama pada payload.
func recordIDFromPayload(eventType string, p map[string]any) uuid.UUID {
	keys := map[string]string{
		"simpanan.created": "simpanan_id",
		"pinjaman.created": "pinjaman_id",
		"angsuran.paid":    "angsuran_id",
		"intake.recorded":  "batch_id",
		"pass.issued":      "pass_id",
		"pass.revoked":     "pass_id",
	}
	key, ok := keys[eventType]
	if !ok {
		return uuid.Nil
	}
	if raw, ok := p[key].(string); ok {
		if id, err := uuid.Parse(raw); err == nil {
			return id
		}
	}
	return uuid.Nil
}

// tabelFromType memetakan tipe event ke nama tabel/entitas untuk audit.
func tabelFromType(eventType string) string {
	switch {
	case strings.HasPrefix(eventType, "simpanan."):
		return "simpanan"
	case strings.HasPrefix(eventType, "pinjaman."):
		return "pinjaman"
	case strings.HasPrefix(eventType, "angsuran."):
		return "angsuran"
	case strings.HasPrefix(eventType, "intake."):
		return "intake"
	case strings.HasPrefix(eventType, "stok."):
		return "stok"
	case strings.HasPrefix(eventType, "pass."):
		return "pass"
	default:
		return eventType
	}
}

// aksiFromType memetakan tipe event ke aksi audit (created|updated|deleted).
func aksiFromType(eventType string) string {
	switch {
	case strings.HasSuffix(eventType, ".created"),
		strings.HasSuffix(eventType, ".recorded"),
		strings.HasSuffix(eventType, ".issued"),
		strings.HasSuffix(eventType, ".paid"):
		return domain.AksiCreated
	case strings.HasSuffix(eventType, ".revoked"),
		strings.HasSuffix(eventType, ".deleted"),
		strings.HasSuffix(eventType, ".disputed"),
		strings.HasSuffix(eventType, ".claimed"):
		return domain.AksiDeleted
	case strings.HasSuffix(eventType, ".changed"),
		strings.HasSuffix(eventType, ".updated"):
		return domain.AksiUpdated
	default:
		return domain.AksiUpdated
	}
}

// detectAnomalies menjalankan 5 detektor pola fraud terhadap satu event.
func detectAnomalies(env events.Envelope, tabel string, recordID uuid.UUID, p map[string]any) []repository.DetectedAnomaly {
	out := []repository.DetectedAnomaly{}
	status, _ := p["status"].(string)
	status = strings.ToLower(strings.TrimSpace(status))

	// Pola 1 — simpanan_dispute: status simpanan -> 'disputed'.
	if tabel == "simpanan" && status == "disputed" {
		out = append(out, repository.DetectedAnomaly{
			Pola:       domain.PolaDispute,
			RecordID:   recordID,
			Tabel:      tabel,
			Keterangan: "Simpanan " + recordID.String() + " ditandai disputed",
			Severity:   domain.SeverityMedium,
		})
	}

	// Pola 2 — simpanan_claim: status simpanan -> 'claimed'.
	if tabel == "simpanan" && status == "claimed" {
		out = append(out, repository.DetectedAnomaly{
			Pola:       domain.PolaClaim,
			RecordID:   recordID,
			Tabel:      tabel,
			Keterangan: "Klaim simpanan " + recordID.String() + " tanpa persetujuan ganda",
			Severity:   domain.SeverityHigh,
		})
	}

	// Pola 3 — hapus_finansial: aksi deleted di tabel finansial.
	if aksiFromType(env.Type) == domain.AksiDeleted && isFinansial(tabel) {
		out = append(out, repository.DetectedAnomaly{
			Pola:       domain.PolaHapusFinansial,
			RecordID:   recordID,
			Tabel:      tabel,
			Keterangan: "Penghapusan/pembatalan data finansial " + tabel + " " + recordID.String(),
			Severity:   domain.SeverityHigh,
		})
	}

	// Pola 4 — ubah_nominal: event update dengan perubahan jumlah/nominal.
	if aksiFromType(env.Type) == domain.AksiUpdated && hasNominalField(p) {
		out = append(out, repository.DetectedAnomaly{
			Pola:       domain.PolaUbahNominal,
			RecordID:   recordID,
			Tabel:      tabel,
			Keterangan: "Perubahan nominal pada " + tabel + " " + recordID.String(),
			Severity:   domain.SeverityMedium,
		})
	}

	// Pola 5 — pembatalan_luar_jam: event antara 22:00-06:00 WIB.
	if isOutsideHours(env.OccurredAt) {
		out = append(out, repository.DetectedAnomaly{
			Pola:       domain.PolaPembatalanLuarJam,
			RecordID:   recordID,
			Tabel:      tabel,
			Keterangan: "Transaksi " + tabel + " " + recordID.String() + " di luar jam operasional",
			Severity:   domain.SeverityHigh,
		})
	}

	return out
}

// isFinansial menandai tabel yang membawa nilai uang/aset.
func isFinansial(tabel string) bool {
	switch tabel {
	case "simpanan", "pinjaman", "angsuran", "intake", "stok":
		return true
	default:
		return false
	}
}

// hasNominalField mengecek apakah payload mengandung field nominal/jumlah.
func hasNominalField(p map[string]any) bool {
	for _, k := range []string{"jumlah", "nominal", "jumlah_bayar", "pokok", "amount"} {
		if _, ok := p[k]; ok {
			return true
		}
	}
	return false
}

// isOutsideHours benar bila waktu (WIB) berada di rentang 22:00-06:00.
func isOutsideHours(t time.Time) bool {
	if t.IsZero() {
		return false
	}
	h := t.In(locWIB).Hour()
	return h >= 22 || h < 6
}
