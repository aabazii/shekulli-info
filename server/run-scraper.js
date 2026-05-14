#!/usr/bin/env node
/**
 * Shekulli.info — Facebook Graph API scraper (v3)
 *
 * Uses the official Graph API — no Puppeteer, no session cookies.
 * Returns full post text (no "See more" truncation), real timestamps,
 * and never gets blocked by Facebook's anti-bot systems.
 *
 * Requires:
 *   FB_PAGE_TOKEN  — Page Access Token for the shekulliinfo page
 *   ADMIN_PASSWORD — Vercel admin password (default: shekulli2026)
 *   VERCEL_URL     — Deployed site URL (default: https://shekulli.vercel.app)
 *
 * Run once:       node server/run-scraper.js
 * Run in watch:   node server/run-scraper.js --watch
 */

const GRAPH_VER   = 'v21.0';
const FB_PAGE_ID  = 'shekulliinfo';
const VERCEL_URL  = process.env.VERCEL_URL     || 'https://shekulli.vercel.app';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD  || 'shekulli2026';
const FB_TOKEN    = process.env.FB_PAGE_TOKEN;
const WATCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ── Category detection ──────────────────────────────────────────────────────
function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

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

  if (/\bsport\b|futboll|basketboll|volejboll|tenis|not\b|atletizëm|gjimnastik|formula\s*1|\bf1\b|moto\s*gp|kampionat|gol\b|penalti|arbitër|ndeshje|stadium|tifo|lojtarë|trajner|transferim|skuadër|klub\b|liga\b|serie\s*a|premier\s*league|champions|europa\s*league|bundesliga|laliga|nba\b|fifa\b|uefa\b/.test(t))
    return 'Sport';
  if (/politik|qeveri|kuvend|kryeministr|ministr|premier|deputet|parti\b|opozit|mazhorancë|koalicion|zgjedhj|votim|referendum|presidenc|dekret|bashki|komun|reform|ligj\b|amendament|kushtetut|edi\s*rama|rama\b|basha\b|berisha|kryeminist/.test(t))
    return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë\b|mitrovicë|gjakovë|ferizaj|gjilan|deçan|rahovec|suharekë|vushtrri|podujevë|kamenicë|dragash|malishevë|kurti\b|vjosa\b|osmani|srpska/.test(t))
    return 'Kosovë';
  if (/\bbotë\b|ndërkombëtar|europë\b|bashkim\s*europian|\beu\b|\bnato\b|\bonu\b|shba\b|shtetet\s*e\s*bashkuara|ukrainë|rusi|izrael|palestin|gaza\b|trump|biden|putin|zelenski|macron|erdogan|kinë|japoni|siri|afganistan|irak|iran\b|libi|turqi/.test(t))
    return 'Botë';
  if (/ekonomi|biznes|banka\b|bankë\b|inflacion|turizëm|eksport|import|treg\b|gdp\b|bpv\b|investim|kompani|aksion|bursë|kurs\s*këmbim|tatim|doganë|tregti|prodhim|punësim|papunësi|pagë\b|recesion|startup/.test(t))
    return 'Ekonomi';
  if (/kulturë|art\b|muzikë|këngë|këngëtar|aktor|aktore|film\b|kinema|teatër|ekspozitë|libër|libra|shkrimtar|poet|poezia|festiv|koncert|albumin|albumit|premiere|galeri|arkitektur|trashëgimi/.test(t))
    return 'Kulturë';
  if (/opinion|koment\b|editorial|analiz|perspektiv|vëzhgim|debat\b/.test(t))
    return 'Opinion';

  return 'Lajme';
}

