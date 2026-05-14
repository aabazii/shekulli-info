const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, message: 'Missing ?id=' });

  try {
    // Remove from posts list
    const posts = (await kv.get('posts')) || [];
    const filtered = posts.filter(p => String(p.id) !== String(id));
    await kv.set('posts', filtered);

    // Add to permanent blocklist so scraper never re-adds it
    const blocklist = (await kv.get('deleted_ids')) || [];
    if (!blocklist.includes(String(id))) {
      blocklist.push(String(id));
      await kv.set('deleted_ids', blocklist);
    }

    res.json({ ok: true, message: `Deleted post ${id}. ${filtered.length} posts remaining.` });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
