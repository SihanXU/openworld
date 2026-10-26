// The command lines start (scripts/): each is run as `npm run` runs it, on work that costs nothing, so a missing
// file, a path that moved or an entry that forgot to load the disk fails here and not at the first real run.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = fileURLToPath(new URL('../../..', import.meta.url))
const TSX = join(REPO, 'node_modules/tsx/dist/cli.mjs')

function run(script: string, args: string[]): { code: number | null; out: string } {
  const { LSW_MODEL_KEY: _k, ...env } = process.env
  const r = spawnSync(process.execPath, [TSX, join(REPO, 'packages/ai/scripts', script), ...args], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...env, LSW_MODEL_BACKEND: 'none', LSW_MODEL_SCRIPT: join(REPO, 'packages/ai/fixtures/offline.json') },
  })
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}

describe('the command lines', () => {
  it('agent swe runs no instance and writes the run\'s manifest, with the hash of the agent\'s own code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-scripts-'))
    writeFileSync(join(dir, 'instances.json'), '[]')
    const r = run('agent.ts', ['swe', '--instances', join(dir, 'instances.json'), '--out', join(dir, 'pred.jsonl'), '--state', join(dir, 'state')])
    expect(r.code, r.out).toBe(0)
    const manifest = JSON.parse(readFileSync(join(dir, 'pred.jsonl.manifest.json'), 'utf8'))
    expect(manifest.agentCode).toMatch(/^[0-9a-f]{64}$/)
    expect(existsSync(join(dir, 'state', 'harness'))).toBe(true)
  })

  it('modder stats reads a game and a fresh data folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lsw-scripts-'))
    const r = run('modder.ts', ['--game', 'games/starter', '--data', dir, '--backend', 'none', 'stats'])
    expect(r.code, r.out).toBe(0)
  })
})

/** A path written into a workspace the code builds, not one next to the file that names it. */
const ELSEWHERE = new Set(['games/openworld/ai/src/upstream.ts: ./sweep.json'])

const sources = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? sources(join(dir, d.name)) : /\.(ts|mjs)$/.test(d.name) ? [join(dir, d.name)] : [])) : []

describe('the paths the AI names from its own files', () => {
  it('lead somewhere: every new URL(…, import.meta.url) in packages/ai and games/*/ai exists', () => {
    const games = readdirSync(join(REPO, 'games')).map((g) => join(REPO, 'games', g, 'ai'))
    const missing: string[] = []
    for (const f of [join(REPO, 'packages/ai'), ...games].flatMap(sources).filter((f) => !f.includes('node_modules') && !f.includes('/tasks/')))
      for (const m of readFileSync(f, 'utf8').matchAll(/new URL\('([^']+)', import\.meta\.url\)/g)) {
        const where = `${relative(REPO, f).split('\\').join('/')}: ${m[1]}`
        if (!ELSEWHERE.has(where) && !existsSync(resolve(dirname(f), m[1]))) missing.push(where)
      }
    expect(missing).toEqual([])
  })
})
