import { describe, expect, it, vi } from 'vitest'
import { ModPort, TICKS_PER_HOUR, RuleLibrary, buildSandbox, holeKey, textOf, type Engine, type Key, type Plan, type PropValue, type Ref, type ScenarioEntity, type Verb } from '@openworld/engine'
import { HUNGER_EFFECT_EVERY, HUNGER_EVERY, HUNGRY_PACE } from '@openworld/modules'
import { NO_EXPIRY, cellId, madeOf, weaponOf } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** The player at (2,2) facing up toward (2,1), holding `held` (if any), with `others` around. Strict: state changes only in outcomes. */
function world(held: string | undefined, others: ScenarioEntity[], terrain?: string[][]): Engine {
  const entities: ScenarioEntity[] = [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: {} }, ...others]
  if (held) entities.push({ key: 'held', type: held, x: 2, y: 2, heldBy: 'actor' })
  const eng = buildSandbox({ entities, event: {}, terrain }, onto, lib())
  eng.world.player.facing = 'up'
  eng.controls.sync()
  return eng
}

const npc = (key = 'npc.hollis'): ScenarioEntity => ({ key, type: 'actor/person/farmer', x: 2, y: 1 })
/** The index of the ground among the layers of a tile (the chooser's pick). */
const ground = (eng: Engine, x = 2, y = 1) => eng.controls.layers({ map: 'sandbox', x, y }).findIndex((r) => eng.world.cellRank(eng.world.get(r.e)!) >= 0)
const label = (p: Plan | undefined) => textOf(p?.label)

