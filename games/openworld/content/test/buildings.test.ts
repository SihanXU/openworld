// The buildings one finds (docs/building.md §10): a house's walls are things of the world like any other — their
// durability, what they are made of, whose they are. A blow on one is its own outcome (core/strike, the instrument's
// efficiency on its material) and marks it; but the walls the maps are built of endure (wall/endure): hit to nothing
// they hold at their last crack, solid, nothing falling out — the way in stays the door. Damaging someone's house is
// still a deed against its household (the society module's vandalism), judged by whoever saw it. What one builds
// oneself (structure/wall) still breaks, and a tool still knocks it loose.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, regionId, snapshot, type Engine, type Key } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()

/**
 * A house's front, three cells of `wall` at (3..5, 1..2), the street below; the player at (4,3) facing it holding
 * `tool`; a neighbour of the household (or not) watching from (7,4). `owned`: the shell is the household's.
 */
function street(wall: string, tool: string, opts: { owned?: boolean; neighbour?: boolean } = {}): Engine {
  const terrain = Array.from({ length: 6 }, (_, y) => Array.from({ length: 9 }, (_, x) => (x >= 3 && x <= 5 && (y === 1 || y === 2) ? wall : 'path')))
  const eng = buildSandbox(
    {
      terrain,
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 4, y: 3, props: { atk: 2 } },
        { key: 'tool', type: tool, x: 4, y: 3, heldBy: 'actor', tags: ['material:iron'] },
        ...(opts.neighbour !== false ? [{ key: 'hesper', type: 'actor/person/ferrykeeper', x: 7, y: 4, props: { household: 'h1' } }] : []),
      ],
      event: {},
    },
    onto,
    new RuleLibrary([...BASE_RULES, ...STORY_RULES]),
  )
  const h = eng.world.get('hesper')
  if (h) {
    h.name = { en: 'Hesper', zh: '赫斯珀' }
    h.npc = { role: 'ferrykeeper', schedule: [{ from: 0, to: 24, map: 'sandbox', x: 7, y: 4, activity: 'watch the street' }], person: {} }
  }
  // the house's shell is whose its rooms are (games/openworld/tools/src/demo/shells.ts lays these on every map)
  if (opts.owned !== false) eng.author(() => eng.world.add({ id: regionId('sandbox', 'shell.3.1.0.0'), type: 'region', place: { on: 'area', map: 'sandbox', rects: [[3, 1, 3, 2]] }, props: { owner: 'household:h1' } }))
  eng.world.get('actor')!.facing = 'up'
  return eng
}

/** The left click on what is in front (the held thing's own use), as the keys press it. */
function swing(eng: Engine): void {
  const choice = eng.controls.choices('use' as Key).find((c) => c.plan)
  if (choice?.plan) eng.controls.run(choice.plan, true)
}

/** Swing `n` times at the wall in front. */
function hit(eng: Engine, n: number): void {
  for (let i = 0; i < n; i++) swing(eng)
}

/** The wall in front as the frame tells it: its terrain and durability. */
const shown = (eng: Engine) => snapshot(eng).tiles.find((t) => t.x === 4 && t.y === 2)
const lying = (eng: Engine) => eng.world.placedAt('sandbox', 4, 2).map((e) => e.type)

