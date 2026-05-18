import { kvGet } from '../lib/kv.js';
import { json } from '../lib/response.js';

export async function handleArticles(request, env) {
  try {
    const posts = await kvGet(env, 'posts') || [];
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const limit  = parseInt(url.searchParams.get('limit')  || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    let filtered = category ? posts.filter(p => p.category === category) : posts;
    filtered = filtered.slice(offset, offset + limit);
    return json(filtered);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
