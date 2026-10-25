// The relief (world-model.md §5.5): ground at different heights is joined only by stairs and ramps; off a ledge a
// level high one drops, one way (over its face to its foot where it drops south); a higher drop and every face are
// walls. The same for the player, the people and the creatures, stepping and planning.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, astar, buildSandbox, faceCells, wayTo, type Engine } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '@openworld-game/content'

const onto = buildOntology()

// a ledge a level high over the north (x 2-6, its face the row below it, a ramp cut in it at x 5), two levels at x 0-1
// (its face two rows), and a block two levels high standing alone at (6, 6)
const HEIGHTS = [
  '4422222',
  '4422222',
  '4422222',
  '0000010',
  '0000000',
  '0000000',
  '0000004',
  '0000000',
  '0000000',
].map((r) => [...r].map(Number))

function sandbox(): Engine {
  const eng = buildSandbox({
    terrain: HEIGHTS.map((r) => r.map(() => 'grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 3, y: 2 },
      { key: 'hen', type: 'actor/creature/animal/chicken', x: 4, y: 2 },
    ],
    event: {},
  }, onto, new RuleLibrary(BASE_RULES))
  eng.world.state.maps.sandbox.heights = HEIGHTS.flat()
  return eng
}

const put = (eng: Engine, id: string, x: number, y: number) => eng.author(() => eng.world.place(eng.world.get(id)!, { on: 'tile', map: 'sandbox', x, y }))
const at = (eng: Engine, id: string) => {
  const p = eng.world.posOf(eng.world.get(id))!
  return [p.x, p.y]
}

describe('the relief', () => {
  it('a face covers the ground below an edge that drops south, a cell a level; a ramp cuts it', () => {
    const f = faceCells(7, 9, HEIGHTS.flat())
    const face = (x: number, y: number) => f[y * 7 + x]
    expect([face(2, 3), face(4, 3), face(6, 3), face(5, 3)]).toEqual([1, 1, 1, 0])
    expect([face(0, 3), face(1, 4), face(0, 5)]).toEqual([2, 2, 0])
    expect([face(6, 7), face(6, 8), face(5, 6)]).toEqual([2, 2, 0])
    expect([face(2, 4), face(3, 2)]).toEqual([0, 0])
  })

  it('off a ledge a level high one leaps its face to the foot, unharmed, and cannot go back up', () => {
    const eng = sandbox()
    const w = eng.world
    const hp = w.num(w.player, 'hp')
    expect(eng.step(w.player, 'down')).toBe(true)
    expect(at(eng, w.player.id)).toEqual([3, 4])
    expect(w.num(w.player, 'hp')).toBe(hp)
    // up into the face is a wall; so is walking along it
    expect(eng.step(w.player, 'up')).toBe(false)
    expect(at(eng, w.player.id)).toEqual([3, 4])
    put(eng, w.player.id, 5, 3)
    expect(eng.step(w.player, 'left')).toBe(false)
    expect(eng.step(w.player, 'right')).toBe(false)
    expect(at(eng, w.player.id)).toEqual([5, 3])
  })

  it('a ramp is walked both ways', () => {
    const eng = sandbox()
    const w = eng.world
    put(eng, w.player.id, 5, 2)
    expect([eng.step(w.player, 'down'), eng.step(w.player, 'down')]).toEqual([true, true])
    expect(at(eng, w.player.id)).toEqual([5, 4])
    expect([eng.step(w.player, 'up'), eng.step(w.player, 'up')]).toEqual([true, true])
    expect(at(eng, w.player.id)).toEqual([5, 2])
  })

  it('beside a ledge a level high one drops onto the ground there, one way; a drop of two levels is a wall', () => {
    const eng = sandbox()
    const w = eng.world
    // from the two-level shelf west onto the ledge a level below it, and not back
    put(eng, w.player.id, 1, 1)
    expect(eng.step(w.player, 'right')).toBe(true)
    expect(at(eng, w.player.id)).toEqual([2, 1])
    expect(eng.step(w.player, 'left')).toBe(false)
    // off the shelf's face (two levels): a wall
    put(eng, w.player.id, 1, 2)
    expect(eng.step(w.player, 'down')).toBe(false)
    // off the block two levels high, sideways: a wall
    put(eng, w.player.id, 6, 6)
    expect(eng.step(w.player, 'left')).toBe(false)
    expect(at(eng, w.player.id)).toEqual([6, 6])
  })

  it('a creature keeps the same rule as the player', () => {
    const eng = sandbox()
    const hen = eng.world.get('hen')!
    expect(eng.step(hen, 'down')).toBe(true)
    expect(at(eng, 'hen')).toEqual([4, 4])
    expect(eng.step(hen, 'up')).toBe(false)
  })

  it('a path leaps the ledge down, and comes back up by the ramp, never over a face', () => {
    const eng = sandbox()
    const w = eng.world
    const plan = (sx: number, sy: number, tx: number, ty: number) => astar(7, 9, (x, y) => w.passable('sandbox', x, y), sx, sy, tx, ty, undefined, (ax, ay, bx, by) => w.safeStep(w.player, 'sandbox', ax, ay, bx, by))
    expect(plan(3, 2, 3, 6)).toEqual([[3, 4], [3, 5], [3, 6]])
    const up = plan(3, 6, 3, 2)!
    expect(up.some(([x, y]) => w.faceAt('sandbox', x, y))).toBe(false)
    expect(up).toContainEqual([5, 3])
    // each step of it a neighbour, or the way it says
    let [x, y] = [3, 6]
    for (const [nx, ny] of up) {
      expect(wayTo(x, y, nx, ny)).toBeDefined()
      ;[x, y] = [nx, ny]
    }
    // to the top of the two-level shelf there is no way at all
    expect(plan(3, 6, 0, 1)).toBeUndefined()
  })

  it('a path is followed by the way to each cell, a leap included', () => {
    expect([wayTo(3, 2, 3, 3), wayTo(3, 2, 3, 4), wayTo(3, 2, 4, 2), wayTo(3, 2, 4, 3), wayTo(3, 2, 3, 5), wayTo(3, 2, 3, 2)]).toEqual(['down', 'down', 'right', undefined, undefined, undefined])
  })
})