describe('the inputs: one act each', () => {
  it('E talks to a person whatever is held; G gives the held thing', () => {
    const eng = world('item/food/apple', [npc()])
    const talk = eng.controls.plan('hands')
    expect(talk).toMatchObject({ verb: 'hands', rule: 'people/talk', instrument: undefined })
    expect(label(talk)).toBe('Talk to farmer')
    const give = eng.controls.plan('put')
    expect(give).toMatchObject({ verb: 'put', rule: 'people/accept' })
    expect(label(give)).toBe('Give Apple to farmer')
    eng.controls.run(give!)
    expect(eng.world.get('held')!.place).toMatchObject({ on: 'inside', holder: 'npc.hollis' })
  })

  it('E opens a container as a panel; the panel moves things by acts of taking and putting', () => {
    const eng = world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }, { key: 'loaf', type: 'item/food/bread', x: 2, y: 1, inside: 'chest' }])
    const plan = eng.controls.plan('hands')!
    expect(plan).toMatchObject({ verb: 'hands', rule: 'core/open-close', panel: 'chest' })
    expect(label(plan)).toBe('Open chest')
    expect(eng.controls.run(plan).panel).toBe('chest')
    expect(eng.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)
    eng.controls.transfer('chest', 'chest', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ holder: 'actor' })
    eng.controls.transfer('chest', 'bag', 'loaf', true)
    expect(eng.world.get('loaf')!.place).toMatchObject({ on: 'inside', holder: 'chest' })
  })

  it('a pointer on the tile but beside a small sprite still meets what lies there, not the bare ground', () => {
    const eng = world('item/material/stone', [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    const put = eng.controls.plan('put', { x: 2, y: 1, stack: [] })
    expect(put?.target).toEqual({ e: 'stone' })
    eng.controls.run(put!)
    expect(eng.world.get('stone')!.type).toBe('fixture/build/ring')
  })

  it('asks before eating (R on oneself), and eats on yes', () => {
    const meal = world('item/food/bread', [])
    const eat = meal.controls.plan('use', { x: 2, y: 2 })!
    expect(eat).toMatchObject({ verb: 'use', target: { e: 'actor' }, rule: 'use/eat' })
    expect(label(eat)).toBe('Eat Bread')
    expect(eat.confirm).toBeDefined()
    meal.controls.run(eat)
    expect(meal.world.state.question).toBeDefined()
    expect(meal.world.get('held')).toBeDefined()
    meal.controls.answer(true)
    expect(meal.world.get('held')).toBeUndefined()
  })

  it('F takes a loose item; G places anything, tools included', () => {
    const take = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    const pick = take.controls.plan('take')
    expect(pick).toMatchObject({ verb: 'take', target: { e: 'stone' } })
    expect(label(pick)).toBe('Take Stone')
    take.controls.run(pick!)
    expect(take.world.get('stone')!.place).toMatchObject({ holder: 'actor' })
    const tool = world('item/tool/hoe', [])
    const put = tool.controls.plan('put')!
    expect(put).toMatchObject({ verb: 'put', rule: 'core/receive-ground' })
    expect(label(put)).toBe('Place Hoe')
    tool.controls.run(put)
    expect(tool.world.get('held')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
  })

  it('an object used on bare ground is an experiment for the modder, not nothing', () => {
    const eng = world('item/food/apple', [])
    expect(eng.controls.plan('use')).toMatchObject({ verb: 'use', target: eng.world.cellRef('sandbox', 2, 1), unknown: true })
    expect(eng.controls.plan('use', { x: 2, y: 1 })).toMatchObject({ verb: 'use', target: eng.world.cellRef('sandbox', 2, 1), unknown: true })
  })

  it('a tool works the ground (R, and the left click alike): the hoe strikes, the ground answers', () => {
    const eng = world('item/tool/hoe', [])
    const plan = eng.controls.plan('use')!
    expect(plan.rule).toBe('farm/till')
    expect(label(plan)).toBe('Till grass')
    expect(eng.controls.plan('primary')).toEqual(plan)
    eng.controls.run(plan)
    expect(eng.world.terrainAt('sandbox', 2, 1)).toBe('farmland')
  })

  it('experiments go to the Mod port: an object on a thing (R), a bare hand (E)', () => {
    const apple = world('item/food/apple', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    const port = new ModPort(apple)
    const plan = apple.controls.plan('use')!
    expect(plan.unknown).toBe(true)
    apple.controls.run(plan)
    expect(port.records).toHaveLength(1)
    expect(port.records[0]).toMatchObject({ origin: 'player', request: { event: { kind: 'act/use' }, hole: { rule: 'core/use' } } })
    // a bare hand on a boulder: the act is defined (a hand handles it), the boulder's answer is not
    const rock = world(undefined, [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }])
    const p2 = new ModPort(rock)
    const hands = rock.controls.plan('hands')!
    expect(hands.unknown).toBe(true)
    rock.controls.run(hands)
    expect(p2.records[0]).toMatchObject({ origin: 'player', request: { event: { kind: 'impulse/handle' }, hole: { rule: 'core/handle' } } })
  })

  it('weapons strike (but on a person a blade is not a blow); a bare R is a blow on anything (Minecraft)', () => {
    const well = world('item/weapon/blade/sword', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
    well.world.player.props!.profession = 'warrior' // the sword is the warrior's
    const port = new ModPort(well)
    const plan = well.controls.plan('use')!
    expect(plan.attack).toBe(true)
    well.controls.run(plan)
    expect(port.records[0]?.request.event).toMatchObject({ kind: 'impulse/strike', params: { edge: 'cut' } })
    const person = world('item/weapon/blade/sword', [npc()])
    expect(person.controls.plan('use')).toMatchObject({ verb: 'use' })
    expect(person.controls.plan('use')!.attack).toBeUndefined()
    const slime = world(undefined, [{ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 1 }])
    expect(slime.controls.plan('use')).toMatchObject({ verb: 'use', attack: true, rule: 'combat/struck' })
    // with nothing held R is the body's own blow, whatever it meets: never E's hand
    const rock = world(undefined, [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }])
    const punch = rock.controls.plan('use')!
    expect(punch).toMatchObject({ verb: 'use', attack: true, instrument: undefined })
    expect(label(punch)).toBe('Punch boulder')
    rock.controls.run(punch)
    expect(rock.world.fx.some((f) => f.t === 'log' && textOf(f.text) === 'Too hard.')).toBe(true)
  })

  it('reach: E as far as the thing lets a hand (a bed only from on it), F and G the cells round, R as far as the held thing carries', () => {
    const far = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 0 }, npc()])
    // two cells off: nothing reaches the stone; a pointer there aims at the farthest spot toward it that is reached
    expect(far.controls.reachable({ x: 2, y: 0 })).toBe(false)
    expect(far.controls.plan('use', { x: 2, y: 0 })).toMatchObject({ at: { x: 2, y: 1 }, target: { e: 'npc.hollis' } })
    expect(far.controls.plan('take', { x: 2, y: 0 })?.target).not.toEqual({ e: 'stone' })
    // the engine itself holds every act to its reach, for anyone
    expect(far.act('take', 'actor', { e: 'stone' }, { instrument: null }).defined).toBe(false)
    expect(far.world.get('stone')!.place.on).toBe('tile')
    // a bow carries: the far tile in line is within R's reach, one off the line is not
    const bow = world('item/weapon/ranged/bow', [{ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 0 }, { key: 't', type: 'actor/creature/slime/green_slime', x: 4, y: 1 }])
    expect(bow.controls.plan('use', { x: 2, y: 0 })).toMatchObject({ attack: true, target: { e: 's' } })
    expect(bow.controls.plan('use', { x: 4, y: 1 })?.target).not.toEqual({ e: 't' })
    // a bed is used from on it
    const bed = world(undefined, [{ key: 'bed', type: 'fixture/furniture/bed', x: 2, y: 1 }])
    expect(bed.controls.plan('hands', { x: 2, y: 1 })).toBeUndefined()
    bed.author(() => bed.world.place(bed.world.player, { on: 'tile', map: 'sandbox', x: 2, y: 1 }))
    expect(bed.controls.plan('hands', { x: 2, y: 1 })).toMatchObject({ verb: 'hands', target: { e: 'bed' } })
    // E with nothing pointed at, on the bed, the bare ground in front: the ground is only touched, so E lies down
    bed.author(() => (bed.world.player.facing = 'up'))
    expect(bed.controls.plan('hands')).toMatchObject({ verb: 'hands', target: { e: 'bed' } })
  })

  it('E, F and G never take oneself: on one\'s own place they meet what is there; the right click is the held thing on oneself', () => {
    const eng = world('item/food/bread', [{ key: 'stick', type: 'item/material/stick', x: 2, y: 2 }])
    for (const key of ['hands', 'take', 'put'] as Key[]) expect(eng.controls.plan(key, { x: 2, y: 2 })?.target).not.toEqual({ e: 'actor' })
    expect(eng.controls.plan('take', { x: 2, y: 2 })?.target).toEqual({ e: 'stick' })
    const self = eng.controls.plan('self')!
    expect(self).toMatchObject({ key: 'self', verb: 'use', target: { e: 'actor' }, rule: 'use/eat' })
    // R on one's own place is the same act
    expect(eng.controls.plan('use', { x: 2, y: 2 })).toMatchObject({ verb: 'use', target: { e: 'actor' }, rule: 'use/eat' })
  })

  it('an open door is closed as a door: its name says it is open, the label does not say it twice', () => {
    const eng = world(undefined, [{ key: 'door', type: 'structure/door/open', x: 2, y: 1 }])
    expect(eng.controls.plan('hands', { x: 2, y: 1 })!.label).toEqual({ en: 'Close the door', zh: '关上门' })
  })

  it('a label aimed at oneself says "yourself", not "you"', () => {
    // a learned answer for a cloth on anyone, oneself too (the live game's bandage)
    const eng = world('item/material/cloth', [])
    const on = eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'actor' }, { e: 'held' }))
    eng.lib.add({ id: 'patch/cloth-binds', host: { type: 'item/material/cloth' }, on: 'act/use', hole: holeKey(on.hole!.rule.id, on.hole!.path), at: on.open!.path, label: { en: 'Bandage {target}', zh: '给{target}包扎' }, tree: { do: [{ op: 'destroy' }] }, source: { origin: 'patch' } })
    expect(eng.controls.plan('self')!.label).toEqual({ en: 'Bandage yourself', zh: '给自己包扎' })
  })

  it("on one's own place E meets its top layer: the berries one stands on, though the pointer is on one's picture (over the tile behind) or the cell's own growth is drawn first", () => {
    const eng = world(undefined, [{ key: 'berries', type: 'item/food/berries', x: 2, y: 2 }])
    const c = eng.controls
    expect(c.plan('hands', { x: 2, y: 2 })?.target).toEqual({ e: 'berries' })
    // one's head is drawn over (2,1): the pointer there, on one's picture, is one's own place
    expect(c.plan('hands', { x: 2, y: 1, stack: [{ e: 'actor' }] })).toMatchObject({ at: { x: 2, y: 2 }, target: { e: 'berries' } })
    // the tile's own growth, drawn at the point, lies under what stands on it
    expect(c.plan('hands', { x: 2, y: 2, stack: [{ e: 'actor' }, { e: cellId('sandbox', 2, 2, 'volume') }] })?.target).toEqual({ e: 'berries' })
  })

  it('E meets a person, then a companion, before what is drawn over them; F and R keep the layers\' order', () => {
    const eng = world(undefined, [npc(), { key: 'stick', type: 'item/material/stick', x: 2, y: 1 }])
    const c = eng.controls
    // the view draws the stick over the farmer
    const aim = { x: 2, y: 1, stack: [{ e: 'stick' }, { e: 'npc.hollis' }] }
    expect(c.plan('hands', aim)?.target).toEqual({ e: 'npc.hollis' })
    // F takes the stick, and a bare R strikes it, not the farmer behind it (the order 33b18a7 and cad30b9 settled)
    expect(c.plan('take', aim)?.target).toEqual({ e: 'stick' })
    expect(c.choices('take', aim)[0]?.plan?.target).toEqual({ e: 'stick' })
    expect(c.plan('use', aim)?.target).toEqual({ e: 'stick' })
    // a companion is one whose `companion` prop names a leader (companion.ts), not anything of its kind: E reaches for
    // the fairy that follows one before the stick under her, and for the stick under one that follows nobody
    const fairy = (props: Record<string, PropValue>) => world(undefined, [{ key: 'stick', type: 'item/material/stick', x: 2, y: 1 }, { key: 'fairy', type: 'actor/companion', x: 2, y: 1, props }])
    expect(fairy({ companion: 'actor' }).controls.plan('hands', { x: 2, y: 1 })?.target).toEqual({ e: 'fairy' })
    expect(fairy({}).controls.plan('hands', { x: 2, y: 1 })?.target).toEqual({ e: 'stick' })
    // and F, beside the fairy that follows one, still takes the stick
    expect(fairy({ companion: 'actor' }).controls.plan('take', { x: 2, y: 1 })?.target).toEqual({ e: 'stick' })
  })

  it('a pointer beyond every reach aims at the farthest reached spot toward it, never at oneself', () => {
    const eng = world('item/weapon/ranged/bow', [{ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 9 }])
    const c = eng.controls
    // straight down: the bow reaches along its column, so the farthest spot is in the line (and short of the slime)
    const down = c.aim({ x: 2, y: 30 })!.at
    expect(down.x).toBe(2)
    expect(down.y).toBeGreaterThan(3)
    // off the line the bow does not carry: the farthest reached spot is the next one toward the pointer
    expect(c.aim({ x: 9, y: 7 })!.at).toMatchObject({ x: 3, y: 3 })
    // and along its row the bow carries again: as far as the map goes
    expect(c.aim({ x: -5, y: 2 })!.at).toMatchObject({ x: 0, y: 2 })
    for (const at of [{ x: 2, y: 30 }, { x: 9, y: 7 }, { x: -5, y: 2 }]) {
      // some input reaches the spot (each only where it reaches), and none of them is on oneself
      const plans = (['hands', 'take', 'use'] as Key[]).map((k) => c.plan(k, at)).filter((p) => !!p)
      expect(plans.length).toBeGreaterThan(0)
      for (const p of plans) expect(p.target).not.toEqual({ e: 'actor' })
    }
  })

  it('what one eats, drinks or wears can be used on another: food feeds them, a draught heals them, armour is put on them', () => {
    const eng = world('item/food/bread', [npc()])
    const hollis = eng.world.get('npc.hollis')!
    eng.author(() => eng.world.setProp(hollis, 'maxHunger', 20))
    eng.author(() => eng.world.setProp(hollis, 'hunger', 5))
    eng.controls.run(eng.controls.plan('use')!)
    expect(eng.world.num(hollis, 'hunger')).toBeGreaterThan(5)
    expect(eng.world.get('held')).toBeUndefined()
    const helm = world('item/armor/helmet', [npc()])
    helm.controls.run(helm.controls.plan('use')!)
    const h = helm.world.get('npc.hollis')!
    expect(helm.world.prop(h, 'wear:head')).toBe('held')
    expect(helm.world.get('held')!.place).toMatchObject({ on: 'inside', holder: 'npc.hollis' })
    expect(helm.world.worn(h).map((e) => e.id)).toEqual(['held'])
  })

  it('a thing that changes form keeps its quality in its name (a masterwork bucket filled is a masterwork bucket)', () => {
    const water = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => (y === 1 && x === 2 ? 'water' : 'grass')))
    const eng = world('item/vessel/bucket/empty', [], water)
    const w = eng.world
    eng.author(() => Object.assign(w.get('held')!, madeOf(w.onto.data, w.onto, 'item/vessel/bucket/empty', undefined, 'masterwork'), { type: 'item/vessel/bucket/empty' }))
    expect(textOf(w.get('held')!.name)).toMatch(/^Masterwork /)
    eng.controls.run(eng.controls.plan('use')!)
    const after = w.get('held')!
    expect(after.type).not.toBe('item/vessel/bucket/empty')
    expect(textOf(after.name)).toMatch(/^Masterwork /)
    expect(textOf(after.name)).not.toBe(textOf(madeOf(w.onto.data, w.onto, 'item/vessel/bucket/empty', undefined, 'masterwork').name))
  })

  it('a right click on oneself says what it will do with what is held: put on, or a weapon wielded; what is worn leaves the hand, and comes off in the equipment panel', () => {
    for (const [held, on] of [['item/clothing/cloak', 'Put on'], ['item/weapon/blade/axe', 'Wield']] as const) {
      const eng = world(held, [])
      const name = textOf(eng.world.get('held')!.name ?? eng.world.onto.resolve(held).name)
      expect(label(eng.controls.plan('self'))).toBe(`${on} ${name}`)
      eng.controls.run(eng.controls.plan('self')!)
      expect(eng.world.worn(eng.world.player).map((e) => e.id)).toEqual(['held'])
      expect(eng.world.player.held).not.toBe('held')
      eng.controls.wear('held', false)
      expect(eng.world.worn(eng.world.player)).toEqual([])
    }
  })

  it('what an input does is said by what answers it: food eats or feeds; the unknown says its default with a ?, and a patch says its own once it fills the hole', () => {
    const eng = world('item/food/apple', [npc(), { key: 'well', type: 'fixture/water/well', x: 1, y: 1 }])
    eng.author(() => eng.world.setProp(eng.world.get('npc.hollis')!, 'maxHunger', 20))
    expect(label(eng.controls.plan('self'))).toBe('Eat Apple')
    expect(label(eng.controls.plan('use'))).toBe('Feed Apple to farmer')
    const well = eng.controls.plan('use', { x: 1, y: 1 })!
    expect(well.unknown).toBe(true)
    expect(label(well)).toBe('Use Apple on well')
    // the apple's own answer at the hole the well reaches (design.md §5.16)
    const onWell = eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'well' }, { e: 'held' }))
    eng.lib.add({ id: 'patch/apple-wishing-well', host: { type: 'item/food/apple' }, on: 'act/use', hole: holeKey(onWell.hole!.rule.id, onWell.hole!.path), at: onWell.open!.path, label: { en: 'Toss {instrument} into {target}', zh: '把{instrument}扔进{target}' }, tree: { if: { is: { role: 'target', sel: { type: 'fixture/water/well' } } }, then: { do: [{ op: 'destroy' }] }, else: { undefined: true } }, source: { origin: 'patch' } })
    const after = eng.controls.plan('use', { x: 1, y: 1 })!
    expect(after.unknown).toBeFalsy()
    expect(label(after)).toBe('Toss Apple into well')
  })

  it('the chooser reaches any layer: the ground under a stick, the table under a pile', () => {
    const eng = world('item/tool/hoe', [{ key: 'stick', type: 'item/material/stick', x: 2, y: 1 }])
    expect(eng.controls.plan('use', undefined, ground(eng))!.rule).toBe('farm/till')
    const pile = world(undefined, [{ key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 }, { key: 'a', type: 'item/food/apple', x: 2, y: 1 }, { key: 'b', type: 'item/food/bread', x: 2, y: 1 }])
    // F offers what it can take; E reaches the table under them
    const takes = pile.controls.choices('take').map((c) => c.plan?.target)
    for (const id of ['a', 'b']) expect(takes).toContainEqual({ e: id })
    expect(takes).not.toContainEqual({ e: 'table' })
    expect(pile.controls.choices('hands').map((c) => c.plan?.target)).toContainEqual({ e: 'table' })
  })

  it('stepping onto a tile is contact: no change unless the tile says (nothing asked); a burning tile burns who steps on it', () => {
    const eng = world(undefined, [])
    const port = new ModPort(eng)
    eng.author(() => eng.applyStatus(eng.world.cellRef('sandbox', 2, 1), 'oiled'))
    eng.author(() => eng.applyStatus(eng.world.cellRef('sandbox', 2, 0), 'burning', 999))
    eng.trace = []
    eng.world.player.facing = 'up'
    expect(eng.step(eng.world.player, 'up')).toBe(true)
    expect(port.records).toHaveLength(0)
    expect(eng.world.hasStatus({ e: 'actor' }, 'burning')).toBe(false)
    eng.setCooldown('actor', 0)
    expect(eng.step(eng.world.player, 'up')).toBe(true)
    expect(eng.trace.some((t) => t.ev.kind === 'contact/begin' && t.rule === 'core/touch')).toBe(true)
    expect(eng.world.hasStatus({ e: 'actor' }, 'burning')).toBe(true)
    expect(port.records).toHaveLength(0)
  })
})

