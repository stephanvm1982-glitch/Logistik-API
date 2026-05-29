-- Logiztik Viewer — Neon Postgres schema
-- Uitvoeren via de Neon SQL Editor (eenmalig).

CREATE TABLE IF NOT EXISTS shipments (
  awb            TEXT PRIMARY KEY,
  shipment_date  DATE,
  origin         TEXT,
  destination    TEXT,
  pieces         INTEGER,
  fb             NUMERIC(12,3),   -- freight basis (volumegewicht totaal)
  kg             NUMERIC(10,2),   -- brutogewicht
  chargeable_kg  NUMERIC(10,2),   -- chargeableWeight uit rates[0]
  rate           NUMERIC(10,4),   -- tarief per kg
  total_awb      NUMERIC(12,2),   -- totale AWB-waarde
  total_carrier  NUMERIC(12,2),
  total_agent    NUMERIC(12,2),
  status         TEXT,
  akkoord        BOOLEAN  DEFAULT FALSE,
  first_seen     TIMESTAMPTZ DEFAULT now(),
  last_updated   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charges (
  id      BIGSERIAL PRIMARY KEY,
  awb     TEXT REFERENCES shipments(awb) ON DELETE CASCADE,
  code    TEXT,          -- AWC / ESC / FSC / CARRIER / ...
  amount  NUMERIC(12,2)
);

CREATE INDEX IF NOT EXISTS charges_awb_idx ON charges(awb);

-- Klaar voor Phase 2 — track & trace milestones
CREATE TABLE IF NOT EXISTS shipment_events (
  id          BIGSERIAL PRIMARY KEY,
  awb         TEXT REFERENCES shipments(awb) ON DELETE CASCADE,
  type        TEXT,          -- DEP / ARR / DLV / RCS (IATA FSU)
  expected_at TIMESTAMPTZ,
  actual_at   TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  source      TEXT
);

CREATE INDEX IF NOT EXISTS events_awb_idx ON shipment_events(awb);

-- Klaar voor Phase 3 — delay-meldingen
CREATE TABLE IF NOT EXISTS alerts (
  id              BIGSERIAL PRIMARY KEY,
  awb             TEXT REFERENCES shipments(awb) ON DELETE CASCADE,
  type            TEXT,     -- DELAY / MISSING_MILESTONE / STALE
  severity        TEXT,     -- info / warning / critical
  message         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alerts_awb_idx ON alerts(awb);
