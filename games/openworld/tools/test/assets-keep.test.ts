// The asset copy's contract (copyAssets.ts): running `npm run assets` rebuilds public/assets/na/ from the pack,
// deleting everything not copied. Every committed file there must therefore be named by the catalogue or by the
// script's KEEP list — otherwise the next run deletes a file the game or its tools read.

import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KEEP, catalogPaths } from '../src/copyAssets.ts'

const OUT = fileURLToPath(new URL('../../public/assets/na/', import.meta.url))

function committed(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else out.push(relative(OUT, p))
    }
  }
  walk(dir)
  return out
}

describe('the copied pack subset', () => {
  it("keeps every committed file: the catalogue plus the tools' own keep-list cover them all", () => {
    const want = new Set([...catalogPaths(), ...KEEP])
    const files = committed(OUT)
    expect(files.length).toBeGreaterThan(0)
    const uncovered = files.filter((f) => !want.has(f))
    expect(uncovered, `files npm run assets would delete (add them to KEEP or the catalogue): ${uncovered.join(', ')}`).toEqual([])
  })

  it('has every file it promises to keep on disk', () => {
    const files = new Set(committed(OUT))
    for (const p of KEEP) expect(files.has(p), `KEEP names a file that is not committed: ${p}`).toBe(true)
  })
})
