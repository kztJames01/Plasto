-- Guarantee at most one active operator certificate per operator.
-- Two concurrent admin requests can no longer both insert an active row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_certs_active_operator
    ON operator_certificates (operator_pubkey)
    WHERE is_active = TRUE;
