const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

function clean(text) {
  return (text || '')
    .replace(/\s*(\.{3}|…)\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .replace(/\s*(see\s*more|shiko\s*më\s*shumë)\s*/gi, '')
    .trim();
}

function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

  // Hashtags first (most reliable signal) — Politikë & Kosovë before Sport
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#lsi\b|#ldk\b|#vv\b/i.test(ht)) return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan|#deçan/i.test(ht))      return 'Kosovë';
  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#volejboll|#atletizëm|#formula1|#f1/i.test(ht)) return 'Sport';
  if (/#ekonomi|#biznes|#financa|#turizëm/i.test(ht))                                                 return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#trump|#putin/i.test(ht))                     return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#teatër/i.test(ht))                                       return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))                                                return 'Opinion';

  // Keyword matching — Politikë & Kosovë checked BEFORE Sport
  if (/\bpolitik|\bqeveri\b|\bkuvend\b|\bkryeministr|\bministr|\bdeputet|\bopozit|\bmazhorancë|\bkoalicion|\bzgjedhj|\bvotim\b|\breferendum|\bpresidenc|\bdekret\b|\breform\b|\bligj\b|\bamendament|\bkushtetut|\bedi\s*rama|\brama\b|\bbasha\b|\bberisha|\bkryeminist|\bvetëvendosje|\bvv\b|\bldk\b|\bpdk\b|\blsi\b/.test(t))
    return 'Politikë';
  if (/\bkosov|\bprishtinë|\bprizren|\bpejë\b|\bmitrovicë|\bgjakovë|\bferizaj|\bgjilan|\bdeçan|\brahovec|\bsuharekë|\bvushtrri|\bpodujevë|\bkamenicë|\bdragash|\bmalishevë|\bkurti\b|\bvjosa\b|\bosmani\b|\bsrpska|\bpolicia\b|\bprokuroria\b|\bgjykata\b/.test(t))
    return 'Kosovë';
  // Sport: only unambiguous sports terms (removed ndeshje, klub, liga, kampionat — too generic)
  if (/\bfutboll|\bbasketboll|\bvolejboll|\btenis\b|\batletizëm|\bgjimnastik|\bformula\s*1|\bf1\b|\bmoto\s*gp|\bgol\b|\bpenalti\b|\barbitër\b|\bstadium\b|\btifo\b|\blojtarë|\btrajner\b|\btransferim\b|\bskuadër\b|\bserie\s*a|\bpremier\s*league|\bchampions\b|\beuropa\s*league|\bbundesliga|\blaliga\b|\bnba\b|\bfifa\b|\buefa\b|\bkampionat\b/.test(t))
    return 'Sport';
  if (/\bbotë\b|\bndërkombëtar|\beuropë\b|\bbashkim\s*europian|\beu\b|\bnato\b|\bonu\b|\bshba\b|\bukrainë|\brusi\b|\bizrael|\bpalestin|\bgaza\b|\btrump\b|\bbiden\b|\bputin\b|\bzelenski|\bmacron\b|\berdogan\b|\bkinë\b|\bjaponi\b|\bsiri\b|\bafganistan|\birak\b|\biran\b|\blibi\b|\bturqi\b/.test(t))
    return 'Botë';
  if (/\bekonomi|\bbiznes\b|\bbanka\b|\bbankë\b|\binflacion|\bturizëm|\beksport|\bimport\b|\btreg\b|\bgdp\b|\bbpv\b|\binvestim|\bkompani\b|\baksion\b|\bbursë\b|\btatim\b|\bdoganë\b|\btregti\b|\bprodhim\b|\bpunësim|\bpapunësi|\bpagë\b|\brecesion|\bstartup/.test(t))
    return 'Ekonomi';
  if (/\bkulturë\b|\bart\b|\bmuzikë\b|\bkëngë\b|\bkëngëtar|\baktor\b|\baktore\b|\bfilm\b|\bkinema\b|\bteatër\b|\bekspozitë|\blibër\b|\bshkrimtar|\bpoet\b|\bpoezi|\bfestiv|\bkoncert\b|\balbum|\bpremiere\b|\bgaleri\b|\btrashëgimi/.test(t))
    return 'Kulturë';
  if (/\bopinion\b|\bkoment\b|\beditorial|\banaliz|\bperspektiv|\bvëzhgim|\bdebat\b/.test(t))
    return 'Opinion';

  return 'Lajme';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  try {
    const { posts } = req.body;
    if (!Array.isArray(posts)) return res.status(400).json({ ok: false, message: 'posts must be an array' });

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

    const existing  = (await kv.get('posts')) || [];
    const blocklist = new Set((await kv.get('deleted_ids')) || []);

    // Server-side quality gate
    const quality = validated.filter(p => {
      const bodyLen = (p.body || '').length;
      const hasMedia = !!(p.photo || p.hasVideo);
      return (hasMedia && bodyLen >= 60) || bodyLen >= 200;
    });

    // Build a map of existing posts for quick lookup
    const existingMap = new Map(existing.map(p => [String(p.id), p]));

    let addedCount = 0, updatedCount = 0;
    const toAdd = [];

    for (const p of quality) {
      if (blocklist.has(p.id)) continue; // permanently deleted — never re-add

      const prev = existingMap.get(p.id);
      if (!prev) {
        // Brand new post
        toAdd.push(p);
        addedCount++;
      } else {
        // Already exists — update if:
        // 1. New body is longer (post was truncated before), OR
        // 2. Old title/standfirst still contains "See more" / "Shiko më shumë"
        const prevLen = (prev.body || '').length;
        const newLen  = (p.body  || '').length;
        const hadSeeMore = /see\s*more|shiko\s*më\s*shumë/i.test(prev.title + ' ' + prev.standfirst);
        if (newLen > prevLen + 20 || hadSeeMore) {
          existingMap.set(p.id, { ...prev, ...p });
          updatedCount++;
        }
      }
    }

    if (addedCount === 0 && updatedCount === 0) {
      return res.json({ ok: true, message: 'No new posts (all duplicates)' });
    }

    const merged = [...toAdd, ...Array.from(existingMap.values())]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kv.set('posts', merged);
    const msg = [
      addedCount   > 0 ? `${addedCount} new`           : '',
      updatedCount > 0 ? `${updatedCount} updated (full text)` : '',
    ].filter(Boolean).join(', ');
    res.json({ ok: true, message: `✅ ${msg} (${merged.length} total)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
