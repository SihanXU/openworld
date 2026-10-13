import { describe, expect, it } from 'vitest'
import { Game, Rng, RuleLibrary, snapshot, tickAt } from '@openworld/engine'
import { combatDamage, combatDelay, combatStrike, finishCombatStrike, vowsOf } from '@openworld/modules'
import { BASE_RULES, FORM_BY_ID, RELICS, STORY_RULES, VOWS, VOW_IDS, buildOntology, decodeChunk, makeItem } from '@openworld-game/content'
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
    // a rolled Vowbound piece takes a vow, and rolls its five extras like any piece; the one named is kept
    const ring = makeItem(new Rng(7), FORM_BY_ID['item/valuable/ring'], { quality: 'vowed', material: 'silver' })
    expect(VOW_IDS).toContain(ring.props?.vow)
    expect(Object.keys(ring.props ?? {}).filter((k) => k.startsWith('sub:'))).toHaveLength(5)
    expect(makeItem(new Rng(7), FORM_BY_ID['item/valuable/ring'], { quality: 'vowed', vow: 'mercy' }).props?.vow).toBe('mercy')
    // the scallop's is its form's; every vow has a name and a telling
    expect(makeItem(new Rng(7), FORM_BY_ID['item/valuable/scallop']).props?.vow).toBeUndefined()
    expect(FORM_BY_ID['item/valuable/scallop'].props?.vow).toBe('pilgrim')
    for (const v of Object.values(VOWS)) expect([v.en, v.zh, v.text.en, v.text.zh].every((x) => x.length > 0)).toBe(true)
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

