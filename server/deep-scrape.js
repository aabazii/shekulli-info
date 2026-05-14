#!/usr/bin/env node
/**
 * Shekulli.info — Deep historical scraper
 * Scrolls the Facebook page many more times to pull in older posts.
 * Run once manually to backfill content.
 *
 * Usage:  node server/deep-scrape.js
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const SESSION_FILE = path.join(__dirname, 'fb-session.json');
const FB_PAGE      = 'https://www.facebook.com/shekulliinfo';
const FB_MOBILE    = 'https://m.facebook.com/shekulliinfo';
const VERCEL_URL   = process.env.VERCEL_URL    || 'https://shekulli.vercel.app';
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'shekulli2026';

// How many scroll passes — each loads ~1-2 more posts
const SCROLL_PASSES = 50;

function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')).cookies || []; }
  catch { return []; }
}

// ── Category detection (same as main scraper) ───────────────────────────────
function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#volejboll|#formula1|#f1/i.test(ht))      return 'Sport';
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#ldk\b|#vv\b/i.test(ht))  return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan/i.test(ht))        return 'Kosovë';
  if (/#ekonomi|#biznes|#financa|#turizëm/i.test(ht))                                            return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#trump|#putin/i.test(ht))               return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#teatër/i.test(ht))                                  return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))                                           return 'Opinion';

  if (/\bsport\b|futboll|basketboll|volejboll|tenis|gjimnastik|formula\s*1|\bf1\b|kampionat|gol\b|penalti|ndeshje|stadium|lojtarë|trajner|transferim|skuadër|klub\b|liga\b|serie\s*a|premier\s*league|champions|europa\s*league|bundesliga|laliga|nba\b|fifa\b|uefa\b/.test(t))
    return 'Sport';
  if (/politik|qeveri|kuvend|kryeministr|ministr|premier|deputet|parti\b|opozit|mazhorancë|koalicion|zgjedhj|votim|referendum|presidenc|dekret|bashki|komun|ligj\b|amendament|kushtetut|edi\s*rama|rama\b|basha\b|berisha|kryeminist/.test(t))
    return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë\b|mitrovicë|gjakovë|ferizaj|gjilan|deçan|rahovec|suharekë|vushtrri|podujevë|kurti\b|vjosa\b|osmani/.test(t))
    return 'Kosovë';
  if (/\bbotë\b|ndërkombëtar|europë\b|bashkim\s*europian|\beu\b|\bnato\b|\bonu\b|shba\b|shtetet\s*e\s*bashkuara|ukrainë|rusi|izrael|palestin|gaza\b|trump|biden|putin|zelenski|macron|erdogan|kinë|japoni|siri|afganistan|irak|iran\b|libi|turqi/.test(t))
    return 'Botë';
  if (/ekonomi|biznes|banka\b|bankë\b|inflacion|turizëm|eksport|import|treg\b|gdp\b|bpv\b|investim|kompani|aksion|bursë|tatim|doganë|tregti|prodhim|punësim|papunësi|pagë\b|recesion|startup/.test(t))
    return 'Ekonomi';
  if (/kulturë|art\b|muzikë|këngë|këngëtar|aktor|aktore|film\b|kinema|teatër|ekspozitë|libër|libra|shkrimtar|poet|poezia|festiv|koncert|albumin|premiere|galeri|arkitektur|trashëgimi/.test(t))
    return 'Kulturë';
  if (/opinion|koment\b|editorial|analiz|perspektiv|vëzhgim|debat\b/.test(t))
    return 'Opinion';

  return 'Lajme';
}

// ── Mirror image to Vercel Blob ─────────────────────────────────────────────
async function mirrorImage(page, fbUrl, ts) {
  if (!fbUrl) return '';
  try {
    const bytes = await page.evaluate(async (src) => {
      try {
        const r = await fetch(src, { credentials: 'include' });
        if (!r.ok) return null;
        const ab = await r.arrayBuffer();
        return Array.from(new Uint8Array(ab));
      } catch { return null; }
    }, fbUrl);
    if (!bytes || bytes.length < 500) return fbUrl;
    const buf = Buffer.from(bytes);
    const ext = fbUrl.includes('.png') ? 'png' : 'jpg';
    const filename = `fb-${ts}.${ext}`;
    const uploadRes = await fetch(`${VERCEL_URL}/api/admin/upload?filename=${filename}`, {
      method:  'POST',
      headers: { 'Content-Type': `image/${ext}`, 'Authorization': `Bearer ${ADMIN_PASS}` },
      body:    buf,
    });
    if (!uploadRes.ok) return fbUrl;
    const data = await uploadRes.json();
    return data.url || fbUrl;
  } catch { return fbUrl; }
}

// ── Extract posts from m.facebook.com's simpler HTML structure ──────────────
function extractPosts() {
  const JUNK = /^(Like|Comment|Share|Follow|More|Reply|See\s|Write|Send|Load|View\s\d|Shpërnda|Koment|Pëlqej|Shkruaj|Dërgo|Ngarko|Shiko\s\d|\d+\s*(min|h|orë|m\b)|Most relevant|All comments|Previous)/i;
  const results = [];

  // m.facebook.com renders posts as <article> elements or divs with data-ft
  // Try [role="article"] first, then fall back to article tags
  const containers = Array.from(
    document.querySelectorAll('[role="article"], article')
  ).filter(el => {
    // Must reference shekulliinfo somewhere (page author link)
    return /shekulli/i.test(el.innerHTML);
  }).filter(el => {
    // Skip if nested inside another article
    let p = el.parentElement;
    while (p) {
      if (p.tagName === 'ARTICLE' || (p.getAttribute && p.getAttribute('role') === 'article')) return false;
      p = p.parentElement;
    }
    return true;
  });

  containers.forEach((el, idx) => {
    // Get full text, strip comments (nested articles/sections)
    const commentEls = el.querySelectorAll('[role="article"], article, section');
    const commentTexts = new Set();
    commentEls.forEach(c => commentTexts.add((c.innerText || '').trim()));

    let rawText = (el.innerText || '').trim();
    commentTexts.forEach(ct => { if (ct.length > 10) rawText = rawText.replace(ct, ''); });

    let text = rawText
      .replace(/\s*(Shiko më shumë|See more|See More)\s*/gi, ' ')
      .split('\n').map(l => l.trim())
      .filter(l => l.length > 3 && !JUNK.test(l))
      .join('\n').trim();

    // Image — grab largest scontent image
    let image = '';
    for (const img of el.querySelectorAll('img')) {
      const src = img.src || img.getAttribute('data-src') || '';
      if (!src.includes('scontent') || !src.startsWith('https')) continue;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && w < 80) continue;
      if (h > 0 && h < 80) continue;
      image = src; break;
    }

    // Video / postUrl
    let hasVideo = false, postUrl = '';
    if (el.querySelector('video')) {
      hasVideo = true;
      const poster = el.querySelector('video')?.getAttribute('poster') || '';
      if (!image && poster) image = poster;
    }
    for (const a of el.querySelectorAll('a[href]')) {
      const href = a.href || '';
      if (/\/(videos|reel|posts|story)\/|[?&]v=\d|fb\.watch|story_fbid/i.test(href)) { postUrl = href; break; }
    }
    if (!hasVideo && /\/(videos|reel)\/|fb\.watch/i.test(postUrl)) hasVideo = true;

    // Timestamp
    let published = Date.now();
    const timeEl = el.querySelector('abbr[data-utime], time[datetime]');
    if (timeEl?.dataset?.utime) published = parseInt(timeEl.dataset.utime) * 1000;
    else if (timeEl?.getAttribute('datetime')) published = new Date(timeEl.getAttribute('datetime')).getTime() || Date.now();

    // Stable ID
    const seed = (postUrl || text || image).slice(0, 50);
    const id = 'fb_' + idx + '_' + btoa(encodeURIComponent(seed)).replace(/[^a-z0-9]/gi, '').slice(0, 16);

    const hasMedia = !!(image || hasVideo);
    if ((hasMedia && text.length >= 60) || text.length >= 200) {
      results.push({ id, text, image, published, hasVideo, postUrl });
    }
  });

  return results;
}

