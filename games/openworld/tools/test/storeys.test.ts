// Storeys and what fills a cell (world-model.md §5.2, §6.6, §6.7): a solid thing and a body never
// share a cell, whether one is set down there or comes down onto the other.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, buildSandbox, buildScenario, madeOf, scenarioEvent, TICKS_PER_HOUR, type Entity, type Engine, type GameEvent, type World } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { AT, buildFord } from '../src/demo/world.ts'

const onto = buildOntology()

interface F {
  eng: Engine
  w: World
}

function fresh(): F {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  eng.author(() => eng.quests.put('descent', 'done'))
  eng.author(() => eng.teleport(eng.world.player, { map: 'ford', x: AT.spawn[0], y: AT.spawn[1] }))
  return { eng, w: eng.world }
}

const stand = (f: F, x: number, y: number, z?: number) =>
  f.eng.author(() => {
    f.w.place(f.w.player, { on: 'tile', map: 'ford', x, y, ...(z ? { z } : {}) })
    f.w.player.facing = 'up'
  })

/** Set a structure down on a cell, as the player does (building is putting it there). */
function build(f: F, type: string, x: number, y: number, id: string, ceiling = false): Entity {
  const thing = f.eng.author(() => f.w.add({ ...madeOf(f.w.onto.data, f.w.onto, type, 'wood'), id, place: { on: 'inside', holder: 'player' } }))
  // in the ceiling: the open air a storey up (docs/building.md)
  const target = ceiling ? f.w.get(f.w.cellRef('ford', x, y, 1).e)! : f.w.placedAt('ford', x, y).find((e) => e.type.startsWith('structure')) ?? f.w.cellTop('ford', x, y)!
  f.eng.act('put', 'player', { e: target.id }, { instrument: { e: thing.id } })
  return f.w.get(thing.id)!
}

/** An open stretch of the Ford, n cells across, on level ground. */
function openRow(f: F, n: number): [number, number] {
  for (let y = 3; y < 27; y++) for (let x = 3; x < 40; x++) if ([...Array(n).keys()].every((d) => f.w.walkable('ford', x + d, y) && !f.w.placedAt('ford', x + d, y).length && f.w.heightAt('ford', x + d, y) === 0)) return [x, y]
  throw new Error('no open row on the Ford')
}

const bodies = (f: F, x: number, y: number) => f.w.entitiesAt('ford', x, y).filter((e) => f.w.spacesOf(e).includes('body')).map((e) => e.id)

