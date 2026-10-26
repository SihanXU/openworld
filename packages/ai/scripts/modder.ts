// npm run modder -- <command>
//   serve [port]              run the modder service (default 8787) on --host <addr> / $LSW_HOST (default 127.0.0.1:
//                             this machine only; a deployment for players elsewhere passes 0.0.0.0)
//   stats                     self-state and shared-library numbers
//   snapshot <label>          freeze the self-state (benchmark checkpoints, ablations)
//   export [label]            print the self-state as one document (now, or a snapshot)
//   library                   list the patch rules in the shared library
//   library remove <rule-id>  roll a patch rule back
//   library prune             roll back the patches the validator no longer takes (serve does it at start)
// The game: --game <game> or $OPENWORLD_GAME — a bundle (bundle.json, or its folder), a project's folder (its
// game.json), or a module whose default export is its GameDef (the root script passes games/openworld's). Data: --data <dir> or $LSW_DATA (default <repo>/var). Model: LSW_MODEL_URL + LSW_MODEL_KEY +
// LSW_MODEL (OpenAI-compatible), --backend claude-code (claude -p; LSW_CLAUDE_MODEL, LSW_CLAUDE_EFFORT;
// --fast for fast mode), --backend none, or --script <file> / LSW_MODEL_SCRIPT (scripted, no network). See modelFromEnv.
// The story's protected facts (a commit is judged with them, as every client judges what it syncs): a project's
// folder or a bundle's own world index, or --world <index.json> / $LSW_WORLD (a game given as a module has none).

import { existsSync, readFileSync, statSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import type { GameDef, WorldIndex } from '@openworld/engine'
import { compileProject } from '@openworld/format/src/node.ts'
import { scriptFromFile } from '../src/index.ts'
import { REPO, loadGame, openModder } from '../src/service/open.ts'
import { createModderServer } from '../src/service/server.ts'

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i < 0 ? undefined : argv.splice(i, 2)[1]
}
const script = flag('script')
const backend = flag('backend')
if (backend) process.env.LSW_MODEL_BACKEND = backend
if (argv.includes('--fast')) (argv.splice(argv.indexOf('--fast'), 1), (process.env.LSW_CLAUDE_FAST = '1'))
const data = flag('data')
const host = flag('host') ?? process.env.LSW_HOST ?? '127.0.0.1'
const gameModule = flag('game') ?? process.env.OPENWORLD_GAME
if (!gameModule) throw new Error('which game? --game <game> (or OPENWORLD_GAME): a bundle, a project\'s folder, or a module whose default export is the GameDef')
const game = await loadGame(gameModule)
const world = flag('world') ?? process.env.LSW_WORLD
const [cmd = 'serve', ...args] = argv
const stamp = () => new Date().toISOString().slice(11, 19)
const modder = openModder({
  game,
  data: data ? resolve(REPO, data) : undefined,
  model: script ? scriptFromFile(resolve(REPO, script)) : undefined,
  log: (l) => console.log(`[${stamp()}] ${l}`),
})
const { library, state } = modder.opts
library.protectedFacts = protectedFactsOf(gameModule, game, world)

/** The story's protected fact prefixes: from the world index given, the project's, the bundle's, or the game's own. */
function protectedFactsOf(module: string, g: GameDef, index?: string): string[] {
  const read = (file: string) => (JSON.parse(readFileSync(file, 'utf8')) as Partial<WorldIndex>).protectedFacts ?? []
  if (index) return read(resolve(REPO, index))
  const at = resolve(REPO, module)
  const dir = existsSync(at) && statSync(at).isDirectory()
  if (dir && existsSync(join(at, 'game.json')) && !existsSync(join(at, 'bundle.json'))) return compileProject(at).index.protectedFacts ?? []
  const beside = join(at.endsWith('.json') ? dirname(at) : at, 'world', 'index.json')
  if ((at.endsWith('.json') || dir) && existsSync(beside)) return read(beside)
  return (g as GameDef & { protectedFacts?: string[] }).protectedFacts ?? []
}

switch (cmd) {
  case 'serve': {
    const port = Number(args[0] ?? process.env.LSW_PORT ?? 8787)
    // what the validator no longer takes leaves the library before any client can sync it
    const pruned = library.prune()
    const server = createModderServer(modder, { game: game.id })
    server.listen(port, host, () => {
      const at = server.address() as AddressInfo
      console.log(`modder on http://${at.family === 'IPv6' ? `[${at.address}]` : at.address}:${at.port}  model: ${modder.model?.name ?? '(none: answers from the shared library only)'}`)
      for (const p of pruned) console.log(`library: rolled back ${p.rules.join(', ')}: ${p.reason}`)
      console.log(`library: ${library.patchRules().length} patch rules (seq ${library.seq}, log ${library.logId}) · self-state: ${state.dir}`)
      console.log(library.protectedFacts.length ? `library: ${library.protectedFacts.length} protected fact prefixes` : 'library: no protected facts known (--world <index.json>): commits are not checked against the story\'s facts')
    })
    break
  }
  case 'stats':
    console.log(JSON.stringify({ library: { seq: library.seq, patches: library.patchRules().length }, state: state.stats(), snapshots: state.snapshots() }, null, 2))
    break
  case 'snapshot':
    if (!args[0]) throw new Error('usage: snapshot <label>')
    console.log(state.snapshot(args[0], { library: { seq: library.seq, patches: library.patchRules().length } }))
    break
  case 'export': {
    const p = args[0] ? join(state.dir, 'snapshots', args[0], 'SELF.md') : undefined
    if (p && !existsSync(p)) throw new Error(`no snapshot "${args[0]}"`)
    process.stdout.write(p ? readFileSync(p, 'utf8') : state.render())
    break
  }
  case 'library':
    if (args[0] === 'audit') {
      // the patches that make something from nothing: listed, for you to remove (library remove <id>)
      const bad = library.audit()
      for (const b of bad) console.log(`${b.rule}  ${b.reason}`)
      console.log(`${library.patchRules().length} patch rules, ${library.asked.length} with the event that asked for them: ` + (bad.length ? `${bad.length} to review (npm run modder -- library remove <id>)` : 'none makes something from nothing'))
      break
    }
    if (args[0] === 'prune') {
      // the patches the validator, as it is now, no longer takes: rolled back (serve does this at start)
      const gone = library.prune()
      for (const p of gone) console.log(`rolled back ${p.rules.join(', ')}: ${p.reason}`)
      console.log(gone.length ? `${gone.length} patch(es) rolled back` : 'every patch still holds')
      break
    }
    if (args[0] === 'remove') {
      if (!args[1]) throw new Error('usage: library remove <rule-id>')
      console.log(library.remove(args[1]) ? `removed ${args[1]}` : `no patch rule "${args[1]}"`)
      break
    }
    for (const r of library.patchRules()) console.log(`${r.id}  ${r.source?.at?.slice(0, 19) ?? ''}  ${r.doc ?? ''}`)
    break
  default:
    console.error(`unknown command "${cmd}"`)
    process.exit(1)
}
