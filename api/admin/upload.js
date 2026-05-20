const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'shekulli';
const PUBLIC_URL = 'https://pub-a3d012dde3734d7595b3c2796f7ec96a.r2.dev';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://shekulli.info');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return res.status(500).json({ ok: false, message: 'Server misconfigured' });
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== adminPass) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(415).json({ ok: false, message: 'Invalid file type' });
  }

  const filename = req.query.filename || `photo-${Date.now()}.jpg`;
  const key = `${Date.now()}-${filename}`;

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    if (body.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, message: 'File too large (max 10 MB)' });
    }

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    res.json({ ok: true, url: `${PUBLIC_URL}/${key}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
