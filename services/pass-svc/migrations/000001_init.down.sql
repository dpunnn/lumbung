DROP POLICY IF EXISTS receipt_tenant ON receipt;
DROP POLICY IF EXISTS pass_tenant ON pass;

DROP INDEX IF EXISTS idx_receipt_tx;
DROP INDEX IF EXISTS idx_receipt_koperasi;
DROP INDEX IF EXISTS idx_pass_token;
DROP INDEX IF EXISTS idx_pass_koperasi;

DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS receipt;
DROP TABLE IF EXISTS pass;
