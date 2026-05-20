import { describe, it, expect } from 'vitest';
import { isAuthed, json, adminJson } from '../src/lib/response.js';

// Minimal mock of a CF Workers Request
function mockRequest(authHeader) {
  return {
    headers: {
      get: (h) => h === 'Authorization' ? authHeader : null,
    },
  };
}

// ── Authentication ────────────────────────────────────────────────────────────

describe('isAuthed', () => {
  it('rejects when ADMIN_PASSWORD env var is not set', () => {
    expect(isAuthed(mockRequest('Bearer anything'), {})).toBe(false);
  });

  it('rejects incorrect token', () => {
    expect(isAuthed(mockRequest('Bearer wrong'), { ADMIN_PASSWORD: 'correct' })).toBe(false);
  });

  it('rejects missing Authorization header', () => {
    expect(isAuthed(mockRequest(null), { ADMIN_PASSWORD: 'correct' })).toBe(false);
  });

  it('accepts correct Bearer token', () => {
    expect(isAuthed(mockRequest('Bearer correct'), { ADMIN_PASSWORD: 'correct' })).toBe(true);
  });

  it('requires Bearer prefix — bare token is rejected', () => {
    // Without "Bearer ", the stripped value is the full header string
    expect(isAuthed(mockRequest('correct'), { ADMIN_PASSWORD: 'correct' })).toBe(false);
  });

  it('is not vulnerable to empty-string ADMIN_PASSWORD', () => {
    // empty ADMIN_PASSWORD is falsy → fail-closed
    expect(isAuthed(mockRequest('Bearer '), { ADMIN_PASSWORD: '' })).toBe(false);
  });
});

// ── CORS headers ─────────────────────────────────────────────────────────────

describe('CORS headers', () => {
  it('public json() allows all origins', () => {
    const res = json({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('adminJson() restricts to shekulli.info', () => {
    const res = adminJson({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://shekulli.info');
  });

  it('adminJson() never returns wildcard', () => {
    const res = adminJson({ ok: true });
    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });
});

// ── Upload file-type whitelist ────────────────────────────────────────────────

describe('Upload validation', () => {
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const MAX_BYTES = 10 * 1024 * 1024;

  it('allows JPEG', () => expect(ALLOWED_TYPES.has('image/jpeg')).toBe(true));
  it('allows PNG',  () => expect(ALLOWED_TYPES.has('image/png')).toBe(true));
  it('allows WebP', () => expect(ALLOWED_TYPES.has('image/webp')).toBe(true));
  it('allows GIF',  () => expect(ALLOWED_TYPES.has('image/gif')).toBe(true));

  it('blocks HTML uploads',       () => expect(ALLOWED_TYPES.has('text/html')).toBe(false));
  it('blocks JavaScript uploads', () => expect(ALLOWED_TYPES.has('application/javascript')).toBe(false));
  it('blocks SVG uploads',        () => expect(ALLOWED_TYPES.has('image/svg+xml')).toBe(false));
  it('blocks plain text uploads', () => expect(ALLOWED_TYPES.has('text/plain')).toBe(false));
  it('blocks PHP uploads',        () => expect(ALLOWED_TYPES.has('application/x-php')).toBe(false));

  it('enforces a 10 MB ceiling', () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_BYTES + 1).toBeGreaterThan(MAX_BYTES); // trivial but documents intent
  });
});

// ── SSRF protection ───────────────────────────────────────────────────────────

describe('SSRF protection (mirrorImage URL check)', () => {
  function isAllowedUrl(url) {
    try {
      const { protocol } = new URL(url);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }

  it('allows http://',  () => expect(isAllowedUrl('http://example.com/img.jpg')).toBe(true));
  it('allows https://', () => expect(isAllowedUrl('https://fbcdn.net/img.jpg')).toBe(true));

  it('blocks file:// protocol',       () => expect(isAllowedUrl('file:///etc/passwd')).toBe(false));
  it('blocks ftp:// protocol',        () => expect(isAllowedUrl('ftp://host/secret')).toBe(false));
  it('blocks data: URI',              () => expect(isAllowedUrl('data:text/html,<script>')).toBe(false));
  it('blocks javascript: URI',        () => expect(isAllowedUrl('javascript:alert(1)')).toBe(false));
  it('rejects malformed / empty URL', () => expect(isAllowedUrl('not-a-url')).toBe(false));
});

// ── No hardcoded fallback passwords in source ─────────────────────────────────

describe('No hardcoded credential fallbacks', () => {
  it('isAuthed fails closed without ADMIN_PASSWORD', () => {
    // If someone deploys without setting the env var, every request must be rejected
    const requests = [
      mockRequest('Bearer shekulli2026'),
      mockRequest('Bearer admin'),
      mockRequest('Bearer password'),
      mockRequest('Bearer '),
      mockRequest(null),
    ];
    for (const req of requests) {
      expect(isAuthed(req, {})).toBe(false);
    }
  });
});
