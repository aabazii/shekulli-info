/**
 * Consolidated admin utility endpoint.
 * POST /api/admin/utils?action=fix-posts|fix-timestamps|clear
 */
const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

const JUNK = 'See more|Shiko më shumë|Comment|Like|Share|Koment|Pëlqej|Shpërnda';

function cleanText(str) {
  return (str || '')
    .replace(new RegExp(`[…\\.]{1,}\\s*(${JUNK})\\s*$`, 'gi'), '…')
    .replace(new RegExp(`\\s*(${JUNK})\\s*$`, 'gi'), '')
    .replace(new RegExp(`\\.{2,}\\s*(${JUNK})[^a-zA-ZëäöüÄÖÜ]*`, 'gi'), '')
    .replace(new RegExp(`\\s*(${JUNK})\\s*`, 'gi'), ' ')
    .replace(/[…\.]{2,}\s*$/, '…')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false });

  const action = req.query?.action;

  if (action === 'fix-posts') {
    const posts = (await kv.get('posts')) || [];
    let fixed = 0;
    const updated = posts.map(p => {
      const t = cleanText(p.title), s = cleanText(p.standfirst), b = cleanText(p.body);
      if (t !== p.title || s !== p.standfirst) fixed++;
      return { ...p, title: t, standfirst: s, body: b };
    });
    await kv.set('posts', updated);
    return res.json({ ok: true, message: `Fixed ${fixed} of ${posts.length} posts` });
  }

  if (action === 'fix-timestamps') {
    const posts = (await kv.get('posts')) || [];
    const fixed = posts.map(p => ({ ...p, published: p.published < 1e12 ? p.published * 1000 : p.published }));
    await kv.set('posts', fixed);
    return res.json({ ok: true, message: `Fixed timestamps on ${fixed.length} posts` });
  }

  if (action === 'clear') {
    await kv.set('posts', []);
    return res.json({ ok: true, message: 'All posts cleared.' });
  }

  return res.status(400).json({ ok: false, message: 'Unknown action. Use ?action=fix-posts|fix-timestamps|clear' });
};
