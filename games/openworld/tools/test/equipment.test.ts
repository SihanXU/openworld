import { describe, expect, it } from 'vitest'
import { Game, Rng, RuleLibrary, combatDamage, combatStrike, finishCombatStrike, snapshot, tickAt } from '@openworld/engine'
import { BASE_RULES, FORM_BY_ID, RELICS, STORY_RULES, VOW_TRAITS, buildOntology, decodeChunk, makeItem } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// The body's ten slots (world-model.md §6.8): head, body, feet, hands, waist, shoulders, neck, two rings,
// ear — and the off hand. Each wearable names its slot; a ring goes on the first free of two; what is
// worn adds its props to the wearer's; offered again, it comes off.

function game() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  const eng = g.engine, w = eng.world, p = w.player
  const give = (type: string, id: string) => eng.author(() => w.create(type, { on: 'inside', holder: p.id }, { id, tags: type.includes('ring') || type.includes('amulet') || type.includes('earring') ? ['silver'] : [] }))
  const wear = (id: string) => (eng.controls.sync(), eng.controls.wear(id), eng.tick())
  return { eng, w, p, give, wear }
}

describe('the body\'s ten slots', () => {
  it('each wearable goes to its own slot, shown in the frame by slot', () => {
    const { eng, w, p, give, wear } = game()
    const pieces: [string, string][] = [
      ['item/armor/helmet', 'head'], ['item/armor/breastplate', 'body'], ['item/clothing/boots', 'feet'], ['item/clothing/gloves', 'hands'],
      ['item/clothing/belt', 'waist'], ['item/armor/pauldrons', 'shoulders'], ['item/valuable/amulet', 'neck'], ['item/valuable/earring', 'ear'],
    ]
    for (const [type, slot] of pieces) {
      give(type, `t.${slot}`)
      wear(`t.${slot}`)
      expect([type, w.prop(p, `wear:${slot}`)]).toEqual([type, `t.${slot}`])
    }
    const worn = snapshot(eng).player.worn
    expect(Object.keys(worn).sort()).toEqual(pieces.map(([, s]) => s).sort())
    expect(worn.head.type).toBe('item/armor/helmet')
  })

  it('from the bag, a stack of two rings puts on the second when the first is already worn (never takes it off)', () => {
    const { eng, w, p, give } = game()
    give('item/valuable/ring', 's1')
    give('item/valuable/ring', 's2')
    eng.controls.sync()
    eng.controls.wear('s1', true)
    eng.tick()
    eng.controls.wear('s1', true)
    eng.tick()
    expect([w.prop(p, 'wear:ring'), w.prop(p, 'wear:ring.2')].sort()).toEqual(['s1', 's2'])
    // and a third press from the bag, all worn: nothing comes off
    eng.controls.wear('s1', true)
    eng.tick()
    expect([w.prop(p, 'wear:ring'), w.prop(p, 'wear:ring.2')].sort()).toEqual(['s1', 's2'])
  })

  it('two rings fill both ring slots; a third takes the first one\'s place; what is worn adds to the wearer; offered again it comes off', () => {
    const { w, p, give, wear } = game()
    const atk = w.stat(p, 'atk'), def = w.stat(p, 'def')
    for (const id of ['r1', 'r2', 'r3']) give('item/valuable/ring', id)
    wear('r1')
    wear('r2')
    expect([w.prop(p, 'wear:ring'), w.prop(p, 'wear:ring.2')]).toEqual(['r1', 'r2'])
    expect(w.stat(p, 'atk')).toBe(atk + 2)
    wear('r3')
    expect([w.prop(p, 'wear:ring'), w.prop(p, 'wear:ring.2')]).toEqual(['r3', 'r2'])
    give('item/valuable/amulet', 'a1')
    wear('a1')
    expect(w.stat(p, 'def')).toBe(def + 1)
    // offered again: it comes off, and the slot is free for the next
    wear('r2')
    expect(w.prop(p, 'wear:ring.2')).toBeUndefined()
    expect(w.stat(p, 'atk')).toBe(atk + 1)
    wear('r1')
    expect([w.prop(p, 'wear:ring'), w.prop(p, 'wear:ring.2')]).toEqual(['r3', 'r1'])
  })
})

