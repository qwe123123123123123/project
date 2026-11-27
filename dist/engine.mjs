import {parseImport} from './importer.mjs';
import {experience,dimensions,libraryAffinity} from './scoring.mjs';
import {trainTaste} from './taste.mjs';
import {extraGames} from './extra-games.mjs';
import {expansionGames} from './catalog-expansion.mjs';
export const genres=['RPG','Экшен','Приключения','Стратегия','Симулятор','Песочница','Головоломка','Гонки'];
export const moods={story:'Погрузиться в историю',relax:'Выдохнуть',challenge:'Бросить себе вызов',social:'Собраться с друзьями',explore:'Исследовать мир'};
// Editorial tags describe the experience; minutes are a suggested session, not completion time.
const editorial=[
 [1091500,'Cyberpunk 2077',['RPG','Экшен'],['story','explore'],['solo'],60,18,'high','Потеряться в огнях Найт-Сити','Город, в котором за каждой яркой вывеской скрывается чья-то история. Выбирайте свой стиль: взлом, скрытность или открытый бой.','Для тех, кто любит атмосферные миры, диалоги и свободу в бою. Лучше оставить время на неспешное исследование.','Много взрослого контента; для комфортной игры нужен достаточно мощный ПК.',['киберпанк','cyberpunk']],
 [1245620,'Elden Ring',['RPG','Экшен'],['challenge','explore'],['solo','coop'],60,16,'high','Приключение, которое не ведёт за руку','Открытый мир, опасные подземелья и сражения, в которых каждое движение имеет значение.','Стоит попробовать ради свободы исследования и удовольствия от освоения сложных боёв.','Высокая сложность; совместная игра устроена сложнее обычного кооператива.',['элден ринг']],
 [1086940,"Baldur’s Gate 3",['RPG','Стратегия'],['story','explore','social'],['solo','coop'],90,18,'high','Ваша история. Ваши последствия.','Соберите отряд и отправьтесь в ролевое приключение с пошаговыми боями и множеством решений.','Подойдёт тем, кто любит обдумывать выбор и экспериментировать. Особенно интересно проходить вместе.','Много диалогов и правил; короткой сессии может не хватить.',['baldurs gate 3','балдурс гейт']],
 [1174180,'Red Dead Redemption 2',['Экшен','Приключения'],['story','explore'],['solo','online'],90,18,'high','Дикий Запад без спешки','История банды на закате эпохи Дикого Запада, огромные пространства и внимание к повседневным деталям.','Выбор для погружения в персонажей и мир. Не торопитесь между сюжетными заданиями.','Неспешное начало и реалистичные анимации нравятся не всем.',['rdr2','рдр2']],
 [292030,'The Witcher 3',['RPG','Приключения'],['story','explore'],['solo'],60,18,'medium','У каждого чудовища есть история','Охота на чудовищ, неоднозначные решения и путешествие по фэнтезийному миру.','Сильная сторона — истории даже в небольших заданиях. Хорошо подходит любителям сюжетных RPG.','Длинное прохождение; ограничения по возрасту и требовательность зависят от версии и настроек.',['ведьмак','witcher 3']],
 [730,'Counter-Strike 2',['Экшен'],['challenge','social'],['online'],45,16,'medium','Один раунд может изменить всё','Командный тактический шутер, где важны точность, позиция и общение.','Хорош для тех, кто хочет совершенствовать конкретные навыки и играть постоянной командой.','Соревновательные матчи требуют времени без перерывов.',['cs2','кс2','кс 2','counter strike']],
 [570,'Dota 2',['Стратегия'],['challenge','social'],['online'],60,16,'medium','Пять игроков. Тысячи решений.','Командная стратегия с героями, ролями и постоянно меняющейся ситуацией на карте.','Подойдёт любителям тактики и долгого освоения игровых систем. С друзьями учиться проще.','Высокий порог входа; матч нельзя свободно поставить на паузу.',['дота','дота 2']],
 [578080,'PUBG: Battlegrounds',['Экшен'],['challenge','social'],['online'],40,16,'medium','Остаться последним','Королевская битва, в которой выбор позиции и осторожность не менее важны, чем стрельба.','Для любителей напряжения, командного взаимодействия и тактических перестрелок.','После выбывания из матча придётся ждать или начинать новый.',['пабг','pubg']],
 [1172470,'Apex Legends',['Экшен'],['challenge','social'],['online'],30,16,'medium','Скорость решает','Динамичная королевская битва с героями, способностями и акцентом на движение.','Подойдёт тем, кто любит быстрый темп и синергию внутри команды.','Резкий темп и требовательность к реакции могут утомлять.',['апекс','apex']],
 [252490,'Rust',['Экшен','Песочница'],['challenge','social'],['online'],90,18,'high','Построить. Защитить. Выжить.','Выживание на общем сервере: ресурсы, строительство, союзы и борьба за территорию.','Игра для компании, которой нравится создавать общие планы и переживать непредсказуемые ситуации.','Прогресс на сервере уязвим даже в ваше отсутствие; требует много времени.',['раст']],
 [413150,'Stardew Valley',['Симулятор','Песочница'],['relax','explore','social'],['solo','coop'],20,12,'low','Маленькая ферма. Большая жизнь.','Симулятор фермы с рыбалкой, шахтами и жизнью небольшого городка. Выращивайте урожай, обустраивайте участок и знакомьтесь с соседями — в одиночку или вместе с друзьями.','Подойдёт, если нравится постепенно развивать своё хозяйство и возвращаться к небольшим ежедневным делам. Один игровой день удобно пройти за короткую сессию.','Время дня ограничено: если пытаться успеть всё, игра может превратиться в гонку за эффективностью.',['стар дью','стардью']],
 [105600,'Terraria',['Песочница','Приключения'],['explore','social'],['solo','coop'],30,12,'low','Целый мир под поверхностью','Двумерная песочница с исследованием, строительством, находками и боссами.','Для тех, кто хочет совместить творчество с приключениями и собирать необычное снаряжение.','Рецепты и развитие не всегда очевидны без подсказок.',['террария']],
 [620,'Portal 2',['Головоломка','Приключения'],['challenge','story','social'],['solo','coop'],30,12,'low','Подумать за пределами комнаты','Пространственные головоломки с порталами, необычный юмор и отдельная кампания для двоих.','Хорошая отправная точка для знакомства с головоломками. Кооператив поощряет общение и совместные открытия.','Если не нравятся пространственные задачи, некоторые комнаты могут застопорить прохождение.',['портал','portal']],
 [1145360,'Hades',['Экшен','RPG'],['challenge','story'],['solo'],30,16,'low','Ещё одна попытка выбраться','Динамичные забеги из подземного мира, новые сочетания способностей и история между попытками.','Для тех, кто любит короткие интенсивные сессии и постепенное освоение механик.','Повторные забеги составляют основу игры.',['хадес','аид']],
 [367520,'Hollow Knight',['Экшен','Приключения'],['explore','challenge'],['solo'],30,7,'low','Тайны забытого королевства','Нарисованное вручную подземное королевство с исследованиями, платформингом и сложными боссами.','Подойдёт любителям находить секреты и постепенно открывать карту собственными силами.','Возвращения к месту поражения и поиск пути могут потребовать терпения.',['холлоу найт']],
 [1551360,'Forza Horizon 5',['Гонки'],['relax','explore','social'],['solo','online'],20,3,'high','Дорога — это приглашение','Открытый мир Мексики, большой выбор автомобилей и гонки в разных дисциплинах.','Можно настроить помощников под себя и просто наслаждаться поездкой.','Большой размер установки; сетевые события требуют соединения.',['форза','forza']],
 [1623730,'Palworld',['Песочница','Приключения'],['explore','social'],['solo','coop'],60,12,'high','Необычная команда для большого мира','Исследуйте острова, собирайте существ, стройте базу и автоматизируйте производство.','Для компании, которой нравится распределять задачи и вместе развивать поселение.','Сбор ресурсов и обслуживание базы занимают заметную часть времени.',['палворлд']],
 [553850,'Helldivers 2',['Экшен'],['challenge','social'],['coop'],40,18,'high','План был хорош. До высадки.','Кооперативные миссии, хаотичные сражения и необходимость координировать действия отряда.','Особенно интересно с друзьями: неожиданные ситуации часто становятся лучшей частью вечера.','Дружественный огонь и сетевой формат; доступность покупки зависит от региона.',['хеллдайверс']],
 [990080,'Hogwarts Legacy',['RPG','Приключения'],['explore','story'],['solo'],60,12,'high','Письмо наконец пришло','Исследуйте Хогвартс и его окрестности, изучайте заклинания и разгадывайте тайны.','Лучше всего раскрывается для тех, кому хочется прогуляться по знакомому волшебному миру.','Много однотипных активностей в открытом мире.',['хогвартс']],
 [945360,'Among Us',['Стратегия'],['social'],['online'],15,7,'low','Кто-то здесь явно врёт','Короткие партии на социальную дедукцию: выполняйте задания, обсуждайте подозрения и ищите самозванцев.','Отлично подходит для компании, которая любит разговоры, наблюдение и неожиданные повороты.','Качество впечатлений сильно зависит от компании и правил общения.',['амонг ас']]
];
export const baseGames=editorial.map(([id,title,genres,moods,modes,minutes,age,hardware,tagline,description,verdict,caution,aliases])=>({id,title,genres,moods,modes,minutes,age,hardware,tagline,description,verdict,caution,aliases})).concat(extraGames, expansionGames);
export const defaultPrefs={mood:'',time:0,mode:'',hardware:'any',free:false,age:99,genres:[],hideOwned:false};
export function recommend(games,prefs={},owned=[]){
 const p={...defaultPrefs,...prefs};const library=games.filter(g=>owned.includes(g.id));
 const personalScore=trainTaste(games,p.taste ?? []);
 return games.filter(g=>(!p.free||g.free)&&(p.age===99||(g.age!=null&&g.age<=p.age))&&(!p.hideOwned||!owned.includes(g.id))&&(p.hardware!=='low'||g.hardware==='low')&&(!p.mode||(p.mode==='friends'?g.modes.some(m=>m!=='solo'):g.modes.includes('solo')))&&(!Number(p.time)||(g.minutes!=null&&g.minutes<=Number(p.time)))).map(g=>{
 const breakdown=[],reasons=[];const add=(label,weight,value)=>breakdown.push({label,weight,value:Math.round(value*100)});
 if(p.mood){const strength=experience(g)[dimensions.indexOf(p.mood)]??0;add('Настроение',45,strength);reasons.push(strength>=.8?'Хорошо подходит: '+moods[p.mood].toLowerCase():strength>=.5?'Частично подходит: '+moods[p.mood].toLowerCase():'Это настроение выражено слабо');}
 if(p.genres.length){const common=g.genres.filter(x=>p.genres.includes(x));add('Любимые жанры',30,common.length/g.genres.length);if(common.length)reasons.push(common.join(' / '));}
 if(library.length){const affinity=libraryAffinity(g,library);add('Похожесть на библиотеку',25,affinity);if(affinity>=.5)reasons.push('похожа по жанру и характеру на вашу библиотеку');}
 const taste=personalScore(g);
 if(taste!==null){add('Личный вкус',35,taste);if(taste>=.62)reasons.push('похожа на игры, которые тебе нравятся');if(taste<=.38)reasons.push('похожа на игры, которые ты отклонил');}
 if(p.time)reasons.push('сессия от '+g.minutes+' мин');if(p.mode)reasons.push(p.mode==='solo'?'можно играть одному':'есть совместный режим');
 const denominator=breakdown.reduce((s,x)=>s+x.weight,0);const match=denominator?Math.round(breakdown.reduce((s,x)=>s+x.weight*x.value,0)/denominator):null;
 return {...g,match,breakdown,reasons:reasons.length?reasons:['Настройте подбор под себя']};
 }).sort((a,b)=>(b.match??0)-(a.match??0));
}

