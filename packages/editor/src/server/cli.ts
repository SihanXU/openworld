// The OpenWorld Editor from the command line (docs/engine-split.md §15): a built editor (npm run editor:build)
// started as a program of its own, its page opened in the browser.
//
//   node packages/editor/dist/server/cli.js [--port 5175] [--host 127.0.0.1] [--open] [--home <dir>]
//        [--projects <dir>] [--shelf <dir>]...

import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startEditor } from './server.ts'

/** The built editor's folder: the one above this script's (dist/server/cli.js → dist/). */
const ROOT = process.env.OPENWORLD_EDITOR_ROOT ?? dirname(dirname(fileURLToPath(import.meta.url)))

function args(argv: string[]) {
  const o: { port?: number; host?: string; open: boolean; home?: string; projects?: string; shelves: string[] } = { open: false, shelves: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') o.port = Number(argv[++i])
    else if (a === '--host') o.host = argv[++i]
    else if (a === '--open') o.open = true
    else if (a === '--home') o.home = argv[++i]
    else if (a === '--projects') o.projects = argv[++i]
    else if (a === '--shelf') o.shelves.push(argv[++i])
    else if (a === '--help' || a === '-h') {
      console.log('openworld-editor [--port 5175] [--host 127.0.0.1] [--open] [--home <dir>] [--projects <dir>] [--shelf <dir>]...')
      process.exit(0)
    } else throw new Error(`unknown argument ${a}`)
  }
  return o
}

/** The page opened in the system's browser. */
function openBrowser(url: string): void {
  const [cmd, ...rest] = process.platform === 'darwin' ? ['open', url] : process.platform === 'win32' ? ['cmd', '/c', 'start', '', url] : ['xdg-open', url]
  spawn(cmd, rest, { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
}

const o = args(process.argv.slice(2))
const s = await startEditor({ root: ROOT, port: o.port, host: o.host, home: o.home, projects: o.projects, shelves: o.shelves })
console.log(`OpenWorld Editor: ${s.url}`)
if (o.open) openBrowser(s.url)
