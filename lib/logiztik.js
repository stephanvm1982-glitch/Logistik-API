/**
 * Shared Logiztik API utilities for serverless functions
 */

const https = require('https');

const API_HOST = 'cloud.logiztikalliance.com';
const API_PORT = 5005;
const API_BASE = '/logCloudWS';

const SHIPMENT_PATH = (cc, date) =>
  `${API_BASE}/api/ClientesExternosA/ListarTotalesGuiasPorClienteV2/` +
  `${encodeURIComponent(cc)}/${encodeURIComponent(date)}`;

const BARCODE_PATH = (cc, shipment) =>
  `${API_BASE}/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/` +
  `${encodeURIComponent(cc)}/${encodeURIComponent(shipment)}`;

/**
 * @param {string}  apiPath
 * @param {string}  apiKey
 * @param {string}  apiKeyHeader   Header name to use (e.g. 'Api-Key' or 'APIkey')
 * @param {boolean} addTokenParam  When false, omit ?token= query param (Barcode V2 requires header-only)
 */
function callLogiztik(apiPath, apiKey, apiKeyHeader = 'Api-Key', addTokenParam = true) {
  return new Promise((resolve) => {
    let path = apiPath;
    if (addTokenParam) {
      const sep = apiPath.indexOf('?') > -1 ? '&' : '?';
      path = apiPath + sep + 'token=' + encodeURIComponent(apiKey);
    }

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        [apiKeyHeader]: apiKey,
      },
      rejectUnauthorized: process.env.ALLOW_INSECURE_TLS !== 'true',
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); }
        catch { data = raw; }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        status: 0,
        data: { error: 'Verbindingsfout met de Logiztik API: ' + err.message },
      });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve({
        ok: false,
        status: 0,
        data: {
          error: 'Time-out: geen antwoord van de Logiztik API binnen 15 seconden.',
        },
      });
    });

    req.end();
  });
}

function enumerateDays(from, to) {
  const fD = new Date(from + 'T00:00:00Z');
  const tD = new Date(to + 'T00:00:00Z');
  if (isNaN(fD) || isNaN(tD) || tD < fD) return null;
  const diff = Math.round((tD - fD) / 86400000);
  if (diff > 30) return null;
  const days = [];
  for (let i = 0; i <= diff; i++) {
    const d = new Date(fD.getTime() + i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

module.exports = {
  callLogiztik,
  enumerateDays,
  SHIPMENT_PATH,
  BARCODE_PATH,
};
