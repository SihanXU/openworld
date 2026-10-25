// The buildings on the real maps (docs/building.md §10): every house whose door leads into someone's rooms has a
// shell that is theirs, on the Ford's maps and the backdrop's; and a Firstlight wall broken through the keys is, in
// the frame the view draws, a hole where the wall stood — the picture's piece bound to it gone, the way in open.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, snapshot, type Key, type MapData } from '@openworld/engine'
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

  it('a Firstlight wall broken through the keys: cracked, then a hole in the picture where one walks in, its pieces as the frame tells them', () => {
    const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of world.chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // a house of Firstlight's, its front wall beside the door; the player in the street before it with an axe
    const house = ownedHouses(world.chunks).find((h) => h.map.id === FIRSTLIGHT.map && CATALOG.prefabs[h.stamp.key].terrain === 'woodwall')
      ?? ownedHouses(world.chunks).find((h) => h.map.id === FIRSTLIGHT.map)!
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
    for (let n = 0; n < 40 && !shown().gone; n++) swing()
    // the picture and the world agree: a hole drawn, the way in open, the rest of the house standing
    expect(shown()).toEqual({ gone: true })
    expect(w.passable(FIRSTLIGHT.map, wall.x, wall.y)).toBe(true)
    expect(w.isSolidTerrain(w.terrainAt(FIRSTLIGHT.map, wall.x, wall.y - 1))).toBe(true)
    // whose it was: the household's, as the society module reads its regions
    expect(w.regionsAt(FIRSTLIGHT.map, wall.x, wall.y).map((r) => w.prop(r, 'owner'))).toContain(house.owner)
  })

  it("Rowan sees his house broken into: vandalism against his household; a wall cannot be handed back, so he does not come asking for it", () => {
    const game = Game.create(world.index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of world.chunks) game.loadChunk(decodeChunk(c))
    const eng = game.engine
    const w = eng.world
    // the elder's timber house (house_wood at 19,5): its front wall east of the door at (21,7)
    eng.author(() => {
      eng.quests.put('descent', 'done')
      w.author(() => (w.setFact('seen.arrival', true), w.setFact('seen.village_arrival', true)))
      eng.teleport(w.player, { map: FIRSTLIGHT.map, x: 21, y: 8 })
      eng.teleport(w.get('npc.rowan')!, { map: FIRSTLIGHT.map, x: 19, y: 9 })
      w.create('item/weapon/blade/axe', { on: 'hand', holder: w.player.id }, { tags: ['material:iron'] })
      eng.controls.sync()
    })
    expect(w.regionsAt(FIRSTLIGHT.map, 21, 7).map((r) => w.prop(r, 'owner'))).toContain('household:elder')
    const asked: unknown[] = []
    const act = eng.act.bind(eng)
    eng.act = ((...a: Parameters<typeof act>) => (a[3]?.params?.say === 'demand' && asked.push(a), act(...a))) as typeof act
    w.player.facing = 'up'
    for (let n = 0; n < 40 && w.isSolidTerrain(w.terrainAt(FIRSTLIGHT.map, 21, 7)); n++) {
      const choice = eng.controls.choices('use' as Key).find((c) => c.plan)
      if (choice?.plan) eng.controls.run(choice.plan, true)
    }
    expect(w.isSolidTerrain(w.terrainAt(FIRSTLIGHT.map, 21, 7))).toBe(false)
    expect(w.get('npc.rowan')!.npc!.memory?.deeds?.some((d) => d.deed === 'vandalism' && d.against === 'household:elder')).toBe(true)
    for (let i = 0; i < 300; i++) eng.tick()
    expect(asked).toEqual([])
  })
})
