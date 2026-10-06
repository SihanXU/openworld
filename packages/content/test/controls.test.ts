import { describe, expect, it } from 'vitest'
import { HUNGER_EFFECT_EVERY, HUNGER_EVERY, HUNGRY_PACE, ModPort, TICKS_PER_HOUR, RuleLibrary, buildSandbox, textOf, type Engine, type Key, type Plan, type Ref, type ScenarioEntity, type Verb } from '@lsw/engine'
import { cellId } from '@lsw/engine'
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

describe('the five inputs: one act each', () => {
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

  it('asks before eating (left click on oneself), and eats on yes', () => {
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

  it('left click works the ground with a tool: the hoe strikes, the ground answers', () => {
    const eng = world('item/tool/hoe', [])
    const plan = eng.controls.plan('use')!
    expect(plan.rule).toBe('farm/till')
    expect(label(plan)).toBe('Till grass')
    eng.controls.run(plan)
    expect(eng.world.terrainAt('sandbox', 2, 1)).toBe('farmland')
  })

  it('experiments go to the Mod port: an object on a thing (left click), a bare hand (E)', () => {
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

  it('weapons strike (but on a person a blade is not a blow); a bare left click is a blow on anything (Minecraft)', () => {
    const well = world('item/weapon/blade/sword', [{ key: 'well', type: 'fixture/water/well', x: 2, y: 1 }])
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
    // with nothing held the left click is the body's own blow, whatever it meets: never E's hand
    const rock = world(undefined, [{ key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 }])
    const punch = rock.controls.plan('use')!
    expect(punch).toMatchObject({ verb: 'use', attack: true, instrument: undefined })
    expect(label(punch)).toBe('Punch boulder')
    rock.controls.run(punch)
    expect(rock.world.fx.some((f) => f.t === 'log' && textOf(f.text) === 'Too hard.')).toBe(true)
  })

  it('reach: E as far as the thing lets a hand (a bed only from on it), F and G the cells round, the left click as far as the held thing carries', () => {
    const far = world(undefined, [{ key: 'stone', type: 'item/material/stone', x: 2, y: 0 }, npc()])
    // two cells off: nothing reaches the stone; a pointer there aims at the farthest spot toward it that is reached
    expect(far.controls.reachable({ x: 2, y: 0 })).toBe(false)
    expect(far.controls.plan('use', { x: 2, y: 0 })).toMatchObject({ at: { x: 2, y: 1 }, target: { e: 'npc.hollis' } })
    expect(far.controls.plan('take', { x: 2, y: 0 })?.target).not.toEqual({ e: 'stone' })
    // the engine itself holds every act to its reach, for anyone
    expect(far.act('take', 'actor', { e: 'stone' }, { instrument: null }).defined).toBe(false)
    expect(far.world.get('stone')!.place.on).toBe('tile')
    // a bow carries: the far tile in line is within the left click's reach, one off the line is not
    const bow = world('item/weapon/ranged/bow', [{ key: 's', type: 'actor/creature/slime/green_slime', x: 2, y: 0 }, { key: 't', type: 'actor/creature/slime/green_slime', x: 4, y: 1 }])
    expect(bow.controls.plan('use', { x: 2, y: 0 })).toMatchObject({ attack: true, target: { e: 's' } })
    expect(bow.controls.plan('use', { x: 4, y: 1 })?.target).not.toEqual({ e: 't' })
    // a bed is used from on it
    const bed = world(undefined, [{ key: 'bed', type: 'fixture/furniture/bed', x: 2, y: 1 }])
    expect(bed.controls.plan('hands', { x: 2, y: 1 })).toBeUndefined()
    bed.author(() => bed.world.place(bed.world.player, { on: 'tile', map: 'sandbox', x: 2, y: 1 }))
    expect(bed.controls.plan('hands', { x: 2, y: 1 })).toMatchObject({ verb: 'hands', target: { e: 'bed' } })
  })

  it('E, F and G never take oneself: on one\'s own place they meet what is there; the right click is the held thing on oneself', () => {
    const eng = world('item/food/bread', [{ key: 'stick', type: 'item/material/stick', x: 2, y: 2 }])
    for (const key of ['hands', 'take', 'put'] as Key[]) expect(eng.controls.plan(key, { x: 2, y: 2 })?.target).not.toEqual({ e: 'actor' })
    expect(eng.controls.plan('take', { x: 2, y: 2 })?.target).toEqual({ e: 'stick' })
    const self = eng.controls.plan('self')!
    expect(self).toMatchObject({ key: 'self', verb: 'use', target: { e: 'actor' }, rule: 'use/eat' })
    // a left click on one's own place is the same act
    expect(eng.controls.plan('use', { x: 2, y: 2 })).toMatchObject({ verb: 'use', target: { e: 'actor' }, rule: 'use/eat' })
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

  it('what an input does is said by what answers it: food eats or feeds; the unknown says its default with a ?, and a patch says its own once it fills the hole', () => {
    const eng = world('item/food/apple', [npc(), { key: 'well', type: 'fixture/water/well', x: 1, y: 1 }])
    eng.author(() => eng.world.setProp(eng.world.get('npc.hollis')!, 'maxHunger', 20))
    expect(label(eng.controls.plan('self'))).toBe('Eat Apple')
    expect(label(eng.controls.plan('use'))).toBe('Feed Apple to farmer')
    const well = eng.controls.plan('use', { x: 1, y: 1 })!
    expect(well.unknown).toBe(true)
    expect(label(well)).toBe('Use Apple on well')
    eng.lib.add({ id: 'patch/apple-wishing-well', host: { type: 'item/food' }, on: 'act/use', label: { en: 'Toss {instrument} into {target}', zh: '把{instrument}扔进{target}' }, tree: { if: { is: { role: 'target', sel: { type: 'fixture/water/well' } } }, then: { do: [{ op: 'destroy' }] } }, source: { origin: 'patch' } })
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
  const KEYS: Key[] = ['hands', 'take', 'put', 'use', 'self']
  const TILES = [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }] // a pile on a table, a stick on grass, a person, the own tile
  const sig = (verb: string, inst: string, target: Ref) => JSON.stringify([verb, inst, target])

  it('every (verb, instrument, target) is reachable from some input', () => {
    const eng = scene()
    const c = eng.controls
    const p = eng.world.player
    const typeOf = (r?: Ref) => (r && 'e' in r ? eng.world.get(r.e)!.type : 'none')
    // what the inputs make: every key × every slot (each carried thing, and an empty one) × every aim × every layer
    const made = new Set<string>()
    const slots = [...p.slots!.map((k, i) => (k ? i : -1)).filter((i) => i >= 0), p.slots!.findIndex((k, i) => !k && i < 10)]
    for (const slot of slots) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of TILES) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (let layer = 0; layer < n; layer++) {
            const pl = c.plan(key, tile, layer)
            if (pl) made.add(sig(pl.attack ? 'attack' : pl.verb!, typeOf(pl.instrument), pl.target))
          }
        }
    }
    // what the player can do: a hand on what is within its reach; take what can be taken and put any
    // carried thing where it would go; use any carried thing (and the bare body: a blow) on what is
    // within its reach but one's own place, and on oneself
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
  })

  it('each input makes exactly one act, of its own verb (the left and right clicks use; a bare one is a blow)', () => {
    const eng = scene()
    const c = eng.controls
    for (const slot of [eng.world.player.selected!, eng.world.player.slots!.findIndex((k, i) => !k && i < 10)]) {
      c.select(slot)
      for (const key of KEYS)
        for (const tile of [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 2 }]) {
          const n = c.layers({ map: 'sandbox', ...tile }).length
          for (let layer = 0; layer < n; layer++) {
            const a = c.plan(key, tile, layer)
            const b = c.plan(key, tile, layer)
            expect(JSON.stringify(a)).toBe(JSON.stringify(b))
            if (!a) continue
            if (!a.instrument && (key === 'use' || key === 'self')) expect(a.attack).toBe(true)
            expect(a.verb).toBe(key === 'self' ? 'use' : key)
          }
        }
    }
  })

  it('an item in the bag is a target too (the context menu)', () => {
    const eng = scene()
    expect(eng.controls.planOnItem('use', 'apple')).toMatchObject({ verb: 'use', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('put', 'apple')).toMatchObject({ verb: 'put', target: { e: 'apple' } })
    expect(eng.controls.planOnItem('hands', 'apple')).toMatchObject({ verb: 'hands', target: { e: 'apple' }, instrument: undefined })
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
})
