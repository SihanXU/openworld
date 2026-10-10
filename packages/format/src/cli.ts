// The format's command line: a project checked, or built where a player can fetch it.
//   npm run game -- check games/starter
//   npm run game -- build games/starter --out dist/games/starter

import { cpSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
// the engine's official modules, which a project may name (docs/engine-split.md S3)
import '@openworld/modules'
import { compileProject, writeCompiled } from './node.ts'

const [cmd, dir, ...rest] = process.argv.slice(2)
if (!cmd || !dir || !['check', 'build'].includes(cmd)) {
  console.log('usage: game check <project> | game build <project> --out <dir>')
  process.exit(2)
}
const root = resolve(dir)
const c = compileProject(root)
for (const p of c.problems) console.log(`${p.level === 'error' ? 'error' : 'warning'} [${p.code}] ${p.file ?? ''}${p.at ? ` (${p.at})` : ''}: ${p.message}`)
const errors = c.problems.filter((p) => p.level === 'error').length
console.log(`${c.bundle.game.id}: ${c.index.stats.maps} maps, ${c.index.stats.npcs} people, ${c.bundle.rules.length} rules — ${errors} errors, ${c.problems.length - errors} warnings`)
if (errors) process.exit(1)
if (cmd === 'build') {
  const at = rest.indexOf('--out')
  const out = resolve(at >= 0 ? rest[at + 1] : join(root, 'dist'))
  writeCompiled(out, c)
  if (existsSync(join(root, 'assets'))) cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true })
  console.log(`→ ${out}`)
}
