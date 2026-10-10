// M2: woodcutting, played through the same entry point as the player's keys (controls.plan,
// the chooser's layers, run). The axe's use emits `strike cut`; the tree, struck by an axe,
// counts the blows and falls; the stump grows back on its own timer.

import { describe, expect, it } from 'vitest'
import { OntologyIndex, RuleLibrary, buildSandbox, type Engine, type Key, type Ref } from '@openworld/engine'
import { BASE_RULES, RECIPE_BY_ID, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const TICKS_PER_DAY = 24 * 600

/** A row of terrain along y = 1 and the player at (2,2) facing up, holding `held`. */
function grove(row: string[], held: string | undefined): Engine {
  const rows = [Array(row.length).fill('grass'), row, Array(row.length).fill('grass')]
  const eng = buildSandbox(
    {
      terrain: rows,
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        ...(held ? [{ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' }] : []),
      ],
      event: {},
    },
    onto,
    new RuleLibrary(BASE_RULES),
  )
  eng.world.get('actor')!.facing = 'up'
  return eng
}

const terrain = (eng: Engine, x: number, y = 1) => eng.world.terrainAt('sandbox', x, y)
const itemsAt = (eng: Engine, x: number, y = 1) =>
  eng.world
    .placedAt('sandbox', x, y)
    .map((e) => e.type)
    .sort()
/** The player walks to (x,2) (an act of moving; teleporting keeps the test about the rules), still facing up. */
const standAt = (eng: Engine, x: number, y = 2) => {
  eng.relocate(eng.world.get('actor')!, { map: 'sandbox', x, y })
  eng.world.get('actor')!.facing = 'up'
}
const days = (eng: Engine, n: number) => {
  for (let i = 0; i < n * TICKS_PER_DAY + 1; i++) eng.tick()
}
const typeOf = (eng: Engine, r: Ref) => eng.world.view(r)?.type

/**
 * Press a key in front: on the top layer, or (the chooser) on the first layer of type `on`.
 * Returns the rules the chain resolved to (defined ones).
 */
function press(eng: Engine, key: Key, on?: string): string[] {
  const choice = eng.controls.choices(key).find((c) => !on || (c.plan && typeOf(eng, c.plan.target) === on))
  eng.trace.length = 0
  if (choice?.plan) eng.controls.run(choice.plan, true)
  return eng.trace.filter((t) => t.defined && t.rule).map((t) => t.rule!)
}

describe('woodcutting', () => {
  it('turns one tree into four planks', () => {
    const eng = grove(['grass', 'grass', 'tree', 'grass', 'grass'], 'item/weapon/blade/axe')
    // the first blow bites (durability, and a notch to show it); the second fells it
    expect(press(eng, 'use')).toEqual(['use/blade', 'wood/notch'])
    expect(terrain(eng, 2)).toBe('tree')
    expect(eng.world.hasStatus(eng.world.cellRef('sandbox', 2, 1), 'notched')).toBe(true)
    expect(press(eng, 'use')).toContain('wood/fell')
    expect(terrain(eng, 2)).toBe('stump')
    expect(itemsAt(eng, 2).filter((t) => t !== 'item/seed/acorn')).toEqual(['item/material/log', 'item/material/log', 'item/material/stick'])
    // the top of the pile is not a log: the axe's plan there is the AI's to answer
    const top = eng.controls.plan('use')!
    expect(typeOf(eng, top.target)).not.toBe('item/material/log')
    expect(top.unknown).toBe(true)
    // the chooser reaches past it to each log
    expect(press(eng, 'use', 'item/material/log')).toContain('wood/split')
    expect(press(eng, 'use', 'item/material/log')).toContain('wood/split')
    expect(itemsAt(eng, 2).filter((t) => t === 'item/material/plank')).toHaveLength(4)
    expect(itemsAt(eng, 2)).not.toContain('item/material/log')
  })

  it('splits logs into planks in the crafting panel with an axe carried (not used up): one log, two planks; "all" splits every log; a split log on the ground pops its planks out', () => {
    const eng = grove(['grass', 'grass', 'grass', 'grass', 'grass'], undefined)
    const w = eng.world
    const c = eng.controls
    const plank = RECIPE_BY_ID['item/material/plank']
    expect(plank).toMatchObject({ needs: [{ type: 'item/material/log', count: 1 }], tools: ['tool:axe'], count: 2, station: 'hands' })
    const give = (type: string, n = 1) => eng.author(() => { for (let i = 0; i < n; i++) w.create(type, { on: 'inside', holder: 'actor' }) })
    give('item/material/log', 3)
    c.sync()
    // no axe: not made
    expect(c.canCraft(plank)).toBe(false)
    expect(c.craft(plank)).toBe(false)
    give('item/weapon/blade/axe')
    c.sync()
    expect(c.craft(plank)).toBe(true)
    expect([c.count('item/material/log'), c.count('item/material/plank'), c.count('item/weapon/blade/axe')]).toEqual([2, 2, 1])
    // one kind of plank: named as any plank, not "Wooden Plank"
    const made = w.get(w.player.contents!.find((id) => w.get(id)?.type === 'item/material/plank')!)!
    expect(made.name).toBeUndefined()
    expect(c.craftAll(plank)).toBe(2)
    expect([c.count('item/material/log'), c.count('item/material/plank')]).toEqual([0, 6])
    // on the ground, the axe on a log: two planks pop out for the magnet, the log is gone
    eng.author(() => w.create('item/material/log', { on: 'tile', map: 'sandbox', x: 2, y: 1 }))
    const axe = w.player.contents!.find((id) => w.get(id)?.type === 'item/weapon/blade/axe')!
    eng.act('use', 'actor', { e: w.placedAt('sandbox', 2, 1).find((e) => e.type === 'item/material/log')!.id }, { instrument: { e: axe } })
    const split = w.placedAt('sandbox', 2, 1)
    expect(split.map((e) => e.type)).toEqual(['item/material/plank', 'item/material/plank'])
    expect(split.every((e) => e.dropped)).toBe(true)
  })

  it('a plank made two to a log breaks back into half a log, not a whole one', () => {
    expect(new OntologyIndex(onto).resolve('item/material/plank').yields).toBe(2)
  })

  it('a notch heals if the tree is left alone', () => {
    const eng = grove(['grass', 'grass', 'pine', 'grass', 'grass'], 'item/weapon/blade/axe')
    const pine = eng.world.cellRef('sandbox', 2, 1)
    press(eng, 'use')
    expect(eng.world.hasStatus(pine, 'notched')).toBe(true)
    for (let i = 0; i < 101; i++) eng.tick()
    expect(eng.world.hasStatus(pine, 'notched')).toBe(false)
    expect(press(eng, 'use')).toContain('wood/notch')
    expect(terrain(eng, 2)).toBe('pine') // notched again, not felled
    expect(eng.world.hasStatus(pine, 'notched')).toBe(true)
  })

  it('a cleared grove grows back in two days, except where stumps were dug out', () => {
    const eng = grove(['tree', 'tree', 'tree', 'tree', 'tree'], 'item/weapon/blade/axe')
    for (let x = 0; x < 5; x++) {
      standAt(eng, x)
      press(eng, 'use')
      press(eng, 'use')
    }
    expect([0, 1, 2, 3, 4].map((x) => terrain(eng, x))).toEqual(Array(5).fill('stump'))
    // the axe for a shovel
    eng.author(() => {
      eng.world.author(() => eng.world.destroy(eng.world.get('held')!))
      eng.world.author(() => eng.world.create('item/tool/shovel', { on: 'hand', holder: 'actor' }))
    })
    eng.controls.sync()
    standAt(eng, 1)
    // the logs lie on the stump: the chooser picks the ground under them
    expect(press(eng, 'use', 'tile/stump')).toEqual(expect.arrayContaining(['use/shovel', 'wood/uproot']))
    // the stump is gone: the ground it stood on shows
    expect(terrain(eng, 1)).toBe('grass')
    standAt(eng, 4)
    days(eng, 1)
    expect(terrain(eng, 0)).toBe('stump')
    days(eng, 1)
    expect([0, 1, 2, 3, 4].map((x) => terrain(eng, x))).toEqual(['tree', 'grass', 'tree', 'tree', 'tree'])
  })

  it('does not grow a tree around someone standing on the stump', () => {
    const eng = grove(['grass', 'grass', 'tree', 'grass', 'grass'], 'item/weapon/blade/axe')
    press(eng, 'use')
    press(eng, 'use')
    standAt(eng, 2, 1) // on the stump
    expect(eng.world.get('actor')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
    days(eng, 2)
    expect(terrain(eng, 2)).toBe('stump')
    standAt(eng, 2)
    for (let i = 0; i < 601; i++) eng.tick()
    expect(terrain(eng, 2)).toBe('tree')
  })

  it('breaks a charred tree down to coal', () => {
    const eng = grove(['grass', 'grass', 'charred_tree', 'grass', 'grass'], 'item/weapon/blade/axe')
    expect(press(eng, 'use')).toContain('wood/char')
    expect(terrain(eng, 2)).toBe('grass')
    expect(itemsAt(eng, 2)).toEqual(['item/material/coal'])
  })

  it('a plain axe blow on a stump breaks it: what it is made of comes back, at the recovery rate (world-model.md §6.3)', () => {
    const eng = grove(['grass', 'grass', 'stump', 'grass', 'grass'], 'item/weapon/blade/axe')
    const plan = eng.controls.plan('use')!
    expect(plan.unknown).toBeFalsy()
    expect(press(eng, 'use')).toEqual(expect.arrayContaining(['core/strike', 'core/break']))
    expect(terrain(eng, 2)).toBe('grass')
    expect(itemsAt(eng, 2)).toEqual(['item/material/log'])
  })

  it("bare hands on a tree (Minecraft's fist): it wears down, slowly; nothing is asked", () => {
    const eng = grove(['grass', 'grass', 'tree', 'grass', 'grass'], undefined)
    const tree = eng.world.get(eng.world.cellRef('sandbox', 2, 1).e)!
    eng.trace.length = 0
    eng.act('use', 'actor', { e: tree.id }, { instrument: null, params: { attack: true } })
    expect(eng.trace.filter((t) => !t.defined)).toEqual([])
    expect(eng.world.fx.some((f) => f.t === 'log' && (f.text as { en: string }).en === 'Too hard.')).toBe(false)
    expect(eng.world.num(tree, 'hp')).toBeLessThan(eng.world.num(tree, 'maxHp'))
    expect(terrain(eng, 2)).toBe('tree')
  })
})