describe('Vowbound traits and Stigmatic powers', () => {
  const setup = () => {
    const g = game()
    const { eng, w, p } = g
    const foe = eng.author(() => w.create('actor/creature/beast/wolf', { on: 'tile', map: w.posOf(p)!.map, x: w.posOf(p)!.x + 1, y: w.posOf(p)!.y }, { id: 'foe', props: { hp: 999, maxHp: 999 } }))
    return { ...g, foe }
  }

  it('every Stigmatic piece has its own power, and no power is shared', () => {
    const relics = Object.values(FORM_BY_ID).filter((f) => f.tags?.includes('quality:legendary')).map((f) => f.props?.relic)
    expect(relics.every((r) => typeof r === 'string' && RELICS[r as string])).toBe(true)
    expect(new Set(relics).size).toBe(relics.length)
    // a rolled Vowbound piece keeps a trait of its vow
    const ring = makeItem(new Rng(7), FORM_BY_ID['item/valuable/ring'], { quality: 'vowed', material: 'silver' })
    expect(VOW_TRAITS.some((t) => Object.keys(t).every((k) => ring.props?.[k] === t[k]))).toBe(true)
  })

  it('the Crown of Thorns makes the struck kneel, now and then', () => {
    const { w, p, foe, give, wear } = setup()
    give('item/relic/crown_of_thorns', 'crown')
    wear('crown')
    const afflicted = Array.from({ length: 60 }, () => combatStrike(w, p, foe, 3, 1, undefined, true).afflict?.status)
    expect(afflicted).toContain('knelt')
    expect(afflicted).toContain(undefined)
  })

  it('Starfall: every fifth hit is a critical', () => {
    const { eng, w, p, foe, give } = setup()
    give('item/weapon/ranged/bow/starfall', 'bow')
    eng.controls.sync()
    eng.author(() => ((p.held = 'bow'), w.place(w.get('bow')!, { on: 'hand', holder: p.id })))
    const crits: boolean[] = []
    for (let i = 0; i < 10; i++) {
      const s = combatStrike(w, p, foe, 3, 5, w.get('bow'), true)
      crits.push(s.critical)
      // the blow landed: the foe is a little lower than before it
      ;(foe.props ??= {}).hp = 998
      finishCombatStrike(w, p, foe, s, 999, 5, true)
    }
    expect([crits[4], crits[9]]).toEqual([true, true])
  })

  it('worn traits: standing one\'s ground takes less; a vigil\'s belt guards only at night; the Unfallen Wall turns a felling blow once a minute', () => {
    const { eng, w, p, foe, give, wear } = setup()
    give('item/armor/pauldrons', 'odo')
    eng.author(() => ((w.get('odo')!.props ??= {}).holdFast = 0.25))
    wear('odo')
    ;(p.combat ??= {}).lastMoveTick = -100
    expect(combatDamage(eng, p, 8, foe, false)).toBe(6)
    give('item/clothing/belt', 'tomas')
    eng.author(() => ((w.get('tomas')!.props ??= {})['night:def'] = 2))
    wear('tomas')
    const day = w.stat(p, 'def')
    w.state.tick = tickAt(w.calendar().day, 23)
    expect(w.stat(p, 'def')).toBe(day + 2)
    give('item/armor/shield/unfallen', 'wall')
    eng.author(() => (p.props!.profession = 'warrior'))
    wear('wall')
    eng.author(() => (p.props!.hp = 5))
    expect(combatDamage(eng, p, 50, foe, false)).toBe(0)
    expect(combatDamage(eng, p, 50, foe, false)).toBeGreaterThan(0)
  })
})
