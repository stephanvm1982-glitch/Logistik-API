'use strict';

/**
 * FlightAware AeroAPI wrapper.
 *
 * Doel: per vlucht (ICAO ident, datum) de actual DEP/ARR tijden + delay status
 * ophalen. Vervangt onze eerdere "DepatureDate < today" heuristiek met echte data.
 *
 * Conventies uit CLAUDE.md:
 *   - Gebruik ICAO-callsign (GTI8208), niet IATA (5Y8208)
 *   - actual_in/out kunnen tijdelijk null zijn, ook na het event — geen
 *     hard retry-loop hier (één call, lichte fallback), de caller mag opnieuw
 *     proberen op een hoger niveau als hij dat nodig vindt
 *   - Delay > 3600 sec = Delayed
 *   - Tijden zijn UTC met Z-suffix
 */

const BASE = 'https://aeroapi.flightaware.com/aeroapi';
const DELAY_THRESHOLD_SEC = 3600;

/**
 * Vraag /flights/{ident} op. Returnt het flights-array.
 * Throw bij HTTP-fout of als FA_API_KEY ontbreekt.
 */
async function fetchFlights(ident) {
  const key = (process.env.FA_API_KEY || '').trim();
  if (!key) throw new Error('FA_API_KEY ontbreekt');

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${BASE}/flights/${encodeURIComponent(ident)}`, {
      signal: ctrl.signal,
      headers: { 'x-apikey': key, 'Accept': 'application/json' },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`AeroAPI HTTP ${r.status}: ${body.slice(0, 200)}`);
    }
    const json = await r.json();
    return Array.isArray(json.flights) ? json.flights : [];
  } finally {
    clearTimeout(to);
  }
}

/**
 * Kies de vlucht het dichtstbij de gegeven datum (UTC). Tolerantie ±36 uur
 * om tijdzone-shifts op te vangen — bv. Atlas booking "29MAY local 22:09" in
 * UIO (UTC-5) is in werkelijkheid 30 mei UTC. Zonder window zou de match falen.
 * dateISO format: "YYYY-MM-DD".
 */
function pickFlightOnDate(flights, dateISO) {
  if (!dateISO) return null;
  const targetMs = new Date(dateISO + 'T12:00:00Z').getTime();
  if (isNaN(targetMs)) return null;
  const WINDOW = 36 * 3600 * 1000;
  let best = null;
  let bestDelta = Infinity;
  for (const f of flights) {
    const sched = f.scheduled_out || f.scheduled_off;
    if (!sched) continue;
    const ms = new Date(sched).getTime();
    if (isNaN(ms)) continue;
    const delta = Math.abs(ms - targetMs);
    if (delta < bestDelta && delta < WINDOW) {
      bestDelta = delta;
      best = f;
    }
  }
  return best;
}

/**
 * Kies de beste tijdwaarde voor 'out' (gate departure) of 'in' (gate arrival).
 * Volgorde: actual > estimated > scheduled. Returnt { source, time } of null.
 */
function bestTime(flight, kind) {
  for (const prefix of ['actual', 'estimated', 'scheduled']) {
    const v = flight[`${prefix}_${kind}`];
    if (v) return { source: prefix, time: v };
  }
  return null;
}

/**
 * Bepaal status-label uit arrival_delay (of departure_delay als fallback).
 * Returnt { label: 'On schedule'|'Delayed'|'Unknown', delayMin: number|null }
 */
function statusFromDelay(flight) {
  let delaySec = flight.arrival_delay;
  if (delaySec == null) delaySec = flight.departure_delay;
  if (delaySec == null) return { label: 'Unknown', delayMin: null };
  const label = delaySec > DELAY_THRESHOLD_SEC ? 'Delayed' : 'On schedule';
  return { label, delayMin: Math.round(delaySec / 60) };
}

/**
 * Hoofd-functie: haal AeroAPI status voor één vlucht/datum op.
 * Returnt een gestructureerd object, of null als de vlucht niet gevonden wordt.
 * Gooit een fout alleen voor onverwachte issues (geen key, HTTP-fail).
 */
async function getFlightStatus(icaoIdent, dateISO) {
  const flights = await fetchFlights(icaoIdent);
  const flight = pickFlightOnDate(flights, dateISO);
  if (!flight) return null;

  const dep = bestTime(flight, 'out');
  const arr = bestTime(flight, 'in');
  const { label, delayMin } = statusFromDelay(flight);

  return {
    ident: flight.ident || icaoIdent,
    origin: (flight.origin && flight.origin.code) || '',
    destination: (flight.destination && flight.destination.code) || '',

    // Best-of voor compact display
    depTime: dep ? dep.time : null,
    depSource: dep ? dep.source : null,
    arrTime: arr ? arr.time : null,
    arrSource: arr ? arr.source : null,

    // Raw velden voor Departed/Expected/Arrived layout
    scheduledOut: flight.scheduled_out || null,
    estimatedOut: flight.estimated_out || null,
    actualOut:    flight.actual_out    || null,
    scheduledIn:  flight.scheduled_in  || null,
    estimatedIn:  flight.estimated_in  || null,
    actualIn:     flight.actual_in     || null,

    status: label,
    delayMin,
  };
}

module.exports = {
  getFlightStatus,
  fetchFlights,        // exposed voor lower-level use
  pickFlightOnDate,
  bestTime,
  statusFromDelay,
  DELAY_THRESHOLD_SEC,
};
