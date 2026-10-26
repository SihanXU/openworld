import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// The engine side imports no game (docs/engine-split.md, S1): games/* may import packages/*, never the
// reverse, and among the packages the direction is engine ← modules ← runtime, modules ← modder → agent,
// engine ← stdlib ← format; the runtime runs the player's own modder in a worker (docs/byok.md): runtime → modder. A game reaches the engine side only by being handed over (GameDef, ClientGame, a
// bundle), never by being imported; and no game imports another.

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

/** What each package's code may import of ours. */
const MAY_IMPORT: Record<string, string[]> = {
  engine: [],
  agent: [],
  modules: ['@openworld/engine'],
  stdlib: ['@openworld/engine'],
  format: ['@openworld/engine', '@openworld/stdlib', '@openworld/modules'],
  editor: ['@openworld/engine', '@openworld/stdlib', '@openworld/format', '@openworld/modules', '@openworld/runtime'],
  modder: ['@openworld/engine', '@openworld/modules', '@openworld/format', '@openworld/agent'],
  runtime: ['@openworld/engine', '@openworld/modules', '@openworld/format', '@openworld/modder', '@openworld/agent'],
}

/**
 * Tests that still exercise the engine side on the game's content, until the starter game is their
 * fixture (docs/engine-split.md, P2). The list only shrinks: a test that no longer needs the game leaves it.
 */
const TESTS_ON_THE_GAME = new Set([
  'packages/modder/test/audit.test.ts',
  'packages/modder/test/economy.test.ts',
  // (the god loop's and the promotion detector's, written on the game's content before the split)
  'packages/modder/test/god-loop.test.ts',
  'packages/modder/test/leaf-trees.test.ts',
  'packages/modder/test/modder.test.ts',
  'packages/modder/test/promote.test.ts',
  'packages/modder/test/prune.test.ts',
  'packages/modder/test/repo.test.ts',
  'packages/modder/test/shackles.test.ts',
  'packages/modder/test/validation-cache.test.ts',
])

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.split(sep).includes('node_modules'))
    .map((f) => join(dir, f))
}

/** Every module a file imports (static, dynamic, re-exports, side effects). */
function specifiers(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

/** What an import reaches: one of our packages by name, a path in the repository, or something else. */
function target(file: string, spec: string): string {
  if (spec.startsWith('.')) return relative(ROOT, resolve(dirname(file), spec)).split(sep).join('/')
  const scoped = spec.match(/^(@[^/]+\/[^/]+)/)
  return scoped ? scoped[1] : spec
}

const ours = (t: string) => t.startsWith('@openworld/') || t.startsWith('@openworld-game/')

describe('the engine side imports no game (docs/engine-split.md, S1)', () => {
  const packages = readdirSync(join(ROOT, 'packages')).filter((p) => existsSync(join(ROOT, 'packages', p, 'package.json')))

  it('every package has a rule', () => {
    expect(packages.filter((p) => !(p in MAY_IMPORT))).toEqual([])
  })

  it("a package's code imports only what its rule allows, and nothing of a game's", () => {
    const found: string[] = []
    for (const p of packages)
      for (const f of files(join(ROOT, 'packages', p, 'src')))
        for (const spec of specifiers(f)) {
          const t = target(f, spec)
          const where = relative(ROOT, f).split(sep).join('/')
          if (t.startsWith('games/') || t.startsWith('@openworld-game/')) found.push(`${where}: ${spec} (a game)`)
          else if (ours(t) && t !== `@openworld/${p}` && !MAY_IMPORT[p].includes(t)) found.push(`${where}: ${spec}`)
          else if (!spec.startsWith('.') ? false : !t.startsWith(`packages/${p}/`)) found.push(`${where}: ${spec} (outside its package)`)
        }
    expect(found).toEqual([])
  })

  it("a package's tests leave the game alone, but for those still listed, each of which still needs it", () => {
    const onGame = new Set<string>()
    const found: string[] = []
    for (const p of packages)
      for (const f of files(join(ROOT, 'packages', p, 'test'))) {
        // (this file's examples of what the scan sees are not imports)
        if (f === import.meta.filename) continue
        const where = relative(ROOT, f).split(sep).join('/')
        const game = specifiers(f).some((spec) => {
          const t = target(f, spec)
          return t.startsWith('games/') || t.startsWith('@openworld-game/')
        })
        if (game) onGame.add(where)
        if (game && !TESTS_ON_THE_GAME.has(where)) found.push(where)
      }
    expect(found).toEqual([])
    // (judged where their package is here: a copy of the engine alone, an engine task's workspace, has no modder)
    const here = (f: string) => existsSync(join(ROOT, ...f.split('/').slice(0, 2)))
    expect([...TESTS_ON_THE_GAME].filter((f) => here(f) && !onGame.has(f))).toEqual([])
  })

  it('no game imports another game', () => {
    const games = readdirSync(join(ROOT, 'games')).filter((g) => existsSync(join(ROOT, 'games', g)))
    // a game's packages, by name (games/<id>/<part>/package.json)
    const own = (g: string) => new Set(readdirSync(join(ROOT, 'games', g)).flatMap((d) => { const f = join(ROOT, 'games', g, d, 'package.json'); return existsSync(f) ? [JSON.parse(readFileSync(f, 'utf8')).name as string] : [] }))
    const found: string[] = []
    for (const g of games) {
      const mine = own(g)
      for (const f of files(join(ROOT, 'games', g)))
        for (const spec of specifiers(f)) {
          const t = target(f, spec)
          const where = relative(ROOT, f).split(sep).join('/')
          if (t.startsWith('@openworld-game/') && !mine.has(t)) found.push(`${where}: ${spec}`)
          if (t.startsWith('games/') && !t.startsWith(`games/${g}/`)) found.push(`${where}: ${spec}`)
        }
    }
    expect(found).toEqual([])
  })

  it('the scan sees every way of importing', () => {
    const at = join(ROOT, 'packages', 'engine', 'src', 'x.ts')
    const seen = (src: string) => [...src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => target(at, m[1] ?? m[2] ?? m[3]))
    expect(seen("import { a } from '@openworld-game/content'")).toEqual(['@openworld-game/content'])
    expect(seen("import type { A } from '../../../games/openworld/content/src/index.ts'")).toEqual(['games/openworld/content/src/index.ts'])
    expect(seen("export * from '@openworld/runtime/src/game.ts'")).toEqual(['@openworld/runtime'])
    expect(seen("import './register.ts'")).toEqual(['packages/engine/src/register.ts'])
    expect(seen("const m = await import('@openworld-game/content')")).toEqual(['@openworld-game/content'])
    expect(seen('import {\n  a,\n  b,\n} from "@openworld/agent"')).toEqual(['@openworld/agent'])
  })
})

