/**
 * Cron job: GET /api/cron-refresh
 * Runs every 5 minutes to refresh shipment data
 * Triggered by Vercel cron (vercel.json)
 *
 * Updates KV store with latest shipments for today and past dates
 */

const { callLogiztik, SHIPMENT_PATH } = require('../lib/logiztik');
const { kvGetJSON, kvSetJSON } = require('../lib/kv');

async function handler(req, res) {
  // Cron jobs should only accept POST from Vercel
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CUSTOMER_CODE = process.env.CUSTOMER_CODE || '';
  const API_KEY = process.env.API_KEY || '';
  const API_KEY_HEADER = process.env.API_KEY_HEADER || 'Api-Key';

  if (!CUSTOMER_CODE || !API_KEY) {
    return res.status(200).json({
      ok: false,
      error: 'Server nicht geconfigureerd. CUSTOMER_CODE en API_KEY ontbreken.',
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  const dates = [today, yesterday, twoDaysAgo];
  const results = [];

  for (const date of dates) {
    try {
      const result = await callLogiztik(
        SHIPMENT_PATH(CUSTOMER_CODE, date),
        API_KEY,
        API_KEY_HEADER
      );

      if (result.ok && Array.isArray(result.data)) {
        results.push({
          date,
          shipmentCount: result.data.length,
          shipments: result.data,
        });

        await kvSetJSON(`shipments:${date}`, result.data, 86400);

        // Persist to permanent AWB store (no TTL)
        const awbStore = await kvGetJSON('awb:all') || {};
        const today = new Date().toISOString().slice(0, 10);
        result.data.forEach(s => {
          if (!s || !s.awb) return;
          const ex = awbStore[s.awb] || {};
          awbStore[s.awb] = {
            ...s,
            akkoord: ex.akkoord || false,
            firstSeen: ex.firstSeen || date,
            lastUpdated: today,
          };
        });
        await kvSetJSON('awb:all', awbStore, 0);
      } else {
        results.push({
          date,
          error: result.data?.error || 'Unknown error',
          shipmentCount: 0,
        });
      }
    } catch (err) {
      results.push({
        date,
        error: err.message,
        shipmentCount: 0,
      });
    }
  }

  const summary = {
    refreshedAt: new Date().toISOString(),
    results,
  };

  await kvSetJSON('cron:last-refresh', summary);

  res.status(200).json({
    ok: true,
    refreshedAt: new Date().toISOString(),
    dates,
    summary: results,
  });
}

module.exports = handler;
