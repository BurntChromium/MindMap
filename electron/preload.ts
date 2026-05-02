import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mindmapDesktop', {
  invoke: (channel: string, request: { method: string; payload?: unknown }) =>
    ipcRenderer.invoke(channel, request)
});
