-- Prevent two operators from minting the same event_hash, and prevent
-- two concurrent sync batches from forking the per-operator hash chain by
-- inserting two distinct events that both claim the same previous_hash.
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_operator_event_hash
    ON events (operator_pubkey, event_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_operator_previous_hash
    ON events (operator_pubkey, previous_hash)
    WHERE previous_hash IS NOT NULL;
