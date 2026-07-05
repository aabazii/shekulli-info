function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const CATEGORY_META = {
  'Politikë': 'Lajme politike shqiptare — qeveria, parlamenti, partitë dhe vendimmarrja.',
  'Kosovë':   'Lajme nga Kosova — ngjarje, politikë dhe zhvillime nga republika e re.',
  'Botë':     'Lajme ndërkombëtare — Europë, SHBA, NATO dhe ngjarje globale.',
  'Ekonomi':  'Lajme ekonomike — biznese, tregje, banka dhe zhvillime financiare.',
  'Sport':    'Lajme sportive — futboll, basketboll, kampionate dhe ndeshje.',
  'Kulturë':  'Lajme kulturore — art, muzikë, film, letërsi dhe ekspozita.',
  'Opinion':  'Komente, analiza dhe editorial nga zëra të ndryshëm shqiptarë.',
};

export async function handleCategorySSR(request, env) {
  const url = new URL(request.url);
  const cat = url.searchParams.get('cat') || '';

  if (!cat) return env.ASSETS.fetch(request);

  const templateRes = await env.ASSETS.fetch(request);
  let html = await templateRes.text();

  const desc      = esc(CATEGORY_META[cat] || `Lajme nga kategoria ${cat} — Shekulli.info`);
  const title     = esc(`${cat} — Lajme Shqiptare | Shekulli.info`);
  const pageUrl   = esc(`https://shekulli.info/category?cat=${encodeURIComponent(cat)}`);

  html = html
    .replace(
      '<title>Shekulli.info</title>',
      `<title>${title}</title>`
    )
    .replace(
      'content="Lajme shqiptare — Shekulli.info"',
      `content="${desc}"`
    )
    .replace(
      'href="https://shekulli.info/category"',
      `href="${pageUrl}"`
    )
    .replace(
      'id="og-title" content="Shekulli.info"',
      `id="og-title" content="${title}"`
    )
    .replace(
      'id="og-desc" content=""',
      `id="og-desc" content="${desc}"`
    )
    .replace(
      'id="og-url" content="https://shekulli.info/category"',
      `id="og-url" content="${pageUrl}"`
    );

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
