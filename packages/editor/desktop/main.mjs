// The OpenWorld Editor as a desktop application (docs/engine-split.md §15): the editor's own server (the built
// editor in ../dist, or in the installed application's resources) started inside the application on a free
// port of this machine, its page in a window. What a browser cannot give the page, the shell does through
// preload.cjs: the system's folder dialog, a folder shown in the file manager. The playtest and a tried export
// open in windows of their own; any other link in the system's browser.

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The built editor: the application's own copy, or (run from the repository) the one npm run editor:build makes. */
const ROOT = app.isPackaged ? join(process.resourcesPath, 'editor') : join(HERE, '..', 'dist')
/** Run from the repository, its games are listed too. */
const GAMES = join(HERE, '..', '..', '..', 'games')

if (!existsSync(join(ROOT, 'server', 'server.js'))) {
  dialog.showErrorBox('OpenWorld Editor', `The editor is not built (${ROOT}). Run npm run editor:build first.`)
  app.exit(1)
}
const { startEditor } = await import(pathToFileURL(join(ROOT, 'server', 'server.js')).href)

if (!app.requestSingleInstanceLock()) app.quit()

let server
let main

async function open() {
  server ??= await startEditor({
    root: ROOT,
    port: 0,
    shell: 'desktop',
    home: join(app.getPath('userData'), 'editor'),
    projects: join(app.getPath('documents'), 'OpenWorld Projects'),
    shelves: !app.isPackaged && existsSync(GAMES) ? [GAMES] : [],
  })
  const origin = new URL(server.url).origin
  main = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'OpenWorld Editor',
    backgroundColor: '#14171f',
    autoHideMenuBar: true,
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  main.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 800, autoHideMenuBar: true, backgroundColor: '#0b0d12', webPreferences: { contextIsolation: true, sandbox: true } } }
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  // the editor asks before its unsaved changes are lost: a browser would ask itself, the shell asks here
  main.webContents.on('will-prevent-unload', (e) => {
    const r = dialog.showMessageBoxSync(main, { type: 'question', buttons: ['Leave', 'Stay'], defaultId: 1, cancelId: 1, title: 'Unsaved changes', message: 'The project has unsaved changes. Leave without saving them?' })
    if (r === 0) e.preventDefault()
  })
  await main.loadURL(server.url)
}

ipcMain.handle('pick-folder', async (e, o = {}) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: o.title, defaultPath: o.defaultPath, properties: ['openDirectory', 'createDirectory'] })
  return r.canceled ? undefined : r.filePaths[0]
})
ipcMain.handle('show-folder', (_e, path) => shell.openPath(String(path)))

app.on('second-instance', () => {
  if (main) (main.isMinimized() && main.restore(), main.focus())
})
app.whenReady().then(open)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void open()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('quit', () => void server?.close())
