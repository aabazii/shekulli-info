import { kvGet } from '../lib/kv.js';

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function handleArticleSSR(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  // No id — serve static HTML as-is
  if (!id) return env.ASSETS.fetch(request);

  // Fetch article from KV
  let article;
  try {
    const posts = await kvGet(env, 'posts') || [];
    article = posts.find(p => String(p.id) === String(id));
  } catch {
    return env.ASSETS.fetch(request);
  }

  // Unknown article — serve static HTML, JS will handle the 404
  if (!article) return env.ASSETS.fetch(request);

  // Fetch the static HTML template
  const templateRes = await env.ASSETS.fetch(request);
  let html = await templateRes.text();

  const title = (article.title || 'Shekulli.info').slice(0, 200);
  const desc  = esc((article.standfirst || article.body || '').slice(0, 160));
  const image = esc(article.photo || 'https://shekulli.info/assets/og-image.png');
  const pageUrl = esc(`https://shekulli.info/article?id=${encodeURIComponent(id)}`);
  const escapedTitle = esc(title);

  html = html
    .replace(
      '<title>Shekulli.info</title>',
      `<title>${escapedTitle} — Shekulli.info</title>`
    )
    .replace(
      'content="Lajme shqiptare — Shekulli.info"',
      `content="${desc}"`
    )
    .replace(
      'href="https://shekulli.info/article"',
      `href="${pageUrl}"`
    )
    .replace(
      'id="og-title" content="Shekulli.info"',
      `id="og-title" content="${escapedTitle} — Shekulli.info"`
    )
    .replace(
      'id="og-desc" content=""',
      `id="og-desc" content="${desc}"`
    )
    .replace(
      'id="og-image" content="https://shekulli.info/assets/og-image.png"',
      `id="og-image" content="${image}"`
    )
    .replace(
      'id="og-url" content="https://shekulli.info/article"',
      `id="og-url" content="${pageUrl}"`
    )
    .replace(
      'id="tw-title" content="Shekulli.info"',
      `id="tw-title" content="${escapedTitle} — Shekulli.info"`
    )
    .replace(
      'id="tw-desc" content=""',
      `id="tw-desc" content="${desc}"`
    )
    .replace(
      'id="tw-image" content="https://shekulli.info/assets/og-image.png"',
      `id="tw-image" content="${image}"`
    );

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
