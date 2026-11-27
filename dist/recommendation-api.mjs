import {dailyPick} from './daily.mjs';
import {suggestGames} from './engine.mjs';

export const hasJavaServer = typeof document !== 'undefined' &&
  Boolean(document.querySelector('meta[name="nextplay-runtime"][content="java"]'));

export async function getRecommendations(games, prefs, owned, kind = 'list') {
  if (hasJavaServer) {
    try {
      const body = new URLSearchParams({...prefs, kind, genres: prefs.genres.join('|'), owned: owned.join('|')});
      const response = await fetch('/api/recommendations', {method: 'POST', body, signal: AbortSignal.timeout(4500)});
      if (!response.ok) throw new Error('Recommendation server unavailable');
      const data = await response.json();
      const byId = new Map(games.map(game => [game.id, game]));
      const hydrate = match => {
        if (!byId.has(match.id)) throw new Error('Recommendation catalog differs');
        return {...byId.get(match.id), ...match};
      };
      return kind === 'daily'
        ? (data.game === null ? null : hydrate(data.game))
        : {approximate: data.approximate, games: data.games.map(hydrate)};
    } catch {
      // Cached pages can still recommend games when the server is unreachable.
    }
  }
  return kind === 'daily' ? dailyPick(games, prefs, owned) : suggestGames(games, prefs, owned);
}
