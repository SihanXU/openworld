import { describe, expect, it } from 'vitest'
import { Game, Rng, RuleLibrary, gearProps, levelFactor, rollAffixes, tickAt, type Entity } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, FORMS, FORM_BY_ID, GEAR_LAYOUT, GEAR_LEVELS, MATERIAL_DEFS, NAMED_VOWS, QUALITIES, QUALITY_DEFS, QUESTS, RECIPE_BY_ID, STORY_RULES, TROPHIES, VOWS_LAYOUT, VOW_IDS, buildOntology, decodeChunk, makeItem, migrateGear, migrateVows } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// Gear's levels (world-model.md §6.8, content gear.ts): every piece worn or wielded has a level, 1 to 20; its main stats
// grow with it and with its quality, so that at one level the finer piece is the better and at one quality the higher,
// never the other way about. A finer piece also rolls more extras, a higher one wider ones. The level comes from where
// the piece comes from: the maker's for what is forged, the merchant's for what is stocked, the map's for what is laid,
// the kind's for a monster's own piece, the author's for a quest's gear; a Seal-bearer's arms are far above the Ford's.

const onto = buildOntology()
const ORDER = ['crude', 'common', 'fine', 'masterwork', 'vowed', 'legendary']
const MAIN = ['power', 'def', 'atk'] as const
const SHARES = ['critChance', 'critDamage', 'dodge', 'cdr', 'xpRate', 'luck', 'moveHaste', 'attackHaste', 'block'] as const
const gearForms = FORMS.filter((f) => (typeof f.props?.slot === 'string' || f.id.startsWith('item/weapon')) && !f.tags?.includes('quality:legendary') && MAIN.some((k) => typeof f.props?.[k] === 'number'))
const q = (id: string) => QUALITY_DEFS().find((x) => x.id === id)
const sum = (p: Record<string, number>, keys: readonly string[]) => keys.reduce((n, k) => n + (p[k] ?? 0), 0)
const COUNT: Record<string, number> = GEAR_LEVELS.affixCount ?? {}

function fresh() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = undefined
  const eng = g.engine, w = eng.world, p = w.player
  eng.author(() => {
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    eng.quests.put('descent', 'done')
  })
  w.state.tick = tickAt(1, 12)
  return { g, eng, w, p }
}

