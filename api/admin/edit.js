const { kv } = require('@vercel/kv');

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'shekulli2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  if (auth !== ADMIN_PASS) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const { article } = req.body || {};
  if (!article || !article.id) return res.status(400).json({ ok: false, message: 'Missing article or id' });

  const existing = (await kv.get('posts')) || [];
  const idx = existing.findIndex(p => String(p.id) === String(article.id));

  let posts;
  if (idx >= 0) {
    posts = [...existing];
    posts[idx] = { ...existing[idx], ...article };
  } else {
    // New article — insert at the front sorted by published
    posts = [article, ...existing].sort((a, b) => b.published - a.published).slice(0, 500);
  }

  await kv.set('posts', posts);
  return res.json({ ok: true, message: idx >= 0 ? 'updated' : 'created' });
};
