import { kvGet, kvSet } from '../lib/kv.js';
import { json, cors } from '../lib/response.js';
import { mirrorImage } from '../lib/r2.js';

const RSS_FEED = 'https://www.gazetaexpress.com/category/sport/feed/';

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`, 'i');
  const m  = xml.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2] || '').trim();
}

function extractItems(xml) {
  const items = [], re = /<item>([\s\S]*?)<\/item>/g;
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

export async function handleScrapeSport(request, env) {
  if (request.method === 'OPTIONS') return cors();

  const authHeader = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isCFCron     = request.headers.get('x-cf-cron') === '1';
  const ADMIN_PASS   = env.ADMIN_PASSWORD || 'shekulli2026';

  if (!isVercelCron && !isCFCron && authHeader !== ADMIN_PASS) {
    return json({ ok: false, message: 'Unauthorized' }, 401);
  }

  try {
    const feedRes = await fetch(RSS_FEED, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!feedRes.ok) throw new Error(`RSS fetch failed: ${feedRes.status}`);
    const xml = await feedRes.text();

    const items = extractItems(xml);
    if (items.length === 0) return json({ ok: true, message: 'No items in RSS feed' });

    const raw = [];
    for (const item of items) {
      const title = htmlToText(extractTag(item, 'title')).slice(0, 140).trim();
      if (!title) continue;
      const link    = extractTag(item, 'link').trim();
      const pubDate = extractTag(item, 'pubDate').trim();
      const desc    = extractTag(item, 'description');
      const content = extractTag(item, 'content:encoded') || desc;
      const photo   = extractImageSrc(desc) || extractImageSrc(content);
      const bodyRaw = htmlToText(content);
      const body    = bodyRaw.replace(/\s*The post .+appeared first on .+$/s, '').trim();
      const published = pubDate ? new Date(pubDate).getTime() : Date.now();
      if (isNaN(published)) continue;
      const slug = (link.split('/').filter(Boolean).pop() || `item-${published}`).slice(0, 80);
      raw.push({ id: `rss_sport_${slug}`, title, body, standfirst: body.slice(0, 300), photo, link, published });
    }

    if (raw.length === 0) return json({ ok: true, message: 'No processable items' });

    await Promise.all(raw.map(async item => {
      if (item.photo) item.photo = await mirrorImage(item.photo, item.id, env);
    }));

    const posts = raw.map(item => ({
      id: item.id, category: 'Sport', kicker: 'SPORT', title: item.title,
      standfirst: item.standfirst, body: item.body, photo: item.photo,
      hasVideo: false, postUrl: item.link, author: 'Gazeta Express', published: item.published,
    }));

    const existing    = await kvGet(env, 'posts') || [];
    const blocklist   = new Set(await kvGet(env, 'deleted_ids') || []);
    const existingMap = new Map(existing.map(p => [String(p.id), p]));

    let added = 0, updated = 0;
    const toAdd = [];

    for (const p of posts) {
      if (blocklist.has(p.id)) continue;
      const prev = existingMap.get(p.id);
      if (!prev) { toAdd.push(p); added++; }
      else {
        const photoNeedsMirror = prev.photo && (prev.photo.includes('vercel-storage.com') || prev.photo.includes('blob.vercel'));
        const bodyGrew = (p.body || '').length > (prev.body || '').length + 20;
        if (bodyGrew || photoNeedsMirror) { existingMap.set(p.id, { ...prev, ...p }); updated++; }
      }
    }

    if (added === 0 && updated === 0) {
      return json({ ok: true, message: `No new sport posts (${posts.length} checked)` });
    }

    const merged = [...toAdd, ...Array.from(existingMap.values())]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kvSet(env, 'posts', merged);

    const parts = [];
    if (added)   parts.push(`${added} new`);
    if (updated) parts.push(`${updated} updated`);
    return json({ ok: true, message: `✅ Sport: ${parts.join(', ')} (${merged.length} total)` });
  } catch (e) {
    console.error('Sport scrape error:', e);
    return json({ ok: false, message: e.message }, 500);
  }
}
