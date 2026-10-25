// A building's picture as pieces bound to its walls (render/pieces.ts, docs/building.md §10): what is drawn is what
// the state holds — a wall losing durability cracks, a wall burnt is black, a wall gone is a hole one walks into.

import { describe, expect, it } from 'vitest'
import { crackStage, pieceDepth, pieceState, piecesOf, type TerrainFacts } from '../src/render/pieces.ts'
import { depthOf } from '../src/render/depth.ts'
import { T } from '../src/assets/ground.ts'
import type { PrefabDef } from '../src/assets/types.ts'

const SOLID = new Set(['wall', 'woodwall', 'burnt_wall', 'water'])
const facts: TerrainFacts = { solid: (t) => SOLID.has(t), burnt: (t) => t === 'burnt_wall' }
/** A 4x3 cottage: its roof two rows, its front wall the third with the door; and a store whose top corners draw nothing. */
const cottage: PrefabDef = { img: 'h.png', x: 0, y: 0, tw: 4, th: 3, grid: ['####', '####', '#D##'], terrain: 'woodwall' }
const store: PrefabDef = { img: 'h.png', x: 0, y: 0, tw: 4, th: 2, grid: ['  ##', '#D##'] }
const pool: PrefabDef = { img: 'p.png', x: 0, y: 0, tw: 2, th: 2, grid: ['##', '##'], terrain: 'water', ground: true }
/** A map's file with the cottage stamped at (10,5): its walls woodwall, its door a door, the street round it. */
const file = (x: number, y: number) => (x >= 10 && x < 14 && y >= 5 && y < 8 ? (x === 11 && y === 7 ? 'door' : 'woodwall') : 'path')

describe('a building drawn as pieces (pieces.ts)', () => {
  it('cuts its picture into a piece per cell: each solid one bound to the wall the file has there, the door and what draws over nothing free', () => {
    const ps = piecesOf(cottage, { x: 10, y: 5 }, file, facts)
    expect(ps).toHaveLength(12)
    expect(ps.filter((p) => p.bound).map((p) => `${p.x},${p.y}`)).toHaveLength(11)
    expect(ps.find((p) => p.x === 11 && p.y === 7)?.bound).toBeUndefined()
    expect(ps.find((p) => p.x === 12 && p.y === 7)).toMatchObject({ i: 2, j: 2, bound: 'woodwall' })
    // the store's empty corners are drawn (they hold nothing of the wall) and bound to nothing
    const sp = piecesOf(store, { x: 0, y: 0 }, () => 'wall', facts)
    expect(sp.filter((p) => p.j === 0 && p.i < 2).every((p) => !p.bound)).toBe(true)
    // a picture laid as ground (a pool one wades into) is never cut loose from its water
    expect(piecesOf(pool, { x: 0, y: 0 }, () => 'water', facts).every((p) => !p.bound)).toBe(true)
    // a solid cell the file has no wall in (out of the map) binds nothing
    expect(piecesOf(cottage, { x: 0, y: 0 }, () => '', facts).every((p) => !p.bound)).toBe(true)
  })

  it('shows its wall as the state has it: whole, cracked by thirds, blackened, gone', () => {
    const [p] = piecesOf(cottage, { x: 10, y: 5 }, file, facts)
    // a cell the frame does not name is as the file has it
    expect(pieceState(p, undefined, facts)).toEqual({ gone: false, crack: 0, burnt: false })
    expect(pieceState(p, { terrain: 'woodwall', hp: 11, maxHp: 12 }, facts)).toEqual({ gone: false, crack: 1, burnt: false })
    expect(pieceState(p, { terrain: 'woodwall', hp: 6, maxHp: 12 }, facts)).toEqual({ gone: false, crack: 2, burnt: false })
    expect(pieceState(p, { terrain: 'woodwall', hp: 1, maxHp: 12 }, facts)).toEqual({ gone: false, crack: 3, burnt: false })
    expect(pieceState(p, { terrain: 'burnt_wall', hp: 3, maxHp: 4 }, facts)).toEqual({ gone: false, crack: 1, burnt: true })
    // broken: the cell shows the ground under it, and the piece is a hole
    expect(pieceState(p, { terrain: 'path' }, facts)).toEqual({ gone: true })
    // a piece bound to nothing (the door) is drawn whatever is there
    const door = piecesOf(cottage, { x: 10, y: 5 }, file, facts).find((d) => !d.bound)!
    expect(pieceState(door, { terrain: 'path' }, facts)).toEqual({ gone: false, crack: 0, burnt: false })
  })

  it('cracks by thirds of the durability lost', () => {
    expect([crackStage(undefined, 12), crackStage(12, 12), crackStage(9, 12), crackStage(8, 12), crackStage(4, 12), crackStage(3, 12), crackStage(0, 12)]).toEqual([0, 0, 1, 1, 2, 3, 3])
  })

  it('whole, drawn at its last solid row; opened, row by row: one standing in a hole is behind the rows south of it and in front of those north', () => {
    const at = { y: 5 }
    const whole = [0, 1, 2].map((j) => pieceDepth(cottage, at, j, false))
    expect(new Set(whole).size).toBe(1)
    expect(whole[0]).toBe(8 * T - 2)
    // one in the street behind it (row 4) is behind all of it; one in front (row 8) in front of all of it
    expect(depthOf({ y: 4, tags: ['agent'] })).toBeLessThan(whole[0])
    expect(depthOf({ y: 8, tags: ['agent'] })).toBeGreaterThan(whole[0])
    // opened, one standing in the middle row's hole (row 6)
    const inHole = depthOf({ y: 6, tags: ['agent'] })
    expect(pieceDepth(cottage, at, 0, true)).toBeLessThan(inHole)
    expect(pieceDepth(cottage, at, 1, true)).toBeLessThan(inHole)
    expect(pieceDepth(cottage, at, 2, true)).toBeGreaterThan(inHole)
    // what a broken wall left lying in its cell is drawn over the rows behind it
    expect(depthOf({ y: 6, tags: ['portable'] })).toBeGreaterThan(pieceDepth(cottage, at, 1, true))
    expect(pieceDepth(pool, at, 0, true)).toBe(-40)
  })
})
