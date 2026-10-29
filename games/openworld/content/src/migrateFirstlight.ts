// Authored-content migration, kept outside the generic engine. No inventory or quest reset.
import { scheduleAt, scheduleFor, type Entity, type Game, type MapChunk, type WorldIndex } from '@openworld/engine'
import { CHAPEL_LAYOUT, FIRSTLIGHT, FIRSTLIGHT_HOUSES, FIRSTLIGHT_LAYOUT, PART_ONE_LAYOUT, PROLOGUE_LAYOUT } from './firstlight.ts'

const gardenEntity = (e: Entity) => e.id.startsWith('ford.garden.') || (e.place.on === 'inside' && e.place.holder === 'ford.garden.supplies')
const relocated = (e: Entity) => gardenEntity(e) || ['ford.cart', 'tobin.wand', 'tobin.oil'].includes(e.id)
const cosmetic = (e: Entity) => ['fixture/nature/tuft', 'fixture/nature/flowers', 'fixture/nature/leaves'].includes(e.type)

/** Apply once when an older ford-3 save loads. `meadow` remains the village's stable map ID. */
export function migrateFirstlight(game: Game, index: WorldIndex, ford: MapChunk, village: MapChunk): void {
  const eng = game.engine
  const w = eng.world
  if (w.fact(FIRSTLIGHT_LAYOUT)) return
  const fordLoaded = w.state.loadedMaps.includes('ford')
  const villageLoaded = w.state.loadedMaps.includes(FIRSTLIGHT.map)
  const saved = Object.values(w.state.entities)

  game.loadChunk(ford)
  // A previously visited Ford may have harvested crops, taken tools or lost its cart.
  // Do not recreate them when the village is loaded for the first time.
  game.loadChunk({ ...village, entities: village.entities.filter((e) => !fordLoaded || !relocated(e)) })
  if (villageLoaded) {
    for (const e of village.entities) {
      if (e.id.startsWith('village.') || (!fordLoaded && relocated(e))) {
        if (!w.get(e.id)) w.add(structuredClone(e))
      }
    }
  }

  const authored = new Map(village.entities.map((e) => [e.id, e]))
  for (const e of saved) {
    if (e.place.on !== 'tile' || e.place.map !== 'ford') continue
    const target = authored.get(e.id)
    if ((e.id === 'ford.cart' || gardenEntity(e)) && target?.place.on === 'tile') {
      // Keep crop growth, watering, ownership and the supply crate's remaining contents.
      w.place(e, structuredClone(target.place))
    } else if (w.prop(e, 'owner') === 'npc.tobin' && e.place.x === 20 && e.place.y === 14) {
      // Legacy generated IDs for loose stock; carried or stored stock is not moved.
      w.place(e, { on: 'tile', map: FIRSTLIGHT.map, x: FIRSTLIGHT.cart[0], y: FIRSTLIGHT.cart[1] })
    }
  }

  // a cell changed to `terrain` since the map was made (kept in the state), back as the map has it
  const unmake = (x: number, y: number, terrain: string): boolean => {
    const c = w.entitiesAt('ford', x, y).find((e) => e.type === `tile/${terrain}` && !w.isStatic(e))
    if (c) w.revert(c)
    return !!c
  }
  for (let y = 11; y <= 14; y++) for (let x = 16; x <= 19; x++) unmake(x, y, 'farmland')
  // Each old repaired plank remains one repaired plank in the longer bridge's missing span.
  const repaired = [29, 30, 31].map((x) => unmake(x, 22, 'bridge'))
  repaired.forEach((done, i) => { if (done) w.setTerrain('ford', 31 + i, 22, 'bridge') })

  const tobin = w.get('npc.tobin')
  const person = index.npcs.find((e) => e.id === 'npc.tobin')
  if (tobin && person?.npc) {
    const { override, memory } = tobin.npc ?? {}
    tobin.npc = structuredClone(person.npc)
    if (override && override.map !== 'ford') tobin.npc.override = override
    // what Tobin remembers belongs to Tobin, not to the layout
    if (memory) tobin.npc.memory = memory
    const slot = scheduleAt(scheduleFor(eng, tobin), w.hour())
    if (slot) eng.teleport(tobin, { map: slot.map, x: slot.x, y: slot.y })
  }

  // New riverbanks and house walls can intersect old positions. Move rather than delete
  // actors, loose belongings or user-built fixtures. The raft and dead tree belong on water.
  for (const e of Object.values(w.state.entities)) {
    const p = e.place
    if (p.on !== 'tile' || !['ford', FIRSTLIGHT.map].includes(p.map)) continue
    if (['fixture/ferry/raft', 'fixture/nature/dead_tree'].includes(e.type)) continue
    const g = FIRSTLIGHT.garden
    const inGarden = p.map === g.map && p.x >= g.x && p.x < g.x + g.width && p.y >= g.y && p.y < g.y + g.height
    const blocked = w.isSolidTerrain(w.terrainAt(p.map, p.x, p.y))
    if (!blocked && !(inGarden && cosmetic(e))) continue
    // Select before teleporting: a cosmetic object is not itself a collision obstacle.
    let free: { map: string; x: number; y: number } | undefined
    for (let r = 1; r <= 12 && !free; r++) {
      for (let dy = -r; dy <= r && !free; dy++) for (let dx = -r; dx <= r && !free; dx++) {
        const x = p.x + dx, y = p.y + dy
        if (inGarden && cosmetic(e) && x >= g.x && x < g.x + g.width && y >= g.y && y < g.y + g.height) continue
        if (w.walkable(p.map, x, y, e.id)) free = { map: p.map, x, y }
      }
    }
    if (free) eng.teleport(e, free)
  }
  eng.npcs.invalidate()
  w.setFact(FIRSTLIGHT_LAYOUT, true)
}

