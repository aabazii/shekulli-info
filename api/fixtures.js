/* Returns today + next 2 days of matches from PL, La Liga, Bundesliga, Serie A */

const LEAGUES = 'PL,PD,BL1,SA';

const LEAGUE_NAMES = {
  PL:  'Premier League',
  PD:  'La Liga',
  BL1: 'Bundesliga',
  SA:  'Serie A',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120'); // cache 1 min

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) return res.json({ matches: [], error: 'No API key configured' });

  // Fetch today + 2 days ahead so there's always something to show
  const today    = new Date();
  const dayAfter = new Date(today.getTime() + 2 * 86400000);
  const fmt      = d => d.toISOString().split('T')[0];

  try {
    const r    = await fetch(
      `https://api.football-data.org/v4/matches?competitions=${LEAGUES}&dateFrom=${fmt(today)}&dateTo=${fmt(dayAfter)}`,
      { headers: { 'X-Auth-Token': apiKey } }
    );
    const data = await r.json();
    const matches = (data.matches || []).map(m => ({
      id:         m.id,
      league:     LEAGUE_NAMES[m.competition?.code] || m.competition?.name || '',
      leagueCode: m.competition?.code || '',
      home:       m.homeTeam?.shortName || m.homeTeam?.name || '?',
      away:       m.awayTeam?.shortName || m.awayTeam?.name || '?',
      status:     m.status, // SCHEDULED, LIVE, IN_PLAY, PAUSED, FINISHED, etc.
      homeScore:  m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      awayScore:  m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      utcDate:    m.utcDate,
      minute:     m.minute || null,
    }));

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ matches: [], error: err.message });
  }
};
