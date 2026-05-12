/* Shekulli.info — Puppeteer Facebook Scraper
   Runs on the server every minute, scrapes the public FB page,
   deduplicates by post ID, and saves to posts.json.
*/

const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');
const fs        = require('fs');
const path      = require('path');

const POSTS_FILE = path.join(__dirname, 'posts.json');
const FB_PAGE    = 'https://www.facebook.com/shekulliinfo';

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
  const title      = lines[0]?.slice(0, 140) || (post.image ? '📷 Foto nga Shekulli.info' : '(pa titull)');
  const rest       = lines.slice(1).join('\n').trim();
  const category   = guessCategory(post.text);

  return {
    id:         post.id,
    fb_post_id: post.id,
    category,
    kicker:     category.toUpperCase(),
    title,
    standfirst: rest.slice(0, 300),
    body:       rest,
    photo:      post.image || '',
    hasVideo:   post.hasVideo || false,
    postUrl:    post.postUrl || '',
    author:     'Shekulli.info',
    published:  post.timestamp || Date.now(),
  };
}

async function scrapePosts() {
  let browser;
  try {
    console.log('[Scraper] Launching browser…');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Block only fonts/video — allow images so we can capture their URLs
    await page.setRequestInterception(true);
    page.on('request', req => {
      const t = req.resourceType();
      if (['font', 'media'].includes(t)) req.abort();
      else req.continue();
    });

    console.log('[Scraper] Loading Facebook page…');
    await page.goto(FB_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll a few times to load more posts
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await new Promise(r => setTimeout(r, 3000));
    }

    // Extract posts
    const rawPosts = await page.evaluate(() => {
      const articles = document.querySelectorAll('[role="article"]');
      const results  = [];

      articles.forEach((el, idx) => {
        // Text
        const textEl = el.querySelector('[data-testid="post_message"], div[dir="auto"]');
        let text = textEl?.innerText?.trim() || '';
        if (!text) {
          const lines = el.innerText?.split('\n') || [];
          text = lines
            .filter(t => t && t.length > 10 && !/^(Like|Comment|Share|Follow|More)/i.test(t))
            .join('\n');
        }

        // Image
        let image = '';
        const imgEl = el.querySelector('img[src]:not([src*="emoji"]):not([src*="static"])');
        if (imgEl) image = imgEl.getAttribute('src') || '';

        // Video detection — grab poster thumbnail + the Facebook post link for embedding
        let videoUrl = '';
        let hasVideo = false;
        const videoEl = el.querySelector('video');
        if (videoEl) {
          hasVideo = true;
          image = videoEl.getAttribute('poster') || image;
        }

        // Get the Facebook post permalink (used for video embedding)
        let postUrl = '';
        const linkEls = el.querySelectorAll('a[href*="/posts/"], a[href*="?v="], a[href*="/videos/"]');
        for (const a of linkEls) {
          const href = a.getAttribute('href') || '';
          if (href.includes('/posts/') || href.includes('/videos/') || href.includes('?v=')) {
            postUrl = href.startsWith('http') ? href : 'https://www.facebook.com' + href;
            break;
          }
        }

        // Timestamp
        let published = Date.now();
        const timeEl = el.querySelector('a[role="link"] abbr, abbr[data-utime]');
        if (timeEl) {
          const utime = timeEl.getAttribute('data-utime');
          if (utime) published = parseInt(utime) * 1000;
        }

        // Stable ID
        const id = 'fb_' + idx + '_' + btoa(encodeURIComponent((text || image).slice(0, 40))).replace(/[^a-z0-9]/gi, '').slice(0, 16);

        if (text || image || hasVideo) {
          results.push({ id, text, image, published, hasVideo, postUrl });
        }
      });

      return results;
    });

    console.log(`[Scraper] Found ${rawPosts.length} posts on page`);

    if (rawPosts.length === 0) return [];

    // Deduplicate against existing
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
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapePosts, loadPosts };
