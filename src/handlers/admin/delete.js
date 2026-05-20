import { kvGet, kvSet } from '../../lib/kv.js';
import { adminJson, cors, isAuthed } from '../../lib/response.js';

export async function handleDelete(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'DELETE') return adminJson({ ok: false, message: 'Method not allowed' }, 405);
  if (!isAuthed(request, env)) return adminJson({ ok: false, message: 'Unauthorized' }, 401);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return adminJson({ ok: false, message: 'Missing ?id=' }, 400);

  try {
    const posts    = await kvGet(env, 'posts') || [];
    const filtered = posts.filter(p => String(p.id) !== String(id));
    await kvSet(env, 'posts', filtered);

    const blocklist = await kvGet(env, 'deleted_ids') || [];
    if (!blocklist.includes(String(id))) {
      blocklist.push(String(id));
      await kvSet(env, 'deleted_ids', blocklist);
    }
    return adminJson({ ok: true, message: `Deleted post ${id}. ${filtered.length} posts remaining.` });
  } catch (e) {
    console.error('Delete error:', e);
    return adminJson({ ok: false, message: 'Internal server error' }, 500);
  }
}
