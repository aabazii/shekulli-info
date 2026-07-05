import { json, cors } from '../lib/response.js';

export async function handleViews(request) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method === 'POST') return json({ ok: true });
  if (request.method === 'GET') return json({ ids: [], views: {} });
  return new Response(null, { status: 405 });
}
