import {parseImport,importMarkup,importResultMarkup} from './importer.mjs';
import {currentYear,defaultRanking,renderRankings,rankingResults,reviewSteps,setPeriod} from './rankings.mjs';
import {assembleCatalog, coverFallback} from './catalog-data.mjs';
import {scoreBadge, topBadge, ratingBreakdown} from './ratings.mjs';
import {localDay, dailyForm, dailyPreferences} from './daily.mjs';
import {getRecommendations, hasJavaServer} from './recommendation-api.mjs';
import {tasteSignals} from './taste.mjs';
import {pageOf, pageControls} from './pager.mjs';
import {genres,moods,defaultPrefs,suggestGames} from './engine.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rankingFilters={...defaultRanking};
const pages={catalog:1, discover:1, library:1, rankings:1};
const count = value => new Intl.NumberFormat('ru-RU').format(value);
const KEY='nextplay-profile-v1';
const fresh=()=>({name:'Игрок',bio:'Люблю находить новые миры',wishlist:[],owned:[],taste:{},reviews:[],topics:[],replies:{},daily:{},prefs:{...defaultPrefs,genres:[]}});
let state=fresh(),storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved.name==='string')state={...fresh(),...saved,prefs:{...defaultPrefs,...saved.prefs}};}catch{storageOK=false;}
let games=[],route='home',query='',genre='',category='all',libraryTab='wishlist',hls,installPrompt,importPending=[];
const icon=name=>`<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><use href="icons.svg#${name}"></use></svg>`;
const icons={story:'book-open',relax:'leaf',challenge:'swords',social:'users',explore:'map'};
const moodShort={story:'За историей',relax:'Расслабиться',challenge:'Принять вызов',social:'С друзьями',explore:'Исследовать'};
const labels={home:'Обзор',discover:'Подбор игр',catalog:'Каталог игр',rankings:'Лучшие игры',library:'Моя библиотека',profile:'Мой профиль',community:'Сообщество',about:'О проекте'};
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3600);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storageOK=false;toast('Не удалось сохранить: хранилище браузера недоступно или заполнено.');return false;}}
function setProfileUI(){$('#sidebar-name').textContent=state.name;document.querySelectorAll('.avatar').forEach(e=>e.textContent=state.name.charAt(0).toUpperCase());}
function go(to){if(location.hash===`#${to}`)render();else location.hash=to;}
function head(eyebrow,title,description){return `<div class="page-head"><h1>${title}</h1>${description?`<p>${description}</p>`:""}</div>`;}
function empty(title,text,action='quiz',button='Подобрать игру'){return `<div class="empty"><h3>${title}</h3><p>${text}</p><button class="btn primary" data-action="${action}">${button} ↗</button></div>`;}
function adjustmentNote(adjustments, heading='Что стоит учесть') {
  if (!Array.isArray(adjustments) || !adjustments.length) return '';
  return `<div class="fit-note"><strong>${heading}</strong><p>${adjustments.map(esc).join(' · ')}</p></div>`;
}

function recommendationPrefs(prefs = state.prefs) {
  return {...prefs, taste:tasteSignals(state)};
}

function tasteButtons(id) {
  const vote = state.taste?.[id];
  return `<div class="taste-actions" role="group" aria-label="Отзыв о рекомендации">
    <button type="button" class="chip" data-taste="1" data-taste-id="${id}" aria-pressed="${vote===1}">Мне нравится</button>
    <button type="button" class="chip" data-taste="-1" data-taste-id="${id}" aria-pressed="${vote===-1}">Не мой вкус</button>
  </div>`;
}

function card(game, explain=false) {
  const saved = state.wishlist.includes(game.id);
  const metadata = [game.free ? 'Бесплатно' : game.age ? game.age + '+' : '', game.minutes ? 'от ' + game.minutes + ' мин' : ''].filter(Boolean);
  const why = explain && game.match != null
    ? `<details class="match-details"><summary>Почему ${game.match}%?</summary><p class="reason">${esc(game.reasons.join(' · '))}</p>${game.breakdown.map(item => `<div class="match-row"><span>${item.label}</span><b>${item.value}%</b></div>`).join('')}</details>` : '';
  return `<article class="game-card">
    <div class="card-picture">
      <button class="cover" data-game="${game.id}" aria-label="Открыть ${esc(game.title)}">
        <img src="${esc(game.image)}" alt="" loading="lazy">
        ${game.match == null ? '' : `<span class="badge">${game.match}% ${game.adjustments?.length ? 'по вкусу' : 'совпадение'}</span>`}
      </button>
      ${topBadge(game)}
    </div>
    <div class="card-body">
      <h3><button data-game="${game.id}">${esc(game.title)}</button></h3>
      <p class="card-genre">${game.genres.join(' · ')}</p>
      <div class="card-rating">${scoreBadge(game)}</div>
      ${adjustmentNote(game.adjustments)}
      ${why}
      ${explain ? tasteButtons(game.id) : ''}
      <div class="card-bottom"><span>${metadata.join(' · ')}</span>
        <button class="${saved ? 'saved' : ''}" data-save="${game.id}" aria-label="${saved ? 'Убрать из' : 'Добавить в'} избранное ${esc(game.title)}" aria-pressed="${saved}">${icon(saved ? 'check' : 'plus')}</button>
      </div>
    </div>
  </article>`;
}
function displayGrid(list, kind, emptyMarkup, explain=false) {
  const page = pageOf(list, pages[kind]);
  return `<div class="game-grid">${page.items.length ? page.items.map(game => card(game, explain)).join('') : emptyMarkup}</div>${pageControls(kind, page)}`;
}

