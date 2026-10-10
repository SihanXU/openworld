// Breaking (world-model.md §6.1–6.3, §10.2): every thing with durability (maxHp) loses it to every
// damage channel that reaches it, and every one has an end when it breaks — what it is made of,
// a rule of its own, or going down (the essential). Nothing breakable is left to the AI's guess.

import { describe, expect, it } from 'vitest'
import { OntologyIndex, RuleLibrary, buildSandbox, type Engine, type GameEvent } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const index = new OntologyIndex(onto)
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** Every type a thing can be that has durability (the roots of a branch included only if instances can be them). */
const BREAKABLE = Object.keys(onto.types).filter((id) => {
  const r = index.resolve(id)
  return typeof r.props.maxHp === 'number' && r.props.maxHp > 0 && !Object.keys(onto.types).some((o) => o.startsWith(id + '/'))
})

/** An instrument that works on a material category: its best tool, in iron. */
const TOOL: Record<string, string> = {
  wood: 'item/weapon/blade/axe',
  plant: 'item/weapon/blade/axe',
  flesh: 'item/weapon/blade/sword',
  organic: 'item/weapon/blade/sword',
  skin: 'item/weapon/blade/sword',
  fibre: 'item/weapon/blade/sword',
  stone: 'item/tool/pickaxe',
  ore: 'item/tool/pickaxe',
  metal: 'item/tool/pickaxe',
  bone: 'item/tool/pickaxe',
  crystal: 'item/tool/pickaxe',
  soil: 'item/tool/shovel',
}

/** A sandbox with the thing at (2,1), whole, and the actor at (2,3) holding an iron `tool`. */
function place(type: string, tool?: string): Engine {
  const isTile = type.startsWith('tile/')
  const terrain = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => (isTile && x === 2 && y === 1 ? type.slice(5) : 'grass')))
  return buildSandbox(
    {
      terrain,
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { atk: 4 } },
        ...(tool ? [{ key: 'tool', type: tool, x: 2, y: 2, heldBy: 'actor', tags: ['material:iron'] }] : []),
        ...(isTile ? [] : [{ key: 'thing', type, x: 2, y: 1 }]),
      ],
      event: {},
    },
    onto,
    lib(),
  )
}
const thingOf = (eng: Engine, type: string) => (type.startsWith('tile/') ? eng.world.cellTop('sandbox', 2, 1) : eng.world.get('thing'))
/** Has it lost durability, or become something else, or gone (down, broken, transformed)? */
function harmed(eng: Engine, type: string, id: string): boolean {
  const e = eng.world.get(id)
  if (!e || e.type !== type) return true
  if (eng.world.hasStatus({ e: id }, 'down')) return true
  return eng.world.num(e, 'hp', eng.world.num(e, 'maxHp')) < eng.world.num(e, 'maxHp')
}

describe('breaking (world-model.md §10.2)', () => {
  it('there are breakable things of every kind the world has: trees, rock, walls, stumps, veins, boulders, bodies', () => {
    for (const t of ['tile/tree', 'tile/rock', 'tile/wall', 'tile/woodwall', 'tile/stump', 'fixture/nature/vein/iron', 'fixture/nature/boulder', 'actor/creature/slime/green_slime']) expect(BREAKABLE).toContain(t)
  })

  it('every damage channel reaches every breakable type: a blow with a tool that works on it, and fire on what burns', () => {
    const missed: string[] = []
    for (const type of BREAKABLE) {
      const material = index.resolve(type).props.material
      const category = typeof material === 'string' ? onto.materials?.[material]?.category : undefined
      const eng = place(type, TOOL[category ?? 'flesh'])
      const e = thingOf(eng, type)!
      const id = e.id
      const strike: GameEvent = { kind: 'impulse/strike', host: { e: id }, roles: { actor: { e: 'actor' }, instrument: { e: 'tool' } }, params: { power: 6, edge: 'cut' }, cause: 'actor', origin: 'world' }
      eng.author(() => eng.queue(strike))
      eng.flush()
      if (!harmed(eng, type, id)) missed.push(`${type}: a blow`)
      if (!index.resolve(type).tags.includes('flammable')) continue
      const lit = place(type)
      const f = thingOf(lit, type)!
      lit.author(() => lit.applyStatus({ e: f.id }, 'burning'))
      for (let i = 0; i < 40; i++) lit.tick()
      if (!harmed(lit, type, f.id)) missed.push(`${type}: fire`)
    }
    expect(missed).toEqual([])
  })

  it('every breakable type has an end: broken, it goes down, breaks into its makeup, or a rule of its own says — never a hole', () => {
    const holes: string[] = []
    for (const type of BREAKABLE) {
      const eng = place(type)
      const e = thingOf(eng, type)!
      const res = eng.resolveEvent({ kind: 'threshold/cross', host: { e: e.id }, roles: {}, params: { name: 'broken', prop: 'hp' }, origin: 'world' })
      if (!res.defined) holes.push(type)
    }
    expect(holes).toEqual([])
  })

  it('too hard: an instrument softer than what it strikes does nothing to it; nothing is asked', () => {
    const eng = place('tile/rock')
    eng.author(() => eng.world.add({ id: 'club', type: 'item/weapon/blunt/club', tags: ['material:wood'], place: { on: 'hand', holder: 'actor' } }))
    const rock = eng.world.cellTop('sandbox', 2, 1)!
    const res = eng.act('use', 'actor', { e: rock.id }, { params: { attack: true } })
    expect(res.defined).toBe(true)
    expect(eng.world.num(rock, 'hp')).toBe(eng.world.num(rock, 'maxHp'))
    expect(eng.trace.some((t) => !t.defined)).toBe(false)
  })

  it('what has no durability cannot be harmed: a hurt on it changes nothing', () => {
    const eng = place('fixture/sacred/statue')
    const statue = eng.world.get('thing')!
    eng.author(() => eng.hurt(statue, 99))
    expect(statue.props?.hp).toBeUndefined()
  })
})
