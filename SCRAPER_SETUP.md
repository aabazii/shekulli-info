# 🤖 Automatic Facebook Post Scraper

This script automatically collects **ALL your posts** from your Facebook page and saves them as JSON, ready to import into Shekulli.info.

## ⚙️ Setup (First Time Only)

### 1. Install Puppeteer
Puppeteer is a headless browser library that automates Facebook scraping.

```bash
cd /path/to/Shekulli
npm install puppeteer
```

This downloads a browser engine (~150MB). It's safe and only used for scraping.

### 2. Login to Facebook
The script needs to access your Facebook page while logged in:

**Option A: Auto-login (easiest)**
- Script will open a browser window
- You'll see Facebook loading
- The script will automatically scroll through your page
- Puppeteer handles everything behind the scenes

**Option B: Pre-login**
- If you have issues, log into Facebook in your normal browser first
- The script will use your existing session

## 🚀 Running the Scraper

From the Shekulli directory:

```bash
node scrape-facebook-posts.js
```

**Expected output:**
```
🚀 Starting Facebook post scraper...

📖 Opening Facebook page: https://www.facebook.com/shekulliinfo
✅ Page loaded
📜 Scrolling to load all posts...

  Scroll 1/100 | Posts found: 5
  Scroll 2/100 | Posts found: 12
  Scroll 3/100 | Posts found: 18
  ...
  Scroll 45/100 | Posts found: 127

✅ Reached end of page (no new posts loading)

🔍 Extracting post data...

✅ Extracted 127 posts

📁 Saved to: /path/to/Shekulli/scraped_posts.json

📋 Next steps:
   1. Open scraped_posts.json and review
   2. (Optional) Edit categories
   3. Copy the JSON
   4. Go to admin panel at /admin
   5. Paste and click "Importo"
```

## 📝 What Gets Collected

For each post, the script captures:
- **id** - Unique identifier (fb_post_1, fb_post_2, etc)
- **text** - Post title (first 140 characters)
- **body** - Full post content (first 1000 characters)
- **category** - Auto-set to "Lajme" (you can change)
- **author** - Auto-set to "Shekulli.info"
- **published** - Post date/time (or current time if not found)
- **photo** - First image in post (if any)

## ✏️ After Scraping: Customize Categories

The script sets all posts to `"category": "Lajme"`. You can change this:

1. Open `scraped_posts.json`
2. Find posts you want to recategorize
3. Change `"category": "Lajme"` to:
   - `"Politikë"` - Politics
   - `"Kosovë"` - Kosovo
   - `"Botë"` - World news
   - `"Ekonomi"` - Economics
   - `"Sport"` - Sports
   - `"Kulturë"` - Culture
   - `"Opinion"` - Opinion

**Example:**
```json
{
  "id": "fb_post_5",
  "text": "Prishtina: Aktivitete sportive...",
  "body": "Qyteti i Prishtinës lansoi...",
  "category": "Sport",     ← Changed from "Lajme"
  "author": "Shekulli.info",
  "published": 1715000000000
}
```

## 🚨 Troubleshooting

### Script hangs or takes very long
- Facebook might be slow
- Your connection might be slow
- Try again - it can take 5-30 minutes depending on post count

### No posts found
Make sure:
1. You have internet connection
2. Your Facebook page is public (or you're logged in)
3. The page URL is correct: https://www.facebook.com/shekulliinfo

### "Puppeteer not found" error
Run: `npm install puppeteer`

### Script fails with "Cannot find Chrome/Chromium"
Puppeteer couldn't download the browser. Try:
```bash
npm install puppeteer --force
```

### JSON looks weird/incomplete
Edit it manually:
1. Open `scraped_posts.json`
2. Use online validator: https://jsonlint.com
3. Fix any errors
4. Save and import

## 🔄 Running Again

The script overwrites `scraped_posts.json` each time. To keep previous results:

```bash
# Before running again:
mv scraped_posts.json scraped_posts_backup.json

# Then run again:
node scrape-facebook-posts.js
```

## 📋 Import to Shekulli

Once you have `scraped_posts.json`:

1. Open the file and copy all content (Cmd+A, Cmd+C)
2. Go to: https://shekulli-info.onrender.com/admin
3. Login: password is `shekulli2026`
4. Paste JSON in the textarea
5. Click **Importo**
6. Done! Posts now on your site ✨

## 🎯 What Happens After Import

- All your posts appear on the website
- The automatic scraper starts running (every 1 minute)
- New posts from Facebook appear on your site instantly
- No more manual work needed!

---

**Questions?**
- Check `HOW_IT_WORKS.md` for system architecture
- Check `QUICK_START.md` for manual alternatives
- Review the script code - it's well-commented
