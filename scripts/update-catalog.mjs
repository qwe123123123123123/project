import fs from 'node:fs/promises';
import {baseGames} from '../dist/engine.mjs';
import {reviewURL, parseReviewSummary} from './steam-reviews.mjs';

const dir = new URL('../dist/', import.meta.url);
const file = new URL('steam-data.json', dir);
const temp = new URL('steam-data.json.tmp', dir);
const data = new Map(JSON.parse(await fs.readFile(file, 'utf8')).map(game => [game.id, game]));
const refresh = process.argv.includes('--refresh');
let lastRequest = 0;

class SteamLimit extends Error {}

async function request(url, image = false) {
  const pause = 1800 - (Date.now() - lastRequest);
  if (pause > 0) await new Promise(resolve => setTimeout(resolve, pause));
  lastRequest = Date.now();
  const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
  if (response.status === 429) {
    throw new SteamLimit('Steam ограничил запросы. Retry-After: ' + (response.headers.get('retry-after') || 'не указан'));
  }
  if (!response.ok) throw Error('HTTP ' + response.status + ' · ' + new URL(url).hostname);
  if (image) {
    if (!response.headers.get('content-type')?.startsWith('image/')) throw Error('Ответ сервера не является изображением');
    return new Uint8Array(await response.arrayBuffer());
  }
  const body = await response.text();
  if (!body.trimStart().startsWith('{')) throw new SteamLimit('Steam прислал страницу вместо данных. Попробуйте позже.');
  return JSON.parse(body);
}

async function persist() {
  const entries = baseGames.map(game => data.get(game.id)).filter(Boolean);
  await fs.writeFile(temp, JSON.stringify(entries, null, 2) + '\n');
  await fs.rename(temp, file);
}

function metascore(details) {
  const critic = details.metacritic;
  if (!Number.isInteger(critic?.score) || critic.score < 1 || critic.score > 100) return null;
  try {
    const url = new URL(critic.url);
    if (!['www.metacritic.com', 'metacritic.com'].includes(url.hostname)) return null;
    url.protocol = 'https:';
    return {score: critic.score, url: url.href, platform: 'PC', checkedAt: new Date().toISOString()};
  } catch {
    return null;
  }
}

let failures = 0;
console.log('Скачиваем обложки, сводки Steam и оценки Metacritic. Прогресс сохраняется после каждой игры.');
for (const [index, game] of baseGames.entries()) {
  try {
    let entry = data.get(game.id);
    let changed = false;
    if (!entry || refresh || !Object.hasOwn(entry, 'metacritic')) {
      const url = 'https://store.steampowered.com/api/appdetails?appids=' + game.id + '&l=english&cc=us';
      const details = (await request(url))[game.id]?.data;
      if (details?.type !== 'game') throw Error('Эта карточка игры недоступна в магазине Steam');
      if (!entry) {
        const image = 'assets/' + game.id + '.jpg';
        await fs.writeFile(new URL(image, dir), await request(details.header_image, true));
        const movie = details.movies?.find(item => /gameplay/i.test(item.name)) || details.movies?.[0];
        const videoUrl = movie?.mp4?.max || movie?.mp4?.['480'] || movie?.hls_h264;
        entry = {
          id: game.id, name: details.name, image,
          movie: videoUrl ? {name: movie.name, url: videoUrl, poster: movie.thumbnail} : null,
          year: details.release_date?.date, platforms: details.platforms,
          comingSoon: details.release_date?.coming_soon,
          developer: details.developers?.join(', '), free: details.is_free,
          source: 'https://store.steampowered.com/app/' + game.id + '/',
        };
      }
      entry.releaseYear = Number(String(entry.year).match(/\d{4}/)?.[0]) || null;
      entry.metacritic = metascore(details);
      data.set(game.id, entry);
      changed = true;
    }
    if (changed) await persist();
    const stale = Date.now() - Date.parse(entry.rating?.updatedAt) >= 86400000;
    if (!entry.rating || (refresh && stale)) {
      const source = reviewURL(game.id);
      entry.rating = {...parseReviewSummary(await request(source)), updatedAt: new Date().toISOString(), source};
      await persist();
      changed = true;
    }
    if (changed) {
      console.log(`[${index + 1}/${baseGames.length}] ${game.title} · Steam ${entry.rating.percent ?? '—'}% · Metacritic ${entry.metacritic?.score ?? '—'}`);
    }
  } catch (error) {
    failures++;
    console.error(game.id, game.title, error.message, error.cause?.code || '');
    if (error instanceof SteamLimit || error.cause?.code === 'EACCES') break;
  }
}
const entries = [...data.values()];
console.log(JSON.stringify({games: entries.length, steam: entries.filter(game => game.rating).length, metacritic: entries.filter(game => game.metacritic).length, failures}));
if (failures) process.exitCode = 1;
