const fs = require('fs');
const html = fs.readFileSync('fb-mobile-debug.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

const joseph = $('*:contains("Joseph i shqetësuar")').last();
console.log('Joseph parent depth 5 class:', joseph.parent().parent().parent().parent().parent().attr('class'));
console.log('Joseph HTML:', joseph.parent().parent().html().substring(0, 500));
