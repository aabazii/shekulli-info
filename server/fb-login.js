/* Shekulli.info — One-time Facebook login helper
   Run this once: node fb-login.js
   A browser window will open → log into Facebook → close the browser.
   Your session is saved to server/fb-auth.json and used by the scraper automatically.
*/

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'fb-auth.json');

(async () => {
  console.log('\n🔐  Shekulli.info — Facebook Login Setup');
  console.log('=========================================');
  console.log('A browser window will open.');
  console.log('→ Log into your Facebook account normally.');
  console.log('→ Once you can see your Facebook feed, close the browser window.');
  console.log('Your session will be saved automatically.\n');

  const browser = await chromium.launch({
    headless: false, // visible window so you can log in
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' });

  console.log('⏳  Waiting for you to log in and close the browser…\n');

  // Wait until the browser closes or the user reaches the Facebook feed
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);

    // Also resolve if we detect a successful login (feed loaded)
    const interval = setInterval(async () => {
      try {
        const url = page.url();
        // If we're on facebook.com and NOT on the login page, we're logged in
        if (url.includes('facebook.com') && !url.includes('/login') && !url.includes('checkpoint')) {
          const loggedIn = await page.$('[aria-label="Facebook"]') !== null ||
                           await page.$('[data-pagelet="Stories"]') !== null ||
                           await page.$('[role="feed"]') !== null;
          if (loggedIn) {
            clearInterval(interval);
            console.log('✅  Logged in detected! Saving session…');

            // Save auth state (cookies + localStorage)
            await context.storageState({ path: AUTH_FILE });
            console.log(`✅  Session saved to: ${AUTH_FILE}`);
            console.log('\nYou can now close the browser and start the server:');
            console.log('   node index.js\n');

            setTimeout(async () => {
              await browser.close();
              resolve();
            }, 2000);
          }
        }
      } catch {}
    }, 2000);
  });

  // Final save in case the check above missed it
  try {
    if (context && !fs.existsSync(AUTH_FILE)) {
      await context.storageState({ path: AUTH_FILE });
      console.log(`✅  Session saved to: ${AUTH_FILE}`);
    }
  } catch {}

  console.log('\nDone! Run "node index.js" to start scraping.\n');
  process.exit(0);
})();
