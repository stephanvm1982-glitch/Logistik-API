'use strict';

/**
 * TrackingMore v4 - Air Waybill tracking wrapper.
 *
 * Doc: https://api.trackingmore.com/v4/air_waybill
 *
 * Belangrijk (per CLAUDE.md):
 * - Auth header: `Tracking-Api-Key: <key>`
 * - Update cyclus: 4-6 uur (geen realtime)
 * - Free tier = beperkt aantal trackings per maand → caller moet agressief cachen
 * - AWB-formaat: "176-22764711" (mét streepje)
 *
 * Lifecycle per AWB:
 *   1. POST /air_waybill/create  → registreer AWB bij TM (één keer, opent tracking)
 *   2. GET  /air_waybill?awb_number=...  → poll status (na ~paar minuten)
 *
 * Returnt een genormaliseerd object met dezelfde shape als scrapeAtlas:
 *   { origin, destination, pieces, weight, flights:[...], status:[...] }
 */

const BASE = 'https://api.trackingmore.com/v4';

function getKey() {
  const k = (process.env.TRACKINGMORE_API_KEY || '').trim();
  if (!k) throw new Error('TRACKINGMORE_API_KEY ontbreekt');
  return k;
}

async function tmFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(BASE + path, {
      signal: ctrl.signal,
      method: opts.method || 'GET',
      headers: Object.assign({
        'Tracking-Api-Key': getKey(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, body: json };
  } finally {
    clearTimeout(to);
  }
}

function extractData(body) {
  // TM v4: response is { meta:{code,...}, data: <object|array|null> }
  if (!body) return null;
  const d = body.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d[0] || null; // list-response → eerste tracking
  return d;
}

function isMissing(body) {
  if (!body) return false;
  const code = body.meta && body.meta.code;
  if (code === 4031 || code === 4032 || code === 4033) return true; // not found / not exists
  const d = body.data;
  if (d == null) return true;
  if (Array.isArray(d) && d.length === 0) return true;
  return false;
}

/**
 * Haal de tracking-data van TrackingMore op. Als de AWB nog niet geregistreerd
 * is, doet één POST om hem aan te maken (zonder data terug — TM heeft tijd nodig).
 * Returnt het tracking-object of null als (nog) niet beschikbaar.
 */
async function getTracking(awbWithDash) {
  // 1. GET eerst
  let res = await tmFetch('/air_waybill?awb_number=' + encodeURIComponent(awbWithDash));
  let missing = res.status === 404 || isMissing(res.body);

  if (missing) {
    // Niet geregistreerd → eenmalig aanmaken
    const createRes = await tmFetch('/air_waybill/create', {
      method: 'POST',
      body: { awb_number: awbWithDash },
    });
    // Als create faalt met code != "already exists" → throw
    const createCode = createRes.body && createRes.body.meta && createRes.body.meta.code;
    if (!createRes.ok && createCode !== 4015 /* already exists */) {
      const errMsg = (createRes.body && (createRes.body.meta?.message || createRes.body.message)) || ('HTTP ' + createRes.status);
      throw new Error('TrackingMore create: ' + errMsg);
    }
    // Korte wachttijd zodat TM intern de tracking kan initialiseren
    await new Promise(r => setTimeout(r, 1500));
    res = await tmFetch('/air_waybill?awb_number=' + encodeURIComponent(awbWithDash));
  }

  if (!res.ok) {
    const errMsg = (res.body && (res.body.meta?.message || res.body.message)) || ('HTTP ' + res.status);
    throw new Error('TrackingMore: ' + errMsg);
  }

  return extractData(res.body);
}

/**
 * Normaliseer TrackingMore response naar onze standaard shape.
 * TM-velden gebaseerd op v4 docs; gebruikt defensieve fallbacks.
 */
function normalize(tmData, awbWithDash) {
  if (!tmData) return null;

  const flightsRaw = Array.isArray(tmData.flights) ? tmData.flights : [];
  const flights = flightsRaw.map((f) => ({
    flightNo: f.flight_no || f.flightNumber || '',
    origin: f.origin || f.origin_airport || '',
    destination: f.destination || f.destination_airport || '',
    date: f.flight_date ? String(f.flight_date).slice(0, 10) : (f.date ? String(f.date).slice(0, 10) : ''),
    route: [f.origin, f.destination].filter(Boolean).join('-'),
    pieces: Number(f.pieces || 0) || null,
    weight: f.weight != null ? Number(f.weight) : null,
    statuses: [],   // event-codes worden globaal in `status` opgenomen, niet per leg
    aero: null,     // backend kan later AeroAPI ophalen voor exacte tijden
  }));

  const events = Array.isArray(tmData.origin_info?.trackinfo) ? tmData.origin_info.trackinfo
                : Array.isArray(tmData.trackinfo) ? tmData.trackinfo
                : Array.isArray(tmData.events) ? tmData.events
                : [];
  const status = events.map((e) => ({
    code: String(e.checkpoint_status || e.status_code || e.status || e.code || '').toUpperCase(),
    description: e.checkpoint_description || e.tracking_detail || e.description || '',
    eventTime: e.checkpoint_date || e.event_time || e.time || '',
    station: e.location || e.station || '',
  })).filter((e) => e.code);

  // Globale statussen ook toe-applicaten per leg (zo werkt onze frontend mapping)
  flights.forEach((leg) => {
    status.forEach((e) => {
      if (e.code && !leg.statuses.includes(e.code)) leg.statuses.push(e.code);
    });
  });

  return {
    origin: tmData.origin_country || tmData.origin || (flights[0] && flights[0].origin) || '',
    destination: tmData.destination_country || tmData.destination || (flights[flights.length - 1] && flights[flights.length - 1].destination) || '',
    pieces: Number(tmData.pieces || tmData.total_pieces || 0) || null,
    weight: tmData.weight != null ? Number(tmData.weight) : null,
    flights,
    status,
  };
}

module.exports = { getTracking, normalize };