/**
 * Completeness (design.md §5.2): every act (verb, instrument, target) the player can make within
 * its reach is produced by some input — a key, the selected slot, the aim and a layer — and an
 * input makes exactly one act. Taking and putting are offered where they change something; one
 * never takes, puts or handles oneself; the held thing (or the bare body) is used on oneself by the
 * right click. The scene has the hard cases: a pile on a table, a stick on the ground, a person, the
 * player's own tile, a second thing in the bag.
 */
describe('completeness of the inputs', () => {
  const scene = () =>
    world('item/tool/hoe', [
      { key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 },
      { key: 'bread', type: 'item/food/bread', x: 2, y: 1 },
      { key: 'cheese', type: 'item/food/cheese', x: 2, y: 1 },
      { key: 'stick', type: 'item/material/stick', x: 1, y: 2 },
      { key: 'apple', type: 'item/food/apple', x: 0, y: 0, inside: 'actor' },
      { key: 'npc.oda', type: 'actor/person/merchant', x: 3, y: 1 },
    ])
  const KEYS: Key[] = ['hands', 'take', 'put', 'use', 'self', 'action', 'primary']
  const TILES = [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }] // a pile on a table, a stick on grass, a person, the own tile
  const sig = (verb: string, inst: string, target: Ref) => JSON.stringify([verb, inst, target])

  it('every (verb, instrument, target) is reachable from some input', () => {
    const eng = scene()
    const c = eng.controls
    const p = eng.world.player
    const typeOf = (r?: Ref) => (r && 'e' in r ? eng.world.get(r.e)!.type : 'none')
    // what the inputs make: every key × every slot (each carried thing, and an empty one) × every aim × a press
    // and every layer chosen (the chooser)
    const made = new Set<string>()
    const pressed = new Set<string>()
    const slots = [...p.slots!.map((k, i) => (k ? i : -1)).filter((i) => i >= 0), p.slots!.findIndex((k, i) => !k && i < 10)]
    for (const slot of slots) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of TILES) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (const layer of [undefined, ...Array.from({ length: n }, (_, i) => i)]) {
            const pl = c.plan(key, tile, layer)
            if (!pl) continue
            made.add(sig(pl.attack ? 'attack' : pl.verb!, typeOf(pl.instrument), pl.target))
            if (layer === undefined) pressed.add(sig(pl.attack ? 'attack' : pl.verb!, typeOf(pl.instrument), pl.target))
          }
        }
    }
    // what the player can do: a hand on what is within its reach; take what can be taken and put any
    // carried thing where it would go; use any carried thing (and the bare body: a blow) on what is
    // within its reach but one's own place, and any carried thing (and the bare body) on oneself
    const carried = [...new Set([...(p.contents ?? []), ...(p.held ? [p.held] : [])].map((id) => eng.world.get(id)!))]
    const own = eng.world.posOf(p)!
    const changes = (verb: Verb, target: Ref, inst?: string) => eng.preview(eng.actEvent(verb, p.id, target, inst ? { e: inst } : undefined)).changes
    const missing: string[] = []
    for (const tile of TILES)
      for (const target of c.layers({ map: 'sandbox', ...tile }).filter((r) => r.e !== p.id)) {
        const ownPlace = tile.x === own.x && tile.y === own.y
        if (eng.inReach('hands', p, target, undefined) && !made.has(sig('hands', 'none', target))) missing.push(sig('hands', 'none', target))
        if (changes('take', target) && !made.has(sig('take', 'none', target))) missing.push(sig('take', 'none', target))
        for (const inst of carried) if (changes('put', target, inst.id) && !made.has(sig('put', inst.type, target))) missing.push(sig('put', inst.type, target))
        if (ownPlace) continue
        for (const inst of carried) if (!made.has(sig('use', inst.type, target))) missing.push(sig('use', inst.type, target))
        if (!made.has(sig('attack', 'none', target))) missing.push(sig('attack', 'none', target))
      }
    for (const inst of carried) if (!made.has(sig('use', inst.type, { e: p.id }))) missing.push(sig('use', inst.type, { e: p.id }))
    if (!made.has(sig('attack', 'none', { e: p.id }))) missing.push(sig('attack', 'none', { e: p.id }))
    expect(missing).toEqual([])
    // a blow on oneself is only ever chosen: no press strikes the one at the keys
    expect(pressed.has(sig('attack', 'none', { e: p.id }))).toBe(false)
  })

  it('each input makes exactly one act, of its own verb (use on oneself and R use, a bare one is a blow; the action and the left click make one of the others)', () => {
    const eng = scene()
    const c = eng.controls
    for (const slot of [eng.world.player.selected!, eng.world.player.slots!.findIndex((k, i) => !k && i < 10)]) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }]) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (const layer of [undefined, ...Array.from({ length: n }, (_, i) => i)]) {
            const a = c.plan(key, tile, layer)
            const b = c.plan(key, tile, layer)
            expect(JSON.stringify(a)).toBe(JSON.stringify(b))
            if (!a) continue
            const made = key === 'action' || key === 'primary'
            const own = made ? a.key : key
            if (!made) expect(a.key).toBe(key === 'use' && a.key === 'self' ? 'self' : key)
            // the left click is a use: a tool's work or a weapon's blow, else a blow with no object held
            if (key === 'primary') expect(a.key).toBe('use')
            if (!a.instrument && (own === 'use' || own === 'self')) expect(a.attack).toBe(true)
            expect(a.verb).toBe(own === 'self' ? 'use' : own)
          }
        }
    }
  })

  it("the action's chooser is its plan on each layer", () => {
    const eng = scene()
    const c = eng.controls
    for (const tile of TILES) for (const ch of c.choices('action', tile)) expect(c.plan('action', tile, ch.layer)).toEqual(ch.plan)
  })

  it('an item in the bag is a target too (the context menu)', () => {
    const eng = scene()
    expect(eng.controls.planOnItem('use', 'apple')).toMatchObject({ verb: 'use', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('put', 'apple')).toMatchObject({ verb: 'put', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('hands', 'apple')).toMatchObject({ verb: 'hands', target: { e: 'apple' }, instrument: undefined })
  })
})

