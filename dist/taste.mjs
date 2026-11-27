import {experience, gameSimilarity} from './scoring.mjs';

export function tasteSignals(profile) {
  const ratings = new Map();
  for (const id of profile.wishlist.slice(-30)) ratings.set(id, .6);
  for (const {gameId, score} of profile.reviews.slice(0, 30).reverse()) {
    if (score >= 8) ratings.set(gameId, .8);
    if (score <= 4) ratings.set(gameId, -.8);
  }
  for (const [id, vote] of Object.entries(profile.taste ?? {})) {
    if (vote === 1 || vote === -1) ratings.set(Number(id), vote);
  }
  return [...ratings.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 60);
}

export function trainTaste(games, signals) {
  const byId = new Map(games.map(game => [game.id, game]));
  const examples = signals.flatMap(([id, value]) => byId.has(id) ? [[byId.get(id), value]] : []);
  return game => {
    const neighbors = examples.filter(([other]) => other.id !== game.id)
      .map(([other, label]) => ({similarity: gameSimilarity(game, other, experience(game)), label}))
      .filter(({similarity}) => similarity >= .4)
      .sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    if (!neighbors.length) return null;
    let totalWeight = 0;
    let totalVote = 0;
    for (const {similarity, label} of neighbors) {
      const weight = similarity ** 2;
      totalWeight += weight;
      totalVote += weight * label * similarity;
    }
    return .5 + .5 * totalVote / totalWeight;
  };
}
