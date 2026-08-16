import { kvGet, kvSet } from '../lib/kv.js';
import { json, cors } from '../lib/response.js';
import { mirrorImage } from '../lib/r2.js';
import { guessCategory } from '../lib/category.js';
import { checkRateLimit } from '../lib/rateLimit.js';

const GRAPH_VER = 'v21.0';
const FB_PAGE_ID = 'shekulliinfo';
const AUTH_ERROR_CODES = new Set([102, 104, 190, 463, 467]);

async function clearTokenCache(env) {
  await Promise.all([
    env.KV.delete('fb_permanent_token'),
    env.KV.delete('fb_longlived_token'),
  ]);
}

function clean(text) {
  return (text || '')
    .replace(/\s*(\.{3}|…)\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .replace(/\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .trim();
}

async function resolveToken(env, headerToken) {
  const cached = await env.KV.get('fb_permanent_token');
  if (cached) return cached;

  const baseToken = headerToken || env.FB_PAGE_TOKEN;
  const kvLongLived = await env.KV.get('fb_longlived_token');
  let sourceToken = kvLongLived || baseToken;
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

    // If KV long-lived token is stale, clear it and retry with the env base token
    if (ltData.error && kvLongLived && baseToken && baseToken !== kvLongLived) {
      console.warn('[Token] Cached long-lived token stale, retrying with env token');
      await env.KV.delete('fb_longlived_token');
      sourceToken = baseToken;
      const retryRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VER}/oauth/access_token` +
        `?grant_type=fb_exchange_token&client_id=${FB_APP_ID}` +
        `&client_secret=${FB_APP_SECRET}&fb_exchange_token=${sourceToken}`
      );
      const retryData = await retryRes.json();
      if (retryData.access_token) {
        ltData.access_token = retryData.access_token;
        ltData.error = null;
      } else {
        console.warn('[Token] Env token exchange also failed:', retryData.error?.message);
        return sourceToken;
      }
    }

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
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.error) throw Object.assign(new Error(data.error.message), { code: data.error.code });
      return data.data || [];
    } catch (e) {
      lastErr = e;
      if (e.code !== undefined) throw e; // API error — don't retry
    }
  }
  throw lastErr;
}

export async function handleScrape(request, env) {
  if (request.method === 'OPTIONS') return cors();

  const authHeader = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!env.ADMIN_PASSWORD || authHeader !== env.ADMIN_PASSWORD) {
    return json({ ok: false, message: 'Unauthorized' }, 401);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!await checkRateLimit(env, `scrape:${ip}`, 5, 60)) {
    return json({ ok: false, message: 'Rate limit exceeded — wait a minute' }, 429);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('reset') === 'token') {
    await clearTokenCache(env);
    return json({ ok: true, message: 'Cached tokens cleared (both permanent and long-lived)' });
  }

  try {
    const headerToken = request.headers.get('x-fb-token') || null;
    const token = await resolveToken(env, headerToken);
    if (!token) return json({ ok: false, message: 'FB_PAGE_TOKEN not set' }, 500);

    let fbPosts;
    try {
      fbPosts = await fetchPosts(token);
    } catch (tokenErr) {
      if (AUTH_ERROR_CODES.has(tokenErr.code)) {
        await clearTokenCache(env);
        console.error(`[Scrape] Auth error ${tokenErr.code} — cleared token cache for self-recovery`);
      }
      throw tokenErr;
    }

    if (fbPosts.length === 0) return json({ ok: true, message: 'No posts from API' });

    const raw = [];
    for (const p of fbPosts) {
      // Accept posts that have a message OR at least an attachment (image/link/video).
      const hasMessage = !!(p.message || '').trim();
      const hasAttachment = (p.attachments?.data || []).length > 0 || !!p.full_picture;
      if (!hasMessage && !hasAttachment) continue;

      const rawText = (p.message || '').trim();
      const cat      = guessCategory(rawText || (p.attachments?.data?.[0]?.type || ''));
      const fullText = clean(rawText || '');
      const lines    = fullText.split('\n').map(l => l.trim()).filter(Boolean);

      // Derive a title: prefer the first message line, otherwise synthesize one for attachment-only posts
      let title = (lines[0] || '').slice(0, 140).trim();
      if (!title && hasAttachment) {
        const att = p.attachments?.data?.[0];
        const attType = att?.type || (p.full_picture ? 'photo' : 'post');
        const datePart = new Date(p.created_time).toISOString().slice(0, 10);
        title = `${attType.charAt(0).toUpperCase() + attType.slice(1)} — ${datePart}`;
      }
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

    // Comment the shekulli.info article link on each newly-scraped Facebook post
    if (toAdd.length > 0 && token) {
      await Promise.allSettled(toAdd.map(article => {
        const params = new URLSearchParams({
          message: `Lexo artikullin e plotë 👉 https://shekulli.info/article?id=${encodeURIComponent(String(article.id))}`,
          access_token: token,
        });
        return fetch(`https://graph.facebook.com/${GRAPH_VER}/${article.fb_post_id}/comments`, {
          method: 'POST',
          body: params,
          signal: AbortSignal.timeout(10000),
        }).catch(() => {});
      }));
    }

    const parts = [];
    if (added)   parts.push(`${added} new`);
    if (updated) parts.push(`${updated} updated`);
    return json({ ok: true, message: `✅ ${parts.join(', ')} (${merged.length} total)` });
  } catch (e) {
    console.error('Scrape error:', e);
    return json({ ok: false, message: 'Internal server error' }, 500);
  }
}
