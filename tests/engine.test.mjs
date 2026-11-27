import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {baseGames,recommend,recognize} from '../dist/engine.mjs';
const require=createRequire(import.meta.url);const {scanSteamFolder}=require('../steam.cjs');
const data=JSON.parse(await fs.readFile(new URL('../dist/steam-data.json',import.meta.url),'utf8'));const games=baseGames.map(g=>({...g,...data.find(d=>d.id===g.id)}));
test('curated games have unique identifiers and their downloaded covers exist',async()=>{
  assert.equal(games.length,85);
  assert.equal(new Set(games.map(game=>game.id)).size,games.length);
  assert.equal(data.length,games.length);
  for(const game of data){
    assert.ok(baseGames.some(entry=>entry.id===game.id));
    assert.ok(game.image && game.source.startsWith('https://store.steampowered.com/'));
    assert.ok((await fs.stat(new URL('../dist/'+game.image,import.meta.url))).size>100);
  }
});
test('hard constraints are honored together',()=>{const list=recommend(games,{hardware:'low',time:30,mode:'solo',age:12});assert.ok(list.length);assert.ok(list.every(g=>g.hardware==='low'&&g.minutes<=30&&g.modes.includes('solo')&&g.age<=12));});
test('relaxation and short sessions rank Stardew first with a graded score',()=>{const list=recommend(games,{mood:'relax',time:20,hardware:'low'});assert.equal(list[0].id,413150);assert.equal(list[0].match,92);assert.ok(new Set(list.map(g=>g.match)).size>3);});
test('strict recommendations still exclude unsuitable games',()=>{
  const candidates=games.filter(game=>[1245620,730,105600].includes(game.id));
  assert.equal(recommend(candidates,{free:true,hardware:'low',mode:'solo',time:20}).length,0);
});
test('ownership exclusion and content affinity work',()=>{const owned=[413150];const list=recommend(games,{hideOwned:true},owned);assert.ok(list.every(g=>g.id!==413150));assert.ok(list[0].genres.includes('Песочница'));assert.ok(list[0].reasons.includes('похожа по жанру и характеру на вашу библиотеку'));});
test('no inputs means no invented match percent',()=>{assert.ok(recommend(games).every(g=>g.match===null));});
test('aliases, app IDs and manifests recognized without unknown invention',()=>{const r=recognize('Ведьмак 3\nCS2\nappmanifest_413150.acf\n999999\nunknown game');assert.deepEqual(new Set(r.ids),new Set([292030,730,413150]));assert.equal(r.unknown.length,2);});
test('matching percentage stays bounded',()=>{for(const mood of ['story','relax','challenge','social','explore'])for(const g of recommend(games,{mood,genres:['RPG','Экшен']},[413150,1245620]))assert.ok(g.match>=0&&g.match<=100);});
test('desktop scanner reads only manifests in selected library',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nextplay-test-'));try{await fs.mkdir(path.join(dir,'steamapps'));await fs.writeFile(path.join(dir,'steamapps','appmanifest_730.acf'),'"AppState" { "appid" "730" "name" "Counter-Strike 2" }');await fs.writeFile(path.join(dir,'steamapps','unrelated.txt'),'"appid" "570"');assert.deepEqual(await scanSteamFolder(dir),[{id:730,name:'Counter-Strike 2'}]);}finally{await fs.rm(dir,{recursive:true,force:true});}});
