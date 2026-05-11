# Quick Start: Shekulli.info Bulk Import

## Step 1: Access Admin Panel (Once Deployed)
🔗 **https://shekulli-info.onrender.com/admin**  
🔐 **Password:** `shekulli2026`

## Step 2: Collect Your Posts

Choose ONE of these methods:

### Method A: Copy from IMPORT_EXAMPLE.json
1. Open `IMPORT_EXAMPLE.json` in the repo
2. Modify the posts with YOUR data
3. Keep the same JSON structure

### Method B: Manual Collection
1. Go to https://www.facebook.com/shekulliinfo
2. Scroll through your posts
3. For each post, note:
   - Post text (title)
   - Full content
   - Date posted
   - Any photos

### Method C: Browser Console Script
1. Go to https://www.facebook.com/shekulliinfo
2. Open DevTools: **F12**
3. Go to Console tab
4. Paste this script:

```javascript
const posts = [];
let id = 0;
document.querySelectorAll('[data-testid="post"]').forEach(post => {
  const text = post.innerText?.split('\n')[0]?.substring(0, 140) || 'Post';
  const body = post.innerText?.substring(0, 500) || text;
  const timeEl = post.querySelector('[role="button"]');
  const published = Date.now() - (id++ * 86400000); // Each post 1 day earlier
  
  posts.push({
    id: 'fb_post_' + id,
    text: text,
    body: body,
    category: 'Lajme',
    author: 'Shekulli.info',
    published: published
  });
});
console.log(JSON.stringify(posts, null, 2));
// Copy the output ⬆️
```

5. Copy the output (right-click → Copy)
6. Paste into admin panel

## Step 3: Format as JSON

Make sure your posts look like this:

```json
[
  {
    "id": "UNIQUE_ID_HERE",
    "text": "Post title",
    "body": "Full content...",
    "category": "Lajme",
    "author": "Shekulli.info",
    "published": 1620000000000
  }
]
```

**ID Format:** Use Facebook post ID if you have it, otherwise make unique IDs like `fb_post_1`, `fb_post_2`, etc.

**Published:** JavaScript timestamp in milliseconds
- Get current: `Date.now()`
- For past dates: `new Date('2024-05-01').getTime()`

## Step 4: Import in Admin Panel

1. Paste JSON into the textarea
2. Click **Importo** (Import)
3. Wait for success message ✅

## Step 5: Done! ✨

- All posts now on your site
- Scraper automatically gets NEW posts every 1 minute
- No duplicates (same Facebook ID = skipped)

---

## Categories Available

Use these in your JSON:

- `Politikë` - Politics
- `Kosovë` - Kosovo news
- `Botë` - World news
- `Ekonomi` - Economics
- `Sport` - Sports
- `Kulturë` - Culture
- `Opinion` - Opinion
- `Lajme` - General news (default)

---

## Need Help?

- JSON validation: https://jsonlint.com
- Timestamp converter: https://www.epochconverter.com
- Check /api/health for current article count
