// The editor's service (src/server/api.ts, workspace.ts, assets.ts, export.ts): over a folder of games it lists the
// projects, reads one, writes the format's files as the format writes them (and nothing else), makes a new
// project from a template; a project anywhere on the disk opened, kept on the recent list, forgotten; pictures
// imported and taken from the pack; a project exported as a playable folder and its zip; and it answers only its
// own machine, every change carrying its header.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatJson } from '@openworld/format'
import { compileProject } from '@openworld/format/src/node.ts'
import { HEADER, ProjectsApi } from '../src/server/api.ts'
import { pngSize } from '../src/server/assets.ts'
import { MARK } from '../src/server/export.ts'
import { templatesOf } from '../src/server/server.ts'
import { Workspace, keyOf } from '../src/server/workspace.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'editor-'))
const games = join(tmp, 'games')
mkdirSync(games)
cpSync(STARTER, join(games, 'starter'), { recursive: true })
const api = new ProjectsApi(games)
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

/** A 2x3 PNG (the smallest a header is read from). */
const PNG = Buffer.from('89504e470d0a1a0a0000000d494844520000000200000003080600000000', 'hex')

/** The files of a zip, read back (its central directory, each entry inflated). */
function unzip(file: string): Map<string, Buffer> {
  const b = readFileSync(file)
  const end = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const n = b.readUInt16LE(end + 10)
  let at = b.readUInt32LE(end + 16)
  const out = new Map<string, Buffer>()
  for (let i = 0; i < n; i++) {
    const method = b.readUInt16LE(at + 10)
    const size = b.readUInt32LE(at + 20)
    const nameLen = b.readUInt16LE(at + 28)
    const local = b.readUInt32LE(at + 42)
    const name = b.toString('utf8', at + 46, at + 46 + nameLen)
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28)
    const body = b.subarray(start, start + size)
    out.set(name, method === 8 ? inflateRawSync(body) : Buffer.from(body))
    at += 46 + nameLen + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32)
  }
  return out
}

describe.skipIf(!existsSync(STARTER))('the editor\'s service', () => {
  it('lists the projects and reads one', () => {
    expect(api.list().map((p) => p.key)).toEqual(['starter'])
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
    api.create({ id: 'meadow', name: { en: 'The Meadow', zh: '草地' } })
    expect(existsSync(join(games, 'meadow', 'test'))).toBe(false)
    expect(api.read('meadow').game).toMatchObject({ id: 'meadow', name: { en: 'The Meadow', zh: '草地' } })
    expect(api.problems('meadow').problems).toEqual([])
    expect(() => api.create({ id: 'meadow', name: 'x' })).toThrow(/exists/)
    expect(() => api.create({ id: 'Bad Id', name: 'x' })).toThrow(/not a game id/)
  })
})

