export function guessCategory(text) {
  const t  = (text || '').toLowerCase();
  const ht = (text || '');

  if (/#politik|#qeveri|#kuvend|#parti|#zgjedhj|#opozit|#ps\b|#pd\b|#lsi\b|#ldk\b|#vv\b/i.test(ht)) return 'Politikë';
  if (/#kosov|#prishtinë|#prizren|#peja|#mitrovica|#gjakova|#ferizaj|#gjilan|#deçan/i.test(ht))      return 'Kosovë';
  if (/#sport|#futboll|#basketball|#basketboll|#tenis|#volejboll|#atletizëm|#formula1|#f1/i.test(ht)) return 'Sport';
  if (/#ekonomi|#biznes|#financa|#turizëm/i.test(ht))                                                 return 'Ekonomi';
  if (/#botë|#ndërkombëtar|#nato|#eu\b|#onu\b|#ukrainë|#trump|#putin/i.test(ht))                     return 'Botë';
  if (/#kulture|#kulturë|#art|#muzikë|#film|#teatër/i.test(ht))                                       return 'Kulturë';
  if (/#opinion|#koment|#editorial|#analiz/i.test(ht))                                                return 'Opinion';

  if (/\bpolitik|\bqeveri\b|\bkuvend\b|\bkryeministr|\bministr|\bdeputet|\bopozit|\bmazhorancë|\bkoalicion|\bzgjedhj|\bvotim\b|\breferendum|\bpresidenc|\bdekret\b|\breform\b|\bligj\b|\bamendament|\bkushtetut|\bedi\s*rama|\brama\b|\bbasha\b|\bberisha|\bvetëvendosje|\bvv\b|\bldk\b|\bpdk\b|\blsi\b/.test(t)) return 'Politikë';
  if (/\bkosov|\bprishtinë|\bprizren|\bpejë\b|\bmitrovicë|\bgjakovë|\bferizaj|\bgjilan|\bdeçan|\brahovec|\bsuharekë|\bvushtrri|\bpodujevë|\bkamenicë|\bkurti\b|\bvjosa\b|\bosmani\b/.test(t)) return 'Kosovë';
  if (/\bfutboll|\bbasketboll|\bvolejboll|\btenis\b|\batletizëm|\bgol\b|\bpenalti\b|\bstadium\b|\blojtarë|\btrajner\b|\btransferim\b|\bskuadër\b|\bserie\s*a|\bpremier\s*league|\bchampions\b|\bnba\b|\bfifa\b|\buefa\b|\bkampionat\b/.test(t)) return 'Sport';
  if (/\bbotë\b|\bndërkombëtar|\beuropë\b|\bbashkim\s*europian|\bnato\b|\bonu\b|\bshba\b|\bukrainë|\brusi\b|\bizrael|\bpalestin|\bgaza\b|\btrump\b|\bputin\b|\bzelenski|\bmacron\b|\berdogan\b|\bkinë\b/.test(t)) return 'Botë';
  if (/\bekonomi|\bbiznes\b|\bbanka\b|\binflacion|\bturizëm|\beksport|\bimport\b|\binvestim|\bkompani\b|\btatim\b|\btregti\b|\bpunësim|\bpapunësi|\bpagë\b/.test(t)) return 'Ekonomi';
  if (/\bkulturë\b|\bart\b|\bmuzikë\b|\bkëngë\b|\bkëngëtar|\bfilm\b|\bteatër\b|\bekspozitë|\blibër\b|\bfestiv|\bkoncert\b|\balbum|\btrashëgimi|\binfluencer|\bcelebrit|\bviral\b/.test(t)) return 'Kulturë';
  if (/\bopinion\b|\bkoment\b|\beditorial|\banaliz|\bdebat\b/.test(t)) return 'Opinion';
  if (/\bulqin|\bmali i zi|\bmontenegro|\btivari|\bpodgoricë|\bbeogradi|\bserbë|\bbosnjë|\bmaqedoni|\bgreqi\b|\bitali\b|\bgjermani\b|\bfranc\b|\bspanj\b|\bangli\b|\bbritani\b/.test(t)) return 'Botë';
  return 'Lajme';
}
