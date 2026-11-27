const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nextplay',{scanSteam:()=>ipcRenderer.invoke('scan-steam')});
