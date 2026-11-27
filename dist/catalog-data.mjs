import {baseGames} from './engine.mjs';
import {criticFor} from './critic-sources.mjs';
import {assignTopRanks, nextplayScore} from './ratings.mjs';

export const coverFallback = 'assets/cover-pending.svg';
const yearFrom = game => game.releaseYear || Number(String(game.year).match(/\b\d{4}\b/)?.[0]) || null;

function gameFromSnapshot(game, snapshot) {
  return {
    ...game,
    curated: false,
    aliases: [],
    moods: [],
    minutes: null,
    hardware: null,
    snapshotURL: 'https://huggingface.co/datasets/FronkonGames/steam-games-dataset',
    snapshotAccessedAt: snapshot.accessedAt,
  };
}

export function assembleCatalog(steam, snapshot, currentYear) {
  const storeData = new Map(steam.map(game => [game.id, game]));
  const games = [
    ...baseGames.map(game => ({...game, ...storeData.get(game.id), curated: true})),
    ...(snapshot?.games ?? []).map(game => gameFromSnapshot(game, snapshot)),
  ].map(game => {
    const critic = criticFor(game);
    return {
      ...game,
      free: game.freeURL ? true : game.free,
      releaseYear: game.id === 730 ? 2023 : yearFrom(game),
      image: game.image || coverFallback,
      source: 'https://store.steampowered.com/app/' + game.id + '/',
      critic,
      overall: nextplayScore(game.rating, critic),
    };
  });
  const top = assignTopRanks(games, currentYear);
  return games.map(game => ({...game, topRank: top.get(game.id)}));
}
