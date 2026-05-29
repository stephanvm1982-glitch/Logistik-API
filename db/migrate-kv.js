'use strict';

/**
 * Eenmalige migratie: KV-blob awb:all → Postgres shipments-tabel.
 *
 * Gebruik:
 *   node db/migrate-kv.js
 *
 * Vereist in .env: KV_REST_API_URL, KV_REST_API_TOKEN, POSTGRES_URL
 * Geen npm-packages nodig — gebruikt alleen ingebouwde Node-modules + fetch.
 */

const https = require('https');
const path  = require('path');
const fs    = require('fs');

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

// ── Neon HTTP-client (geen npm nodig) ──────────────────────────────────────
function neonQuery(postgresUrl, sql, params) {
  return new Promise((resolve, reject) => {
    const u = new URL(postgresUrl);
    const host     = u.hostname;          // xxx.neon.tech
    const password = decodeURIComponent(u.password);
    const body     = JSON.stringify({ query: sql, params: params || [] });

    const options = {
      hostname: host,
      port: 443,
      path: '/sql',
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + password,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch { return reject(new Error('Ongeldig JSON van Neon: ' + raw.slice(0, 200))); }
        if (res.statusCode >= 400) return reject(new Error(`Neon HTTP ${res.statusCode}: ${JSON.stringify(data)}`));
        resolve(data.rows || []);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── KV lezen via Upstash REST API ───────────────────────────────────────────
async function kvGetJSON(key) {
  const baseUrl = (process.env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token   = process.env.KV_REST_API_TOKEN || '';
  if (!baseUrl || !token) return null;

  const url = `${baseUrl}/get/${encodeURIComponent(key)}`;
  const res  = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error(`KV HTTP ${res.status}`);
  const json = await res.json();
  if (!json.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}

// ── Migratie ─────────────────────────────────────────────────────────────────
async function main() {
  const postgresUrl = (process.env.POSTGRES_URL || '').trim();
  if (!postgresUrl) {
    console.error('POSTGRES_URL ontbreekt in .env — migratie gestopt.');
    process.exit(1);
  }

  console.log('Lezen van KV (awb:all)…');
  const store = await kvGetJSON('awb:all');

  if (!store || typeof store !== 'object') {
    console.log('Geen data gevonden in awb:all — niets te migreren.');
    return;
  }

  const entries = Object.values(store);
  console.log(`${entries.length} zendingen gevonden. Start upsert naar Postgres…`);

  let ok = 0, fail = 0;

  for (const s of entries) {
    const awb = s.awb || s.AWB || '';
    if (!awb) { fail++; continue; }

    try {
      await neonQuery(postgresUrl,
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
          s.origin      || null,
          s.destination || null,
          Number(s.pieces || 0),
          Number(s.fb || 0) || null,
          Number(s.kg || 0) || null,
          Number(s.chargeableKg || 0) || null,
          Number(s.rate || 0) || null,
          Number(s.totalAWB || s.value || 0) || null,
          Number(s.totalCarrier || 0) || null,
          Number(s.totalAgent || 0) || null,
          s.status  || null,
          Boolean(s.akkoord),
        ]
      );

      if (Array.isArray(s.charges) && s.charges.length) {
        await neonQuery(postgresUrl, 'DELETE FROM charges WHERE awb=$1', [awb]);
        for (const c of s.charges) {
          await neonQuery(postgresUrl,
            'INSERT INTO charges (awb, code, amount) VALUES ($1,$2,$3)',
            [awb, c.code || c.charge || '', Number(c.amount || c.value || 0)]
          );
        }
      }

      process.stdout.write('.');
      ok++;
    } catch (err) {
      console.error(`\n  ✗ ${awb}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n\nKlaar: ${ok} geslaagd, ${fail} mislukt.`);
}

main().catch(err => {
  console.error('Fatale fout:', err.message);
  process.exit(1);
});
