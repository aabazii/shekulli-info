const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';
const R2_ENDPOINT    = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET      = process.env.R2_BUCKET || 'shekulli';
const PUBLIC_URL     = 'https://pub-a3d012dde3734d7595b3c2796f7ec96a.r2.dev';

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const filename = req.query.filename || `photo-${Date.now()}.jpg`;
  const key = `${Date.now()}-${filename}`;
  const contentType = req.headers['content-type'] || 'image/jpeg';

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    res.json({ ok: true, url: `${PUBLIC_URL}/${key}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
