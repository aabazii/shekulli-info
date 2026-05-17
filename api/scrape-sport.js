const { kv } = require('@vercel/kv');

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'shekulli2026';
const VERCEL_URL = 'https://shekulli.info';

const RSS_FEED = 'https://www.gazetaexpress.com/category/sport/feed/';

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  // Handles both plain and CDATA content
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2] || '').trim();
}

function extractItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

function extractImageSrc(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function htmlToText(html) {
  return html
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(p|div|br|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Image mirroring ───────────────────────────────────────────────────────────

async function mirrorImage(srcUrl, id) {
  if (!srcUrl) return '';
  try {
    const imgRes = await fetch(srcUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!imgRes.ok) return srcUrl;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 500) return srcUrl;
    const ext = srcUrl.includes('.png') ? 'png' : 'jpg';
    const uploadRes = await fetch(`${VERCEL_URL}/api/admin/upload?filename=sport-${id}.${ext}`, {
      method: 'POST',
      headers: { 'Content-Type': `image/${ext}`, 'Authorization': `Bearer ${ADMIN_PASS}` },
      body: buf,
      signal: AbortSignal.timeout(10000),
    });
    if (!uploadRes.ok) return srcUrl;
    const data = await uploadRes.json();
    return data.url || srcUrl;
  } catch {
    return srcUrl;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  if (!isVercelCron && auth !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  try {
    const feedRes = await fetch(RSS_FEED, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!feedRes.ok) throw new Error(`RSS fetch failed: ${feedRes.status}`);
    const xml = await feedRes.text();

    const items = extractItems(xml);
    if (items.length === 0) {
      return res.json({ ok: true, message: 'No items in RSS feed' });
    }

    // Build raw articles
    const raw = [];
    for (const item of items) {
      const title = htmlToText(extractTag(item, 'title')).slice(0, 140).trim();
      if (!title) continue;

      const link    = extractTag(item, 'link').trim();
      const pubDate = extractTag(item, 'pubDate').trim();
      const desc    = extractTag(item, 'description');
      const content = extractTag(item, 'content:encoded') || desc;

      // Image: first img src in description or content
      const photo = extractImageSrc(desc) || extractImageSrc(content);

      // Body text: content:encoded stripped of HTML
      const bodyRaw = htmlToText(content);
      // Remove "The post ... appeared first on Gazeta Express." trailer
      const body = bodyRaw.replace(/\s*The post .+appeared first on .+$/s, '').trim();
      const standfirst = body.slice(0, 300);

      const published = pubDate ? new Date(pubDate).getTime() : Date.now();
      if (isNaN(published)) continue;

      // Stable ID from the article URL slug
      const slug = (link.split('/').filter(Boolean).pop() || `item-${published}`).slice(0, 80);
      const id = `rss_sport_${slug}`;

      raw.push({ id, title, body, standfirst, photo, link, published });
    }

    if (raw.length === 0) {
      return res.json({ ok: true, message: 'No processable items' });
    }

    // Gazeta Express images are stable (no CDN expiry) — no mirroring needed

    const posts = raw.map(item => ({
      id:         item.id,
      category:   'Sport',
      kicker:     'SPORT',
      title:      item.title,
      standfirst: item.standfirst,
      body:       item.body,
      photo:      item.photo,
      hasVideo:   false,
      postUrl:    item.link,
      author:     'Gazeta Express',
      published:  item.published,
    }));

    // Merge with existing KV posts
    const existing  = (await kv.get('posts')) || [];
    const blocklist = new Set((await kv.get('deleted_ids')) || []);
    const existingMap = new Map(existing.map(p => [String(p.id), p]));

    let added = 0, updated = 0;
    const toAdd = [];

    for (const p of posts) {
      if (blocklist.has(p.id)) continue;
      const prev = existingMap.get(p.id);
      if (!prev) {
        toAdd.push(p);
        added++;
      } else {
        const photoNeedsMirror = prev.photo && !prev.photo.includes(VERCEL_URL) && p.photo && p.photo.includes(VERCEL_URL);
        const bodyGrew = (p.body || '').length > (prev.body || '').length + 20;
        if (bodyGrew || photoNeedsMirror) {
          existingMap.set(p.id, { ...prev, ...p });
          updated++;
        }
      }
    }

    if (added === 0 && updated === 0) {
      return res.json({ ok: true, message: `No new sport posts (${posts.length} checked)` });
    }

    const merged = [...toAdd, ...Array.from(existingMap.values())]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kv.set('posts', merged);

    const parts = [];
    if (added)   parts.push(`${added} new`);
    if (updated) parts.push(`${updated} updated`);
    return res.json({ ok: true, message: `✅ Sport: ${parts.join(', ')} (${merged.length} total)` });

  } catch (err) {
    console.error('Sport scrape error:', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
