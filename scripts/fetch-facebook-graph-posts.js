#!/usr/bin/env node
/**
 * Fetch all posts from your Facebook Page as JSON (official Meta Graph API).
 *
 * Why not raw HTML scraping?
 * - facebook.com pages are JS-heavy, often require login, and change often.
 * - Meta's supported way is the Graph API: https://developers.facebook.com/docs/graph-api
 *
 * Setup (one-time):
 * 1. Create a Meta app: https://developers.facebook.com/apps/
 * 2. Add product "Facebook Login" or use Graph API Explorer for a short-lived token.
 * 3. Get a Page access token with permission pages_read_engagement (and pages_show_list).
 *    Long-lived token: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 * 4. Your page: https://www.facebook.com/shekulliinfo — use its numeric Page ID or vanity name.
 *
 * Usage:
 *   export FACEBOOK_PAGE_ACCESS_TOKEN="your_page_token"
 *   export FACEBOOK_PAGE_ID="shekulliinfo"   # optional; defaults to shekulliinfo
 *   node scripts/fetch-facebook-graph-posts.js
 *
 * Output: facebook_posts_for_import.json (Shekulli-shaped articles + raw fb fields)
 */

const fs = require('fs');
const path = require('path');

const GRAPH_VERSION = 'v21.0';
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || 'shekulliinfo';
const TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const OUT = path.join(__dirname, '..', 'facebook_posts_for_import.json');

const FIELDS = [
  'id',
  'message',
  'story',
  'created_time',
  'permalink_url',
  'full_picture',
  'attachments{media_type,media{image{src}},subattachments}',
].join(',');

function guessCategory(text) {
  const t = (text || '').toLowerCase();
  if (/politik|qeveri|kuvend|parti|zgjedhj|premier|ministr|kryeministr|opozit/.test(t)) return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë|mitrovicë|gjakovë|ferizaj|gjilan/.test(t)) return 'Kosovë';
  if (/botë|ndërkombëtar|europë|shba|nato|onu|\beu\b|ukrainë|rusi|izrael|gaza/.test(t)) return 'Botë';
  if (/ekonomi|biznes|banka|inflacion|turizëm|eksport|import|treg|gdp/.test(t)) return 'Ekonomi';
  if (/sport|futboll|basketboll|tenis|kampionat|gol|ndeshje|skuadr/.test(t)) return 'Sport';
  if (/kulturë|art|muzikë|film|teatër|ekspozitë|libër|poet/.test(t)) return 'Kulturë';
  if (/opinion|koment|editorial|analiz/.test(t)) return 'Opinion';
  return 'Lajme';
}

function firstImageFromAttachments(att) {
  if (!att || !att.data || !att.data.length) return '';
  for (const a of att.data) {
    const src = a.media?.image?.src;
    if (src) return src;
    const subs = a.subattachments?.data;
    if (subs && subs[0]?.media?.image?.src) return subs[0].media.image.src;
  }
  return '';
}

function fbPostToArticle(p) {
  const raw = [p.message, p.story].filter(Boolean).join('\n\n').trim();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || p.story || '(pa titull)').slice(0, 200);
  const rest = lines.slice(1).join('\n\n').trim();
  const standfirst = (rest || raw).slice(0, 300);
  const body = rest || raw || title;
  const photo = p.full_picture || firstImageFromAttachments(p.attachments) || '';
  const category = guessCategory(raw);
  const safeId = `fb_${String(p.id).replace(/[^\w]/g, '_')}`;

  return {
    id: safeId,
    fb_graph_id: p.id,
    fb_permalink: p.permalink_url || '',
    category,
    kicker: category.toUpperCase(),
    title,
    standfirst,
    body,
    photo,
    author: 'Shekulli.info',
    published: new Date(p.created_time).getTime(),
  };
}

async function fetchAllPosts() {
  const posts = [];
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(
    PAGE_ID
  )}/posts?fields=${encodeURIComponent(FIELDS)}&limit=100&access_token=${encodeURIComponent(TOKEN)}`;

  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error('Graph API error:', JSON.stringify(data.error, null, 2));
      process.exit(1);
    }
    for (const p of data.data || []) {
      posts.push({
        raw: p,
        article: fbPostToArticle(p),
      });
    }
    url = data.paging && data.paging.next ? data.paging.next : null;
    if (url) console.log(`Fetched ${posts.length} posts so far…`);
  }

  return posts;
}

async function main() {
  if (!TOKEN) {
    console.error(`
Missing FACEBOOK_PAGE_ACCESS_TOKEN.

Get a Page access token from Meta (Graph API Explorer or your app), then:
  export FACEBOOK_PAGE_ACCESS_TOKEN="..."
  export FACEBOOK_PAGE_ID="${PAGE_ID}"
  node scripts/fetch-facebook-graph-posts.js
`);
    process.exit(1);
  }

  console.log(`Fetching posts for page: ${PAGE_ID} (Graph ${GRAPH_VERSION})…`);
  const wrapped = await fetchAllPosts();
  const articles = wrapped.map((w) => w.article);
  const payload = {
    fetched_at: new Date().toISOString(),
    page_id: PAGE_ID,
    count: articles.length,
    articles,
  };
  if (process.env.INCLUDE_RAW === '1' || process.env.INCLUDE_RAW === 'true') {
    payload.raw_posts = wrapped.map((w) => w.raw);
  }

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nWrote ${articles.length} articles to:\n  ${OUT}\n`);
  console.log('Import: use the "articles" array (matches Shekulli article fields).');
  console.log('Optional: INCLUDE_RAW=1 to embed full Graph post objects.\n');
  console.log('If articles is empty, check token permissions and Page ID.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
