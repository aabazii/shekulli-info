#!/usr/bin/env node
/**
 * Run this ONCE to log into Facebook and save your session cookies.
 * After that the main scraper uses the saved session automatically.
 *
 * Usage:  node save-session.js
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const SESSION_FILE = path.join(__dirname, 'fb-session.json');

(async () => {
  console.log('🔐 Opening Facebook login page...');
  console.log('   Log in normally, then come back here.\n');

  const browser = await puppeteer.launch({
    headless: false,          // visible browser so you can log in
    defaultViewport: null,    // full window
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

  console.log('👉 Log into Facebook in the browser window.');
  console.log('   Once your feed / home page loads, come back and press ENTER here.\n');

  // Wait for user to press Enter
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
    process.stdout.write('Press ENTER after you are logged in: ');
  });

  // Save cookies + localStorage
  const cookies = await page.cookies();
  const session = { cookies, savedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

  console.log(`\n✅ Session saved to: ${SESSION_FILE}`);
  console.log('   The scraper will now use this session automatically.\n');
  console.log('   Run this script again any time the session expires (~90 days).\n');

  await browser.close();
  process.exit(0);
})();
