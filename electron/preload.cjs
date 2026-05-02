const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mindmapDesktop', {
  invoke: (channel, request) => ipcRenderer.invoke(channel, request)
});
