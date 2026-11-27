const {app,BrowserWindow,protocol,net,dialog,ipcMain,shell,session}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {pathToFileURL}=require('node:url');const {scanSteamFolder}=require('./steam.cjs');
app.setName('NEXTPLAY');
protocol.registerSchemesAsPrivileged([{scheme:'nextplay',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let win;const base='nextplay://app/';
app.whenReady().then(async()=>{
 const root=path.join(__dirname,'dist');
 protocol.handle('nextplay',request=>{const url=new URL(request.url);if(url.hostname!=='app')return new Response('Forbidden',{status:403});let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{return new Response('Bad path',{status:400});}if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});return net.fetch(pathToFileURL(file).toString());});
 session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 const smoke=process.argv.includes('--smoke-test');
 win=new BrowserWindow({width:1460,height:990,minWidth:380,minHeight:650,show:!smoke,backgroundColor:'#111416',title:'NEXTPLAY — игровой компас',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false,offscreen:smoke}});
 win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:'&&['store.steampowered.com','partner.steamgames.com','stopgame.ru','www.metacritic.com','metacritic.com','www.pcgamer.com','huggingface.co','www.openttd.org'].includes(u.hostname))shell.openExternal(url);}catch{}return {action:'deny'};});
 win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(base))e.preventDefault();});
 ipcMain.handle('scan-steam',async(event)=>{if(event.sender!==win.webContents||!event.senderFrame.url.startsWith(base))throw Error('Untrusted sender');const choice=await dialog.showOpenDialog(win,{title:'Выберите Steam или папку steamapps',properties:['openDirectory']});if(choice.canceled)return {canceled:true};try{return {games:await scanSteamFolder(choice.filePaths[0])};}catch{return {error:'Не удалось прочитать папку. Выберите Steam или steamapps с файлами appmanifest_*.acf.'};}});
 await win.loadURL(base);
 if(smoke){try{await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{if(document.querySelectorAll('.game-card').length===4&&[...document.images].every(i=>i.complete&&i.naturalWidth>0)&&document.getAnimations().every(a=>a.playState==='finished'))resolve(true);else if(Date.now()>end)reject(Error('UI did not load'));else setTimeout(check,100)};check()})`);const result=await win.webContents.executeJavaScript(`({title:document.title,cards:document.querySelectorAll('.game-card').length,bridge:typeof window.nextplay.scanSteam,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0),nodeExposed:typeof window.require})`);console.log(JSON.stringify(result));const screenshotArg=process.argv.find(x=>x.startsWith('--capture='));if(screenshotArg){const capture=await win.webContents.capturePage();await fs.writeFile(screenshotArg.slice(10),capture.toPNG());await fs.writeFile(screenshotArg.slice(10)+'.json',JSON.stringify(result,null,2));}app.exit(result.cards===4&&result.bridge==='function'&&result.images&&result.nodeExposed==='undefined'?0:1);}catch(e){console.error(e);app.exit(1);}}
});
app.on('window-all-closed',()=>app.quit());
