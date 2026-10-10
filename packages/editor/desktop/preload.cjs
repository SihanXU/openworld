// What the desktop shell gives the editor's page (packages/editor/src/app/api.ts `desktop()`): the system's own
// folder dialog, and a folder shown in the file manager. Nothing else of the machine reaches the page.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('openworld', {
  pickFolder: (o) => ipcRenderer.invoke('pick-folder', o ?? {}),
  showFolder: (path) => ipcRenderer.invoke('show-folder', path),
})
