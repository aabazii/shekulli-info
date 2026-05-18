import { kvGet, kvSet } from '../../lib/kv.js';
import { json, cors, isAuthed } from '../../lib/response.js';
import { mirrorImage } from '../../lib/r2.js';

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

export async function handleUtils(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!isAuthed(request, env)) return json({ ok: false }, 401);

  const action = new URL(request.url).searchParams.get('action');

  if (action === 'fix-posts') {
    const posts   = await kvGet(env, 'posts') || [];
    let fixed = 0;
    const updated = posts.map(p => {
      const t = cleanText(p.title), s = cleanText(p.standfirst), b = cleanText(p.body);
      if (t !== p.title || s !== p.standfirst) fixed++;
      return { ...p, title: t, standfirst: s, body: b };
    });
    await kvSet(env, 'posts', updated);
    return json({ ok: true, message: `Fixed ${fixed} of ${posts.length} posts` });
  }

  if (action === 'fix-timestamps') {
    const posts = await kvGet(env, 'posts') || [];
    const fixed = posts.map(p => ({ ...p, published: p.published < 1e12 ? p.published * 1000 : p.published }));
    await kvSet(env, 'posts', fixed);
    return json({ ok: true, message: `Fixed timestamps on ${fixed.length} posts` });
  }

  if (action === 'clear') {
    await kvSet(env, 'posts', []);
    return json({ ok: true, message: 'All posts cleared.' });
  }

  if (action === 'fix-images') {
    const GRAPH_VER = 'v21.0';
    const token_fb  = await env.KV.get('fb_permanent_token') || await env.KV.get('fb_longlived_token') || env.FB_PAGE_TOKEN;

    const posts  = await kvGet(env, 'posts') || [];
    const broken = posts.filter(p => !p.photo || p.photo.includes('vercel-storage.com') || p.photo.includes('blob.vercel'));
    if (broken.length === 0) return json({ ok: true, message: 'No broken images found' });

    const fbIds = broken.filter(p => p.fb_post_id).map(p => p.fb_post_id);
    const freshPhotos = {};

    if (token_fb && fbIds.length > 0) {
      for (let i = 0; i < fbIds.length; i += 20) {
        const batch = fbIds.slice(i, i + 20).join(',');
        try {
          const r = await fetch(
            `https://graph.facebook.com/${GRAPH_VER}?ids=${batch}&fields=full_picture&access_token=${token_fb}`,
            { signal: AbortSignal.timeout(10000) }
          );
          const data = await r.json();
          for (const [id, val] of Object.entries(data)) {
            if (val.full_picture) freshPhotos[id] = val.full_picture;
          }
        } catch { /* continue */ }
      }
    }

    let fixed = 0;
    const postMap = new Map(posts.map(p => [p.id, p]));

    await Promise.all(broken.map(async p => {
      const freshUrl = (p.fb_post_id && freshPhotos[p.fb_post_id]) || p.photo;
      if (!freshUrl || freshUrl.includes('vercel-storage.com') || freshUrl.includes('blob.vercel')) return;
      const mirrored = await mirrorImage(freshUrl, `fix-${p.published}`, env);
      if (mirrored !== freshUrl) { postMap.get(p.id).photo = mirrored; fixed++; }
    }));

    await kvSet(env, 'posts', Array.from(postMap.values()));
    return json({ ok: true, message: `Fixed ${fixed} of ${broken.length} broken images` });
  }

  return json({ ok: false, message: 'Unknown action. Use ?action=fix-posts|fix-timestamps|clear|fix-images' }, 400);
}
