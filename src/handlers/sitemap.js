import { kvGet } from '../lib/kv.js';

const STATIC_URLS = [
  { loc: 'https://shekulli.info/',                                      changefreq: 'hourly',  priority: '1.0' },
  { loc: 'https://shekulli.info/category?cat=Politik%C3%AB',           changefreq: 'hourly',  priority: '0.8' },
  { loc: 'https://shekulli.info/category?cat=Kosov%C3%AB',             changefreq: 'hourly',  priority: '0.8' },
  { loc: 'https://shekulli.info/category?cat=Bot%C3%AB',               changefreq: 'hourly',  priority: '0.8' },
  { loc: 'https://shekulli.info/category?cat=Ekonomi',                 changefreq: 'hourly',  priority: '0.8' },
  { loc: 'https://shekulli.info/category?cat=Sport',                   changefreq: 'hourly',  priority: '0.8' },
  { loc: 'https://shekulli.info/category?cat=Kultur%C3%AB',            changefreq: 'hourly',  priority: '0.8' },
  { loc: 'https://shekulli.info/category?cat=Opinion',                 changefreq: 'daily',   priority: '0.7' },
  { loc: 'https://shekulli.info/privacy',                               changefreq: 'yearly',  priority: '0.2' },
];

export async function handleSitemap(request, env) {
  let posts = [];
  try {
    posts = await kvGet(env, 'posts') || [];
  } catch {
    // serve static-only sitemap if KV is unavailable
  }

  const articleUrls = posts.map(p => ({
    loc:        `https://shekulli.info/article?id=${encodeURIComponent(p.id)}`,
    lastmod:    new Date(p.published).toISOString().split('T')[0],
    changefreq: 'never',
    priority:   '0.6',
  }));

  const allUrls = [...STATIC_URLS, ...articleUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
