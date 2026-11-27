import {defaultPrefs, moods, suggestGames} from './engine.mjs';

export function localDay(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function dailyPick(games, prefs, owned) {
  const result = suggestGames(games, prefs, owned);
  if (result.approximate) return result.games[0];
  return result.games.sort((a, b) => (b.match ?? 0) - (a.match ?? 0) ||
      (b.overall?.exact ?? -1) - (a.overall?.exact ?? -1) ||
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || a.id - b.id)[0] ?? null;
}

const timeOptions = [[0, 'Без ограничений'], [20, 'До 20 минут'], [30, 'До 30 минут'], [60, 'До часа'], [90, 'До полутора часов']];
const modeOptions = [['', 'Неважно'], ['solo', 'Один'], ['friends', 'С друзьями']];
const hardwareOptions = [['any', 'Любой'], ['low', 'Слабый ПК']];
const options = (values, selected) => values.map(([value, label]) =>
  `<option value="${value}"${String(value) === String(selected) ? ' selected' : ''}>${label}</option>`).join('');

export function dailyPreferences(form, previous = defaultPrefs) {
  const mood = form.get('mood');
  const time = Number(form.get('time'));
  const mode = form.get('mode');
  const hardware = form.get('hardware');
  if (!Object.hasOwn(moods, mood) || !timeOptions.some(([value]) => value === time) ||
      !modeOptions.some(([value]) => value === mode) || !hardwareOptions.some(([value]) => value === hardware)) return null;
  return {...previous, mood, time, mode, hardware, free: form.has('free')};
}

export function dailyForm(prefs, icon, noMatch = false) {
  const moodIcons = {story:'book-open', relax:'leaf', challenge:'swords', social:'users', explore:'map'};
  const moodLabels = {story:'За историей', relax:'Расслабиться', challenge:'Испытать себя', social:'С друзьями', explore:'Исследовать'};
  return `<div class="modal-pad daily-dialog">
    <h2 id="daily-title" tabindex="-1">Твоя игра дня</h2>
    <p>Выбери, чего хочется сегодня. Подберём одну игру под твой вечер.</p>
    <form id="daily-form">
      ${noMatch ? '<p class="notice" role="status">В каталоге нет игр, которые проходят выбранные условия цены и возраста. Измени условия, чтобы подобрать игру.</p>' : ''}
      <fieldset class="daily-moods">
        <legend>Какое настроение?</legend>
        <div class="daily-mood-options">${Object.keys(moods).map((mood, index) =>
          `<label class="daily-mood"><input type="radio" name="mood" value="${mood}"${index === 0 ? ' required' : ''}${prefs.mood === mood ? ' checked' : ''}><span>${icon(moodIcons[mood])}${moodLabels[mood]}</span></label>`).join('')}</div>
      </fieldset>
      <div class="daily-fields">
        <label class="field">Сколько времени?<select name="time">${options(timeOptions, prefs.time)}</select></label>
        <label class="field">С кем играешь?<select name="mode">${options(modeOptions, prefs.mode)}</select></label>
        <label class="field">Компьютер<select name="hardware">${options(hardwareOptions, prefs.hardware)}</select></label>
      </div>
      <label class="check daily-free"><input type="checkbox" name="free"${prefs.free ? ' checked' : ''}>Только бесплатные</label>
      <div class="daily-actions">
        <button class="btn primary">Подобрать игру ${icon('arrow-up-right')}</button>
        <button type="button" class="btn" data-action="close">Пропустить</button>
      </div>
    </form>
  </div>`;
}
