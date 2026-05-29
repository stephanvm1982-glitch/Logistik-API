/**
 * GET /api/barcodes?shipment=SHIPMENTNR
 * Returns colli/barcode data from Logiztik Barcode V2 endpoint.
 *
 * Per Logiztik support: Barcode V2 requires header-based auth only (no ?token= param)
 * and uses the header key "APIkey" (not "Api-Key" like Shipment V2).
 */

const { callLogiztik, BARCODE_PATH } = require('../lib/logiztik');

// Barcode V2 uses a different header key than Shipment V2
const BARCODE_HEADER = 'APIkey';

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

  if (!CUSTOMER_CODE || !API_KEY) {
    return res.status(200).json({
      ok: false,
      status: 0,
      data: { error: 'Server niet geconfigureerd. CUSTOMER_CODE en API_KEY ontbreken.' },
    });
  }

  // addTokenParam = false: Barcode V2 accepts header auth only, token in URL causes error
  const result = await callLogiztik(BARCODE_PATH(CUSTOMER_CODE, shipmentNr), API_KEY, BARCODE_HEADER, false);

  res.status(200).json(result);
}

module.exports = handler;
