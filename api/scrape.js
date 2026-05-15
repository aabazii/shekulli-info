const { kv } = require('@vercel/kv');

const GRAPH_VER    = 'v21.0';
const FB_PAGE_ID   = 'shekulliinfo';
const FB_TOKEN     = process.env.FB_PAGE_TOKEN;
const FB_APP_ID    = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'shekulli2026';
const VERCEL_URL   = process.env.VERCEL_URL || 'https://shekulli.vercel.app';

// ── Token resolution — stores permanent page token in KV so it survives restarts
async function resolveToken() {
  // 1. Check KV for a cached permanent token
  const cached = await kv.get('fb_permanent_token');
  if (cached) return cached;

  // 2. Try to exchange FB_TOKEN for a permanent page token
  if (!FB_TOKEN) return null;
  if (!FB_APP_ID || !FB_APP_SECRET) return FB_TOKEN;

  try {
    // Exchange short-lived → long-lived user token
    const ltRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${FB_APP_ID}` +
      `&client_secret=${FB_APP_SECRET}&fb_exchange_token=${FB_TOKEN}`
    );
    const ltData = await ltRes.json();
    if (!ltData.access_token) return FB_TOKEN;

    // Get permanent page token via /me/accounts
    const acctRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/me/accounts?access_token=${ltData.access_token}`
    );
    const acctData = await acctRes.json();
    if (!acctData.data?.length) return ltData.access_token;

    const page = acctData.data.find(p => /shekulli/i.test(p.name)) || acctData.data[0];
    const permanentToken = page.access_token;

    // Store in KV permanently — never needs to be exchanged again
    await kv.set('fb_permanent_token', permanentToken);
    console.log(`🔑 Stored permanent page token for: ${page.name}`);
    return permanentToken;
  } catch (e) {
    console.warn('Token exchange failed, using FB_TOKEN directly:', e.message);
    return FB_TOKEN;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clean(text) {
  return (text || '')
    .replace(/\s*(\.{3}|…)\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .replace(/\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .trim();
}

function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#lsi\b|#ldk\b|#vv\b/i.test(ht)) return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan|#deçan/i.test(ht))      return 'Kosovë';
  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#volejboll|#atletizëm|#formula1/i.test(ht))     return 'Sport';
  if (/#ekonomi|#biznes|#financa|#buxhet|#turizëm/i.test(ht))                                         return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#trump|#putin/i.test(ht))                     return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#teatër/i.test(ht))                                       return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))                                                return 'Opinion';

  if (/\bpolitik|\bqeveri\b|\bkuvend\b|\bkryeministr|\bministr|\bdeputet|\bopozit|\bmazhorancë|\bkoalicion|\bzgjedhj|\bvotim\b|\breferendum|\bpresidenc|\bdekret\b|\breform\b|\bligj\b|\bamendament|\bkushtetut|\bedi\s*rama|\brama\b|\bbasha\b|\bberisha|\bvetëvendosje|\bvv\b|\bldk\b|\bpdk\b|\blsi\b/.test(t)) return 'Politikë';
  if (/\bkosov|\bprishtinë|\bprizren|\bpejë\b|\bmitrovicë|\bgjakovë|\bferizaj|\bgjilan|\bdeçan|\brahovec|\bsuharekë|\bvushtrri|\bpodujevë|\bkamenicë|\bkurti\b|\bvjosa\b|\bosmani\b/.test(t)) return 'Kosovë';
  if (/\bfutboll|\bbasketboll|\bvolejboll|\btenis\b|\batletizëm|\bgol\b|\bpenalti\b|\bstadium\b|\blojtarë|\btrajner\b|\btransferim\b|\bskuadër\b|\bserie\s*a|\bpremier\s*league|\bchampions\b|\bnba\b|\bfifa\b|\buefa\b|\bkampionat\b/.test(t)) return 'Sport';
  if (/\bbotë\b|\bndërkombëtar|\beuropë\b|\bbashkim\s*europian|\bnato\b|\bonu\b|\bshba\b|\bukrainë|\brusi\b|\bizrael|\bpalestin|\bgaza\b|\btrump\b|\bputin\b|\bzelenski|\bmacron\b|\berdogan\b|\bkinë\b/.test(t)) return 'Botë';
  if (/\bekونomi|\bbiznes\b|\bbanka\b|\binflacion|\bturizëm|\beksport|\bimport\b|\binvestim|\bkompani\b|\btatim\b|\btregti\b|\bpunësim|\bpapunësi|\bpagë\b/.test(t)) return 'Ekonomi';
  if (/\bkulturë\b|\bart\b|\bmuzikë\b|\bkëngë\b|\bfilm\b|\bteatër\b|\bekspozitë|\blibër\b|\bfestiv|\bkoncert\b|\balbum|\btrashëgimi/.test(t)) return 'Kulturë';
  if (/\bopinion\b|\bkoment\b|\beditorial|\banaliz|\bdebat\b/.test(t)) return 'Opinion';
  return 'Lajme';
}

async function mirrorImage(fbUrl, ts) {
  if (!fbUrl) return '';
  try {
    const imgRes = await fetch(fbUrl, { signal: AbortSignal.timeout(8000) });
    if (!imgRes.ok) return fbUrl;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 500) return fbUrl;
    const ext = fbUrl.includes('.png') ? 'png' : 'jpg';
    const uploadRes = await fetch(`${VERCEL_URL}/api/admin/upload?filename=fb-${ts}.${ext}`, {
      method: 'POST',
      headers: { 'Content-Type': `image/${ext}`, 'Authorization': `Bearer ${ADMIN_PASS}` },
      body: buf,
      signal: AbortSignal.timeout(10000),
    });
    if (!uploadRes.ok) return fbUrl;
    const data = await uploadRes.json();
    return data.url || fbUrl;
  } catch {
    return fbUrl;
  }
}

async function fetchPosts(token) {
  const fields = 'id,message,full_picture,attachments{type,media,url},created_time,permalink_url';
  const url = `https://graph.facebook.com/${GRAPH_VER}/${FB_PAGE_ID}/posts?fields=${fields}&limit=30&access_token=${token}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (data.error) throw Object.assign(new Error(data.error.message), { code: data.error.code });
  return data.data || [];
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  if (!isVercelCron && auth !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  // ?reset=token clears the cached permanent token so next run re-exchanges
  if (req.query?.reset === 'token') {
    await kv.del('fb_permanent_token');
    return res.json({ ok: true, message: 'Cached token cleared — will re-exchange on next scrape' });
  }

  try {
    const token = await resolveToken();
    if (!token) {
      return res.status(500).json({ ok: false, message: 'FB_PAGE_TOKEN not set' });
    }

    let fbPosts;
    try {
      fbPosts = await fetchPosts(token);
    } catch (tokenErr) {
      // Token invalid — clear cached token so next run re-exchanges with FB_TOKEN
      if (tokenErr.code === 190) {
        await kv.del('fb_permanent_token');
        console.log('⚠️  Token invalid (190) — cleared cache, will re-exchange next run');
      }
      throw tokenErr;
    }

    if (fbPosts.length === 0) {
      return res.json({ ok: true, message: 'No posts from API' });
    }

    // Process posts
    const posts = [];
    for (const p of fbPosts) {
      const rawText = (p.message || '').trim();
      if (!rawText) continue;

      const cat      = guessCategory(rawText);
      const fullText = clean(rawText);
      const lines    = fullText.split('\n').map(l => l.trim()).filter(Boolean);
      let title      = (lines[0] || '').slice(0, 140).trim();
      if (!title) continue;

      const body       = lines.length > 1 ? lines.slice(1).join('\n\n') : fullText;
      const standfirst = body.slice(0, 300);

      let hasVideo = false;
      for (const att of (p.attachments?.data || [])) {
        if (/video/i.test(att.type || '')) { hasVideo = true; break; }
      }

      const published = new Date(p.created_time).getTime();
      let photo = p.full_picture || '';
      if (photo) photo = await mirrorImage(photo, published);

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
        postUrl:    p.permalink_url || '',
        author:     'Shekulli.info',
        published,
      });
    }

    if (posts.length === 0) {
      return res.json({ ok: true, message: 'No processable posts found' });
    }

    // Merge with existing
    const existing   = (await kv.get('posts')) || [];
    const blocklist  = new Set((await kv.get('deleted_ids')) || []);
    const existingMap = new Map(existing.map(p => [String(p.id), p]));

    let added = 0, updated = 0;
    const toAdd = [];

    for (const p of posts) {
      if (blocklist.has(p.id)) continue;
      const prev = existingMap.get(p.id);
      if (!prev) {
        toAdd.push(p);
        added++;
      } else {
        const prevLen = (prev.body || '').length;
        const newLen  = (p.body || '').length;
        const hadSeeMore = /see\s*more|shiko\s*më\s*shumë/i.test(prev.title + ' ' + prev.standfirst + ' ' + prev.body);
        if (newLen > prevLen + 20 || hadSeeMore) {
          existingMap.set(p.id, { ...prev, ...p });
          updated++;
        }
      }
    }

    if (added === 0 && updated === 0) {
      return res.json({ ok: true, message: `No new posts (${posts.length} checked, all duplicates)` });
    }

    const merged = [...toAdd, ...Array.from(existingMap.values())]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kv.set('posts', merged);

    const parts = [];
    if (added)   parts.push(`${added} new`);
    if (updated) parts.push(`${updated} updated`);
    return res.json({ ok: true, message: `✅ ${parts.join(', ')} (${merged.length} total)` });

  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
