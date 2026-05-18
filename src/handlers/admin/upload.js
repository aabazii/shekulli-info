import { json, cors, isAuthed } from '../../lib/response.js';

const PUBLIC_R2_URL = 'https://pub-a3d012dde3734d7595b3c2796f7ec96a.r2.dev';

export async function handleUpload(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return json({ ok: false }, 405);
  if (!isAuthed(request, env)) return json({ ok: false, message: 'Unauthorized' }, 401);

  const filename    = new URL(request.url).searchParams.get('filename') || `photo-${Date.now()}.jpg`;
  const key         = `${Date.now()}-${filename}`;
  const contentType = request.headers.get('Content-Type') || 'image/jpeg';

  try {
    const buf = await request.arrayBuffer();
    await env.BUCKET.put(key, buf, { httpMetadata: { contentType } });
    return json({ ok: true, url: `${PUBLIC_R2_URL}/${key}` });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}
