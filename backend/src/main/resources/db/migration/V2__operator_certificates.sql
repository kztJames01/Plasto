CREATE TABLE operator_certificates (
    certificate_id TEXT PRIMARY KEY,
    operator_pubkey TEXT NOT NULL,
    plant_id TEXT NOT NULL,
    float_cap BIGINT NOT NULL,
    admin_pubkey TEXT NOT NULL,
    admin_sig TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_certs_operator_active ON operator_certificates (operator_pubkey, is_active);
