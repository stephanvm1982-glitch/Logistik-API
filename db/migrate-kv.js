'use strict';

/**
 * Eenmalige migratie: KV-blob awb:all → Postgres shipments-tabel.
 *
 * Gebruik:
 *   node db/migrate-kv.js
 *
 * Vereist env vars: KV_REST_API_URL, KV_REST_API_TOKEN, POSTGRES_URL
 * Laad automatisch via .env als dat bestand aanwezig is.
 */

const path = require('path');
const fs   = require('fs');

// Minimale .env-loader
(function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const { kvGetJSON } = require('../lib/kv');
const { query }     = require('../lib/db');

async function main() {
  console.log('Lezen van KV (awb:all)…');
  const store = await kvGetJSON('awb:all');

  if (!store || typeof store !== 'object') {
    console.log('Geen data gevonden in awb:all — migratie overgeslagen.');
    return;
  }

  const entries = Object.values(store);
  console.log(`${entries.length} zendingen gevonden. Start upsert naar Postgres…`);

  let ok = 0, fail = 0;

  for (const s of entries) {
    const awb = s.awb || s.AWB || '';
    if (!awb) { fail++; continue; }

    try {
      await query(
        `INSERT INTO shipments
           (awb, shipment_date, origin, destination, pieces, fb, kg, chargeable_kg,
            rate, total_awb, total_carrier, total_agent, status,
            akkoord, first_seen, last_updated)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                 COALESCE((SELECT first_seen FROM shipments WHERE awb=$1), now()),
                 now())
         ON CONFLICT (awb) DO UPDATE SET
           shipment_date = EXCLUDED.shipment_date,
           origin        = EXCLUDED.origin,
           destination   = EXCLUDED.destination,
           pieces        = EXCLUDED.pieces,
           fb            = EXCLUDED.fb,
           kg            = EXCLUDED.kg,
           chargeable_kg = EXCLUDED.chargeable_kg,
           rate          = EXCLUDED.rate,
           total_awb     = EXCLUDED.total_awb,
           total_carrier = EXCLUDED.total_carrier,
           total_agent   = EXCLUDED.total_agent,
           status        = EXCLUDED.status,
           last_updated  = now()`,
        [
          awb,
          s.shipmentDate ? String(s.shipmentDate).slice(0, 10) : null,
          s.origin       || null,
          s.destination  || null,
          Number(s.pieces || 0),
          Number(s.fb    || 0) || null,
          Number(s.kg    || 0) || null,
          Number(s.chargeableKg || 0) || null,
          Number(s.rate  || 0) || null,
          Number(s.totalAWB     || s.value || 0) || null,
          Number(s.totalCarrier || 0) || null,
          Number(s.totalAgent   || 0) || null,
          s.status  || null,
          Boolean(s.akkoord),
        ]
      );

      if (Array.isArray(s.charges) && s.charges.length) {
        await query('DELETE FROM charges WHERE awb=$1', [awb]);
        for (const c of s.charges) {
          await query(
            'INSERT INTO charges (awb, code, amount) VALUES ($1,$2,$3)',
            [awb, c.code || c.charge || '', Number(c.amount || c.value || 0)]
          );
        }
      }

      ok++;
    } catch (err) {
      console.error(`  ✗ ${awb}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nKlaar: ${ok} geslaagd, ${fail} mislukt.`);
}

main().catch(err => {
  console.error('Fatale fout:', err.message);
  process.exit(1);
});
