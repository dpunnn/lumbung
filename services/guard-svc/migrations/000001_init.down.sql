DROP POLICY IF EXISTS anomaly_tenant ON anomaly;
DROP POLICY IF EXISTS audit_tenant ON audit_log;

DROP INDEX IF EXISTS idx_anomaly_koperasi;
DROP INDEX IF EXISTS idx_audit_tabel;
DROP INDEX IF EXISTS idx_audit_koperasi;

DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS anomaly;
DROP TABLE IF EXISTS audit_log;
