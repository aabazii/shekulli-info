import { adminJson, cors, isAuthed } from '../../lib/response.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function handleUpload(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return adminJson({ ok: false }, 405);
  if (!isAuthed(request, env)) return adminJson({ ok: false, message: 'Unauthorized' }, 401);

  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    return adminJson({ ok: false, message: 'Invalid file type' }, 415);
  }

  const filename = new URL(request.url).searchParams.get('filename') || `photo-${Date.now()}.jpg`;
  const key      = `${Date.now()}-${filename}`;

  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return adminJson({ ok: false, message: 'File too large (max 10 MB)' }, 413);
    }
    await env.BUCKET.put(key, buf, { httpMetadata: { contentType } });
    return adminJson({ ok: true, url: `/img/${key}` });
  } catch (e) {
    console.error('Upload error:', e);
    return adminJson({ ok: false, message: 'Internal server error' }, 500);
  }
}
