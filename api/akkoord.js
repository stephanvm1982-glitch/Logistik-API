/**
 * POST /api/akkoord  body: { awb: string, value: boolean }
 * Sets the akkoord flag for one AWB in the permanent store.
 */

const { kvGetJSON, kvSetJSON } = require('../lib/kv');

const STORE_KEY = 'awb:all';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ error: 'Ongeldige JSON' });
    }
  }

  const { awb, value } = body || {};
  if (!awb || typeof value !== 'boolean') {
    return res.status(400).json({ error: 'Verwacht { awb: string, value: boolean }' });
  }

  const store = await kvGetJSON(STORE_KEY) || {};
  if (!store[awb]) {
    return res.status(404).json({ error: `AWB ${awb} niet gevonden in de database` });
  }

  store[awb] = { ...store[awb], akkoord: value };
  await kvSetJSON(STORE_KEY, store, 0);

  return res.status(200).json({ ok: true, awb, akkoord: value });
}

module.exports = handler;
