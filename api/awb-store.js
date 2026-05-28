/**
 * GET  /api/awb-store  → returns all permanently stored AWB records
 * POST /api/awb-store  → upserts an array of raw shipment objects
 *
 * KV key: awb:all  (no TTL – permanent)
 * Structure: { "<awb>": { ...rawFields, akkoord: bool, firstSeen: "YYYY-MM-DD", lastUpdated: "YYYY-MM-DD" } }
 */

const { kvGetJSON, kvSetJSON } = require('../lib/kv');

const STORE_KEY = 'awb:all';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const store = await kvGetJSON(STORE_KEY) || {};
    return res.status(200).json({ ok: true, data: store });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {
        return res.status(400).json({ error: 'Ongeldige JSON' });
      }
    }
    const shipments = Array.isArray(body)
      ? body
      : (body && Array.isArray(body.shipments) ? body.shipments : null);

    if (!shipments) {
      return res.status(400).json({ error: 'Verwacht een array van zendingen' });
    }

    const store = await kvGetJSON(STORE_KEY) || {};
    const today = new Date().toISOString().slice(0, 10);

    shipments.forEach(s => {
      if (!s || !s.awb) return;
      const existing = store[s.awb] || {};
      store[s.awb] = {
        ...s,
        akkoord: existing.akkoord || false,
        firstSeen: existing.firstSeen || today,
        lastUpdated: today,
      };
    });

    await kvSetJSON(STORE_KEY, store, 0); // 0 = no TTL
    return res.status(200).json({ ok: true, count: Object.keys(store).length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
