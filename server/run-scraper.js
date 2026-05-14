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

// ── Mirror a Facebook CDN image → Vercel Blob ───────────────────────────────
// FB scontent URLs expire and are session-bound; we re-host them permanently.
async function mirrorImage(page, fbUrl, ts) {
  if (!fbUrl) return '';
  try {
    // Use the puppeteer page's session to fetch the image bytes
    const bytes = await page.evaluate(async (src) => {
      try {
        const r = await fetch(src, { credentials: 'include' });
        if (!r.ok) return null;
        const ab = await r.arrayBuffer();
        return Array.from(new Uint8Array(ab));
      } catch { return null; }
    }, fbUrl);

    if (!bytes || bytes.length < 500) return fbUrl; // fetch failed, keep original

    const buf = Buffer.from(bytes);
    const ext = fbUrl.includes('.png') ? 'png' : 'jpg';
    const filename = `fb-${ts}.${ext}`;

    const uploadRes = await fetch(`${VERCEL_URL}/api/admin/upload?filename=${filename}`, {
      method:  'POST',
      headers: {
        'Content-Type':  `image/${ext}`,
        'Authorization': `Bearer ${ADMIN_PASS}`,
      },
      body: buf,
    });

    if (!uploadRes.ok) return fbUrl;
    const data = await uploadRes.json();
    return data.url || fbUrl;
  } catch (err) {
    console.warn(`  ⚠️  Image mirror failed: ${err.message}`);
    return fbUrl; // fallback — original URL, may expire but better than nothing
  }
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
    // Use domcontentloaded — networkidle2 can hang on FB's live connections
    await page.goto(FB_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000)); // let JS render the feed

    // Dismiss any cookie-consent / login-redirect overlays
    const currentUrl = page.url();
    console.log(`[${ts}] 📍 URL after load: ${currentUrl}`);
    if (!currentUrl.includes('facebook.com')) {
      console.log(`[${ts}] ❌ Unexpected redirect — session invalid`);
      return;
    }
    // Accept cookie consent if it appears (common on EU IPs)
    try {
      await page.evaluate(() => {
        document.querySelectorAll('[data-cookiebanner] button, [data-testid*="cookie"] button').forEach(btn => {
          if (/(accept|allow|okay|got it)/i.test(btn.innerText)) btn.click();
        });
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch {}

    // Scroll back to top first — newest posts are at the top of the feed
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 1500));

    // Slow scroll — gives lazy-loaded images time to resolve
    console.log(`[${ts}] 📜 Scrolling to load posts…`);
    for (let i = 0; i < 8; i++) {
      try {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
      } catch { break; } // stop if page navigated away
      await new Promise(r => setTimeout(r, 2000));
    }

    // Back to top so freshest posts are first
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, 1500));
    } catch {}

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

      // UI/junk line patterns to strip from text
      const JUNK_LINE = /^(Like|Comment|Share|Follow|More|Shpërnda|Koment|Pëlqej|Shiko\s|Reag|Write a|Shkruaj|Reply|Përgjigju|See\s|Translated|Shikuar|Sponsored|Reklamë|Send|Dërgo|\d+[hm]\b|\d+\s*(orë|min)|More reactions|Most relevant|All comments|Top comments|Previous|View \d|Shiko \d|Load more|Ngarko më)/i;

      document.querySelectorAll('[role="article"]').forEach((el, idx) => {

        // ── KEY FILTER: only accept posts AUTHORED by the page ───────────
        // Every real Shekulli.info post has a link to "shekulliinfo" in its
        // header (the page-name anchor). Random commenter articles do NOT.
        // This is the single most reliable way to distinguish page posts
        // from comments, regardless of how Facebook nests the DOM.
        const html = el.innerHTML || '';
        if (!/shekulliinfo/i.test(html)) return;

        // Also skip if this element is nested inside another [role="article"]
        // (catches comments that DO somehow reference the page name)
        let p = el.parentElement;
        while (p) {
          if (p.getAttribute && p.getAttribute('role') === 'article') return;
          p = p.parentElement;
        }

        // ── TEXT ──────────────────────────────────────────────────────────
        // Collect text only from the post's own dir="auto" divs.
        // Exclude divs that belong to nested comment articles.
        const commentDivs = new Set();
        el.querySelectorAll('[role="article"] div[dir="auto"]').forEach(d => commentDivs.add(d));

        const textParts = [];
        el.querySelectorAll('div[dir="auto"]').forEach(d => {
          if (commentDivs.has(d)) return;
          const inCommentList = d.closest('[aria-label*="omment"],[aria-label*="omento"],[data-testid*="comment"]');
          if (inCommentList) return;
          const t = (d.innerText || '').trim();
          if (t.length > 5) textParts.push(t);
        });

        let text = [...new Set(textParts)].join('\n').trim();

        // Clean FB UI artifacts and junk lines
        text = text
          .replace(/\s*(Shiko më shumë|See more|See More)\s*/gi, ' ')
          .trim();
        text = text.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 3 && !JUNK_LINE.test(l))
          .join('\n')
          .trim();

        // ── IMAGE ─────────────────────────────────────────────────────────
        // Skip avatar/profile-picture sized images (< 120px).
        // Only accept images that are genuinely large (news photos).
        let image = '';

        for (const img of el.querySelectorAll('img')) {
          const src = img.src || img.getAttribute('data-src') || '';
          if (!src.startsWith('https') || !src.includes('scontent')) continue;
          // Skip tiny avatars (profile pictures are typically 40–60px rendered)
          const w = img.naturalWidth  || img.width  || 0;
          const h = img.naturalHeight || img.height || 0;
          if (w > 0 && w < 120) continue;
          if (h > 0 && h < 120) continue;
          image = src;
          break;
        }
        // Fallback: any large https image (non-icon, non-static)
        if (!image) {
          for (const img of el.querySelectorAll('img')) {
            const src = img.src || img.getAttribute('data-src') || '';
            const w   = img.naturalWidth  || img.width  || 0;
            const h   = img.naturalHeight || img.height || 0;
            if (src.startsWith('https') &&
                !src.includes('emoji') &&
                !src.includes('rsrc.php') &&
                !src.includes('/static/') &&
                src.length > 80 &&
                (w === 0 || w > 120) &&
                (h === 0 || h > 120)) {
              image = src; break;
            }
          }
        }
        // CSS background-image fallback
        if (!image) {
          for (const node of el.querySelectorAll('[style*="background-image"]')) {
            const m = (node.style.backgroundImage || '').match(/url\(["']?(https[^"')]+)["']?\)/);
            if (m?.[1] && !m[1].includes('data:')) { image = m[1]; break; }
          }
        }

        // ── VIDEO ─────────────────────────────────────────────────────────
        let hasVideo = false;
        let postUrl  = '';

        const videoEl = el.querySelector('video');
        if (videoEl) {
          hasVideo = true;
          const poster = videoEl.getAttribute('poster') || '';
          if (!image && poster) image = poster;
        }

        for (const a of el.querySelectorAll('a[href]')) {
          const href = a.href || '';
          if (/\/(videos|reel|posts)\/|[?&]v=\d|fb\.watch/i.test(href)) {
            postUrl = href; break;
          }
        }
        if (!hasVideo && /\/(videos|reel)\/|fb\.watch/i.test(postUrl)) hasVideo = true;

        // ── TIMESTAMP ─────────────────────────────────────────────────────
        let published = Date.now();
        const abbr = el.querySelector('abbr[data-utime]');
        if (abbr) published = parseInt(abbr.dataset.utime) * 1000;

        // ── ID ────────────────────────────────────────────────────────────
        const seed = (postUrl || text || image).slice(0, 50);
        const id   = 'fb_' + idx + '_' +
          btoa(encodeURIComponent(seed)).replace(/[^a-z0-9]/gi, '').slice(0, 16);

        // ── QUALITY GATE ──────────────────────────────────────────────────
        // image/video post needs 60+ chars; text-only needs 200+ chars.
        const hasMedia = !!(image || hasVideo);
        if ((hasMedia && text.length >= 60) || text.length >= 200) {
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

    // ── Mirror images → Vercel Blob (permanent URLs, no FB expiry) ────────
    console.log(`[${ts}] ☁️  Mirroring images to Vercel Blob…`);
    for (const p of raw) {
      if (p.image) {
        const mirrored = await mirrorImage(page, p.image, p.published);
        if (mirrored !== p.image) {
          console.log(`[${ts}]   ✅ Mirrored: …${mirrored.slice(-40)}`);
        }
        p.image = mirrored;
      }
    }

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
