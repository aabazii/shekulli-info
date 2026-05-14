#!/usr/bin/env node
/**
 * Local scraper — runs Puppeteer on your Mac, pushes posts to Vercel.
 *
 * Run once manually:   node server/run-scraper.js
 * Run every 10 min:    node server/run-scraper.js --watch
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const SESSION_FILE  = path.join(__dirname, 'fb-session.json');
const FB_PAGE       = 'https://www.facebook.com/shekulliinfo';
const VERCEL_URL    = process.env.VERCEL_URL || 'https://shekulli-info.vercel.app';
const ADMIN_PASS    = process.env.ADMIN_PASSWORD || 'shekulli2026';
const WATCH_INTERVAL = 10 * 60 * 1000; // 10 minutes

function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')).cookies || []; }
  catch { return []; }
}

function guessCategory(text) {
  const t = (text || '').toLowerCase();
  if (/politik|qeveri|kuvend|parti|zgjedhj|premier|ministr|kryeministr|opozit/.test(t)) return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë|mitrovicë|gjakovë|ferizaj|gjilan/.test(t))          return 'Kosovë';
  if (/botë|ndërkombëtar|europë|shba|nato|onu|\beu\b|ukrainë|rusi|izrael|gaza/.test(t)) return 'Botë';
  if (/ekonomi|biznes|banka|inflacion|turizëm|eksport|import|treg|gdp/.test(t))          return 'Ekonomi';
  if (/sport|futboll|basketboll|tenis|kampionat|gol|ndeshje|skuadr/.test(t))            return 'Sport';
  if (/kulturë|art|muzikë|film|teatër|ekspozitë|libër|poet/.test(t))                    return 'Kulturë';
  if (/opinion|koment|editorial|analiz/.test(t))                                         return 'Opinion';
  return 'Lajme';
}

async function scrape() {
  let browser;
  const ts = new Date().toLocaleTimeString();
  console.log(`\n[${ts}] 🚀 Starting scrape…`);

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    const cookies = loadSession();
    if (cookies.length) {
      await page.setCookie(...cookies);
      console.log(`[${ts}] 🍪 Loaded ${cookies.length} session cookies`);
    } else {
      console.log(`[${ts}] ⚠️  No session — run: node server/save-session.js`);
    }

    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(FB_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll to load more posts
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await new Promise(r => setTimeout(r, 2000));
    }

    const raw = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('[role="article"]').forEach((el, idx) => {
        const textEl = el.querySelector('[data-testid="post_message"], div[dir="auto"]');
        let text = textEl?.innerText?.trim() || '';
        if (!text) {
          text = [...el.innerText.split('\n')]
            .filter(t => t.trim().length > 10 && !/^(Like|Comment|Share|Follow|More)/i.test(t.trim()))
            .join('\n');
        }

        let image = '';
        for (const img of el.querySelectorAll('img')) {
          const src = img.src || '';
          if (src && !src.includes('emoji') && !src.includes('static') && src.startsWith('http')) {
            image = src; break;
          }
        }

        let hasVideo = false, postUrl = '';
        const videoEl = el.querySelector('video');
        if (videoEl) { hasVideo = true; image = image || videoEl.getAttribute('poster') || ''; }

        for (const a of el.querySelectorAll('a[href]')) {
          if (/\/(posts|videos)\/|[?&]v=/.test(a.href)) { postUrl = a.href; break; }
        }

        let published = Date.now();
        const abbr = el.querySelector('abbr[data-utime]');
        if (abbr) published = parseInt(abbr.dataset.utime) * 1000;

        const id = 'fb_' + idx + '_' + btoa(encodeURIComponent((text || image).slice(0, 30))).replace(/[^a-z0-9]/gi, '').slice(0, 14);

        if (text || image || hasVideo) results.push({ id, text, image, published, hasVideo, postUrl });
      });
      return results;
    });

    console.log(`[${ts}] 📦 Found ${raw.length} posts`);
    if (raw.length === 0) return;

    // Map to article format
    const posts = raw.map(p => {
      const cat = guessCategory(p.text);
      const lines = (p.text || '').split('\n').filter(Boolean);
      return {
        id:        p.id,
        category:  cat,
        title:     lines[0]?.slice(0, 140) || (p.image ? '📷 Foto' : '(pa titull)'),
        standfirst:lines.slice(1).join(' ').slice(0, 300),
        body:      lines.slice(1).join('\n'),
        photo:     p.image || '',
        hasVideo:  p.hasVideo,
        postUrl:   p.postUrl,
        author:    'Shekulli.info',
        published: p.published,
      };
    });

    // Push to Vercel
    const res = await fetch(`${VERCEL_URL}/api/admin/import`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASS}` },
      body:    JSON.stringify({ posts }),
    });
    const data = await res.json();
    console.log(`[${ts}] ✅ ${data.message}`);

  } catch (err) {
    console.error(`[${ts}] ❌ Error:`, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Run immediately, then watch if --watch flag
scrape();
if (process.argv.includes('--watch')) {
  console.log(`\n👁  Watch mode — scraping every 10 minutes. Press Ctrl+C to stop.\n`);
  setInterval(scrape, WATCH_INTERVAL);
}
