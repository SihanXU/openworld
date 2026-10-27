// The buildings on the real maps (docs/building.md §10): every house whose door leads into someone's rooms has a
// shell that is theirs, on the Ford's maps and the backdrop's; and a Firstlight wall struck through the keys shows it,
// crack by crack, in the frame the view draws — but holds at its last crack: no hole, the way in only the door.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, regionId, snapshot, type Key, type MapData } from '@openworld/engine'
import { BASE_RULES, FIRSTLIGHT, STORY_RULES, buildOntology, decodeChunk, type RawChunk } from '@openworld-game/content'
import { pieceState, piecesOf, type TerrainFacts } from '@openworld/runtime/src/render/pieces.ts'
import { CATALOG } from '../../client/src/catalog.ts'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const facts: TerrainFacts = { solid: (t) => !!onto.terrains[t]?.solid, burnt: (t) => !!onto.terrains[t]?.tags?.includes('burnt') }
const world = buildFord()

/** The owner of a map's cell by its regions (as the society module reads it, a region's `owner`). */
const ownerAt = (m: RawChunk['map'], x: number, y: number) =>
  Object.entries(m.regions ?? {}).map(([name, [rx, ry, rw, rh]]) => (x >= rx && y >= ry && x < rx + rw && y < ry + rh ? m.regionProps?.[name]?.owner : undefined)).find((o) => typeof o === 'string' && o)

/** Each stamped building with a door into an owned room: its map, its stamp, and whose the room is. */
function ownedHouses(chunks: RawChunk[]) {
  const byId = new Map(chunks.map((c) => [c.map.id, c.map]))
  const out: { map: RawChunk['map']; stamp: { key: string; x: number; y: number }; owner: string }[] = []
  for (const { map } of chunks)
    for (const s of map.stamps ?? []) {
      const p = CATALOG.prefabs[s.key]
      p?.grid.forEach((row, j) =>
        [...row].forEach((c, i) => {
          if (c !== 'D') return
          const way = map.portals.find((q) => q.x === s.x + i && q.y === s.y + j)
          const inside = way && byId.get(way.to)
          const owner = inside && ownerAt(inside, way.tx, way.ty)
          if (typeof owner === 'string') out.push({ map, stamp: s, owner })
        }),
      )
    }
  return out
}

