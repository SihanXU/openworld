// The buildings one finds (docs/building.md §10): a house's walls are things of the world like any other — their
// durability, what they are made of, whose they are. A blow on one is its own outcome (core/strike, the instrument's
// efficiency on its material); broken, it is open ground with what it was made of lying there; and breaking into a
// house is a deed against its household (the society module's vandalism), judged by whoever saw it.

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
        { key: 'tool', type: tool, x: 4, y: 3, heldBy: 'actor', tags: ['material:stone'] },
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

/** Swing until the wall in front is gone (at most `max` blows): how many it took. */
function breakIn(eng: Engine, max = 60): number {
  for (let n = 1; n <= max; n++) {
    swing(eng)
    if (!eng.world.isSolidTerrain(eng.world.terrainAt('sandbox', 4, 2))) return n
  }
  return Infinity
}

const lying = (eng: Engine) => eng.world.placedAt('sandbox', 4, 2).map((e) => e.type).filter((t) => !t.startsWith('item/seed')).sort()
/**
 * What a thing broken leaves of its makeup (world-model.md §6.3): half of each kind, a part left over by its chance —
 * never anything it was not made of.
 */
function leavesHalf(left: string[], makeup: Record<string, number>): void {
  for (const t of left) expect(Object.keys(makeup)).toContain(t)
  for (const [t, n] of Object.entries(makeup)) {
    const got = left.filter((x) => x === t).length
    expect(got, t).toBeGreaterThanOrEqual(Math.floor(n / 2))
    expect(got, t).toBeLessThanOrEqual(Math.ceil(n / 2))
  }
  expect(left.length).toBeGreaterThan(0)
}

describe('a house wall is a thing of the world (docs/building.md §10)', () => {
  it('a wooden wall gives to an axe: each blow its own outcome, the frame telling its durability; broken, its planks lie in the opening one walks into', () => {
    const eng = street('woodwall', 'item/weapon/blade/axe')
    swing(eng)
    const cell = snapshot(eng).tiles.find((t) => t.x === 4 && t.y === 2)
    expect(cell).toMatchObject({ terrain: 'woodwall' })
    expect(cell!.hp).toBeLessThan(cell!.maxHp!)
    expect(breakIn(eng)).toBeLessThan(12)
    expect(eng.world.passable('sandbox', 4, 2)).toBe(true)
    // the ground of the street under it, never a door or what else stands round it
    expect(snapshot(eng).tiles.find((t) => t.x === 4 && t.y === 2)?.terrain).toBe('path')
    leavesHalf(lying(eng), { 'item/material/plank': 2 })
    // the wall beside it stands
    expect(eng.world.terrainAt('sandbox', 3, 2)).toBe('woodwall')
  })

  it('stone needs a pick: an axe hardly marks it, a pickaxe breaks it into its stones', () => {
    const axed = street('wall', 'item/weapon/blade/axe')
    const picked = street('wall', 'item/tool/pickaxe')
    const byPick = breakIn(picked)
    expect(byPick).toBeLessThan(20)
    expect(breakIn(axed, byPick)).toBe(Infinity)
    leavesHalf(lying(picked), { 'item/material/stone': 4 })
  })

  it('every wall a building is made of breaks into what it is made of: canvas, thatch, snow', () => {
    const made: Record<string, [string, Record<string, number>]> = {
      canvaswall: ['item/weapon/blade/axe', { 'item/material/cloth': 2, 'item/material/stick': 1 }],
      thatchwall: ['item/weapon/blade/axe', { 'item/material/grass': 3, 'item/material/stick': 2 }],
      snowwall: ['item/tool/pickaxe', { 'item/misc/snowball': 3 }],
    }
    for (const [wall, [tool, makeup]] of Object.entries(made)) {
      const eng = street(wall, tool, { neighbour: false })
      expect(breakIn(eng), wall).toBeLessThan(20)
      leavesHalf(lying(eng), makeup)
    }
  })

  it("breaking into someone's house is vandalism against its household, seen by the neighbour; a wall nobody owns is nobody's business", () => {
    const eng = street('woodwall', 'item/weapon/blade/axe')
    breakIn(eng)
    const deeds = eng.world.get('hesper')!.npc!.memory?.deeds ?? []
    expect(deeds.some((d) => d.deed === 'vandalism' && d.against === 'household:h1')).toBe(true)
    // what she will tell of it names the wall, though it is gone (its cell keeps its record)
    expect(deeds.find((d) => d.deed === 'vandalism')?.what).toEqual({ en: 'wooden wall', zh: '木墙' })
    // the same wall in the wild, nobody's
    const wild = street('woodwall', 'item/weapon/blade/axe', { owned: false })
    breakIn(wild)
    expect(wild.world.get('hesper')!.npc!.memory?.deeds ?? []).toEqual([])
  })
})
