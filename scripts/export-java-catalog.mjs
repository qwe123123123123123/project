import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {assembleCatalog} from '../dist/catalog-data.mjs';
import {experience} from '../dist/scoring.mjs';

const readCatalog = async name => JSON.parse(await readFile(new URL('../dist/' + name, import.meta.url), 'utf8'));
const [store, snapshot] = await Promise.all([readCatalog('steam-data.json'), readCatalog('bulk-catalog.json')]);
const games = assembleCatalog(store, snapshot, new Date().getFullYear());
const output = resolve(process.argv[2]);
const rows = games.map(game => [
  game.id, Boolean(game.free), Boolean(game.comingSoon), game.age, game.minutes,
  game.hardware, game.genres.join('|'), game.modes.join('|'),
  experience(game).join(','), game.overall?.exact ?? -1,
].join('\t'));

await mkdir(dirname(output), {recursive: true});
await writeFile(output, rows.join('\n') + '\n', 'utf8');
