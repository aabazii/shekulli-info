# How Shekulli.info Scraping Works

## Architecture Overview

```
Your Facebook Page (@shekulliinfo)
        ↓
    [Two-Stage Process]
        ↓
    ┌─────────────────────────────────┐
    │ STAGE 1: Historical Bulk Import  │ (One time, manual)
    │ - You collect all your old posts │
    │ - Format as JSON                 │
    │ - Upload via admin panel         │
    └─────────────────────────────────┘
        ↓
    ┌─────────────────────────────────┐
    │ STAGE 2: Automatic Incremental   │ (Runs forever, 24/7)
    │ - Apify scraper runs every 1 min │
    │ - Fetches new posts from Facebook│
    │ - Deduplicates by Facebook ID    │
    │ - Adds only truly new posts      │
    └─────────────────────────────────┘
        ↓
   posts.json (database)
        ↓
   Your Website
```

## Why Two Stages?

### ❌ Why Apify Alone Wasn't Enough
- **Limited history:** Apify can only scrape recent posts (usually last 2 weeks)
- **Not all posts:** Facebook only shows public/chronological posts
- **Rate limits:** Free tier has constraints
- **Result:** Only got ~3 posts instead of all your historical content

### ✅ Why This Hybrid Approach Works
1. **Bulk import = complete historical data** (everything you want)
2. **Automatic scraper = incremental updates** (new posts every minute)
3. **Deduplication = no manual management** (no duplicate handling needed)
4. **Zero downtime = always running** (no gaps in new posts)

## How Posts Are Matched (Deduplication)

When the scraper runs:

```
Apify returns: [
  { id: "123_abc", text: "New post" },
  { id: "456_def", text: "Post from 5 days ago" }
]

Database has: [
  { id: "456_def", ... },  ← Already have this
  { id: "789_ghi", ... }
]

Result: Only "123_abc" is added (456_def skipped as duplicate)
```

**The key:** Facebook post IDs are unique and permanent. Once a post is in your database, it won't be added again.

## Post Structure

Every post in the system has:

```javascript
{
  id: "123456_abc123",           // Unique identifier (Facebook post ID or custom)
  text: "Post title",             // Main headline
  body: "Full content...",        // Article body
  title: "Post title",            // Same as text (for compatibility)
  standfirst: "First 300 chars",  // Summary
  category: "Politikë",           // Categorization
  kicker: "POLITIKË",             // Uppercase category
  author: "Shekulli.info",        // Byline
  photo: "https://...",           // Optional image URL
  published: 1620000000000,       // Timestamp (milliseconds since epoch)
  fb_post_id: "123456_abc123"     // Same as id (for tracking)
}
```

## Data Flow: Import Example

```
You paste this JSON:
[{
  "id": "fb_post_1",
  "text": "My first post",
  "body": "Full content",
  "category": "Politikë",
  "author": "Shekulli.info",
  "published": 1620000000000
}]

↓ POST /api/admin/import endpoint validates & processes

↓ Checks against existing posts.json for duplicates

↓ If new, merges with existing posts

↓ Saves to posts.json (keeps last 500 posts)

↓ Frontend /api/articles endpoint now serves the posts

↓ Website displays them (sorted by date, newest first)
```

## Data Flow: Automatic Scraping

```
Every 1 minute (24/7):

1. Scraper calls Apify API
2. "Get posts from @shekulliinfo Facebook page"
3. Apify returns recent posts
4. Scraper checks: Does this post ID already exist?
5. NO → Add to database, save to posts.json
6. YES → Skip (already have it)
7. Website automatically reloads if new posts found

This runs forever. Zero manual work.
```

## Files & Their Roles

| File | Purpose |
|------|---------|
| `admin.html` | Password-protected interface for bulk import |
| `server/index.js` | Express API server, routes, auth |
| `server/scraper.js` | Apify Facebook scraper bot |
| `posts.json` | Article database (max 500 latest posts) |
| `articles.js` | Frontend data layer, localStorage cache |
| `index.html` | Homepage (displays lead story + sections) |
| `category.html` | Category page (filter by Politikë, Sport, etc) |
| `article.html` | Single article page |

## APIs Available

### Public (no auth needed)
- `GET /api/articles` - Get all articles (supports ?category=Politikë, ?limit=10, ?offset=0)
- `GET /api/articles/:id` - Get single article
- `GET /api/health` - Check status (article count, last sync time)

### Admin-only (needs password in Authorization header)
- `POST /api/sync` - Manually trigger scraper
- `POST /api/admin/import` - Bulk import posts (with Bearer token auth)

## Performance & Limits

- **Max posts stored:** 500 (newest kept, oldest trimmed)
- **Scrape frequency:** Every 1 minute
- **Import size:** No hard limit (but ~100 posts is reasonable)
- **Storage:** All in posts.json (no database backend)
- **Caching:** Client-side localStorage for performance

## Security

- Admin panel protected with password (`shekulli2026`)
- Import endpoint requires Bearer token authentication
- CORS enabled (can be accessed from any frontend)
- No database credentials exposed in code
- All sensitive data in `.env` (not in git)

## What Happens If Something Goes Wrong?

| Problem | Solution |
|---------|----------|
| Posts not appearing after import? | Check `/api/health` for count |
| Scraper not fetching new posts? | Check `APIFY_API_TOKEN` in `.env` |
| Duplicate posts showing? | Shouldn't happen (deduplication by ID) |
| Old posts still showing? | Check if they're older than 500-post limit |
| Admin panel not loading? | Check password is `shekulli2026` |

---

## Next Steps

1. ✅ Get all your historical posts ready (as JSON)
2. ✅ Go to `/admin` and import them
3. ✅ Watch your site populate with posts
4. ✅ The scraper runs automatically from that point
5. ✅ New posts appear automatically (no manual work)

The system is designed to be **set it and forget it** after the initial bulk import! 🚀
