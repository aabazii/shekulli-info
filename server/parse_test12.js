const fs = require('fs');
const html = fs.readFileSync('fb-headless-debug.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);
console.log('aria-posinset:', $('[aria-posinset]').length);
console.log('role=article:', $('[role="article"]').length);
