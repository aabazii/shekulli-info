import { kvGet, kvSet } from '../lib/kv.js';
import { json, cors } from '../lib/response.js';

export async function handleViews(request, env) {
  if (request.method === 'OPTIONS') return cors();

  if (request.method === 'POST') {
    try {
      const { id } = await request.json();
      if (!id) return json({ ok: false }, 400);
      const views = await kvGet(env, 'post_views') || {};
      views[String(id)] = (views[String(id)] || 0) + 1;
      await kvSet(env, 'post_views', views);
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, message: e.message }, 500);
    }
  }

  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);
      const views = await kvGet(env, 'post_views') || {};
      const ids = Object.entries(views)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([id]) => id);
      return json({ ids });
    } catch (e) {
      return json({ ok: false, message: e.message }, 500);
    }
  }

  return new Response(null, { status: 405 });
}
