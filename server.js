'use strict';

/*
 * Logiztik Shipment Viewer - lokale proxy
 * --------------------------------------
 * Deze server doet twee dingen:
 *   1. Hij serveert de dashboard-pagina (index.html).
 *   2. Hij praat namens de browser met de Logiztik Alliance API's,
 *      zodat de Api-Key veilig op de server blijft en CORS geen probleem is.
 *
 * Geen externe dependencies nodig - alleen ingebouwde Node-modules.
 * Vereist Node.js 18 of hoger.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimale .env-loader (zodat 'dotenv' niet geinstalleerd hoeft te worden)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ---------------------------------------------------------------------------
// Configuratie
// ---------------------------------------------------------------------------
const CUSTOMER_CODE      = (process.env.CUSTOMER_CODE || '').trim();
const API_KEY            = (process.env.API_KEY || '').trim();
const API_KEY_HEADER     = (process.env.API_KEY_HEADER || 'Api-Key').trim();
const PORT               = parseInt(process.env.PORT || '3000', 10);
const ALLOW_INSECURE_TLS =
  String(process.env.ALLOW_INSECURE_TLS || 'false').toLowerCase() === 'true';

// Productie-endpoints van Logiztik Alliance (poort 5005).
const API_HOST = 'cloud.logiztikalliance.com';
const API_PORT = 5005;
const API_BASE = '/logCloudWS';

const SHIPMENT_PATH = (cc, date) =>
  `${API_BASE}/api/ClientesExternosA/ListarTotalesGuiasPorClienteV2/` +
  `${encodeURIComponent(cc)}/${encodeURIComponent(date)}`;

const BARCODE_PATH = (cc, shipment) =>
  `${API_BASE}/api/v2/ClientesExternosA/ListarCodigosDeBarraPorClienteNew/` +
  `${encodeURIComponent(cc)}/${encodeURIComponent(shipment)}`;

function enumerateDays(from, to) {
  const fD = new Date(from + 'T00:00:00Z');
  const tD = new Date(to   + 'T00:00:00Z');
  if (isNaN(fD) || isNaN(tD) || tD < fD) return null;
  const diff = Math.round((tD - fD) / 86400000);
  if (diff > 30) return null; // max 31 dagen
  const days = [];
  for (let i = 0; i <= diff; i++) {
    const d = new Date(fD.getTime() + i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Aanroep naar de Logiztik API
// ---------------------------------------------------------------------------
function callLogiztik(apiPath, headerName = API_KEY_HEADER, addTokenParam = true) {
  return new Promise((resolve) => {
    let path = apiPath;
    if (addTokenParam) {
      const sep = apiPath.indexOf('?') > -1 ? '&' : '?';
      path = apiPath + sep + 'token=' + encodeURIComponent(API_KEY);
    }

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        [headerName]: API_KEY,
      },
      rejectUnauthorized: !ALLOW_INSECURE_TLS,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); }
        catch { data = raw; } // bij niet-JSON (bv. de tekst "Unauthorized")
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

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({
        ok: false,
        status: 0,
        data: {
          error: 'Time-out: geen antwoord van de Logiztik API binnen 30 seconden. ' +
                 'Een mogelijke oorzaak is dat dit IP-adres niet is gewhitelist.',
        },
      });
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// HTTP-server (statische pagina + API-proxy)
// ---------------------------------------------------------------------------
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// Leest de request-body en parseert als JSON. Geeft undefined terug als leeg.
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) { resolve(undefined); return; }
      try { resolve(JSON.parse(data)); } catch { resolve(data); }
    });
  });
}

// Past res aan zodat api/*.js handlers (Vercel-stijl) werken met native Node res.
function addVercelMethods(req, res, body) {
  req.body = body;
  res.status = (code) => {
    const statusObj = {
      json: (obj) => sendJson(res, code, obj),
      end:  (text) => { res.writeHead(code); res.end(text || ''); },
    };
    return statusObj;
  };
  res.setHeader = res.setHeader.bind(res);
  return { req, res };
}

const requestHandler = async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://localhost:${PORT}`);
  } catch {
    res.writeHead(400); res.end('Ongeldig verzoek'); return;
  }

  // --- Dashboard-pagina ---
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('index.html niet gevonden naast server.js');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  // --- Config voor de UI ---
  if (req.method === 'GET' && url.pathname === '/api/config') {
    sendJson(res, 200, {
      customerCode:  CUSTOMER_CODE || null,
      environment:   'Productie',
      apiKeyHeader:  API_KEY_HEADER,
      configured:    Boolean(CUSTOMER_CODE && API_KEY),
      internalToken: (process.env.INTERNAL_TOKEN || '').trim() || null,
    });
    return;
  }

  // --- AWB-store (Postgres) ---
  if (url.pathname === '/api/awb-store') {
    const body = await readBody(req);
    const { req: r, res: s } = addVercelMethods(req, res, body);
    return require('./api/awb-store')(r, s);
  }

  // --- Akkoord-vlag ---
  if (url.pathname === '/api/akkoord') {
    const body = await readBody(req);
    const { req: r, res: s } = addVercelMethods(req, res, body);
    return require('./api/akkoord')(r, s);
  }

  // --- Cron refresh (handmatig triggeren lokaal) ---
  if (url.pathname === '/api/cron-refresh') {
    const body = await readBody(req);
    const { req: r, res: s } = addVercelMethods(req, res, body);
    return require('./api/cron-refresh')(r, s);
  }

  // --- Logo (doorsluizen naar api/logo.js als dat bestaat) ---
  if (url.pathname === '/api/logo') {
    try {
      const body = await readBody(req);
      const { req: r, res: s } = addVercelMethods(req, res, body);
      return require('./api/logo')(r, s);
    } catch {
      sendJson(res, 404, { error: 'Logo-endpoint niet beschikbaar.' });
      return;
    }
  }

  // --- Zendingen (Shipment Information V2) - 1 dag of een periode ---
  if (req.method === 'GET' && url.pathname === '/api/shipments') {
    const single = (url.searchParams.get('date') || '').trim();
    const from   = (url.searchParams.get('from') || '').trim();
    const to     = (url.searchParams.get('to')   || '').trim();
    const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    let dates = null;
    if (single) {
      if (!isDate(single)) {
        sendJson(res, 200, { ok: false, status: 400,
          data: { error: 'Ongeldige datum. Verwacht formaat: YYYY-MM-DD.' } });
        return;
      }
      dates = [single];
    } else if (from && to) {
      if (!isDate(from) || !isDate(to)) {
        sendJson(res, 200, { ok: false, status: 400,
          data: { error: 'Ongeldige datums. Verwacht formaat: YYYY-MM-DD.' } });
        return;
      }
      dates = enumerateDays(from, to);
      if (!dates) {
        sendJson(res, 200, { ok: false, status: 400,
          data: { error: 'Ongeldige of te grote periode (max 31 dagen, en "tot" moet >= "van" zijn).' } });
        return;
      }
    } else {
      sendJson(res, 200, { ok: false, status: 400,
        data: { error: 'Geef een datum (date=YYYY-MM-DD) of een periode (from=YYYY-MM-DD&to=YYYY-MM-DD).' } });
      return;
    }

    if (!CUSTOMER_CODE || !API_KEY) {
      sendJson(res, 200, { ok: false, status: 0,
        data: { error: 'Server niet geconfigureerd. Vul CUSTOMER_CODE en API_KEY in het .env-bestand in.' } });
      return;
    }

    if (dates.length === 1) {
      const result = await callLogiztik(SHIPMENT_PATH(CUSTOMER_CODE, dates[0]));
      sendJson(res, 200, result);
      return;
    }

    // Meerdere dagen: parallel ophalen en samenvoegen.
    const results = await Promise.all(
      dates.map(d => callLogiztik(SHIPMENT_PATH(CUSTOMER_CODE, d)))
    );
    let all = [];
    const dayErrors = [];
    results.forEach((r, i) => {
      if (!r.ok) {
        dayErrors.push({ date: dates[i], status: r.status, data: r.data });
        return;
      }
      const d = r.data;
      if (Array.isArray(d)) all = all.concat(d);
      else if (d && typeof d === 'object' && !d.error && !d.mensaje) all.push(d);
    });

    sendJson(res, 200, {
      ok: true,
      status: 200,
      data: all,
      meta: {
        requestedDates: dates,
        shipmentCount: all.length,
        errors: dayErrors,
      },
    });
    return;
  }

  // --- Colli/barcodes op zendingsnummer (Barcode Information V2) ---
  if (req.method === 'GET' && url.pathname === '/api/barcodes') {
    const shipment = (url.searchParams.get('shipment') || '').trim();
    if (!shipment) {
      sendJson(res, 200, { ok: false, status: 400,
        data: { error: 'Zendingsnummer ontbreekt.' } });
      return;
    }
    if (!CUSTOMER_CODE || !API_KEY) {
      sendJson(res, 200, { ok: false, status: 0,
        data: { error: 'Server niet geconfigureerd. Vul CUSTOMER_CODE en API_KEY in het .env-bestand in.' } });
      return;
    }
    // Barcode V2 uses 'APIkey' header (not 'Api-Key') and no ?token= in URL
    const result = await callLogiztik(BARCODE_PATH(CUSTOMER_CODE, shipment), 'APIkey', false);
    sendJson(res, 200, result);
    return;
  }

  // --- Tracking scraper (per carrier) ---
  if (req.method === 'GET' && url.pathname === '/api/track') {
    const { req: r, res: s } = addVercelMethods(req, res, null);
    return require('./api/track')(r, s);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Niet gevonden');
};

// Exporteer voor Vercel serverless
module.exports = requestHandler;

// Voor lokale ontwikkeling: draai als normale http server
if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    const line = '-'.repeat(52);
    console.log('\n' + line);
    console.log('  Logiztik Shipment Viewer - lokale proxy');
    console.log(line);
    console.log('  Open in je browser :  http://localhost:' + PORT);
    console.log('  Klant              :  ' + (CUSTOMER_CODE || '(niet ingesteld!)'));
    console.log('  Omgeving           :  Productie');
    console.log('  Api-Key header     :  ' + API_KEY_HEADER);
    console.log('  TLS-verificatie    :  ' + (ALLOW_INSECURE_TLS ? 'UIT (onveilig)' : 'aan'));
    console.log('  Stoppen            :  Ctrl + C');
    console.log(line);
    if (!CUSTOMER_CODE || !API_KEY) {
      console.log('  LET OP: CUSTOMER_CODE of API_KEY ontbreekt.');
      console.log('  Kopieer .env.example naar .env en vul je gegevens in.');
      console.log(line);
    }
    console.log('');
  });
}
