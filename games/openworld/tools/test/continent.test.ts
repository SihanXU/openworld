import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, REGIONS, STORY_RULES, TERRAIN_CHARS, UNTOLD, WILD_GROUNDS, buildOntology, decodeChunk, wildChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { OVERWORLD, handmadeGrounds, readContinent } from '../src/demo/overworld.ts'
import { CONTINENT_FILE, FORD, continentJson, generateContinent, inPocket } from '../src/demo/continent/generate.ts'
import { CATALOG } from '../../client/src/catalog.ts'

// The continent's checks (docs/continent.md §6): the file is what the generator makes for the hand-made places as they
// lie; every region of the lore is on it with its places; one walks everywhere from the far bank and the west bank
// only through the Ford; every backdrop place has its map on its cell, named in both languages, never trapping who
// comes in, and every building's door leads into a room that leads back out; the backdrop holds nothing of the story;
// its places differ by region and kind (the Holy City's quarters each their own, a fort its towers and gatehouse), and
// each region but the played one has its own look.

const world = buildFord()
const c = readContinent()
const ground = (x: number, y: number) => TERRAIN_CHARS[c.rows[y][x]]
const SOLID = new Set(['ow_sea', 'ow_mountain', 'ow_river'])

function game() {
  const g = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const ch of [...world.chunks, ...world.backdrop]) g.loadChunk(decodeChunk(ch))
  return g
}
let loaded: ReturnType<typeof game> | undefined
const shared = () => (loaded ??= game())
type World = ReturnType<typeof game>['engine']['world']