export function suggestGames(games, prefs = {}, owned = []) {
  const settings = {...defaultPrefs, ...prefs};
  const available = games.filter(game => !game.comingSoon);
  const exact = recommend(available, settings, owned);
  if (exact.length) return {games: exact, approximate: false};

  const candidates = recommend(available, {
    ...settings, time: 0, hardware: 'any', mode: '', hideOwned: false,
  }, owned);
  const ownedIds = new Set(owned);
  const results = candidates.map(game => {
    const adjustments = [];
    let cost = 0;
    if (settings.mode === 'solo' && !game.modes.includes('solo')) {
      adjustments.push('Нужны другие игроки');
      cost += 6;
    }
    if (settings.mode === 'friends' && !game.modes.some(mode => mode !== 'solo')) {
      adjustments.push('Игра рассчитана на одного');
      cost += 6;
    }
    if (settings.hardware === 'low' && game.hardware !== 'low') {
      adjustments.push(game.hardware ? 'Требования к ПК выше' : 'Работа на слабом ПК не проверена');
      cost += game.hardware ? 5 : 4;
    }
    if (settings.time && (game.minutes == null || game.minutes > settings.time)) {
      adjustments.push(game.minutes == null ? 'Длительность сессии неизвестна' : `Сессия от ${game.minutes} мин`);
      cost += game.minutes == null ? 3 : Math.min(3, (game.minutes - settings.time) / 20 + 1);
    }
    if (settings.hideOwned && ownedIds.has(game.id)) {
      adjustments.push('Уже есть в твоей библиотеке');
      cost += 15;
    }
    return {game: {...game, adjustments}, cost};
  });
  results.sort((a, b) => a.cost - b.cost || (b.game.match ?? 0) - (a.game.match ?? 0) ||
    (b.game.overall?.exact ?? -1) - (a.game.overall?.exact ?? -1) || a.game.id - b.game.id);
  return {games: results.slice(0, 6).map(result => result.game), approximate: results.length > 0};
}

export function recognize(text,games=baseGames){return parseImport(text,games);}