// ── Mirror image → Vercel Blob (so FB CDN URLs don't expire) ───────────────
async function mirrorImage(fbUrl, ts) {
  if (!fbUrl) return '';
  try {
    const imgRes = await fetch(fbUrl);
    if (!imgRes.ok) return fbUrl;
    const buf  = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 500) return fbUrl;

    const ext = fbUrl.includes('.png') ? 'png' : 'jpg';
    const uploadRes = await fetch(`${VERCEL_URL}/api/admin/upload?filename=fb-${ts}.${ext}`, {
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
    return fbUrl;
  }
}

// ── Fetch posts from the Graph API ─────────────────────────────────────────
async function fetchGraphPosts(limit = 30) {
  const fields = [
    'id',
    'message',
    'full_picture',
    'attachments{type,media,url}',
    'created_time',
    'permalink_url',
  ].join(',');

  const url = `https://graph.facebook.com/${GRAPH_VER}/${FB_PAGE_ID}/posts` +
    `?fields=${fields}&limit=${limit}&access_token=${FB_TOKEN}`;

  const res  = await fetch(url);
  const data = await res.json();

  if (data.error) {
    const e = data.error;
    console.error(`❌ Graph API error [${e.code}]: ${e.message}`);
    if (e.code === 190) {
      console.error('   → Token expired or invalid. Set a new FB_PAGE_TOKEN.');
      console.error('   → Get one at: https://developers.facebook.com/tools/explorer');
    }
    return [];
  }

  return data.data || [];
}

// ── Main scrape ─────────────────────────────────────────────────────────────
async function scrape() {
  const ts = new Date().toLocaleTimeString();
  console.log(`\n[${ts}] 🚀 Graph API scrape starting…`);

  if (!FB_TOKEN) {
    console.error(`[${ts}] ❌ FB_PAGE_TOKEN is not set.`);
    console.error('   Set it as a GitHub Actions secret and Vercel env variable.');
    console.error('   Get a token at: https://developers.facebook.com/tools/explorer');
    process.exit(1);
  }

  try {
    const fbPosts = await fetchGraphPosts(30);
    console.log(`[${ts}] 📦 Fetched ${fbPosts.length} posts from Graph API`);

    if (fbPosts.length === 0) {
      console.log(`[${ts}] ⚠️  No posts returned. Check token permissions.`);
      return;
    }

    // Map Graph API posts → site article format
    const posts = [];
    for (const p of fbPosts) {
      const rawText = (p.message || '').trim();
      if (!rawText) continue; // photo-only post with no caption — skip

      const cat   = guessCategory(rawText);
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

      let title = (lines[0] || '').slice(0, 140).trim();
      if (!title) title = '📷 Foto nga Shekulli.info';

      const body       = lines.slice(1).join('\n').trim();
      const standfirst = body.split('\n').slice(0, 2).join(' ').slice(0, 300);

      // Video detection via attachments
      let hasVideo = false;
      const attachments = p.attachments?.data || [];
      for (const att of attachments) {
        if (/video/i.test(att.type || '')) { hasVideo = true; break; }
      }

      // Mirror image so it never expires
      let photo = p.full_picture || '';
      const published = new Date(p.created_time).getTime();
      if (photo) {
        const mirrored = await mirrorImage(photo, published);
        if (mirrored !== photo) {
          console.log(`[${ts}]   ✅ Mirrored image for post ${p.id}`);
        }
        photo = mirrored;
      }

      // Quality gate: must have either real text or media
      const hasMedia = !!(photo || hasVideo);
      if (!hasMedia && body.length < 100 && rawText.length < 120) continue;

      posts.push({
        id:         `fb_${p.id}`,
        fb_post_id: p.id,
        category:   cat,
        kicker:     cat.toUpperCase(),
        title,
        standfirst,
        body,
        photo,
        hasVideo,
        postUrl:    p.permalink_url || `https://www.facebook.com/${p.id}`,
        author:     'Shekulli.info',
        published,
      });
    }

    console.log(`[${ts}] ✅ ${posts.length} posts ready to import`);

    // Log category breakdown
    const cats = {};
    posts.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    console.log(`[${ts}] 📊 Categories:`, JSON.stringify(cats));

    // Push to Vercel KV
    const res  = await fetch(`${VERCEL_URL}/api/admin/import`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${ADMIN_PASS}`,
      },
      body: JSON.stringify({ posts }),
    });
    const data = await res.json();
    console.log(`[${ts}] 📤 ${data.message}`);

  } catch (err) {
    console.error(`[${ts}] ❌ Unexpected error:`, err.message);
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────
scrape();
if (process.argv.includes('--watch')) {
  console.log(`\n👁  Watch mode — scraping every 5 minutes. Press Ctrl+C to stop.\n`);
  setInterval(scrape, WATCH_INTERVAL);
}