describe('the action (the right click): what the thing aimed at calls for', () => {
  const at = { x: 2, y: 1 }
  const act = (eng: Engine, aim: { x: number; y: number; stack?: Ref[] } = at) => eng.controls.plan('action', aim)
  /** A lesson at hand that lets only these inputs work (docs/prologue.md, the drills). */
  const drill = (eng: Engine, allow: string[]) => vi.spyOn(eng.story, 'lesson').mockReturnValue({ def: { id: 'drill', allow }, index: 0, total: 1 } as unknown as ReturnType<Engine['story']['lesson']>)

  it('a word to someone, whatever is held (handing it over is G alone, using it on them R)', () => {
    expect(act(world(undefined, [npc()]))).toMatchObject({ key: 'hands', rule: 'people/talk', instrument: undefined })
    expect(act(world('item/weapon/blade/axe', [npc()]))).toMatchObject({ key: 'hands', rule: 'people/talk', instrument: undefined })
    const bread = world('item/food/bread', [npc()])
    expect(act(bread)).toMatchObject({ key: 'hands', rule: 'people/talk' })
    expect(bread.controls.plan('use')).toMatchObject({ key: 'use', verb: 'use', instrument: { e: 'held' } })
  })

  it('what an object in hand does to the thing, where the bare hands change nothing there: raw meat cooks over a lit fire (the hands only warm)', () => {
    const fire = (held?: string) => {
      const eng = world(held, [{ key: 'fire', type: 'fixture/light/campfire', x: 2, y: 1 }])
      eng.author(() => eng.applyStatus({ e: 'fire' }, 'lit', 999))
      return eng
    }
    expect(act(fire())).toMatchObject({ key: 'hands', target: { e: 'fire' } })
    expect(act(fire())?.changes).toBeFalsy()
    const meat = fire('item/food/meat/raw')
    expect(act(meat)).toMatchObject({ key: 'use', rule: 'use/cook', instrument: { e: 'held' } })
    meat.controls.run(act(meat)!)
    expect(meat.world.get('held')!.type).toBe('item/food/meat/cooked')
    // a tool's work is the left click's, never the right click's: a hoe at the fire is the hands' warmth
    expect(act(fire('item/tool/hoe'))).toMatchObject({ key: 'hands', target: { e: 'fire' } })
  })

  it('a key on a locked chest turns in its lock: the bare hands only find it locked, so the object in hand answers', () => {
    const keyType = Object.keys(onto.types).find((t) => t.startsWith('item/key'))!
    const chest = (held?: string) => world(held, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1, tags: ['locked'] }])
    const bare = chest()
    expect(act(bare)).toMatchObject({ key: 'hands', target: { e: 'chest' } })
    expect(act(bare)?.changes).toBeFalsy()
    const key = chest(keyType)
    expect(act(key)).toMatchObject({ key: 'use', target: { e: 'chest' }, instrument: { e: 'held' } })
    key.controls.run(act(key)!)
    expect(key.world.hasTag(key.world.get('chest')!, 'locked')).toBe(false)
    expect(key.world.hasStatus({ e: 'chest' }, 'open')).toBe(true)
  })

  it('a creature: what is held used on it where it does something (wheat fed to a cow), before the bare hands', () => {
    const cow = world('item/material/wheat', [{ key: 'cow', type: 'actor/creature/animal/cow', x: 2, y: 1 }])
    expect(act(cow)).toMatchObject({ key: 'use', target: { e: 'cow' }, instrument: { e: 'held' } })
    expect(label(act(cow))).toBe('Feed Wheat to cow')
    // nothing it knows to do with a stone: the hands, as before
    const stone = world('item/material/stone', [{ key: 'cow', type: 'actor/creature/animal/cow', x: 2, y: 1 }])
    expect(act(stone)?.key).toBe('hands')
  })

  it('a hand where the bare hands do something (a chest opens); a take where they do not (a stone)', () => {
    expect(act(world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }]))).toMatchObject({ key: 'hands', rule: 'core/open-close' })
    const stone = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    expect(stone.controls.plan('hands')?.unknown).toBe(true)
    expect(act(stone)).toMatchObject({ key: 'take', target: { e: 'stone' } })
  })

  it('chooses as the base rules answer: a learned hand on a stone does not stop it picking stones up', () => {
    const eng = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    // the hand on a stone is handed to it (impulse/handle), where the base leaves a hole: the modder answers it
    const { res } = eng.preview(eng.actEvent('hands', 'actor', { e: 'stone' })).hole!
    eng.lib.add({ id: 'patch/stone-turned', host: { type: 'item/material/stone' }, on: 'impulse/handle', hole: holeKey(res.hole!.rule.id, res.hole!.path), at: res.open!.path, label: { en: 'Turn {target} over', zh: '把{target}翻过来' }, tree: { do: [] }, source: { origin: 'patch' } })
    // E does what the world learned; the right click still takes
    expect(eng.controls.plan('hands')).toMatchObject({ learned: true })
    expect(eng.controls.plan('hands')?.unknown).toBeFalsy()
    expect(act(eng)).toMatchObject({ key: 'take', target: { e: 'stone' } })
  })

  it("never a theft: on what only F would take (another's), nothing", () => {
    const eng = world(undefined, [{ key: 'loaf', type: 'item/food/bread', x: 2, y: 1, props: { owner: 'npc.oda' } }, { key: 'npc.oda', type: 'actor/person/merchant', x: 4, y: 4 }])
    expect(eng.controls.plan('take')?.steal).toBe(true)
    expect(act(eng)).toBeUndefined()
  })

  it('on the open ground: a bed in hand is set down, bread is eaten; with nothing to set down or use, nothing', () => {
    expect(act(world('fixture/furniture/bed', []))).toMatchObject({ key: 'put', verb: 'put' })
    expect(act(world('item/food/bread', []))).toMatchObject({ key: 'self', verb: 'use', target: { e: 'actor' } })
    expect(act(world(undefined, []))).toBeUndefined()
  })

  it("on a thing the hands could try, the experiment, not the meal in hand; pointed at oneself, any use of what is held", () => {
    const table = world('item/food/bread', [{ key: 'table', type: 'fixture/furniture/table', x: 2, y: 1 }])
    expect(table.controls.plan('hands')?.unknown).toBe(true)
    expect(act(table)).toMatchObject({ key: 'hands', target: { e: 'table' }, unknown: true })
    const feather = world('item/material/feather', [])
    // on the open ground a use the world has never seen is not offered; pointed at oneself, it is (the modder's)
    expect(act(feather)).toBeUndefined()
    expect(act(feather, { x: 2, y: 1, stack: [{ e: 'actor' }] })).toMatchObject({ key: 'self', unknown: true })
  })

  it('keeps to what a lesson lets work: the drill that teaches eating eats, the one that teaches taking takes', () => {
    const meal = world('item/food/bread', [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    drill(meal, ['move', 'select', 'self'])
    expect(act(meal)).toMatchObject({ key: 'self' })
    const pick = world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }, { key: 'stick', type: 'item/material/stick', x: 2, y: 1 }])
    drill(pick, ['move', 'take'])
    expect(act(pick)).toMatchObject({ key: 'take', target: { e: 'stick' } })
  })

  it('a press of R with nothing in hand on the bare ground the world has never seen struck asks nothing; chosen, it strikes', () => {
    const eng = world(undefined, [])
    expect(eng.controls.plan('use', at)).toBeUndefined()
    const chosen = eng.controls.plan('use', at, ground(eng))
    expect(chosen).toMatchObject({ attack: true, unknown: true })
    expect(eng.controls.choices('use', at).map((c) => c.layer)).toContain(ground(eng))
  })

  it('a press of E that only touches the ground does nothing (no line at every step); the label and the chooser keep the touch', () => {
    const eng = world(undefined, [])
    const touch = eng.controls.plan('hands', at)
    expect(touch).toMatchObject({ key: 'hands', rule: 'tile/handle' })
    expect(touch!.changes).toBeFalsy()
    expect(eng.controls.planFor('hands', at)).toBeUndefined()
    expect(eng.controls.planFor('hands', at, ground(eng))).toMatchObject({ key: 'hands', rule: 'tile/handle' })
    // what does something is still pressed: a chest opens
    const chest = world(undefined, [{ key: 'chest', type: 'fixture/container/chest', x: 2, y: 1 }])
    expect(chest.controls.planFor('hands', at)).toMatchObject({ rule: 'core/open-close' })
  })

  it("the '?' goes where the AI setting turns the kind of work off: the leaf's default comes, no one is asked", () => {
    const eng = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    expect(eng.controls.plan('hands')).toMatchObject({ unknown: true })
    expect(eng.controls.plan('hands')?.quiet).toBeFalsy()
    eng.quality = { ...eng.quality, things: 'off' }
    expect(eng.controls.plan('hands')).toMatchObject({ unknown: true, quiet: true })
  })
})

