#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugFacebook() {
  let browser;
  
  try {
    console.log('🔍 Opening Facebook page for debugging...\n');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const FB_PAGE = 'https://www.facebook.com/shekulliinfo';
    await page.goto(FB_PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('✅ Page loaded\n');

    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'facebook-debug.png' });
    console.log('✅ Screenshot saved to: facebook-debug.png\n');

    // Get page title
    const title = await page.title();
    console.log('📄 Page title:', title);

    // Try multiple selectors to find posts
    const selectors = [
      '[data-testid="post"]',
      '[role="article"]',
      'div[data-pagelet="Feed"]',
      'div[class*="story"]',
      'div[class*="post"]'
    ];

    console.log('\n🔎 Searching for posts with different selectors:\n');

    for (const selector of selectors) {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      console.log(`  ${selector}: ${count} elements found`);
    }

    // Get page HTML snippet
    console.log('\n📝 Checking page content...');
    const htmlSnippet = await page.evaluate(() => {
      return {
        bodyHTML: document.body.innerHTML.substring(0, 2000),
        allText: document.body.innerText.substring(0, 500)
      };
    });

    fs.writeFileSync('facebook-debug.html', htmlSnippet.bodyHTML);
    console.log('✅ HTML snippet saved to: facebook-debug.html');

    console.log('\n📌 First 300 chars of page text:');
    console.log(htmlSnippet.allText);

    // Check if page seems to have loaded properly
    console.log('\n🔍 Page analysis:');
    const analysis = await page.evaluate(() => {
      return {
        URL: window.location.href,
        hasContent: document.body.innerText.length > 100,
        elementsCount: document.querySelectorAll('*').length,
        linksCount: document.querySelectorAll('a').length,
        divCount: document.querySelectorAll('div').length
      };
    });

    Object.entries(analysis).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n💡 Next steps:');
    console.log('  1. Open facebook-debug.png to see what loaded');
    console.log('  2. Check facebook-debug.html to see the structure');
    console.log('  3. Share the output above so we can fix the selectors');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

debugFacebook();
