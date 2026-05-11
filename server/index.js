/* Shekulli.info — Express API + Facebook scraper cron */

const express  = require('express');
const cors     = require('cors');
const cron     = require('node-cron');
const path     = require('path');
const fs       = require('fs');
const { scrapePosts, loadPosts } = require('./scraper');

const PORT       = process.env.PORT || 4000;
const POSTS_FILE = path.join(__dirname, 'posts.json');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

/* ── Serve the static site ─────────────────────────────────────── */
app.use(express.static(path.join(__dirname, '..')));

/* ── Health check ──────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  const posts = loadPosts();
  res.json({ ok: true, articles: posts.length, ts: Date.now() });
});

/* ── GET /api/articles ─────────────────────────────────────────── */
app.get('/api/articles', (req, res) => {
  try {
    let posts = loadPosts();
    const { category, limit = '100', offset = '0' } = req.query;
    if (category) posts = posts.filter(p => p.category === category);
    posts = posts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/articles/:id ─────────────────────────────────────── */
app.get('/api/articles/:id', (req, res) => {
  const posts = loadPosts();
  const article = posts.find(p => String(p.id) === req.params.id);
  if (!article) return res.status(404).json({ error: 'Not found' });
  res.json(article);
});

/* ── POST /api/sync — manual trigger ───────────────────────────── */
let syncing = false;
app.post('/api/sync', async (_req, res) => {
  if (syncing) return res.json({ ok: false, message: 'Sync already in progress' });
  syncing = true;
  res.json({ ok: true, message: 'Sync started — check /api/health for results' });
  try {
    await scrapePosts();
  } finally {
    syncing = false;
  }
});

/* ── Cron: scrape every 1 minute ────────────────────────────────── */
cron.schedule('* * * * *', async () => {
  if (syncing) return;
  syncing = true;
  try {
    await scrapePosts();
  } finally {
    syncing = false;
  }
});

/* ── Start ──────────────────────────────────────────────────────── */
app.listen(PORT, async () => {
  console.log(`\n🗞  Shekulli.info server → http://localhost:${PORT}`);
  console.log('🔄  Scraping Facebook every 1 minute\n');

  // Create empty posts file if missing
  if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');

  // Initial scrape on startup
  console.log('[Startup] Running first scrape…');
  syncing = true;
  try {
    await scrapePosts();
  } finally {
    syncing = false;
  }
});
