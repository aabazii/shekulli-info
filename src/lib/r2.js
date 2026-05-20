export async function mirrorImage(srcUrl, key, env) {
  if (!srcUrl) return '';
  try {
    const parsed = new URL(srcUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return srcUrl;
    const res = await fetch(srcUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return srcUrl;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) return srcUrl;
    const ext = srcUrl.includes('.png') ? 'png' : 'jpg';
    const r2Key = `${key}.${ext}`;
    await env.BUCKET.put(r2Key, buf, { httpMetadata: { contentType: `image/${ext}` } });
    return `/img/${r2Key}`;
  } catch {
    return srcUrl;
  }
}
