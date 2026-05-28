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