/** From `from` on `map`, can one walk to a cell `goal` says is the way out (over walkable cells, four ways)? */
function walkTo(w: World, map: string, from: { x: number; y: number }, goal: (x: number, y: number) => boolean): boolean {
  const seen = new Set([`${from.x},${from.y}`])
  const queue = [from]
  while (queue.length) {
    const { x, y } = queue.pop()!
    if (goal(x, y)) return true
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`
      if (seen.has(k)) continue
      seen.add(k)
      if (goal(x + dx, y + dy)) return true
      if (w.walkable(map, x + dx, y + dy)) queue.push({ x: x + dx, y: y + dy })
    }
  }
  return false
}
/** From `from` (where one stands) one walks off the map by an edge. */
function offTheMap(w: World, map: string, from: { x: number; y: number }): boolean {
  const m = w.map(map)!
  const edge = (x: number, y: number) => x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1
  return edge(from.x, from.y) || walkTo(w, map, from, (x, y) => edge(x, y) && w.walkable(map, x, y))
}
const rooms = world.backdrop.filter((ch) => ch.map.kind === 'interior')
const byId = new Map(world.backdrop.map((ch) => [ch.map.id, ch]))

describe('the continent (docs/continent.md)', () => {
  it('is made for the hand-made places as they lie now: the generator gives the kept file back (else: npm run continent)', () => {
    const { fixed, east } = handmadeGrounds(world.cells)
    expect(continentJson(generateContinent(c.seed, fixed, east))).toBe(readFileSync(CONTINENT_FILE, 'utf8'))
  })

  it('holds every region of the lore, each with its places: a capital, a Seal-bearer\'s seat for every seal but the first, the Holy City its Hall and quarters', () => {
    const regions = new Set(Object.values(c.keys))
    expect([...regions].sort()).toEqual(REGIONS.map((r) => r.id).sort())
    for (const r of REGIONS) {
      const places = c.places.filter((p) => p.region === r.id)
      expect([r.id, places.length > 15]).toEqual([r.id, true])
      if (r.id !== 'frostfang') expect([r.id, places.some((p) => p.capital)]).toEqual([r.id, true])
      if (r.seal && r.seal !== 'crown') expect([r.id, places.filter((p) => p.kind === 'seat' && p.sealed).length]).toEqual([r.id, 1])
    }
    expect(c.places.find((p) => p.id === 'holy.hall')).toMatchObject({ sealed: true, kind: 'cathedral' })
    expect(c.places.filter((p) => p.id.startsWith('holy.quarter-')).length).toBe(8)
    // a region's cells are its own: each region a single piece of land (borders worn, never torn apart)
    for (const r of REGIONS) {
      const key = Object.entries(c.keys).find(([, v]) => v === r.id)![0]
      const cells: [number, number][] = []
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.regions[y][x] === key) cells.push([x, y])
      expect([r.id, cells.length > 120]).toEqual([r.id, true])
    }
  })

  it('every cell one can stand on is reached from the far bank, but the west bank\'s, reached only through the Ford', () => {
    const passable = (x: number, y: number) => x >= 0 && y >= 0 && x < c.width && y < c.height && !SOLID.has(ground(x, y))
    const flood = (x: number, y: number) => {
      const seen = new Set([`${x},${y}`])
      const queue: [number, number][] = [[x, y]]
      while (queue.length) {
        const [cx, cy] = queue.pop()!
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${cx + dx},${cy + dy}`
          if (seen.has(k) || !passable(cx + dx, cy + dy)) continue
          seen.add(k)
          queue.push([cx + dx, cy + dy])
        }
      }
      return seen
    }
    const far = flood(FORD.x + 1, FORD.y)
    const west = flood(FORD.x - 1, FORD.y)
    const lost: string[] = []
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) if (passable(x, y) && !far.has(`${x},${y}`) && !west.has(`${x},${y}`)) lost.push(`${x},${y}`)
    expect(lost).toEqual([])
    for (const k of west) expect([k, inPocket(...(k.split(',').map(Number) as [number, number]))]).toEqual([k, true])
    expect(far.size).toBeGreaterThan(1500)
  })

  it('every place stands on land one can stand on, never beside another, and its map lies on its cell; its site leads in, sealed ones say why', () => {
    const maps = new Map(world.backdrop.map((ch) => [ch.map.id, ch]))
    const overworld = world.chunks.find((ch) => ch.map.id === OVERWORLD)!
    const at = new Map(c.places.map((p) => [`${p.x},${p.y}`, p]))
    for (const p of c.places) {
      expect([p.id, SOLID.has(ground(p.x, p.y))]).toEqual([p.id, false])
      const m = maps.get(p.id)
      expect([p.id, m?.map.site]).toEqual([p.id, { map: OVERWORLD, x: p.x, y: p.y, size: 1 }])
      expect(m!.map).toMatchObject({ backdrop: true, region: p.region })
      const site = overworld.entities.find((e) => e.id === `site.${p.id}`)
      expect([p.id, site?.type, site?.props?.map, site?.props?.backdrop]).toEqual([p.id, `site/place/${p.kind}`, p.id, true])
      expect([p.id, site?.props?.opensWhen]).toEqual([p.id, p.sealed ? UNTOLD : undefined])
      if (p.id.startsWith('holy.')) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) expect([p.id, at.has(`${p.x + dx},${p.y + dy}`)]).toEqual([p.id, false])
    }
    // the index knows them all, as background; and the regions as the world map draws them
    for (const ch of world.backdrop) expect([ch.map.id, world.index.maps.find((m) => m.id === ch.map.id)?.backdrop]).toEqual([ch.map.id, true])
    expect(world.index.regions?.map((r) => r.id)).toEqual(REGIONS.map((r) => r.id))
  })

  it('every place is named in both languages, no name twice, no id twice', () => {
    const en = new Set<string>()
    const ids = new Set<string>([...world.chunks.map((ch) => ch.map.id)])
    for (const p of c.places) {
      expect([p.id, !!p.name.en && !!p.name.zh]).toEqual([p.id, true])
      expect([p.id, en.has(p.name.en)]).toEqual([p.id, false])
      expect([p.id, ids.has(p.id)]).toEqual([p.id, false])
      en.add(p.name.en)
      ids.add(p.id)
    }
  })

  it('a backdrop map traps no one: from whichever side one comes in, one can walk out by an edge; a cave\'s mouth leads down and its depths back up', () => {
    const g = shared()
    const w = g.engine.world
    const trapped: string[] = []
    const out = (map: string, from: { x: number; y: number }) => offTheMap(w, map, from)
    for (const p of c.places) {
      const site = w.get(`site.${p.id}`)!
      for (const facing of ['up', 'down', 'left', 'right'] as const) {
        g.engine.author(() => {
          w.place(w.player, { on: 'tile', map: OVERWORLD, x: p.x, y: p.y })
          w.player.facing = facing
          g.engine.enterFrom(w.player, p.id, site as Entity)
        })
        const at = w.posOf(w.player)!
        if (at.map !== p.id || !out(p.id, at)) trapped.push(`${p.id} from ${facing} at ${at.x},${at.y}`)
      }
      const depths = w.map(`${p.id}.depths`)
      if (!depths) continue
      const down = w.map(p.id)!.portals.find((q) => q.to === depths.id)!
      const up = depths.portals.find((q) => q.to === p.id)!
      expect([p.id, w.walkable(depths.id, down.tx, down.ty), w.walkable(p.id, up.tx, up.ty)]).toEqual([p.id, true, true])
    }
    expect(trapped).toEqual([])
  }, 150_000) // every place gone into from four sides: under a full parallel run it outlasts the default

  it('every building\'s door on a backdrop map leads into a room, several hundred of them: in by the door, out by the room\'s own, and from its step outside one walks off the map', () => {
    const w = shared().engine.world
    expect(rooms.length).toBeGreaterThan(600)
    // every door a building's prefab stamps has its room
    const doorless: string[] = []
    for (const ch of world.backdrop) {
      if (ch.map.kind === 'interior') continue
      for (const st of ch.map.stamps ?? [])
        (CATALOG.prefabs[st.key]?.grid ?? []).forEach((row, j) =>
          [...row].forEach((cell, i) => {
            if (cell === 'D' && !ch.map.portals.some((q) => q.x === st.x + i && q.y === st.y + j)) doorless.push(`${ch.map.id} ${st.key} at ${st.x + i},${st.y + j}`)
          }),
        )
    }
    expect(doorless).toEqual([])
    const trapped: string[] = []
    for (const r of rooms) {
      const id = r.map.id
      expect([id, r.map.backdrop, r.map.light, r.map.portals.length]).toEqual([id, true, 'indoor', 1])
      const back = r.map.portals[0]
      const outer = byId.get(back.to)!
      // the way in: the outer map's door into this room, landing a step inside the room's own door
      const ins = outer.map.portals.filter((q) => q.to === id)
      expect([id, ins.length, outer.map.region]).toEqual([id, 1, r.map.region])
      const land = { x: ins[0].tx, y: ins[0].ty }
      if (!w.walkable(id, land.x, land.y) || !walkTo(w, id, land, (x, y) => x === back.x && y === back.y)) trapped.push(`${id}: no way from ${land.x},${land.y} to its door`)
      // the way out: in front of the door one came in by, and from there off the map
      expect([id, back.tx, back.ty]).toEqual([id, ins[0].x, ins[0].y + 1])
      if (!w.walkable(back.to, back.tx, back.ty) || !offTheMap(w, back.to, { x: back.tx, y: back.ty })) trapped.push(`${id}: shut in at ${back.to} ${back.tx},${back.ty}`)
    }
    expect(trapped).toEqual([])
  }, 150_000)

  it('the backdrop\'s places differ: the Holy City\'s eight quarters each laid out its own way, every fort walled with towers and a gatehouse, each region its own buildings', () => {
    const signature = (id: string) => {
      const ch = byId.get(id)!
      const keys = new Set((ch.map.stamps ?? []).map((st) => st.key))
      const things = new Set(ch.entities.filter((e) => e.type.startsWith('fixture/')).map((e) => e.type))
      return JSON.stringify([[...keys].sort(), [...things].sort()])
    }
    expect(new Set(c.places.filter((p) => p.id.startsWith('holy.quarter-')).map((p) => signature(p.id))).size).toBe(8)
    // a quarter's rooms are what its theme builds: the market's shops, the pilgrims' tents and inns, the cloister's chapel and cells
    const roles = (id: string) => new Set(rooms.filter((r) => r.map.portals[0].to === id).map((r) => r.map.id.slice(id.length + 1).replace(/-\d+$/, '')))
    expect(roles('holy.quarter-3').has('shop')).toBe(true)
    expect([...roles('holy.quarter-6')].filter((r) => r === 'tent' || r === 'inn').sort()).toEqual(['inn', 'tent'])
    expect([...roles('holy.quarter-8')].filter((r) => r === 'cell' || r === 'chapel').sort()).toEqual(['cell', 'chapel'])
    for (const p of c.places.filter((q) => q.kind === 'fort')) {
      expect([p.id, (byId.get(p.id)!.map.stamps ?? []).some((st) => st.key === 'arch')]).toEqual([p.id, true])
      expect([p.id, [...roles(p.id)]]).toEqual([p.id, ['barracks']])
    }
    const prefabs = (region: string) => new Set(world.backdrop.filter((ch) => ch.map.region === region && ch.map.kind === 'village').flatMap((ch) => (ch.map.stamps ?? []).map((st) => st.key)))
    expect(prefabs('palefen').has('house_plaster')).toBe(false)
    expect(prefabs('altar').has('house_plaster')).toBe(true)
  })

  it('every region but the played one has its own look, sent with its maps: the Pale Fens the darkest and greyest; the Frostfang Coast keeps the game\'s own', () => {
    const looks = new Map((world.index.regions ?? []).map((r) => [r.id, r.look]))
    expect(looks.get('frostfang')).toBeUndefined()
    for (const r of REGIONS.filter((q) => q.id !== 'frostfang')) expect([r.id, !!looks.get(r.id)?.tint]).toEqual([r.id, true])
    const fen = looks.get('palefen')!
    for (const r of REGIONS.filter((q) => q.id !== 'palefen')) {
      expect([r.id, (looks.get(r.id)?.shade ?? 0) < (fen.shade ?? 0)]).toEqual([r.id, true])
      expect([r.id, (looks.get(r.id)?.desat ?? 0) < (fen.desat ?? 0)]).toEqual([r.id, true])
    }
  })

  it('the backdrop holds nothing of the story: no one, no wayshrine of the Pilgrim\'s Road, no stone that seals, only kinds the game has', () => {
    const onto = buildOntology()
    for (const ch of world.backdrop)
      for (const e of ch.entities) {
        expect([ch.map.id, e.type, !!onto.types[e.type]]).toEqual([ch.map.id, e.type, true])
        expect([ch.map.id, e.type.startsWith('actor/person'), e.type.startsWith('fixture/sacred/wayshrine'), e.type === 'fixture/sacred/seal_stone']).toEqual([ch.map.id, false, false, false])
      }
    expect(world.index.npcs.some((n) => n.place.on === 'tile' && world.backdrop.some((ch) => n.place.on === 'tile' && ch.map.id === n.place.map))).toBe(false)
  })

  it('a region\'s wild is its own on a ground it shares: the Fens\' woods are grey, the March\'s hills red; every ground of the continent has a recipe', () => {
    const plain = wildChunk(7, 3, 3, 'ow_forest', undefined)
    const fen = wildChunk(7, 3, 3, 'ow_forest', undefined, 'palefen')
    expect(fen.map.name).not.toEqual(plain.map.name)
    expect(fen.map.region).toBe('palefen')
    expect(wildChunk(7, 3, 3, 'ow_hills', undefined, 'redmarch').map.terrain.filter((t) => t === 'dirt').length).toBeGreaterThan(400)
    const grounds = new Set<string>()
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (!SOLID.has(ground(x, y))) grounds.add(ground(x, y))
    expect([...grounds].filter((g) => !WILD_GROUNDS.includes(g))).toEqual([])
  })
})
