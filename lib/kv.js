/**
 * Vercel KV (Redis) wrapper for storing shipment records
 * In local development, uses a simple in-memory mock
 */

// Mock in-memory store for local development
let memoryStore = {};

/**
 * Get a value from KV store
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function kvGet(key) {
  if (process.env.VERCEL_ENV === 'production' || process.env.KV_REST_API_URL) {
    // Use Vercel KV
    const response = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
    const data = await response.json();
    return data.result || null;
  }
  // Mock store
  return memoryStore[key] || null;
}

/**
 * Set a value in KV store with TTL
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 * @returns {Promise<void>}
 */
async function kvSet(key, value, ttlSeconds = 3600) {
  if (process.env.VERCEL_ENV === 'production' || process.env.KV_REST_API_URL) {
    // Use Vercel KV
    const cmd = ttlSeconds
      ? `set/${key}/${value}/EX/${ttlSeconds}`
      : `set/${key}/${value}`;
    await fetch(`${process.env.KV_REST_API_URL}/${cmd}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
  } else {
    // Mock store
    memoryStore[key] = value;
    if (ttlSeconds) {
      setTimeout(() => { delete memoryStore[key]; }, ttlSeconds * 1000);
    }
  }
}

/**
 * Get and parse JSON from KV store
 * @param {string} key
 * @returns {Promise<object|null>}
 */
async function kvGetJSON(key) {
  const val = await kvGet(key);
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * Set JSON in KV store
 * @param {string} key
 * @param {object} obj
 * @param {number} ttlSeconds
 * @returns {Promise<void>}
 */
async function kvSetJSON(key, obj, ttlSeconds = 3600) {
  await kvSet(key, JSON.stringify(obj), ttlSeconds);
}

module.exports = {
  kvGet,
  kvSet,
  kvGetJSON,
  kvSetJSON,
};
