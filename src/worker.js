import { handleArticles }   from './handlers/articles.js';
import { handleViews }      from './handlers/views.js';
import { handleHealth }     from './handlers/health.js';
import { handleScrape }     from './handlers/scrape.js';
import { handleScrapeSport } from './handlers/scrape-sport.js';
import { handleDelete }     from './handlers/admin/delete.js';
import { handleEdit }       from './handlers/admin/edit.js';
import { handleUpload }     from './handlers/admin/upload.js';
import { handleUtils }      from './handlers/admin/utils.js';
import { handleImport }     from './handlers/admin/import.js';
import { handleVerify }     from './handlers/admin/verify.js';
import { handleFixtures }   from './handlers/fixtures.js';

const ADMIN_ROUTES = new Set([
  '/api/admin/delete', '/api/admin/edit', '/api/admin/upload',
  '/api/admin/utils',  '/api/admin/import', '/api/admin/verify',
  '/api/scrape',       '/api/scrape-sport',
]);

const PUBLIC_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ADMIN_CORS = {
  'Access-Control-Allow-Origin': 'https://shekulli.info',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-FB-Token,X-Vercel-Cron',
};

const ROUTES = {
  '/api/articles':       handleArticles,
  '/api/views':          handleViews,
  '/api/health':         handleHealth,
  '/api/scrape':         handleScrape,
  '/api/scrape-sport':   handleScrapeSport,
  '/api/admin/delete':   handleDelete,
  '/api/admin/edit':     handleEdit,
  '/api/admin/upload':   handleUpload,
  '/api/admin/utils':    handleUtils,
  '/api/admin/import':   handleImport,
  '/api/admin/verify':   handleVerify,
  '/api/fixtures':       handleFixtures,
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      const { pathname } = new URL(request.url);
      const corsHeaders = ADMIN_ROUTES.has(pathname) ? ADMIN_CORS : PUBLIC_CORS;
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const { pathname } = new URL(request.url);
    const handler = ROUTES[pathname];
    if (handler) return handler(request, env);

    // Serve R2 images through the Worker so they load from same origin
    if (pathname.startsWith('/img/')) {
      const key = decodeURIComponent(pathname.slice(5));
      if (!key) return new Response('Not found', { status: 404 });
      try {
        const obj = await env.BUCKET.get(key);
        if (!obj) return new Response('Not found', { status: 404 });
        const ct = obj.httpMetadata?.contentType || 'image/jpeg';
        return new Response(obj.body, {
          headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=31536000, immutable' },
        });
      } catch {
        return new Response('Error', { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
