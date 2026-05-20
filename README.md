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

---

## Environment Variables

All secrets are stored in the respective platform dashboards — never in the repository.

### Cloudflare Workers (set via `wrangler secret put` or the Cloudflare dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | Yes | Protects all admin API endpoints |
| `FB_PAGE_TOKEN` | Yes | Facebook Page Access Token |
| `FB_APP_ID` | No | Facebook App ID (enables long-lived token exchange) |
| `FB_APP_SECRET` | No | Facebook App Secret (enables long-lived token exchange) |
| `FOOTBALL_API_KEY` | No | football-data.org API key (enables fixtures widget) |

### Vercel (set in the Vercel dashboard → Settings → Environment Variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | Yes | Must match the Cloudflare value |
| `FB_PAGE_TOKEN` | Yes | Facebook Page Access Token |
| `FB_APP_ID` | No | Facebook App ID |
| `FB_APP_SECRET` | No | Facebook App Secret |
| `KV_REST_API_URL` | Yes | Vercel KV connection URL (auto-added by Vercel KV) |
| `KV_REST_API_TOKEN` | Yes | Vercel KV auth token (auto-added by Vercel KV) |
| `R2_ENDPOINT` | Yes | Cloudflare R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_BUCKET` | No | R2 bucket name (default: `shekulli`) |
| `FOOTBALL_API_KEY` | No | football-data.org API key |

### GitHub Actions Secrets (set in repo Settings → Secrets → Actions)

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Scoped to Workers deploy — required for CI auto-deploy |
| `ADMIN_PASSWORD` | Used by manual scrape workflow |
| `FB_PAGE_TOKEN` | Used by manual scrape workflow |
| `FB_SESSION` | Serialised browser session for Puppeteer scraper |

---

## Local Development

### Prerequisites

- Node.js 22+
- Wrangler CLI (`npm install -g wrangler`)
- A Cloudflare account with KV and R2 configured

### Setup

```bash
git clone https://github.com/aabazii/shekulli-info.git
cd shekulli-info
npm install
```

### Run the Cloudflare Worker locally

```bash
npm run dev
# Worker available at http://localhost:8787
```

Wrangler will use your local Cloudflare credentials and connect to the real KV and R2 bindings. For fully offline development, configure `wrangler.toml` to point at preview KV namespaces.

### Run the local Express server (no Cloudflare required)

```bash
cd server && npm install
ADMIN_PASSWORD=localpass node index.js
# Site available at http://localhost:4000
```

---

## Running Tests

```bash
# Unit tests (security, auth, validation)
npm test

# Live smoke tests against production
SITE_URL=https://shekulli.info npm run test:smoke

# Watch mode during development
npm run test:watch
```

The unit test suite covers:

| Suite | What it tests |
|-------|--------------|
| Authentication | Fail-closed auth, Bearer prefix enforcement, empty env var |
| CORS | Admin routes restricted to `shekulli.info`, public routes open |
| Upload validation | File type whitelist (JPEG/PNG/WebP/GIF), 10 MB ceiling |
| SSRF protection | URL scheme whitelist in the image mirror function |
| Credential hardening | No request can authenticate when `ADMIN_PASSWORD` is unset |

The smoke test suite covers:

| Suite | What it tests |
|-------|--------------|
| Health | `/api/health` returns `{ok: true}` |
| Posts loading | Articles endpoint returns a non-empty array with valid structure |
| Category filter | Filtered results only contain the requested category |
| Timestamps | All posts have timestamps within the last 30 days |
| Auth gates | Every admin endpoint rejects unauthenticated requests with 401 |
| CORS enforcement | Admin endpoints return `shekulli.info`, not `*` |
| Static pages | Homepage, article, and category pages return 200 |

---

## CI/CD Pipeline

Every push to `main` and every pull request runs through the following pipeline:

```
push / PR
  │
  └── test job
        ├── npm ci
        ├── npm test              ← 27 unit tests
        ├── wrangler deploy --dry-run  ← build check
        └── grep for hardcoded passwords in src/ and api/

push to main (after test passes)
  │
  └── deploy-worker job
        ├── npm ci
        ├── wrangler deploy       ← live deploy to Cloudflare Workers
        └── npm run test:smoke    ← 20 live checks against shekulli.info
              ├── posts loading
              ├── category filtering
              ├── auth gates on all admin endpoints
              ├── CORS headers
              └── static pages
```

If smoke tests fail after deploy, the workflow run is marked as failed, making the regression immediately visible.

Vercel deployment is automatic on every GitHub push via the Vercel GitHub integration.

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Returns `{ok: true, articles: N, ts: timestamp}` |
| `GET` | `/api/articles` | Returns array of posts. Query params: `category`, `limit` (default 100), `offset` (default 0) |
| `GET` | `/api/views` | Returns `{ids: [...]}` of most-viewed post IDs. Query param: `limit` (max 20) |
| `POST` | `/api/views` | Increment view count. Body: `{id: "post-id"}` |
| `GET` | `/api/fixtures` | Returns upcoming football fixtures (requires `FOOTBALL_API_KEY`) |

### Admin Endpoints

All admin endpoints require `Authorization: Bearer <ADMIN_PASSWORD>`.

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/api/admin/delete?id=<id>` | Delete a post and add to permanent blocklist |
| `PUT` | `/api/admin/edit` | Create or update a post. Body: `{article: {...}}` |
| `POST` | `/api/admin/upload?filename=<name>` | Upload an image to R2. Body: raw image bytes. Content-Type must be `image/jpeg`, `image/png`, `image/webp`, or `image/gif`. Max 10 MB. |
| `POST` | `/api/admin/import` | Bulk import posts. Body: `{posts: [...]}` |
| `POST` | `/api/admin/utils?action=<action>` | Maintenance actions: `fix-posts`, `fix-timestamps`, `clear`, `fix-images` |
| `POST` | `/api/scrape` | Trigger Facebook Graph API scrape |
| `POST` | `/api/scrape-sport` | Trigger RSS sport scrape |

---

## Security

- All admin endpoints require a `Bearer` token matching `ADMIN_PASSWORD`. The server returns 500 if the variable is unset — there is no fallback.
- CORS is restricted to `https://shekulli.info` on all admin and scrape routes. Public read endpoints use `*`.
- File uploads enforce a content-type whitelist (JPEG, PNG, WebP, GIF) and a 10 MB size limit.
- Error responses never expose internal error messages or stack traces.
- The image mirror function validates that source URLs use `http://` or `https://` before fetching.
- Facebook session cookies (`server/fb-auth.json`, `server/fb-session.json`) are gitignored and never committed.

---

## Maintainers

- **Ajani Bazi** — Creator & maintainer
- **Venis Beqiri** — Collaborator
