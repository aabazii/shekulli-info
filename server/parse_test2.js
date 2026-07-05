const html = require('fs').readFileSync('fb-test-auth.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

$('[role="article"]').each((i, el) => {
  console.log(`--- POST ${i} ---`);
  console.log('Text parts:', $(el).find('div[dir="auto"]').map((_, e) => $(e).text()).get().filter(t => t.length > 10));
  console.log('Images:', $(el).find('img').map((_, e) => $(e).attr('src')).get().filter(src => src && src.includes('http')));
  console.log('Post ID from URL:', $(el).find('a[href*="/posts/"], a[href*="/videos/"], a[href*="pfbid"]').map((_, e) => $(e).attr('href')).get());
});
