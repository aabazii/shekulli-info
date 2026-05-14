const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

function guessCategory(text) {
  const t = (text || '').toLowerCase();
  if (/politik|qeveri|kuvend|parti|zgjedhj|premier|ministr|kryeministr|opozit/.test(t)) return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë|mitrovicë|gjakovë|ferizaj|gjilan/.test(t))          return 'Kosovë';
  if (/botë|ndërkombëtar|europë|shba|nato|onu|\beu\b|ukrainë|rusi|izrael|gaza/.test(t)) return 'Botë';
  if (/ekonomi|biznes|banka|inflacion|turizëm|eksport|import|treg|gdp/.test(t))          return 'Ekonomi';
  if (/sport|futboll|basketboll|tenis|kampionat|gol|ndeshje|skuadr/.test(t))            return 'Sport';
  if (/kulturë|art|muzikë|film|teatër|ekspozitë|libër|poet/.test(t))                    return 'Kulturë';
  if (/opinion|koment|editorial|analiz/.test(t))                                         return 'Opinion';
  return 'Lajme';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  try {
    const { posts } = req.body;
    if (!Array.isArray(posts)) return res.status(400).json({ ok: false, message: 'posts must be an array' });

    const validated = posts.map(p => {
      const text = p.text || p.title || '';
      const cat  = p.category || guessCategory(text);
      return {
        id:         String(p.id),
        fb_post_id: String(p.id),
        category:   cat,
        kicker:     cat.toUpperCase(),
        title:      p.title || text.slice(0, 140),
        standfirst: p.standfirst || text.slice(0, 300),
        body:       p.body || text,
        photo:      p.photo || p.image || '',
        hasVideo:   p.hasVideo || false,
        postUrl:    p.postUrl || '',
        author:     p.author || 'Shekulli.info',
        published:  p.published || Date.now(),
      };
    });

    const existing    = (await kv.get('posts')) || [];
    const existingIds = new Set(existing.map(p => String(p.id)));
    const newPosts    = validated.filter(p => !existingIds.has(p.id));

    if (newPosts.length === 0) return res.json({ ok: true, message: 'No new posts (all duplicates)' });

    const merged = [...newPosts, ...existing]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kv.set('posts', merged);
    res.json({ ok: true, message: `✅ Saved ${newPosts.length} new posts (${merged.length} total)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
