// The editor as a program of its own (src/server/server.ts): one server for the built editor's page, the built
// player, the service, the pack and the projects compiled as the player fetches them — anywhere on the disk.

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HEADER } from '../src/server/api.ts'
import { startEditor, type EditorServer } from '../src/server/server.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const root = mkdtempSync(join(tmpdir(), 'editor-dist-'))
let s: EditorServer
let base = ''

beforeAll(async () => {
  // a built editor's folder, as npm run editor:build lays it out
  mkdirSync(join(root, 'editor', 'assets'), { recursive: true })
  writeFileSync(join(root, 'editor', 'index.html'), '<!doctype html><title>OpenWorld Editor</title>')
  writeFileSync(join(root, 'editor', 'assets', 'index.js'), 'export {}')
  mkdirSync(join(root, 'player'), { recursive: true })
  writeFileSync(join(root, 'player', 'index.html'), '<!doctype html><title>OpenWorld Player</title>')
  mkdirSync(join(root, 'pack', 'Items'), { recursive: true })
  writeFileSync(join(root, 'pack', 'Items', 'a.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  cpSync(STARTER, join(root, 'templates', 'starter'), { recursive: true })
  s = await startEditor({ root, port: 0, home: join(root, 'home'), projects: join(root, 'projects') })
  base = s.url.replace(/\/editor\/$/, '')
})
afterAll(async () => {
  await s?.close()
  rmSync(root, { recursive: true, force: true })
})

describe('the editor\'s own server', () => {
  it('serves its page, the player and the pack, and sends / to the editor', async () => {
    expect(await (await fetch(`${base}/editor/`)).text()).toContain('OpenWorld Editor')
    expect((await fetch(`${base}/editor/assets/index.js`)).headers.get('content-type')).toBe('text/javascript')
    expect(await (await fetch(`${base}/runtime/play/`)).text()).toContain('OpenWorld Player')
    expect((await fetch(`${base}/pack/Items/a.png`)).status).toBe(200)
    expect((await fetch(`${base}/editor/../../home/recent.json`)).status).toBe(404)
    const r = await fetch(`${base}/`, { redirect: 'manual' })
    expect([r.status, r.headers.get('location')]).toEqual([302, '/editor/'])
  })

  it('makes a project from either template where it is told, and serves it compiled to the player', async () => {
    const ws = (await (await fetch(`${base}/api/workspace`)).json()) as { templates: { id: string }[]; projects: unknown[] }
    expect(ws.templates.map((t) => t.id)).toEqual(['starter', 'empty'])
    expect(ws.projects).toEqual([])
    const made = await fetch(`${base}/api/projects`, { method: 'POST', headers: { [HEADER]: '1' }, body: JSON.stringify({ template: 'empty', id: 'tiny', name: 'Tiny' }) })
    const p = (await made.json()) as { key: string; dir: string }
    expect(p).toMatchObject({ key: 'tiny', dir: join(root, 'projects', 'tiny') })
    const bundle = (await (await fetch(`${base}/games/tiny/bundle.json`)).json()) as { game: { id: string; name: string } }
    expect(bundle.game).toMatchObject({ id: 'tiny', name: 'Tiny' })
    const index = (await (await fetch(`${base}/games/tiny/world/index.json`)).json()) as { start: { map: string } }
    expect(index.start.map).toBe('world')
    expect((await fetch(`${base}/games/tiny/world/maps/world.json`)).status).toBe(200)
    expect((await fetch(`${base}/games/tiny/assets/na/Backgrounds/Tilesets/TilesetFloor.png`)).status).toBe(200)
    expect((await fetch(`${base}/games/nowhere/bundle.json`)).status).toBe(404)
  })

  it('refuses a broken project\'s bundle with its errors', async () => {
    writeFileSync(join(root, 'projects', 'tiny', 'game.json'), JSON.stringify({ id: 'tiny', name: 'Tiny', version: '1', seed: 1, start: { map: 'gone', x: 0, y: 0 }, terrainChars: { '.': 'grass' }, player: { id: 'player', type: 'actor/person/player', place: { on: 'none' } } }))
    const r = await fetch(`${base}/games/tiny/bundle.json`)
    expect(r.status).toBe(500)
    expect(await r.text()).toMatch(/does not compile/)
  })
})
