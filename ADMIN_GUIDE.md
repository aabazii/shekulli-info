# Admin Panel & Bulk Import Guide

## Access Admin Panel

**URL:** `https://shekulli-info.onrender.com/admin`  
**Password:** `shekulli2026`

## How It Works

1. **Import historical posts** (one-time) → Fill your site with all past posts
2. **Automatic scraping** → System automatically gets new posts from Facebook every 1 minute
3. **No duplicates** → Same Facebook post ID = skipped (won't be added twice)

## Formatting Posts for Import

Each post needs these fields:

```json
[
  {
    "id": "12345678_abcd1234",        // Facebook post ID (unique!)
    "text": "Post text or title",      // What was posted
    "body": "Full content here...",    // Optional: longer content
    "category": "Politikë",            // One of: Politikë, Kosovë, Botë, Ekonomi, Sport, Kulturë, Opinion, Lajme
    "author": "Shekulli.info",         // Who posted it
    "published": 1620000000000,        // Timestamp in milliseconds (javascript Date.now() format)
    "photo": "https://..."              // Optional: photo URL
  }
]
```

### Categories Available
- Politikë
- Kosovë
- Botë
- Ekonomi
- Sport
- Kulturë
- Opinion
- Lajme (default)

## Getting Your Historical Posts

### Option 1: Manual Export (Easiest for small amounts)
1. Go to your Facebook page
2. Scroll through and manually copy post dates, text, links
3. Format as JSON and paste into admin panel

### Option 2: Facebook Data Download (Takes weeks)
1. Go to Settings → Your information → Download your information
2. Select "Posts" and download
3. Convert CSV to JSON format

### Option 3: Browser Console (Advanced)
1. Go to your Facebook page
2. Open DevTools (F12)
3. Paste this script to collect visible posts:
```javascript
// Run in browser console on Facebook page
const posts = [];
document.querySelectorAll('[data-testid="post"]').forEach(post => {
  const text = post.innerText.split('\n')[0];
  const time = post.querySelector('a[aria-label*="at"]')?.getAttribute('aria-label');
  posts.push({
    id: 'post_' + Math.random().toString(36).slice(2),
    text: text,
    published: new Date(time).getTime(),
    category: 'Lajme',
    author: 'Shekulli.info'
  });
});
console.log(JSON.stringify(posts, null, 2));
```
4. Copy the output → paste into admin panel

## After Import

✅ All historical posts will appear on your site
✅ The scraper automatically watches for NEW posts
✅ Every 1 minute, new posts from your Facebook page are added
✅ No manual work needed after setup!

## Troubleshooting

**"Wrong password"** → Use: `shekulli2026`  
**"JSON error"** → Paste into jsonlint.com to validate  
**"No new posts found"** → Check Apify token in server/.env  

---

When ready, go to https://shekulli-info.onrender.com/admin and import your posts!