function home() {
  const daily = state.daily?.day === localDay() ? state.daily : null;
  const personal = games.find(game => game.id === daily?.gameId);
  const approximate = personal && daily.adjustments?.length;
  const featured = personal || games.find(game => game.id === 1091500);
  const selected = [1245620,1086940,413150,1174180].map(id => games.find(game => game.id === id));
  const hero = featured.id === 1091500 ? 'assets/hero.jpg' : (featured.hero || featured.image);
  const line = personal ? "По твоим ответам · " + personal.genres.join(' · ') : 'Сюжетная RPG в Найт-Сити. Взламывай системы, выбирай союзников и ищи способ выжить.';
  return `<section class="welcome"><h1>Во что поиграть</h1></section>
    <section class="hero-layout"><div class="hero ${personal ? 'hero-personal' : ''}"><img src="${esc(hero)}" alt="" fetchpriority="high">
      <div class="hero-content">
        <span class="hero-label">${personal ? approximate ? 'Ближайшая игра дня' : 'Твоя игра дня' : 'Выбор редакции'}</span>
        <h2>${esc(featured.title)}</h2>
        <p>${esc(line)}</p>
        ${personal && Number.isFinite(daily.match) ? `<p class="daily-hero-match">${daily.match}% ${approximate ? 'по вкусу' : 'совпадение'}</p>` : ''}
        <div class="hero-actions">
          <button class="btn primary" data-game="${featured.id}">Об игре ${icon('arrow-up-right')}</button>
          ${featured.movie?.url && !personal ? `<button class="btn ghost" data-video="${featured.id}">${icon('play')} Смотреть ролик</button>` : ''}
          ${personal ? `<button class="btn ghost" data-action="daily">Изменить ответы</button>` : '<button class="btn ghost hero-daily-launch" data-action="daily">Подобрать игру дня</button>'}
        </div>
      </div></div>
      <aside class="daily-card"><div class="daily-card-content">
        <h2>Твоя игра дня</h2>
        <p>Настроение, время и компания — три подсказки для выбора игры.</p>
        <button class="btn primary" data-action="daily">${personal ? 'Подобрать заново' : 'Подобрать игру дня'} ${icon('arrow-up-right')}</button>
      </div></aside>
    </section>
    ${personal ? adjustmentNote(daily.adjustments, 'Условия для игры дня') : ''}
    <section><div class="section-heading"><h2>Чего хочется?</h2></div>
      <div class="mood-row">${Object.keys(moods).map(key => `<button class="mood" data-mood="${key}">${icon(icons[key])}${moodShort[key]}</button>`).join('')}</div></section>
    <section><div class="section-heading"><h2>Стоит попробовать</h2><a href="#catalog">Все ${count(games.length)} игр ${icon('arrow-up-right')}</a></div>
      <div class="game-grid">${selected.map(game => card(game)).join('')}</div></section>
    <section class="lower-banner"><div><h3>Добавь игры из Steam</h3><p>По выбранным файлам библиотеки или списку названий</p></div><button class="btn" data-action="import">Импортировать ${icon('folder-open')}</button></section>`;
}
function catalog(){const filtered=games.filter(g=>(!query||[g.title,...g.aliases].join(' ').toLowerCase().includes(query.toLowerCase()))&&(!genre||g.genres.includes(genre))&&(category!=='free'||g.free)&&(category!=='low'||g.hardware==='low')&&(category!=='online'||g.modes.some(m=>m!=='solo')));return head('20 ИГР · БЕЗ БЕСКОНЕЧНОГО СКРОЛЛА','Каталог игр',`${games.length} игр: от сетевых шутеров до спокойных симуляторов`)+`<div class="filters"><input id="catalog-search" value="${esc(query)}" placeholder="Поиск по названию" aria-label="Поиск в каталоге"><select id="genre-filter" aria-label="Жанр"><option value="">Все жанры</option>${genres.map(g=>`<option ${genre===g?'selected':''}>${g}</option>`).join('')}</select><select id="category-filter" aria-label="Подборка"><option value="all">Все игры</option><option value="free" ${category==='free'?'selected':''}>Бесплатные</option><option value="low" ${category==='low'?'selected':''}>Для слабого ПК</option><option value="online" ${category==='online'?'selected':''}>С друзьями</option></select></div><p class="info-note" style="margin:0 0 15px">Найдено ${count(filtered.length)} из ${count(games.length)}</p>${displayGrid(filtered, 'catalog', empty('Такой игры пока нет','Попробуй другое название или сбрось фильтры.','reset-filters','Сбросить фильтры'))}`;}
function selectOptions(options,value){return options.map(([v,t])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${t}</option>`).join('');}
function discover(){const p=state.prefs;return head('ТВОЙ ВКУС + ТВОЙ СЕГОДНЯШНИЙ ДЕНЬ','Подбор игр','Укажи предпочтения — получи подборку с объяснениями')+`<div class="quiz-layout"><form id="quiz-form" class="panel quiz-panel"><h3>Настройки подбора</h3><p class="info-note">Подбор учится на избранном, оценках в отзывах и твоих ответах под играми.</p>${Object.keys(state.taste ?? {}).length ? '<button type="button" class="text-button" data-action="clear-taste">Сбросить оценки подбора</button>' : ''}<label class="field">Чего хочется?<select name="mood">${selectOptions([['','Любое настроение'],...Object.entries(moods)],p.mood)}</select></label><div class="form-grid"><label class="field">Времени на сессию<select name="time">${selectOptions([[0,'Без ограничений'],[20,'До 20 минут'],[30,'До 30 минут'],[60,'До часа'],[90,'До полутора часов']],p.time)}</select></label><label class="field">С кем играем?<select name="mode">${selectOptions([['','Неважно'],['solo','Один'],['friends','С друзьями']],p.mode)}</select></label><label class="field">Компьютер<select name="hardware">${selectOptions([['any','Любой'],['low','Слабый ПК']],p.hardware)}</select></label><label class="field">Возрастной фильтр<select name="age">${selectOptions([[99,'Все игры'],[16,'До 16+'],[12,'До 12+'],[7,'До 7+']],p.age)}</select></label></div><div class="field">Любимые жанры<div class="chips">${genres.map(g=>`<button type="button" class="chip ${p.genres.includes(g)?'active':''}" data-prefgenre="${g}" aria-pressed="${p.genres.includes(g)}">${g}</button>`).join('')}</div></div><label class="check"><input type="checkbox" name="free" ${p.free?'checked':''}>Только бесплатные</label><label class="check" style="margin-top:13px"><input type="checkbox" name="hideOwned" ${p.hideOwned?'checked':''}>Скрыть игры из моей библиотеки</label><button class="btn primary">Показать подборку</button><button type="button" class="text-button" data-action="reset-prefs">Сбросить настройки</button><p class="info-note">Длительность сессии и требования к ПК — ориентиры редакции. Точные системные требования смотрите в Steam.</p></form><div id="discover-results" class="quiz-results" aria-busy="${hasJavaServer}">${hasJavaServer ? '<p role="status">Подбираем игры…</p>' : discoverResults(suggestGames(games,recommendationPrefs(p),state.owned))}</div></div>`;}
function discoverResults({games:results, approximate}) {
  return `<div class="result-head"><h3>${approximate ? 'Ближайшие варианты' : 'Подходящие игры'}</h3><span>${results.length} ${results.length===1?'игра':'игр'}</span></div>${approximate ? '<div class="fit-note"><p>На карточках указано, какие условия отличаются от выбранных.</p></div>' : ''}${displayGrid(results, 'discover', empty('Нет игр с такой ценой и возрастом','Измени ограничения цены или возраста, чтобы продолжить.','reset-prefs','Сбросить ограничения'), true)}<p class="info-note">Процент — индекс совпадения по настроению, жанрам и библиотеке, а не вероятность, что игра понравится. Общую оценку игры он не заменяет. <a href="#about" class="lime">Как устроен подбор ↗</a></p>`;
}

async function loadDiscoverResults(target) {
  const results = await getRecommendations(games, recommendationPrefs(), state.owned);
  if (!target.isConnected) return;
  target.innerHTML = discoverResults(results);
  target.setAttribute('aria-busy', 'false');
}

function library(){const ids=state[libraryTab],list=games.filter(g=>ids.includes(g.id));return head('ЛИЧНАЯ КОЛЛЕКЦИЯ','Моя библиотека','Игры, которые уже есть, и планы на потом')+`<div class="section-heading"><div class="chips"><button class="chip ${libraryTab==='wishlist'?'active':''}" data-library="wishlist">Хочу поиграть · ${state.wishlist.length}</button><button class="chip ${libraryTab==='owned'?'active':''}" data-library="owned">Уже есть · ${state.owned.length}</button></div><button class="btn small" data-action="import">+ Импорт</button></div>${displayGrid(list, 'library', empty('Здесь начинается твоя коллекция',libraryTab==='owned'?'Импортируй список или отметь «Уже есть» в карточке игры.':'Сохрани первую игру из каталога.','catalog','Открыть каталог'))}<p class="info-note">Резервная копия коллекции — в профиле</p>`;}
function profile(){const counts=genres.map(g=>[g,games.filter(x=>state.owned.includes(x.id)&&x.genres.includes(g)).length]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]);return `<div class="profile-hero"><span class="avatar">${esc(state.name[0].toUpperCase())}</span><div><h1>${esc(state.name)}</h1><p>${esc(state.bio)}</p></div><button class="btn small" data-action="import">+ Добавить игры</button></div><div class="stats"><div class="stat"><b>${state.owned.length}</b><span>Игр в библиотеке</span></div><div class="stat"><b>${state.wishlist.length}</b><span>Хочу попробовать</span></div><div class="stat"><b>${state.reviews.length}</b><span>Моих отзывов</span></div></div><div class="profile-columns"><form id="profile-form" class="panel"><h3>Знакомимся ближе</h3><label class="field">Как тебя называть?<input name="name" value="${esc(state.name)}" maxlength="32" required></label><label class="field" style="margin-top:17px">Пара слов о себе<textarea name="bio" maxlength="180">${esc(state.bio)}</textarea></label><button class="btn primary">Сохранить профиль</button><p class="info-note">Сохраняется на этом устройстве</p></form><div class="panel"><h3>Жанры в библиотеке</h3>${counts.length?counts.map(([g,n])=>`<div class="taste-line"><span>${g}</span><span>${n} игр</span></div><div class="taste-bar"><i style="width:${n/state.owned.length*100}%"></i></div>`).join(''):'<p>Импортируй библиотеку, и здесь появятся твои любимые жанры.</p>'}<div class="inline-actions"><button class="btn small" data-action="export">↓ Скачать профиль</button><label class="btn small file-picker">↑ Восстановить<input type="file" id="restore-file" accept="application/json,.json" aria-label="Восстановить профиль из файла"></label></div><p class="info-note">Резервная копия содержит коллекцию, настройки, отзывы и обсуждения. Веб-версия и приложение хранят профили отдельно.</p></div></div>`;}
const seedTopics=[{id:'welcome',title:'Во что поиграть после тяжёлого дня?',body:'Какие игры вы выбираете, когда не хочется соревноваться или учить сложные правила? Поделитесь своими вариантами.',author:'Редакция NEXTPLAY',category:'Советы',seed:true},{id:'coop',title:'Ищем идеальный кооператив на двоих',body:'Portal 2 — для совместных головоломок, Terraria — для исследований, а Baldur’s Gate 3 — для длинного приключения. Что выберете вы и почему?',author:'Редакция NEXTPLAY',category:'Кооператив',seed:true},{id:'feedback',title:'Помогите сделать рекомендации точнее',body:'Какая рекомендация попала в ваш вкус, а какая совсем не подошла? Укажите выбранные настройки и причину — это поможет оценить алгоритм проекта.',author:'Редакция NEXTPLAY',category:'О проекте',seed:true}];
function community(){return head('ОБСУЖДАЕМ ТО, ВО ЧТО ИГРАЕМ','Сообщество','Обсуждения и советы по играм')+`<div class="notice">В этой версии темы и ответы видны только на этом устройстве</div><div class="section-heading"><h2>Обсуждения</h2><button class="btn primary" data-action="new-topic">+ Новая тема</button></div>${[...state.topics,...seedTopics].map(t=>`<button class="topic" data-topic="${esc(t.id)}"><span class="topic-content"><span class="tag">${esc(t.category)}</span><h3>${esc(t.title)}</h3><p>${esc(t.author)} · ${t.seed?'Стартовая тема':'Локальная тема'}</p></span><span class="topic-count">${(state.replies[t.id]||[]).length} ↗</span></button>`).join('')}`;}
function about(){return head('ИНДИВИДУАЛЬНЫЙ ПРОЕКТ · 10 КЛАСС','Выбирать проще, когда понимаешь почему.','NEXTPLAY исследует, как уменьшить время выбора игры с помощью объяснимых персональных рекомендаций.')+`<div class="about-columns"><div class="panel"><h3>Не ещё один общий рейтинг</h3><p>StopGame помогает читать обзоры, смотреть оценки и обсуждать игры. Наша точка приложения — конкретный игровой вечер: сколько есть времени, какой хочется темп и с кем планируется играть.</p><div class="step-line"><b>01</b><div><h3>Учитываем ограничения</h3><p>Время, режим, возрастной фильтр, бесплатность и слабый ПК.</p></div></div><div class="step-line"><b>02</b><div><h3>Считаем совпадения</h3><p>Настроение — 45 весовых единиц, жанры — 30, сходство с библиотекой — 25. Выраженность настроения задана редакцией по шкале, жанры сравниваются по пересечению, библиотека — по жанрам и характеру игр. Неиспользованные признаки исключаются из знаменателя.</p></div></div><div class="step-line"><b>03</b><div><h3>Объясняем выбор</h3><p>Показываем признаки, которые повлияли на подбор. В основе — правила и веса, без нейросети.</p></div></div></div><div class="panel"><h3>Честно о первой версии</h3><p>Сейчас в каталоге ${count(games.length)} игр. Это небольшой учебный набор, а не полный рейтинг самых популярных игр всех времён. Текущие чарты можно проверить в <a href="https://store.steampowered.com/charts/mostplayed" target="_blank" rel="noopener">Steam Charts</a>.</p><p style="margin-top:15px">Профиль, отзывы и форум работают локально. Связи с аккаунтом Steam пока нет: импорт распознаёт выбранные файлы .acf и названия в пределах нашего каталога. Приложение не собирает данные с рабочего стола.</p><p style="margin-top:15px">Обложки и видео получены со страниц Steam. Общий балл объединяет отзывы игроков Steam и оценку критиков. Источники и даты указаны в карточках. Права принадлежат правообладателям. Видео требуют интернета. Заметки редакции подготовлены для прототипа и не выдают себя за личный опыт прохождения.</p><p style="margin-top:15px">Возрастные метки — редакционные ориентиры по распространённым рейтингам, не юридическая классификация. Сверяйте официальный рейтинг для своего региона.</p><div class="inline-actions"><a class="btn small" href="https://stopgame.ru/games" target="_blank" rel="noopener">StopGame ↗</a><a class="btn small" href="https://partner.steamgames.com/doc/webapi/iplayerservice" target="_blank" rel="noopener">Steam API ↗</a></div></div></div>`;}
function render(){route=location.hash.slice(1).split('?')[0]||'home';if(!labels[route])route='home';document.querySelectorAll('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===route));$('#page-label').textContent=labels[route];$('#app').innerHTML=({home,catalog,discover,library,profile,community,about,rankings:()=>renderRankings(games,rankingFilters,genres,pages.rankings)}[route])();setProfileUI();if(route==='discover' && hasJavaServer) void loadDiscoverResults($('#discover-results'));}
function closeModal(){
  if ($('#daily-form') && state.daily?.day !== localDay()) {
    state.daily = {day: localDay(), skipped: true};
    save();
  }
hls?.destroy();hls=null;$('#modal').querySelector('video')?.pause();$('#modal').close();$('#modal-body').innerHTML='';}
function modal(html){
  hls?.destroy();
  hls = null;
  $('#modal-body').innerHTML = html;
  const dialog = $('#modal');
  if ($('#daily-title')) dialog.setAttribute('aria-labelledby', 'daily-title');
  else dialog.removeAttribute('aria-labelledby');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  if ($('#daily-title')) $('#daily-title').focus();
}
function openDaily(prefs=state.prefs, noMatch=false) {
  modal(dailyForm(prefs, icon, noMatch));
}
async function submitDaily(form) {
  const prefs = dailyPreferences(new FormData(form), state.prefs);
  const submit = form.querySelector('button:not([type])');
  if (!prefs || submit.disabled) return;
  submit.disabled = true;
  const game = await getRecommendations(games, recommendationPrefs(prefs), state.owned, 'daily');
  if (!form.isConnected || !$('#modal').open) return;
  submit.disabled = false;
  if (!game) {
    openDaily(prefs, true);
    return;
  }
  state.prefs = prefs;
  pages.discover = 1;
  state.daily = {day: localDay(), gameId: game.id, match: game.match, adjustments: game.adjustments ?? []};
  save();
  render();
  modal(`<div class="modal-pad daily-dialog daily-result">
      <h2 id="daily-title" tabindex="-1">Твоя игра дня</h2>
      <img class="daily-result-image" src="${esc(game.image)}" alt="">
      <div class="daily-result-heading"><h3>${esc(game.title)}</h3><span class="daily-match">${game.match}% ${game.adjustments?.length ? 'по вкусу' : 'совпадение'}</span></div>
      ${game.free ? '<p class="daily-free-label">Бесплатная игра</p>' : ''}
      <p>${esc(game.reasons.join(' · '))}</p>
      ${adjustmentNote(game.adjustments, 'Ближайший вариант')}
      <div class="daily-actions">
        <button class="btn primary" data-game="${game.id}">Об игре ${icon('arrow-up-right')}</button>
        <button class="btn" data-action="daily-home">На главную</button>
        <button class="text-button" data-action="daily">Изменить ответы</button>
      </div>
    </div>`);
}
function gameDetails(id,play=false){const g=games.find(x=>x.id===Number(id));if(!g)return;const reviews=state.reviews.filter(r=>r.gameId===g.id);modal(`<img class="detail-cover" src="${esc(g.hero || g.image)}" alt=""><div class="detail-info"><span class="eyebrow">${esc(g.developer||'ИГРА ИЗ КАТАЛОГА')}</span><h2>${esc(g.title)}</h2><div class="detail-meta"><span>${g.genres.join(' / ')}</span>${g.age ? `<span>${g.age}+</span>` : ''}${g.minutes ? `<span>Сессия от ${g.minutes} мин</span>` : ''}${g.releaseYear ? `<span>${g.releaseYear}</span>` : ''}${g.free===true?'<span>Бесплатная</span>':''}</div>${g.description ? `<p>${esc(g.description)}</p>` : ''}${ratingBreakdown(g)}<div class="detail-actions"><button class="btn primary" data-save="${g.id}">${state.wishlist.includes(g.id)?'✓ В избранном':'+ Хочу поиграть'}</button><button class="btn" data-owned="${g.id}">${state.owned.includes(g.id)?'✓ Уже есть':'+ Уже есть'}</button>${g.freeURL ? `<a class="btn" href="${esc(g.freeURL)}" target="_blank" rel="noopener">Скачать бесплатно ↗</a>` : ''}<a class="btn" href="${g.source}" target="_blank" rel="noopener">В Steam ↗</a></div>${g.verdict ? `<div class="editorial"><h3>Мнение NEXTPLAY</h3><p>${esc(g.verdict)}</p><small>Стоит учесть: ${esc(g.caution)}</small></div>` : ''}${g.movie?.url?`<h3>Ролик из Steam</h3><video class="video-frame" controls playsinline preload="none" poster="${g.image}" id="game-video"></video><p id="video-status" class="local-label">Видео из Steam · нужно подключение к интернету</p>`:''}<div class="section-heading"><h3>Отзывы игроков <span class="muted">· ${reviews.length}</span></h3>${reviews.length?`<span class="lime">${(reviews.reduce((s,r)=>s+r.score,0)/reviews.length).toFixed(1)} / 10</span>`:''}</div><p class="local-label">Отзывы сохранены на этом устройстве</p>${reviews.map(r=>`<div class="review"><div class="review-head"><b>${esc(r.author)}</b><span class="lime">${r.score} / 10</span></div><p>${esc(r.text)}</p><small>${new Date(r.date).toLocaleDateString('ru-RU')} · <button data-delete-review="${r.id}">Удалить</button></small></div>`).join('')}<form id="review-form" class="review-form" data-id="${g.id}"><h3>Твоё впечатление</h3><label class="field">Оценка<select name="score">${Array.from({length:10},(_,i)=>10-i).map(n=>`<option value="${n}">${n} / 10</option>`).join('')}</select></label><label class="field">Отзыв<textarea name="text" required minlength="10" maxlength="1500" placeholder="Что понравилось? Кому бы ты посоветовал эту игру?"></textarea></label><button class="btn primary">Сохранить отзыв</button></form></div>`);const video=$('#game-video');if(video&&g.movie?.url){const url=g.movie.url;if(url.includes('.m3u8')&&window.Hls?.isSupported()){hls=new window.Hls({autoStartLoad:false});hls.loadSource(url);hls.attachMedia(video);video.addEventListener('play',()=>hls?.startLoad(),{once:true});hls.on(window.Hls.Events.ERROR,(_,d)=>{if(d.fatal)$('#video-status').textContent='Видео сейчас недоступно. Откройте официальные ролики через кнопку «В Steam».';});}else video.src=url;video.addEventListener('error',()=>$('#video-status').textContent='Не удалось загрузить видео. Посмотрите ролик на странице игры в Steam.');if(play){video.scrollIntoView({block:'center'});video.play().catch(()=>{});}}}
function importModal(){importPending=[];modal(importMarkup(games.length,Boolean(window.nextplay)));}
function showImportResults(result){importPending=result.ids;$('#import-result').innerHTML=importResultMarkup(result,games,state.owned);}
function showRecognized(text){showImportResults(parseImport(text,games));}
function refreshRankings(resetPage=true){if(resetPage)pages.rankings=1;const target=$('#ranking-results');if(target)target.innerHTML=rankingResults(games,rankingFilters,pages.rankings);document.querySelectorAll('[data-rank-field]').forEach(input=>input.value=rankingFilters[input.dataset.rankField]);document.querySelectorAll('[data-period]').forEach(button=>{const active=button.dataset.period===rankingFilters.preset;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});}
function topicDetails(id){const t=[...state.topics,...seedTopics].find(x=>x.id===id);if(!t)return;modal(`<div class="modal-pad"><span class="eyebrow lime">${esc(t.category)} · ЛОКАЛЬНОЕ ОБСУЖДЕНИЕ</span><h2>${esc(t.title)}</h2><p>${esc(t.author)}</p><div class="review"><p>${esc(t.body)}</p></div><h3 style="margin-top:24px">Ответы</h3>${(state.replies[id]||[]).map(r=>`<div class="review"><div class="review-head"><b>${esc(r.author)}</b></div><p>${esc(r.text)}</p></div>`).join('')||'<p class="info-note">Пока нет ответов. Добавь своё мнение.</p>'}<form id="reply-form" data-id="${esc(id)}" class="review-form"><label class="field">Твой ответ<textarea name="text" required minlength="3" maxlength="1500"></textarea></label><button class="btn primary">Сохранить ответ</button></form></div>`);}
function quizCapture(){const f=$('#quiz-form');if(!f)return;const d=new FormData(f);state.prefs={...state.prefs,mood:d.get('mood'),time:Number(d.get('time')),mode:d.get('mode'),hardware:d.get('hardware'),age:Number(d.get('age')),free:d.has('free'),hideOwned:d.has('hideOwned')};}
document.addEventListener('click',async e=>{const t=e.target.closest('button,a');if(!t)return;if(t.dataset.pager){
  const kind=t.dataset.pager;
  if(!Object.hasOwn(pages,kind))return;
  pages[kind]=Math.max(1, Number(t.dataset.page)||1);
  if(kind==='rankings'){refreshRankings(false);$('#ranking-results').scrollIntoView({block:'start'});}
  else {render();window.scrollTo(0,0);}
  $('.page-controls button[data-page="'+(pages[kind]+1)+'"]:not(:disabled)')?.focus({preventScroll:true});
  return;
}
if(t.dataset.taste){
  const id=Number(t.dataset.tasteId), vote=Number(t.dataset.taste);
  state.taste ??= {};
  if(state.taste[id]===vote) delete state.taste[id];
  else state.taste[id]=vote;
  if(save()) toast('Подбор обновлён по твоим оценкам');
  render();
  return;
}
if(t.dataset.period){pages.rankings=1;rankingFilters=setPeriod(rankingFilters,t.dataset.period);render();return;}if(t.dataset.game){gameDetails(t.dataset.game);return;}if(t.dataset.video){gameDetails(t.dataset.video,true);return;}if(t.dataset.save){const id=Number(t.dataset.save),had=state.wishlist.includes(id);state.wishlist=had?state.wishlist.filter(x=>x!==id):[...state.wishlist,id];save();render();if($('#modal').open&&$('#review-form')){t.textContent=had?'+ Хочу поиграть':'✓ В избранном';}toast(had?'Игра удалена из избранного':'Игра сохранена в «Хочу поиграть»');return;}if(t.dataset.owned){const id=Number(t.dataset.owned);state.owned=state.owned.includes(id)?state.owned.filter(x=>x!==id):[...state.owned,id];save();t.textContent=state.owned.includes(id)?'✓ Уже есть':'+ Уже есть';render();return;}if(t.dataset.mood){pages.discover=1;state.prefs.mood=t.dataset.mood;save();go('discover');return;}if(t.dataset.prefgenre){pages.discover=1;quizCapture();const g=t.dataset.prefgenre;state.prefs.genres=state.prefs.genres.includes(g)?state.prefs.genres.filter(x=>x!==g):[...state.prefs.genres,g];save();render();return;}if(t.dataset.library){pages.library=1;libraryTab=t.dataset.library;render();return;}if(t.dataset.topic){topicDetails(t.dataset.topic);return;}if(t.dataset.deleteReview){const id=state.reviews.find(r=>r.id===t.dataset.deleteReview)?.gameId;state.reviews=state.reviews.filter(r=>r.id!==t.dataset.deleteReview);save();gameDetails(id);return;}
 switch(t.dataset.action){case 'clear-taste':state.taste={};save();render();break;case 'daily':openDaily();break;case 'daily-home':closeModal();go('home');break;case 'quiz':pages.discover=1;go('discover');break;case 'catalog':go('catalog');break;case 'close':closeModal();break;case 'import':importModal();break;case 'reset-rankings':pages.rankings=1;rankingFilters={...defaultRanking};render();break;case 'import-example':$('#import-text').value='Ведьмак 3\nStardew Valley\nhttps://store.steampowered.com/app/730/';break;case 'recognize':showRecognized($('#import-text').value);break;case 'confirm-import':{const before=state.owned.length;state.owned=[...new Set([...state.owned,...[...document.querySelectorAll('[data-import-id]:checked')].map(x=>Number(x.dataset.importId)).filter(id=>importPending.includes(id))])];save();closeModal();pages.library=1;libraryTab='owned';go('library');toast(`Добавлено игр: ${state.owned.length-before}`);break;}case 'scan-steam':{t.disabled=true;try{const r=await window.nextplay.scanSteam();if(r.error)toast(r.error);else if(!r.canceled)showRecognized(JSON.stringify({games:r.games}));}catch{toast('Не удалось прочитать папку. Попробуйте выбрать файлы вручную.');}finally{t.disabled=false;}break;}case 'reset-prefs':pages.discover=1;state.prefs={...defaultPrefs,genres:[]};save();render();break;case 'reset-filters':pages.catalog=1;query='';genre='';category='all';$('#global-search').value='';render();break;case 'new-topic':modal(`<div class="modal-pad"><h2>Начни разговор</h2><p>Тема сохранится только на этом устройстве.</p><form id="topic-form" class="review-form"><label class="field">Заголовок<input name="title" required minlength="5" maxlength="100"></label><label class="field">Категория<select name="category"><option>Советы</option><option>Кооператив</option><option>Впечатления</option><option>О проекте</option></select></label><label class="field">О чём поговорим?<textarea name="body" required minlength="10" maxlength="2000"></textarea></label><button class="btn primary">Создать тему</button></form></div>`);break;case 'export':{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify({format:'nextplay-v1',profile:state},null,2)],{type:'application/json'}));a.href=u;a.download='nextplay-profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('Резервная копия подготовлена');break;}case 'install':if(window.nextplay)toast('Вы уже используете приложение NEXTPLAY для Windows.');else if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else modal(`<div class="modal-pad"><h2>Игры — на расстоянии одного касания.</h2><p>На компьютере откройте сайт в Chrome или Edge и выберите в меню браузера «Установить приложение». На iPhone: Safari → «Поделиться» → «На экран Домой». На Android: меню браузера → «Добавить на главный экран».</p><p>Если установки нет в меню, используйте веб-версию. Отдельное приложение Windows передаётся вместе с проектом.</p><button class="btn primary" data-action="close">Понятно</button></div>`);break;}
});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target,d=new FormData(f);if(f.id==='daily-form'){void submitDaily(f);return;}if(f.id==='quick-form'){state.prefs.time=Number(d.get('time'));state.prefs.mode=d.get('mode');save();go('discover');}if(f.id==='quiz-form'){pages.discover=1;quizCapture();save();render();toast('Подборка обновлена');}if(f.id==='profile-form'){const name=d.get('name').trim();if(!name){toast('Введите имя');return;}state.name=name;state.bio=d.get('bio').trim();if(save())toast('Профиль сохранён');render();}if(f.id==='review-form'){const text=d.get('text').trim();if(text.length<10){toast('Напишите хотя бы 10 символов');return;}const id=Number(f.dataset.id);state.reviews.unshift({id:crypto.randomUUID(),gameId:id,author:state.name,score:Number(d.get('score')),text,date:new Date().toISOString()});save();gameDetails(id);toast('Отзыв сохранён на устройстве');}if(f.id==='topic-form'){const title=d.get('title').trim(),body=d.get('body').trim();if(title.length<5||body.length<10){toast('Добавьте содержательный заголовок и описание');return;}state.topics.unshift({id:crypto.randomUUID(),title,body,category:d.get('category'),author:state.name});save();closeModal();render();toast('Тема создана на устройстве');}if(f.id==='reply-form'){const text=d.get('text').trim();if(text.length<3)return;const id=f.dataset.id;(state.replies[id]??=[]).push({author:state.name,text});save();topicDetails(id);render();}});
document.addEventListener('input',e=>{const field=e.target.dataset.rankField;if(field){if(e.target.value===''||(e.target.type==='number'&&!e.target.validity.valid))return;const n=Number(e.target.value);if(!Number.isFinite(n))return;rankingFilters[field]=Math.max(Number(e.target.min),Math.min(Number(e.target.max),Math.round(n)));if(field==='from'&&rankingFilters.from>rankingFilters.to)rankingFilters.to=rankingFilters.from;if(field==='to'&&rankingFilters.to<rankingFilters.from)rankingFilters.from=rankingFilters.to;if(field==='minRating'&&rankingFilters.minRating>rankingFilters.maxRating)rankingFilters.maxRating=rankingFilters.minRating;if(field==='maxRating'&&rankingFilters.maxRating<rankingFilters.minRating)rankingFilters.minRating=rankingFilters.maxRating;if(['from','to'].includes(field))rankingFilters.preset='custom';refreshRankings();}if(e.target.id==='review-threshold'){rankingFilters.minReviews=reviewSteps[Number(e.target.value)];$('#review-threshold-label').textContent=rankingFilters.minReviews?'Не менее '+rankingFilters.minReviews.toLocaleString('ru-RU'):'Любое количество';refreshRankings();}if(e.target.id==='catalog-search'){pages.catalog=1;const start=e.target.selectionStart;query=e.target.value;render();const input=$('#catalog-search');input.focus();input.setSelectionRange(start,start);}if(e.target.id==='global-search'){pages.catalog=1;query=e.target.value;genre='';category='all';if(route!=='catalog')go('catalog');else render();}});
document.addEventListener('change',async e=>{const field=e.target.dataset.rankField;if(field&&e.target.type==='number'){if(e.target.value!==''&&Number.isFinite(Number(e.target.value))){rankingFilters[field]=Math.max(Number(e.target.min),Math.min(Number(e.target.max),Math.round(Number(e.target.value))));if(field==='from'&&rankingFilters.from>rankingFilters.to)rankingFilters.to=rankingFilters.from;if(field==='to'&&rankingFilters.to<rankingFilters.from)rankingFilters.from=rankingFilters.to;if(field==='minRating'&&rankingFilters.minRating>rankingFilters.maxRating)rankingFilters.maxRating=rankingFilters.minRating;if(field==='maxRating'&&rankingFilters.maxRating<rankingFilters.minRating)rankingFilters.minRating=rankingFilters.maxRating;if(['from','to'].includes(field))rankingFilters.preset='custom';}refreshRankings();}if(e.target.id==='rank-genre'){rankingFilters.genre=e.target.value;refreshRankings();}if(e.target.id==='rank-sort'){rankingFilters.sort=e.target.value;refreshRankings();}if(e.target.hasAttribute('data-import-id')){const n=document.querySelectorAll('[data-import-id]:checked').length;const b=$('[data-action="confirm-import"]');if(b){b.textContent='Добавить выбранные ('+n+')';b.disabled=!n;}}if(e.target.id==='genre-filter'){pages.catalog=1;genre=e.target.value;render();}if(e.target.id==='category-filter'){pages.catalog=1;category=e.target.value;render();}if(e.target.id==='steam-files'){const files=[...e.target.files];if(files.length>2000||files.some(f=>f.size>1000000)){toast('Выберите не более 2000 файлов, каждый меньше 1 МБ');return;}try{const results=await Promise.all(files.map(async f=>parseImport(await f.text(),games)));const all=results.flatMap(r=>r.ids),ids=[...new Set(all)];showImportResults({ids,unknown:results.flatMap(r=>r.unknown),ambiguous:results.flatMap(r=>r.ambiguous),duplicates:results.reduce((n,r)=>n+r.duplicates,0)+all.length-ids.length,processed:results.reduce((n,r)=>n+r.processed,0)});}catch{toast('Не удалось прочитать файлы');}}if(e.target.id==='restore-file'){const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error();const data=JSON.parse(await file.text());if(!validBackup(data))throw Error();modal(`<div class="modal-pad"><h2>Восстановить профиль?</h2><p>Профиль «${esc(data.profile.name)}» заменит текущие данные на этом устройстве. В нём ${data.profile.owned.length} игр, ${data.profile.reviews.length} отзывов и ${data.profile.topics.length} тем.</p><button class="btn primary" id="confirm-restore">Заменить текущий профиль</button><button class="btn" data-action="close">Отмена</button></div>`);$('#confirm-restore').onclick=()=>{state=data.profile;save();closeModal();render();toast('Профиль восстановлен');};}catch{toast('Файл не является корректной резервной копией NEXTPLAY');}}});
function validBackup(d){const p=d?.profile,idset=new Set(games.map(g=>g.id)),str=(x,n)=>typeof x==='string'&&x.length<=n;if(d?.format!=='nextplay-v1'||!p||!str(p.name,32)||!p.name.trim()||!str(p.bio,180))return false;for(const k of ['owned','wishlist'])if(!Array.isArray(p[k])||p[k].length>idset.size||p[k].some(x=>!idset.has(x)))return false;if(!Array.isArray(p.reviews)||p.reviews.length>1000||p.reviews.some(r=>!r||!idset.has(r.gameId)||!str(r.id,80)||!str(r.author,32)||!str(r.text,1500)||!Number.isInteger(r.score)||r.score<1||r.score>10||!Number.isFinite(Date.parse(r.date))))return false;if(!Array.isArray(p.topics)||p.topics.length>1000||p.topics.some(t=>!t||!str(t.id,80)||!str(t.title,100)||!str(t.body,2000)||!str(t.author,32)||!str(t.category,40)))return false;if(!p.replies||typeof p.replies!=='object'||Array.isArray(p.replies)||Object.keys(p.replies).some(k=>['__proto__','constructor','prototype'].includes(k)||!Array.isArray(p.replies[k])||p.replies[k].some(r=>!r||!str(r.author,32)||!str(r.text,1500))))return false;const pref=p.prefs;return pref&&['',...Object.keys(moods)].includes(pref.mood)&&[0,20,30,60,90].includes(pref.time)&&['','solo','friends'].includes(pref.mode)&&['any','low'].includes(pref.hardware)&&[7,12,16,99].includes(pref.age)&&typeof pref.free==='boolean'&&typeof pref.hideOwned==='boolean'&&Array.isArray(pref.genres)&&pref.genres.every(g=>genres.includes(g));}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});$('#modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#modal').open){e.preventDefault();$('#global-search').focus();}});
async function readCatalogFile(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error('Не удалось прочитать ' + path);
  return response.json();
}
document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.getAttribute('src') && image.getAttribute('src') !== coverFallback) {
    image.src = coverFallback;
  }
}, true);
try {
  const [steam, snapshot] = await Promise.all([
    readCatalogFile('./steam-data.json'),
    readCatalogFile('./bulk-catalog.json').catch(() => null),
  ]);
  games = assembleCatalog(steam, snapshot, currentYear);
  render();
  if (!storageOK) toast('Хранилище недоступно. Изменения могут не сохраниться.');
  if (!snapshot) toast('Открыта основная подборка. Расширенный каталог пока недоступен.');
  if (state.daily?.day !== localDay()) openDaily();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => {});
} catch (error) {
  $('#app').innerHTML = '<div class="empty"><h2>Не удалось загрузить каталог</h2><p>Обнови страницу и попробуй ещё раз.</p></div>';
  console.error(error);
}
