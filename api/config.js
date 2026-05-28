/**
 * GET /api/config
 * Returns configuration info (no secrets)
 */

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    customerCode: process.env.CUSTOMER_CODE || null,
    environment: 'Vercel',
    apiKeyHeader: process.env.API_KEY_HEADER || 'Api-Key',
    configured: Boolean(process.env.CUSTOMER_CODE && process.env.API_KEY),
  });
}
