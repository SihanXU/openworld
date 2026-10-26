// The package's layout (docs/AGENTS.md): its top level, the domain folders of src/, and the one direction their
// imports go. A folder imports only the folders below it, so each can be read knowing only what it stands on.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PKG = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(PKG, 'src')

/** The domains from the bottom up: each may import those before it, never those after. */
const LAYERS = ['models', 'agent', 'checks', 'library', 'modder', 'service', 'player']

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? sources(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []))

/** What a file imports for its values (a type-only import is gone once it is compiled). */
const valueImports = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)(\s+type)?\s[^'"]*?from\s*['"]([^'"]+)['"]/gm)].filter((m) => !m[1]).map((m) => m[2])

describe('the AI package', () => {
  it('holds its code in src, its entry points in scripts, its tests in test, and nothing loose', () => {
    expect(readdirSync(PKG).sort()).toEqual(['docs', 'fixtures', 'package.json', 'sandbox', 'scripts', 'src', 'test', 'tsconfig.json'])
    const loose = readdirSync(SRC, { withFileTypes: true }).filter((d) => !d.isDirectory()).map((d) => d.name)
    expect(loose.sort()).toEqual(['browser.ts', 'index.ts', 'util.ts'])
    const folders = readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    expect(folders.sort()).toEqual([...LAYERS].sort())
  })

  it('imports downward only: a folder never reaches one above it, and src never reaches scripts or test', () => {
    const found: string[] = []
    for (const [i, layer] of LAYERS.entries())
      for (const file of sources(join(SRC, layer)))
        for (const spec of valueImports(file)) {
          const m = spec.match(/^\.\.\/(?:\.\.\/)?([a-z]+)\//)
          if (!m) continue
          const to = LAYERS.indexOf(m[1])
          if (to > i || ['scripts', 'test'].includes(m[1])) found.push(`${layer}/${file.slice(join(SRC, layer).length + 1)}: ${spec}`)
        }
    expect(found).toEqual([])
  })
})
