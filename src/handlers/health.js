import { json } from '../lib/response.js';

export async function handleHealth(request, env) {
  return json({ ok: true });
}
