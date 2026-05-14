/**
 * One-shot endpoint: strip "See more" / "Shiko më shumë" and trailing
 * ellipsis from all post titles and standfirsts in KV.
 * POST /api/admin/fix-posts   (auth required)
 */
const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

function clean(str) {
  return (str || '')
    .replace(/\.{2,}\s*(See more|Shiko më shumë)[^a-zA-ZëäöüÄÖÜ]*/gi, '')
    .replace(/\s*(See more|Shiko më shumë)\s*/gi, ' ')
    .replace(/\.{2,}\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false });

  const posts = (await kv.get('posts')) || [];
  let fixed = 0;

  const updated = posts.map(p => {
    const newTitle      = clean(p.title);
    const newStandfirst = clean(p.standfirst);
    const newBody       = clean(p.body);
    if (newTitle !== p.title || newStandfirst !== p.standfirst) fixed++;
    return { ...p, title: newTitle, standfirst: newStandfirst, body: newBody };
  });

  await kv.set('posts', updated);
  res.json({ ok: true, message: `Fixed ${fixed} posts out of ${posts.length} total` });
};
