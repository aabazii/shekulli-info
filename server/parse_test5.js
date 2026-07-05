const fs = require('fs');
const html = fs.readFileSync('fb-test-auth.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

$('a[href*="/posts/"], a[href*="pfbid"]').each((i, el) => {
   const text = $(el).text();
   if (text) {
     console.log('Link text:', text);
   }
});
