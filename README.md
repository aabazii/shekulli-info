# 🗞️ Shekulli.info

A news aggregation website for Shekulli (The Age), scraping posts from a Facebook page and displaying them on a modern web interface.

**Live at:** https://shekulli-info.onrender.com

---

## 📋 Quick Links

- **🌐 Website:** https://shekulli-info.onrender.com
- **⚙️ Admin Panel:** https://shekulli-info.onrender.com/admin (password: `shekulli2026`)
- **📖 How It Works:** Read `HOW_IT_WORKS.md`
- **🚀 Quick Start:** Read `QUICK_START.md`
- **📤 Import Example:** See `IMPORT_EXAMPLE.json`

---

## 🎯 Purpose

Automatically scrape posts from a Facebook page and display them on a modern news website with:
- Categories (Politikë, Kosovë, Botë, Ekonomi, Sport, Kulturë, Opinion)
- Article pages with related stories
- Category filtering
- Responsive design
- Automatic updates (every 1 minute)

---

## 🏗️ Architecture

### Two-Stage Scraping System

1. **Bulk Import (One-time)**
   - Manually collect all historical Facebook posts
   - Format as JSON
   - Upload via admin panel at `/admin`
   - System stores up to 500 most recent posts

2. **Automatic Scraping (Continuous)**
   - Apify scraper bot runs every 1 minute
   - Fetches new posts from Facebook page
   - Automatic deduplication by post ID
   - New posts appear instantly on website

### Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript (no framework)
- **Backend:** Node.js + Express
- **Scraping:** Apify API (Facebook Posts Scraper actor)
- **Hosting:** Render (free tier, 24/7 uptime)
- **Storage:** posts.json (JSON file, up to 500 posts)
- **Caching:** Client-side localStorage

### Key Files

```
.
├── admin.html              # Admin panel for bulk import
├── index.html              # Homepage
├── article.html            # Article detail page
├── category.html           # Category listing page
├── articles.js             # Frontend data layer
├── styles.css              # Main styles
├── colors_and_type.css     # Design tokens
├── ui.js                   # UI interactions
│
├── server/
│   ├── index.js            # Express API server
│   ├── scraper.js          # Apify integration
│   ├── posts.json          # Article database (auto-generated)
│   └── .env                # Secrets (APIFY_API_TOKEN)
│
├── HOW_IT_WORKS.md         # Detailed architecture docs
├── QUICK_START.md          # Getting started guide
├── ADMIN_GUIDE.md          # Admin panel usage
└── IMPORT_EXAMPLE.json     # Example post format
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Render account (free tier works)
- Apify account + API token (free tier works)
- Your Facebook page URL

### Local Development

```bash
# Clone repo
git clone https://github.com/aabazii/shekulli-info.git
cd shekulli-info

# Install dependencies
npm install --prefix server

# Set up environment variables
cp server/.env.example server/.env
# Edit server/.env and add your APIFY_API_TOKEN

# Start server
npm start --prefix server
# Open http://localhost:4000
```

### Deployment to Render

1. Push to GitHub
2. Connect repo to Render
3. Set environment variable: `APIFY_API_TOKEN`
4. Deploy automatically on push

---

## 📥 Importing Historical Posts

1. Go to **https://yourdomain.com/admin**
2. Log in with password: `shekulli2026`
3. Collect your posts (see `QUICK_START.md` for methods)
4. Format as JSON (see `IMPORT_EXAMPLE.json`)
5. Paste into admin panel
6. Click **Importo** (Import)
7. Done! Posts now on your site

---

## 🔄 How Automatic Scraping Works

Every minute:
1. Express cron job triggers
2. Apify Facebook Posts Scraper is called
3. Recent posts from your page are fetched
4. Posts are checked against database by ID
5. New posts are added, duplicates skipped
6. posts.json is updated
7. Frontend refreshes with new posts

**Result:** Your Facebook posts automatically appear on the website within 1 minute of posting!

---

## 🔐 Security

- **Admin panel** protected with password
- **Import endpoint** requires Bearer token auth
- **Environment variables** (Apify token) not in git
- **No database backend** - all data in JSON file
- **CORS enabled** for cross-origin requests

---

## 📊 Performance

- **Storage:** Max 500 most recent posts (older ones auto-deleted)
- **Scraping:** Every 1 minute (can be adjusted in `server/index.js`)
- **Response time:** <100ms average (static file + cached data)
- **Hosting:** Render free tier (sufficient for this project)
- **Deployment:** Auto-deploys on git push

---

## 🛠️ Development

### API Endpoints

**Public:**
- `GET /api/articles` - List all articles
- `GET /api/articles?category=Politikë` - Filter by category
- `GET /api/articles/:id` - Get single article
- `GET /api/health` - Check status

**Admin:**
- `POST /api/sync` - Manually trigger scraper
- `POST /api/admin/import` - Bulk import posts

### Customization

**Change scrape frequency:**
```javascript
// server/index.js, line 61
cron.schedule('*/5 * * * *', async () => { // Every 5 minutes instead of 1
```

**Change post limit:**
```javascript
// server/scraper.js, line 191
.slice(0, 1000); // Keep 1000 instead of 500
```

**Change categories:**
```javascript
// server/scraper.js, lines 37-44
// Edit guessCategory() function
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Admin panel not loading | Check browser console, verify /admin route |
| Posts not imported | Validate JSON at jsonlint.com |
| Scraper finding 0 posts | Check APIFY_API_TOKEN in .env |
| Duplicate posts | (shouldn't happen - check post IDs are unique) |
| Old posts disappearing | They're beyond 500-post limit (by design) |

---

## 📝 Contributing

Contributions welcome! Areas for improvement:
- Database backend (PostgreSQL instead of JSON)
- User accounts + permissions
- Comment system
- Search functionality
- RSS feed
- Mobile app

---

## 📄 License

Created for Shekulli.info news portal.

---

## 🤝 Maintainers

- **Ajani Bazi** - Creator & maintainer
- **Venis Beqiri** - Collaborator

---

## 📞 Support

For issues, questions, or suggestions:
1. Check the documentation files (HOW_IT_WORKS.md, QUICK_START.md)
2. Check GitHub issues
3. Review the code - it's well-commented

---

**Last Updated:** May 11, 2026
