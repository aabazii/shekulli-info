const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false });

  const posts = (await kv.get('posts')) || [];
  const fixed = posts.map(p => ({
    ...p,
    published: p.published < 1e12 ? p.published * 1000 : p.published
  }));
  await kv.set('posts', fixed);
  res.json({ ok: true, message: `Fixed ${fixed.length} posts` });
};
