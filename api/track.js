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

const { flightIataToIcao } = require('../lib/airline-icao');
const aeroapi = require('../lib/aeroapi');
const trackingmore = require('../lib/trackingmore');

async function fetchJson(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; LogistikScraper/1.0)' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(to);
  }
}

/**
 * Verrijk een leg met AeroAPI-data: actuele DEP/ARR + delay.
 * Mutates de leg en voegt veld `aero` toe (of null als geen data).
 * Faalt stil — AeroAPI down mag niet de hele track-call breken.
 */
async function enrichLegWithAeroApi(leg) {
  if (!leg.flightNo || !leg.date) { leg.aero = null; return; }
  if (!process.env.FA_API_KEY) { leg.aero = null; return; }
  const icao = flightIataToIcao(leg.flightNo);
  if (!icao) { leg.aero = null; return; }
  try {
    const fs = await aeroapi.getFlightStatus(icao, leg.date);
    leg.aero = fs;
    // Afgeleide statuses voor consistente verwerking later
    if (fs) {
      if (fs.actualIn && !leg.statuses.includes('ARR')) leg.statuses.push('ARR');
      if (fs.actualOut && !leg.statuses.includes('DEP')) leg.statuses.push('DEP');
    }
  } catch (err) {
    leg.aero = { error: err.message };
  }
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

  // Atlas geeft per leg meerdere rows in LstFrieghtDtlEnhanced — één per status event
  // (BKD, FOH, RCS, ULD, ARR, RCF). We groeperen per (origin,destination,flightNo) en
  // verzamelen alle status-codes per leg. Zo kunnen we onderscheiden of bv. ARR op een
  // tussenstation gebeurde of op de eindbestemming.
  // Belangrijk: Atlas's response BEVAT GEEN 'DEP' code. We leiden 'DEP' zelf af uit
  // DepatureDate < vandaag (de Atlas UI doet hetzelfde, en die tonen 'Departed Flight'
  // dan keurig in de status-tabel).
  const todayISO = new Date().toISOString().slice(0, 10);
  const rawRows = Array.isArray(data.LstFrieghtDtlEnhanced) ? data.LstFrieghtDtlEnhanced : [];
  const byLeg = new Map();
  rawRows.forEach((f) => {
    if (!f.FlightNo) return;
    const key = (f.Origin || '') + '|' + (f.Destination || '') + '|' + String(f.FlightNo).trim();
    if (!byLeg.has(key)) {
      byLeg.set(key, {
        flightNo: (f.Carrier || '5Y') + String(f.FlightNo).trim(),
        origin: f.Origin || '',
        destination: f.Destination || '',
        date: f.FlightDate ? String(f.FlightDate).slice(0, 10) : '',
        route: [f.Origin, f.Destination].filter(Boolean).join('-'),
        pieces: Number(f.Pieces || 0) || null,
        weight: f.Weight != null ? Number(f.Weight) : null,
        departure: f.DepatureDateStr ? (f.DepatureDateStr + ' ' + (f.DepatureTime || '')).trim() : '',
        arrival: f.ArrivalDateStr ? (f.ArrivalDateStr + ' ' + (f.ArrivalTime || '')).trim() : '',
        statuses: [],
      });
    }
    const code = String(f.Status || '').toUpperCase().trim();
    const leg = byLeg.get(key);
    if (code && !leg.statuses.includes(code)) leg.statuses.push(code);
    // Inferred DEP: scheduled departure ligt vóór vandaag (UTC datum)
    const departISO = (f.DepatureDate || '').slice(0, 10);
    if (departISO && departISO < todayISO && !leg.statuses.includes('DEP')) {
      leg.statuses.push('DEP');
    }
  });
  const flights = Array.from(byLeg.values());

  // Verrijk parallel met AeroAPI per leg (echte actual_out/in + delay).
  // Faalt stil per leg — Atlas blijft beschikbaar ook als AeroAPI down/key mist.
  await Promise.all(flights.map(enrichLegWithAeroApi));

  // LstStatus = AWB-level milestone codes (aggregaat van alle legs). Behouden voor info.
  const status = (Array.isArray(data.LstStatus) ? data.LstStatus : []).map((code) => ({
    code: String(code || '').toUpperCase(),
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

// ── TrackingMore fallback (multi-carrier) ────────────────────────────────
// Voor alle prefixes die geen carrier-specifieke scraper hebben. Vereist
// TRACKINGMORE_API_KEY. Free tier → caller (frontend) moet cachen.
async function scrapeTrackingMoreFor(prefix, serial) {
  const awb = prefix + '-' + serial;
  const tmData = await trackingmore.getTracking(awb);
  const norm = trackingmore.normalize(tmData, awb);
  // Verrijk met AeroAPI per leg (als FA_API_KEY beschikbaar — anders aero=null)
  if (norm && norm.flights) {
    await Promise.all(norm.flights.map(enrichLegWithAeroApi));
  }
  return Object.assign(
    { awb, prefix, serial, carrier: 'via TrackingMore' },
    norm || { origin: '', destination: '', pieces: null, weight: null, flights: [], status: [] }
  );
}

// ── Carrier registry ─────────────────────────────────────────────────────
// Volgorde: carrier-specifiek heeft voorrang. Voor onbekende prefixes valt
// het systeem terug op TrackingMore (in handler hieronder).
const SCRAPERS = {
  '369': scrapeAtlas,
  // Andere airlines (074 KLM, 057 AF, 176 EK, 071 ET, 020 LH, ...) gaan
  // automatisch via de TrackingMore fallback in de handler.
};

function hasScraperFor(prefix) {
  if (SCRAPERS[prefix]) return true;
  return !!(process.env.TRACKINGMORE_API_KEY || '').trim();
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const parsed = parseAwb(req.query.awb);
  if (!parsed) {
    return res.status(400).json({ ok: false, error: 'Ongeldig AWB-formaat. Verwacht bv. 369-10201984.' });
  }

  // Kies: dedicated scraper > TrackingMore fallback > niets
  let scraper = SCRAPERS[parsed.prefix];
  if (!scraper && (process.env.TRACKINGMORE_API_KEY || '').trim()) {
    scraper = scrapeTrackingMoreFor;
  }
  if (!scraper) {
    return res.status(200).json({
      ok: false,
      error: 'Geen scraper voor prefix ' + parsed.prefix + ' en TRACKINGMORE_API_KEY niet geconfigureerd.',
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