describe('a solid thing and a body never share a cell', () => {
  it.each([3, 4])('a fall from storey %i onto a body lands beside it on storey 2 and hurts by the actual drop', (from) => {
    const eng = buildSandbox({ terrain: Array.from({ length: 7 }, () => Array(7).fill('grass')), entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }], event: {} }, onto, new RuleLibrary(BASE_RULES))
    const w = eng.world
    eng.author(() => {
      for (let z = 0; z < 3; z++) {
        if (z) w.create('structure/floor', { on: 'tile', map: 'sandbox', x: 2, y: 3, z })
        w.create('structure/wall', { on: 'tile', map: 'sandbox', x: 2, y: 3, z })
      }
      for (const y of [2, 3, 4]) w.create('structure/floor', { on: 'tile', map: 'sandbox', x: 3, y, z: 2 })
      w.create('structure/floor', { on: 'tile', map: 'sandbox', x: 3, y: 3, z: from }, { id: 'top-floor' })
      w.place(w.player, { on: 'tile', map: 'sandbox', x: 3, y: 3, z: from })
      w.create('actor/creature/animal/chicken', { on: 'tile', map: 'sandbox', x: 3, y: 3, z: 2 }, { id: 'landing-hen' })
    })
    eng.seedRelations('sandbox')
    const hp = w.num(w.player, 'hp')
    eng.damage(w.get('top-floor')!, 100, undefined, true)
    expect(w.player.place).toMatchObject({ on: 'tile', map: 'sandbox', x: 3, y: 2, z: 2 })
    expect(w.num(w.player, 'hp')).toBe(hp - Math.max(0, from - 2 - (onto.params?.safeFall ?? 1)) * (onto.params?.fallDamage ?? 6))
    expect(w.entitiesAt('sandbox', 3, 3, 2).filter((e) => w.spacesOf(e).includes('body')).map((e) => e.id)).toEqual(['landing-hen'])
  })

  it('a floor that comes down drops whoever stood on it beside what is below, not into it', () => {
    const f = fresh()
    const [x, y] = openRow(f, 5)
    // building reaches the next cell only: stand by each one as it goes up
    stand(f, x, y + 1)
    const wall = build(f, 'structure/wall', x, y, 'st.wall')
    const over = build(f, 'structure/floor', x, y, 'st.over', true)
    stand(f, x + 1, y + 1)
    const beside = build(f, 'structure/floor', x + 1, y, 'st.beside', true)
    expect([wall.place, over.place, beside.place]).toMatchObject([{ on: 'tile', x, y }, { on: 'tile', x, y, z: 1 }, { on: 'tile', x: x + 1, y, z: 1 }])
    // a hen under the floor beside the wall, the player on that floor above her
    f.eng.author(() => f.w.create('actor/creature/animal/chicken', { on: 'tile', map: 'ford', x: x + 1, y }, { id: 'st.hen' }))
    stand(f, x + 1, y, 1)
    f.eng.author(() => f.eng.hurt(f.w.get(wall.id)!, 99, undefined, true))
    for (let i = 0; i < 3; i++) f.eng.tick()
    const p = f.w.player.place
    expect(p.on === 'tile' && !p.z).toBe(true)
    expect(bodies(f, x + 1, y)).toEqual(['st.hen'])
  })

  it('a floor that comes down leaves its planks on the ground below, not hanging where it was', () => {
    const f = fresh()
    const [x, y] = openRow(f, 5)
    stand(f, x, y + 1)
    const wall = build(f, 'structure/wall', x, y, 'st.wall')
    stand(f, x + 1, y + 1)
    const floor = build(f, 'structure/floor', x + 1, y, 'st.beside', true)
    expect(wall.place).toMatchObject({ on: 'tile', x, y })
    expect(floor.place).toMatchObject({ on: 'tile', x: x + 1, y, z: 1 })
    // far enough that the magnet does not take what falls
    stand(f, x + 4, y + 4)
    f.eng.author(() => f.eng.hurt(f.w.get(wall.id)!, 99, undefined, true))
    for (let i = 0; i < 3; i++) f.eng.tick()
    expect(f.w.get('st.beside')).toBeUndefined()
    const planks = (z: number) => [x, x + 1].flatMap((cx) => f.w.entitiesAt('ford', cx, y, z)).filter((e) => e.type === 'item/material/plank')
    expect(planks(1)).toEqual([])
    expect(planks(0).length).toBeGreaterThan(0)
  })

  it('a wall is not set down on a hen, nor on the cell its builder stands in', () => {
    const f = fresh()
    const [x, y] = openRow(f, 3)
    f.eng.author(() => f.w.create('actor/creature/animal/chicken', { on: 'tile', map: 'ford', x, y }, { id: 'st.hen' }))
    stand(f, x + 1, y + 1)
    expect(build(f, 'structure/wall', x, y, 'st.wall1').place).toMatchObject({ on: 'inside', holder: 'player' })
    stand(f, x + 2, y)
    expect(build(f, 'structure/wall', x + 2, y, 'st.wall2').place).toMatchObject({ on: 'inside', holder: 'player' })
  })
})

describe('a request names the thing it is about, even under the top of its cell', () => {
  it('the floor under a tree replays as that floor, not as the tree', () => {
    const f = fresh()
    const map = f.w.map('ford')!
    const i = map.terrain.findIndex((t) => t === 'tree')
    const [x, y] = [i % map.width, Math.floor(i / map.width)]
    const floor = f.w.occupant('ford', x, y, 'floor')!
    expect(f.w.cellTop('ford', x, y)!.id).not.toBe(floor.id)
    const ev: GameEvent = { kind: 'impulse/coat', host: { e: floor.id }, roles: { actor: { e: 'player' } }, params: { substance: 'water' }, origin: 'player' }
    const sc = buildScenario(f.eng, ev)
    expect(sc.event.host).toMatch(/^tile:\d+,\d+:floor$/)
    const sb = buildSandbox(sc, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    expect(sb.world.get(scenarioEvent(sc, sb).host.e)?.type).toBe(floor.type)
  })
})

describe('people make way for each other, and never share a cell', () => {
  it('two days in the village from a new game: no two bodies in one cell', () => {
    const { index, chunks } = buildFord()
    const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const f: F = { eng: game.engine, w: game.engine.world }
    f.eng.author(() => f.eng.teleport(f.w.player, { map: 'meadow', x: 20, y: 14 }))
    const shared = new Set<string>()
    for (let t = 0; t < TICKS_PER_HOUR * 48; t++) {
      if (f.w.scene) f.eng.story.advance()
      f.eng.tick()
      if (t % 5) continue
      const seen = new Map<string, string>()
      for (const e of f.w.entitiesOnMap(f.eng.activeMap)) {
        if (e.place.on !== 'tile' || !f.w.spacesOf(e).includes('body')) continue
        for (const [x, y] of f.w.occupiedCells(e)) {
          const k = `${x},${y},${e.place.z ?? 0}`
          if (seen.has(k)) shared.add(`${f.eng.activeMap}:${k} ${seen.get(k)}+${e.id}`)
          seen.set(k, e.id)
        }
      }
    }
    expect([...shared]).toEqual([])
  }, 300_000)
})
