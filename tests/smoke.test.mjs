/**
 * Smoke tests — hit the live production API to verify core functionality.
 *
 * Run locally:  SITE_URL=https://shekulli.info npm run test:smoke
 * Run in CI:    set SITE_URL in the workflow, then npm run test:smoke
 *
 * These tests are intentionally read-only. They never write data.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.SITE_URL?.replace(/\/$/, '') || 'https://shekulli.info';

// Give the freshly-deployed worker time to warm up
beforeAll(() => new Promise(r => setTimeout(r, 2000)));

// ── Health ────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with ok:true', async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── Articles (posts loading) ──────────────────────────────────────────────────

describe('GET /api/articles', () => {
  let articles;

  it('returns 200', async () => {
    const res = await fetch(`${BASE}/api/articles?limit=10`);
    expect(res.status).toBe(200);
    articles = await res.json();
  });

  it('returns an array', () => {
    expect(Array.isArray(articles)).toBe(true);
  });

  it('has at least one post', () => {
    expect(articles.length).toBeGreaterThan(0);
  });

  it('each post has required fields', () => {
    const required = ['id', 'title', 'category', 'published'];
    for (const post of articles.slice(0, 3)) {
      for (const field of required) {
        expect(post).toHaveProperty(field);
      }
    }
  });

  it('posts have non-empty titles', () => {
    for (const post of articles.slice(0, 3)) {
      expect(typeof post.title).toBe('string');
      expect(post.title.length).toBeGreaterThan(0);
    }
  });

  it('posts have valid timestamps', () => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    for (const post of articles.slice(0, 3)) {
      expect(post.published).toBeGreaterThan(thirtyDaysAgo);
      expect(post.published).toBeLessThanOrEqual(now + 60000); // allow 1 min clock skew
    }
  });

  it('category filter works', async () => {
    const res = await fetch(`${BASE}/api/articles?category=Sport&limit=5`);
    expect(res.status).toBe(200);
    const sport = await res.json();
    expect(Array.isArray(sport)).toBe(true);
    for (const post of sport) {
      expect(post.category).toBe('Sport');
    }
  });

  it('limit parameter is respected', async () => {
    const res = await fetch(`${BASE}/api/articles?limit=3`);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(3);
  });

  it('CORS header is present', async () => {
    const res = await fetch(`${BASE}/api/articles?limit=1`);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

// ── Views ─────────────────────────────────────────────────────────────────────

describe('GET /api/views', () => {
  it('returns 200 with ids array', async () => {
    const res = await fetch(`${BASE}/api/views?limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.ids)).toBe(true);
  });
});

// ── Admin endpoints must reject unauthenticated requests ──────────────────────

describe('Admin endpoints — auth gate', () => {
  it('DELETE /api/admin/delete requires auth', async () => {
    const res = await fetch(`${BASE}/api/admin/delete?id=fake`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/edit requires auth', async () => {
    const res = await fetch(`${BASE}/api/admin/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article: { id: 'fake' } }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/upload requires auth', async () => {
    const res = await fetch(`${BASE}/api/admin/upload`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/import requires auth', async () => {
    const res = await fetch(`${BASE}/api/admin/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/scrape requires auth', async () => {
    const res = await fetch(`${BASE}/api/scrape`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('admin endpoints restrict CORS to shekulli.info', async () => {
    const res = await fetch(`${BASE}/api/admin/delete?id=fake`, { method: 'DELETE' });
    const origin = res.headers.get('Access-Control-Allow-Origin');
    expect(origin).not.toBe('*');
    expect(origin).toBe('https://shekulli.info');
  });
});

// ── Static pages load ─────────────────────────────────────────────────────────

describe('Static pages', () => {
  it('homepage returns 200', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(200);
  });

  it('article page returns 200', async () => {
    const res = await fetch(`${BASE}/article`);
    expect(res.status).toBe(200);
  });

  it('category page returns 200', async () => {
    const res = await fetch(`${BASE}/category`);
    expect(res.status).toBe(200);
  });
});
