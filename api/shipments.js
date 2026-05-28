/**
 * GET /api/shipments
 * Accepts ?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns shipment data from KV cache (refreshed every 5min) or live API
 */

const { callLogiztik, enumerateDays, SHIPMENT_PATH } = require('../lib/logiztik');
const { kvGetJSON } = require('../lib/kv');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, from, to } = req.query;
  const single = (date || '').trim();
  const fromDate = (from || '').trim();
  const toDate = (to || '').trim();
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  let dates = null;
  if (single) {
    if (!isDate(single)) {
      return res.status(200).json({
        ok: false,
        status: 400,
        data: { error: 'Ongeldige datum. Verwacht formaat: YYYY-MM-DD.' },
      });
    }
    dates = [single];
  } else if (fromDate && toDate) {
    if (!isDate(fromDate) || !isDate(toDate)) {
      return res.status(200).json({
        ok: false,
        status: 400,
        data: { error: 'Ongeldige datums. Verwacht formaat: YYYY-MM-DD.' },
      });
    }
    dates = enumerateDays(fromDate, toDate);
    if (!dates) {
      return res.status(200).json({
        ok: false,
        status: 400,
        data: {
          error: 'Ongeldige of te grote periode (max 31 dagen, en "tot" moet >= "van" zijn).',
        },
      });
    }
  } else {
    return res.status(200).json({
      ok: false,
      status: 400,
      data: {
        error: 'Geef een datum (date=YYYY-MM-DD) of een periode (from=YYYY-MM-DD&to=YYYY-MM-DD).',
      },
    });
  }

  const CUSTOMER_CODE = process.env.CUSTOMER_CODE || '';
  const API_KEY = process.env.API_KEY || '';
  const API_KEY_HEADER = process.env.API_KEY_HEADER || 'Api-Key';

  if (!CUSTOMER_CODE || !API_KEY) {
    return res.status(200).json({
      ok: false,
      status: 0,
      data: { error: 'Server niet geconfigureerd. CUSTOMER_CODE en API_KEY ontbreken.' },
    });
  }

  async function fetchShipmentData(date) {
    // Try KV cache first
    try {
      const cached = await kvGetJSON(`shipments:${date}`);
      if (cached && Array.isArray(cached)) {
        return { ok: true, status: 200, data: cached, fromCache: true };
      }
    } catch (e) {
      // Fall through to live API
    }

    // Fall back to live API call
    const result = await callLogiztik(
      SHIPMENT_PATH(CUSTOMER_CODE, date),
      API_KEY,
      API_KEY_HEADER
    );
    return { ...result, fromCache: false };
  }

  if (dates.length === 1) {
    const result = await fetchShipmentData(dates[0]);
    return res.status(200).json({
      ok: result.ok,
      status: result.status,
      data: result.data,
      fromCache: result.fromCache,
    });
  }

  // Multiple dates: parallel fetch
  const results = await Promise.all(
    dates.map((d) => fetchShipmentData(d))
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

  res.status(200).json({
    ok: true,
    status: 200,
    data: all,
    meta: {
      requestedDates: dates,
      shipmentCount: all.length,
      errors: dayErrors,
    },
  });
}

module.exports = handler;
