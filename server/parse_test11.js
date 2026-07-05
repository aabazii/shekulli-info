const fs = require('fs');
const html = fs.readFileSync('fb-test-auth.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

const p1 = $('*:contains("Joseph i shqetësuar")').last();
const p2 = $('*:contains("Sot festojmë 250 vjet")').last();

console.log('Joseph parent tree:', p1.parents().map((i,el) => el.tagName).get().slice(0, 10).join(' > '));
console.log('Vance parent tree:', p2.parents().map((i,el) => el.tagName).get().slice(0, 10).join(' > '));
