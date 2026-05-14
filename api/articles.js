import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const posts = (await kv.get('posts')) || [];
  const { category, limit = '100', offset = '0' } = req.query;

  let filtered = category ? posts.filter(p => p.category === category) : posts;
  filtered = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json(filtered);
}
