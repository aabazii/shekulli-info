/* Facebook Graph API — fetch posts from @shekulliinfo and sync to DB */

const { upsertArticle } = require('./db');

const PAGE_ID       = process.env.FB_PAGE_ID    || 'shekulliinfo';
const ACCESS_TOKEN  = process.env.FB_ACCESS_TOKEN;
const GRAPH_VERSION = 'v19.0';
const GRAPH_BASE    = `https://graph.facebook.com/${GRAPH_VERSION}`;

/*
  Post → Article mapping
  ─────────────────────
  Facebook posts don't have a title. We derive one from the first line of
  the message (up to 120 chars), use the rest as standfirst + body.
*/
function parsePost(post) {
  const message   = (post.message || '').trim();
  const lines     = message.split('\n').filter(Boolean);
  const title     = lines[0]?.slice(0, 120) || '(pa titull)';
  const rest      = lines.slice(1).join('\n').trim();
  const standfirst = rest.slice(0, 280);
  const body      = rest;
  const photo     = post.full_picture || post.attachments?.data?.[0]?.media?.image?.src || '';
  const published = new Date(post.created_time).getTime();

  // Guess category from hashtags in the message
  const category = guessCategory(message);

  return {
    fb_post_id: post.id,
    title,
    standfirst,
    body,
    photo,
    author: 'Shekulli.info',
    category,
    kicker: category.toUpperCase(),
    published,
  };
}

const CATEGORY_MAP = [
  [/\b(politik|qeveri|kuvend|parti|zgjedhj|premier|ministr)/i, 'Politikë'],
  [/\b(kosov|prishtinë|prizren|pejë|mitrovicë|gjakovë)/i,    'Kosovë'],
  [/\b(botë|ndërkombëtar|europë|shba|nato|onu|be\b)/i,       'Botë'],
  [/\b(ekonomi|biznes|banka|inflacion|turizëm|eksport)/i,     'Ekonomi'],
  [/\b(sport|futboll|basketboll|tenis|kampionat|gol)/i,       'Sport'],
  [/\b(kulturë|art|muzikë|film|teatër|ekspozitë)/i,           'Kulturë'],
  [/\b(opinion|koment|editorial|analiz)/i,                    'Opinion'],
];

function guessCategory(text) {
  for (const [re, cat] of CATEGORY_MAP) {
    if (re.test(text)) return cat;
  }
  return 'Lajme';
}

/* ── Core fetch ────────────────────────────────────────────────── */

async function fetchPagePosts({ since } = {}) {
  if (!ACCESS_TOKEN) {
    throw new Error('FB_ACCESS_TOKEN not set in .env — see README for how to get one.');
  }

  const fields = [
    'id', 'message', 'created_time',
    'full_picture',
    'attachments{media,type}',
  ].join(',');

  const url = new URL(`${GRAPH_BASE}/${PAGE_ID}/posts`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '25');
  url.searchParams.set('access_token', ACCESS_TOKEN);
  if (since) url.searchParams.set('since', Math.floor(since / 1000).toString());

  const res  = await fetch(url.toString());
  const json = await res.json();

  if (json.error) {
    throw new Error(`Graph API error ${json.error.code}: ${json.error.message}`);
  }

  return json.data || [];
}

/* ── Sync loop ─────────────────────────────────────────────────── */

let lastSyncTime = Date.now() - 24 * 60 * 60 * 1000; // start: last 24 h

async function syncFacebookPosts() {
  console.log('[Facebook] Syncing posts since', new Date(lastSyncTime).toISOString());
  let newCount = 0;

  try {
    const posts = await fetchPagePosts({ since: lastSyncTime });
    for (const post of posts) {
      if (!post.message) continue; // skip link-only posts with no text
      const article = parsePost(post);
      await upsertArticle(article);
      newCount++;
    }
    lastSyncTime = Date.now();
    console.log(`[Facebook] Sync complete — ${newCount} posts upserted.`);
  } catch (err) {
    console.error('[Facebook] Sync failed:', err.message);
  }

  return newCount;
}

module.exports = { syncFacebookPosts };
