/* Shekulli.info — Apify Facebook Posts Scraper
   Uses Apify's Facebook Posts Scraper actor.
*/

const fs   = require('fs');
const path = require('path');

const POSTS_FILE = path.join(__dirname, 'posts.json');
const ENV_FILE   = path.join(__dirname, '.env');
const ACTOR      = 'apify~facebook-posts-scraper';

// Load .env
function loadEnv() {
  try {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {}
}
loadEnv();

function loadPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')); }
  catch { return []; }
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
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

function postToArticle(post) {
  const cleaned = (post.text || '')
    .replace(/[…\.]{1,3}\s*Shiko më shumë[\s\S]*/i, '')
    .replace(/Shiko më shumë[\s\S]*/i, '')
    .trim();

  const lines      = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  // For photo/video posts with no text, use a placeholder title
  const title      = lines[0]?.slice(0, 140) || (post.image ? '📷 Foto nga Shekulli.info' : '(pa titull)');
  const rest       = lines.slice(1).join('\n').trim();
  const standfirst = rest.slice(0, 300);
  const category   = guessCategory(post.text);

  return {
    id:         post.id,
    fb_post_id: post.id,
    category,
    kicker:     category.toUpperCase(),
    title,
    standfirst,
    body:       rest,
    photo:      post.image || '',
    author:     'Shekulli.info',
    published:  post.timestamp || Date.now(),
  };
}

async function scrapePosts() {
  const token = process.env.APIFY_API_TOKEN;

  if (!token || token === 'YOUR_APIFY_TOKEN') {
    console.warn('[Scraper] ⚠  APIFY_API_TOKEN not set in server/.env');
    console.warn('[Scraper]    Get it from: https://apify.com → Account settings → API tokens');
    return [];
  }

  console.log('[Scraper] Calling Apify Facebook Posts Scraper…');

  try {
    // Start actor run
    const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        startUrls: [{ url: 'https://www.facebook.com/shekulliinfo' }],
        maxPostsPerPage: 100,
        includePostStats: true,
      }),
    });

    if (!runRes.ok) {
      const err = await runRes.json();
      throw new Error(`Apify error: ${err.message || runRes.status}`);
    }

    const runData = await runRes.json();
    const runId = runData.data.id;
    console.log(`[Scraper] Started run ${runId}`);

    // Poll for completion
    let status = 'RUNNING';
    let attempts = 0;
    const maxAttempts = 120; // 10 min

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const checkRes = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/runs/${runId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!checkRes.ok) throw new Error(`Status check failed: ${checkRes.status}`);

      const checkData = await checkRes.json();
      status = checkData.data?.status || 'UNKNOWN';

      if (attempts % 6 === 0) console.log(`[Scraper] Waiting… (${attempts * 5}s)`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Run failed: ${status}`);
    }

    console.log('[Scraper] Run completed, fetching results…');

    // Get dataset — first fetch run details to get dataset ID
    const runDetailsRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/runs/${runId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const runDetails = await runDetailsRes.json();
    const datasetId = runDetails.data.defaultDatasetId;

    if (!datasetId) {
      throw new Error('No dataset found in run');
    }

    // Get dataset items
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!itemsRes.ok) {
      throw new Error(`Failed to fetch items: ${itemsRes.status}`);
    }

    const items = await itemsRes.json();
    console.log(`[Scraper] Got ${items.length} posts from Apify`);

    // Log the first item's keys so we can see exactly what Apify returns
    if (items.length > 0) {
      const sample = items[0];
      console.log('[Scraper] Sample item keys:', Object.keys(sample).join(', '));
      console.log('[Scraper] Sample media field:', JSON.stringify(sample.media || sample.images || sample.attachments || null));
      console.log('[Scraper] Sample video field:', JSON.stringify(sample.video || sample.videoUrl || null));
    }

    // Helper: extract best available image/video thumbnail from an Apify item
    function extractMedia(item) {
      // Try every known field Apify uses across actor versions
      if (item.media && item.media.length > 0) {
        const m = item.media[0];
        return m.src || m.url || m.thumbnail || '';
      }
      if (item.images && item.images.length > 0) {
        return item.images[0].src || item.images[0].url || item.images[0] || '';
      }
      if (item.attachments && item.attachments.length > 0) {
        const a = item.attachments[0];
        return a.src || a.url || a.image || a.thumbnail || '';
      }
      if (item.videoUrl) return item.videoUrl;
      if (item.video) return typeof item.video === 'string' ? item.video : (item.video.src || item.video.url || '');
      if (item.imageUrl) return item.imageUrl;
      if (item.image) return typeof item.image === 'string' ? item.image : '';
      return '';
    }

    // Convert items to our format — include posts even if they have no text (photo/video posts)
    const rawPosts = items
      .filter(item => item.text || extractMedia(item)) // keep photo/video-only posts too
      .map(item => ({
        id: item.postId || item.facebookId || 'post_' + Math.random().toString(36).slice(2),
        text: item.text || '',
        image: extractMedia(item),
        timestamp: (() => {
          if (!item.timestamp) return Date.now();
          const t = new Date(item.timestamp).getTime();
          // If result is suspiciously small, it came in as Unix seconds — multiply by 1000
          return t < 1e12 ? t * 1000 : t;
        })(),
      }));

    console.log(`[Scraper] Parsed ${rawPosts.length} posts`);

    if (rawPosts.length === 0) {
      console.log('[Scraper] No posts found.');
      return [];
    }

    // Merge & deduplicate
    const existing    = loadPosts();
    const existingIds = new Set(existing.map(p => String(p.id)));
    const newRaw      = rawPosts.filter(p => !existingIds.has(String(p.id)));

    if (newRaw.length === 0) {
      console.log('[Scraper] No new posts.');
      return [];
    }

    const newArticles = newRaw.map(postToArticle);
    const merged = [...newArticles, ...existing]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    savePosts(merged);
    console.log(`[Scraper] ✅ Saved ${newArticles.length} new posts (${merged.length} total)`);
    return newArticles;

  } catch (err) {
    console.error('[Scraper] Error:', err.message);
    return [];
  }
}

module.exports = { scrapePosts, loadPosts };
