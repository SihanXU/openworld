// M1: hands, surfaces and storage, played through the same entry point as the player's keys
// (controls.plan + run, and the chest panel's transfers). Putting a thing emits `receive` to
// what it is put on, which answers for itself; taking emits `taken` to the thing taken.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, validatePatch, type Bounds, type Cond, type Engine, type Key, type Rule, type Scenario, type ScenarioEntity, type Tree } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()

/** The player at (2,2) facing up, at whatever stands at (2,1). */
function play(front: Omit<ScenarioEntity, 'x' | 'y'>[], held?: string, terrain?: string): Engine {
  const rows = Array.from({ length: 5 }, () => Array(5).fill('grass'))
  if (terrain) rows[1][2] = terrain
  const sc: Scenario = {
    terrain: rows,
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...(held ? [{ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' }] : []),
      ...front.map((e) => ({ ...e, x: 2, y: 1 })),
    ],
    event: {},
  }
  const eng = buildSandbox(sc, onto, new RuleLibrary(BASE_RULES))
  eng.world.get('actor')!.facing = 'up'
  return eng
}

interface Pressed {
  rules: string[]
  holes: string[]
  panel?: string
  /** The input offered the act (taking and putting are offered only where they change something). */
  offered: boolean
}

/** Press a key at the tile in front: the rules the chain resolved to, the holes it reached, the panel it opens. */
function press(eng: Engine, key: Key): Pressed {
  const plan = eng.controls.plan(key)
  eng.trace.length = 0
  let panel: string | undefined
  if (plan) panel = eng.controls.run(plan, true).panel
  // an input that would change nothing is not offered (taking and putting are physics): the act itself, as the world answers it
  else if (key === 'put' || key === 'take') {
    const front = eng.world.front(eng.world.player)!
    const target = eng.controls.layers(front)[0]
    if (target) eng.act(key, eng.world.state.player, target, { instrument: key === 'put' ? (eng.world.player.held ? { e: eng.world.player.held } : null) : null })
  }
  return {
    rules: eng.trace.filter((t) => t.defined && t.rule).map((t) => t.rule!),
    holes: eng.trace.filter((t) => !t.defined && t.rule).map((t) => t.rule!),
    panel,
    offered: !!plan,
  }
}

const heldBy = (eng: Engine) => eng.world.get('actor')!.held
const carried = (eng: Engine) => [...(eng.world.get('actor')!.contents ?? []), ...(heldBy(eng) ? [heldBy(eng)!] : [])]
/** The hand puts its item back in the bag. */
const stow = (eng: Engine) => {
  const w = eng.world
  const h = w.get(heldBy(eng))
  if (h) eng.author(() => w.place(h, { on: 'inside', holder: 'actor' }))
}

describe('surfaces', () => {
  it.each(['table', 'counter', 'stall', 'bench'].map((t) => `fixture/furniture/${t}`).concat('fixture/sacred/altar', 'fixture/craft/anvil'))(
    'puts an item on a %s and takes it back',
    (type) => {
      const eng = play([{ key: 'surface', type }], 'item/food/apple')
      expect(press(eng, 'put').rules).toEqual(expect.arrayContaining(['core/put', 'core/receive-surface', 'core/taken']))
      expect(heldBy(eng)).toBeUndefined()
      expect(eng.world.get('held')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
      expect(press(eng, 'take').rules).toEqual(expect.arrayContaining(['core/take', 'core/taken']))
      expect(heldBy(eng)).toBe('held')
    },
  )

  it('takes the top item first; the table itself stays where it is', () => {
    const eng = play([{ key: 'table', type: 'fixture/furniture/table' }, { key: 'cup', type: 'item/vessel/cup' }], 'item/food/apple')
    press(eng, 'put')
    press(eng, 'take')
    expect(heldBy(eng)).toBe('held')
    stow(eng)
    press(eng, 'take')
    expect(carried(eng)).toContain('cup')
    expect(eng.world.get('cup')!.place.on).not.toBe('tile')
    stow(eng)
    // a table stays where it is: taking is physics (never asked), and F does not offer what it cannot do
    expect(eng.controls.plan('take')).toBeUndefined()
    const r = eng.act('take', 'actor', { e: 'table' }, { instrument: null })
    expect(r.defined).toBe(true)
    expect(eng.trace.some((t) => !t.defined)).toBe(false)
    expect(eng.world.get('table')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
    expect(carried(eng)).not.toContain('table')
  })
})

describe('containers', () => {
  // `distinct`: one kind per thing, so it takes n slots; without it they are all one kind, one slot (stacks.test.ts)
  const chestOf = (n: number, statuses = ['open'], distinct = false) => [
    { key: 'chest', type: 'fixture/container/chest', statuses },
    ...Array.from({ length: n }, (_, i) => ({ key: `i${i}`, type: 'item/material/stone', ...(distinct && { tags: [`kind${i}`] }), inside: 'chest' })),
  ]

  it('takes any chosen item from a chest of twelve', () => {
    for (let pick = 0; pick < 12; pick++) {
      const eng = play(chestOf(12))
      // the act the chest panel makes for one item
      expect(eng.act('take', 'actor', { e: `i${pick}` }, { instrument: null }).rule?.id).toBe('core/take')
      expect(heldBy(eng)).toBe(`i${pick}`)
      expect(eng.world.get('chest')!.contents).toHaveLength(11)
    }
  })

  it('the chest panel moves one of a stack, or all of it, between the chest and the bag', () => {
    const eng = play(chestOf(12))
    eng.controls.transfer('chest', 'chest', 'i5', false)
    expect(carried(eng)).toHaveLength(1)
    expect(eng.world.get('chest')!.contents).toHaveLength(11)
    eng.controls.transfer('chest', 'chest', 'i5', true)
    expect(carried(eng)).toHaveLength(12)
    expect(eng.world.get('chest')!.contents).toHaveLength(0)
    eng.controls.transfer('chest', 'bag', heldBy(eng)!, true)
    expect(carried(eng)).toHaveLength(0)
    expect(eng.world.get('chest')!.contents).toHaveLength(12)
  })

  it('shows the faced open container\'s panel; a closed one is opened first, a locked one not at all', () => {
    const open = play(chestOf(3))
    expect(open.controls.plan('hands')?.panel).toBe('chest')
    const shown = press(open, 'hands')
    expect(shown.panel).toBe('chest')
    expect(shown.rules).toEqual([]) // already open: just its panel, no act
    expect(open.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)
    expect(open.world.get('chest')!.contents).toHaveLength(3)

    const closed = play(chestOf(3, []))
    const opened = press(closed, 'hands')
    expect(opened.rules).toContain('core/open-close')
    expect(opened.panel).toBe('chest')
    expect(closed.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)

    const locked = play([{ key: 'chest', type: 'fixture/container/chest', tags: ['locked'] }])
    const tried = press(locked, 'hands')
    expect(tried.rules).toContain('core/open-close')
    expect(tried.panel).toBeUndefined()
    expect(locked.world.hasStatus({ e: 'chest' }, 'open')).toBe(false)
  })

  it('refuses when full, and the item stays in hand', () => {
    // twelve kinds, one in each slot (twelve of one kind would be one slot: see stacks.test.ts)
    const eng = play(chestOf(12, ['open'], true), 'item/food/apple')
    expect(press(eng, 'put')).toMatchObject({ rules: expect.arrayContaining(['core/receive-store']), holes: [], offered: false })
    expect(heldBy(eng)).toBe('held')
    expect(eng.world.get('chest')!.contents).toHaveLength(12)
    const pot = play([{ key: 'pot', type: 'fixture/container/pot', statuses: ['open'] }], 'item/food/apple')
    expect(press(pot, 'put').rules).toEqual(expect.arrayContaining(['core/receive-store', 'core/taken']))
    expect(pot.world.get('pot')!.contents).toEqual(['held'])
  })

  it('a closed container takes nothing', () => {
    const eng = play(chestOf(0, []), 'item/food/apple')
    expect(press(eng, 'put')).toMatchObject({ rules: expect.arrayContaining(['core/receive-store']), offered: false })
    expect(heldBy(eng)).toBe('held')
  })

  it('locks a closed chest with a key, and the key opens it again', () => {
    const eng = play([{ key: 'chest', type: 'fixture/container/chest' }], 'item/key')
    expect(press(eng, 'use').rules).toEqual(expect.arrayContaining(['use/key', 'core/open-close']))
    expect(eng.world.view({ e: 'chest' })!.tags.has('locked')).toBe(true)
    expect(eng.world.hasStatus({ e: 'chest' }, 'open')).toBe(false)
    expect(press(eng, 'use').rules).toContain('core/open-close')
    expect(eng.world.view({ e: 'chest' })!.tags.has('locked')).toBe(false)
    expect(eng.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)
  })
})

describe('the ground', () => {
  it('water refuses what is put in it, but still fills an empty vessel', () => {
    const eng = play([], 'item/food/apple', 'water')
    expect(press(eng, 'put')).toMatchObject({ rules: expect.arrayContaining(['core/receive-water']), offered: false })
    expect(heldBy(eng)).toBe('held')
    const bucket = play([], 'item/vessel/bucket/empty', 'water')
    expect(press(bucket, 'put').rules).toContain('use/fill-put')
    expect(bucket.world.get('held')!.type).toBe('item/vessel/bucket/water')
  })

  it('lava takes what is put in it and burns what is flammable', () => {
    const stick = play([], 'item/material/stick', 'lava')
    expect(press(stick, 'put').rules).toEqual(expect.arrayContaining(['core/receive-lava', 'lava/burn']))
    expect(heldBy(stick)).toBeUndefined()
    expect(stick.world.hasStatus({ e: 'held' }, 'burning')).toBe(true)
    for (let i = 0; i < 60; i++) stick.tick()
    expect(stick.world.get('held')!.type).toBe('item/material/ash')
    const stone = play([], 'item/material/stone', 'lava')
    expect(press(stone, 'put').rules).toContain('core/receive-lava')
    expect(heldBy(stone)).toBeUndefined()
    expect(stone.world.hasStatus({ e: 'held' }, 'burning')).toBe(false)
  })

  it('a wall has no room', () => {
    const eng = play([], 'item/material/stone', 'wall')
    expect(press(eng, 'put')).toMatchObject({ rules: expect.arrayContaining(['core/receive-solid']), offered: false })
    expect(heldBy(eng)).toBe('held')
  })
})

describe('the count condition', () => {
  const rule = (cmp: object): Rule => ({
    id: 'test/count',
    host: { type: 'fixture', tags: ['surface'] },
    on: 'impulse/handle',
    tree: { if: { count: { role: 'host', in: 'tile', cmp: cmp as Bounds } }, then: { do: [{ op: 'log', text: 'crowded' }] }, else: 'inherit' },
  })

  it('counts what lies on a role\'s tile, besides the role itself', () => {
    const lib = new RuleLibrary([...BASE_RULES, rule({ gte: 2 })])
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 },
        { key: 'a', type: 'item/food/apple', x: 2, y: 1 },
      ],
      event: {},
    }
    const eng = buildSandbox(sc, onto, lib)
    const ev = { kind: 'impulse/handle' as const, host: { e: 'table' }, roles: { actor: { e: 'actor' } }, params: {} }
    expect(eng.resolveEvent(ev).rule?.id).not.toBe('test/count')
    eng.author(() => eng.world.create('item/food/apple', { on: 'tile', map: 'sandbox', x: 2, y: 1 }))
    expect(eng.resolveEvent(ev).rule?.id).toBe('test/count')
  })

  it('is validated like any other condition', () => {
    const lib = new RuleLibrary(BASE_RULES)
    // as a learned rule: the table's own, at the hole a handled fixture reaches (core/handle), its other case open
    const learned = (cmp: object): Rule => ({ ...rule(cmp), host: { type: 'fixture/furniture/table' }, hole: 'core/handle', at: [], tree: { ...(rule(cmp).tree as { if: Cond; then: Tree }), else: { undefined: true } } })
    const ok = validatePatch({ artifacts: [{ kind: 'rule', rule: learned({ gte: { prop: 'capacity', of: 'host' } }) }] }, { ontology: onto, library: lib })
    expect(ok.errors).toEqual([])
    const bad = validatePatch({ artifacts: [{ kind: 'rule', rule: learned({ most: 3 }) }] }, { ontology: onto, library: lib })
    expect(bad.errors.some((e) => e.includes('count.cmp.most'))).toBe(true)
  })
})
