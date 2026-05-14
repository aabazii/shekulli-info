const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shekulli2026';

function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#formula1|#f1/i.test(ht))          return 'Sport';
  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#ldk\b|#vv\b/i.test(ht)) return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan/i.test(ht)) return 'Kosovë';
  if (/#ekonomi|#biznes|#financa|#turizëm/i.test(ht))                                    return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#trump|#putin/i.test(ht))        return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#teatër/i.test(ht))                          return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))                                   return 'Opinion';

  if (/\bsport\b|futboll|basketboll|volejboll|tenis|gjimnastik|formula\s*1|\bf1\b|kampionat|gol\b|penalti|arbitër|ndeshje|stadium|lojtarë|trajner|transferim|skuadër|klub\b|liga\b|serie\s*a|premier\s*league|champions|europa\s*league|bundesliga|laliga|nba\b|fifa\b|uefa\b/.test(t))
    return 'Sport';
  if (/politik|qeveri|kuvend|kryeministr|ministr|premier|deputet|parti\b|opozit|mazhorancë|koalicion|zgjedhj|votim|referendum|presidenc|dekret|bashki|komun|ligj\b|amendament|kushtetut|edi\s*rama|rama\b|basha\b|berisha|kryeminist/.test(t))
    return 'Politikë';
  if (/kosov|prishtinë|prizren|pejë\b|mitrovicë|gjakovë|ferizaj|gjilan|deçan|rahovec|suharekë|vushtrri|podujevë|kamenicë|dragash|malishevë|kurti\b|vjosa\b|osmani/.test(t))
    return 'Kosovë';
  if (/\bbotë\b|ndërkombëtar|europë\b|bashkim\s*europian|\beu\b|\bnato\b|\bonu\b|shba\b|shtetet\s*e\s*bashkuara|ukrainë|rusi|izrael|palestin|gaza\b|trump|biden|putin|zelenski|macron|erdogan|kinë|japoni|siri|afganistan|irak|iran\b|libi|turqi/.test(t))
    return 'Botë';
  if (/ekonomi|biznes|banka\b|bankë\b|inflacion|turizëm|eksport|import|treg\b|gdp\b|bpv\b|investim|kompani|aksion|bursë|kurs\s*këmbim|tatim|doganë|tregti|prodhim|punësim|papunësi|pagë\b|recesion|startup/.test(t))
    return 'Ekonomi';
  if (/kulturë|art\b|muzikë|këngë|këngëtar|aktor|aktore|film\b|kinema|teatër|ekspozitë|libër|libra|shkrimtar|poet|poezia|festiv|koncert|albumin|albumit|premiere|galeri|arkitektur|trashëgimi/.test(t))
    return 'Kulturë';
  if (/opinion|koment\b|editorial|analiz|perspektiv|vëzhgim|debat\b/.test(t))
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
        title:      p.title || text.slice(0, 140),
        standfirst: p.standfirst || text.slice(0, 300),
        body:       p.body || text,
        photo:      p.photo || p.image || '',
        hasVideo:   p.hasVideo || false,
        postUrl:    p.postUrl || '',
        author:     p.author || 'Shekulli.info',
        published:  p.published || Date.now(),
      };
    });

    const existing    = (await kv.get('posts')) || [];
    const blocklist   = new Set((await kv.get('deleted_ids')) || []);
    const existingIds = new Set(existing.map(p => String(p.id)));

    // Server-side quality gate: reject short/junk posts
    // Real news needs either (media + 80 chars) or (200+ chars of text alone)
    const quality = validated.filter(p => {
      const bodyLen = (p.body || '').length;
      const hasMedia = !!(p.photo || p.hasVideo);
      return (hasMedia && bodyLen >= 80) || bodyLen >= 200;
    });

    // Skip posts that already exist OR were previously deleted by admin
    const newPosts = quality.filter(p => !existingIds.has(p.id) && !blocklist.has(p.id));

    if (newPosts.length === 0) return res.json({ ok: true, message: 'No new posts (all duplicates)' });

    const merged = [...newPosts, ...existing]
      .sort((a, b) => b.published - a.published)
      .slice(0, 500);

    await kv.set('posts', merged);
    res.json({ ok: true, message: `✅ Saved ${newPosts.length} new posts (${merged.length} total)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
