/* PostgreSQL connection pool */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Falls back to individual env vars if DATABASE_URL not set
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'shekulli',
  user:     process.env.PGUSER     || 'postgres',
  password: process.env.PGPASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/* ── Queries ──────────────────────────────────────────────────── */

async function getArticles({ limit = 50, offset = 0, category } = {}) {
  const params = [limit, offset];
  let where = '';
  if (category) {
    params.push(category);
    where = `WHERE category = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM articles ${where}
     ORDER BY published DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return rows;
}

async function getArticleById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM articles WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function upsertArticle(article) {
  const {
    fb_post_id = null,
    title,
    standfirst = '',
    body = '',
    photo = '',
    author = 'Shekulli.info',
    category = 'Lajme',
    kicker = '',
    published,
  } = article;

  const { rows } = await pool.query(
    `INSERT INTO articles
       (fb_post_id, title, standfirst, body, photo, author, category, kicker, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (fb_post_id) DO UPDATE SET
       title      = EXCLUDED.title,
       standfirst = EXCLUDED.standfirst,
       body       = EXCLUDED.body,
       photo      = EXCLUDED.photo,
       author     = EXCLUDED.author,
       category   = EXCLUDED.category,
       kicker     = EXCLUDED.kicker,
       published  = EXCLUDED.published
     RETURNING *`,
    [fb_post_id, title, standfirst, body, photo, author, category, kicker, published]
  );
  return rows[0];
}

async function deleteArticle(id) {
  await pool.query('DELETE FROM articles WHERE id = $1', [id]);
}

async function testConnection() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}

module.exports = { pool, getArticles, getArticleById, upsertArticle, deleteArticle, testConnection };
