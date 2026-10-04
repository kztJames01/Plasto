-- Epic 6.3: daily Merkle roots per plant for audit proofs
CREATE TABLE merkle_roots (
    id UUID PRIMARY KEY,
    plant_id TEXT NOT NULL,
    day_utc DATE NOT NULL,
    root_hash TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    leaf_hashes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    anchored_at TIMESTAMPTZ,
    chain_tx TEXT
);

CREATE UNIQUE INDEX idx_merkle_plant_day ON merkle_roots (plant_id, day_utc);
CREATE INDEX idx_merkle_root_hash ON merkle_roots (root_hash);
