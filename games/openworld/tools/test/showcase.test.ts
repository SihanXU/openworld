// The showcase's checks (docs/showcase.md §6): the hand-made places — the Holy City's Sunwell Abbey and five quarters, the
// places of the regions round it, the farm village and the mine — are all there with their halls and rooms; every way between their maps leads both ways and every hall is reached from
// its place; the quarters are one walk, street into street; nothing the place builds rises off the top of its map (the
// view could never show it), every view's rect and every pool of light lies in its map; the buildings' strips are all
// in the catalogue; and the busiest of them ticks within a tick's time.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { CATALOG } from '../../client/src/catalog.ts'
import { SHOWCASE_PLACES } from '../src/demo/showcase/index.ts'

const world = buildFord()
const maps = world.backdrop.filter((ch) => SHOWCASE_PLACES.some((p) => ch.map.id === p || ch.map.id.startsWith(`${p}.`)))
const byId = new Map(world.backdrop.map((ch) => [ch.map.id, ch]))

function game(ids: string[]) {
  const g = Game.create(world.index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const id of ids) g.loadChunk(decodeChunk(structuredClone(byId.get(id)!)))
  return g
}

describe('the showcase (docs/showcase.md)', () => {
  it('makes every one of its places with the halls and rooms it is for', () => {
    expect(SHOWCASE_PLACES.length).toBe(13)
    for (const p of SHOWCASE_PLACES) expect([p, byId.has(p)]).toEqual([p, true])
    const halls = ['holy.sunwell-abbey.nave', 'holy.sunwell-abbey.crypt', 'holy.sunwell-abbey.belfry', 'holy.sunwell-abbey.library', 'holy.sunwell-abbey.refectory', 'holy.quarter-1.hall', 'holy.quarter-1.solar', 'holy.quarter-2.hall', 'holy.quarter-3.hall', 'holy.quarter-4.inn-0', 'holy.quarter-5.inn-0',
      'frostfang.rimeholm.inn-0', 'frostfang.rimeholm.boathouse', 'frostfang.rimeholm.longhall', 'redmarch.warcombe.warhall', 'redmarch.warcombe.armoury', 'redmarch.warcombe.hospital',
      'tithe.weighmarket.counting', 'tithe.weighmarket.granary', 'tithe.weighmarket.poorhouse', 'palefen.dusk-moorings.ossuary', 'palefen.dusk-moorings.healer', 'palefen.dusk-moorings.inn-0',
      'altar.highheath-abbey.chapel', 'altar.highheath-abbey.catacombs', 'tithe.barleyridge-farm.farmhouse', 'tithe.barleyridge-farm.barn', 'tithe.barleyridge-farm.mill',
      'redmarch.brandby-mine.workings', 'redmarch.brandby-mine.oldworks']
    for (const h of halls) expect([h, byId.has(h)]).toEqual([h, true])
    // the market's keepers at their stalls, the garrison on the walls, the brothers in their choir: each place has its people
    for (const p of SHOWCASE_PLACES) expect([p, byId.get(p)!.entities.filter((e) => e.npc).length > 20]).toEqual([p, true])
  })

  it('leads every way both ways: a portal to another map is answered by one back, landing before it', () => {
    const bad: string[] = []
    for (const ch of maps)
      for (const q of ch.map.portals) {
        const there = byId.get(q.to) ?? world.chunks.find((c) => c.map.id === q.to)
        if (!there) {
          bad.push(`${ch.map.id} ${q.x},${q.y} → ${q.to}: no such map`)
          continue
        }
        // the way back: a portal on the other map to this one, from a cell beside where this one lands
        const back = there.map.portals.find((r) => r.to === ch.map.id && Math.abs(r.x - q.tx) + Math.abs(r.y - q.ty) <= 1)
        if (!back) bad.push(`${ch.map.id} ${q.x},${q.y} → ${q.to} ${q.tx},${q.ty}: no way back`)
      }
    expect(bad).toEqual([])
  })

  it('reaches every hall, room and stair from where one comes in, over cells one can walk', () => {
    const trapped: string[] = []
    for (const p of SHOWCASE_PLACES) {
      const ids = maps.filter((ch) => ch.map.id === p || ch.map.id.startsWith(`${p}.`)).map((ch) => ch.map.id)
      const g = game(ids)
      const w = g.engine.world
      // flood the place's maps from the outer map's south edge, through every portal one reaches
      const seen = new Set<string>()
      const queue: [string, number, number][] = []
      const m0 = w.map(p)!
      for (let x = 0; x < m0.width; x++) if (w.walkable(p, x, m0.height - 1, undefined, true)) queue.push([p, x, m0.height - 1])
      while (queue.length) {
        const [m, x, y] = queue.pop()!
        const k = `${m}:${x},${y}`
        if (seen.has(k)) continue
        seen.add(k)
        const portal = w.map(m)!.portals.find((q) => q.x === x && q.y === y)
        if (portal && ids.includes(portal.to)) queue.push([portal.to, portal.tx, portal.ty])
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx
          const ny = y + dy
          if (seen.has(`${m}:${nx},${ny}`)) continue
          const isPortal = w.map(m)!.portals.some((q) => q.x === nx && q.y === ny)
          if (isPortal || w.walkable(m, nx, ny, undefined, true)) queue.push([m, nx, ny])
        }
      }
      for (const id of ids) {
        const mine = w.map(id)!.portals
        for (const q of mine) if (!seen.has(`${id}:${q.x},${q.y}`)) trapped.push(`${id} ${q.x},${q.y} → ${q.to}`)
      }
    }
    expect(trapped).toEqual([])
  }, 300_000)

  it('joins the five quarters street to street: the North Gate, the Bell Ward, the Market, the Lamp Ward, the Lower Town', () => {
    const joins = (a: string, b: string) => byId.get(a)!.map.portals.some((q) => q.to === b) && byId.get(b)!.map.portals.some((q) => q.to === a)
    expect(joins('holy.quarter-1', 'holy.quarter-2')).toBe(true)
    expect(joins('holy.quarter-2', 'holy.quarter-3')).toBe(true)
    expect(joins('holy.quarter-3', 'holy.quarter-4')).toBe(true)
    expect(joins('holy.quarter-4', 'holy.quarter-5')).toBe(true)
  })

  it('raises nothing off the top of its map, and keeps its views and its light within it', () => {
    const bad: string[] = []
    for (const ch of maps) {
      const m = ch.map
      for (const s of m.stamps ?? []) {
        if (!CATALOG.prefabs[s.key]) bad.push(`${m.id}: no prefab ${s.key}`)
        // (a strip's picture begins at its stamp's row: above row 0 the view can never show it; a shadow on the ground may
        // run off the edge)
        else if (s.y < 0 && !s.key.endsWith('@shadow')) bad.push(`${m.id}: ${s.key} rises ${-s.y} rows over the top`)
      }
      for (const v of m.vistas ?? []) {
        const [x, y, w, h] = v.at
        if (x < 0 || y < 0 || x + w > m.width || y + h > m.height) bad.push(`${m.id}: a vista at ${v.at} off the map`)
        if (v.focus && (v.focus[0] < 0 || v.focus[1] < 0 || v.focus[0] >= m.width || v.focus[1] >= m.height)) bad.push(`${m.id}: a vista's focus ${v.focus} off the map`)
      }
      for (const l of m.lights ?? []) if (l.x < 0 || l.y < 0 || l.x >= m.width || l.y >= m.height) bad.push(`${m.id}: a pool of light at ${l.x},${l.y} off the map`)
    }
    expect(bad).toEqual([])
  })

  it('ticks its busiest place, the Market with its stalls and its keepers, within a tick of the game', () => {
    const ids = maps.filter((ch) => ch.map.id === 'holy.quarter-3' || ch.map.id.startsWith('holy.quarter-3.')).map((ch) => ch.map.id)
    const g = game(ids)
    const eng = g.engine
    eng.author(() => eng.teleport(eng.world.player, { map: 'holy.quarter-3', x: 31, y: 45 }))
    for (let t = 0; t < 60; t++) eng.tick()
    const t0 = performance.now()
    for (let t = 0; t < 50; t++) eng.tick()
    expect((performance.now() - t0) / 50).toBeLessThan(25)
  }, 120_000)
})
