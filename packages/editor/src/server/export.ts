// A project exported as a game anyone can play (docs/engine-split.md §15): the engine's player, built, with the
// project compiled beside it — a folder of plain files any web server serves (itch.io takes its zip as an HTML
// game). The player opens the game it was exported with (a meta tag names it), so the folder's page is the game.
// Node only.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { formatJson } from '@openworld/format'
import { compileProject, writeCompiled } from '@openworld/format/src/node.ts'
import type { GameFolder } from '@openworld/format/src/serve.ts'
import { filesUnder, zipFolder } from './zip.ts'

/** What an export leaves in its folder, so that a later export may replace it (and nothing else is overwritten). */
export const MARK = 'openworld-export.json'

export interface ExportResult {
  dir: string
  files: number
  bytes: number
  zip?: { file: string; bytes: number }
  warnings: string[]
}

const text = (t: unknown): string => (typeof t === 'string' ? t : ((t as { en?: string })?.en ?? ''))
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Export a project: compile it (refused while it has errors), the player's files (not the games built beside it),
 * the game under game/ (its bundle, its world, its assets, the plugins it ships), a page that opens it, and a zip
 * of the whole when asked.
 */
export function exportGame(o: { game: GameFolder; player: string; out: string; zip?: boolean; now?: Date }): ExportResult {
  if (!o.game.project) throw new Error('only a project is exported')
  if (!existsSync(join(o.player, 'index.html'))) throw new Error(`no built player at ${o.player} (npm run build:player)`)
  const c = compileProject(o.game.project)
  const errors = c.problems.filter((p) => p.level === 'error')
  if (errors.length) throw new Error(`the project does not compile:\n${errors.slice(0, 12).map((p) => `${p.file ?? ''} ${p.at ?? ''}: ${p.message}`).join('\n')}`)
  const out = o.out
  if (existsSync(out)) {
    if (!statSync(out).isDirectory()) throw new Error(`${out} is a file`)
    if (readdirSync(out).length && !existsSync(join(out, MARK))) throw new Error(`${out} is not empty and is not an earlier export: choose an empty folder`)
    rmSync(out, { recursive: true, force: true })
  }
  mkdirSync(out, { recursive: true })
  const warnings: string[] = []
  // the player, without the games its build carries beside it
  cpSync(o.player, out, { recursive: true, filter: (s) => !(dirname(s) === o.player && basename(s) === 'games') })
  // the game
  const game = join(out, 'game')
  writeCompiled(game, c)
  if (existsSync(o.game.assets)) cpSync(o.game.assets, join(game, 'assets'), { recursive: true })
  else warnings.push('the project has no assets/: nothing will be drawn')
  for (const p of c.bundle.game.plugins ?? []) {
    const from = join(o.game.project, p)
    if (existsSync(from)) {
      mkdirSync(dirname(join(game, p)), { recursive: true })
      cpSync(from, join(game, p))
    } else warnings.push(`the plugin ${p} is not in the project as a script: the game will not load without it`)
  }
  // the page opens this game, by its name
  const name = text(c.bundle.game.name) || c.bundle.game.id
  const page = readFileSync(join(out, 'index.html'), 'utf8')
    .replace(/<title>[^<]*<\/title>/, `<title>${escHtml(name)}</title>`)
    .replace(/<meta name="openworld-game"[^>]*>\s*/g, '')
    .replace('</title>', '</title>\n    <meta name="openworld-game" content="game/" />')
    .replace(/<div class="kicker">[^<]*<\/div>/, `<div class="kicker">${escHtml(name)}</div>`)
  writeFileSync(join(out, 'index.html'), page)
  writeFileSync(
    join(out, 'README.txt'),
    [
      `${name} (version ${c.bundle.game.version}), made with OpenWorld.`,
      '',
      'Put this folder on any web server and open its index.html there (a browser will not run it from the disk',
      'itself). To try it here: `npx serve .` or `python -m http.server` in this folder, then http://localhost:3000',
      'or :8000. On itch.io: upload the zip as an HTML game.',
      '',
    ].join('\n'),
  )
  writeFileSync(join(out, MARK), formatJson({ game: c.bundle.game.id, version: c.bundle.game.version, format: c.bundle.format, exported: (o.now ?? new Date()).toISOString() }))
  const files = filesUnder(out)
  const bytes = files.reduce((n, f) => n + statSync(join(out, f)).size, 0)
  const result: ExportResult = { dir: out, files: files.length, bytes, warnings }
  if (o.zip) {
    const file = `${out.replace(/[\\/]+$/, '')}.zip`
    result.zip = { file, bytes: zipFolder(out, file, o.now) }
  }
  return result
}
