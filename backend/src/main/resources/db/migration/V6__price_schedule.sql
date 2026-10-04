CREATE TABLE IF NOT EXISTS price_schedule (
    class TEXT PRIMARY KEY,
    rate_per_kg INTEGER NOT NULL,
    effective_from BIGINT NOT NULL,
    effective_to BIGINT
);

INSERT INTO price_schedule(class, rate_per_kg, effective_from, effective_to)
VALUES
    ('A', 500, 0, NULL),
    ('B', 250, 0, NULL),
    ('C', 100, 0, NULL)
ON CONFLICT (class) DO NOTHING;
