#!/usr/bin/env node
/**
 * Shekulli.info — Facebook scraper
 * - Full text via "See more" expansion
 * - Images: scontent CDN priority
 * - Videos: detects reels, fb.watch, /videos/ — embeds via FB SDK
 * - Smart category detection (hashtags + keywords in Albanian/English)
 *
 * Run once:        node server/run-scraper.js
 * Run every 1min:  node server/run-scraper.js --watch
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const SESSION_FILE   = path.join(__dirname, 'fb-session.json');
const FB_PAGE        = 'https://www.facebook.com/shekulliinfo';
const VERCEL_URL     = process.env.VERCEL_URL    || 'https://shekulli.vercel.app';
const ADMIN_PASS     = process.env.ADMIN_PASSWORD || 'shekulli2026';
const WATCH_INTERVAL = 1 * 60 * 1000; // 1 minute

function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')).cookies || []; }
  catch { return []; }
}

// ── Category detection ──────────────────────────────────────────────────────
// Checks hashtags first (most reliable), then broad keyword matching.
function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || ''); // original case for hashtag check

  // ── Hashtag shortcuts (e.g. #Sport, #Futboll, #Politike) ──
  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#volejboll|#not|#atletizëm|#formula1|#f1/i.test(ht))
    return 'Sport';
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#lsi\b|#ldk\b|#vv\b/i.test(ht))
    return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan|#deçan|#rahovec/i.test(ht))
    return 'Kosovë';
  if (/#ekonomi|#biznes|#financa|#buxhet|#turizëm|#eksport|#import/i.test(ht))
    return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#rusi|#izrael|#gaza|#trump|#putin/i.test(ht))
    return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#kinema|#teatër|#libër|#festiv/i.test(ht))
    return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))
    return 'Opinion';

  // ── Keyword matching ────────────────────────────────────────────────────
  // Sport — check before Politik because "ndeshje" can appear in political contexts too
  if (/\bsport\b|futboll|basketboll|volejboll|tenis|not\b|atletizëm|gjimnastik|formula\s*1|\bf1\b|moto\s*gp|kampionat|gol\b|penalti|arbitër|ndeshje|stadium|tifo|lojtarë|trajner|transferim|skuadër|klub\b|liga\b|serie\s*a|premier\s*league|champions|europa\s*league|bundesliga|laliga|nba\b|fifa\b|uefa\b/.test(t))
    return 'Sport';

  // Politikë
  if (/politik|qeveri|kuvend|kryeministr|ministr|premier|deputet|parti\b|opozit|mazhorancë|koalicion|zgjedhj|votim|referendum|presidenc|dekret|bashki|komun|bashkëpunim\s*politik|protestat?\s*politik|krizë\s*politik|reform|ligj\b|amendament|kushtetut|edi\s*rama|rama\b|basha\b|monika|berisha|kryeminist/.test(t))
    return 'Politikë';

  // Kosovë
  if (/kosov|prishtinë|prizren|pejë\b|mitrovicë|gjakovë|ferizaj|gjilan|deçan|rahovec|suharekë|vushtrri|podujevë|kamenicë|dragash|malishevë|arta\s*gruda|kurti\b|vjosa\b|osmani|srpska/.test(t))
    return 'Kosovë';

  // Botë
  if (/\bbotë\b|ndërkombëtar|europë\b|bashkim\s*europian|\beu\b|\bnato\b|\bonu\b|\bun\b|shba\b|shtetet\s*e\s*bashkuara|ukrainë|rusi|izrael|palestin|gaza\b|trump|biden|putin|zelenski|macron|scholz|erdogan|kinë|japoni|kore|siri|afganistan|irak|iran\b|libi|sudan|turqi/.test(t))
    return 'Botë';

  // Ekonomi
  if (/ekonomi|biznes|banka\b|bankë\b|inflacion|turizëm|eksport|import|treg\b|gdp\b|bpv\b|investim|kompani|korporat|aksion|bursë|kurs\s*këmbim|euro\b|dollar|lek\b|tatim|doganë|tregti|prodhim|punësim|papunësi|pagë\b|rritje\s*ekonomik|tkurrje|recesion|startup|sipërmarrje/.test(t))
    return 'Ekonomi';

  // Kulturë
  if (/kulturë|art\b|muzikë|këngë|këngëtar|aktor|aktore|film\b|kinema|teatër|ekspozitë|libër|libra|shkrimtar|poet|poezia|festiv|koncert|albumin|albumit|premiere|galeri|arkitektur|trashëgimi/.test(t))
    return 'Kulturë';

  // Opinion
  if (/opinion|koment\b|editorial|analiz|perspektiv|vëzhgim|debat\b/.test(t))
    return 'Opinion';

  return 'Lajme';
}

// ── Main scrape function ────────────────────────────────────────────────────
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

    // Load saved Facebook session cookies
    const cookies = loadSession();
    if (cookies.length) {
      await page.setCookie(...cookies);
      console.log(`[${ts}] 🍪 Loaded ${cookies.length} session cookies`);
    } else {
      console.log(`[${ts}] ⚠️  No session — run: node server/save-session.js`);
    }

    // Block fonts & audio/video streams — keep images for photo extraction
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (type === 'font' || type === 'media') req.abort();
      else req.continue();
    });

    console.log(`[${ts}] 🌐 Loading Facebook page…`);
    await page.goto(FB_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });

    // Slow scroll — gives lazy-loaded images time to resolve
    console.log(`[${ts}] 📜 Scrolling to load posts…`);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await new Promise(r => setTimeout(r, 3000));
    }

    // Expand all truncated posts ("Shiko më shumë" / "See more")
    console.log(`[${ts}] 👆 Expanding truncated posts…`);
    await page.evaluate(() => {
      document.querySelectorAll('[role="button"]').forEach(btn => {
        const txt = (btn.innerText || '').trim();
        if (/^(Shiko më shumë|See more|See More)$/.test(txt)) {
          try { btn.click(); } catch {}
        }
      });
    });
    await new Promise(r => setTimeout(r, 2000));

    // ── Extract posts ───────────────────────────────────────────────────────
    const raw = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll('[role="article"]').forEach((el, idx) => {

        // ── TEXT ──────────────────────────────────────────────────────────
        // Comments on Facebook are nested [role="article"] inside the post.
        // Collect all dir="auto" nodes that belong to comments so we can skip them.
        const commentNodes = new Set();
        el.querySelectorAll('[role="article"]').forEach(comment => {
          comment.querySelectorAll('div[dir="auto"]').forEach(d => commentNodes.add(d));
        });

        // Only grab text from the POST itself, not from comments
        const textParts = [];
        el.querySelectorAll('div[dir="auto"]').forEach(d => {
          if (commentNodes.has(d)) return; // skip comment text
          const t = (d.innerText || '').trim();
          if (t.length > 5) textParts.push(t);
        });
        let text = [...new Set(textParts)].join('\n').trim();
        if (!text || text.length < 10) {
          text = (el.innerText || '').split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 5 &&
              !/^(Like|Comment|Share|Follow|More|Shpërnda|Koment|Pëlqej|Shiko|Reag|Write a|Shkruaj)/i.test(l))
            .join('\n');
        }
        text = text.replace(/\s*Shiko më shumë\s*/gi, ' ').trim();

        // ── IMAGE ─────────────────────────────────────────────────────────
        let image = '';

        // Priority 1: Facebook CDN (scontent) — highest quality real photos
        for (const img of el.querySelectorAll('img')) {
          const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (src.includes('scontent') && src.startsWith('https')) { image = src; break; }
        }
        // Priority 2: any large non-icon https image
        if (!image) {
          for (const img of el.querySelectorAll('img')) {
            const src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
            const w   = img.naturalWidth  || img.width  || 0;
            const h   = img.naturalHeight || img.height || 0;
            if (src.startsWith('https') &&
                !src.includes('emoji') &&
                !src.includes('rsrc.php') &&
                !src.includes('/static/') &&
                src.length > 80 &&
                (w === 0 || w > 80) &&
                (h === 0 || h > 80)) {
              image = src; break;
            }
          }
        }
        // Priority 3: CSS background-image
        if (!image) {
          for (const node of el.querySelectorAll('[style*="background-image"]')) {
            const m = (node.style.backgroundImage || '').match(/url\(["']?(https[^"')]+)["']?\)/);
            if (m && m[1] && !m[1].includes('data:')) { image = m[1]; break; }
          }
        }

        // ── VIDEO ─────────────────────────────────────────────────────────
        let hasVideo = false;
        let postUrl  = '';
        let videoThumb = '';

        // Detect native <video> elements
        const videoEl = el.querySelector('video');
        if (videoEl) {
          hasVideo   = true;
          videoThumb = videoEl.getAttribute('poster') || '';
          // Prefer poster as image if no photo found yet
          if (!image && videoThumb) image = videoThumb;
        }

        // Find the FB post/video/reel URL (needed for embed)
        for (const a of el.querySelectorAll('a[href]')) {
          const href = a.href || '';
          // Match /videos/, /reel/, /posts/, watch, fb.watch
          if (/\/(videos|reel|posts)\/|[?&]v=\d|fb\.watch/i.test(href)) {
            postUrl = href; break;
          }
        }

        // If it links to a reel or video but no <video> tag yet, still flag it
        if (!hasVideo && /\/(videos|reel)\/|fb\.watch/i.test(postUrl)) {
          hasVideo = true;
        }

        // ── TIMESTAMP ─────────────────────────────────────────────────────
        let published = Date.now();
        const abbr = el.querySelector('abbr[data-utime]');
        if (abbr) published = parseInt(abbr.dataset.utime) * 1000;

        // ── ID ────────────────────────────────────────────────────────────
        // Stable ID: based on post content/url so reruns don't create dupes
        const seed = (postUrl || text || image).slice(0, 50);
        const id   = 'fb_' + idx + '_' +
          btoa(encodeURIComponent(seed)).replace(/[^a-z0-9]/gi, '').slice(0, 16);

        if (text.length > 5 || image || hasVideo) {
          results.push({ id, text, image, published, hasVideo, postUrl });
        }
      });

      return results;
    });

    console.log(`[${ts}] 📦 Found ${raw.length} posts`);
    if (raw.length === 0) {
      console.log(`[${ts}] ⚠️  0 posts — session may have expired. Run: node server/save-session.js`);
      return;
    }

    const withImg   = raw.filter(p => p.image).length;
    const withVideo = raw.filter(p => p.hasVideo).length;
    console.log(`[${ts}] 🖼  ${withImg}/${raw.length} have images  📹 ${withVideo} videos`);

    // ── Map raw posts → article objects ───────────────────────────────────
    const posts = raw.map(p => {
      const cat   = guessCategory(p.text);
      const lines = (p.text || '').split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0]?.slice(0, 140) || (p.hasVideo ? '📹 Video nga Shekulli.info' : p.image ? '📷 Foto nga Shekulli.info' : '(pa titull)');
      const rest  = lines.slice(1).join('\n').trim();
      return {
        id:         p.id,
        category:   cat,
        kicker:     cat.toUpperCase(),
        title,
        standfirst: rest.slice(0, 300),
        body:       rest,
        photo:      p.image  || '',
        hasVideo:   p.hasVideo,
        postUrl:    p.postUrl || '',
        author:     'Shekulli.info',
        published:  p.published,
      };
    });

    // ── Push to Vercel KV ─────────────────────────────────────────────────
    const res  = await fetch(`${VERCEL_URL}/api/admin/import`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASS}` },
      body:    JSON.stringify({ posts }),
    });
    const data = await res.json();
    console.log(`[${ts}] ✅ ${data.message}`);

    // Log category breakdown
    const cats = {};
    posts.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    console.log(`[${ts}] 📊 Categories:`, JSON.stringify(cats));

  } catch (err) {
    console.error(`[${ts}] ❌ Error:`, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────
scrape();
if (process.argv.includes('--watch')) {
  console.log(`\n👁  Watch mode — scraping every 1 minute. Press Ctrl+C to stop.\n`);
  setInterval(scrape, WATCH_INTERVAL);
}
