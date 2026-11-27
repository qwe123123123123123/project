import {rankGames, periodYears} from './scoring.mjs';
import {scoreBadge, topBadge, TOP_MIN_STEAM_REVIEWS} from './ratings.mjs';
import {pageOf, pageControls} from './pager.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const number = new Intl.NumberFormat('ru-RU');
const periods = {
  all: ['За всё время', 'Лучшие игры за всё время'],
  ten: ['Последние 10 лет', 'Лучшие игры за последние 10 лет'],
  five: ['Последние 5 лет', 'Лучшие игры за последние 5 лет'],
  year: ['Этот год', 'Лучшие игры этого года'],
};
export const reviewSteps = [0, 100, 1000, 10000, 50000, 100000, 500000, 1000000];
export const currentYear = new Date().getFullYear();
export const minYear = 1998;
export const defaultRanking = {
  from: minYear, to: currentYear, minRating: 1, maxRating: 100,
  minReviews: TOP_MIN_STEAM_REVIEWS, genre: '', sort: 'rating', preset: 'all',
};

function rankingRow(game, place) {
  return `<article class="rank-row">
    <span class="rank-place">${place}</span>
    <button class="rank-cover" data-game="${game.id}" aria-label="Открыть ${escape(game.title)}">
      <img src="${escape(game.image)}" loading="lazy" alt="">
    </button>
    <div class="rank-description">
      <h3><button data-game="${game.id}">${escape(game.title)}</button></h3>
      <p>${game.releaseYear} · ${game.genres.join(' · ')}</p>
      ${topBadge(game)}
    </div>
    <div class="rank-rating">${scoreBadge(game, false)}<small>${number.format(game.rating.total)} отзывов Steam</small></div>
  </article>`;
}

export function rankingResults(games, filters, requestedPage = 1) {
  const list = rankGames(games, filters);
  const page = pageOf(list, requestedPage);
  return `<div class="ranking-result-head">
    <h2>${periods[filters.preset]?.[1] ?? 'Лучшие игры за выбранный период'}</h2>
    <span>${number.format(list.length)} из ${number.format(games.length)} игр каталога</span>
  </div>
  <p class="ranking-source">${filters.from}–${filters.to} · Оценка NEXTPLAY / 100</p>
  ${list.length
    ? `<div class="ranking-list">${page.items.map((game, index) => rankingRow(game, page.start + index + 1)).join('')}</div>${pageControls('rankings', page)}`
    : '<div class="empty"><h3>Подходящих игр нет</h3><p>Расширь диапазон годов или снизь порог оценки и числа отзывов.</p><button class="btn" data-action="reset-rankings">Сбросить фильтры</button></div>'}
  <details class="ranking-method">
    <summary>Как составляется рейтинг</summary>
    <p>60% оценки — доля положительных отзывов Steam, 40% — оценка критиков для версии ПК. Используем Metacritic или проверенный обзор PC Gamer. Если есть оценки из обоих источников, берём Metacritic, чтобы один обзор не влиял на результат дважды.</p>
    <p>Игры без оценки критиков находятся в каталоге. Значок «Топ‑50» показывает место среди игр NEXTPLAY за всё время с минимумом ${number.format(TOP_MIN_STEAM_REVIEWS)} отзывов Steam. При равных точных баллах выше игра с большим числом отзывов.</p>
    <p>Для большей части игр используется снимок Steam Games Dataset. Данные обновляются пакетами, дата и источник показаны в карточке.</p>
    <a href="https://huggingface.co/datasets/FronkonGames/steam-games-dataset" target="_blank" rel="noopener">Steam Games Dataset ↗</a>
  </details>`;
}

const range = (label, key, min, max, value) => `<div class="rank-range">
  <label for="rank-${key}">${label}</label>
  <div class="range-pair">
    <input id="rank-${key}" type="range" data-rank-field="${key}" min="${min}" max="${max}" step="1" value="${value}">
    <input type="number" aria-label="${label}, точное значение" data-rank-field="${key}" min="${min}" max="${max}" step="1" value="${value}">
  </div>
</div>`;

export function renderRankings(games, filters, genres, page) {
  return `<div class="page-head"><h1>Лучшие игры</h1><p>Оценки игроков Steam и профессиональных изданий</p></div>
  <div class="ranking-presets chips">${Object.entries(periods).map(([key, [label]]) => `<button class="chip ${filters.preset === key ? 'active' : ''}" data-period="${key}" aria-pressed="${filters.preset === key}">${label}</button>`).join('')}</div>
  <div class="ranking-layout">
    <aside class="panel ranking-filters">
      <h2>Фильтры</h2>
      <fieldset><legend>Год релиза</legend>
        ${range('С года', 'from', minYear, currentYear, filters.from)}
        ${range('По год', 'to', minYear, currentYear, filters.to)}
      </fieldset>
      <fieldset><legend>Оценка NEXTPLAY</legend>
        ${range('От', 'minRating', 1, 100, filters.minRating)}
        ${range('До', 'maxRating', 1, 100, filters.maxRating)}
      </fieldset>
      <label class="field">Популярность: число отзывов
        <input type="range" id="review-threshold" min="0" max="${reviewSteps.length - 1}" step="1" value="${reviewSteps.indexOf(filters.minReviews)}" aria-label="Минимум отзывов">
        <output id="review-threshold-label">${filters.minReviews ? 'Не менее ' + number.format(filters.minReviews) : 'Любое количество'}</output>
      </label>
      <label class="field">Жанр<select id="rank-genre"><option value="">Все жанры</option>${genres.map(genre => `<option ${filters.genre === genre ? 'selected' : ''}>${genre}</option>`).join('')}</select></label>
      <label class="field">Сортировка<select id="rank-sort">
        <option value="rating" ${filters.sort === 'rating' ? 'selected' : ''}>По оценке NEXTPLAY</option>
        <option value="popular" ${filters.sort === 'popular' ? 'selected' : ''}>По числу отзывов</option>
        <option value="newest" ${filters.sort === 'newest' ? 'selected' : ''}>Сначала новые</option>
      </select></label>
      <button class="text-button" data-action="reset-rankings">Сбросить фильтры</button>
    </aside>
    <section id="ranking-results">${rankingResults(games, filters, page)}</section>
  </div>`;
}

export function setPeriod(filters, key) {
  const [from, to] = periodYears(key, currentYear, minYear);
  return {...filters, from, to, preset: key};
}
