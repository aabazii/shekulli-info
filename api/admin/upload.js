const { put } = require('@vercel/blob');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const filename = req.query.filename || `photo-${Date.now()}.jpg`;

  try {
    const blob = await put(`shekulli/${Date.now()}-${filename}`, req, {
      access: 'public',
    });
    res.json({ ok: true, url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
