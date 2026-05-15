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
const FB_APP_ID   = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const WATCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ── Resolve the best available token ─────────────────────────────────────────
// App Access Token (APP_ID|APP_SECRET) never expires and reads public pages.
// Falls back to FB_PAGE_TOKEN if app credentials are missing.
function resolvePageToken() {
  if (FB_APP_ID && FB_APP_SECRET) {
    console.log('🔑 Using App Access Token (never expires)');
    return `${FB_APP_ID}|${FB_APP_SECRET}`;
  }
  return FB_TOKEN;
}

// ── Category detection ──────────────────────────────────────────────────────
// Priority order: Hashtags first, then keyword matching.
// Politikë / Kosovë are checked BEFORE Sport to avoid false positives
// (e.g. "ndeshje" = match/encounter, "klub" = club — both used in politics too).
function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

  // ── Hashtag shortcuts (most reliable signal) ───────────────────────────
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#lsi\b|#ldk\b|#vv\b/i.test(ht))
    return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan|#deçan|#rahovec/i.test(ht))
    return 'Kosovë';
  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#volejboll|#atletizëm|#formula1|#f1/i.test(ht))
    return 'Sport';
  if (/#ekonomi|#biznes|#financa|#buxhet|#turizëm|#eksport|#import/i.test(ht))
    return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#rusi|#izrael|#gaza|#trump|#putin/i.test(ht))
    return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#kinema|#teatër|#libër|#festiv/i.test(ht))
    return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))
    return 'Opinion';

  // ── Keyword matching — Politikë & Kosovë checked FIRST ────────────────
  // Politikë: government, parliament, parties, politicians
  if (/\bpolitik|\bqeveri\b|\bkuvend\b|\bkryeministr|\bministr|\bpremiер|\bdeputet|\bopozit|\bmazhorancë|\bkoalicion|\bzgjedhj|\bvotim\b|\breferendum|\bpresidenc|\bdekret\b|\breform\b|\bligj\b|\bamendament|\bkushtetut|\bedi\s*rama|\brama\b|\bbasha\b|\bberisha|\bkryeminist|\blëvizja\b|\bvetëvendosje|\bvv\b|\bldk\b|\bpdk\b|\blsi\b|\baak\b/.test(t))
    return 'Politikë';

  // Kosovë: cities, institutions, politicians of Kosovo
  if (/\bkosov|\bprishtinë|\bprizren|\bpejë\b|\bmitrovicë|\bgjakovë|\bferizaj|\bgjilan|\bdeçan|\brahovec|\bsuharekë|\bvushtrri|\bpodujevë|\bkamenicë|\bdragash|\bmalishevë|\bkurti\b|\bvjosa\b|\bosmani\b|\bsrpska|\bfsк\b|\bpolicia\b|\bprokuroria\b|\bgjykata\b/.test(t))
    return 'Kosovë';

  // Sport: only unambiguously sports terms (removed ndeshje, klub, not, liga — too generic)
  if (/\bfutboll|\bbasketboll|\bvolejboll|\btenis\b|\batletizëm|\bgjimnastik|\bformula\s*1|\bf1\b|\bmoto\s*gp|\bgol\b|\bpenalti\b|\barbitër\b|\bstadium\b|\btifo\b|\blojtarë|\btrajner\b|\btransferim\b|\bskuadër\b|\bserie\s*a|\bpremier\s*league|\bchampions\b|\beuropa\s*league|\bbundesliga|\blaliga\b|\bnba\b|\bfifa\b|\buefa\b|\bkampionat\b/.test(t))
    return 'Sport';

  // Botë: international news
  if (/\bbotë\b|\bndërkombëtar|\beuropë\b|\bbashkim\s*europian|\beu\b|\bnato\b|\bonu\b|\bshba\b|\bshtetet\s*e\s*bashkuara|\bukrainë|\brusi\b|\bizrael|\bpalestin|\bgaza\b|\btrump\b|\bbiden\b|\bputin\b|\bzelenski|\bmacron\b|\berdogan\b|\bkinë\b|\bjaponi\b|\bsiri\b|\bafganistan|\birak\b|\biran\b|\blibi\b|\bturqi\b/.test(t))
    return 'Botë';

  // Ekonomi: economy and business
  if (/\bekونomi|\bbiznes\b|\bbanka\b|\bbankë\b|\binflacion|\bturizëm|\beksport|\bimport\b|\btreg\b|\bgdp\b|\bbpv\b|\binvestim|\bkompani\b|\baksion\b|\bbursë\b|\bkurs\s*këmbim|\btatim\b|\bdoganë\b|\btregti\b|\bprodhim\b|\bpunësim|\bpapunësi|\bpagë\b|\brecesion|\bstartup/.test(t))
    return 'Ekonomi';

  // Kulturë: arts and culture
  if (/\bkulturë\b|\bart\b|\bmuzikë\b|\bkëngë\b|\bkëngëtar|\baktor\b|\baktore\b|\bfilm\b|\bkinema\b|\bteatër\b|\bekspozitë|\blibër\b|\blibra\b|\bshkrimtar|\bpoet\b|\bpoezi|\bfestiv|\bkoncert\b|\balbum|\bpremiere\b|\bgaleri\b|\barkitektur|\btrashëgimi/.test(t))
    return 'Kulturë';

  // Opinion: commentary and analysis
  if (/\bopinion\b|\bkoment\b|\beditorial|\banaliz|\bperspektiv|\bvëzhgim|\bdebat\b/.test(t))
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

// ── Strip Facebook UI artifacts from post text ─────────────────────────────
function clean(text) {
  return (text || '')
    .replace(/\s*(\.{3}|…)\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .replace(/\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .trim();
}

// ── Fetch posts from the Graph API ─────────────────────────────────────────
async function fetchGraphPosts(limit = 30, token = FB_TOKEN) {
  const fields = [
    'id',
    'message',
    'full_picture',
    'attachments{type,media,url}',
    'created_time',
    'permalink_url',
  ].join(',');

  const url = `https://graph.facebook.com/${GRAPH_VER}/${FB_PAGE_ID}/posts` +
    `?fields=${fields}&limit=${limit}&access_token=${token}`;

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

  if (!FB_TOKEN && !(FB_APP_ID && FB_APP_SECRET)) {
    console.error(`[${ts}] ❌ No Facebook credentials. Set FB_APP_ID + FB_APP_SECRET (recommended) or FB_PAGE_TOKEN.`);
    process.exit(1);
  }

  try {
    const pageToken = resolvePageToken();
    const fbPosts = await fetchGraphPosts(30, pageToken);
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

      const cat      = guessCategory(rawText);
      const fullText = clean(rawText);
      const lines    = fullText.split('\n').map(l => l.trim()).filter(Boolean);

      let title = (lines[0] || '').slice(0, 140).trim();
      if (!title) title = '📷 Foto nga Shekulli.info';

      // If the post is a single paragraph, body = full text so nothing is lost
      const body       = lines.length > 1 ? lines.slice(1).join('\n') : fullText;
      const standfirst = body.slice(0, 300);

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
