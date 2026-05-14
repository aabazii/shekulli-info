/* Shekulli.info — Puppeteer Facebook Scraper
   Scrapes the public FB page every minute.
   Uses full puppeteer (downloads its own Chromium — works on Render).
*/

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const POSTS_FILE   = path.join(__dirname, 'posts.json');
const SESSION_FILE = path.join(__dirname, 'fb-session.json');
const FB_PAGE      = 'https://www.facebook.com/shekulliinfo';

function loadSession() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    return s.cookies || [];
  } catch { return []; }
}

function loadPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')); }
  catch { return []; }
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

  // Hashtag shortcuts
  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#formula1|#f1/i.test(ht))          return 'Sport';
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#ldk\b|#vv\b/i.test(ht)) return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan/i.test(ht)) return 'Kosovë';
  if (/#ekonomi|#biznes|#financa|#turizëm/i.test(ht))                                    return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#trump|#putin/i.test(ht))        return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#teatër/i.test(ht))                          return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))                                   return 'Opinion';

  // Keyword matching
  if (/\bsport\b|futboll|basketboll|volejboll|tenis|gjimnastik|formula\s*1|\bf1\b|kampionat|gol\b|penalti|arbitër|ndeshje|stadium|lojtarë|trajner|transferim|skuadër|klub\b|liga\b|serie\s*a|premier\s*league|champions|europa\s*league|bundesliga|laliga|nba\b|fifa\b|uefa\b/.test(t))
    return 'Sport';
  if (/politik|qeveri|kuvend|kryeministr|ministr|premier|deputet|parti\b|opozit|mazhorancë|koalicion|zgjedhj|votim|referendum|presidenc|dekret|bashki|komun|ligj\b|amendament|kushtetut|edi\s*rama|rama\b|basha\b|berisha|kryeminist/.test(t))
    return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë\b|mitrovicë|gjakovë|ferizaj|gjilan|deçan|rahovec|suharekë|vushtrri|podujevë|kamenicë|dragash|malishevë|kurti\b|vjosa\b|osmani/.test(t))
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

function postToArticle(post) {
  const cleaned = (post.text || '')
    .replace(/[…\.]{1,3}\s*Shiko më shumë[\s\S]*/i, '')
    .replace(/Shiko më shumë[\s\S]*/i, '')
    .trim();

  const lines    = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const title    = lines[0]?.slice(0, 140) || (post.image ? '📷 Foto nga Shekulli.info' : '(pa titull)');
  const rest     = lines.slice(1).join('\n').trim();
  const category = guessCategory(post.text);

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
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Inject saved Facebook session cookies (if available)
    const cookies = loadSession();
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`[Scraper] Loaded ${cookies.length} session cookies`);
    } else {
      console.log('[Scraper] No session found — scraping as guest. Run: node save-session.js');
    }

    // Block fonts/video to speed up — keep images so we get photo URLs
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    console.log('[Scraper] Loading Facebook page…');
    await page.goto(FB_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });

    // Scroll a few times to load more posts
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await new Promise(r => setTimeout(r, 2500));
    }

    const rawPosts = await page.evaluate(() => {
      const articles = document.querySelectorAll('[role="article"]');
      const results  = [];

      articles.forEach((el, idx) => {
        // Text
        const textEl = el.querySelector('[data-testid="post_message"], div[dir="auto"]');
        let text = textEl?.innerText?.trim() || '';
        if (!text) {
          text = [...el.innerText.split('\n')]
            .filter(t => t.trim().length > 10 && !/^(Like|Comment|Share|Follow|More)/i.test(t.trim()))
            .join('\n');
        }

        // Image
        let image = '';
        for (const img of el.querySelectorAll('img')) {
          const src = img.src || img.getAttribute('src') || '';
          if (src && !src.includes('emoji') && !src.includes('static') && src.startsWith('http')) {
            image = src;
            break;
          }
        }

        // Video
        let hasVideo = false;
        let postUrl  = '';
        const videoEl = el.querySelector('video');
        if (videoEl) {
          hasVideo = true;
          image = image || videoEl.getAttribute('poster') || '';
        }

        // Post link (for video embedding)
        for (const a of el.querySelectorAll('a[href]')) {
          const href = a.href || '';
          if (/\/(posts|videos)\/|[?&]v=/.test(href)) {
            postUrl = href;
            break;
          }
        }

        // Timestamp via abbr[data-utime]
        let published = Date.now();
        const abbr = el.querySelector('abbr[data-utime]');
        if (abbr) published = parseInt(abbr.dataset.utime) * 1000;

        const id = 'fb_' + idx + '_' + btoa(encodeURIComponent((text || image).slice(0, 30))).replace(/[^a-z0-9]/gi, '').slice(0, 14);

        if (text || image || hasVideo) {
          results.push({ id, text, image, published, hasVideo, postUrl });
        }
      });

      return results;
    });

    console.log(`[Scraper] Found ${rawPosts.length} posts on page`);
    if (rawPosts.length > 0) {
      console.log('[Scraper] Sample image:', rawPosts[0]?.image || '(none)');
    }

    if (rawPosts.length === 0) return [];

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
