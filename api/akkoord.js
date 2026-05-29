'use strict';

/**
 * POST /api/akkoord  body: { awb: string, value: boolean }
 * Zet de akkoord-vlag voor één AWB in Postgres.
 * Vereist INTERNAL_TOKEN in Authorization-header.
 */

const { query } = require('../lib/db');

function checkToken(req, res) {
  const token = (process.env.INTERNAL_TOKEN || '').trim();
  if (!token) return true;
  const header = req.headers['authorization'] || '';
  if (header === 'Bearer ' + token) return true;
  res.status(401).json({ error: 'Niet geautoriseerd.' });
  return false;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkToken(req, res)) return;

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

  try {
    const rows = await query(
      `UPDATE shipments SET akkoord=$1, last_updated=now()
       WHERE awb=$2 RETURNING awb`,
      [value, awb]
    );

    if (!rows.length) {
      return res.status(404).json({ error: `AWB ${awb} niet gevonden in de database` });
    }

    return res.status(200).json({ ok: true, awb, akkoord: value });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
