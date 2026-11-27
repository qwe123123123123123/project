import fs from 'node:fs/promises';
import {baseGames, genres} from '../dist/engine.mjs';

const [source, output] = [
  new URL('../.cache/steam-snapshot.json', import.meta.url),
  new URL('../dist/bulk-catalog.json', import.meta.url),
];
const snapshot = JSON.parse(await fs.readFile(source, 'utf8'));
const titleKey = title => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const usedIds = new Set(baseGames.map(game => game.id));
const usedTitles = new Set(baseGames.map(game => titleKey(game.title)));
const stockImage = id => `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;

function allowedURL(raw, hostPattern, pathPattern) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        !hostPattern.test(url.hostname) || !pathPattern.test(url.pathname)) return null;
    url.protocol = 'https:';
    return url.href;
  } catch {
    return null;
  }
}

function selectGenres(row, tags) {
  const values = new Set(row.genres);
  const flags = [
    values.has('RPG'),
    values.has('Action'),
    values.has('Adventure'),
    values.has('Strategy'),
    values.has('Simulation') || values.has('Sports'),
    /sandbox|open world survival craft/i.test(tags),
    /puzzle|hidden object|logic/i.test(tags),
    values.has('Racing'),
  ];
  return genres.filter((_, index) => flags[index]);
}

function modesFor(categories) {
  const modes = [];
  if (categories.includes('Single-player')) modes.push('solo');
  if (categories.some(category => /online|mmo|multi-player/i.test(category))) modes.push('online');
  if (categories.some(category => /split screen|local co-op|local multi-player/i.test(category))) modes.push('local');
  return modes;
}

function clean(row) {
  const id = Number(row.appID);
  const title = String(row.name || '').trim();
  const key = titleKey(title);
  const age = Number(row.required_age);
  const total = Number(row.positive) + Number(row.negative);
  const releaseYear = Number(String(row.release_date).match(/\b(19|20)\d{2}\b/)?.[0]);
  const latestYear = new Date(snapshot.accessedAt).getUTCFullYear();
  if (!Number.isSafeInteger(id) || id <= 0 || !title || title.length > 120 ||
      usedIds.has(id) || usedTitles.has(key) || !row.windows ||
      /\b(demo|playtest|soundtrack|dedicated server|benchmark|prologue|test server|test branch)\b/i.test(title) ||
      !Number.isFinite(releaseYear) || releaseYear < 1970 || releaseYear > latestYear ||
      !Number.isInteger(total) || total < 1000 || row.positive < 0 || row.negative < 0 ||
      !Array.isArray(row.genres) || row.genres.some(genre => /utility|software|sexual|adult|animation|developer tools/i.test(genre))) return null;

  const tags = (Array.isArray(row.tags) ? row.tags : Object.keys(row.tags || {})).join(' ');
  if (/hentai|sexual content|adult only/i.test(tags)) return null;
  const category = selectGenres(row, tags);
  const modes = modesFor(row.categories || []);
  if (!category.length || !modes.length) return null;
  const image = allowedURL(row.header_image, /^(?:[\w-]+\.)*steamstatic\.com$/i, /^\//) || stockImage(id);
  const criticURL = allowedURL(row.metacritic_url, /^(?:www\.)?metacritic\.com$/i, /^\/game\//);
  const critic = criticURL && row.metacritic_score > 0 && row.metacritic_score <= 100
    ? {score: row.metacritic_score, url: criticURL, platform: 'PC'} : null;
  const trailer = (row.movies || []).find(movie => movie && typeof movie === 'object');
  const video = allowedURL(trailer?.mp4?.max || trailer?.mp4?.['480'] || trailer?.hls_h264,
    /^(?:[\w-]+\.)*steamstatic\.com$/i, /^\//);
  return {
    id, title, genres: category, modes, releaseYear, image,
    age: Number.isInteger(age) && age > 0 && age <= 21 ? age : null,
    free: row.genres.includes('Free to Play') || row.genres.includes('Free To Play') ? true : row.price > 0 ? false : null,
    developer: Array.isArray(row.developers) ? row.developers.slice(0, 2).join(', ').slice(0, 100) : '',
    rating: {positive: row.positive, negative: row.negative, total, percent: Math.round(row.positive / total * 1000) / 10},
    metacritic: critic,
    ...(video ? {movie: {name: 'Ролик Steam', url: video}} : {}),
  };
}

const rows = [];
for (const group of ['critics', 'popular']) {
  const target = group === 'critics' ? 580 : 975;
  const slices = Object.entries(snapshot.slices).filter(([key]) => key.startsWith(group + '-'));
  for (const [, slice] of slices) {
    for (const row of slice) {
      if (rows.length >= target) break;
      const game = clean(row);
      if (!game) continue;
      usedIds.add(game.id);
      usedTitles.add(titleKey(game.title));
      rows.push(game);
    }
  }
}
if (rows.length + baseGames.length < 1000) throw Error('Недостаточно прошедших проверку строк для 1000 игр');
await fs.writeFile(output, JSON.stringify({dataset: snapshot.dataset, accessedAt: snapshot.accessedAt, games: rows}) + '\n');
console.log(JSON.stringify({handCurated: baseGames.length, fromSnapshot: rows.length, total: baseGames.length + rows.length, criticScores: rows.filter(row => row.metacritic).length}));
