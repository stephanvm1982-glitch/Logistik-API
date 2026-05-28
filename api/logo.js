/**
 * GET    /api/logo   → { ok, data: "data:image/...;base64,..." | null }
 * POST   /api/logo   body: { image: "data:image/...;base64,..." }  → upload/replace
 * DELETE /api/logo   → removes stored logo
 *
 * KV key: logo:custom (no TTL – permanent)
 */

const { kvGet, kvSet, kvDel } = require('../lib/kv');

const KEY = 'logo:custom';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const stored = await kvGet(KEY);
    return res.status(200).json({ ok: true, data: stored || null });
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
    // Sanity check size (base64 of ~500KB image ≈ 680KB string)
    if (image.length > 900000) {
      return res.status(400).json({ error: 'Afbeelding te groot. Max ~650KB na compressie.' });
    }
    await kvSet(KEY, image, 0); // 0 = no TTL
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await kvDel(KEY);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
