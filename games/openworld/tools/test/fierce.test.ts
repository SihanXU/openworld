// Now and then a minor monster comes fierce: thrice the health (and so the experience), half again the attack, thrice the
// chance of its piece, under a name of its own; about one in twelve of those placed, and any that comes by itself may be.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, appear, type AppearDef } from '@openworld/engine'
import { BASE_RULES, CREATURE_ROLES, FIERCE, ROLES, STORY_RULES, buildOntology, creatureStats, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const { index, chunks } = buildFord()
const maps = chunks.filter((c) => !c.map.backdrop)
const minor = (type: string) => !!CREATURE_ROLES[type] && CREATURE_ROLES[type] !== 'elite'
const onto = buildOntology()

describe('fierce monsters', () => {
  it('about one in twelve placed minor monsters is fierce, by its kind\'s numbers', () => {
    let all = 0
    let fierce = 0
    for (const { map, entities } of maps)
      for (const e of entities) {
        if (!CREATURE_ROLES[e.type] || e.place.on !== 'tile') continue
        const is = e.statuses?.fierce !== undefined
        if (!is) continue
        expect(minor(e.type), e.type).toBe(true)
        const k = { ...onto.types[e.type].props, ...creatureStats(Number(e.props?.level ?? onto.types[e.type].props?.level), ROLES[CREATURE_ROLES[e.type]]) } as Record<string, number>
        expect(e.props?.maxHp, `${map.id}: ${e.type}`).toBe(Math.round(k.maxHp * 3))
        expect(e.props?.atk).toBe(Math.round(k.atk * 1.5))
        expect(e.props?.trophyChance).toBeCloseTo(k.trophyChance * 3)
        expect(e.name).toEqual({ en: expect.stringMatching(/^fierce /), zh: expect.stringMatching(/^凶悍的/) })
        fierce++
      }
    for (const { entities } of maps) all += entities.filter((e) => minor(e.type) && e.place.on === 'tile').length
    expect(fierce / all).toBeGreaterThan(0.04)
    expect(fierce / all).toBeLessThan(0.14)
  })

  it('every minor monster that comes by itself may come fierce, the night\'s walkers too', () => {
    for (const { map } of maps)
      for (const a of map.appear ?? []) if (Object.keys(a.types).every(minor)) expect(a.rare, map.id).toEqual(FIERCE)
    expect(onto.appear!.find((a) => a.tag === 'nightborn')!.rare).toEqual(FIERCE)
    for (const { map } of maps) for (const a of map.appear ?? []) if (!Object.keys(a.types).some((t) => CREATURE_ROLES[t])) expect(a.rare).toBeUndefined()
  })

  it('one that comes fierce has its numbers raised, its name and the status; by chance nought none does', () => {
    const g = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) g.loadChunk(decodeChunk(c))
    const eng = g.engine
    const w = eng.world
    const wolf = 'actor/creature/beast/wolf'
    const map = w.map(eng.activeMap)!
    const def = (chance: number): AppearDef => ({ types: { [wolf]: 1 }, max: 1, every: 30, rare: { ...FIERCE, chance } })
    const wolves = () => w.ofType(wolf).filter((e) => w.posOf(e)?.map === map.id)
    const clear = () => eng.author(() => wolves().forEach((e) => w.destroy(e)))
    clear()
    eng.author(() => appear(eng, def(1)))
    const [f] = wolves()
    const base = { ...w.onto.resolve(wolf).props, ...map.levelled?.[wolf] } as Record<string, number>
    expect(f.statuses?.fierce).toBeDefined()
    expect(w.num(f, 'maxHp')).toBe(Math.round(base.maxHp * 3))
    expect(w.num(f, 'hp')).toBe(Math.round(base.hp * 3))
    expect(w.num(f, 'atk')).toBe(Math.round(base.atk * 1.5))
    expect(w.num(f, 'trophyChance')).toBeCloseTo(base.trophyChance * 3)
    expect(eng.nameOf({ e: f.id })).toBe('fierce wolf')
    expect(eng.nameOf({ e: f.id }, 'zh')).toBe('凶悍的狼')
    clear()
    eng.author(() => appear(eng, def(0)))
    const [plain] = wolves()
    expect(plain.statuses?.fierce).toBeUndefined()
    expect(w.num(plain, 'maxHp')).toBe(base.maxHp)
    expect(plain.name).toBeUndefined()
  })
})
