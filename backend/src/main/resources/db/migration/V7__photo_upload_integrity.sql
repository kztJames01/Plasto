-- Epic 5.2: track received bytes and bind complete calls to a presign token.
ALTER TABLE photo_uploads
    ADD COLUMN IF NOT EXISTS received_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE photo_uploads
    ADD COLUMN IF NOT EXISTS complete_token TEXT;
