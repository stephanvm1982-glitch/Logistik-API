/**
 * Vercel KV (Upstash Redis) wrapper
 * Uses the pipeline API so values travel in the request body, not the URL path.
 * This avoids URL-length limits for large JSON blobs.
 */

let memoryStore = {};

async function kvPipeline(commands) {
  if (process.env.KV_REST_API_URL) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    try {
      const response = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
        signal: ctrl.signal,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
      });
      if (!response.ok) {
        throw new Error(`KV pipeline HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(to);
    }
  }

  // In-memory mock for local dev (no KV_REST_API_URL set)
  return commands.map(([cmd, key, val, ex, ttl]) => {
    const c = String(cmd).toUpperCase();
    if (c === 'GET') {
      return { result: memoryStore[key] !== undefined ? memoryStore[key] : null };
    }
    if (c === 'SET') {
      memoryStore[key] = val;
      if (ex === 'EX' && ttl > 0) {
        setTimeout(() => { delete memoryStore[key]; }, ttl * 1000);
      }
      return { result: 'OK' };
    }
    if (c === 'DEL') {
      delete memoryStore[key];
      return { result: 1 };
    }
    return { result: null };
  });
}

async function kvGet(key) {
  const results = await kvPipeline([['GET', key]]);
  return results[0]?.result ?? null;
}

/**
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds  0 = permanent (no expiry)
 */
async function kvSet(key, value, ttlSeconds = 3600) {
  const cmd = ttlSeconds > 0
    ? ['SET', key, value, 'EX', ttlSeconds]
    : ['SET', key, value];
  await kvPipeline([cmd]);
}

async function kvGetJSON(key) {
  const val = await kvGet(key);
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

async function kvSetJSON(key, obj, ttlSeconds = 3600) {
  await kvSet(key, JSON.stringify(obj), ttlSeconds);
}

async function kvDel(key) {
  await kvPipeline([['DEL', key]]);
}

module.exports = { kvGet, kvSet, kvGetJSON, kvSetJSON, kvDel, kvPipeline };
