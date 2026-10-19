import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, lookProblems, scheduleAt, type Entity } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, REGIONS, SOCIAL_COIN, STORY_RULES, TERRAIN_CHARS, UNTOLD, WILD_GROUNDS, buildOntology, decodeChunk, wildChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { OVERWORLD, handmadeGrounds, readContinent } from '../src/demo/overworld.ts'
import { CONTINENT_FILE, FORD, continentJson, generateContinent, inPocket } from '../src/demo/continent/generate.ts'
import { CATALOG } from '../../client/src/catalog.ts'
import { scaleRun } from '../src/demo/scale.ts'

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
      // (the people of a place step aside: a way is a way when only they stand in it)
      if (w.walkable(map, x + dx, y + dy, undefined, true)) queue.push({ x: x + dx, y: y + dy })
    }
  }
  return false
}
/** From `from` (where one stands) one walks off the map by an edge. */
function offTheMap(w: World, map: string, from: { x: number; y: number }): boolean {
  const m = w.map(map)!
  const edge = (x: number, y: number) => x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1
  return edge(from.x, from.y) || walkTo(w, map, from, (x, y) => edge(x, y) && w.walkable(map, x, y, undefined, true))
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
      if (!w.walkable(id, land.x, land.y, undefined, true) || !walkTo(w, id, land, (x, y) => x === back.x && y === back.y)) trapped.push(`${id}: no way from ${land.x},${land.y} to its door`)
      // the way out: in front of the door one came in by, and from there off the map
      expect([id, back.tx, back.ty]).toEqual([id, ins[0].x, ins[0].y + 1])
      if (!w.walkable(back.to, back.tx, back.ty, undefined, true) || !offTheMap(w, back.to, { x: back.tx, y: back.ty })) trapped.push(`${id}: shut in at ${back.to} ${back.tx},${back.ty}`)
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

  it('the backdrop holds nothing of the story: no one of it (its people are its own), no wayshrine of the Pilgrim\'s Road, no stone that seals, only kinds the game has', () => {
    const onto = buildOntology()
    for (const ch of world.backdrop)
      for (const e of ch.entities) {
        expect([ch.map.id, e.type, !!onto.types[e.type]]).toEqual([ch.map.id, e.type, true])
        expect([ch.map.id, e.type.startsWith('actor/person') && e.npc?.fidelity !== 'local', e.type.startsWith('fixture/sacred/wayshrine'), e.type === 'fixture/sacred/seal_stone']).toEqual([ch.map.id, false, false, false])
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

// The backdrop's people (docs/continent.md §11): households in the rooms behind their place's doors, the backdrop's own —
// made with their place, keeping to it, never of the story.
describe("the backdrop's people", () => {
  const people = world.backdrop.flatMap((ch) => ch.entities.filter((e) => e.npc).map((e) => ({ map: ch.map.id, e })))
  const placeOf = new Map(c.places.map((p) => [p.id, p]))
  const surname = (e: Entity) => (e.name as { en: string }).en.split(' ').slice(1).join(' ')
  /** A place's rooms (rooms.ts: `<place>.<role>-<n>`), and all its maps. */
  const roomsOf = (id: string) => world.backdrop.filter((r) => r.map.kind === 'interior' && r.map.id.startsWith(`${id}.`))
  const mapsOf = (id: string) => new Set([id, ...roomsOf(id).map((r) => r.map.id)])

  it("live in households, a household to every room behind their place's doors, with roles by the place's kind and region: every one the backdrop's own", () => {
    expect(people.length).toBeGreaterThan(1400)
    const onto = buildOntology()
    const byKind = new Map<string, Set<string>>()
    for (const { map, e } of people) {
      const p = placeOf.get(map)!
      expect([e.id, e.npc!.fidelity, e.type.startsWith('actor/person/'), !!onto.types[e.type], e.place.on === 'tile' && mapsOf(map).has(e.place.map)]).toEqual([e.id, 'local', true, true, true])
      expect([e.id, String(e.props?.household).startsWith(`${map}.h`)]).toEqual([e.id, true])
      if (!byKind.has(p.kind)) byKind.set(p.kind, new Set())
      byKind.get(p.kind)!.add(e.npc!.role)
    }
    // where people live, and no one where no one does (the wild's places: ruins, caves, graves; the sealed seats); every
    // room of a place lived in is someone's to sleep in
    for (const p of c.places) {
      const mine = people.filter((x) => x.map === p.id)
      const peopled = !p.sealed && (roomsOf(p.id).length > 0 || p.kind === 'shrine')
      expect([p.id, mine.length > 0]).toEqual([p.id, peopled])
      if (!peopled) continue
      const beds = new Set(mine.map(({ e }) => e.npc!.schedule.find((s) => s.activity === 'sleep')!.map))
      for (const r of roomsOf(p.id)) expect([r.map.id, beds.has(r.map.id)]).toEqual([r.map.id, true])
    }
    // a town keeps a watch and a market, a farm its farmers, a fort its garrison
    expect([...byKind.get('town')!]).toEqual(expect.arrayContaining(['merchant', 'guard', 'smith', 'innkeeper', 'child']))
    expect([...byKind.get('farm')!]).toContain('farmer')
    expect([...byKind.get('fort')!]).toEqual(expect.arrayContaining(['soldier', 'guard']))
    // a household is a house's: its members share its family name
    const households = new Map<string, Set<string>>()
    for (const { e } of people) {
      const h = String(e.props!.household)
      if (!households.has(h)) households.set(h, new Set())
      households.get(h)!.add(surname(e))
    }
    for (const [h, names] of households) expect([h, names.size]).toEqual([h, 1])
  })

  it('keep a day within their own place: every hour covered, every anchor a cell of its map or its rooms one can stand in, and the street never crowded', () => {
    const g = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const lived = new Set(people.map((x) => x.map))
    for (const ch of world.backdrop) if (lived.has(ch.map.id) || (ch.map.kind === 'interior' && lived.has(ch.map.id.replace(/\.[^.]+$/, '')))) g.loadChunk(decodeChunk(ch))
    const w = g.engine.world
    const bad: string[] = []
    for (const { map, e } of people) {
      const s = e.npc!.schedule
      for (let h = 0; h < 24; h++) if (!s.some((x) => (x.from <= x.to ? h >= x.from && h < x.to : h >= x.from || h < x.to))) bad.push(`${e.id} ${h}h`)
      for (const x of s) if (!mapsOf(map).has(x.map) || !w.passable(x.map, x.x, x.y)) bad.push(`${e.id} ${x.activity} ${x.map}:${x.x},${x.y}`)
    }
    expect(bad).toEqual([])
    // at any hour, those out of doors are few for the place's ground: at most one to every 25 cells one can stand on
    const crowded: string[] = []
    for (const m of lived) {
      const data = w.map(m)!
      let open = 0
      for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) if (w.passable(m, x, y)) open++
      const mine = people.filter((x) => x.map === m)
      for (let h = 0; h < 24; h++) {
        const out = mine.filter(({ e }) => scheduleAt(e.npc!.schedule, h + 0.5)?.map === m).length
        if (out > open / 25) crowded.push(`${m} ${h}h: ${out} out on ${open} cells`)
      }
    }
    expect(crowded).toEqual([])
  }, 120_000)

  it("look as the world's table has it, are named in both languages (never twice in a place), and trade where it fits", () => {
    const onto = buildOntology()
    const chunk = new Map(world.backdrop.map((ch) => [ch.map.id, new Map(ch.entities.map((e) => [e.id, e]))]))
    for (const { map, e } of people) {
      expect([e.id, typeof e.look === 'object' && lookProblems(e.look, onto.looks!)]).toEqual([e.id, []])
      const name = e.name as { en: string; zh: string }
      expect([e.id, /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name.en), /^\S+·\S+$/.test(name.zh)]).toEqual([e.id, true, true])
      const things = chunk.get(map)!
      expect([e.id, [...things.values()].filter((o) => o.npc && (o.name as { en: string }).en === name.en).length]).toEqual([e.id, 1])
      // what they sell is what they carry, of the world's kinds; their coin is the world's, as much as their purse
      const carried = (e.contents ?? []).map((id) => things.get(id))
      expect([e.id, carried.every((o) => !!o && o.place.on === 'inside' && o.place.holder === e.id && !!onto.types[o.type])]).toEqual([e.id, true])
      if (e.props?.stock) {
        expect([e.id, e.tags?.includes('merchant')]).toEqual([e.id, true])
        for (const part of String(e.props.stock).split('|')) expect([e.id, part, carried.some((o) => o!.type === part.split('*')[0])]).toEqual([e.id, part, true])
      }
      expect([e.id, carried.filter((o) => o!.type === SOCIAL_COIN).length]).toEqual([e.id, e.props!.purse])
    }
    expect(people.filter(({ e }) => e.props?.stock).length).toBeGreaterThan(120)
  })

  it('are none of the story: not in the index, never essential, named by no quest, step or invariant, and on no page of the wiki', () => {
    const ids = new Set(people.map(({ e }) => e.id))
    expect(world.index.npcs.some((n) => ids.has(n.id))).toBe(false)
    expect(people.filter(({ e }) => e.tags?.includes('essential')).map(({ e }) => e.id)).toEqual([])
    const story = JSON.stringify([world.index.quests, world.index.steps, world.index.invariants])
    expect([...ids].filter((id) => story.includes(`"${id}"`))).toEqual([])
    const pages = readdirSync(join(import.meta.dirname, '..', '..', '..', '..', 'wiki', 'pages'), { recursive: true }).map(String).join('\n')
    expect(people.filter(({ e }) => pages.includes((e.name as { zh: string }).zh)).map(({ e }) => e.id)).toEqual([])
  })
})

// The engine at the continent's scale (docs/continent.md §12): a map's things kept as what differs from its file,
// the maps far behind put away, the scans over every thing gone.
describe('the world at scale', () => {
  const town = world.backdrop.find((ch) => ch.map.kind === 'town' && ch.entities.some((e) => e.npc))!
  const elsewhere = world.backdrop.find((ch) => ch.map.kind === 'village' && ch.entities.some((e) => e.npc))!
  const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
  const fresh = () => {
    const g = Game.create(world.index, buildOntology(), lib())
    g.keepMaps = 1
    return g
  }
  const enter = (g: Game, ch: (typeof world.backdrop)[number]) => {
    const w = g.engine.world
    if (!w.map(ch.map.id)) g.loadChunk(decodeChunk(structuredClone(ch)))
    g.engine.author(() => g.engine.teleport(w.player, { map: ch.map.id, x: Math.floor(ch.map.width / 2), y: Math.floor(ch.map.height / 2) }))
    g.trim()
  }
  /** The people of a place in memory, wherever in it they are (its street, its rooms). */
  const townsfolk = (w: Game['engine']['world'], id: string) => w.people().filter((e) => e.from === id)

  it('a map put away takes its things along and brings them back as they were: the changed changed, the made made, the gone gone', () => {
    const g = fresh()
    const eng = g.engine
    const w = eng.world
    enter(g, town)
    const [a, b] = town.entities.filter((e) => e.npc)
    const coin = w.get(a.contents!.find((id) => id.includes('.coin'))!)!
    eng.author(() => {
      w.setProp(w.get(a.id)!, 'met', 1)
      w.destroy(coin)
      w.create('item/material/stone', { on: 'tile', map: town.map.id, x: 3, y: 3 }, { id: 'scale.stone' })
    })
    const before = w.people().length
    // gone elsewhere, the town is put away: its people and its things leave memory with its data
    enter(g, elsewhere)
    expect(w.state.chunks![town.map.id].away).toBe(true)
    expect(w.map(town.map.id)).toBeUndefined()
    expect(w.get(a.id)).toBeUndefined()
    expect(w.get('scale.stone')).toBeUndefined()
    expect(w.people().length).toBeLessThan(before)
    // an event for one of them waits for the town, as a dormant map's does
    eng.dispatch({ kind: 'impulse/notify', host: { e: a.id }, roles: {}, params: { what: 'news' }, origin: 'world' })
    expect(w.state.dormant![town.map.id].inbox.some((ev) => 'e' in ev.host && ev.host.e === a.id)).toBe(true)
    // back again: as they were
    enter(g, town)
    expect(w.get(a.id)?.props?.met).toBe(1)
    expect(w.get(coin.id)).toBeUndefined()
    expect(w.get(a.id)!.contents).not.toContain(coin.id)
    expect(w.get('scale.stone')?.place).toMatchObject({ map: town.map.id, x: 3, y: 3 })
    const { place: _p, facing: _f, ...asMade } = b
    expect(w.get(b.id)).toMatchObject({ ...asMade, from: town.map.id })
    // standing in it, a save keeps it lean: what is as its file has it left out, the rest whole
    const lean = g.save().state
    expect(lean.chunks![town.map.id].lean).toBe(true)
    expect(lean.entities[town.entities.find((e) => e.type.startsWith('fixture/') && e.place.on === 'tile')!.id]).toBeUndefined()
    expect(lean.entities[a.id]?.props?.met).toBe(1)
    // gone again, a save keeps only what changed: the one met as a patch, the coin gone, the stone whole; the rest is the file's
    enter(g, elsewhere)
    const s = g.save().state
    const cs = s.chunks![town.map.id]
    expect(cs.away).toBe(true)
    expect(Object.keys(cs.changed ?? {})).toContain(a.id)
    expect(cs.gone).toContain(coin.id)
    expect(cs.things?.some((t) => t.id === 'scale.stone')).toBe(true)
    expect(JSON.stringify(s).length).toBeLessThan(150_000)
    // loaded, and the town's file come: the same town
    const back = Game.load(structuredClone(g.save()), world.index, buildOntology(), lib())
    back.loadChunk(decodeChunk(structuredClone(town)))
    const bw = back.engine.world
    expect(bw.get(a.id)?.props?.met).toBe(1)
    expect(bw.get(coin.id)).toBeUndefined()
    expect(bw.get('scale.stone')).toBeDefined()
    expect(townsfolk(bw, town.map.id).length).toBe(town.entities.filter((e) => e.npc).length)
  })

  it("a room and all it keeps are its household's: taking from it is taking what is another's", () => {
    const g = fresh()
    enter(g, town)
    const w = g.engine.world
    const folk = town.entities.filter((e) => e.npc)
    const rooms = world.backdrop.filter((r) => r.map.kind === 'interior' && r.map.id.startsWith(`${town.map.id}.`))
    expect(rooms.length).toBeGreaterThan(5)
    for (const r of rooms) {
      g.loadChunk(decodeChunk(structuredClone(r)))
      const home = folk.find((e) => e.npc!.schedule.some((s) => s.activity === 'sleep' && s.map === r.map.id))!
      const owner = `household:${home.props!.household}`
      expect([r.map.id, r.map.regionProps?.home?.owner]).toEqual([r.map.id, owner])
      // what stands there and what is kept in it (phase D's stock): the household's
      const kept = r.entities.filter((e) => e.place.on === 'inside' && r.entities.some((c) => c.id === (e.place as { holder: string }).holder && c.place.on === 'tile'))
      for (const e of [...r.entities.filter((x) => x.place.on === 'tile'), ...kept]) expect([e.id, socialOf(g.engine).ownerOf(w.get(e.id)!)]).toEqual([e.id, owner])
      expect([r.map.id, socialOf(g.engine).isAnothers(w.get(r.entities[0].id)!, w.player)]).toEqual([r.map.id, true])
    }
  })

  it('loaded inside a house, the place it lies in comes with it: its people come home as their day says', () => {
    const g = fresh()
    const eng = g.engine
    enter(g, town)
    const room = world.backdrop.find((r) => r.map.id === town.entities.find((e) => e.npc)!.npc!.schedule.find((s) => s.activity === 'sleep')!.map)!
    g.loadChunk(decodeChunk(structuredClone(room)))
    eng.author(() => eng.teleport(eng.world.player, { map: room.map.id, x: Math.floor(room.map.width / 2), y: room.map.height - 3 }))
    g.trim()
    const back = Game.load(structuredClone(g.save()), world.index, buildOntology(), lib())
    back.keepMaps = 1
    back.loadChunk(decodeChunk(structuredClone(room)))
    // the house's place was put away by the save: it is needed, and comes
    expect(back.neededMaps()).toContain(town.map.id)
    for (const id of back.neededMaps()) back.loadChunk(decodeChunk(structuredClone(world.backdrop.find((c) => c.map.id === id)!)))
    back.trim()
    expect(back.engine.world.map(town.map.id)).toBeDefined()
    expect(townsfolk(back.engine.world, town.map.id).length).toBe(town.entities.filter((e) => e.npc).length)
    // night comes: those who sleep in this house are in it
    const w = back.engine.world
    const sleepers = townsfolk(w, town.map.id).filter((e) => e.npc!.schedule.some((s) => s.activity === 'sleep' && s.map === room.map.id))
    for (let i = 0; i < 20 * 600 && Math.floor(w.hour()) !== 23; i++) back.engine.tick()
    for (let i = 0; i < 600; i++) back.engine.tick()
    expect(sleepers.filter((e) => w.posOf(e)?.map !== room.map.id).map((e) => e.id)).toEqual([])
  }, 120_000)

  it('the people who travel stay in memory wherever they are, and a save keeps them as what differs from the index', () => {
    const g = fresh()
    enter(g, town)
    enter(g, elsewhere)
    const w = g.engine.world
    for (const n of world.index.npcs) expect([n.id, !!w.get(n.id)]).toEqual([n.id, true])
    const s = g.save().state
    expect(world.index.npcs.filter((n) => s.entities[n.id]).map((n) => n.id)).toEqual([])
    const back = Game.load(structuredClone(g.save()), world.index, buildOntology(), lib())
    for (const n of world.index.npcs) expect([n.id, back.engine.world.get(n.id)?.place]).toEqual([n.id, w.get(n.id)!.place])
  })

  it('fifty maps walked into: memory holds the last few, and a tick, a frame on the world map and a save stay within bounds', () => {
    const r = scaleRun()
    expect(r.maps).toBe(50)
    expect(r.inMemory).toBeLessThanOrEqual(8)
    expect(r.people).toBeLessThan(600)
    expect(r.entities).toBeLessThan(9000)
    expect(r.townPeople).toBeGreaterThan(30)
    // (ten ticks a second: what a tick and a frame may take, with room for a busy machine)
    expect(r.townTickMs).toBeLessThan(25)
    expect(r.overworldTickMs).toBeLessThan(25)
    expect(r.overworldFrameMs).toBeLessThan(40)
    // what is sent is what is in view and what changed, not every place of the continent
    expect(r.overworldSentChars).toBeLessThan(r.overworldFrameChars / 10)
    expect(r.stateChars).toBeLessThan(150_000)
  }, 300_000)
})
