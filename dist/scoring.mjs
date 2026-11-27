import {compareRated} from './ratings.mjs';

// Editorial intensity, 0–1: story, relaxation, challenge, social play, exploration.
// These are authored descriptors, not measured enjoyment probabilities.
const vectors={
1091500:[.92,.24,.64,.02,.90],1245620:[.65,.08,.96,.62,.98],1086940:[.98,.38,.78,.90,.88],1174180:[.97,.54,.48,.36,.94],292030:[.95,.42,.62,.01,.92],730:[.05,.03,.96,.94,.08],570:[.12,.02,.98,.97,.16],578080:[.04,.05,.88,.90,.43],1172470:[.20,.05,.93,.92,.34],252490:[.18,.08,.94,.88,.73],413150:[.68,.92,.32,.83,.72],105600:[.25,.61,.74,.89,.95],620:[.86,.48,.82,.91,.52],1145360:[.83,.14,.93,.01,.42],367520:[.73,.18,.95,.01,.97],1551360:[.12,.87,.62,.84,.79],1623730:[.28,.54,.65,.87,.86],553850:[.23,.04,.91,.98,.46],990080:[.81,.58,.49,.01,.91],945360:[.05,.46,.60,.98,.08],
220:[.90,.15,.72,.01,.48],400:[.68,.40,.83,.01,.32],550:[.26,.08,.87,.97,.28],489830:[.82,.61,.52,.01,.98],632470:[.99,.52,.61,.01,.66],753640:[.88,.55,.67,.01,.99],264710:[.65,.38,.72,.01,.98],504230:[.81,.12,.97,.01,.35],391540:[.97,.55,.63,.01,.58],588650:[.31,.08,.96,.01,.71],646570:[.08,.34,.93,.01,.39],1794680:[.06,.62,.74,.79,.25],1426210:[.84,.52,.63,.99,.62],548430:[.13,.28,.80,.98,.88],427520:[.08,.46,.95,.85,.53],294100:[.88,.23,.91,.01,.55],289070:[.34,.42,.92,.78,.79],275850:[.45,.84,.37,.81,.99],814380:[.74,.03,.99,.01,.70],1332010:[.83,.78,.32,.01,.82],1145350:[.87,.12,.94,.01,.55],1030300:[.74,.10,.97,.01,.96],1903340:[.98,.23,.83,.01,.79],2246340:[.44,.12,.93,.94,.85],2001120:[.83,.40,.69,.99,.75],70:[.87,.08,.76,.01,.44],7670:[.96,.10,.73,.01,.82],205100:[.86,.29,.76,.01,.94],1328670:[.98,.36,.65,.01,.83],203160:[.82,.15,.70,.05,.75]
};
export const dimensions=['story','relax','challenge','social','explore'];
export function experience(game) {
  if (game.intensity || vectors[game.id]) return game.intensity || vectors[game.id];
  if (game.curated) return dimensions.map(key => game.moods.includes(key) ? .8 : .2);
  const has = genre => game.genres.includes(genre);
  return [
    has('RPG') || has('Приключения') ? .65 : .25,
    has('Симулятор') || has('Головоломка') ? .68 : .25,
    has('Экшен') || has('Стратегия') ? .70 : .40,
    game.modes.some(mode => mode !== 'solo') ? .70 : .08,
    has('Песочница') || has('Приключения') ? .66 : .25,
  ];
}
export function libraryAffinity(g,library){const candidates=library.filter(x=>x.id!==g.id);if(!candidates.length)return library.some(x=>x.id===g.id)?1:0;const a=experience(g);const scores=candidates.map(x=>{const union=new Set([...g.genres,...x.genres]);const genre=g.genres.filter(t=>x.genres.includes(t)).length/union.size;const b=experience(x),distance=a.reduce((s,n,i)=>s+Math.abs(n-b[i]),0)/a.length;return .65*genre+.35*(1-distance);}).sort((a,b)=>b-a).slice(0,3);return scores.reduce((s,v)=>s+v,0)/scores.length;}
export function rankGames(games, filters = {}) {
  const f = {from: 0, to: 9999, minRating: 1, maxRating: 100, minReviews: 0, genre: '', sort: 'rating', ...filters};
  const matches = games.filter(game => game.overall && !game.comingSoon &&
    game.releaseYear >= f.from && game.releaseYear <= f.to &&
    game.overall.value >= f.minRating && game.overall.value <= f.maxRating &&
    game.rating.total >= f.minReviews && (!f.genre || game.genres.includes(f.genre)));
  const compare = f.sort === 'popular'
    ? (a, b) => b.rating.total - a.rating.total || compareRated(a, b)
    : f.sort === 'newest' ? (a, b) => b.releaseYear - a.releaseYear || compareRated(a, b) : compareRated;
  return matches.sort(compare);
}
export function periodYears(key,currentYear,minYear){return key==='ten'?[currentYear-9,currentYear]:key==='five'?[currentYear-4,currentYear]:key==='year'?[currentYear,currentYear]:[minYear,currentYear];}
