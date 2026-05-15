#!/usr/bin/env node
/**
 * Run this ONCE locally after getting a token from Graph API Explorer.
 * It exchanges the short-lived token for a never-expiring Page Access Token
 * and automatically sets it in Vercel env + prints it for GitHub secrets.
 *
 * Usage:
 *   FB_APP_ID=xxx FB_APP_SECRET=yyy node server/generate-token.js <short-lived-token>
 */

const { execSync } = require('child_process');

const GRAPH_VER    = 'v21.0';
const FB_APP_ID    = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const shortToken   = process.argv[2];

if (!shortToken) {
  console.error('Usage: node server/generate-token.js <short-lived-user-token>');
  console.error('Get the token from: https://developers.facebook.com/tools/explorer');
  process.exit(1);
}
if (!FB_APP_ID || !FB_APP_SECRET) {
  console.error('Set FB_APP_ID and FB_APP_SECRET as environment variables.');
  process.exit(1);
}

(async () => {
  console.log('Step 1: Exchanging for long-lived user token...');
  const ltRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VER}/oauth/access_token` +
    `?grant_type=fb_exchange_token&client_id=${FB_APP_ID}` +
    `&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortToken}`
  );
  const ltData = await ltRes.json();
  if (!ltData.access_token) {
    console.error('Failed:', JSON.stringify(ltData));
    process.exit(1);
  }
  const longToken = ltData.access_token;
  console.log('✅ Got long-lived user token');

  console.log('Step 2: Getting permanent page token...');
  const acctRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VER}/me/accounts?access_token=${longToken}`
  );
  const acctData = await acctRes.json();
  if (!acctData.data || acctData.data.length === 0) {
    console.error('No pages found:', JSON.stringify(acctData));
    process.exit(1);
  }

  let page = acctData.data.find(p => /shekulli/i.test(p.name) || /shekulli/i.test(p.id));
  if (!page) page = acctData.data[0];

  const permanentToken = page.access_token;
  console.log(`✅ Got permanent page token for: ${page.name}`);

  // Auto-update Vercel env var
  console.log('\nStep 3: Updating Vercel environment variable...');
  try {
    execSync(
      `echo "${permanentToken}" | vercel env add FB_PAGE_TOKEN production --force`,
      { stdio: 'pipe' }
    );
    console.log('✅ Vercel FB_PAGE_TOKEN updated for production');
  } catch (e) {
    console.warn('⚠️  Could not auto-update Vercel env. Update it manually.');
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('PERMANENT PAGE TOKEN (never expires):');
  console.log(permanentToken);
  console.log('══════════════════════════════════════════════════════');
  console.log('\n→ Also update GitHub secret FB_PAGE_TOKEN with the token above.');
  console.log('  You will NOT need to do this again unless you change your Facebook password.');
})();