describe.skipIf(!existsSync(STARTER))('projects anywhere', () => {
  const home = join(tmp, 'home')
  const elsewhere = join(tmp, 'My Projects')
  const ws = () => new Workspace({ home, shelves: [games], templates: templatesOf(STARTER), projects: elsewhere })

  it('makes a project in any folder from either template, opens it, and remembers it across runs', () => {
    const a = ws().create({ template: 'starter', id: 'forest', name: 'The Forest' })
    expect(a).toMatchObject({ key: 'forest', id: 'forest', dir: join(elsewhere, 'forest'), maps: 2, people: 1 })
    const b = ws().create({ template: 'empty', id: 'blank', name: { en: 'Blank', zh: '空白' }, folder: join(tmp, 'deep', 'er'), dirName: 'Blank Game' })
    expect(b).toMatchObject({ key: 'blank-game', maps: 1, people: 0 })
    // the empty project: one map, no people, quests or story; it compiles clean and begins on its map
    const c = compileProject(b.dir)
    expect(c.problems.filter((p) => p.level === 'error')).toEqual([])
    expect(c.chunks.map((x) => x.map.id)).toEqual(['world'])
    expect(c.index.start.map).toBe('world')
    // a new run of the editor knows them, the newest first, then the shelf's
    expect(ws().list().map((p) => p.key)).toEqual(['blank-game', 'forest', 'meadow', 'starter'])
    expect(ws().dir('forest')).toBe(join(elsewhere, 'forest'))
  })

  it('opens a folder as a project under a key of its own, refuses one that is not, and forgets one without touching it', () => {
    const other = join(tmp, 'x', 'forest')
    cpSync(join(elsewhere, 'forest'), other, { recursive: true })
    const w = ws()
    expect(w.open(other).key).toBe('forest-2')
    expect(w.open(join(elsewhere, 'forest')).key).toBe('forest')
    expect(w.open(join(games, 'starter')).key).toBe('starter')
    expect(() => w.open(tmp)).toThrow(/not a project/)
    w.forget('forest-2')
    expect(w.list().map((p) => p.key)).not.toContain('forest-2')
    expect(existsSync(join(other, 'game.json'))).toBe(true)
    // a project whose folder went away stays listed, marked, until forgotten
    rmSync(join(tmp, 'deep'), { recursive: true })
    expect(w.list().find((p) => p.key === 'blank-game')?.missing).toBe(true)
  })

  it('lists the folders of the disk, marking projects', () => {
    const l = ws().browse(elsewhere)
    expect(l.dirs).toEqual([{ name: 'forest', project: true }])
    expect(l.parent).toBe(tmp)
  })

  it('makes keys the player\'s URLs take', () => {
    expect(keyOf('My Game!')).toBe('my-game')
    expect(keyOf('林间')).toBe('project')
  })
})

