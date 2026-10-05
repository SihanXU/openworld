import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, WILD_GROUNDS, buildOntology, decodeChunk, wildChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'
import { BLOCK, OVERWORLD } from '../src/demo/overworld.ts'

// The overworld's checks (world-model.md §10.2): every map's edges lead to its cell; a map's
// barriers are mirrored there (parts it keeps apart, the overworld keeps apart); a wilderness is
// the same map for the same seed and cell.

function world() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return game.engine.world
}

describe('the overworld (world-model.md §5.1, §10.2)', () => {
  it('mirrored barriers: what a map keeps apart (its banks), the overworld keeps apart', () => {
    const w = world()
    const reach = (x: number, y: number) => {
      const seen = new Set([`${x},${y}`])
      const queue: [number, number][] = [[x, y]]
      while (queue.length) {
        const [cx, cy] = queue.pop()!
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${cx + dx},${cy + dy}`
          if (seen.has(k) || !w.passable(OVERWORLD, cx + dx, cy + dy)) continue
          seen.add(k)
          queue.push([cx + dx, cy + dy])
        }
      }
      return seen
    }
    const split: string[] = []
    let parted = 0
    for (const id of w.state.loadedMaps) {
      const site = w.map(id)?.site
      if (!site) continue
      const tiles: { x: number; y: number; part: number }[] = []
      for (let j = 0; j < BLOCK; j++)
        for (let i = 0; i < BLOCK; i++) {
          const x = site.x + i
          const y = site.y + j
          if (w.passable(OVERWORLD, x, y)) tiles.push({ x, y, part: w.regionPart(id, i, j, BLOCK) })
        }
      const parts = new Set(tiles.map((t) => t.part))
      if (parts.size > 1) parted++
      for (const a of tiles) {
        const r = reach(a.x, a.y)
        for (const b of tiles) if (a.part !== b.part && r.has(`${b.x},${b.y}`)) split.push(`${id}: part ${a.part} at ${a.x},${a.y} reaches part ${b.part} at ${b.x},${b.y}`)
      }
    }
    expect(parted).toBeGreaterThan(0)
    expect(split).toEqual([])
  })

  it('every map but the overworld (and the tutorial, which lies nowhere) lies on a cell of land, and that cell holds the site that leads into it', () => {
    const w = world()
    for (const id of w.state.loadedMaps.filter((m) => m !== OVERWORLD && m !== 'tutorial')) {
      const s = w.map(id)!.site!
      const site = w.entitiesAt(OVERWORLD, s.x + 1, s.y + BLOCK - 1).find((e) => e.props?.map === id)
      expect([id, !!site]).toEqual([id, true])
    }
  })

  it('a wilderness is the same map for the same seed and cell, for every ground; another cell, another map', () => {
    for (const ground of WILD_GROUNDS) {
      const a = wildChunk(4242, 3, 4, ground, undefined)
      const b = wildChunk(4242, 3, 4, ground, undefined)
      expect(b).toEqual(a)
      expect(wildChunk(4242, 4, 4, ground, undefined).map.terrain).not.toEqual(a.map.terrain)
    }
  })
})
