// PC review pages checked directly. A Metascore takes precedence over an outlet review.
const verified = {
  730: ['Metacritic', 82, 'https://www.metacritic.com/game/counter-strike-2/?platform=pc'],
  578080: ['PC Gamer', 85, 'https://www.pcgamer.com/pubg-review/'],
  1551360: ['PC Gamer', 90, 'https://www.pcgamer.com/forza-horizon-5-review/'],
  553850: ['PC Gamer', 86, 'https://www.pcgamer.com/helldivers-2-review/'],
  2246340: ['PC Gamer', 85, 'https://www.pcgamer.com/games/action/monster-hunter-wilds-review/'],
  2001120: ['PC Gamer', 87, 'https://www.pcgamer.com/games/adventure/split-fiction-review/'],
  2231450: ['PC Gamer', 90, 'https://www.pcgamer.com/pizza-tower-review-madcap-platforming-at-100mph/'],
  2420110: ['Metacritic', 89, 'https://www.metacritic.com/game/horizon-forbidden-west-complete-edition/critic-reviews/?platform=pc'],
  1623730: ['Metacritic', 78, 'https://www.metacritic.com/game/palworld/critic-reviews/?platform=pc'],
};

export function criticFor(game) {
  if (game.metacritic) return {...game.metacritic, name: 'Metacritic'};
  if (!Object.hasOwn(verified, game.id)) return null;
  const [name, score, url] = verified[game.id];
  return {name, score, url, platform: 'PC'};
}