describe.skipIf(!existsSync(STARTER))('pictures, sounds and export', () => {
  const pack = join(tmp, 'pack')
  const player = join(tmp, 'player')
  const w = new Workspace({ home: join(tmp, 'home2'), templates: templatesOf(STARTER), projects: join(tmp, 'p2') })
  const a = new ProjectsApi(w, { pack, player: () => player })
  let server: Server
  let base = ''
  let key = ''
  beforeAll(async () => {
    mkdirSync(join(pack, 'Items'), { recursive: true })
    writeFileSync(join(pack, 'Items', 'Gem.png'), PNG)
    mkdirSync(join(player, 'assets'), { recursive: true })
    mkdirSync(join(player, 'games', 'starter'), { recursive: true })
    writeFileSync(join(player, 'index.html'), '<!doctype html><html><head><title>OpenWorld Player</title></head><body></body></html>')
    writeFileSync(join(player, 'assets', 'index.js'), 'console.log(1)')
    key = w.create({ id: 'shop', name: 'The Shop' }).key
    server = createServer((req, res) => void a.handle(req, res).then((done) => done || (res.writeHead(404), res.end())))
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((ok) => server.close(() => ok())))

  const put = (path: string, body: BodyInit, headers: Record<string, string> = { [HEADER]: '1' }) => fetch(base + path, { method: 'PUT', headers, body })

  it('answers only its own machine, and takes no change without its header', async () => {
    expect((await fetch(`${base}/api/workspace`)).status).toBe(200)
    // (a page of another site reached through a name of its own: DNS rebinding)
    const status = await new Promise<number>((ok) => request(`${base}/api/workspace`, { headers: { host: 'evil.example' } }, (r) => (r.resume(), ok(r.statusCode!))).end())
    expect(status).toBe(403)
    expect((await put(`/api/projects/${key}/files/extra.json`, '{}', { 'content-type': 'application/json' })).status).toBe(403)
    expect((await put(`/api/projects/${key}/files/extra.json`, '{}')).status).toBe(200)
  })

  it('imports a picture under own/, lists it with its size, takes one from the pack, removes its own', async () => {
    const r = await put(`/api/projects/${key}/assets/own/gem.png`, PNG)
    expect(await r.json()).toMatchObject({ path: 'own/gem.png', kind: 'image', w: 2, h: 3 })
    expect((await put(`/api/projects/${key}/assets/na/x.png`, PNG)).status).toBe(400)
    expect((await put(`/api/projects/${key}/assets/own%2F..%2F..%2Fgame.png`, PNG)).status).toBe(400)
    expect(await (await fetch(`${base}/api/pack`)).json()).toEqual([{ path: 'Items/Gem.png', size: PNG.length, kind: 'image', w: 2, h: 3 }])
    const t = await fetch(`${base}/api/projects/${key}/assets/from-pack`, { method: 'POST', headers: { [HEADER]: '1' }, body: JSON.stringify({ paths: ['Items/Gem.png'] }) })
    expect(await t.json()).toEqual({ taken: ['Items/Gem.png'] })
    const list = (await (await fetch(`${base}/api/projects/${key}/assets`)).json()) as { path: string }[]
    expect(list.map((f) => f.path)).toEqual(expect.arrayContaining(['own/gem.png', 'na/Items/Gem.png']))
    expect(pngSize(join(w.dir(key), 'assets', 'na', 'Items', 'Gem.png'))).toEqual({ w: 2, h: 3 })
    expect((await fetch(`${base}/api/projects/${key}/assets/own/gem.png`, { method: 'DELETE', headers: { [HEADER]: '1' } })).status).toBe(200)
    expect(existsSync(join(w.dir(key), 'assets', 'own', 'gem.png'))).toBe(false)
  })

  it('exports the project: the player without its games, the game compiled under game/, a page that opens it, a zip of the whole', async () => {
    const out = join(tmp, 'out', 'shop-web')
    const r = await fetch(`${base}/api/projects/${key}/export`, { method: 'POST', headers: { [HEADER]: '1' }, body: JSON.stringify({ folder: out, zip: true }) })
    const e = (await r.json()) as { dir: string; files: number; zip: { file: string }; warnings: string[]; url: string }
    expect(r.status).toBe(200)
    expect(e.warnings).toEqual([])
    expect(existsSync(join(out, 'games'))).toBe(false)
    expect(existsSync(join(out, 'assets', 'index.js'))).toBe(true)
    expect(existsSync(join(out, MARK))).toBe(true)
    const page = readFileSync(join(out, 'index.html'), 'utf8')
    expect(page).toContain('<title>The Shop</title>')
    expect(page).toContain('<meta name="openworld-game" content="game/" />')
    const bundle = JSON.parse(readFileSync(join(out, 'game', 'bundle.json'), 'utf8'))
    expect(bundle.game.id).toBe('shop')
    expect(readdirSync(join(out, 'game', 'world', 'maps')).sort()).toEqual(['cottage.json', 'glade.json'])
    expect(existsSync(join(out, 'game', 'assets', 'na'))).toBe(true)
    // the zip holds every file of the folder, byte for byte
    const z = unzip(e.zip.file)
    expect(z.size).toBe(e.files)
    expect(z.get('game/bundle.json')?.toString('utf8')).toBe(readFileSync(join(out, 'game', 'bundle.json'), 'utf8'))
    expect(z.get('index.html')?.toString('utf8')).toBe(page)
    // the export is served to be tried at once
    expect(await (await fetch(base + e.url + 'game/bundle.json')).json()).toMatchObject({ game: { id: 'shop' } })
    // a later export replaces its own folder; a folder of anything else is refused
    expect((await fetch(`${base}/api/projects/${key}/export`, { method: 'POST', headers: { [HEADER]: '1' }, body: JSON.stringify({ folder: out }) })).status).toBe(200)
    const busy = join(tmp, 'busy')
    mkdirSync(busy)
    writeFileSync(join(busy, 'mine.txt'), 'x')
    const refused = await fetch(`${base}/api/projects/${key}/export`, { method: 'POST', headers: { [HEADER]: '1' }, body: JSON.stringify({ folder: busy }) })
    expect(refused.status).toBe(500)
    expect(((await refused.json()) as { error: string }).error).toMatch(/not empty/)
    expect(existsSync(join(busy, 'mine.txt'))).toBe(true)
  })
})
