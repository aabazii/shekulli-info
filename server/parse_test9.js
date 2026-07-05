const fs = require('fs');
const html = fs.readFileSync('fb-mobile-debug.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log('Posts matching Joseph:', $('*:contains("Joseph i shqetësuar")').length);
console.log('Posts matching Vendndodhja:', $('*:contains("Vendndodhja e Udhëheqësit")').length);
console.log('Posts matching Vance:', $('*:contains("Sot festojmë 250 vjet")').length);

$('article, .story_body_container, [data-ft]').each((i, el) => {
   let text = $(el).text();
   if (text.length > 20) {
      console.log('Item:', text.substring(0, 80).replace(/\n/g, ' '));
   }
});