describe('the left click: a swing', () => {
  const at = { x: 2, y: 1 }
  const slime = (props: Record<string, PropValue> = {}): ScenarioEntity => ({ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 1, props: { hp: 50, maxHp: 50, ...props } })

  it('what is held works as it is meant to: a weapon strikes, a tool works, a built thing is set down (R\'s own act)', () => {
    const sword = world('item/weapon/blade/sword', [slime()])
    sword.world.player.props!.profession = 'warrior'
    expect(sword.controls.plan('primary', at)).toEqual(sword.controls.plan('use', at))
    expect(sword.controls.plan('primary', at)).toMatchObject({ attack: true, instrument: { e: 'held' } })
    const wall = world('structure/wall', [])
    expect(wall.controls.plan('primary', at)).toMatchObject({ sets: true })
  })

  it('with an object in hand, or nothing, a blow with the main hand\'s weapon, else the fist: never the thing held', () => {
    const stone = world('item/material/stone', [slime()])
    const punch = stone.controls.plan('primary', at)!
    expect(punch).toMatchObject({ key: 'use', verb: 'use', attack: true, instrument: undefined, target: { e: 's' } })
    expect(label(punch)).toBe('Punch green slime')
    stone.controls.swing(punch)
    stone.tick()
    expect(stone.world.num(stone.world.get('s')!, 'hp')).toBeLessThan(50)
    expect(stone.world.player.held).toBe('held')
    // the sword kept in the main hand strikes, the bread in hand stays
    const kept = world('item/weapon/blade/sword', [slime(), { key: 'bread', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' }])
    kept.world.player.props!.profession = 'warrior'
    kept.controls.run(kept.controls.plan('self')!)
    kept.controls.select(kept.world.player.slots!.indexOf(kept.world.player.slots!.find((k) => k && k.includes('bread'))!))
    expect(kept.world.player.held).toBe('bread')
    expect(kept.controls.plan('primary', at)).toMatchObject({ attack: true, instrument: { e: 'held' } })
  })

  it('the blow lands on someone, then what cannot be carried, never a loose thing; on a person only with the blade drawn', () => {
    // a stick on the grass: not struck (F takes it), and the grass the world has never seen struck asks nothing
    expect(world(undefined, [{ key: 'stick', type: 'item/material/stick', x: 2, y: 1 }]).controls.plan('primary', at)).toBeUndefined()
    // a boulder: struck
    expect(world('item/food/bread', [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }]).controls.plan('primary', at)).toMatchObject({ attack: true, target: { e: 'rock' } })
    // the slime under a stick drawn over it: the slime
    expect(world(undefined, [slime(), { key: 'stick', type: 'item/material/stick', x: 2, y: 1 }]).controls.plan('primary', { ...at, stack: [{ e: 'stick' }, { e: 's' }] })).toMatchObject({ target: { e: 's' } })
    // the farmer with bread in hand: nothing (no villager is hurt by accident); drawn (X), a blow
    const eng = world('item/food/bread', [npc()])
    expect(eng.controls.plan('primary', at)).toBeUndefined()
    eng.author(() => eng.applyStatus({ e: 'actor' }, 'drawn', NO_EXPIRY))
    expect(eng.controls.plan('primary', at)).toMatchObject({ attack: true, target: { e: 'npc.hollis' } })
    // a companion is not struck either
    const fairy = world(undefined, [{ key: 'fairy', type: 'actor/companion', x: 2, y: 1, props: { companion: 'actor' } }])
    expect(fairy.controls.plan('primary', at)?.target).not.toEqual({ e: 'fairy' })
  })

  it('never on oneself, and no chooser (R chooses)', () => {
    const eng = world('item/food/bread', [])
    expect(eng.controls.plan('primary', { x: 2, y: 2 })).toBeUndefined()
    expect(eng.controls.choices('primary', at)).toEqual([])
    expect(eng.controls.plan('primary', at, 0)).toBeUndefined()
  })

  it('held, it goes on at a swing\'s pace: blows wherever the aim meets one, the same work cell after cell, never what the world has not seen nor what undoes it', () => {
    // a row of soil tilled: the first cell at once, the next once the swing's beat allows
    const hoe = world('item/tool/hoe', [])
    const c = hoe.controls
    const first = c.plan('primary', at)!
    c.swing(first)
    expect(hoe.world.terrainAt('sandbox', 2, 1)).toBe('farmland')
    c.again(first, { x: 1, y: 2 })
    expect(hoe.world.terrainAt('sandbox', 1, 2)).toBe('grass')
    for (let i = 0; i < 10; i++) (hoe.tick(), c.again(first, { x: 1, y: 2 }))
    expect(hoe.world.terrainAt('sandbox', 1, 2)).toBe('farmland')
    // a bucket filled at the water is not poured back while the button stays down
    const water = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => (y === 1 && x === 2 ? 'water' : 'grass')))
    const bucket = world('item/vessel/bucket/empty', [], water)
    const fill = bucket.controls.plan('primary', at)!
    bucket.controls.swing(fill)
    const full = bucket.world.get('held')!.type
    expect(full).not.toBe('item/vessel/bucket/empty')
    for (let i = 0; i < 20; i++) (bucket.tick(), bucket.controls.again(fill, at))
    expect(bucket.world.get('held')!.type).toBe(full)
    // blows: the slime is struck again as the cooldown allows
    const fist = world(undefined, [slime({ hp: 500, maxHp: 500 })])
    const blow = fist.controls.plan('primary', at)!
    fist.controls.swing(blow)
    fist.tick()
    const after = fist.world.num(fist.world.get('s')!, 'hp')
    for (let i = 0; i < 20; i++) (fist.controls.again(blow, at), fist.tick())
    expect(fist.world.num(fist.world.get('s')!, 'hp')).toBeLessThan(after)
  })
})

