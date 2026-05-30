'use strict';

/**
 * GET /api/track?awb=369-10201984
 *   of /api/track?awb=36910201984
 *
 * Wrap rond carrier tracking-APIs. Per prefix wordt de juiste scraper gekozen.
 * Voor nu alleen Atlas Air (prefix 369). Andere carriers komen later.
 *
 * Response:
 *   { ok: true, data: { awb, prefix, serial, carrier, origin, destination,
 *       pieces, weight, flights: [{ flightNo, date, route, pieces, weight }],
 *       status: [{ station, code, description, eventTime, pieces, weight }] } }
 */

const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 20000, headers: { 'Accept': 'application/json' } }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('HTTP ' + res.statusCode));
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Invalid JSON: ' + e.message)); }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('Timeout')); });
  });
}

function parseAwb(input) {
  const cleaned = String(input || '').replace(/[^0-9]/g, '');
  if (cleaned.length < 11) return null;
  return { prefix: cleaned.slice(0, 3), serial: cleaned.slice(3) };
}

function dedupeFlights(rows) {
  const seen = new Map();
  rows.forEach((r) => {
    const key = (r.flightNo || '') + '|' + (r.date || '') + '|' + (r.route || '');
    if (!seen.has(key)) seen.set(key, r);
  });
  return Array.from(seen.values());
}

// ── Atlas Air (prefix 369) ───────────────────────────────────────────────
async function scrapeAtlas(prefix, serial) {
  const url = `https://jumpseat.atlasair.com/tracktraceapi/api/FreightContProvdr/GetFrieghtDtlByAwbNo?prfx=${encodeURIComponent(prefix)}&serial=${encodeURIComponent(serial)}`;
  const data = await fetchJson(url);

  const flightsRaw = Array.isArray(data.LstFrieghtDtlEnhanced) ? data.LstFrieghtDtlEnhanced : [];
  const flights = dedupeFlights(flightsRaw.map((f) => ({
    flightNo: f.FlightNo ? '5Y' + String(f.FlightNo).trim() : '',
    date: f.FlightDate ? String(f.FlightDate).slice(0, 10) : '',
    route: [f.RouteFrom, f.RouteTo].filter(Boolean).join('-'),
    pieces: Number(f.Pieces || 0) || null,
    weight: f.Weight ? Number(String(f.Weight).replace(',', '.')) || null : null,
  })).filter((f) => f.flightNo));

  const status = (Array.isArray(data.LstStatus) ? data.LstStatus : []).map((s) => ({
    station: s.Station || '',
    code: s.StatusCode || '',
    description: s.StatusDescription || s.Description || '',
    eventTime: s.EventTime || s.Date || '',
    pieces: Number(s.Pieces || 0) || null,
    weight: s.Weight ? Number(String(s.Weight).replace(',', '.')) || null : null,
  }));

  return {
    awb: prefix + '-' + serial,
    prefix,
    serial,
    carrier: 'Atlas Air (5Y)',
    origin: data.Origin || '',
    destination: data.Destination || '',
    pieces: Number(data.Pieces || 0) || null,
    weight: data.TotalHAWBWeight ? Number(String(data.TotalHAWBWeight).replace(',', '.')) : null,
    flights,
    status,
  };
}

// ── Carrier registry ─────────────────────────────────────────────────────
const SCRAPERS = {
  '369': scrapeAtlas,
  // 074: scrapeKlm — later
  // 020: scrapeLufthansa — later
  // ...
};

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const parsed = parseAwb(req.query.awb);
  if (!parsed) {
    return res.status(400).json({ ok: false, error: 'Ongeldig AWB-formaat. Verwacht bv. 369-10201984.' });
  }

  const scraper = SCRAPERS[parsed.prefix];
  if (!scraper) {
    return res.status(200).json({
      ok: false,
      error: 'Nog geen scraper voor prefix ' + parsed.prefix + '. Alleen Atlas (369) ondersteund.',
      data: { awb: parsed.prefix + '-' + parsed.serial, prefix: parsed.prefix, serial: parsed.serial },
    });
  }

  try {
    const data = await scraper(parsed.prefix, parsed.serial);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: err.message || 'Scraper-fout',
      data: { awb: parsed.prefix + '-' + parsed.serial, prefix: parsed.prefix, serial: parsed.serial },
    });
  }
}

module.exports = handler;