describe('a piece of gear at one level', () => {
  it('is the better the finer it is: its main stats never less, its extras more, for every form and material', () => {
    expect(gearForms.length).toBeGreaterThan(20)
    for (const f of gearForms)
      for (const mat of [undefined, ...(f.materials ?? [])])
        for (const level of [1, 5, 10, 20])
          for (let i = 1; i < ORDER.length; i++) {
            const a = gearProps(f.props!, mat ? MATERIAL_DEFS[mat] : undefined, q(ORDER[i - 1]), level, GEAR_LEVELS)
            const b = gearProps(f.props!, mat ? MATERIAL_DEFS[mat] : undefined, q(ORDER[i]), level, GEAR_LEVELS)
            const where = `${f.id} ${mat ?? '-'} L${level} ${ORDER[i - 1]}→${ORDER[i]}`
            expect([where, sum(b, MAIN) >= sum(a, MAIN) && sum(b, SHARES) >= sum(a, SHARES) - 1e-9]).toEqual([where, true])
            // and strictly better in one of: its main stats, how many extras it rolls, a trait of its own (Vowbound, Stigmatic)
            const more = sum(b, MAIN) > sum(a, MAIN) || COUNT[ORDER[i]] > COUNT[ORDER[i - 1]] || ORDER[i] === 'vowed' || ORDER[i] === 'legendary'
            expect([where, more]).toEqual([where, true])
          }
  })

  it('at one quality is the better the higher its level: never less from one level to the next, and more by the twentieth', () => {
    for (const f of gearForms)
      for (const quality of ORDER) {
        let last = gearProps(f.props!, undefined, q(quality), 1, GEAR_LEVELS)
        for (let level = 2; level <= GEAR_LEVELS.max; level++) {
          const now = gearProps(f.props!, undefined, q(quality), level, GEAR_LEVELS)
          expect([f.id, quality, level, sum(now, MAIN) >= sum(last, MAIN) && sum(now, SHARES) >= sum(last, SHARES) - 1e-9]).toEqual([f.id, quality, level, true])
          expect(now.level).toBe(level)
          last = now
        }
        const first = gearProps(f.props!, undefined, q(quality), 1, GEAR_LEVELS)
        expect([f.id, quality, sum(last, MAIN) > sum(first, MAIN)]).toEqual([f.id, quality, true])
      }
    // the curve: a quarter a level on the main stats, an eighth on the shares; kept within 1 … 20
    expect(levelFactor(GEAR_LEVELS, 5)).toBe(2)
    expect(levelFactor(GEAR_LEVELS, 5, true)).toBe(1.5)
    expect(levelFactor(GEAR_LEVELS, 99)).toBe(levelFactor(GEAR_LEVELS, 20))
    expect(levelFactor(GEAR_LEVELS, 0)).toBe(1)
    // an iron sword: 6 at the first level, common; 29 as a masterwork of the tenth (4 × 1.5 × 1.5 × 3.25)
    expect(gearProps(FORM_BY_ID['item/weapon/blade/sword'].props!, MATERIAL_DEFS.iron, q('common'), 1, GEAR_LEVELS).power).toBe(6)
    expect(gearProps(FORM_BY_ID['item/weapon/blade/sword'].props!, MATERIAL_DEFS.iron, q('masterwork'), 10, GEAR_LEVELS).power).toBe(29)
  })

  it('rolls its extras by its quality (two for crude … six for Stigmatic; the table\'s for a monster\'s piece), wider the higher its level', () => {
    const counts: Record<string, number> = {}
    for (const quality of ORDER) counts[quality] = Object.keys(rollAffixes(onto, 'head', new Rng(1).next.bind(new Rng(1)), { quality })).length
    expect(counts).toEqual({ crude: 2, common: 3, fine: 4, masterwork: 5, vowed: 5, legendary: 6 })
    expect(Object.keys(rollAffixes(onto, 'head', () => 0.5)).length).toBe(onto.affixes!.count)
    // at the first level a rolled defence reaches 3; at the twentieth, nearly three times that
    const top = (level: number) => {
      let best = 0
      const rng = new Rng(7)
      for (let i = 0; i < 400; i++) best = Math.max(best, rollAffixes(onto, 'body', () => rng.next(), { quality: 'legendary', level })['sub:def'] ?? 0)
      return best
    }
    expect(top(1)).toBe(3)
    expect(top(20)).toBeGreaterThanOrEqual(8)
    // a made piece carries its level and its quality's count
    const fine = makeItem(new Rng(3), FORM_BY_ID['item/armor/helmet'], { material: 'iron', quality: 'fine', level: 6 })
    expect(fine.props?.level).toBe(6)
    expect(Object.keys(fine.props ?? {}).filter((k) => k.startsWith('sub:'))).toHaveLength(4)
    // a bucket has no level
    expect(makeItem(new Rng(3), FORM_BY_ID['item/vessel/bucket/empty']).props?.level).toBeUndefined()
  })
})