describe('slots and the magnet', () => {
  it('new kinds take free slots; the hand holds the selected stack; a held item an outcome changed keeps its slot', () => {
    const eng = world('item/vessel/bucket/water', [
      { key: 'b2', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' },
      { key: 'b3', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' },
    ])
    const p = eng.world.player
    expect(p.slots!.filter(Boolean)).toHaveLength(2)
    const bucketSlot = p.selected!
    // pouring the water out: the bucket (the act's host) becomes an empty one, in the hand
    eng.controls.run(eng.controls.plan('use')!)
    expect(eng.world.get('held')!.type).toBe('item/vessel/bucket/empty')
    expect(p.selected).toBe(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
    const breadSlot = p.slots!.findIndex((k, i) => k && i !== bucketSlot)
    eng.controls.select(breadSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/food/bread')
    const empty = p.slots!.findIndex((k, i) => !k && i < 10)
    eng.controls.select(empty)
    expect(p.held).toBeUndefined()
    expect(p.slots![bucketSlot]).toBeTruthy()
    eng.controls.select(bucketSlot)
    expect(eng.world.get(p.held)!.type).toBe('item/vessel/bucket/empty')
  })

  it('what the magnet pulls in takes a free slot but the selected one: an empty hand stays empty (the fist), unless no other slot is free', () => {
    const eng = world(undefined, [{ key: 'log', type: 'item/material/log', x: 4, y: 2 }])
    const p = eng.world.player
    expect(p.slots![p.selected!]).toBeNull()
    expect(p.held).toBeUndefined()
    // what flies in mid-fight
    eng.world.get('log')!.dropped = true
    eng.controls.magnetic = true
    eng.tick()
    expect(eng.world.get('log')!.place).toMatchObject({ on: 'inside', holder: 'actor' })
    expect(p.held).toBeUndefined()
    expect(p.slots![p.selected!]).toBeNull()
    // a take (F) is meant: it lands in the hand, as before
    const take = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 1 }])
    take.controls.run(take.controls.plan('take')!)
    expect(take.world.player.held).toBe('stone')
    // every other slot taken: the selected one takes it rather than the ground
    const kinds = Object.keys(onto.types).filter((t) => t.startsWith('item/material/') && !Object.keys(onto.types).some((u) => u.startsWith(`${t}/`)))
    expect(kinds.length).toBeGreaterThanOrEqual(30)
    const full = world(undefined, [...kinds.slice(0, 29).map((type, i) => ({ key: `k${i}`, type, x: 0, y: 0, inside: 'actor' })), { key: 'last', type: kinds[29], x: 3, y: 2 }])
    const q = full.world.player
    full.controls.quickMove(q.selected!)
    expect(q.slots!.filter(Boolean)).toHaveLength(29)
    expect(q.slots![q.selected!]).toBeNull()
    full.world.get('last')!.dropped = true
    full.controls.magnetic = true
    full.tick()
    expect(q.slots!.filter(Boolean)).toHaveLength(30)
    expect(q.held).toBe('last')
  })

  it('the bag holds three rows; Tab brings the next row to the toolbar, Shift+click moves a stack across', () => {
    const known = ['ash', 'bone', 'cloth', 'coal', 'feather', 'herb', 'leather', 'log', 'plank', 'salt', 'stick', 'stone'].map((m) => `item/material/${m}`)
    const eng = world(undefined, known.map((type, i) => ({ key: `k${i}`, type, x: 0, y: 0, inside: 'actor' })))
    const p = eng.world.player
    expect(p.slots).toHaveLength(30)
    // more kinds than the toolbar holds: the rest go to row 2, nothing is dropped
    expect(p.slots!.filter(Boolean)).toHaveLength(known.length)
    expect(p.contents!.length + (p.held ? 1 : 0)).toBe(known.length)
    const second = p.slots![10]
    expect(second).toBeTruthy()
    eng.controls.nextRow()
    expect(p.slots![0]).toBe(second)
    eng.controls.nextRow(-1)
    expect(p.slots![10]).toBe(second)
    // Shift+click: from the bag to the toolbar's first free slot, and back to the bag's
    eng.controls.select(0)
    eng.controls.drop(0, true)
    eng.controls.quickMove(10)
    expect(p.slots![0]).toBe(second)
    expect(p.slots![10]).toBeNull()
    eng.controls.quickMove(0)
    expect(p.slots![0]).toBeNull()
    expect(p.slots!.indexOf(second)).toBeGreaterThanOrEqual(10)
  })

  it('the menu drops in front (an act of putting)', () => {
    const bag = world(undefined, [{ key: 'b', type: 'item/food/bread', x: 0, y: 0, inside: 'actor' }])
    bag.trace = []
    bag.controls.drop(bag.world.player.slots!.findIndex(Boolean), true)
    expect(bag.world.get('b')!.place).toMatchObject({ on: 'tile', x: 2, y: 1 })
    expect(bag.trace.map((t) => t.rule).slice(0, 2)).toEqual(['core/put', 'core/receive-ground'])
  })

  it('dropped items within two tiles fly into the bag (an act of taking)', () => {
    const eng = world(undefined, [{ key: 'log', type: 'item/material/log', x: 4, y: 2 }])
    eng.world.get('log')!.dropped = true
    eng.controls.magnetic = true
    eng.tick()
    expect(eng.world.get('log')!.place).toMatchObject({ holder: 'actor' })
  })
})

describe('hunger', () => {
  it('drains over time, food restores it, well fed heals, starving hurts but never takes the last point', () => {
    const eng = world('item/food/bread', [])
    const p = eng.world.player
    const tickTo = (t: number) => {
      while (eng.world.state.tick < t) eng.tick()
    }
    expect(eng.world.num(p, 'maxHunger')).toBe(20)
    tickTo(HUNGER_EVERY)
    expect(p.props!.hunger).toBe(19)
    // bread feeds (5), never past the bar, and does not heal (Minecraft: health comes from being fed)
    p.props!.hp = 30
    eng.act('use', p.id, { e: p.id }, { instrument: { e: 'held' } })
    expect(p.props!.hunger).toBe(20)
    expect(p.props!.hp).toBe(30)
    // a healing herb is medicine: it heals as well
    const herb = eng.author(() => eng.world.create('item/material/herb', { on: 'inside', holder: p.id }))
    eng.act('use', p.id, { e: p.id }, { instrument: { e: herb.id } })
    expect(p.props!.hp).toBe(34)
    // well fed: hurt health comes back slowly
    p.props!.hp = 30
    tickTo(eng.world.state.tick + HUNGER_EFFECT_EVERY * 3)
    expect(p.props!.hp).toBeGreaterThan(30)
    // starving: health falls, but not below 1
    p.props!.hunger = 0
    p.props!.hp = 3
    tickTo(eng.world.state.tick + HUNGER_EFFECT_EVERY * 10)
    expect(p.props!.hp).toBe(1)
    expect(eng.world.hasStatus({ e: p.id }, 'down')).toBe(false)
  })

  it('falls in two paces: fed, full to six tenths in a meal\'s span; then hungry, a point every six game hours (days to empty); asleep and hungry slower by both', () => {
    const eng = world(undefined, [])
    const w = eng.world
    const p = w.player
    const hungry = () => w.hasStatus({ e: p.id }, 'hungry')
    /** Ticks until the next point falls. */
    const nextDrop = (most: number) => {
      const from = w.num(p, 'hunger')
      const t0 = w.state.tick
      while (w.num(p, 'hunger') === from && w.state.tick - t0 < most) eng.tick()
      return w.state.tick - t0
    }
    expect(w.num(p, 'hunger')).toBe(20)
    // fed: a point every HUNGER_EVERY (48 game minutes): from full to twelve (six tenths) in under seven game hours
    nextDrop(HUNGER_EVERY)
    expect(nextDrop(HUNGER_EVERY * 2)).toBe(HUNGER_EVERY)
    while (w.num(p, 'hunger') > 12) nextDrop(HUNGER_EVERY * 2)
    expect(hungry()).toBe(false)
    expect((8 * HUNGER_EVERY) / TICKS_PER_HOUR).toBeLessThan(7)
    // under six tenths: hungry, and the bar falls HUNGRY_PACE times slower — a point every six game hours
    nextDrop(HUNGER_EVERY * 2)
    expect(w.num(p, 'hunger')).toBe(11)
    eng.tick()
    expect(hungry()).toBe(true)
    nextDrop(HUNGER_EVERY * HUNGRY_PACE * 2)
    expect(nextDrop(HUNGER_EVERY * HUNGRY_PACE * 2)).toBe(HUNGER_EVERY * HUNGRY_PACE)
    expect((HUNGER_EVERY * HUNGRY_PACE) / TICKS_PER_HOUR).toBe(6)
    // full to empty, a meal skipped and then none: about three days
    const days = (8 * HUNGER_EVERY + 12 * HUNGER_EVERY * HUNGRY_PACE) / (24 * TICKS_PER_HOUR)
    expect(days).toBeGreaterThan(2.5)
    expect(days).toBeLessThan(4)
    // asleep and hungry: both slow it (the paces multiply)
    eng.author(() => eng.applyStatus({ e: p.id }, 'asleep'))
    nextDrop(HUNGER_EVERY * HUNGRY_PACE * 4 * 2)
    expect(nextDrop(HUNGER_EVERY * HUNGRY_PACE * 4 * 2)).toBe(HUNGER_EVERY * HUNGRY_PACE * 4)
    eng.author(() => eng.removeStatus({ e: p.id }, 'asleep'))
    // a meal over the line: hungry no more, and the bar falls at the fed pace again
    eng.author(() => eng.setProp(p, 'hunger', 18))
    eng.tick()
    expect(hungry()).toBe(false)
    // what the slow pace had come carries over: the next point within a fed interval, and the fed pace after
    expect(nextDrop(HUNGER_EVERY * 2)).toBeLessThanOrEqual(HUNGER_EVERY)
    expect(nextDrop(HUNGER_EVERY * 2)).toBe(HUNGER_EVERY)
  })

  it('one under the line without the status (a save from before it) is made hungry at the next point', () => {
    const eng = world(undefined, [])
    const w = eng.world
    const p = w.player
    // as a save from before the line held it: under it, no status (nothing crossed)
    p.props!.hunger = 6
    expect(w.hasStatus({ e: p.id }, 'hungry')).toBe(false)
    while (w.num(p, 'hunger') === 6) eng.tick()
    expect(w.hasStatus({ e: p.id }, 'hungry')).toBe(true)
  })
})

describe('the attack key', () => {
  it('strikes straight ahead with the held weapon; held down, the cooldown paces the blows', () => {
    const eng = world('item/weapon/blade/sword', [{ key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1, props: { hp: 50, maxHp: 50 } }])
    eng.world.player.props!.profession = 'warrior' // the sword is the warrior's
    const slime = eng.world.get('slime')!
    eng.controls.strike()
    eng.tick()
    const after1 = eng.world.num(slime, 'hp')
    expect(after1).toBeLessThan(50)
    // pressed again at once: the blow is still on cooldown
    eng.controls.strike()
    eng.tick()
    expect(eng.world.num(slime, 'hp')).toBe(after1)
    // held down: blows keep landing as the cooldown allows
    for (let i = 0; i < 20; i++) (eng.controls.strike(), eng.tick())
    expect(eng.world.num(slime, 'hp')).toBeLessThan(after1)
  })

  it('never swings an object that happens to be held (a stone picked up): the fist; a tool in hand is swung (a torch)', () => {
    const stone = world('item/material/stone', [{ key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1, props: { hp: 50, maxHp: 50 } }])
    expect(weaponOf(stone.world, stone.world.player)).toBeUndefined()
    stone.trace = []
    stone.controls.strike()
    const blow = stone.trace.find((t) => t.ev.kind === 'act/use' && t.ev.params?.attack)
    expect(blow).toBeDefined()
    expect(blow!.ev.roles.instrument).toBeFalsy()
    expect(stone.world.get('held')!.place).toMatchObject({ on: 'hand', holder: 'actor' })
    const torch = world('item/light/torch', [])
    expect(weaponOf(torch.world, torch.world.player)?.id).toBe('held')
  })
})
