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
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
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

    // ── Detect login wall / session expiry ──────────────────────────
    const currentUrl = page.url();
    const pageContent = await page.content();
    const isLoginWall = currentUrl.includes('/login') ||
                        currentUrl.includes('checkpoint') ||
                        pageContent.includes('id="loginbutton"') ||
                        pageContent.includes('name="login"');

    if (isLoginWall) {
      console.error('[Scraper] ⚠️  Facebook login wall detected — session cookies have expired!');
      console.error('[Scraper]    Run: node save-session.js    to refresh your Facebook session.');
      return [];
    }

    // ── Scroll to load more posts ───────────────────────────────────
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await new Promise(r => setTimeout(r, 3000));
    }

    // ── Click all "See more" / "Shiko më shumë" buttons ─────────────
    try {
      const seeMoreButtons = await page.$$('div[role="button"]');
      let clickedCount = 0;
      for (const btn of seeMoreButtons) {
        const text = await btn.evaluate(el => el.innerText?.trim() || '');
        if (/^(see more|shiko më shumë|mehr anzeigen|voir plus)$/i.test(text)) {
          // Use DOM click to bypass Puppeteer overlay issues
          await page.evaluate(el => el.click(), btn).catch(() => {});
          clickedCount++;
          await new Promise(r => setTimeout(r, 300));
        }
      }
      if (clickedCount > 0) {
        console.log(`[Scraper] Expanded ${clickedCount} "See more" buttons`);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.log('[Scraper] Note: Could not expand "See more" buttons:', e.message);
    }

    // ── Extract posts from the DOM ──────────────────────────────────
    const rawPosts = await page.evaluate(() => {
      function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const c = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + c;
          hash |= 0;
        }
        return Math.abs(hash).toString(36);
      }

      const results = [];
      const seenContainers = new Set();
      
      // Find all text blocks that look like post bodies
      const textBlocks = Array.from(document.querySelectorAll('div[data-ad-preview="message"], div[dir="auto"]'));
      
      for (const block of textBlocks) {
        // Traverse up to find the main post container
        let container = block.closest('[role="article"]') || block.closest('[aria-posinset]');
        if (!container) {
          container = block;
          for (let j = 0; j < 6; j++) {
            if (container.parentElement) container = container.parentElement;
          }
        }
        
        if (seenContainers.has(container)) continue;
        seenContainers.add(container);

        // Aggregate all text inside this container
        let text = '';
        const msgBlock = container.querySelector('div[data-ad-preview="message"]');
        if (msgBlock) {
          text = msgBlock.innerText?.trim() || '';
        } else {
          // Fallback: join all dir="auto"
          text = Array.from(container.querySelectorAll('div[dir="auto"]'))
            .map(el => el.innerText?.trim())
            .filter(t => t && t.length > 10 && !/^(Like|Comment|Share|Follow|More|Pëlqe|Komento|Shpërnda|Comment as)/i.test(t))
            .join('\\n');
        }

        if (text.length < 15) continue;

        // Image extraction
        let image = '';
        for (const img of container.querySelectorAll('img')) {
          const src = img.src || img.getAttribute('src') || '';
          if (src && !src.includes('emoji') && !src.includes('static') &&
              !src.includes('rsrc.php') && !src.includes('profile') &&
              src.startsWith('http') && (src.includes('scontent') || src.includes('fbcdn'))) {
            image = src;
            break;
          }
        }

        // Video extraction
        let hasVideo = false;
        const videoEl = container.querySelector('video');
        if (videoEl) {
          hasVideo = true;
          image = image || videoEl.getAttribute('poster') || '';
        }

        // Link / ID extraction
        let postUrl = '';
        let fbPostId = '';
        for (const a of container.querySelectorAll('a[href]')) {
          const href = a.href || '';
          if (/\/(posts|videos|photos)\//.test(href) || /\/pfbid/.test(href)) {
            postUrl = href;
            const pfbidMatch = href.match(/pfbid([A-Za-z0-9]+)/);
            const postIdMatch = href.match(/\/posts\/(\d+)/);
            const videoIdMatch = href.match(/\/videos\/(\d+)/);
            fbPostId = pfbidMatch?.[0] || postIdMatch?.[1] || videoIdMatch?.[1] || '';
            break;
          }
        }

        // Timestamp
        let published = Date.now();
        const abbr = container.querySelector('abbr[data-utime]');
        if (abbr) {
          published = parseInt(abbr.dataset.utime) * 1000;
        } else {
          // Fallback: look for <a> elements that have time strings
          for (const a of container.querySelectorAll('a')) {
            const t = a.innerText?.trim() || '';
            const match = t.match(/[^0-9]?([0-9]+)(m|h|d)(?:\\s|·|$)/i) || t.match(/^([0-9]+)(m|h|d)/i);
            if (match) {
              const num = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              let offset = 0;
              if (unit === 'm') offset = num * 60 * 1000;
              if (unit === 'h') offset = num * 60 * 60 * 1000;
              if (unit === 'd') offset = num * 24 * 60 * 60 * 1000;
              published = Date.now() - offset;
              break;
            }
          }
        }

        // Stable ID
        const contentKey = text.slice(0, 100) + '|' + (image || '').slice(0, 50);
        const id = fbPostId || ('fb_' + simpleHash(contentKey));

        results.push({ id, text, image, published, hasVideo, postUrl });
      }

      return results;
    });

    console.log(`[Scraper] Found ${rawPosts.length} posts on page`);
    if (rawPosts.length > 0) {
      console.log('[Scraper] Sample:', rawPosts[0]?.text?.slice(0, 80) || '(no text)');
      console.log('[Scraper] Sample image:', rawPosts[0]?.image?.slice(0, 60) || '(none)');
    }

    if (rawPosts.length === 0) {
      console.warn('[Scraper] ⚠️  No posts found on page. Possible causes:');
      console.warn('  - Session cookies expired → run: node save-session.js');
      console.warn('  - Facebook changed their DOM structure');
      console.warn('  - The page has no public posts');
      return [];
    }

    if (rawPosts.length <= 2) {
      console.warn(`[Scraper] ⚠️  Only ${rawPosts.length} post(s) found — session may be expiring soon.`);
      console.warn('[Scraper]    Consider refreshing: node save-session.js');
    }

    // ── Merge with existing posts ───────────────────────────────────
    const existing    = loadPosts();
    const existingIds = new Set(existing.map(p => String(p.id)));
    
    // Deduplicate new posts against themselves and existing posts
    const newRaw = [];
    for (const p of rawPosts) {
      const pid = String(p.id);
      if (!existingIds.has(pid)) {
        existingIds.add(pid);
        newRaw.push(p);
      }
    }

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
