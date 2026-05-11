#!/usr/bin/env node

/**
 * Facebook Posts Scraper
 * 
 * This script automatically scrapes ALL posts from your Facebook page
 * and saves them as JSON ready for import into Shekulli.info
 * 
 * Usage:
 *   node scrape-facebook-posts.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FB_PAGE = 'https://www.facebook.com/shekulliinfo';
const OUTPUT_FILE = path.join(__dirname, 'scraped_posts.json');
const SCROLL_DELAY = 2000; // 2 seconds between scrolls
const MAX_SCROLLS = 100; // Max number of scroll attempts

async function scrapeFacebookPosts() {
  let browser;
  
  try {
    console.log('🚀 Starting Facebook post scraper...\n');
    
    // Launch browser with stealth mode
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    console.log('📖 Opening Facebook page: ' + FB_PAGE);
    const page = await browser.newPage();
    
    // Set user agent to look like real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );
    
    // Block unnecessary resources to speed up loading
    await page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate to page
    await page.goto(FB_PAGE, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    console.log('✅ Page loaded');
    console.log('📜 Scrolling to load all posts...\n');

    // Auto-scroll to load more posts
    let previousHeight = 0;
    let scrolls = 0;
    let noNewPostsCount = 0;

    while (scrolls < MAX_SCROLLS) {
      // Get current post count
      const postCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="post"]').length;
      });

      process.stdout.write(`\r  Scroll ${scrolls + 1}/${MAX_SCROLLS} | Posts found: ${postCount}`);

      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });

      // Wait for potential new content to load
      await page.waitForTimeout(SCROLL_DELAY);

      // Check if new content loaded
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (newHeight === previousHeight) {
        noNewPostsCount++;
        if (noNewPostsCount > 3) {
          console.log('\n✅ Reached end of page (no new posts loading)\n');
          break;
        }
      } else {
        noNewPostsCount = 0;
      }

      previousHeight = newHeight;
      scrolls++;
    }

    // Extract all posts
    console.log('🔍 Extracting post data...\n');
    
    const posts = await page.evaluate(() => {
      const postElements = document.querySelectorAll('[data-testid="post"]');
      const posts = [];
      let id = 1;

      postElements.forEach((element) => {
        try {
          // Get post text/content
          const textEl = element.querySelector('[data-testid="post_message"]');
          let text = textEl?.innerText?.trim() || '';
          
          // Fallback: try to get any text content
          if (!text) {
            const allText = element.innerText?.split('\n') || [];
            text = allText.find(t => t && t.length > 10) || 'Post without text';
          }

          // Limit title to 140 chars
          const title = text.substring(0, 140);
          const body = text.substring(0, 1000);

          // Try to get post date/time
          let published = Date.now();
          const timeEl = element.querySelector('a[aria-label*="at"], span[aria-label*="at"]');
          
          if (timeEl) {
            const label = timeEl.getAttribute('aria-label') || '';
            try {
              const parsedDate = new Date(label);
              if (!isNaN(parsedDate.getTime())) {
                published = parsedDate.getTime();
              }
            } catch (e) {
              // Keep current time
            }
          }

          // Try to get image
          let photo = '';
          const imgEl = element.querySelector('img[src*="facebook"]');
          if (imgEl && imgEl.src && !imgEl.src.includes('emoji')) {
            photo = imgEl.src;
          }

          posts.push({
            id: 'fb_post_' + id,
            text: title,
            body: body,
            category: 'Lajme', // Default, user can change
            author: 'Shekulli.info',
            published: published,
            photo: photo
          });

          id++;
        } catch (e) {
          console.error('Error parsing post:', e.message);
        }
      });

      return posts;
    });

    console.log(`✅ Extracted ${posts.length} posts\n`);

    if (posts.length === 0) {
      console.log('⚠️  No posts found. Make sure you:');
      console.log('   1. Are logged into Facebook');
      console.log('   2. Have access to the page');
      console.log('   3. The page has public posts\n');
      return;
    }

    // Save to file
    const json = JSON.stringify(posts, null, 2);
    fs.writeFileSync(OUTPUT_FILE, json);

    console.log(`📁 Saved to: ${OUTPUT_FILE}\n`);
    console.log('📋 Next steps:');
    console.log('   1. Open scraped_posts.json and review the posts');
    console.log('   2. (Optional) Edit categories - change "Lajme" to appropriate category');
    console.log('   3. Copy the JSON content');
    console.log('   4. Go to: https://shekulli-info.onrender.com/admin');
    console.log('   5. Login with password: shekulli2026');
    console.log('   6. Paste JSON and click "Importo"\n');
    console.log('✨ All done! Your posts will appear on the site.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the scraper
scrapeFacebookPosts();
