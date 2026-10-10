// The editor's service (src/server/api.ts): over a folder of games it lists the projects, reads one, writes the
// format's files as the format writes them (and nothing else), makes a new project from the starter, and says
// what the compiler finds.

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { formatJson } from '@openworld/format'
import { ProjectsApi } from '../src/server/api.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const games = mkdtempSync(join(tmpdir(), 'games-'))
cpSync(STARTER, join(games, 'starter'), { recursive: true })
const api = new ProjectsApi(games)
afterAll(() => rmSync(games, { recursive: true, force: true }))

describe.skipIf(!existsSync(STARTER))('the editor\'s service', () => {
  it('lists the projects and reads one', () => {
    expect(api.list().map((p) => p.id)).toEqual(['starter'])
    const p = api.read('starter')
    expect(p.maps.map((m) => m.data.map.id).sort()).toEqual(['cottage', 'glade'])
  })

  it('writes a file as the format writes it, and the compiler sees it', () => {
    const p = api.read('starter')
    const glade = p.maps.find((m) => m.data.map.id === 'glade')!
    glade.data.map.rows[2] = 'T~~~~.T.........XXXXXX.T'
    api.write('starter', glade.file, glade.data)
    expect(readFileSync(join(games, 'starter', glade.file), 'utf8')).toBe(formatJson(glade.data))
    expect(api.problems('starter').problems).toEqual([])
  })

  it('writes nothing outside the format\'s files', () => {
    expect(() => api.write('starter', '../escape.json', {})).toThrow(/only the format's files/)
    expect(() => api.write('starter', 'test/kernel.test.ts', {})).toThrow(/only the format's files/)
    expect(() => api.write('nowhere', 'game.json', {})).toThrow(/no project/)
  })

  it('makes a new project from the starter, its own id and name, without the starter\'s tests', () => {
    api.create('meadow', { en: 'The Meadow', zh: '草地' })
    expect(existsSync(join(games, 'meadow', 'test'))).toBe(false)
    expect(api.read('meadow').game).toMatchObject({ id: 'meadow', name: { en: 'The Meadow', zh: '草地' } })
    expect(api.problems('meadow').problems).toEqual([])
    expect(() => api.create('meadow', 'x')).toThrow(/exists/)
    expect(() => api.create('Bad Id', 'x')).toThrow(/not a project id/)
  })
})
