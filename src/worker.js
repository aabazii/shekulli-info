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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-FB-Token,X-Vercel-Cron,X-CF-Cron',
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
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);
    const handler = ROUTES[pathname];
    if (handler) return handler(request, env);

    return env.ASSETS.fetch(request);
  },
};
