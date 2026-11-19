// A map's minor monsters are of the map's level, those placed on it and those that come by themselves alike.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, appear, type AppearDef } from '@openworld/engine'
import { BASE_RULES, CREATURE_ROLES, NIGHT_WALKERS, ROLES, STORY_RULES, buildOntology, creatureStats, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const LATE = ['redmarch', 'tithe', 'palefen', 'altar', 'holy']
const STATS = ['level', 'hp', 'maxHp', 'atk', 'def'] as const

const onto = buildOntology()
const { index, chunks } = buildFord()
const maps = chunks.filter((c) => !c.map.backdrop)
const levelled = maps.filter((c) => c.map.levelled)
const walkedAt = (m: (typeof maps)[number]['map']) => (m.zone ?? 'combat') === 'combat' && (m.light ?? 'outdoor') === 'outdoor'
const numbers = (props: Record<string, unknown> = {}) => Object.fromEntries(STATS.map((k) => [k, props[k]]))

describe('a map\'s monsters are of its level', () => {
  it('the late chapters\' open combat maps all have a level', () => {
    const late = maps.filter((c) => LATE.includes(c.map.region ?? '') && walkedAt(c.map))
    expect(late.length).toBeGreaterThan(0)
    expect(late.filter((c) => !c.map.levelled).map((c) => c.map.id)).toEqual([])
  })

  it('what stands on such a map is at that level, and no bare family stands there', () => {
    for (const { map, entities } of levelled) {
      const level = Object.values(map.levelled!)[0].level
      for (const e of entities.filter((x) => x.type.startsWith('actor/creature/') && x.ai)) {
        expect(e.type, map.id).not.toBe('actor/creature/wisp')
        if (CREATURE_ROLES[e.type]) expect(e.props?.level, `${map.id}: ${e.type}`).toBe(level)
      }
    }
  })

  it('what comes by itself is at that level too', () => {
    for (const { map } of levelled) {
      const comes = [...(map.appear ?? []).flatMap((a: AppearDef) => Object.keys(a.types)), ...Object.keys(NIGHT_WALKERS)].filter((t) => CREATURE_ROLES[t])
      for (const type of comes) expect(map.levelled![type], `${map.id}: ${type}`).toEqual(creatureStats(Number(map.levelled![type]?.level), ROLES[CREATURE_ROLES[type]]))
    }
  })

  it('one that appears in play has the numbers of one placed there', () => {
    const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) g.loadChunk(decodeChunk(c))
    const eng = g.engine
    const w = eng.world
    const map = w.map('causeway')!
    const zombie = 'actor/creature/undead/zombie'
    eng.author(() => {
      w.place(w.player, { on: 'tile', map: 'causeway', x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) })
      for (const e of w.ofType(zombie)) w.destroy(e)
    })
    eng.author(() => appear(eng, { types: { [zombie]: 1 }, max: 1, every: 1 }))
    const [made] = w.ofType(zombie)
    expect(numbers(made.props)).toEqual(numbers(map.levelled![zombie]))
    expect(made.props!.maxHp).toBeGreaterThan(Number(onto.types[zombie].props?.maxHp))
  })
})
