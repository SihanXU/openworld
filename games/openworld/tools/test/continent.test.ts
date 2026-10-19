import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, REGIONS, STORY_RULES, TERRAIN_CHARS, UNTOLD, WILD_GROUNDS, buildOntology, decodeChunk, wildChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { OVERWORLD, handmadeGrounds, readContinent } from '../src/demo/overworld.ts'
import { CONTINENT_FILE, FORD, continentJson, generateContinent, inPocket } from '../src/demo/continent/generate.ts'

// The continent's checks (docs/continent.md §6): the file is what the generator makes for the hand-made places as they
// lie; every region of the lore is on it with its places; one walks everywhere from the far bank and the west bank
// only through the Ford; every backdrop place has its map on its cell, named in both languages, never trapping who
// comes in; the backdrop holds nothing of the story.

const world = buildFord()
const c = readContinent()
const ground = (x: number, y: number) => TERRAIN_CHARS[c.rows[y][x]]
const SOLID = new Set(['ow_sea', 'ow_mountain', 'ow_river'])

function game() {
  const g = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const ch of [...world.chunks, ...world.backdrop]) g.loadChunk(decodeChunk(ch))
  return g
}

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
    const g = game()
    const w = g.engine.world
    const trapped: string[] = []
    const out = (map: string, from: { x: number; y: number }) => {
      const m = w.map(map)!
      const seen = new Set([`${from.x},${from.y}`])
      const queue = [from]
      while (queue.length) {
        const { x, y } = queue.pop()!
        if (x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1) return true
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${y + dy}`
          if (seen.has(k) || !w.walkable(map, x + dx, y + dy)) continue
          seen.add(k)
          queue.push({ x: x + dx, y: y + dy })
        }
      }
      return false
    }
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
