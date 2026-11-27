export const STEAM_WEIGHT = 0.60;
export const CRITIC_WEIGHT = 1 - STEAM_WEIGHT;
export const MIN_STEAM_REVIEWS = 100;
export const TOP_MIN_STEAM_REVIEWS = 1000;

const number = new Intl.NumberFormat('ru-RU');
const date = new Intl.DateTimeFormat('ru-RU');

export function nextplayScore(steam, critic) {
  if (!Number.isFinite(steam?.percent) || steam.percent < 0 || steam.percent > 100 ||
      !Number.isInteger(steam.total) || steam.total < MIN_STEAM_REVIEWS ||
      !Number.isFinite(critic?.score) || critic.score < 1 || critic.score > 100) return null;
  const exact = STEAM_WEIGHT * steam.percent + CRITIC_WEIGHT * critic.score;
  return {exact, value: Math.max(1, Math.round(exact))};
}

export function ratingTone(value) {
  if (value >= 95) return 'elite';
  if (value >= 80) return 'good';
  if (value >= 60) return 'fair';
  return 'poor';
}

export function compareRated(a, b) {
  return b.overall.exact - a.overall.exact || b.rating.total - a.rating.total || a.id - b.id;
}

export function assignTopRanks(games, currentYear) {
  const eligible = games.filter(game => game.overall && game.rating.total >= TOP_MIN_STEAM_REVIEWS &&
    !game.comingSoon && game.releaseYear && game.releaseYear <= currentYear).sort(compareRated);
  const cutoff = eligible.length > 50 ? 50 : Math.min(10, eligible.length);
  return new Map(eligible.slice(0, cutoff).map((game, index) => [game.id, {place: index + 1, cutoff}]));
}

export function scoreBadge(game, showLabel = true) {
  if (!game.overall) return '<span class="score-pending">Оценка собирается</span>';
  const {value} = game.overall;
  return `<span class="score-badge score-${ratingTone(value)}">${showLabel ? '<span>Оценка NEXTPLAY:</span> ' : ''}<strong>${value}<span>/100</span></strong></span>`;
}

export function topBadge(game) {
  const rank = game.topRank;
  if (!rank) return '';
  return `<span class="top-sticker" aria-label="Место ${rank.place} в рейтинге каталога">№${rank.place} · Топ-${rank.cutoff}</span>`;
}

const formatDate = value => Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : '';

export function ratingBreakdown(game) {
  const player = game.rating;
  const critic = game.critic;
  const playerDate = formatDate(player?.updatedAt);
  const snapshotDate = formatDate(game.snapshotAccessedAt);
  return `<section class="score-details" aria-label="Оценка NEXTPLAY">
    <div class="score-detail-head">${scoreBadge(game)}${topBadge(game)}</div>
    <details>
      <summary>Источники оценки и обзоры</summary>
      <dl class="rating-sources">
        <div><dt><a href="${game.source}#app_reviews_hash" target="_blank" rel="noopener">Steam · отзывы игроков ↗</a></dt>
          <dd>${player?.total ? `${number.format(player.percent)}% рекомендуют · ${number.format(player.total)} отзывов${playerDate ? ' · ' + playerDate : ''}` : 'Сводка ещё не загружена'}${game.id === 730 ? ' · включая прежнюю версию CS:GO' : ''}</dd></div>
        <div><dt>${critic ? `<a href="${critic.url}" target="_blank" rel="noopener">${critic.name} · критики ↗</a>` : 'Оценка критиков'}</dt>
          <dd>${critic ? `${critic.score}/100 · ${critic.platform}` : 'Для этого издания ещё нет проверенного источника'}</dd></div>
      </dl>
      ${game.snapshotURL ? `<p><a href="${game.snapshotURL}" target="_blank" rel="noopener">Снимок Steam Games Dataset ↗</a>${snapshotDate ? ' · получен ' + snapshotDate : ''}</p>` : ''}
      <p>Оценка NEXTPLAY складывается из 60% доли рекомендаций в Steam и 40% оценки критиков. Нужно минимум ${MIN_STEAM_REVIEWS} отзывов Steam.</p>
    </details>
  </section>`;
}
