import { json, cors } from '../lib/response.js';

const LEAGUES = 'PL,PD,BL1,SA';
const LEAGUE_NAMES = { PL: 'Premier League', PD: 'La Liga', BL1: 'Bundesliga', SA: 'Serie A' };

export async function handleFixtures(request, env) {
  if (request.method === 'OPTIONS') return cors();

  const apiKey = env.FOOTBALL_API_KEY;
  if (!apiKey) return json({ matches: [], error: 'No API key' });

  const today    = new Date();
  const dayAfter = new Date(today.getTime() + 2 * 86400000);
  const fmt      = d => d.toISOString().split('T')[0];

  try {
    const r = await fetch(
      `https://api.football-data.org/v4/matches?competitions=${LEAGUES}&dateFrom=${fmt(today)}&dateTo=${fmt(dayAfter)}`,
      { headers: { 'X-Auth-Token': apiKey }, signal: AbortSignal.timeout(10000) }
    );
    const data = await r.json();
    const matches = (data.matches || []).map(m => {
      const isLive = ['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status);
      const homeScore = isLive
        ? (m.score?.regularTime?.home ?? m.score?.halfTime?.home ?? m.score?.fullTime?.home ?? null)
        : (m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null);
      const awayScore = isLive
        ? (m.score?.regularTime?.away ?? m.score?.halfTime?.away ?? m.score?.fullTime?.away ?? null)
        : (m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null);
      return {
        id: m.id, league: LEAGUE_NAMES[m.competition?.code] || m.competition?.name || '',
        leagueCode: m.competition?.code || '',
        home: m.homeTeam?.shortName || m.homeTeam?.name || '?',
        away: m.awayTeam?.shortName || m.awayTeam?.name || '?',
        status: m.status, homeScore, awayScore, utcDate: m.utcDate, minute: m.minute ?? null,
      };
    });
    const anyLive = matches.some(m => ['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status));
    const cc = anyLive ? 'public, max-age=30, s-maxage=30' : 'public, max-age=60, s-maxage=60';
    return new Response(JSON.stringify({ matches }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': cc, 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('Fixtures error:', err);
    return json({ matches: [], error: 'Internal server error' }, 500);
  }
}
