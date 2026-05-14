/**
 * One-shot endpoint: strip "See more" / "Shiko më shumë" / "Comment" / "Like" / "Share"
 * and trailing ellipsis from all post titles, standfirsts and bodies in KV.
 * POST /api/admin/fix-posts   (auth required)
 */
const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

const JUNK = 'See more|Shiko më shumë|Comment|Like|Share|Koment|Pëlqej|Shpërnda';

function clean(str) {
  return (str || '')
    // "...See more" or "… Comment" etc. at the end
    .replace(new RegExp(`[…\\.]{1,}\\s*(${JUNK})\\s*$`, 'gi'), '…')
    // standalone junk word at the end
    .replace(new RegExp(`\\s*(${JUNK})\\s*$`, 'gi'), '')
    // junk mid-string (e.g. "...See more read on")
    .replace(new RegExp(`\\.{2,}\\s*(${JUNK})[^a-zA-ZëäöüÄÖÜ]*`, 'gi'), '')
    .replace(new RegExp(`\\s*(${JUNK})\\s*`, 'gi'), ' ')
    // trailing ellipsis artefact
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
