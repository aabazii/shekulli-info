const fs = require('fs');
const html = fs.readFileSync('fb-test-auth.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

const blocks = $('div[data-ad-preview="message"], div[dir="auto"]');
blocks.each((i, el) => {
   let text = $(el).text();
   if (text.length > 15 && !text.includes('Comment as')) {
      let parent = $(el).parent();
      for(let j=0; j<8; j++) if(parent.parent().length) parent = parent.parent();
      const parentClass = parent.attr('class') || '';
      console.log('Text:', text.substring(0, 30), '... Parent class:', parentClass);
   }
});
