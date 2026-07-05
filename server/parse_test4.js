const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  const cookies = JSON.parse(fs.readFileSync('fb-session.json', 'utf8')).cookies;
  await page.setCookie(...cookies);
  await page.goto('https://www.facebook.com/shekulliinfo', { waitUntil: 'networkidle2' });
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
  await new Promise(r => setTimeout(r, 2000));
  
  const rawPosts = await page.evaluate(() => {
    const articles = document.querySelectorAll('[role="article"]');
    return Array.from(articles).map(el => el.innerText);
  });
  
  console.log('Found', rawPosts.length, 'articles');
  rawPosts.forEach((text, i) => {
     console.log('--- ARTICLE', i, '---');
     console.log(text.substring(0, 200).replace(/\n/g, ' | '));
  });
  await browser.close();
})();
