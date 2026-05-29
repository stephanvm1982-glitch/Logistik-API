'use strict';

/**
 * GET  /api/awb-store  → alle zendingen uit Postgres
 * POST /api/awb-store  → upsert array van ruwe API-objecten (vereist INTERNAL_TOKEN)
 *
 * Interface gelijk gehouden aan de oude KV-versie:
 *   GET  → { ok: true, data: { "<awb>": { ...velden } } }
 *   POST → { ok: true, upserted: N }
 */

const { query } = require('../lib/db');

function checkToken(req, res) {
  const token = (process.env.INTERNAL_TOKEN || '').trim();
  if (!token) return true; // niet geconfigureerd → open (dev-fallback)
  const header = req.headers['authorization'] || '';
  if (header === 'Bearer ' + token) return true;
  res.status(401).json({ error: 'Niet geautoriseerd.' });
  return false;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await query(
        `SELECT s.*,
           COALESCE(json_agg(json_build_object('code', c.code, 'amount', c.amount))
             FILTER (WHERE c.id IS NOT NULL), '[]') AS charges
         FROM shipments s
         LEFT JOIN charges c ON c.awb = s.awb
         GROUP BY s.awb
         ORDER BY s.shipment_date DESC, s.awb`
      );

      const data = {};
      rows.forEach(r => {
        data[r.awb] = {
          awb:          r.awb,
          shipmentDate: r.shipment_date,
          origin:       r.origin,
          destination:  r.destination,
          pieces:       r.pieces,
          fb:           r.fb,
          kg:           r.kg,
          chargeableKg: r.chargeable_kg,
          rate:         r.rate,
          totalAWB:     r.total_awb,
          totalCarrier: r.total_carrier,
          totalAgent:   r.total_agent,
          status:       r.status,
          akkoord:      r.akkoord,
          firstSeen:    r.first_seen,
          lastUpdated:  r.last_updated,
          charges:      r.charges || [],
        };
      });

      return res.status(200).json({ ok: true, data });
    } catch (err) {
      return res.status(200).json({ ok: false, error: err.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!checkToken(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Ongeldige JSON' }); }
    }

    const items = Array.isArray(body) ? body
      : (Array.isArray(body && body.shipments) ? body.shipments : null);

    if (!items) {
      return res.status(400).json({ error: 'Verwacht een array van zendingen.' });
    }

    let upserted = 0;
    for (const s of items) {
      const awb = s.awb || '';
      if (!awb) continue;

      const r0 = Array.isArray(s.rates) && s.rates[0] ? s.rates[0] : {};
      const date = s.shipmentDate ? s.shipmentDate.slice(0, 10) : null;

      // Upsert: akkoord-vlag en first_seen worden nooit overschreven
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
          awb, date,
          s.origin || null,
          s.destination || null,
          Number(s.pieces || 0),
          Number(s.fb || 0) || null,
          Number(r0.grossWeight || s.kg || 0) || null,
          Number(r0.chargeableWeight || 0) || null,
          Number(r0.rate || 0) || null,
          Number(s.totalAWB || s.value || 0) || null,
          Number(s.totalCarrier || 0) || null,
          Number(s.totalAgent || 0) || null,
          s.status || null,
        ]
      );

      // Charges: verwijder en herinsert
      if (Array.isArray(s.charges) && s.charges.length) {
        await query('DELETE FROM charges WHERE awb=$1', [awb]);
        for (const c of s.charges) {
          await query(
            'INSERT INTO charges (awb, code, amount) VALUES ($1,$2,$3)',
            [awb, c.charge || c.code || '', Number(c.value || c.amount || 0)]
          );
        }
      }

      upserted++;
    }

    return res.status(200).json({ ok: true, upserted });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