/**
 * Apply once when a save from before the village's houses were redrawn (2026-10-26) loads: the village and the houses
 * it has been to are loaded as they are now, and whatever of the save's stands on what is now a wall or the dark
 * outside a house's rooms — the player, the people, things dropped or made — is moved to the nearest cell it can
 * stand on. Nothing is taken away; what is carried, stored or grown stays as it was.
 */
export function migrateFirstlightHouses(game: Game, chunks: MapChunk[]): void {
  if (game.engine.world.fact(FIRSTLIGHT_HOUSES)) return
  stepOffWalls(game, chunks)
  game.engine.world.setFact(FIRSTLIGHT_HOUSES, true)
}

/**
 * Apply once when a save from before the Pilgrim's Road and the Held Ground were redrawn (2026-10-27, docs/release-1.md
 * §7) loads: as for Firstlight's houses, whatever stands on what is now a wall or a building's dark on those maps steps
 * to the nearest cell it can stand on, and nothing is taken away.
 */
export function migratePartOneMaps(game: Game, chunks: MapChunk[]): void {
  const w = game.engine.world
  if (w.fact(PART_ONE_LAYOUT)) return
  stepOffWalls(game, chunks)
  // a thing the save kept that the maps have made a kind of what it was (Alberic's tent, a pavilion now): that kind
  for (const c of chunks)
    for (const f of c.entities) {
      const saved = w.get(f.id)
      if (saved && saved.type !== f.type && f.type.startsWith(`${saved.type}/`)) w.transform(saved, f.type)
    }
  w.setFact(PART_ONE_LAYOUT, true)
}

/**
 * The way down the mountain dressed in its ruins (2026-10-27, docs/release-1.md §4b): Cloudtop's cairn, waymarks, tower
 * and gate, the old close at the Mountain Foot, the columns and the tower at the Ford. What an older save left where a
 * wall now stands steps off it, on the maps given (those the save has been to).
 */
export function migratePrologueMaps(game: Game, chunks: MapChunk[]): void {
  const w = game.engine.world
  if (w.fact(PROLOGUE_LAYOUT)) return
  stepOffWalls(game, chunks)
  w.setFact(PROLOGUE_LAYOUT, true)
}

/**
 * The Chapel of the First Dawn redrawn (2026-10-28): its nave, apse and tower's foot on a plan, the first hearth a stone
 * hearth of its own. What an older save left where a wall now stands steps off it; the hearth it kept takes its kind.
 */
export function migrateDawnChapel(game: Game, chunks: MapChunk[]): void {
  const w = game.engine.world
  if (w.fact(CHAPEL_LAYOUT)) return
  stepOffWalls(game, chunks)
  for (const c of chunks)
    for (const f of c.entities) {
      const saved = w.get(f.id)
      if (saved && saved.type !== f.type && f.type.startsWith(`${saved.type}/`)) w.transform(saved, f.type)
    }
  w.setFact(CHAPEL_LAYOUT, true)
}

/** The maps given loaded as they are now, and what of the save stands on a wall or the dark there moved to the nearest open cell. */
function stepOffWalls(game: Game, chunks: MapChunk[]): void {
  const eng = game.engine
  const w = eng.world
  const maps = chunks.map((c) => c.map.id)
  for (const c of chunks) if (!w.map(c.map.id)) game.loadChunk(c)
  for (const e of Object.values(w.state.entities)) {
    const p = e.place
    if (p.on !== 'tile' || !maps.includes(p.map) || w.isStatic(e)) continue
    if (!w.isSolidTerrain(w.terrainAt(p.map, p.x, p.y)) && w.walkable(p.map, p.x, p.y, e.id)) continue
    let free: { map: string; x: number; y: number } | undefined
    for (let r = 1; r <= 16 && !free; r++)
      for (let dy = -r; dy <= r && !free; dy++)
        for (let dx = -r; dx <= r && !free; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && w.walkable(p.map, p.x + dx, p.y + dy, e.id)) free = { map: p.map, x: p.x + dx, y: p.y + dy }
    if (free) eng.teleport(e, free)
  }
  eng.npcs.invalidate()
}
