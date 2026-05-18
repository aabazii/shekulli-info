export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

export const cors = () => new Response(null, {
  status: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-FB-Token,X-Vercel-Cron,X-CF-Cron',
  },
});

export const isAuthed = (request, env) => {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  return token === (env.ADMIN_PASSWORD || 'shekulli2026');
};
