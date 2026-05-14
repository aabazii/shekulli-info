import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const posts = (await kv.get('posts')) || [];
  res.json({ ok: true, articles: posts.length, ts: Date.now() });
}
