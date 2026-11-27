import test from 'node:test';import assert from 'node:assert/strict';
import {baseGames,recommend} from '../dist/engine.mjs';
import {rankGames,periodYears} from '../dist/scoring.mjs';
import {parseImport} from '../dist/importer.mjs';
import fs from 'node:fs/promises';
import {assembleCatalog} from '../dist/catalog-data.mjs';
import {nextplayScore, ratingTone} from '../dist/ratings.mjs';
import {dailyPick, dailyPreferences, localDay} from '../dist/daily.mjs';
import {pageOf} from '../dist/pager.mjs';
test('exact names do not accidentally import the original and sequel',()=>{
 assert.deepEqual(parseImport('Half-Life 2\nPortal 2\nHades II',baseGames).ids,[220,620,1145350]);
 assert.equal(parseImport('люблю Half-Life и Portal',baseGames).ambiguous.length,1);
});
test('JSON, links, manifests, duplicates and unsupported games retain their meaning',()=>{
 assert.deepEqual(parseImport('{"response":{"games":[{"appid":730,"name":"CS2"},{"appid":999999,"name":"Unknown"}]}}',baseGames).ids,[730]);
 const r=parseImport('https://store.steampowered.com/app/730/\nCS2\nappmanifest_220.acf\nUnknown',baseGames);
 assert.deepEqual(r.ids,[730,220]);assert.equal(r.duplicates,1);assert.deepEqual(r.unknown,['Unknown']);
 assert.deepEqual(parseImport('"AppState" { "appid" "730" }',baseGames).ids,[730]);
});
test('match has multiple intermediate values and is reproducible',()=>{
 const prefs={mood:'explore',genres:['RPG']},owned=[413150,220];
 const a=recommend(baseGames,prefs,owned),b=recommend(baseGames,prefs,owned);
 assert.deepEqual(a,b);assert.ok(new Set(a.map(g=>g.match)).size>15);
 for(const g of a){const weight=g.breakdown.reduce((n,x)=>n+x.weight,0);assert.equal(g.match,Math.round(g.breakdown.reduce((n,x)=>n+x.value*x.weight,0)/weight));}
});
const rated=(id,year,percent,total)=>({id,releaseYear:year,genres:['RPG'],rating:{percent,total},overall:{exact:percent,value:percent}});
test('general rating uses inclusive filters, excludes missing data and breaks ties by review count',()=>{
 const rows=[rated(1,2016,95,10000),rated(2,2017,95,20000),rated(3,2026,94,30000),rated(4,2026,99,50),{id:5}, {...rated(6,2026,100,10000),comingSoon:true}];
 assert.deepEqual(rankGames(rows,{from:2017,to:2026,minRating:94,maxRating:95,minReviews:1000}).map(x=>x.id),[2,3]);
 assert.deepEqual(rankGames(rows,{minReviews:1000}).map(x=>x.id),[2,1,3]);
 assert.equal(rankGames(rows,{sort:'popular'})[0].id,3);
 assert.equal(rankGames(rows,{genre:'Шутер'}).length,0);
});
test('year presets include exactly ten or five calendar years',()=>{
 assert.deepEqual(periodYears('ten',2026,1998),[2017,2026]);assert.deepEqual(periodYears('five',2026,1998),[2022,2026]);assert.deepEqual(periodYears('all',2026,1998),[1998,2026]);
});

test('combined score uses two verified components and an explicit sample floor',()=>{
 assert.deepEqual(nextplayScore({percent:85,total:1000},{score:95}),{exact:89,value:89});
 assert.equal(nextplayScore({percent:85,total:1000},null),null);
 assert.equal(nextplayScore({percent:100,total:99},{score:100}),null);
 assert.equal(nextplayScore({percent:100,total:100},{score:100}).value,100);
 assert.deepEqual([59,60,80,95,100].map(ratingTone),['poor','fair','good','elite','elite']);
});

test('production catalog reaches 1000 valid games, with a verifiable top 50',async()=>{
 const [steam,bulk]=await Promise.all(['steam-data.json','bulk-catalog.json'].map(async name=>
   JSON.parse(await fs.readFile(new URL('../dist/'+name,import.meta.url),'utf8'))));
 const games=assembleCatalog(steam,bulk,2026);
 assert.ok(games.length>=1000);
 assert.equal(new Set(games.map(game=>game.id)).size,games.length);
 assert.ok(games.every(game=>game.image&&game.genres.length&&game.rating.positive+game.rating.negative===game.rating.total));
 assert.ok(games.filter(game=>game.overall).length>500);
 assert.equal(games.find(game=>game.id===1551360).critic.name,'PC Gamer');
 const list=rankGames(games,{minReviews:1000});
 assert.deepEqual(list.slice(0,50).map(game=>game.topRank?.place),Array.from({length:50},(_,i)=>i+1));
 assert.equal(list[50].topRank,undefined);
 assert.equal(pageOf(list,2).items[0],list[24]);
 const bulkGame=games.find(game=>!game.curated);
 assert.deepEqual(parseImport(String(bulkGame.id),games).ids,[bulkGame.id]);
 const prefs={...dailyPreferences(new URLSearchParams('mood=story&time=20&mode=solo&hardware=low&free=on')),age:12};
 const daily=dailyPick(games,prefs,[]);
 assert.equal(daily.id,2324650);
 assert.equal(daily.free,true);
 assert.equal(daily.adjustments,undefined);
});

test('daily pick respects mood, hard filters and missing metadata',()=>{
 const prefs=dailyPreferences(new URLSearchParams({mood:'relax',time:'20',mode:'solo',hardware:'low'}));
 assert.equal(dailyPick(baseGames,prefs,[]).id,413150);
 const freeStory=baseGames.find(game=>game.id===1170880);
 const asFree={...freeStory,free:true,minutes:null};
 const tooOld={...asFree,id:99,age:18,minutes:15};
 const paid={...asFree,id:100,free:false,minutes:15};
 const picked=dailyPick([asFree,tooOld,paid],{...prefs,free:true,age:12},[]);
 assert.equal(picked.id,freeStory.id);
 assert.deepEqual(picked.adjustments,['Длительность сессии неизвестна']);
 assert.equal(dailyPick([tooOld,paid],{...prefs,free:true,age:12},[]),null);
 assert.equal(dailyPreferences(new URLSearchParams({mood:'unknown'})),null);
 assert.equal(localDay(new Date(2026,10,24,23,59)),'2026-11-24');
});
