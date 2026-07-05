const html = require('fs').readFileSync('fb-test-auth.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log('Posts with [role="article"]:', $('[role="article"]').length);
console.log('Posts with div[data-ad-preview]:', $('div[data-ad-preview="message"]').length);
console.log('Posts with div[dir="auto"] containing text:', $('div[dir="auto"]').filter((i, el) => $(el).text().length > 50).length);

const texts = [];
$('div[dir="auto"]').each((i, el) => {
  const t = $(el).text();
  if (t.length > 100 && !t.includes('See more')) texts.push(t.substring(0, 50));
});
console.log('Sample text nodes:', texts.slice(0, 3));
