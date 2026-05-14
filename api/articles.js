const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const posts = (await kv.get('posts')) || [];
    const { category, limit = '100', offset = '0' } = req.query;
    let filtered = category ? posts.filter(p => p.category === category) : posts;
    filtered = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
