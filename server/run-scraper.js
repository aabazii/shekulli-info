#!/usr/bin/env node
/**
 * Shekulli.info — Facebook scraper
 * Fixes: full text (clicks "See more"), real images (scontent CDN)
 *
 * Run once:         node server/run-scraper.js
 * Run every 1 min:  node server/run-scraper.js --watch
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const SESSION_FILE   = path.join(__dirname, 'fb-session.json');
const FB_PAGE        = 'https://www.facebook.com/shekulliinfo';
const VERCEL_URL     = process.env.VERCEL_URL     || 'https://shekulli.vercel.app';
const ADMIN_PASS     = process.env.ADMIN_PASSWORD  || 'shekulli2026';
const WATCH_INTERVAL = 1 * 60 * 1000; // 1 minute

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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,900',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    // Load Facebook session cookies
    const cookies = loadSession();
    if (cookies.length) {
      await page.setCookie(...cookies);
      console.log(`[${ts}] 🍪 Loaded ${cookies.length} session cookies`);
    } else {
      console.log(`[${ts}] ⚠️  No session — run: node server/save-session.js`);
    }

    // Only block fonts/media — allow images so we get photo URLs
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (type === 'font' || type === 'media') req.abort();
      else req.continue();
    });

    console.log(`[${ts}] 🌐 Loading page…`);
    await page.goto(FB_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll slowly so lazy-loaded images have time to load
    console.log(`[${ts}] 📜 Scrolling to load posts and images…`);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await new Promise(r => setTimeout(r, 3000)); // 3s between scrolls
    }

    // Click ALL "See more" / "Shiko më shumë" buttons to expand full post text
    console.log(`[${ts}] 👆 Expanding truncated posts…`);
    await page.evaluate(() => {
      document.querySelectorAll('[role="button"], div[dir="auto"] > div').forEach(el => {
        const txt = el.innerText?.trim() || '';
        if (txt === 'Shiko më shumë' || txt === 'See more' || txt === 'See More') {
          try { el.click(); } catch {}
        }
      });
    });
    await new Promise(r => setTimeout(r, 2000)); // wait for expansions to render

    // Extract posts
    const raw = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll('[role="article"]').forEach((el, idx) => {

        // ── FULL TEXT ──────────────────────────────────────────────────────
        // Grab all text from dir="auto" divs (Facebook post content)
        const textParts = [];
        el.querySelectorAll('div[dir="auto"]').forEach(d => {
          const t = d.innerText?.trim();
          if (t && t.length > 5) textParts.push(t);
        });
        // Deduplicate consecutive identical lines
        let text = [...new Set(textParts)].join('\n').trim();

        // Fallback: innerText minus noise
        if (!text || text.length < 10) {
          text = el.innerText.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 5 && !/^(Like|Comment|Share|Follow|More|Shpërnda|Koment|Pëlqej|Shiko|Reag)/i.test(l))
            .join('\n');
        }

        // Strip "Shiko më shumë" remnants
        text = text.replace(/\s*Shiko më shumë\s*/gi, ' ').trim();

        // ── IMAGE ──────────────────────────────────────────────────────────
        let image = '';

        // 1st priority: scontent Facebook CDN images (real photos)
        for (const img of el.querySelectorAll('img')) {
          const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (src && src.includes('scontent') && src.startsWith('https')) {
            image = src; break;
          }
        }

        // 2nd priority: any large image (not icon/emoji/profile pic)
        if (!image) {
          for (const img of el.querySelectorAll('img')) {
            const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (
              src &&
              src.startsWith('https') &&
              !src.includes('emoji') &&
              !src.includes('rsrc.php') &&
              !src.includes('static') &&
              src.length > 80 &&
              (w === 0 || w > 60) &&   // skip tiny icons
              (h === 0 || h > 60)
            ) {
              image = src; break;
            }
          }
        }

        // 3rd priority: background-image style (some FB layouts use this)
        if (!image) {
          for (const el2 of el.querySelectorAll('[style*="background-image"]')) {
            const m = (el2.style.backgroundImage || '').match(/url\(["']?(https[^"')]+)["']?\)/);
            if (m && m[1] && !m[1].includes('data:')) { image = m[1]; break; }
          }
        }

        // ── VIDEO ──────────────────────────────────────────────────────────
        let hasVideo = false, postUrl = '';
        const videoEl = el.querySelector('video');
        if (videoEl) {
          hasVideo = true;
          image = image || videoEl.getAttribute('poster') || '';
        }

        // Post link (for FB video embed)
        for (const a of el.querySelectorAll('a[href]')) {
          if (/\/(posts|videos|reel)\/|[?&]v=/.test(a.href)) { postUrl = a.href; break; }
        }

        // ── TIMESTAMP ─────────────────────────────────────────────────────
        let published = Date.now();
        const abbr = el.querySelector('abbr[data-utime]');
        if (abbr) published = parseInt(abbr.dataset.utime) * 1000;

        // ── ID ────────────────────────────────────────────────────────────
        const seed = (text || image || postUrl).slice(0, 40);
        const id   = 'fb_' + idx + '_' + btoa(encodeURIComponent(seed)).replace(/[^a-z0-9]/gi, '').slice(0, 16);

        if (text.length > 5 || image || hasVideo) {
          results.push({ id, text, image, published, hasVideo, postUrl });
        }
      });

      return results;
    });

    console.log(`[${ts}] 📦 Found ${raw.length} posts`);
    if (raw.length === 0) { console.log(`[${ts}] ⚠️  0 posts — Facebook may be blocking or session expired`); return; }

    // Log image hit rate
    const withImg = raw.filter(p => p.image).length;
    console.log(`[${ts}] 🖼  ${withImg}/${raw.length} posts have images`);

    // Map to article format
    const posts = raw.map(p => {
      const cat   = guessCategory(p.text);
      const lines = (p.text || '').split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0]?.slice(0, 140) || (p.image ? 'Foto nga Shekulli.info' : '(pa titull)');
      const rest  = lines.slice(1).join('\n').trim();
      return {
        id:         p.id,
        category:   cat,
        kicker:     cat.toUpperCase(),
        title,
        standfirst: rest.slice(0, 300),
        body:       rest,
        photo:      p.image || '',
        hasVideo:   p.hasVideo,
        postUrl:    p.postUrl,
        author:     'Shekulli.info',
        published:  p.published,
      };
    });

    // Push to Vercel KV via API
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
  console.log(`\n👁  Watch mode — scraping every 1 minute. Press Ctrl+C to stop.\n`);
  setInterval(scrape, WATCH_INTERVAL);
}
