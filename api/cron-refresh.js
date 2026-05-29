'use strict';

/**
 * Cron job: GET/POST /api/cron-refresh
 * Draait dagelijks om 06:00 UTC via vercel.json.
 *
 * Doet twee dingen per dag:
 *   1. Ververs de KV-cache (24h TTL) per datum → gebruikt door /api/shipments
 *   2. Upsert in Postgres shipments-tabel → permanente database
 *
 * Beveiligd via Vercel CRON_SECRET (automatisch gezet door Vercel).
 */

const { callLogiztik, SHIPMENT_PATH } = require('../lib/logiztik');
const { kvSetJSON }                    = require('../lib/kv');
const { query }                        = require('../lib/db');

function dayOffset(ms) {
  return new Date(Date.now() - ms).toISOString().slice(0, 10);
}

async function upsertToPostgres(shipments, date) {
  for (const s of shipments) {
    const awb = s.awb || '';
    if (!awb) continue;
    const r0 = Array.isArray(s.rates) && s.rates[0] ? s.rates[0] : {};

    await query(
      `INSERT INTO shipments
         (awb, shipment_date, origin, destination, pieces, fb, kg, chargeable_kg,
          rate, total_awb, total_carrier, total_agent, status,
          akkoord, first_seen, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               COALESCE((SELECT akkoord    FROM shipments WHERE awb=$1), FALSE),
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
        s.shipmentDate ? s.shipmentDate.slice(0, 10) : date,
        s.origin || null,
        s.destination || null,
        Number(s.pieces || 0),
        Number(s.fb || 0) || null,
        Number(r0.grossWeight || 0) || null,
        Number(r0.chargeableWeight || 0) || null,
        Number(r0.rate || 0) || null,
        Number(s.totalAWB || 0) || null,
        Number(s.totalCarrier || 0) || null,
        Number(s.totalAgent || 0) || null,
        s.status || null,
      ]
    );

    if (Array.isArray(s.charges) && s.charges.length) {
      await query('DELETE FROM charges WHERE awb=$1', [awb]);
      for (const c of s.charges) {
        await query(
          'INSERT INTO charges (awb, code, amount) VALUES ($1,$2,$3)',
          [awb, c.charge || c.code || '', Number(c.value || c.amount || 0)]
        );
      }
    }
  }
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel zet automatisch CRON_SECRET en stuurt deze mee als Authorization-header
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (cronSecret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + cronSecret) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }
  }

  const CUSTOMER_CODE   = (process.env.CUSTOMER_CODE   || '').trim();
  const API_KEY         = (process.env.API_KEY          || '').trim();
  const API_KEY_HEADER  = (process.env.API_KEY_HEADER   || 'Api-Key').trim();

  if (!CUSTOMER_CODE || !API_KEY) {
    return res.status(200).json({
      ok: false,
      error: 'Server niet geconfigureerd. CUSTOMER_CODE en API_KEY ontbreken.',
    });
  }

  const dates = [
    dayOffset(0),
    dayOffset(86400000),
    dayOffset(2 * 86400000),
  ];

  const results = [];

  for (const date of dates) {
    try {
      const result = await callLogiztik(
        SHIPMENT_PATH(CUSTOMER_CODE, date),
        API_KEY,
        API_KEY_HEADER
      );

      if (result.ok && Array.isArray(result.data)) {
        // 1. KV-cache (24h)
        await kvSetJSON(`shipments:${date}`, result.data, 86400);

        // 2. Postgres (permanent)
        await upsertToPostgres(result.data, date);

        results.push({ date, shipmentCount: result.data.length });
      } else {
        results.push({ date, shipmentCount: 0, error: result.data?.error || 'Geen data' });
      }
    } catch (err) {
      results.push({ date, shipmentCount: 0, error: err.message });
    }
  }

  const summary = { refreshedAt: new Date().toISOString(), results };
  await kvSetJSON('cron:last-refresh', summary).catch(() => {});

  res.status(200).json({ ok: true, ...summary });
}

module.exports = handler;
