'use strict';

/**
 * GET /api/config
 * Geeft configuratie-info terug voor de UI (geen geheimen, behalve INTERNAL_TOKEN
 * die de frontend nodig heeft voor beveiligde write-calls).
 */

function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    customerCode:  process.env.CUSTOMER_CODE || null,
    environment:   'Productie',
    apiKeyHeader:  process.env.API_KEY_HEADER || 'Api-Key',
    configured:    Boolean(process.env.CUSTOMER_CODE && process.env.API_KEY),
    internalToken: process.env.INTERNAL_TOKEN || null,
    // Welke tracking-scrapers zijn beschikbaar op het backend
    scraperCapabilities: {
      atlas:        true,                               // jumpseat.atlasair.com, gratis
      flightaware:  Boolean((process.env.FA_API_KEY || '').trim()),
      trackingmore: Boolean((process.env.TRACKINGMORE_API_KEY || '').trim()),
    },
  });
}

module.exports = handler;
