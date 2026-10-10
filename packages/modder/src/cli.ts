// npm run modder -- <command>
//   serve [port]              run the modder service (default 8787)
//   stats                     self-state and shared-library numbers
//   snapshot <label>          freeze the self-state (benchmark checkpoints, ablations)
//   export [label]            print the self-state as one document (now, or a snapshot)
//   library                   list the patch rules in the shared library
//   library remove <rule-id>  roll a patch rule back
//   library prune             roll back the patches the validator no longer takes (serve does it at start)
// The game: --game <module> or $OPENWORLD_GAME, a module whose default export is its GameDef (the root
// script passes games/openworld's). Data: --data <dir> or $LSW_DATA (default <repo>/var). Model: LSW_MODEL_URL + LSW_MODEL_KEY +
// LSW_MODEL (OpenAI-compatible), --backend claude-code (claude -p; LSW_CLAUDE_MODEL, LSW_CLAUDE_EFFORT;
// --fast for fast mode), --backend none, or --script <file> / LSW_MODEL_SCRIPT (scripted, no network). See modelFromEnv.

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { scriptFromFile } from '@openworld/agent'
import { REPO, loadGame, openModder } from './open.ts'
import { createModderServer } from './server.ts'

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
const gameModule = flag('game') ?? process.env.OPENWORLD_GAME
if (!gameModule) throw new Error('which game? --game <module> (or OPENWORLD_GAME): a module whose default export is the GameDef')
const game = await loadGame(gameModule)
const [cmd = 'serve', ...args] = argv
const stamp = () => new Date().toISOString().slice(11, 19)
const modder = openModder({
  game,
  data: data ? resolve(REPO, data) : undefined,
  model: script ? scriptFromFile(resolve(REPO, script)) : undefined,
  log: (l) => console.log(`[${stamp()}] ${l}`),
})
const { library, state } = modder.opts

switch (cmd) {
  case 'serve': {
    const port = Number(args[0] ?? process.env.LSW_PORT ?? 8787)
    // what the validator no longer takes leaves the library before any client can sync it
    const pruned = library.prune()
    createModderServer(modder).listen(port, () => {
      console.log(`modder on http://localhost:${port}  model: ${modder.model?.name ?? '(none: answers from the shared library only)'}`)
      for (const p of pruned) console.log(`library: rolled back ${p.rules.join(', ')}: ${p.reason}`)
      console.log(`library: ${library.patchRules().length} patch rules (seq ${library.seq}) · self-state: ${state.dir}`)
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
