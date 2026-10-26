import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// The engine side imports no game (docs/engine-split.md, S1): games/* may import packages/*, never the
// reverse, and among the packages the direction is engine ← modules ← runtime, engine ← stdlib ← format, and the AI
// (packages/ai) over them all. Nothing imports the AI but itself and a game's own AI (games/<id>/ai): the runtime finds
// its plugin by a glob (runtime/src/ai.ts), so the game plays with the AI deleted. A game reaches the engine side only
// by being handed over (GameDef, ClientGame, a bundle), never by being imported; and no game imports another.

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

/** What each package's code may import of ours. */
const MAY_IMPORT: Record<string, string[]> = {
  engine: [],
  modules: ['@openworld/engine'],
  stdlib: ['@openworld/engine'],
  format: ['@openworld/engine', '@openworld/stdlib', '@openworld/modules'],
  editor: ['@openworld/engine', '@openworld/stdlib', '@openworld/format', '@openworld/modules', '@openworld/runtime'],
  runtime: ['@openworld/engine', '@openworld/modules', '@openworld/format'],
  // (the runtime's protocol with the player's own modder, which the AI's plugin speaks: runtime/src/modderProtocol.ts)
  ai: ['@openworld/engine', '@openworld/modules', '@openworld/format', '@openworld/runtime'],
}

/**
 * Tests that still exercise the engine side on the game's content, until the starter game is their
 * fixture (docs/engine-split.md, P2). The list only shrinks: a test that no longer needs the game leaves it.
 */
const TESTS_ON_THE_GAME = new Set([
  'packages/ai/test/audit.test.ts',
  'packages/ai/test/economy.test.ts',
  // (the god loop's and the promotion detector's, written on the game's content before the split)
  'packages/ai/test/god-loop.test.ts',
  'packages/ai/test/leaf-trees.test.ts',
  'packages/ai/test/modder.test.ts',
  'packages/ai/test/promote.test.ts',
  'packages/ai/test/prune.test.ts',
  'packages/ai/test/repo.test.ts',
  'packages/ai/test/shackles.test.ts',
  'packages/ai/test/validation-cache.test.ts',
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

  const NAME_THE_AI = new Set(['packages/runtime/src/ai.ts', 'games/openworld/tools/src/dev.ts', 'packages/engine/test/boundaries.test.ts'])
  it('nothing reaches the AI but itself and a game\'s own AI: delete packages/ai and games/*/ai, and the game plays', () => {
    const outside = [
      ...readdirSync(join(ROOT, 'packages')).filter((p) => p !== 'ai').flatMap((p) => [...files(join(ROOT, 'packages', p, 'src')), ...files(join(ROOT, 'packages', p, 'test')), ...files(join(ROOT, 'packages', p, 'scripts'))]),
      ...readdirSync(join(ROOT, 'games')).flatMap((g) => readdirSync(join(ROOT, 'games', g), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'ai').flatMap((d) => files(join(ROOT, 'games', g, d.name)))),
    ]
    const found: string[] = []
    for (const f of outside) {
      const where = relative(ROOT, f).split(sep).join('/')
      for (const spec of specifiers(f)) {
        const t = target(f, spec)
        if (t === '@openworld/ai' || t.startsWith('packages/ai/') || /^games\/[^/]+\/ai\//.test(t) || /^@openworld-game\/ai$/.test(t)) found.push(`${where}: ${spec}`)
      }
      // the ways in that look first: the runtime's glob for the AI's plugin (it finds nothing when the AI is gone),
      // dev starting the modder only when packages/ai is there, and this test
      if (!NAME_THE_AI.has(where) && /packages\/ai\/|\.\.\/ai\/src/.test(readFileSync(f, 'utf8'))) found.push(`${where}: names the AI's files`)
    }
    expect(found).toEqual([])
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
    expect(seen('import {\n  a,\n  b,\n} from "@openworld/ai"')).toEqual(['@openworld/ai'])
  })
})

// What a browser runs of the AI (docs/byok.md): the player's own modder in a worker of the page, and
// the page's settings. Everything they reach, value import by value import, is free of Node.
const IN_A_BROWSER = ['packages/ai/src/browser.ts', 'packages/ai/src/player/index.ts', 'packages/ai/src/player/worker.ts', 'packages/runtime/src/ai.ts', 'packages/runtime/src/ownModel.ts', 'packages/runtime/src/ui/modelSettings.ts']
const NODE = new Set(['fs', 'path', 'os', 'crypto', 'child_process', 'url', 'http', 'https', 'module', 'util', 'stream', 'events', 'worker_threads', 'net', 'zlib'])

/** What a file imports for its values (a type-only import or export is gone once it is compiled). */
function valueSpecifiers(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/(?:^|\n)\s*(import|export)(\s+type)?\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g))
    if (!m[2]) out.push(m[3] ?? m[4] ?? m[5])
  return out
}

/** Where an import of ours leads (a package's main or a file in it), or undefined for another's. */
function fileOf(from: string, spec: string): string | undefined {
  if (spec.startsWith('.')) return resolve(dirname(from), spec)
  const m = spec.match(/^@openworld\/([^/]+)(\/.*)?$/)
  if (!m) return undefined
  return m[2] ? join(ROOT, 'packages', m[1], m[2]) : join(ROOT, 'packages', m[1], 'src', 'index.ts')
}

describe('what runs in a browser imports no Node (docs/byok.md)', () => {
  it('the player\'s own modder and its settings reach no Node module', () => {
    const found: string[] = []
    const seen = new Set<string>()
    const todo = IN_A_BROWSER.map((f) => join(ROOT, f))
    while (todo.length) {
      const f = todo.pop()!
      if (seen.has(f) || !existsSync(f)) continue
      seen.add(f)
      for (const spec of valueSpecifiers(f)) {
        const where = relative(ROOT, f).split(sep).join('/')
        if (spec.startsWith('node:') || NODE.has(spec)) found.push(`${where}: ${spec}`)
        const next = fileOf(f, spec)
        if (next) todo.push(next)
      }
    }
    expect(found).toEqual([])
    // (the walk went where it should: the pipeline and the self-state are among what it read)
    expect([...seen].map((f) => relative(ROOT, f).split(sep).join('/'))).toEqual(expect.arrayContaining(['packages/ai/src/modder/pipeline.ts', 'packages/ai/src/agent/state.ts', 'packages/ai/src/player/localModder.ts']))
  })
})