// The vows (content items.ts VOWS; classes combat.ts `vowsOf`): what a Vowbound piece keeps of the vow it was made
// under — each a condition and what it pays, answered as a talent is, wherever the piece is worn or held.
describe('the vows of the Vowbound', () => {
  const sworn = (vow: string, type = 'item/armor/pauldrons') => {
    const g = game()
    const { eng, w, p } = g
    const foe = eng.author(() => w.create('actor/creature/beast/wolf', { on: 'tile', map: w.posOf(p)!.map, x: w.posOf(p)!.x + 1, y: w.posOf(p)!.y }, { id: 'foe', props: { hp: 999, maxHp: 999 } }))
    eng.author(() => w.create(type, { on: 'inside', holder: p.id }, { id: 'sworn', tags: ['quality:vowed'], props: { vow } }))
    g.wear('sworn')
    expect([...vowsOf(w, p)]).toEqual([vow])
    return { ...g, foe }
  }
  const noon = (w: ReturnType<typeof game>['w']) => (w.state.tick = tickAt(w.calendar().day, 12))
  const midnight = (w: ReturnType<typeof game>['w']) => (w.state.tick = tickAt(w.calendar().day, 23))

  it('the Hunt: a blow on an unhurt foe falls true', () => {
    const { w, p, foe } = sworn('hunt')
    expect(combatStrike(w, p, foe, 3, 1, undefined, true).critical).toBe(true)
    ;(foe.props ??= {}).hp = 998
    expect(Array.from({ length: 20 }, () => combatStrike(w, p, foe, 3, 1, undefined, true).critical)).toContain(false)
  })

  it('the Held Ground: from where one stands, a quarter more given and three tenths less taken; a step ends it', () => {
    const { eng, w, p, foe } = sworn('holdfast')
    expect([12.5, 18.75]).toContain(combatStrike(w, p, foe, 10, 1, undefined, true).power)
    expect(combatDamage(eng, p, 10, foe, false)).toBe(7)
    ;(p.combat ??= {}).lastMoveTick = w.state.tick
    expect([10, 15]).toContain(combatStrike(w, p, foe, 10, 1, undefined, true).power)
    expect(combatDamage(eng, p, 10, foe, false)).toBe(10)
  })

  it("the Shield: a fight's first blow is turned half aside, the next not", () => {
    const { eng, p, foe } = sworn('ward')
    expect(combatDamage(eng, p, 10, foe, false)).toBe(5)
    expect(combatDamage(eng, p, 10, foe, false)).toBe(10)
  })

  it('Mercy draws back from a foe near its end; Dawn from every blow by day, and takes a tenth less — not at night', () => {
    const m = sworn('mercy')
    noon(m.w)
    expect(combatStrike(m.w, m.p, m.foe, 3, 1, undefined, true).drain).toBe(0)
    ;(m.foe.props ??= {}).hp = 200
    expect(combatStrike(m.w, m.p, m.foe, 3, 1, undefined, true).drain).toBe(2)
    const d = sworn('dawn')
    noon(d.w)
    expect(combatStrike(d.w, d.p, d.foe, 3, 1, undefined, true).drain).toBe(1)
    expect(combatDamage(d.eng, d.p, 10, d.foe, false)).toBe(9)
    midnight(d.w)
    expect(combatStrike(d.w, d.p, d.foe, 3, 1, undefined, true).drain).toBe(0)
    expect(combatDamage(d.eng, d.p, 10, d.foe, false)).toBe(10)
  })

  it('Vigil: at night the blow finds its mark more often and the stride quickens', () => {
    const { w, p, foe } = sworn('vigil')
    midnight(w)
    expect(Array.from({ length: 60 }, () => combatStrike(w, p, foe, 3, 1, undefined, true).critical)).toContain(true)
    const night = combatDelay(w, p, 20, 'move')
    noon(w)
    expect(combatDelay(w, p, 20, 'move')).toBeGreaterThan(night)
  })

  it('Silence: sneaking slows its keeper no more, and the blow struck from it finds its mark', () => {
    const { eng, w, p, foe } = sworn('silence')
    eng.author(() => eng.applyStatus({ e: p.id }, 'sneaking', 1000))
    expect(w.hasStatus({ e: p.id }, 'sneaking')).toBe(true)
    expect(combatDelay(w, p, 10, 'move')).toBe(10)
    expect(Array.from({ length: 60 }, () => combatStrike(w, p, foe, 3, 1, undefined, true).critical)).toContain(true)
    const plain = game()
    plain.eng.author(() => plain.eng.applyStatus({ e: plain.p.id }, 'sneaking', 1000))
    expect(combatDelay(plain.w, plain.p, 10, 'move')).toBe(16)
  })

  it('the Road: a road under one\'s feet quickens the stride; on the move, blows are slipped more', () => {
    const { eng, w, p, foe } = sworn('pilgrim')
    let road: [number, number] | undefined
    for (let y = 0; y < 80 && !road; y++) for (let x = 0; x < 80 && !road; x++) if (w.onto.terrain(w.terrainAt('ford', x, y))?.tags?.includes('road')) road = [x, y]
    expect(road).toBeDefined()
    const off = combatDelay(w, p, 20, 'move')
    eng.author(() => eng.teleport(p, { map: 'ford', x: road![0], y: road![1] }))
    expect(combatDelay(w, p, 20, 'move')).toBeLessThan(off)
    // on the move: a tenth more dodge (none before)
    ;(p.combat ??= {}).lastMoveTick = w.state.tick
    expect(Array.from({ length: 80 }, () => combatDamage(eng, p, 10, foe, false))).toContain(0)
  })

  it('the Lone Road: with no companion by, blows deal more and are slipped more; a companion ends it', () => {
    const { eng, w, p, foe } = sworn('lone')
    const at = w.posOf(p)!
    // (the Ford's companion follows from the start: sent away first)
    const followers = w.entitiesOnMap(at.map).filter((c) => c.props?.companion === p.id)
    expect(followers.length).toBeGreaterThan(0)
    eng.author(() => { for (const c of followers) w.destroy(c) })
    expect([11.5, 17.25]).toContain(combatStrike(w, p, foe, 10, 1, undefined, true).power)
    eng.author(() => w.create('actor/creature/beast/wolf', { on: 'tile', map: at.map, x: at.x - 1, y: at.y }, { props: { companion: p.id } }))
    expect([10, 15]).toContain(combatStrike(w, p, foe, 10, 1, undefined, true).power)
  })

  it('the Thorn: whoever strikes its keeper hand to hand is pricked, and a prick is not answered with a prick', () => {
    const { eng, w, p, foe } = sworn('thorn')
    const before = w.num(p, 'hp')
    eng.damage(p, 5, undefined, false, { e: foe.id })
    expect(w.num(p, 'hp')).toBeLessThan(before)
    expect(w.num(foe, 'hp')).toBeLessThan(999)
    // a foe out of reach is not pricked
    eng.author(() => w.setProp(foe, 'hp', 999))
    eng.author(() => eng.teleport(foe, { map: w.posOf(p)!.map, x: w.posOf(p)!.x + 4, y: w.posOf(p)!.y }))
    eng.damage(p, 5, undefined, false, { e: foe.id })
    expect(w.num(foe, 'hp')).toBe(999)
  })
})
