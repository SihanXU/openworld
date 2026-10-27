import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, textOf } from '@openworld/engine'
import { BASE_RULES, CH1, PART_TWO, VALLEY, HAVEN_LAYOUT, OVERWORLD_LAYOUT, SITE_GATES, migrateHaven, migrateHavenHeart, STORY_RULES, WILD_GROUNDS, buildOntology, decodeChunk, migrateOverworld, wildChunk } from '@openworld-game/content'
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
      // and one who went into the Held Ground from beside the village, its way back kept on the old map (effects.ts pocket)
      w.setProp(w.player, 'pocket.return', `${OVERWORLD},${meadow.x * 3 + 1},${meadow.y * 3 + 2}`)
    })
    w.state.maps[OVERWORLD] = map
    g.engine.author(() => migrateOverworld(g, chunk))
    expect(w.fact(OVERWORLD_LAYOUT)).toBe(true)
    expect(w.get('site.meadow')).toMatchObject({ type: 'site/place/village', place: { x: meadow.x, y: meadow.y } })
    expect(Object.values(w.state.entities).filter((e) => e.type.startsWith('site')).length).toBe(sites.length)
    expect(w.posOf(w.player)).toMatchObject({ map: OVERWORLD, x: meadow.x, y: meadow.y })
    // out of the Held Ground, one comes back to the cell one left, not to a cell of the old, bigger map
    expect(w.prop(w.player, 'pocket.return')).toBe(`${OVERWORLD},${meadow.x},${meadow.y}`)
  })

  it('a save laid out a place to a tile before the Pilgrim\'s Road gets the places as the map has them now (the four new ones, the east moved along); a way back out of the Held Ground still kept on the old scale comes down to its cell', () => {
    const g = game()
    const w = g.engine.world
    const chunk = decodeChunk(buildFord().chunks.find((c) => c.map.id === OVERWORLD)!)
    const cell = (id: string) => ({ ...(w.get(id)!.place as { x: number; y: number }) })
    const [road, rest, meadow] = [cell('site.eastroad'), cell('site.waystation'), cell('site.meadow')]
    // as such a save has them: no Pilgrim's Road on the map, the East Road where the Rest is now, a wild place where the
    // East Road is; the Oath-Thorn's way back kept on the 3 x 3 scale (the first layout's migration did not move it)
    g.engine.author(() => {
      for (const id of ['site.waystation', 'site.pilgrimway', 'site.abbey', 'site.kneelfield']) w.destroy(w.get(id)!)
      w.place(w.get('site.eastroad')!, { on: 'tile', map: OVERWORLD, x: rest.x, y: rest.y })
      w.add({ id: `site.${road.x}.${road.y}`, type: 'site/wild', place: { on: 'tile', map: OVERWORLD, x: road.x, y: road.y }, props: { map: `wild.${road.x}.${road.y}` } })
      w.setFact('content.overworld-cells-v2', true)
      w.setFact(OVERWORLD_LAYOUT, 0)
      w.setProp(w.player, 'pocket.return', `${OVERWORLD},${meadow.x * 3 + 1},${meadow.y * 3 + 1}`)
    })
    g.engine.author(() => migrateOverworld(g, chunk))
    expect(w.fact(OVERWORLD_LAYOUT)).toBe(true)
    for (const e of chunk.entities.filter((x) => x.type.startsWith('site'))) expect([e.id, w.get(e.id)?.place]).toEqual([e.id, e.place])
    expect(w.get(`site.${road.x}.${road.y}`)).toBeUndefined()
    expect(w.prop(w.player, 'pocket.return')).toBe(`${OVERWORLD},${meadow.x},${meadow.y}`)
    // a way back on the map as it is now is left as it is
    g.engine.author(() => (w.setFact('content.overworld-cells-v2', true), w.setFact(OVERWORLD_LAYOUT, 0), w.setProp(w.player, 'pocket.return', `${OVERWORLD},${meadow.x},${meadow.y}`)))
    g.engine.author(() => migrateOverworld(g, chunk))
    expect(w.prop(w.player, 'pocket.return')).toBe(`${OVERWORLD},${meadow.x},${meadow.y}`)
  })

  it('every place the story seals on the world map is shut by a gate that says why (content SITE_GATES): drawn sealed, it does not let one in', () => {
    const g = game()
    const w = g.engine.world
    const gates = new Set(SITE_GATES.map((x) => x.fact))
    const sealed = Object.values(w.state.entities).filter((e) => e.type.startsWith('site') && typeof e.props?.opensWhen === 'string')
    expect(sealed.length).toBeGreaterThan(0)
    for (const e of sealed) expect([e.id, gates.has(String(e.props!.opensWhen))]).toEqual([e.id, true])
    // and the gate holds: E on the place's cell says why and one stays on the world map; opened, one goes in
    const enter = (site: (typeof sealed)[number]) => {
      const { x, y } = site.place as { x: number; y: number }
      g.engine.author(() => (w.place(w.player, { on: 'tile', map: OVERWORLD, x, y }), (w.player.facing = 'down')))
      g.engine.controls.run(g.engine.controls.plan('hands')!)
      for (let i = 0; i < 10; i++) g.engine.tick()
      return w.posOf(w.player)!.map
    }
    for (const e of sealed) expect([e.id, enter(e)]).toEqual([e.id, OVERWORLD])
    // nor is it walked onto or across: from an open cell beside it, a step into it is a bump, and it is said why in its
    // gate's words — the companion's, or the message line's with none at hand; and no one else walks it either (it is
    // not passable)
    const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const
    let bumped = 0
    for (const e of sealed) {
      const { x, y } = e.place as { x: number; y: number }
      expect([e.id, w.passable(OVERWORLD, x, y)]).toEqual([e.id, false])
      const side = (Object.entries(DIRS) as [keyof typeof DIRS, readonly [number, number]][]).find(([, d]) => w.passable(OVERWORLD, x - d[0], y - d[1]))
      if (!side) continue
      const [dir, d] = side
      g.engine.author(() => w.place(w.player, { on: 'tile', map: OVERWORLD, x: x - d[0], y: y - d[1] }))
      g.engine.setCooldown(w.player.id, 0)
      w.fx = []
      g.engine.movePlayer(dir)
      for (let i = 0; i < 3; i++) g.engine.tick()
      expect([e.id, w.posOf(w.player)]).toEqual([e.id, { map: OVERWORLD, x: x - d[0], y: y - d[1] }])
      const gate = SITE_GATES.find((s) => s.fact === e.props!.opensWhen)!
      const said = (x: (typeof w.fx)[number]) => (x.t === 'log' && (x.text as { en: string }).en === textOf(gate.say)) || (x.t === 'say' && [textOf(gate.remark), textOf(gate.again)].includes((x.text as { en: string }).en))
      expect([e.id, w.fx.some(said)]).toEqual([e.id, true])
      bumped++
    }
    expect(bumped).toBeGreaterThan(0)
    g.engine.author(() => { for (const f of gates) w.setFact(f, 1) })
    expect(w.passable(OVERWORLD, (sealed[0].place as { x: number }).x, (sealed[0].place as { y: number }).y)).toBe(true)
    expect(enter(sealed[0])).toBe(sealed[0].props!.map)
  })

  it('sealing a place closes only its own cell: what is open on the world map stays joined — the valley and its places, each part of the tale, every open cell reached as it was with the seals lifted', () => {
    const g = game()
    const w = g.engine.world
    const reach = (x: number, y: number, open: (x: number, y: number) => boolean) => {
      const seen = new Set([`${x},${y}`])
      const queue: [number, number][] = [[x, y]]
      while (queue.length) {
        const [cx, cy] = queue.pop()!
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${cx + dx},${cy + dy}`
          if (seen.has(k) || !w.inBounds(OVERWORLD, cx + dx, cy + dy) || !open(cx + dx, cy + dy)) continue
          seen.add(k)
          queue.push([cx + dx, cy + dy])
        }
      }
      return seen
    }
    const sites = Object.values(w.state.entities).filter((e) => e.type.startsWith('site') && e.place.on === 'tile' && e.place.map === OVERWORLD)
    const cellOf = (e: (typeof sites)[number]) => `${(e.place as { x: number }).x},${(e.place as { y: number }).y}`
    // the ground as if nothing were sealed: a cell is open if its ground is, whatever stands for a place there
    const ground = (x: number, y: number) => !w.blocked(OVERWORLD, x, y) || w.entitiesAt(OVERWORLD, x, y).some((e) => w.sealed(e))
    const meadow = w.get('site.meadow')!.place as { x: number; y: number }
    // each stage of the tale: Part One (nothing opened), past the knight, Part Two
    for (const opened of [[], [CH1.knight], [CH1.knight, PART_TWO]]) {
      g.engine.author(() => { for (const f of opened) w.setFact(f, 1) })
      const now = reach(meadow.x, meadow.y, (x, y) => w.passable(OVERWORLD, x, y))
      const sealedCells = new Set(sites.filter((e) => w.sealed(e)).map(cellOf))
      const lifted = [...reach(meadow.x, meadow.y, ground)].filter((k) => !sealedCells.has(k))
      expect([opened, lifted.filter((k) => !now.has(k))]).toEqual([opened, []])
      // Part One's valley: its ten wild places and the hand-made places of the west bank, every one reached
      if (!opened.length) {
        const west = ['meadow', 'pasture', 'forest', 'hollow', 'charcoal', 'barrow', 'mill', 'dawnhill', 'foot', 'hillmine']
        const want = [...Object.keys(VALLEY), ...west.map((id) => cellOf(w.get(`site.${id}`)!))]
        expect(want.filter((k) => !now.has(k))).toEqual([])
      }
    }
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
