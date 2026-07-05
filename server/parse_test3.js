const html = require('fs').readFileSync('fb-test-auth.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

const messages = $('div[data-ad-preview="message"], div[dir="auto"] > span');
messages.each((i, el) => {
  const text = $(el).text();
  if (text.length > 50 && !text.includes('See more')) {
    console.log('--- FOUND TEXT ---');
    console.log(text.substring(0, 80));
    let parent = $(el).parent();
    for(let j=0; j<8; j++) {
       console.log('Parent', j, ':', parent.prop('tagName'), 'classes:', parent.attr('class'), 'role:', parent.attr('role'));
       parent = parent.parent();
    }
  }
});
