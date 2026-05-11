/* Shekulli.info — Shared data layer (localStorage) */

const STORAGE_KEY = 'shekulli_v2'; // v2 = real FB articles only, no seed data

/* All real content comes live from the Facebook scraper via the API.
   No placeholder/seed articles. */

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _save(articles) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(articles)); } catch(e) {}
}

/* ── API-first fetch ──────────────────────────────────────────────
   Pulls from the Node.js backend (Facebook scraper).
   Falls back silently to whatever is in localStorage if backend is down.
   Pages call refreshFromAPI() on load and reload when new data arrives.
   Uses relative paths so it works on both localhost and deployed sites.
──────────────────────────────────────────────────────────────────── */
const API_BASE = '/api';

function refreshFromAPI(onDone) {
  fetch(API_BASE + '/articles?limit=100')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(rows => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const normalised = rows.map(r => ({
        id:         r.id,
        fb_post_id: r.fb_post_id,
        category:   r.category   || 'Lajme',
        kicker:     r.kicker     || (r.category || 'LAJME').toUpperCase(),
        title:      r.title,
        standfirst: r.standfirst || '',
        body:       r.body       || '',
        photo:      r.photo      || '',
        author:     r.author     || 'Shekulli.info',
        published:  Number(r.published),
      }));

      // Only reload if there are genuinely new articles we don't already have
      const existing = _load() || [];
      const existingIds = new Set(existing.map(a => String(a.id)));
      const hasNew = normalised.some(a => !existingIds.has(String(a.id)));
      if (!hasNew) return;

      _save(normalised);
      if (typeof onDone === 'function') onDone(normalised);
    })
    .catch(() => { /* backend not running — use whatever is in localStorage */ });
}

function getArticles() {
  return _load() || [];
}

function getArticleById(id) {
  return getArticles().find(a => String(a.id) === String(id)) || null;
}

function getArticlesByCategory(cat) {
  const all = getArticles();
  return cat ? all.filter(a => a.category === cat) : all;
}

function saveArticle(article) {
  const articles = getArticles();
  const idx = articles.findIndex(a => String(a.id) === String(article.id));
  if (idx >= 0) {
    articles[idx] = article;
  } else {
    articles.unshift(article);
  }
  _save(articles);
  return article;
}

function deleteArticle(id) {
  const articles = getArticles().filter(a => String(a.id) !== String(id));
  _save(articles);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'tani';
  if (m < 60) return m + ' min më parë';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' orë më parë';
  const d = Math.floor(h / 24);
  if (d === 1) return 'dje';
  return d + ' ditë më parë';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('sq-AL', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

/* Build a story card <a> element */
function buildCard(article, size) {
  const a = document.createElement('a');
  a.href = 'article?id=' + article.id;
  a.className = 'story' + (size === 'lg' ? ' card--lg' : size === 'sm' ? ' card--sm' : '');

  const photoHtml = size !== 'sm' ? `
    <div class="story__photo" style="background-image:url('${article.photo || ''}');${!article.photo ? 'background:linear-gradient(135deg,#1d2f55,#0b1830)' : ''}"></div>` : '';

  a.innerHTML = photoHtml + `
    <div class="story__copy">
      <span class="kicker">${article.category.toUpperCase()}</span>
      <h3 class="story__headline">${article.title}</h3>
      <span class="meta">${timeAgo(article.published)}</span>
    </div>`;
  return a;
}

/* Build a horizontal list-style card (category page) */
function buildListCard(article) {
  const a = document.createElement('a');
  a.href = 'article?id=' + article.id;
  a.className = 'story';
  a.style.cssText = 'display:grid;grid-template-columns:200px 1fr;gap:24px;border-top:1px solid var(--rule);padding-top:18px;';
  a.innerHTML = `
    <div class="story__photo" style="aspect-ratio:4/3;${article.photo ? "background-image:url('" + article.photo + "')" : 'background:linear-gradient(135deg,#1d2f55,#0b1830)'};margin:0;"></div>
    <div class="story__copy">
      <span class="kicker">${article.category.toUpperCase()}</span>
      <h3 class="story__headline" style="font-size:22px;">${article.title}</h3>
      <p class="deck" style="margin:6px 0 0;font-size:15px;">${article.standfirst}</p>
      <span class="meta" style="margin-top:8px;display:block;">${timeAgo(article.published)}</span>
    </div>`;
  return a;
}

window.ShekullDB = {
  getArticles, getArticleById, getArticlesByCategory,
  saveArticle, deleteArticle,
  timeAgo, formatDate, buildCard, buildListCard,
  refreshFromAPI
};
