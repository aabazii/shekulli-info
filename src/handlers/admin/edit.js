import { kvGet, kvSet } from '../../lib/kv.js';
import { json, cors, isAuthed } from '../../lib/response.js';

export async function handleEdit(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'PUT') return json({ ok: false, message: 'Method not allowed' }, 405);
  if (!isAuthed(request, env)) return json({ ok: false, message: 'Unauthorized' }, 401);

  try {
    const { article } = await request.json();
    if (!article || !article.id) return json({ ok: false, message: 'Missing article or id' }, 400);

    const existing = await kvGet(env, 'posts') || [];
    const idx      = existing.findIndex(p => String(p.id) === String(article.id));

    let posts;
    if (idx >= 0) {
      posts = [...existing];
      posts[idx] = { ...existing[idx], ...article };
    } else {
      posts = [article, ...existing].sort((a, b) => b.published - a.published).slice(0, 500);
    }

    await kvSet(env, 'posts', posts);
    return json({ ok: true, message: idx >= 0 ? 'updated' : 'created' });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}
