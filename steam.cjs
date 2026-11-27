const fs=require('node:fs/promises');const path=require('node:path');
async function scanSteamFolder(selected){
 let folder=path.resolve(selected);let files=await fs.readdir(folder,{withFileTypes:true});
 if(files.some(f=>f.isDirectory()&&f.name.toLowerCase()==='steamapps')){folder=path.join(folder,files.find(f=>f.isDirectory()&&f.name.toLowerCase()==='steamapps').name);files=await fs.readdir(folder,{withFileTypes:true});}
 const manifests=files.filter(f=>f.isFile()&&/^appmanifest_\d+\.acf$/i.test(f.name));if(!manifests.length)throw Error('No manifests');
 const games=[];for(const f of manifests.slice(0,2000)){const filename=path.join(folder,f.name);try{const s=await fs.stat(filename);if(s.size>1000000)continue;const data=await fs.readFile(filename,'utf8');const id=Number(data.match(/"appid"\s*"(\d+)"/i)?.[1]);const name=data.match(/"name"\s*"([^"]+)"/i)?.[1];if(id)games.push({id,name:name||String(id)});}catch{}}
 return games;
}
module.exports={scanSteamFolder};
