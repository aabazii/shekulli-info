import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const NAMESPACE_ID   = 'c214c0482e8043a091f472b1477598a5';
const WORKER_URL     = 'https://shekulli-info.ajanabazi1234.workers.dev';
const ADMIN_PASSWORD = 'shekulli2026';
const PUBLIC_R2_URL  = 'https://pub-a3d012dde3734d7595b3c2796f7ec96a.r2.dev';

function kvGet(key) {
  const out = execSync(
    `npx wrangler kv key get --remote --namespace-id=${NAMESPACE_ID} "${key}" 2>/dev/null`,
    { maxBuffer: 10 * 1024 * 1024 }
  ).toString();
  const start = out.indexOf('[') !== -1 ? out.indexOf('[') : out.indexOf('{');
  if (start === -1) return out.trim();
  return JSON.parse(out.slice(start));
}

async function mirrorImage(srcUrl, key) {
  try {
    const res = await fetch(srcUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) return null;
    const ext = srcUrl.includes('.png') ? 'png' : 'jpg';
    const filename = `fix-${key}.${ext}`;
    const uploadRes = await fetch(`${WORKER_URL}/api/admin/upload?filename=${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': `image/${ext}`, 'Authorization': `Bearer ${ADMIN_PASSWORD}` },
      body: buf,
      signal: AbortSignal.timeout(15000),
    });
    if (!uploadRes.ok) return null;
    const data = await uploadRes.json();
    return data.url || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Reading posts from CF KV...');
  const posts = kvGet('posts');
  console.log(`Total posts: ${posts.length}`);

  const pageToken = execSync(
    `npx wrangler kv key get --remote --namespace-id=${NAMESPACE_ID} "fb_permanent_token" 2>/dev/null | grep -v "wrangler\\|───\\|Resource\\|Writing\\|location"`,
    { maxBuffer: 1024 * 1024, shell: '/bin/bash' }
  ).toString().trim();

  console.log('Page token:', pageToken.slice(0, 20) + '...');

  const broken = posts.filter(p =>
    p.fb_post_id &&
    p.category !== 'Sport' &&
    (!p.photo ||
      p.photo.includes('vercel-storage') ||
      p.photo.includes('blob.vercel') ||
      p.photo.includes('fbcdn.net'))
  );
  console.log(`Posts needing R2 mirror: ${broken.length}`);

  // Fetch fresh photos in batches of 20
  const freshPhotos = {};
  // Strip fb_ prefix if accidentally stored in fb_post_id
  const ids = broken.map(p => p.fb_post_id.replace(/^fb_/, ''));
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20).join(',');
    const res = await fetch(
      `https://graph.facebook.com/v21.0?ids=${batch}&fields=full_picture&access_token=${pageToken}`
    );
    const data = await res.json();
    for (const [id, val] of Object.entries(data)) {
      if (val.full_picture) freshPhotos[id] = val.full_picture;
    }
    console.log(`Fetched batch ${Math.floor(i/20)+1}: ${Object.keys(freshPhotos).length} photos so far`);
  }

  // Mirror each fresh photo to R2
  let fixed = 0;
  const postMap = new Map(posts.map(p => [p.id, p]));

  for (const p of broken) {
    const freshUrl = freshPhotos[p.fb_post_id.replace(/^fb_/, '')];
    if (!freshUrl) { console.log(`  No fresh photo for ${p.fb_post_id}`); continue; }
    process.stdout.write(`  Mirroring ${p.id.slice(0, 40)}... `);
    const r2Url = await mirrorImage(freshUrl, p.published);
    if (r2Url) {
      postMap.get(p.id).photo = r2Url;
      fixed++;
      console.log('✓');
    } else {
      console.log('✗ failed');
    }
  }

  console.log(`\nFixed ${fixed} of ${broken.length} posts. Writing back to KV...`);
  const updated = JSON.stringify(Array.from(postMap.values()));
  writeFileSync('/tmp/posts-fixed.json', updated);
  execSync(
    `npx wrangler kv key put --remote --namespace-id=${NAMESPACE_ID} "posts" "$(cat /tmp/posts-fixed.json)"`,
    { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024, shell: '/bin/bash' }
  );
  console.log('Done!');
}

main().catch(console.error);
