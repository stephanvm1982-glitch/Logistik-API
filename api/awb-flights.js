'use strict';

/**
 * POST /api/awb-flights
 *
 * Door de AWBscraper (GitHub Actions, elk uur) aangeroepen na een succesvolle
 * FreshPortal-scrape. Body = het complete data.json:
 *
 *   { last_updated, total_records, records: [
 *       { "Air waybill 1":"176-26533124", "Flight":"EK 9912",
 *         "Vertrekdatum":"26-04-2026", ... },
 *       ...
 *   ] }
 *
 * Wij mappen elk record naar 1 flight-entry en upserten in awb_tracking.
 * Daarmee zit de AWB direct in de cache-first pad van /api/track —
 * AeroAPI vult realtime DEP/ARR aan, geen TrackingMore credits nodig.
 *
 * Vereist Authorization: Bearer INTERNAL_TOKEN (= GitHub secret LOGISTIK_TOKEN).
 */

const trackCache = require('../lib/track-cache');

function checkToken(req, res) {
  const token = (process.env.INTERNAL_TOKEN || '').trim();
  if (!token) {
    res.status(503).json({ error: 'INTERNAL_TOKEN niet geconfigureerd.' });
    return false;
  }
  const header = req.headers['authorization'] || '';
  if (header !== 'Bearer ' + token) {
    res.status(401).json({ error: 'Niet geautoriseerd.' });
    return false;
  }
  return true;
}

// "26-04-2026" → "2026-04-26"  /  leeg → null
function parseDateNL(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return m[3] + '-' + m[2] + '-' + m[1];
}

// "EK 9912" → "EK9912"  /  "  5y 5578 " → "5Y5578"
function parseFlight(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/\s+/g, '').toUpperCase();
}

function parsePrefix(awb) {
  if (!awb || typeof awb !== 'string') return null;
  const cleaned = awb.replace(/[^0-9]/g, '');
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 3);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // GET /api/awb-flights?awb=xxx-xxxxxxxx  → debug: raw cache-row dump (token-gated)
  if (req.method === 'GET') {
    if (!checkToken(req, res)) return;
    const awb = String((req.query && req.query.awb) || '').trim();
    if (!awb) return res.status(400).json({ error: 'Geef ?awb=...' });
    try {
      const row = await trackCache.getAwbTracking(awb);
      return res.status(200).json({ ok: true, awb, row });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkToken(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ error: 'Ongeldige JSON' });
    }
  }
  const records = Array.isArray(body && body.records) ? body.records
                : Array.isArray(body) ? body
                : null;
  if (!records) {
    return res.status(400).json({ error: 'Verwacht { records: [...] }' });
  }

  // Groepeer per AWB — meerdere orderregels delen vaak één AWB+Flight.
  // We willen één row per AWB met de unieke vluchten erbij.
  const byAwb = new Map();
  for (const r of records) {
    const awb = String((r && r['Air waybill 1']) || '').trim();
    if (!awb || !/^\d{3}-?\d+$/.test(awb)) continue;
    const flightNo = parseFlight(r.Flight);
    if (!flightNo) continue;
    const date = parseDateNL(r.Vertrekdatum);
    const prefix = parsePrefix(awb);
    if (!prefix) continue;

    if (!byAwb.has(awb)) {
      byAwb.set(awb, { prefix, flights: new Map() });
    }
    const entry = byAwb.get(awb);
    const key = flightNo + '|' + (date || '');
    if (!entry.flights.has(key)) {
      entry.flights.set(key, { flightNo, date, route: '', statuses: [], aero: null });
    }
  }

  let upserted = 0;
  const errors = [];
  for (const [awb, entry] of byAwb.entries()) {
    const flights = Array.from(entry.flights.values());
    try {
      await trackCache.saveAwbTracking(
        awb,
        entry.prefix,
        'freshportal',
        { flights, status: [] },
        null,
      );
      upserted++;
    } catch (err) {
      errors.push({ awb, error: err.message });
    }
  }

  return res.status(200).json({
    ok: true,
    received: records.length,
    awbs: byAwb.size,
    upserted,
    errors: errors.slice(0, 10),
  });
}

module.exports = handler;
