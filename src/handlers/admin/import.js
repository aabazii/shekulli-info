import { kvGet, kvSet } from '../../lib/kv.js';
import { json, cors, isAuthed } from '../../lib/response.js';
import { guessCategory } from '../../lib/category.js';

function clean(text) {
  return (text || '')
    .replace(/\s*(\.{3}|…)\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .replace(/\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .trim();
}

export async function handleImport(request, env) {
  if (request.method === 'OPTIONS') return cors();
  if (request.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405);
  if (!isAuthed(request, env)) return json({ ok: false, message: 'Unauthorized' }, 401);

  try {
    const { posts } = await request.json();
    if (!Array.isArray(posts)) return json({ ok: false, message: 'posts must be an array' }, 400);

    const validated = posts.map(p => {
      const text = p.text || p.title || '';
      const cat  = p.category || guessCategory(text);
      return {
        id:         String(p.id),
        fb_post_id: String(p.id),
        category:   cat,
        kicker:     cat.toUpperCase(),
        title:      clean(p.title || text.slice(0, 140)),
        standfirst: clean(p.standfirst || (p.body || text).slice(0, 300)),
        body:       clean(p.body || text),
        photo:      p.photo || p.image || '',
        hasVideo:   p.hasVideo || false,
        postUrl:    p.postUrl || '',
        author:     p.author || 'Shekulli.info',
        published:  p.published || Date.now(),
      };
    });

    const existing  = await kvGet(env, 'posts') || [];
    const blocklist = new Set(await kvGet(env, 'deleted_ids') || []);
    const existingMap = new Map(existing.map(p => [String(p.id), p]));

    const quality = validated.filter(p => {
      const bodyLen  = (p.body || '').length;
      const hasMedia = !!(p.photo || p.hasVideo);
      return (hasMedia && bodyLen >= 60) || bodyLen >= 200;
    });

    let addedCount = 0, updatedCount = 0;
    const toAdd = [];

    for (const p of quality) {
      if (blocklist.has(p.id)) continue;
      const prev = existingMap.get(p.id);
      if (!prev) { toAdd.push(p); addedCount++; }
      else {
        const hadSeeMore = /see\s*more|shiko\s*më\s*shumë/i.test(prev.title + ' ' + prev.standfirst);
        if ((p.body || '').length > (prev.body || '').length + 20 || hadSeeMore) {
          existingMap.set(p.id, { ...prev, ...p });
          updatedCount++;
        }
      }
    }

    if (addedCount === 0 && updatedCount === 0) {
      return json({ ok: true, message: 'No new posts (all duplicates)' });
    }

    const merged = [...toAdd, ...Array.from(existingMap.values())]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kvSet(env, 'posts', merged);

    const parts = [
      addedCount   > 0 ? `${addedCount} new` : '',
      updatedCount > 0 ? `${updatedCount} updated` : '',
    ].filter(Boolean).join(', ');
    return json({ ok: true, message: `✅ ${parts} (${merged.length} total)` });
  } catch (e) {
    return json({ ok: false, message: e.message }, 500);
  }
}