describe('a house wall marks but never gives way (docs/building.md §10)', () => {
  it('a wooden wall under an axe: each blow its own outcome, the frame telling its durability; hit to nothing it holds at its last crack, solid, nothing falling out', () => {
    const eng = street('woodwall', 'item/weapon/blade/axe')
    swing(eng)
    const cell = shown(eng)!
    expect(cell.terrain).toBe('woodwall')
    expect(cell.hp).toBeLessThan(cell.maxHp!)
    hit(eng, 40)
    expect(shown(eng)).toMatchObject({ terrain: 'woodwall', hp: 1, maxHp: 12 })
    expect(eng.world.passable('sandbox', 4, 2)).toBe(false)
    expect(lying(eng)).toEqual([])
  })

  it('every wall a building is made of endures whatever strikes it: stone, wood, canvas, thatch, snow, a burnt one', () => {
    for (const wall of ['wall', 'woodwall', 'canvaswall', 'thatchwall', 'snowwall', 'burnt_wall'])
      for (const tool of ['item/weapon/blade/axe', 'item/tool/pickaxe']) {
        const eng = street(wall, tool, { neighbour: false })
        hit(eng, 60)
        expect([wall, tool, shown(eng)?.terrain ?? wall, eng.world.passable('sandbox', 4, 2), lying(eng)]).toEqual([wall, tool, wall, false, []])
      }
    // a pick bites stone where an axe hardly marks it (the efficiency table, unchanged)
    const axed = street('wall', 'item/weapon/blade/axe', { neighbour: false })
    const picked = street('wall', 'item/tool/pickaxe', { neighbour: false })
    swing(axed)
    swing(picked)
    expect(shown(picked)!.hp!).toBeLessThan(shown(axed)!.hp!)
  })

  it('a fire on a wall wears it to the same crack and leaves it scorched black, never burnt away', () => {
    for (const wall of ['woodwall', 'canvaswall', 'thatchwall']) {
      const eng = street(wall, 'item/weapon/blade/axe', { neighbour: false })
      const top = () => eng.world.cellTop('sandbox', 4, 2)!
      eng.author(() => eng.applyStatus({ e: top().id }, 'burning'))
      for (let i = 0; i < 2000 && eng.world.hasStatus({ e: top().id }, 'burning'); i++) eng.tick()
      expect([wall, eng.world.terrainAt('sandbox', 4, 2), eng.world.passable('sandbox', 4, 2)]).toEqual([wall, 'burnt_wall', false])
    }
  })

  it("damaging someone's house is vandalism against its household, seen by the neighbour; a wall nobody owns is nobody's business", () => {
    const eng = street('woodwall', 'item/weapon/blade/axe')
    hit(eng, 3)
    const deeds = eng.world.get('hesper')!.npc!.memory?.deeds ?? []
    expect(deeds.some((d) => d.deed === 'vandalism' && d.against === 'household:h1')).toBe(true)
    expect(deeds.find((d) => d.deed === 'vandalism')?.what).toEqual({ en: 'wooden wall', zh: '木墙' })
    // the same wall in the wild, nobody's
    const wild = street('woodwall', 'item/weapon/blade/axe', { owned: false })
    hit(wild, 3)
    expect(wild.world.get('hesper')!.npc!.memory?.deeds ?? []).toEqual([])
  })

  it('a wall one builds oneself is taken down as it was put up: a tool knocks it loose whole, a mace breaks it into its planks', () => {
    const build = (tool: string) => {
      const eng = buildSandbox(
        {
          terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
          entities: [
            { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { atk: 2 } },
            { key: 'tool', type: tool, x: 2, y: 3, heldBy: 'actor', tags: ['material:iron'] },
            { key: 'wall', type: 'structure/wall', x: 2, y: 2 },
          ],
          event: {},
        },
        onto,
        new RuleLibrary([...BASE_RULES, ...STORY_RULES]),
      )
      eng.world.get('actor')!.facing = 'up'
      return eng
    }
    const axed = build('item/weapon/blade/axe')
    swing(axed)
    expect(axed.world.passable('sandbox', 2, 2)).toBe(true)
    const cut = build('item/weapon/blunt/mace')
    // (a weapon's blow lands as the swing goes on: a few ticks each)
    for (let i = 0; i < 40 && cut.world.get('wall'); i++) (swing(cut), Array.from({ length: 10 }, () => cut.tick()))
    expect(cut.world.get('wall')).toBeUndefined()
    expect(cut.world.passable('sandbox', 2, 2)).toBe(true)
    expect(cut.world.placedAt('sandbox', 2, 2).map((e) => e.type)).toContain('item/material/plank')
  })
})
