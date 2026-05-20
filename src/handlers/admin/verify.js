import { adminJson, cors, isAuthed } from '../../lib/response.js';

export async function handleVerify(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (!isAuthed(request, env)) return adminJson({ ok: false }, 401);
  return adminJson({ ok: true });
}
