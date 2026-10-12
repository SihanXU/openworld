import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, HAVEN_LAYOUT, OVERWORLD_LAYOUT, migrateHaven, migrateHavenHeart, STORY_RULES, WILD_GROUNDS, buildOntology, decodeChunk, migrateOverworld, wildChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'
import { OVERWORLD } from '../src/demo/overworld.ts'
import { UNDER_BARROW } from '../src/demo/hollow.ts'

// The overworld's checks (world-model.md §10.2): every map's edges lead to its cell; a map's
// barriers are mirrored there (parts it keeps apart, the overworld keeps apart); a wilderness is
// the same map for the same seed and cell.

function world() {
  return game().engine.world
}
function game() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  return game
}

describe('the overworld (world-model.md §5.1, §10.2)', () => {
  it('mirrored barriers: what a map keeps apart (its banks), the overworld keeps apart — the places each bank\'s ways lead to are out of each other\'s reach but through the map', () => {
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
      const m = w.map(id)!
      if (!m.site || new Set(w.partsOf(id)!.filter((p) => p >= 0)).size < 2) continue
      parted++
      // the place a cell of its part's ways leads to, by part
      const cells = m.portals.map((p) => ({ part: w.partAt(id, p.x, p.y), site: w.map(p.to)?.site })).filter((c) => c.site?.map === OVERWORLD)
      expect(new Set(cells.map((c) => c.part)).size).toBeGreaterThan(1)
      // its own cell is the barrier's: not stood on
      expect(w.passable(OVERWORLD, m.site.x, m.site.y)).toBe(false)
      for (const a of cells) {
        const r = reach(a.site!.x, a.site!.y)
        for (const b of cells) if (a.part !== b.part && r.has(`${b.site!.x},${b.site!.y}`)) split.push(`${id}: part ${a.part}'s ${a.site!.x},${a.site!.y} reaches part ${b.part}'s ${b.site!.x},${b.site!.y}`)
      }
    }
    expect(parted).toBeGreaterThan(0)
    expect(split).toEqual([])
  })

  it('every map but the overworld (and the tutorial, which lies nowhere, the floors under the barrow, reached by its stairs, and the Held Ground and its grounds, carried in a thorn) lies on a cell of land, and that cell holds the site that leads into it', () => {
    const w = world()
    for (const id of w.state.loadedMaps.filter((m) => m !== OVERWORLD && m !== 'tutorial' && m !== 'offstage' && m !== 'haven' && !m.startsWith('haven.') && w.map(m)!.kind !== 'interior' && !(UNDER_BARROW as readonly string[]).includes(m))) {
      const s = w.map(id)!.site!
      const site = w.entitiesAt(OVERWORLD, s.x, s.y).find((e) => e.props?.map === id)
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

  it('an older save (3 x 3 tiles to a place) is brought to a place a tile: its places where the map has them now, and one standing on it on the cell its old block was', () => {
    const g = game()
    const w = g.engine.world
    const chunk = decodeChunk(buildFord().chunks.find((c) => c.map.id === OVERWORLD)!)
    const sites = Object.values(w.state.entities).filter((e) => e.type.startsWith('site'))
    const meadow = w.get('site.meadow')!.place as { x: number; y: number }
    // a save leaves the maps out: what stood on the old, bigger map is where it was until it is moved
    const map = w.state.maps[OVERWORLD]
    delete w.state.maps[OVERWORLD]
    g.engine.author(() => {
      // as an older save had them: each site at the foot of its block, of the old type
      for (const e of sites) w.place(e, { on: 'tile', map: OVERWORLD, x: (e.place as { x: number }).x * 3 + 1, y: (e.place as { y: number }).y * 3 + 2 })
      w.get('site.meadow')!.type = 'site/place'
      w.place(w.player, { on: 'tile', map: OVERWORLD, x: meadow.x * 3 + 2, y: meadow.y * 3 + 1 })
    })
    w.state.maps[OVERWORLD] = map
    g.engine.author(() => migrateOverworld(g, chunk))
    expect(w.fact(OVERWORLD_LAYOUT)).toBe(true)
    expect(w.get('site.meadow')).toMatchObject({ type: 'site/place/village', place: { x: meadow.x, y: meadow.y } })
    expect(Object.values(w.state.entities).filter((e) => e.type.startsWith('site')).length).toBe(sites.length)
    expect(w.posOf(w.player)).toMatchObject({ map: OVERWORLD, x: meadow.x, y: meadow.y })
  })

  it('an older save\'s widening errands (the Held Ground widened by Alberic\'s quests) go; how far the ground goes stays', () => {
    const g = game()
    const w = g.engine.world
    g.engine.author(() => {
      w.add({ id: 'quest.haven1', type: 'resident/quest', place: { on: 'resident' }, props: { quest: 'haven1', state: 'active', stage: 10 } })
      w.setFact('q.haven1', 'active')
      w.setFact('haven.size', 0)
    })
    g.engine.author(() => migrateHaven(g))
    expect([w.get('quest.haven1'), w.fact('q.haven1'), w.fact('haven.size'), w.fact(HAVEN_LAYOUT)]).toEqual([undefined, undefined, 0, true])
    // the heart, drawn as an altar in an older save, is the planted sword
    g.engine.author(() => w.transform(w.get('haven.heart')!, 'fixture/sacred/altar'))
    g.engine.author(() => migrateHavenHeart(g))
    expect(w.get('haven.heart')!.type).toBe('fixture/sacred/sword')
  })
})