describe('where a piece gets its level', () => {
  it('a monster\'s own piece: its kind\'s, 1 to 20, its main stats scaled to it (a set\'s as a fine piece, one alone as a masterwork)', () => {
    for (const t of TROPHIES) {
      expect([t.type, t.level >= 1 && t.level <= GEAR_LEVELS.max]).toEqual([t.type, true])
      expect(onto.types[t.type].props?.level).toBe(t.level)
    }
    const by = (kind: string) => TROPHIES.find((t) => t.kind === `actor/creature/${kind}`)!
    // the crab's plate (level 4) guards better than the slime's vest (level 1); the golem's, alone, better still
    expect(Number(by('crab').props.def)).toBeGreaterThan(Number(by('slime/green_slime').props.def))
    expect(Number(by('golem/stone_golem').props.def)).toBeGreaterThan(Number(by('crab').props.def))
    expect(by('slime/green_slime').props.def).toBe(3)
    expect(by('golem/stone_golem').props.def).toBe(Math.round(3 * 1.5 * levelFactor(GEAR_LEVELS, 6)))
  })

  it('a Seal-bearer\'s arms: the Stigmatic level, their family\'s base at the Stigmatic quality', () => {
    const sword = onto.types['item/weapon/blade/sword/oathbrand'].props!
    expect(sword.level).toBe(10)
    expect(sword.power).toBe(gearProps({ power: 4 }, undefined, q('legendary'), 10, GEAR_LEVELS).power)
    expect(onto.types['item/relic/crown_of_thorns'].props).toMatchObject({ level: 10, xpRate: -0.5 })
  })

  it('a quest\'s gear: the author\'s level, its form\'s main stats in its first material at its quality', () => {
    const items = QUESTS.flatMap((qd) => qd.stages.flatMap((s) => s.reward?.items ?? [])).filter((it) => typeof it.props?.slot === 'string')
    expect(items.length).toBeGreaterThan(15)
    for (const it of items) expect([it.type, typeof it.props?.level]).toEqual([it.type, 'number'])
    const hauberk = items.find((it) => JSON.stringify(it.name ?? '').includes('Rowan'))!
    expect(hauberk.props).toMatchObject({ level: 2, def: gearProps({ def: 3 }, MATERIAL_DEFS.iron, q('fine'), 2, GEAR_LEVELS).def })
    expect(hauberk.tags).toContain('material:iron')
  })

  it('what is forged: the maker\'s level, no lower than the recipe\'s; its quality by the maker\'s level against the recipe\'s', () => {
    const { eng, w, p } = fresh()
    const r = RECIPE_BY_ID['smith/sword-iron']
    eng.author(() => {
      w.setProp(p, 'level', 7)
      eng.teleport(p, { map: 'emberfall', x: 28, y: 9 })
      w.create('item/tool/smith_hammer', { on: 'inside', holder: p.id })
      for (const n of r.needs) for (let i = 0; i < n.count; i++) w.create(n.type, { on: 'inside', holder: p.id })
    })
    eng.controls.sync()
    expect(eng.controls.craft(r)).toBe(true)
    const sword = Object.values(w.state.entities).find((e) => e.type === 'item/weapon/blade/sword' && e.place.on === 'inside' && e.place.holder === p.id)!
    expect(sword.props?.level).toBe(7)
    // seven against the recipe's two: fine (three above; masterwork takes six); iron; the curve's 2.5 at the seventh level
    expect(sword.tags).toContain('quality:fine')
    expect(sword.props?.power).toBe(gearProps({ power: 4 }, MATERIAL_DEFS.iron, q('fine'), 7, GEAR_LEVELS).power)
    expect(Object.keys(sword.props ?? {}).filter((k) => k.startsWith('sub:'))).toHaveLength(4)
    // a first-level maker forges at the recipe's level
    eng.author(() => { w.setProp(p, 'level', 1); for (const n of r.needs) for (let i = 0; i < n.count; i++) w.create(n.type, { on: 'inside', holder: p.id }) })
    eng.controls.sync()
    expect(eng.controls.craft(r)).toBe(true)
    const plain = Object.values(w.state.entities).find((e) => e.type === 'item/weapon/blade/sword' && e.id !== sword.id && e.place.on === 'inside' && e.place.holder === p.id)!
    expect(plain.props?.level).toBe(r.level)
  })

  it('what a merchant stocks: the merchant\'s level (the smith of Emberfall\'s four), at the start and at each restock; and worth more for it', () => {
    const { eng, w, p } = fresh()
    const s = socialOf(eng)
    const garrick = w.get('npc.garrick')!
    const stocked = () => (garrick.contents ?? []).map((id) => w.get(id)!).filter((e) => e.type === 'item/armor/helmet')
    const [helm] = stocked()
    expect(helm.props).toMatchObject({ level: 4 })
    // sold out and restocked (the trade talk restocks first): the new one at his level too, its extras its own
    eng.author(() => w.destroy(helm))
    const at = w.posOf(garrick)!
    eng.author(() => eng.teleport(p, { map: at.map, x: at.x, y: at.y + 1 }))
    eng.controls.sync()
    eng.controls.talk(garrick.id, 'trade')
    eng.tick()
    const [again] = stocked()
    expect(again.props).toMatchObject({ level: 4, def: gearProps({ def: 1 }, undefined, undefined, 4, GEAR_LEVELS).def })
    expect(Object.keys(again.props ?? {}).filter((k) => k.startsWith('sub:'))).toHaveLength(onto.affixes!.count)
    // a higher piece is worth more
    const low = eng.author(() => w.create('item/armor/helmet', { on: 'inside', holder: p.id }, { props: { level: 1 } }))
    expect(s.value(again)).toBeGreaterThan(s.value(low))
  })

  it('what the map lays down: its level (deeper and further, higher), unless the piece says its own; an older save\'s pieces are stamped with the first', () => {
    const { g, eng, w, p } = fresh()
    const level = (id: string) => Number(w.get(id)!.props?.level)
    // Tobin's wand on the village cart: the Ford's first level; Odo's pauldrons in the ossuary: its third; Tomas's belt on the warden: the sanctum's fourth
    expect(level('tobin.wand')).toBe(1)
    const odo = Object.values(w.state.entities).find((e) => JSON.stringify(e.name ?? '').includes("Odo's"))!
    expect(odo.props).toMatchObject({ level: 3, def: gearProps({ def: 1 }, MATERIAL_DEFS.steel, q('vowed'), 3, GEAR_LEVELS).def })
    const belt = Object.values(w.state.entities).find((e) => JSON.stringify(e.name ?? '').includes("Tomas's"))!
    expect(belt.props).toMatchObject({ level: 4, 'night:def': 2 })
    // an older save: a piece without a level has the first; a monster's piece keeps its kind's
    const old: Entity = eng.author(() => w.create('item/armor/helmet', { on: 'inside', holder: p.id }, { props: { def: 1 } }))
    const trophy: Entity = eng.author(() => w.create(TROPHIES[0].type, { on: 'inside', holder: p.id }))
    eng.author(() => (w.setFact(GEAR_LAYOUT, false), migrateGear(g)))
    expect(old.props?.level).toBe(1)
    expect(trophy.props?.level).toBeUndefined()
    expect(w.num(trophy, 'level')).toBe(TROPHIES[0].level)
    expect(w.fact(GEAR_LAYOUT)).toBe(true)
    void QUALITIES
  })
})

