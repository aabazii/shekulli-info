const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false });
    await kv.zincrby('post_views', 1, String(id));
    return res.json({ ok: true });
  }

  if (req.method === 'GET') {
    // Return top N most-viewed article IDs
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const ids = await kv.zrange('post_views', 0, limit - 1, { rev: true });
    return res.json({ ids: ids || [] });
  }

  res.status(405).end();
};
