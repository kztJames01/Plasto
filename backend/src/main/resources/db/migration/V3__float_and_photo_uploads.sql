CREATE TABLE operator_floats (
    operator_pubkey TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL,
    cap BIGINT NOT NULL,
    consumed BIGINT NOT NULL DEFAULT 0,
    last_sync TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE photo_uploads (
    photo_hash TEXT PRIMARY KEY,
    event_id UUID,
    content_type TEXT NOT NULL,
    object_key TEXT NOT NULL,
    upload_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    uploaded BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_photo_uploads_event ON photo_uploads (event_id);