describe('the buildings on the maps (docs/building.md §10)', () => {
  it("every house whose door leads into someone's rooms has its walls theirs: the Ford's and the backdrop's", () => {
    for (const chunks of [world.chunks, world.backdrop]) {
      const houses = ownedHouses(chunks)
      expect(houses.length).toBeGreaterThan(0)
      for (const h of houses) {
        const p = CATALOG.prefabs[h.stamp.key]
        p.grid.forEach((row, j) => [...row].forEach((c, i) => c === '#' && expect(ownerAt(h.map, h.stamp.x + i, h.stamp.y + j), `${h.map.id} ${h.stamp.key}`).toBe(h.owner)))
        // never the door: one stands in the doorway of anyone's house
        p.grid.forEach((row, j) => [...row].forEach((c, i) => c === 'D' && expect(ownerAt(h.map, h.stamp.x + i, h.stamp.y + j)).toBeUndefined()))
      }
    }
    // Firstlight's own houses among them
    expect(ownedHouses(world.chunks).some((h) => h.map.id === FIRSTLIGHT.map)).toBe(true)
  })

  it('a Firstlight wall struck through the keys: cracked, more with every blow, then holding at its last crack — solid, drawn whole, nothing fallen out', () => {
    const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of world.chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // a house of Firstlight's, its front wall beside the door (the strip of its picture on its front row, a building's
    // picture being cut a strip to a row); the player in the street before it with an axe
    const front = (h: ReturnType<typeof ownedHouses>[number]) => h.stamp.y + CATALOG.prefabs[h.stamp.key].th - 1
    const owned = ownedHouses(world.chunks).filter((h) => h.map.id === FIRSTLIGHT.map)
    const elder = owned.filter((h) => h.owner === 'household:elder')
    const house = (elder.length ? elder : owned).reduce((a, b) => (front(b) > front(a) ? b : a))
    const p = CATALOG.prefabs[house.stamp.key]
    const last = p.th - 1
    const col = [...p.grid[last]].findIndex((c) => c === '#')
    const wall = { x: house.stamp.x + col, y: house.stamp.y + last }
    eng.author(() => {
      eng.teleport(w.player, { map: FIRSTLIGHT.map, x: wall.x, y: wall.y + 1 })
      w.create('item/weapon/blade/axe', { on: 'hand', holder: w.player.id }, { tags: ['material:iron'] })
      eng.controls.sync()
    })
    w.player.facing = 'up'
    const data = w.map(FIRSTLIGHT.map) as MapData
    const original = (x: number, y: number) => data.terrain[y * data.width + x]
    const piece = piecesOf(p, house.stamp, original, facts).find((d) => d.x === wall.x && d.y === wall.y)!
    expect(piece.bound).toBe(p.terrain ?? 'wall')
    const shown = () => {
      const t = snapshot(eng).tiles.find((c) => c.x === wall.x && c.y === wall.y)
      return pieceState(piece, t?.terrain ? { terrain: t.terrain, hp: t.hp, maxHp: t.maxHp } : undefined, facts)
    }
    const swing = () => {
      const choice = eng.controls.choices('use' as Key).find((c) => c.plan)
      if (choice?.plan) eng.controls.run(choice.plan, true)
    }
    expect(shown()).toEqual({ gone: false, crack: 0, burnt: false })
    swing()
    expect(shown()).toMatchObject({ gone: false })
    expect((shown() as { crack: number }).crack).toBeGreaterThan(0)
    for (let n = 0; n < 40; n++) swing()
    // the picture and the world agree: the deepest cracks, the wall still there, the way in only the door
    expect(shown()).toEqual({ gone: false, crack: 3, burnt: false })
    expect(w.passable(FIRSTLIGHT.map, wall.x, wall.y)).toBe(false)
    expect(w.placedAt(FIRSTLIGHT.map, wall.x, wall.y)).toEqual([])
    // whose it was: the household's, as the society module reads its regions
    expect(w.regionsAt(FIRSTLIGHT.map, wall.x, wall.y).map((r) => w.prop(r, 'owner'))).toContain(house.owner)
  })

  it('a far map put away takes its shells with it (as its file has them, they are not kept), and they come back with it', () => {
    const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of world.chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // a shell of the elder's house (its walls, owned as the rooms behind its door are)
    eng.author(() => eng.teleport(w.player, { map: FIRSTLIGHT.map, x: 18, y: 10 }))
    const id = Object.values(w.state.entities).find((e) => e.id.startsWith(regionId(FIRSTLIGHT.map, 'shell.')) && w.prop(e, 'owner') === 'household:elder')!.id
    expect(w.prop(w.get(id)!, 'owner')).toBe('household:elder')
    // the player far off on the mountain, Firstlight put away: its shells leave the state, and no save carries them
    eng.author(() => eng.teleport(w.player, { map: 'summit', x: 10, y: 10 }))
    expect(eng.author(() => eng.chunks.putAway(FIRSTLIGHT.map))).toBe(true)
    expect(w.state.entities[id]).toBeUndefined()
    expect(JSON.stringify(game.save().state)).not.toContain(id)
    // come back to it: made again from its file, whose they are with them
    game.loadChunk(decodeChunk(world.chunks.find((c) => c.map.id === FIRSTLIGHT.map)!))
    eng.author(() => eng.teleport(w.player, { map: FIRSTLIGHT.map, x: 18, y: 10 }))
    expect(w.prop(w.get(id)!, 'owner')).toBe('household:elder')
  })

  it("Rowan sees his house hacked at: vandalism against his household; a wall cannot be handed back, so he does not come asking for it", () => {
    const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of world.chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // the elder's stone house (village.ts TOWN): its front wall, the strip of its picture on its front row
    const front = (h: ReturnType<typeof ownedHouses>[number]) => h.stamp.y + CATALOG.prefabs[h.stamp.key].th - 1
    const house = ownedHouses(world.chunks).filter((h) => h.map.id === FIRSTLIGHT.map && h.owner === 'household:elder').reduce((a, b) => (front(b) > front(a) ? b : a))
    const p = CATALOG.prefabs[house.stamp.key]
    const wall = { x: house.stamp.x + [...p.grid[p.th - 1]].findIndex((c) => c === '#'), y: front(house) }
    eng.author(() => {
      eng.quests.put('descent', 'done')
      w.author(() => (w.setFact('seen.arrival', true), w.setFact('seen.village_arrival', true)))
      eng.teleport(w.player, { map: FIRSTLIGHT.map, x: wall.x, y: wall.y + 1 })
      eng.teleport(w.get('npc.rowan')!, { map: FIRSTLIGHT.map, x: wall.x + 1, y: wall.y + 2 })
      w.create('item/weapon/blade/axe', { on: 'hand', holder: w.player.id }, { tags: ['material:iron'] })
      eng.controls.sync()
    })
    expect(w.regionsAt(FIRSTLIGHT.map, wall.x, wall.y).map((r) => w.prop(r, 'owner'))).toContain('household:elder')
    const asked: unknown[] = []
    const act = eng.act.bind(eng)
    eng.act = ((...a: Parameters<typeof act>) => (a[3]?.params?.say === 'demand' && asked.push(a), act(...a))) as typeof act
    w.player.facing = 'up'
    for (let n = 0; n < 6; n++) {
      const choice = eng.controls.choices('use' as Key).find((c) => c.plan)
      if (choice?.plan) eng.controls.run(choice.plan, true)
    }
    expect(w.isSolidTerrain(w.terrainAt(FIRSTLIGHT.map, wall.x, wall.y))).toBe(true)
    expect(w.get('npc.rowan')!.npc!.memory?.deeds?.some((d) => d.deed === 'vandalism' && d.against === 'household:elder')).toBe(true)
    for (let i = 0; i < 300; i++) eng.tick()
    expect(asked).toEqual([])
  })
})
