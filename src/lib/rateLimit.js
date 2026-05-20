export async function checkRateLimit(env, key, max = 10, windowSecs = 60) {
  const window = Math.floor(Date.now() / 1000 / windowSecs);
  const kvKey = `rl:${key}:${window}`;
  const current = parseInt(await env.KV.get(kvKey) || '0', 10);
  if (current >= max) return false;
  await env.KV.put(kvKey, String(current + 1), { expirationTtl: windowSecs * 2 });
  return true;
}
