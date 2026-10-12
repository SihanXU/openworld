import { describe, expect, it } from 'vitest'
import { Game, Rng, RuleLibrary, rollAffixes, type Entity } from '@openworld/engine'
import { AFFIX_TABLE, BASE_RULES, FORM_BY_ID, STORY_RULES, TROPHIES, TROPHY_OF, TROPHY_SETS, buildOntology, decodeChunk, makeItem } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// Every kind of monster's own piece (content trophies.ts): a chance each felling, sure at the fiftieth; every piece of
// gear rolls four small extras as it is made (engine affixes.ts); a family's pieces worn together make a set.

const onto = buildOntology()

function game() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player
  const axe = Object.values(w.state.entities).find((e) => e.type === 'item/weapon/blade/axe')!
  eng.author(() => w.place(axe, { on: 'inside', holder: p.id }))
  eng.controls.sync()
  eng.controls.select(p.slots!.indexOf(eng.controls.key(axe)))
  /** Fell one of a kind the way the player does: it stands below them at one health, struck with the axe. */
  const fell = (type: string, props: Record<string, number> = {}) => {
    let s!: Entity
    eng.author(() => {
      s = w.create(type, { on: 'tile', map: 'ford', x: 16, y: 18 }, { props: { hp: 1, ...props } })
      w.place(p, { on: 'tile', map: 'ford', x: 16, y: 17 })
      p.facing = 'down'
    })
    eng.setCooldown('atk:player', 0)
    const plan = eng.controls.plan('use', { x: 16, y: 18 }, 0)
    if (!plan) throw new Error('no blow')
    w.fx = []
    eng.controls.run(plan, true)
    expect(w.get(s.id)).toBeUndefined()
    // the blow's swing says whose it is: drawn wielding it where they are drawn, even having stepped on since
    expect(w.fx.some((x) => x.t === 'vfx' && x.fx.startsWith('swing:') && x.who === p.id)).toBe(true)
  }
  const bag = (type: string) => Object.values(w.state.entities).filter((e) => e.type === type && e.place.on === 'inside' && e.place.holder === p.id)
  return { eng, w, p, fell, bag }
}

describe('monster trophies', () => {
  // (the sins are bosses of their own: what they leave is a profession's legendary arms, bosses.ts)
  it('every kind of hostile monster has its own piece, one each, a wearable of a family set', () => {
    const kinds = Object.keys(onto.types).filter((t) => t.startsWith('actor/creature/') && !t.startsWith('actor/creature/animal') && !t.startsWith('actor/creature/sin/') && Object.keys(onto.types).every((u) => !u.startsWith(t + '/')))
    expect(kinds.filter((k) => !TROPHY_OF[k])).toEqual([])
    expect(new Set(TROPHIES.map((t) => t.type)).size).toBe(TROPHIES.length)
    for (const t of TROPHIES) {
      expect(onto.types[t.kind].props).toMatchObject({ trophy: t.type, trophyChance: t.chance })
      expect(onto.types[t.type].tags).toContain('wearable')
      if (t.set) expect(TROPHY_SETS.some((s) => s.id === t.set)).toBe(true)
    }
  })

  it('a felling gives it by its chance; without it, the fiftieth of a kind gives it surely, and the count starts again', () => {
    const { w, p, fell, bag } = game()
    const ring = TROPHY_OF['actor/creature/slime/green_slime'].type
    for (let i = 1; i < 50; i++) fell('actor/creature/slime/green_slime', { trophyChance: 0 })
    expect(bag(ring)).toHaveLength(0)
    expect(w.prop(p, `trophy.${ring}`)).toBe(49)
    fell('actor/creature/slime/green_slime', { trophyChance: 0 })
    expect(bag(ring)).toHaveLength(1)
    expect(w.num(p, `trophy.${ring}`)).toBe(0)
    // a sure chance gives it at once; another kind keeps its own count
    fell('actor/creature/beast/wolf', { trophyChance: 1 })
    expect(bag(TROPHY_OF['actor/creature/beast/wolf'].type)).toHaveLength(1)
  })

  it('the piece found has its fixed main stats and four different rolled extras', () => {
    const { fell, bag } = game()
    fell('actor/creature/undead/skeleton', { trophyChance: 1 })
    const [it] = bag(TROPHY_OF['actor/creature/undead/skeleton'].type)
    const subs = Object.keys(it.props ?? {}).filter((k) => k.startsWith('sub:'))
    expect(subs).toHaveLength(4)
    expect(new Set(subs).size).toBe(4)
  })
})

