# Shekulli.info

Albanian-language news platform that aggregates posts from the Shekulli Facebook page and RSS feeds, displaying them as a categorised news website.

**Production:** https://shekulli.info

---

## Architecture

The project runs across two platforms simultaneously. Cloudflare Workers handles the primary deployment; Vercel provides a fallback and hosts the scheduled scrape cron job.

```
GitHub ──► GitHub Actions CI/CD
              │
              ├── npm test          (27 security unit tests)
              ├── wrangler dry-run  (build check)
              │
              ├── wrangler deploy ──► Cloudflare Workers  (primary API + static assets)
              │                           │
              │                           ├── Cloudflare KV   (posts, deleted IDs, FB tokens)
              │                           └── Cloudflare R2   (mirrored images)
              │
              ├── smoke tests ──────► https://shekulli.info  (20 live functional checks)
              │
              └── git push ─────────► Vercel  (auto-deploy, hosts cron job)
```

### Content Sources

| Source | Handler | Schedule |
|--------|---------|----------|
| Facebook Graph API (Shekulli page) | `src/handlers/scrape.js` | Manual / Vercel cron (daily) |
| RSS — Gazeta Express Sport | `src/handlers/scrape-sport.js` | Manual trigger |

All images are mirrored from Facebook CDN to Cloudflare R2 so they remain available indefinitely.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (primary), Vercel Serverless (secondary) |
| Storage | Cloudflare KV (articles, metadata), Cloudflare R2 (images) |
| Frontend | HTML, CSS, Vanilla JavaScript — no framework |
| CI/CD | GitHub Actions |
| Tests | Vitest — 27 unit tests + 20 live smoke tests |

---

## Repository Structure

```
.
├── src/                        # Cloudflare Worker source
│   ├── worker.js               # Entry point, routing, per-route CORS
│   ├── handlers/
│   │   ├── admin/
│   │   │   ├── delete.js       # DELETE /api/admin/delete
│   │   │   ├── edit.js         # PUT /api/admin/edit
│   │   │   ├── import.js       # POST /api/admin/import
│   │   │   ├── upload.js       # POST /api/admin/upload (image upload → R2)
│   │   │   └── utils.js        # POST /api/admin/utils (maintenance actions)
│   │   ├── articles.js         # GET /api/articles
│   │   ├── fixtures.js         # GET /api/fixtures (football scores)
│   │   ├── health.js           # GET /api/health
│   │   ├── scrape.js           # POST /api/scrape (Facebook Graph API)
│   │   ├── scrape-sport.js     # POST /api/scrape-sport (RSS)
│   │   └── views.js            # GET|POST /api/views
│   └── lib/
│       ├── category.js         # Albanian keyword → category classifier
│       ├── kv.js               # Cloudflare KV helpers
│       ├── r2.js               # Image mirror to R2
│       └── response.js         # json(), adminJson(), cors(), isAuthed()
│
├── api/                        # Vercel Serverless Functions (mirrors src/)
│   ├── admin/                  # Admin endpoints (Vercel)
│   ├── articles.js
│   ├── fixtures.js
│   ├── health.js
│   ├── scrape.js               # Also triggered by Vercel cron (vercel.json)
│   ├── scrape-sport.js
│   └── views.js
│
├── tests/
│   ├── security.test.mjs       # Unit tests: auth, CORS, upload, SSRF
│   └── smoke.test.mjs          # Live functional tests against production
│
├── server/                     # Local-only development tools (not deployed)
│   ├── index.js                # Express server for local preview
│   ├── scraper.js              # Puppeteer-based Facebook scraper
│   ├── deep-scrape.js          # Historical backfill scraper
│   └── run-scraper.js          # Graph API scraper runner
│
├── .github/workflows/
│   ├── ci.yml                  # CI/CD: test → build → deploy → smoke test
│   ├── scrape.yml              # Manual scrape trigger
│   └── deep-scrape.yml         # Manual historical backfill
│
├── admin.html                  # Admin panel (auth required)
├── index.html                  # Homepage
├── article.html                # Article detail page
├── category.html               # Category listing
├── wrangler.toml               # Cloudflare Worker configuration
├── vercel.json                 # Vercel configuration + cron schedule
└── vitest.config.mjs           # Test configuration
```


