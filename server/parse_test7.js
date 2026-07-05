const fs = require('fs');
const html = fs.readFileSync('fb-headless-debug.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log('Posts matching Joseph:', $('*:contains("Joseph i shqetësuar")').length);
console.log('Posts matching Vendndodhja:', $('*:contains("Vendndodhja e Udhëheqësit")').length);
console.log('Posts matching Vance:', $('*:contains("Sot festojmë 250 vjet")').length);

const blocks = $('div[data-ad-preview="message"], div[dir="auto"]');
let count = 0;
blocks.each((i, el) => {
   let text = $(el).text();
   if (text.length > 30 && !text.includes('Comment as')) {
      console.log('Block', count++, ':', text.substring(0, 60).replace(/\n/g, ' '));
   }
});
