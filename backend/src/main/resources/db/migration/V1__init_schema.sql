-- cloud copy of events (local SQLite is source of truth on device)
CREATE TABLE events (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    customer_pubkey TEXT,
    operator_pubkey TEXT NOT NULL,
    customer_sig TEXT,
    operator_sig TEXT NOT NULL,
    photo_hashes TEXT,
    previous_hash TEXT,
    event_hash TEXT NOT NULL,
    created_at_local BIGINT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_operator_received ON events (operator_pubkey, received_at);
CREATE INDEX idx_events_customer_local ON events (customer_pubkey, created_at_local);
