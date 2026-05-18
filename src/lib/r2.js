const PUBLIC_R2_URL = 'https://pub-a3d012dde3734d7595b3c2796f7ec96a.r2.dev';

export async function mirrorImage(srcUrl, key, env) {
  if (!srcUrl) return '';
  try {
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
    return `${PUBLIC_R2_URL}/${r2Key}`;
  } catch {
    return srcUrl;
  }
}
