import fs from 'node:fs/promises';

const dataset = 'FronkonGames/steam-games-dataset';
const endpoint = 'https://datasets-server.huggingface.co/filter';
const scratch = new URL('../.cache/', import.meta.url);
const file = new URL('steam-snapshot.json', scratch);
const temporaryFile = new URL('steam-snapshot.json.tmp', scratch);
await fs.mkdir(scratch, {recursive: true});
let previous;
if (!process.argv.includes('--refresh')) {
  try { previous = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const snapshot = previous ?? {accessedAt: new Date().toISOString(), dataset, slices: {}};
const selection = [
  {name: 'critics', where: '"positive">=500 AND "metacritic_score">0 AND "windows"=true', pages: 8},
  {name: 'popular', where: '"positive">=500 AND "windows"=true', pages: 14},
];
const fields = ['appID', 'name', 'release_date', 'required_age', 'price', 'positive', 'negative',
  'windows', 'mac', 'linux', 'header_image', 'metacritic_score', 'metacritic_url', 'developers',
  'genres', 'categories', 'tags', 'movies'];

for (const group of selection) {
  for (let page = 0; page < group.pages; page++) {
    const key = group.name + '-' + page;
    if (snapshot.slices[key]) continue;
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      dataset, config: 'default', split: 'train', where: group.where, orderby: '"positive" DESC',
      offset: String(page * 100), length: '100',
    });
    let response;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch(url, {signal: AbortSignal.timeout(60000)});
        if (response.ok || response.status < 500 || attempt === 3) break;
      } catch (error) {
        if (attempt === 3 || error.cause?.code === 'EACCES') throw error;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
    if (!response?.ok) throw Error(key + ': ' + response?.status + ' ' + (await response?.text())?.slice(0, 400));
    const payload = await response.json();
    if (!Array.isArray(payload.rows)) throw Error('Не получен список игр');
    snapshot.slices[key] = payload.rows.map(({row}) => Object.fromEntries(fields.map(field => [field, row[field]])));
    await fs.writeFile(temporaryFile, JSON.stringify(snapshot));
    await fs.rename(temporaryFile, file);
    console.log(key, snapshot.slices[key].length, 'filtered total', payload.num_rows_total);
    if (snapshot.slices[key].length < 100) break;
  }
}
