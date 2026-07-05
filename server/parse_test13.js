const fs = require('fs');
const html = fs.readFileSync('fb-headless-debug.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);
$('[role="article"]').each((i, el) => {
   console.log('Article', i, ':', $(el).text().substring(0, 100).replace(/\n/g, ' '));
});
