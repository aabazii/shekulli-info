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
    const matches = (data.matches || []).map(m => {
      const isLive = ['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status);
      // In v4 the live minute is at m.minute; score during play is regularTime
      const homeScore = isLive
        ? (m.score?.regularTime?.home ?? m.score?.halfTime?.home ?? m.score?.fullTime?.home ?? null)
        : (m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null);
      const awayScore = isLive
        ? (m.score?.regularTime?.away ?? m.score?.halfTime?.away ?? m.score?.fullTime?.away ?? null)
        : (m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null);

      return {
        id:         m.id,
        league:     LEAGUE_NAMES[m.competition?.code] || m.competition?.name || '',
        leagueCode: m.competition?.code || '',
        home:       m.homeTeam?.shortName || m.homeTeam?.name || '?',
        away:       m.awayTeam?.shortName || m.awayTeam?.name || '?',
        status:     m.status,
        homeScore,
        awayScore,
        utcDate:    m.utcDate,
        minute:     m.minute ?? null,  // live elapsed minute from API
      };
    });

    // Use a shorter cache when games are live so minute ticks update
    const anyLive = matches.some(m => ['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status));
    res.setHeader('Cache-Control', anyLive
      ? 's-maxage=30, stale-while-revalidate=30'
      : 's-maxage=60, stale-while-revalidate=120');

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ matches: [], error: err.message });
  }
};
