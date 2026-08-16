const SITE_ORIGIN = 'https://shekulli.info';

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
});

export const adminJson = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': SITE_ORIGIN },
});

export const cors = () => new Response(null, {
  status: 200,
  headers: {
    'Access-Control-Allow-Origin': SITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-FB-Token,X-Vercel-Cron',
  },
});

export const isAuthed = (request, env) => {
  if (!env.ADMIN_PASSWORD) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  return header.slice(7) === env.ADMIN_PASSWORD;
};
 