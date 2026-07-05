const fs = require('fs');
const html = fs.readFileSync('fb-headless-debug.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log('Title:', $('title').text());
console.log('Login forms:', $('form[action*="login"]').length);
console.log('Body length:', $('body').text().length);
console.log('H1s:', $('h1').map((i,el) => $(el).text()).get().join(' | '));
console.log('Links text sample:', $('a').slice(0, 10).map((i,el) => $(el).text()).get().join(' | '));
