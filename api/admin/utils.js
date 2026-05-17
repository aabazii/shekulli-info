/**
 * Consolidated admin utility endpoint.
 * POST /api/admin/utils?action=fix-posts|fix-timestamps|clear|fix-images
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

  if (action === 'fix-images') {
    const VERCEL_URL = 'https://shekulli.info';
    const GRAPH_VER  = 'v21.0';
    const token_fb   = await kv.get('fb_permanent_token') || await kv.get('fb_longlived_token') || process.env.FB_PAGE_TOKEN;

    const posts = (await kv.get('posts')) || [];
    const broken = posts.filter(p =>
      p.photo && (p.photo.includes('vercel-storage.com') || p.photo.includes('blob.vercel') || !p.photo)
    );

    if (broken.length === 0) {
      return res.json({ ok: true, message: 'No broken images found' });
    }

    // Fetch fresh photos from FB Graph API for FB posts
    const fbIds = broken.filter(p => p.fb_post_id).map(p => p.fb_post_id);
    const freshPhotos = {};

    if (token_fb && fbIds.length > 0) {
      for (let i = 0; i < fbIds.length; i += 20) {
        const batch = fbIds.slice(i, i + 20);
        const ids = batch.join(',');
        try {
          const r = await fetch(
            `https://graph.facebook.com/${GRAPH_VER}?ids=${ids}&fields=full_picture&access_token=${token_fb}`,
            { signal: AbortSignal.timeout(10000) }
          );
          const data = await r.json();
          for (const [id, val] of Object.entries(data)) {
            if (val.full_picture) freshPhotos[id] = val.full_picture;
          }
        } catch { /* continue */ }
      }
    }

    // Mirror each broken post's photo to R2
    let fixed = 0;
    const postMap = new Map(posts.map(p => [p.id, p]));

    await Promise.all(broken.map(async p => {
      const freshUrl = (p.fb_post_id && freshPhotos[p.fb_post_id]) || p.photo;
      if (!freshUrl || freshUrl.includes('vercel-storage.com') || freshUrl.includes('blob.vercel')) return;
      try {
        const ext = freshUrl.includes('.png') ? 'png' : 'jpg';
        const imgRes = await fetch(freshUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
        if (!imgRes.ok) return;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length < 500) return;
        const uploadRes = await fetch(`${VERCEL_URL}/api/admin/upload?filename=fix-${p.published}.${ext}`, {
          method: 'POST',
          headers: { 'Content-Type': `image/${ext}`, 'Authorization': `Bearer ${ADMIN_PASSWORD}` },
          body: buf,
          signal: AbortSignal.timeout(10000),
        });
        if (!uploadRes.ok) return;
        const data = await uploadRes.json();
        if (data.url) {
          postMap.get(p.id).photo = data.url;
          fixed++;
        }
      } catch { /* continue */ }
    }));

    await kv.set('posts', Array.from(postMap.values()));
    return res.json({ ok: true, message: `Fixed ${fixed} of ${broken.length} broken images` });
  }

  return res.status(400).json({ ok: false, message: 'Unknown action. Use ?action=fix-posts|fix-timestamps|clear|fix-images' });
};