// The Vowbound's vows (items.ts VOWS, world-model.md §6.8): a Vowbound piece carries one wherever it comes from, and
// rolls its extras like any piece — a named one too, so that it is never the lesser of a common piece.
describe('a Vowbound piece', () => {
  const subs = (p: Record<string, unknown> | undefined) => Object.keys(p ?? {}).filter((k) => k.startsWith('sub:'))
  const vowed = (e: Entity, w: ReturnType<typeof fresh>['w']) => [...(e.tags ?? []), ...w.onto.resolve(e.type).tags].includes('quality:vowed') && typeof w.prop(e, 'slot') === 'string'

  it('laid on the map: its vow (the story\'s own for the named, the scallop\'s its form\'s) and its five extras', () => {
    const { w } = fresh()
    const pieces = Object.values(w.state.entities).filter((e) => vowed(e, w))
    expect(pieces.length).toBeGreaterThanOrEqual(4)
    for (const e of pieces) {
      const en = typeof e.name === 'object' ? e.name.en : e.type
      expect([en, VOW_IDS.includes(String(w.prop(e, 'vow'))), subs(e.props).length]).toEqual([en, true, 5])
      if (typeof e.name === 'object' && NAMED_VOWS[e.name.en]) expect([en, w.prop(e, 'vow')]).toEqual([en, NAMED_VOWS[e.name.en]])
    }
    const scallop = pieces.find((e) => e.type === 'item/valuable/scallop')!
    expect([w.prop(scallop, 'vow'), scallop.props?.def]).toEqual(['pilgrim', gearProps({ def: 1 }, undefined, q('vowed'), w.num(scallop, 'level', 1), GEAR_LEVELS).def])
    expect(Object.keys(NAMED_VOWS).filter((n) => pieces.some((e) => typeof e.name === 'object' && e.name.en === n))).toHaveLength(3)
  })

  it('paid by a quest: the author\'s vow and its extras, seeded by its name; every quest\'s piece rolls its extras', () => {
    const items = QUESTS.flatMap((qd) => qd.stages.flatMap((s) => s.reward?.items ?? [])).filter((it) => typeof it.props?.slot === 'string')
    for (const it of items) expect([it.type, subs(it.props).length > 0]).toEqual([it.type, true])
    const helm = items.find((it) => JSON.stringify(it.name ?? '').includes("Fennick's"))!
    expect([helm.props?.vow, helm.props?.dodge, subs(helm.props).length]).toEqual(['ward', 0.1, 5])
    expect(items.find((it) => JSON.stringify(it.name ?? '').includes("Cassian's"))!.props?.vow).toBe('dawn')
    for (const [name, vow] of Object.entries(NAMED_VOWS)) {
      const it = items.find((x) => JSON.stringify(x.name ?? '').includes(name))
      if (it) expect([name, it.props?.vow]).toEqual([name, vow])
    }
  })

  it('forged (the Legendary Smith\'s chance): a vow of the quality\'s', () => {
    const { eng, w, p } = fresh()
    const r = RECIPE_BY_ID['smith/sword-iron']
    eng.author(() => {
      w.setProp(p, 'level', 7)
      w.setProp(p, `${r.station}:vowed`, 1)
      eng.teleport(p, { map: 'emberfall', x: 28, y: 9 })
      w.create('item/tool/smith_hammer', { on: 'inside', holder: p.id })
      for (const n of r.needs) for (let i = 0; i < n.count; i++) w.create(n.type, { on: 'inside', holder: p.id })
    })
    eng.controls.sync()
    expect(eng.controls.craft(r)).toBe(true)
    const sword = Object.values(w.state.entities).find((e) => e.type === 'item/weapon/blade/sword' && e.place.on === 'inside' && e.place.holder === p.id)!
    expect(sword.tags).toContain('quality:vowed')
    expect(VOW_IDS).toContain(sword.props?.vow)
    expect(subs(sword.props)).toHaveLength(5)
  })

  it('from an older save: takes its vow (the story\'s for the named), its numbers brought up to its tier\'s and never down, and the extras it never rolled', () => {
    const { g, eng, w, p } = fresh()
    const make = (type: string, extra: Partial<Entity>) => eng.author(() => w.create(type, { on: 'inside', holder: p.id }, extra))
    const odo = make('item/armor/pauldrons', { name: { en: "Brother Odo's Pauldrons", zh: '奥多修士的护肩' }, tags: ['quality:vowed', 'material:steel', 'metal'], props: { def: 2, level: 3 } })
    const rich = make('item/armor/pauldrons', { tags: ['quality:vowed', 'material:steel'], props: { def: 40, level: 3, 'sub:def': 1 } })
    const plain = make('item/armor/pauldrons', { tags: ['material:steel'], props: { def: 2, level: 3 } })
    eng.author(() => (w.setFact(VOWS_LAYOUT, false), migrateVows(g)))
    expect(odo.props).toMatchObject({ vow: 'holdfast', def: gearProps({ def: 1 }, MATERIAL_DEFS.steel, q('vowed'), 3, GEAR_LEVELS).def })
    expect(subs(odo.props)).toHaveLength(5)
    expect(VOW_IDS).toContain(rich.props?.vow)
    expect([rich.props?.def, subs(rich.props)]).toEqual([40, ['sub:def']])
    expect([plain.props?.vow, subs(plain.props)]).toEqual([undefined, []])
    expect(w.fact(VOWS_LAYOUT)).toBe(true)
  })
})
