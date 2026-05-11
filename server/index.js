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

/* ── Serve /admin page ─────────────────────────────────────────────── */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

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

/* ── Auth middleware ──────────────────────────────────────────────── */
const ADMIN_PASSWORD = 'shekulli2026';
function checkAuth(req, res, next) {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
  next();
}

/* ── POST /api/sync — manual trigger ───────────────────────────── */
let syncing = false;
app.post('/api/sync', checkAuth, async (_req, res) => {
  if (syncing) return res.json({ ok: false, message: 'Sync already in progress' });
  syncing = true;
  res.json({ ok: true, message: 'Sync started — check /api/health for results' });
  try {
    await scrapePosts();
  } finally {
    syncing = false;
  }
});

/* ── POST /api/admin/import — bulk import posts ─────────────────────── */
app.post('/api/admin/import', checkAuth, (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts)) {
      return res.status(400).json({ ok: false, message: 'posts must be an array' });
    }

    // Validate each post
    const validated = posts.map((p, i) => {
      if (!p.id || !p.text || !p.category) {
        throw new Error(`Post ${i}: missing id, text, or category`);
      }
      return {
        id: String(p.id),
        text: p.text,
        title: p.title || p.text.slice(0, 140),
        standfirst: p.standfirst || p.text.slice(0, 300),
        body: p.body || p.text,
        category: p.category,
        kicker: (p.category || '').toUpperCase(),
        photo: p.photo || '',
        author: p.author || 'Shekulli.info',
        fb_post_id: p.fb_post_id || p.id,
        published: p.published || Date.now(),
      };
    });

    // Load existing posts
    const existing = loadPosts();
    const existingIds = new Set(existing.map(p => String(p.id)));

    // Filter out duplicates (by id)
    const newPosts = validated.filter(p => !existingIds.has(String(p.id)));

    if (newPosts.length === 0) {
      return res.json({ ok: true, message: 'No new posts to import (all duplicates)' });
    }

    // Merge and sort by date
    const merged = [...newPosts, ...existing]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    // Save
    fs.writeFileSync(POSTS_FILE, JSON.stringify(merged, null, 2));

    res.json({
      ok: true,
      message: `✅ Importuar ${newPosts.length} artikuj të rinj (${merged.length} total)`
    });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
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

