module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://shekulli.info');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return res.status(500).json({ ok: false, message: 'Server misconfigured' });
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== adminPass) return res.status(401).json({ ok: false });
  return res.json({ ok: true });
};
