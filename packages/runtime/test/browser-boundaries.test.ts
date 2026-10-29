/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

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
  it('all browser entry files exist (the AI\'s only while the AI is in the tree: the game plays without it)', () => {
    const ai = existsSync(join(ROOT, 'packages', 'ai'))
    expect(IN_A_BROWSER.filter((f) => (ai || !f.startsWith('packages/ai/')) && !existsSync(join(ROOT, f)))).toEqual([])
  })

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
    // (the walk went where it should: the pipeline and the self-state are among what it read, in a checkout with the AI)
    if (existsSync(join(ROOT, 'packages', 'ai'))) expect([...seen].map((f) => relative(ROOT, f).split(sep).join('/'))).toEqual(expect.arrayContaining(['packages/ai/src/modder/pipeline.ts', 'packages/ai/src/agent/state.ts', 'packages/ai/src/player/localModder.ts']))
  })
})
