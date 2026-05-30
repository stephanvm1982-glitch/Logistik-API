'use strict';

/**
 * IATA airline-code → ICAO callsign mapping.
 *
 * AeroAPI vereist ICAO ("GTI8208"), Atlas en de meeste cargo-feeds geven
 * IATA ("5Y8208"). Houd deze lijst uitbreidbaar; voeg toe wanneer een
 * carrier voor het eerst in productie verschijnt.
 *
 * Bron CLAUDE.md + standaard IATA airline directories.
 */

const IATA_TO_ICAO = {
  // Cargo carriers waar wij operationeel mee te maken hebben
  '5Y': 'GTI',  // Atlas Air        (callsign "Giant")
  'EK': 'UAE',  // Emirates SkyCargo
  'ET': 'ETH',  // Ethiopian Airlines
  'JK': 'ACL',  // Aercaribe

  // Passenger carriers met substantial belly cargo
  'KL': 'KLM',  // KLM Royal Dutch Airlines
  'AF': 'AFR',  // Air France
  'LH': 'DLH',  // Lufthansa
  'BA': 'BAW',  // British Airways
  'IB': 'IBE',  // Iberia
  'UA': 'UAL',  // United Airlines
  'AA': 'AAL',  // American Airlines
  'DL': 'DAL',  // Delta Air Lines
  'AC': 'ACA',  // Air Canada
  'SQ': 'SIA',  // Singapore Airlines
  'TG': 'THA',  // Thai Airways
  'QF': 'QFA',  // Qantas
  'LX': 'SWR',  // Swiss
  'SA': 'SAA',  // South African Airways
  'CO': 'COA',  // Continental (legacy — nu UA)
  '2G': 'CRG',  // Cargoitalia
  '7I': 'INC',  // Insel Air (placeholder)
  'PO': 'PAC',  // Polar Air Cargo
  'MP': 'MPH',  // Martinair
  'LA': 'LAN',  // LATAM
  'FX': 'FDX',  // FedEx
  '3K': 'JSA',  // Jetstar (also Everts Air Cargo in some contexts — verify per AWB)
};

function iataToIcao(iata) {
  if (!iata) return null;
  return IATA_TO_ICAO[String(iata).toUpperCase().trim()] || null;
}

/**
 * Converteert "5Y8208" → "GTI8208". Geeft null als de IATA-prefix niet gekend is
 * of het inputformaat onverwacht is.
 */
function flightIataToIcao(iataFlight) {
  if (!iataFlight) return null;
  const m = String(iataFlight).match(/^([A-Z0-9]{2})(\d+)$/i);
  if (!m) return null;
  const icao = iataToIcao(m[1]);
  if (!icao) return null;
  return icao + m[2];
}

module.exports = { IATA_TO_ICAO, iataToIcao, flightIataToIcao };
