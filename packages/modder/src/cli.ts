// npm run modder -- <command>
//   serve [port]              run the modder service (default 8787)
//   stats                     self-state and shared-library numbers
//   snapshot <label>          freeze the self-state (benchmark checkpoints, ablations)
//   export [label]            print the self-state as one document (now, or a snapshot)
//   library                   list the patch rules in the shared library
//   library remove <rule-id>  roll a patch rule back
// Data: --data <dir> or $LSW_DATA (default <repo>/var). Model: LSW_MODEL_URL + LSW_MODEL_KEY +
// LSW_MODEL (OpenAI-compatible), or --script <file> / LSW_MODEL_SCRIPT (scripted, no network).

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { scriptFromFile } from './model.ts'
import { REPO, openModder } from './open.ts'
import { createModderServer } from './server.ts'

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i < 0 ? undefined : argv.splice(i, 2)[1]
}
const script = flag('script')
const data = flag('data')
const [cmd = 'serve', ...args] = argv
const stamp = () => new Date().toISOString().slice(11, 19)
const modder = openModder({
  data: data ? resolve(REPO, data) : undefined,
  model: script ? scriptFromFile(resolve(REPO, script)) : undefined,
  log: (l) => console.log(`[${stamp()}] ${l}`),
})
const { library, state } = modder.opts

switch (cmd) {
  case 'serve': {
    const port = Number(args[0] ?? process.env.LSW_PORT ?? 8787)
    createModderServer(modder).listen(port, () => {
      console.log(`modder on http://localhost:${port}  model: ${modder.model?.name ?? '(none: answers from the shared library only)'}`)
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
