/**
 * GET /api/barcodes
 * Accepts ?shipment=SHIPMENTNR
 * Returns barcode/colli data from Logiztik API
 */

const { callLogiztik, BARCODE_PATH } = require('../lib/logiztik');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shipment } = req.query;
  const shipmentNr = (shipment || '').trim();

  if (!shipmentNr) {
    return res.status(200).json({
      ok: false,
      status: 400,
      data: { error: 'Zendingsnummer ontbreekt.' },
    });
  }

  const CUSTOMER_CODE = process.env.CUSTOMER_CODE || '';
  const API_KEY = process.env.API_KEY || '';
  const API_KEY_HEADER = process.env.API_KEY_HEADER || 'Api-Key';

  console.log('[/api/barcodes] DEBUG:', {
    shipmentNr,
    CUSTOMER_CODE: CUSTOMER_CODE ? 'SET' : 'MISSING',
    API_KEY: API_KEY ? 'SET (len=' + API_KEY.length + ')' : 'MISSING',
    API_KEY_HEADER,
  });

  if (!CUSTOMER_CODE || !API_KEY) {
    return res.status(200).json({
      ok: false,
      status: 0,
      data: { error: 'Server niet geconfigureerd. CUSTOMER_CODE en API_KEY ontbreken.' },
    });
  }

  const apiPath = BARCODE_PATH(CUSTOMER_CODE, shipmentNr);
  console.log('[/api/barcodes] API path:', apiPath);

  const result = await callLogiztik(apiPath, API_KEY, API_KEY_HEADER);
  console.log('[/api/barcodes] Result:', { ok: result.ok, status: result.status, dataKeys: Object.keys(result.data || {}) });

  res.status(200).json(result);
}

module.exports = handler;