// ── Push a batch to Vercel KV ───────────────────────────────────────────────
async function pushPosts(posts) {
  const res  = await fetch(`${VERCEL_URL}/api/admin/import`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASS}` },
    body:    JSON.stringify({ posts }),
  });
  return res.json();
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🗞  Deep scrape — target: ${SCROLL_PASSES} scroll passes\n`);
  let browser;
  const allSeenIds = new Set();
  let totalSaved = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900'],
    });
    const page = await browser.newPage();
    // Use a mobile viewport + user agent — m.facebook.com loads all posts
    // as plain HTML without JS virtualization, much easier to scroll/scrape
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    const cookies = loadSession();
    if (cookies.length) { await page.setCookie(...cookies); console.log(`🍪 Loaded ${cookies.length} cookies`); }
    else { console.log('⚠️  No session file — run: node server/save-session.js'); process.exit(1); }

    await page.setRequestInterception(true);
    page.on('request', req => {
      const t = req.resourceType();
      if (t === 'font' || t === 'media') req.abort();
      else req.continue();
    });

    console.log('🌐 Loading mobile page…');
    await page.goto(FB_MOBILE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));

    const currentUrl = page.url();
    console.log(`📍 URL: ${currentUrl}`);
    if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
      console.log('❌ Redirected to login — session expired');
      process.exit(1);
    }

    // Expand all "See more" / "Shiko më shumë" buttons
    const expanded = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('a, [role="button"], div[tabindex="0"]').forEach(btn => {
        const txt = (btn.innerText || btn.textContent || '').trim();
        if (/shiko\s*më\s*shumë|see\s*more/i.test(txt) && txt.length < 30) { try { btn.click(); n++; } catch {} }
      });
      return n;
    });
    console.log(`👆 Clicked ${expanded} expand button(s) (initial)`);
    await new Promise(r => setTimeout(r, 2000));

    // ── Scroll loop ─────────────────────────────────────────────────────────
    for (let pass = 1; pass <= SCROLL_PASSES; pass++) {
      try { await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2)); }
      catch { console.log(`  ⚠️  Navigation during scroll at pass ${pass} — stopping`); break; }

      await new Promise(r => setTimeout(r, 1800));

      // Every 5 passes: click more expand buttons + extract + push new posts
      if (pass % 5 === 0 || pass === SCROLL_PASSES) {
        // Expand any newly visible "See more" buttons
        await page.evaluate(() => {
          document.querySelectorAll('[role="button"], div[tabindex="0"], span[role="button"]').forEach(btn => {
            const txt = (btn.innerText || '').trim();
            if (/shiko\s*më\s*shumë|see\s*more/i.test(txt) && txt.length < 30) { try { btn.click(); } catch {} }
          });
        });
        await new Promise(r => setTimeout(r, 1500));

        const raw = await page.evaluate(extractPosts);
        const fresh = raw.filter(p => !allSeenIds.has(p.id));
        fresh.forEach(p => allSeenIds.add(p.id));

        if (fresh.length > 0) {
          // Mirror images
          for (const p of fresh) {
            if (p.image) p.image = await mirrorImage(page, p.image, p.published);
          }

          // Map to article objects
          const articles = fresh.map(p => {
            const cat = guessCategory(p.text);
            const cleanText = (p.text || '').replace(/\.{3,}\s*(See more|Shiko më shumë)\s*/gi, '').replace(/\s*(See more|Shiko më shumë)\s*/gi, ' ').trim();
            const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
            const title = (lines[0] || '').slice(0, 140) || (p.hasVideo ? '📹 Video' : p.image ? '📷 Foto' : '(pa titull)');
            const body  = lines.slice(1).join('\n').trim();
            const standfirst = body.split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 300);
            return { id: p.id, category: cat, kicker: cat.toUpperCase(), title, standfirst, body, photo: p.image || '', hasVideo: p.hasVideo, postUrl: p.postUrl || '', author: 'Shekulli.info', published: p.published };
          });

          const result = await pushPosts(articles);
          totalSaved += fresh.length;
          console.log(`  [Pass ${pass}/${SCROLL_PASSES}] +${fresh.length} new | ${result.message}`);
        } else {
          console.log(`  [Pass ${pass}/${SCROLL_PASSES}] no new posts (${allSeenIds.size} total seen)`);
        }

        const articleCount = await page.evaluate(() => document.querySelectorAll('[role="article"]').length);
        process.stdout.write(`  📄 ${articleCount} articles in DOM\n`);
      }
    }

    console.log(`\n✅ Deep scrape complete — ${totalSaved} posts pushed, ${allSeenIds.size} unique posts seen\n`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
})();
