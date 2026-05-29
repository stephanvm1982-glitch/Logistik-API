/**
 * GET    /api/logo   → { ok, data: "data:image/...;base64,..." | null }
 * POST   /api/logo   body: { image: "data:image/...;base64,..." }
 * DELETE /api/logo   → removes stored logo
 *
 * Stored in Postgres app_settings table (permanent, survives restarts).
 */

const { query } = require('../lib/db');

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`;

async function ensureTable() {
  await query(INIT_SQL);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const rows = await query(`SELECT value FROM app_settings WHERE key = 'logo:custom'`);
      const data = rows.length ? rows[0].value : null;
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {
          return res.status(400).json({ error: 'Ongeldige JSON' });
        }
      }
      const image = body && body.image;
      if (!image || !String(image).startsWith('data:image/')) {
        return res.status(400).json({ error: 'Verwacht { image: "data:image/..." }' });
      }
      if (image.length > 900000) {
        return res.status(400).json({ error: 'Afbeelding te groot. Max ~650KB na compressie.' });
      }
      await query(
        `INSERT INTO app_settings (key, value) VALUES ('logo:custom', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [image]
      );
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await query(`DELETE FROM app_settings WHERE key = 'logo:custom'`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[logo]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
