import { kvGet, kvSet } from '../lib/kv.js';
import { json, cors } from '../lib/response.js';
import { mirrorImage } from '../lib/r2.js';
import { guessCategory } from '../lib/category.js';

const GRAPH_VER = 'v21.0';
const FB_PAGE_ID = 'shekulliinfo';

function clean(text) {
  return (text || '')
    .replace(/\s*(\.{3}|…)\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .replace(/\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .trim();
}

async function resolveToken(env, headerToken) {
  const cached = await env.KV.get('fb_permanent_token');
  if (cached) return cached;

  const kvLongLived = await env.KV.get('fb_longlived_token');
  const sourceToken = kvLongLived || headerToken || env.FB_PAGE_TOKEN;
  if (!sourceToken) return null;

  const { FB_APP_ID, FB_APP_SECRET } = env;
  if (!FB_APP_ID || !FB_APP_SECRET) return sourceToken;

  try {
    const ltRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${FB_APP_ID}` +
      `&client_secret=${FB_APP_SECRET}&fb_exchange_token=${sourceToken}`
    );
    const ltData = await ltRes.json();
    const longLivedToken = ltData.access_token || sourceToken;
    if (ltData.access_token) await env.KV.put('fb_longlived_token', longLivedToken);

    const acctRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/me/accounts?access_token=${longLivedToken}`
    );
    const acctData = await acctRes.json();
    if (!acctData.data?.length) return longLivedToken;

    const page = acctData.data.find(p => /shekulli/i.test(p.name)) || acctData.data[0];
    await env.KV.put('fb_permanent_token', page.access_token);
    return page.access_token;
  } catch (e) {
    console.warn('Token exchange failed:', e.message);
    return sourceToken;
  }
}

async function fetchPosts(token) {
  const fields = 'id,message,full_picture,attachments{type,media,url},created_time,permalink_url';
  const url = `https://graph.facebook.com/${GRAPH_VER}/${FB_PAGE_ID}/posts?fields=${fields}&limit=30&access_token=${token}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (data.error) throw Object.assign(new Error(data.error.message), { code: data.error.code });
  return data.data || [];
}

export async function handleScrape(request, env) {
  if (request.method === 'OPTIONS') return cors();

  const authHeader   = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isCFCron     = request.headers.get('x-cf-cron') === '1';
  const ADMIN_PASS   = env.ADMIN_PASSWORD || 'shekulli2026';

  if (!isVercelCron && !isCFCron && authHeader !== ADMIN_PASS) {
    return json({ ok: false, message: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('reset') === 'token') {
    await env.KV.delete('fb_permanent_token');
    return json({ ok: true, message: 'Cached token cleared' });
  }

  try {
    const headerToken = request.headers.get('x-fb-token') || null;
    const token = await resolveToken(env, headerToken);
    if (!token) return json({ ok: false, message: 'FB_PAGE_TOKEN not set' }, 500);

    let fbPosts;
    try {
      fbPosts = await fetchPosts(token);
    } catch (tokenErr) {
      if (tokenErr.code === 190) await env.KV.delete('fb_permanent_token');
      throw tokenErr;
    }

    if (fbPosts.length === 0) return json({ ok: true, message: 'No posts from API' });

    const raw = [];
    for (const p of fbPosts) {
      const rawText = (p.message || '').trim();
      if (!rawText) continue;
      const cat      = guessCategory(rawText);
      const fullText = clean(rawText);
      const lines    = fullText.split('\n').map(l => l.trim()).filter(Boolean);
      const title    = (lines[0] || '').slice(0, 140).trim();
      if (!title) continue;
      const body       = lines.length > 1 ? lines.slice(1).join('\n\n') : fullText;
      const standfirst = body.slice(0, 300);
      let hasVideo = false, videoUrl = '';
      for (const att of (p.attachments?.data || [])) {
        if (/video/i.test(att.type || '')) { hasVideo = true; videoUrl = att.url || ''; break; }
      }
      raw.push({ p, cat, title, body, standfirst, hasVideo, videoUrl,
        published: new Date(p.created_time).getTime(), photo: p.full_picture || '' });
    }

    const posts = raw.map(({ p, cat, title, body, standfirst, hasVideo, videoUrl, published, photo }) => ({
      id: `fb_${p.id}`, fb_post_id: p.id, category: cat, kicker: cat.toUpperCase(),
      title, standfirst, body, photo, hasVideo, videoUrl: videoUrl || '',
      postUrl: p.permalink_url || '', author: 'Shekulli.info', published,
    }));

    if (posts.length === 0) return json({ ok: true, message: 'No processable posts found' });

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
        const hadSeeMore       = /see\s*more|shiko\s*më\s*shumë/i.test(prev.title + ' ' + prev.standfirst + ' ' + prev.body);
        const photoNeedsMirror = prev.photo && (prev.photo.includes('fbcdn.net') || prev.photo.includes('vercel-storage.com') || prev.photo.includes('blob.vercel'));
        if ((p.body || '').length > (prev.body || '').length + 20 || hadSeeMore || photoNeedsMirror) {
          existingMap.set(p.id, { ...prev, ...p });
          updated++;
        }
      }
    }

    await Promise.all([
      ...toAdd.map(async p => { if (p.photo) p.photo = await mirrorImage(p.photo, `fb-${p.published}`, env); }),
      ...Array.from(existingMap.values()).map(async p => {
        if (p.photo && (p.photo.includes('fbcdn.net') || p.photo.includes('vercel-storage.com') || p.photo.includes('blob.vercel'))) {
          p.photo = await mirrorImage(p.photo, `fb-${p.published}`, env);
        }
      }),
    ]);

    if (added === 0 && updated === 0) {
      return json({ ok: true, message: `No new posts (${posts.length} checked, all duplicates)` });
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const merged = [...toAdd, ...Array.from(existingMap.values())]
      .filter(p => (p.published || 0) >= cutoff)
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kvSet(env, 'posts', merged);

    const parts = [];
    if (added)   parts.push(`${added} new`);
    if (updated) parts.push(`${updated} updated`);
    return json({ ok: true, message: `✅ ${parts.join(', ')} (${merged.length} total)` });
  } catch (e) {
    console.error('Scrape error:', e);
    return json({ ok: false, message: e.message }, 500);
  }
}
