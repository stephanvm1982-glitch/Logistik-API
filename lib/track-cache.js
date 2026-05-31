'use strict';

/**
 * Persistente cache voor AWB tracking-data in Neon (tabel `awb_tracking`).
 *
 * Doel: vluchtnummers van TrackingMore haal je 1× op (kost een credit) en
 * bewaar je daarna voor altijd. Vluchtnummers veranderen niet na boeking.
 * AeroAPI gebruikt die nummers om realtime DEP/ARR te leveren.
 *
 * NB: caller is verantwoordelijk voor het updaten van `last_step` wanneer
 * AeroAPI nieuwe status oplevert (geland/afgeleverd).
 */

const { query } = require('./db');

// Idempotent — eerste call op een verse Neon-DB maakt de tabel aan.
// Cached zodat we niet bij elke call de CREATE-statement uitvoeren.
let _ensured = false;
async function ensureTable() {
  if (_ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS awb_tracking (
      awb           TEXT PRIMARY KEY,
      prefix        TEXT,
      source        TEXT,
      origin        TEXT,
      destination   TEXT,
      pieces        INTEGER,
      weight        NUMERIC(10,2),
      flights       JSONB,
      status_codes  JSONB,
      last_step     TEXT,
      fetched_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS awb_tracking_prefix_idx ON awb_tracking(prefix)');
  await query('CREATE INDEX IF NOT EXISTS awb_tracking_step_idx   ON awb_tracking(last_step)');
  _ensured = true;
}

// Neon HTTP-driver geeft JSONB soms terug als string ipv object — normaliseer.
function parseJsonbField(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

async function getAwbTracking(awb) {
  await ensureTable();
  const rows = await query('SELECT * FROM awb_tracking WHERE awb = $1', [awb]);
  const row = rows[0];
  if (!row) return null;
  row.flights      = parseJsonbField(row.flights);
  row.status_codes = parseJsonbField(row.status_codes);
  return row;
}

/**
 * Upsert tracking-row. Inkomende `data` heeft onze standaard scraper-shape:
 *   { origin, destination, pieces, weight, flights, status }
 * + `source` ('atlas' | 'trackingmore').
 */
async function saveAwbTracking(awb, prefix, source, data, lastStep) {
  await ensureTable();
  if (process.env.AWB_TRACKING_DEBUG === '1') {
    console.log('[track-cache] save', awb, 'flights=', (data.flights||[]).length);
  }
  const flights = JSON.stringify(Array.isArray(data.flights) ? data.flights : []);
  const statusCodes = JSON.stringify(
    (Array.isArray(data.status) ? data.status : [])
      .map(s => (s && s.code) ? String(s.code).toUpperCase() : null)
      .filter(Boolean)
  );
  await query(
    `INSERT INTO awb_tracking
       (awb, prefix, source, origin, destination, pieces, weight,
        flights, status_codes, last_step, fetched_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10, now(), now())
     ON CONFLICT (awb) DO UPDATE SET
       source       = EXCLUDED.source,
       origin       = COALESCE(EXCLUDED.origin,        awb_tracking.origin),
       destination  = COALESCE(EXCLUDED.destination,   awb_tracking.destination),
       pieces       = COALESCE(EXCLUDED.pieces,        awb_tracking.pieces),
       weight       = COALESCE(EXCLUDED.weight,        awb_tracking.weight),
       flights      = COALESCE(EXCLUDED.flights,       awb_tracking.flights),
       status_codes = COALESCE(EXCLUDED.status_codes,  awb_tracking.status_codes),
       last_step    = COALESCE(EXCLUDED.last_step,     awb_tracking.last_step),
       updated_at   = now()`,
    [
      awb, prefix, source,
      data.origin || null,
      data.destination || null,
      data.pieces || null,
      data.weight || null,
      flights, statusCodes,
      lastStep || null,
    ]
  );
  // Read-back sanity check — als hij faalt schrijven we naar logs
  const check = await query('SELECT awb, jsonb_array_length(flights) AS n FROM awb_tracking WHERE awb = $1', [awb]);
  if (!check.length) {
    console.error('[track-cache] readback FAILED voor', awb, '— INSERT returned zonder error maar SELECT is leeg');
  } else if (process.env.AWB_TRACKING_DEBUG === '1') {
    console.log('[track-cache] readback OK', awb, 'n_flights=', check[0].n);
  }
}

/**
 * Lichte update — alleen status (na AeroAPI live-fetch, zonder TM credits).
 */
async function updateLastStep(awb, step) {
  if (!step) return;
  await query(
    'UPDATE awb_tracking SET last_step = $1, updated_at = now() WHERE awb = $2',
    [step, awb]
  );
}

module.exports = { getAwbTracking, saveAwbTracking, updateLastStep };
