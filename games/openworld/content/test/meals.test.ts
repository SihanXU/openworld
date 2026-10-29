import { describe, expect, it } from 'vitest'
import { RuleLibrary, TICKS_PER_DAY, buildSandbox, type Engine, type ScenarioEntity, type ScheduleEntry } from '@openworld/engine'
import '@openworld/modules'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

// A household's meals (design.md §5.18, docs/npc-sandbox.md §2.11): a slot of one's day that tends hungry, eaten from
// the household's larder; the larder kept each morning, a morning missed had when it is next seen; a meal passed while
// nobody watched, had.

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
const grass = (w: number, h: number) => Array.from({ length: h }, () => Array(w).fill('grass'))

type Person = ScenarioEntity & { day?: Partial<ScheduleEntry>[] }

/** People with a round of their own on a meadow, the one at the keys out of the way. */
function town(people: Person[], things: ScenarioEntity[] = []): Engine {
  const eng = buildSandbox({ terrain: grass(10, 6), entities: [{ key: 'actor', type: 'actor/person/player', x: 9, y: 5 }, ...people, ...things], event: {} }, onto, lib())
  eng.author(() => {
    for (const p of people) {
      const e = eng.world.get(p.key)!
      const day = p.day ?? [{ from: 0, to: 24 }]
      e.npc = { role: 'villager', schedule: day.map((s) => ({ from: 0, to: 24, map: 'sandbox', x: p.x, y: p.y, activity: 'stand', ...s })) }
    }
  })
  return eng
}
const MEAL_ALL_DAY: Partial<ScheduleEntry>[] = [{ from: 0, to: 24, activity: 'eat', tends: ['hungry'] }]
const run = (eng: Engine, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    eng.tick()
    if (until?.()) return true
  }
  return false
}

describe('a meal', () => {
  it('in a slot that tends hungry one eats from one\'s household\'s larder before one is hungry; another\'s larder is left alone', () => {
    const eng = town(
      [
        { key: 'nell', type: 'actor/person/villager', x: 2, y: 2, props: { household: 'mill', hunger: 14 }, day: MEAL_ALL_DAY },
        { key: 'ivo', type: 'actor/person/villager', x: 7, y: 2, props: { household: 'inn', hunger: 14 }, day: MEAL_ALL_DAY },
      ],
      [
        { key: 'larder', type: 'fixture/container/barrel', x: 2, y: 1, props: { owner: 'household:mill' } },
        { key: 'bread', type: 'item/food/bread', x: 2, y: 1, inside: 'larder' },
        { key: 'theirs', type: 'fixture/container/barrel', x: 6, y: 1, props: { owner: 'household:mill' } },
        { key: 'loaf', type: 'item/food/bread', x: 6, y: 1, inside: 'theirs' },
      ],
    )
    const w = eng.world
    expect(w.hasStatus({ e: 'nell' }, 'hungry')).toBe(false)
    expect(run(eng, 300, () => !w.get('bread'))).toBe(true)
    expect(w.num(w.get('nell')!, 'hunger')).toBeGreaterThanOrEqual(18)
    // (the inn's Ivo by the mill's barrel: it is not his to take)
    expect(w.get('loaf')?.place).toMatchObject({ on: 'inside', holder: 'theirs' })
    expect(w.num(w.get('ivo')!, 'hunger')).toBeLessThanOrEqual(14)
  })

  it('a full belly at a meal eats nothing, and a meal\'s want is never bought for', () => {
    const eng = town([{ key: 'nell', type: 'actor/person/villager', x: 2, y: 2, props: { household: 'mill', hunger: 19 }, day: MEAL_ALL_DAY }], [
      { key: 'larder', type: 'fixture/container/barrel', x: 2, y: 1, props: { owner: 'household:mill' } },
      { key: 'bread', type: 'item/food/bread', x: 2, y: 1, inside: 'larder' },
    ])
    run(eng, 200)
    expect(eng.world.get('bread')?.place).toMatchObject({ on: 'inside', holder: 'larder' })
    expect(eng.wellbeing.troubles(eng.world.get('nell')!).some((t) => t.tended)).toBe(false)
  })
})

describe('a larder', () => {
  it('is kept each morning as its stock says; a morning it was not seen at is had when it is seen again', () => {
    const eng = town([], [{ key: 'larder', type: 'fixture/container/barrel', x: 2, y: 1, tags: ['larder'], props: { owner: 'household:mill', stock: 'item/food/bread*3' } }])
    const w = eng.world
    const bread = () => (w.get('larder')!.contents ?? []).filter((id) => w.get(id)?.type === 'item/food/bread').length
    run(eng, 5)
    expect(bread()).toBe(0)
    // the clock jumps past six o'clock without ever standing on it (away, or a sleep): the morning still comes
    eng.author(() => (w.state.tick += TICKS_PER_DAY + 37))
    run(eng, 3)
    expect(bread()).toBe(3)
  })
})

describe('a meal had while nobody watched', () => {
  it('back past a slot of one\'s day that tends hungry, one had it: fed, the time away running from it; one with no meal goes hungry', () => {
    const eng = town([
      { key: 'nell', type: 'actor/person/villager', x: 2, y: 2, props: { household: 'mill', hunger: 13 }, day: [{ from: 0, to: 12 }, { from: 12, to: 13, activity: 'eat', tends: ['hungry'] }, { from: 13, to: 24 }] },
      { key: 'ivo', type: 'actor/person/villager', x: 6, y: 2, props: { hunger: 13 } },
    ])
    const w = eng.world
    run(eng, 5)
    // a day gone by unseen (six o'clock to six o'clock, past noon)
    eng.author(() => (w.state.tick += TICKS_PER_DAY))
    run(eng, 1)
    expect(w.num(w.get('nell')!, 'hunger')).toBeGreaterThanOrEqual(19)
    expect(w.num(w.get('ivo')!, 'hunger')).toBeLessThanOrEqual(12)
  })
})