describe('rolled extras', () => {
  it('a roll is four of the pool, each in its range on its step; a slot narrows the pool', () => {
    const rng = new Rng(3)
    for (let i = 0; i < 200; i++) {
      const slot = rng.pick(['head', 'feet', 'ring', 'weapon', 'hands'])
      const out = rollAffixes(onto, slot, () => rng.next())
      expect(Object.keys(out)).toHaveLength(4)
      for (const [k, v] of Object.entries(out)) {
        const a = AFFIX_TABLE.pool.find((x) => `sub:${x.key}` === k)!
        expect(!a.slots || a.slots.includes(slot)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(a.min - 1e-9)
        expect(v).toBeLessThanOrEqual(a.max + 1e-9)
      }
    }
  })

  it('gear laid on a map or forged rolls them; what is not gear does not', () => {
    const helm = makeItem(new Rng(5), FORM_BY_ID['item/armor/helmet'], { material: 'iron', quality: 'common' })
    expect(Object.keys(helm.props ?? {}).filter((k) => k.startsWith('sub:'))).toHaveLength(4)
    const bread = makeItem(new Rng(5), FORM_BY_ID['item/food/bread'])
    expect(Object.keys(bread.props ?? {}).some((k) => k.startsWith('sub:'))).toBe(false)
  })

  it('worn, the extras add to the wearer as the main stats do; the weapon in hand counts its own', () => {
    const { eng, w, p } = game()
    const def = w.stat(p, 'def')
    eng.author(() => w.create('item/armor/helmet', { on: 'inside', holder: p.id }, { id: 'h', props: { 'sub:def': 2, 'sub:critChance': 0.03 } }))
    eng.controls.sync(), eng.controls.wear('h'), eng.tick()
    expect(w.stat(p, 'def')).toBe(def + 1 + 2)
    const held = w.get(p.held)!
    const crit = w.stat(p, 'critChance') - w.num(held, 'sub:critChance')
    eng.author(() => w.setProp(held, 'sub:critChance', 0.04))
    expect(w.stat(p, 'critChance')).toBeCloseTo(crit + 0.04)
  })
})

describe('the families\' sets', () => {
  it('as in Dungeon Fighter, a family\'s set is armour (head, shoulders, body, hands, waist, feet) or trinkets (neck, ear, ring), a piece per slot; a few bosses\' pieces stand alone', () => {
    for (const s of TROPHY_SETS) {
      const slots = TROPHIES.filter((t) => t.set === s.id).map((t) => String(t.props.slot)).sort()
      expect([s.id, slots]).toEqual([s.id, slots.length === 6 ? ['body', 'feet', 'hands', 'head', 'shoulders', 'waist'] : ['ear', 'neck', 'ring']])
      expect(s.bonuses.at(-1)!.pieces).toBe(slots.length)
    }
    expect(TROPHIES.filter((t) => !t.set).map((t) => t.kind).sort()).toEqual(['actor/creature/golem/stone_golem', 'actor/creature/undead/warden'])
  })

  it('a set\'s ring worn on both hands counts once', () => {
    const { eng, w, p } = game()
    const ring = TROPHY_OF['actor/creature/imp/fire_imp'].type
    const cdr = w.stat(p, 'cdr')
    for (const id of ['r1', 'r2']) {
      eng.author(() => w.create(ring, { on: 'inside', holder: p.id }, { id }))
      eng.controls.sync(), eng.controls.wear(id), eng.tick()
    }
    expect([w.prop(p, 'wear:ring'), w.prop(p, 'wear:ring.2')]).toEqual(['r1', 'r2'])
    // two of one piece are not two pieces: the Court's first bonus (two) is not reached
    expect(w.stat(p, 'cdr')).toBeCloseTo(cdr)
    eng.author(() => w.create(TROPHY_OF['actor/creature/wisp/storm_wisp'].type, { on: 'inside', holder: p.id }, { id: 'e' }))
    eng.controls.sync(), eng.controls.wear('e'), eng.tick()
    expect(w.stat(p, 'cdr')).toBeCloseTo(cdr + 0.05 + 0.08)
  })

  it('two pieces of a family\'s armour worn give its first bonus; four its second', () => {
    const { eng, w, p } = game()
    const wildhunt = TROPHY_SETS.find((s) => s.id === 'wildhunt')!
    const pieces = TROPHIES.filter((t) => t.set === 'wildhunt' && t.type !== TROPHY_OF['actor/creature/beast/bat'].type)
    const crit = w.stat(p, 'critChance')
    const haste = w.stat(p, 'attackHaste')
    const wear = (type: string, id: string) => {
      eng.author(() => w.create(type, { on: 'inside', holder: p.id }, { id }))
      eng.controls.sync(), eng.controls.wear(id), eng.tick()
    }
    wear(pieces[0].type, 'a')
    wear(pieces[1].type, 'b')
    const own = (key: string, n: number) => pieces.slice(0, n).reduce((s, t) => s + Number(t.props[key] ?? 0), 0)
    expect(w.stat(p, 'attackHaste')).toBeCloseTo(haste + own('attackHaste', 2) + wildhunt.bonuses[0].props.attackHaste)
    wear(pieces[2].type, 'c')
    wear(pieces[3].type, 'd')
    expect(w.stat(p, 'critChance')).toBeCloseTo(crit + own('critChance', 4) + wildhunt.bonuses[1].props.critChance)
  })
})
