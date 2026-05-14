const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const posts = (await kv.get('posts')) || [];
    res.json({ ok: true, articles: posts.length, ts: Date.now() });
  } catch (err) {
    res.json({ ok: false, articles: 0, ts: Date.now(), error: err.message });
  }
};
