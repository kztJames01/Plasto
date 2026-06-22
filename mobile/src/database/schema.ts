export const INITIAL_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  customer_pubkey TEXT,
  operator_pubkey TEXT NOT NULL,
  customer_sig TEXT,
  operator_sig TEXT NOT NULL,
  photo_hashes TEXT,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  created_at_local INTEGER,
  synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_events_unsynced ON events(synced, operator_pubkey);
CREATE INDEX IF NOT EXISTS idx_events_customer ON events(customer_pubkey, created_at_local);

CREATE TABLE IF NOT EXISTS user_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_certificates (
  certificate_id TEXT PRIMARY KEY,
  operator_pubkey TEXT NOT NULL,
  plant_id TEXT NOT NULL,
  float_cap INTEGER NOT NULL,
  admin_pubkey TEXT NOT NULL,
  admin_sig TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_certs_operator ON operator_certificates(operator_pubkey);

CREATE TABLE IF NOT EXISTS price_schedule (
  class TEXT PRIMARY KEY,
  rate_per_kg INTEGER NOT NULL,
  effective_from INTEGER NOT NULL,
  effective_to INTEGER
);

INSERT OR IGNORE INTO price_schedule(class, rate_per_kg, effective_from, effective_to)
VALUES
  ('A', 500, 0, NULL),
  ('B', 250, 0, NULL),
  ('C', 100, 0, NULL);

CREATE TABLE IF NOT EXISTS photo_evidence (
  photo_hash TEXT PRIMARY KEY,
  event_id TEXT,
  label TEXT NOT NULL,
  local_uri TEXT,
  created_at INTEGER NOT NULL,
  uploaded INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pending_proposals (
  event_id TEXT PRIMARY KEY,
  proposal_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crash_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  error_message TEXT,
  stack_trace TEXT
);
`;

export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS price_schedule (
    class TEXT PRIMARY KEY,
    rate_per_kg INTEGER NOT NULL,
    effective_from INTEGER NOT NULL,
    effective_to INTEGER
  );
  INSERT OR IGNORE INTO price_schedule(class, rate_per_kg, effective_from, effective_to)
  VALUES
    ('A', 500, 0, NULL),
    ('B', 250, 0, NULL),
    ('C', 100, 0, NULL);
  CREATE TABLE IF NOT EXISTS photo_evidence (
    photo_hash TEXT PRIMARY KEY,
    event_id TEXT,
    label TEXT NOT NULL,
    local_uri TEXT,
    created_at INTEGER NOT NULL,
    uploaded INTEGER DEFAULT 0
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS pending_proposals (
    event_id TEXT PRIMARY KEY,
    proposal_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
];
