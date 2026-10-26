import { describe, expect, it, vi } from 'vitest'
import { RuleLibrary, buildSandbox, snapshot, type Entity } from '@openworld/engine'
import { BASE_RULES, buildOntology, MAIN_QUESTS, SIDE_QUESTS } from '../src/index.ts'

function play() {
  return buildSandbox({
    terrain: Array.from({ length: 5 }, () => Array(5).fill('grass')),
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'person1', type: 'actor/person/player', x: 1, y: 1, tags: ['person'] },
      { key: 'person2', type: 'actor/person/player', x: 3, y: 3, tags: ['person'] },
    ],
    event: {},
  }, buildOntology(), new RuleLibrary(BASE_RULES))
}

const questDef = {
  id: 'qa', kind: 'side' as const, title: 'QA', summary: 'A test quest', stages: [{ n: 0 }], start: { manual: true as const },
  aliases: { target: { id: 'person1' } }, objectives: [{ id: 'talk', text: 'Speak to {target}', talk: true, target: 'target' }],
}

function addQuest(eng: ReturnType<typeof play>, state: 'active' | 'offered') {
  eng.author(() => eng.world.add({
    id: 'quest.qa', type: 'resident/quest', place: { on: 'resident' },
    props: { quest: 'qa', state, stage: 0, by: 'actor', 'alias.target': 'person1' },
  }))
}

describe('quest snapshot view', () => {
  it('views only eligible carried items once while snapshotting the real rescue and stew quests', () => {
    const eng = play()
    const rescue = MAIN_QUESTS.find((q) => q.id === 'rescue')!
    const stew = SIDE_QUESTS.find((q) => q.id === 'stew')!
    const carriedItems = {
      id: 'carried-items', kind: 'side' as const, title: 'Carried items', summary: 'A test quest', start: { manual: true as const },
      aliases: { unique: { id: 'alias.coin' } },
      objectives: [
        { id: 'seasoned', text: 'Seasoned meat', count: { carry: { type: 'item/food/meat/raw', tags: ['quality:prime'], notTags: ['spoiled'], status: ['fresh'], notStatus: ['rotten'], props: { food: { gte: 4 } } } }, need: 2 },
        { id: 'meat', text: 'Raw meat', count: { carry: { type: 'item/food/meat/raw' } }, need: 4 },
        { id: 'unique', text: 'The unique coin', count: { carry: 'unique' }, need: 2 },
      ],
      stages: [{ n: 10, show: ['seasoned', 'meat', 'unique'] }, { n: 20, on: { objectives: ['seasoned'] } }],
    }
    eng.quests.load([rescue, stew, carriedItems])

    const currencyIds = Array.from({ length: 1024 }, (_, i) => `currency.${i}`)
    const meatIds = ['meat.held', 'meat.bag', 'meat.spoiled']
    const eggIds = ['egg.first', 'egg.second']
    eng.author(() => {
      for (const id of currencyIds) eng.world.add({ id, type: 'item/misc/thornmark', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'alias.coin', type: 'item/misc/thornmark', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'decoy.coin', type: 'item/misc/thornmark', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'meat.held', type: 'item/food/meat/raw', place: { on: 'hand', holder: 'actor' }, tags: ['quality:prime'], statuses: { fresh: -1 }, props: { food: 4 } })
      eng.world.add({ id: 'meat.bag', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'meat.spoiled', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' }, tags: ['quality:prime', 'spoiled'], statuses: { rotten: -1 }, props: { food: 4 } })
      eng.world.add({ id: 'meat.frozen', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' }, frozenBy: 'pending' })
      for (const id of eggIds) eng.world.add({ id, type: 'item/food/egg/raw', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'egg.frozen', type: 'item/food/egg/raw', place: { on: 'inside', holder: 'actor' }, frozenBy: 'pending' })
      eng.quests.put('rescue', 10)
      eng.quests.put('stew', 10)
      eng.quests.put('carried-items', 10)
    })

    const worldView = vi.spyOn(eng.world, 'view')
    const first = snapshot(eng)
    const viewCount = (id: string, calls = worldView.mock.calls) => calls.filter(([ref]) => ref?.e === id).length
    const objective = (quest: string, id: string, frame = first) => frame.quests.journal.find((q) => q.quest === quest)?.objectives.find((o) => o.id === id)

    expect(first.quests.journal.map((q) => q.quest)).toEqual(expect.arrayContaining(['rescue', 'stew', 'carried-items']))
    expect(objective('stew', 'beef')).toMatchObject({ have: 3, need: 3, state: 'done' })
    expect(objective('stew', 'eggs')).toMatchObject({ have: 2, need: 2, state: 'done' })
    expect(objective('carried-items', 'seasoned')).toMatchObject({ have: 1, need: 2, state: 'open' })
    expect(objective('carried-items', 'meat')).toMatchObject({ have: 3, need: 4, state: 'open' })
    expect(objective('carried-items', 'unique')).toMatchObject({ have: 1, need: 2, state: 'open' })
    expect([...currencyIds, 'alias.coin', 'decoy.coin'].every((id) => eng.world.get(id))).toBe(true)
    expect([...currencyIds, 'alias.coin', 'decoy.coin', 'meat.frozen', 'egg.frozen'].filter((id) => viewCount(id))).toEqual([])
    expect([...meatIds, ...eggIds].map((id) => viewCount(id))).toEqual([1, 1, 1, 1, 1])

    const tick = eng.world.state.tick
    eng.author(() => {
      eng.world.clearStatus({ e: 'meat.held' }, 'fresh')
      eng.world.setProp(eng.world.get('meat.held')!, 'food', 1)
      eng.world.transform(eng.world.get('meat.bag')!, 'item/misc/thornmark')
      eng.world.place(eng.world.get('meat.bag')!, { on: 'inside', holder: 'person1' })
      eng.world.destroy(eng.world.get('meat.spoiled')!)
      eng.world.place(eng.world.get('alias.coin')!, { on: 'inside', holder: 'person1' })
    })
    const beforeSecond = worldView.mock.calls.length
    const second = snapshot(eng)

    expect(second.tick).toBe(tick)
    expect(objective('stew', 'beef', second)).toMatchObject({ have: 1, need: 3, state: 'open' })
    expect(objective('carried-items', 'seasoned', second)).toMatchObject({ have: 0, need: 2, state: 'open' })
    expect(objective('carried-items', 'meat', second)).toMatchObject({ have: 1, need: 4, state: 'open' })
    expect(objective('carried-items', 'unique', second)).toMatchObject({ have: 0, need: 2, state: 'open' })
    expect([...meatIds].map((id) => viewCount(id))).toEqual([2, 1, 1])
    expect([...eggIds].map((id) => viewCount(id))).toEqual([2, 2])
    expect(worldView.mock.calls.length).toBeGreaterThan(beforeSecond)

    eng.author(() => eng.world.add({ id: 'meat.extra', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' } }))
    const third = snapshot(eng)
    expect(third.tick).toBe(tick)
    expect(objective('stew', 'beef', third)).toMatchObject({ have: 2, need: 3, state: 'open' })
    expect(objective('carried-items', 'meat', third)).toMatchObject({ have: 2, need: 4, state: 'open' })
    expect([...meatIds, 'meat.extra'].map((id) => viewCount(id))).toEqual([3, 1, 1, 1])
    expect([...eggIds].map((id) => viewCount(id))).toEqual([3, 3])
  })

  it('memoizes carry counts by selector identity and resolved alias identity', () => {
    const eng = play()
    const quest = (id: string, target: string, by = 'actor'): Entity => ({
      id, type: 'resident/quest', place: { on: 'resident' },
      props: { quest: id, state: 'active', stage: 0, by, 'alias.target': target },
    })
    eng.author(() => {
      eng.world.add({ id: 'meat.first', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'meat.second', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' } })
      eng.world.add({ id: 'meat.other', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'person1' } })
      eng.world.add(quest('quest.selector', 'unused'))
      eng.world.add(quest('quest.other-holder', 'unused', 'person1'))
      eng.world.add(quest('quest.alias.first', 'meat.first'))
      eng.world.add(quest('quest.alias.second', 'meat.other'))
    })
    const selectorQuest = eng.world.get('quest.selector')!
    const otherHolderQuest = eng.world.get('quest.other-holder')!
    const firstAliasQuest = eng.world.get('quest.alias.first')!
    const secondAliasQuest = eng.world.get('quest.alias.second')!
    const typed = (type: string) => {
      let reads = 0
      const selector = Object.defineProperty({}, 'type', { enumerable: true, get: () => (reads++, type) })
      return { selector, reads: () => reads }
    }
    const raw = typed('item/food/meat/raw')
    const egg = typed('item/food/egg/raw')

    eng.quests.withReading(() => {
      const carry = { carry: raw.selector, count: 2 }
      expect(eng.quests.holds(carry, selectorQuest)).toBe(true)
      const afterFirst = raw.reads()
      eng.quests.withReading(() => expect(eng.quests.holds(carry, selectorQuest)).toBe(true))
      expect(raw.reads()).toBe(afterFirst)
      expect(eng.quests.holds(carry, otherHolderQuest)).toBe(false)

      const absent = { carry: egg.selector }
      expect(eng.quests.holds(absent, selectorQuest)).toBe(false)
      const afterAbsent = egg.reads()
      eng.quests.withReading(() => expect(eng.quests.holds(absent, selectorQuest)).toBe(false))
      expect(egg.reads()).toBe(afterAbsent)

      expect(eng.quests.holds({ carry: 'target' }, firstAliasQuest)).toBe(true)
      expect(eng.quests.holds({ carry: 'target' }, secondAliasQuest)).toBe(false)
    })
  })

  it('shares nested item reads and clears carried data after a read throws', () => {
    const eng = play()
    const carryDef = {
      id: 'carry-cache', kind: 'side' as const, title: 'Carry cache', summary: 'A test quest', start: { manual: true as const },
      objectives: [{ id: 'meat', text: 'Raw meat', count: { carry: { type: 'item/food/meat/raw' } }, need: 2 }],
      stages: [{ n: 10, show: ['meat'] }],
    }
    eng.quests.load([carryDef])
    eng.author(() => {
      eng.world.add({ id: 'meat.first', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' } })
      eng.quests.put('carry-cache', 10)
    })
    const q = eng.world.get('quest.carry-cache')!
    const worldView = vi.spyOn(eng.world, 'view')
    const carry = { carry: { type: 'item/food/meat/raw' }, count: 2 }

    expect(() => eng.quests.withReading(() => {
      expect(eng.quests.holds(carry, q)).toBe(false)
      eng.quests.withReading(() => expect(eng.quests.holds(carry, q)).toBe(false))
      throw new Error('view failed')
    })).toThrow('view failed')
    expect(worldView.mock.calls.filter(([ref]) => ref?.e === 'meat.first')).toHaveLength(1)

    eng.author(() => eng.world.add({ id: 'meat.second', type: 'item/food/meat/raw', place: { on: 'inside', holder: 'actor' } }))
    expect(eng.quests.withReading(() => eng.quests.holds(carry, q))).toBe(true)
    expect(worldView.mock.calls.filter(([ref]) => ref?.e === 'meat.first')).toHaveLength(2)
    expect(worldView.mock.calls.filter(([ref]) => ref?.e === 'meat.second')).toHaveLength(1)
  })

  it('reads resident quests once without scanning the world while assembling a view', () => {
    const eng = play()
    eng.quests.load([questDef])
    addQuest(eng, 'active')
    const entities = eng.world.state.entities
    const residents = vi.spyOn(eng.world, 'residents')
    let enumerations = 0
    eng.world.state.entities = new Proxy(entities, {
      ownKeys(target) {
        enumerations++
        return Reflect.ownKeys(target)
      },
    })

    try {
      const view = eng.quests.view(['person1', 'person2'])
      expect(view.marks).toEqual({ person1: '?' })
      expect(view.journal).toHaveLength(1)
      // Both people's marks and the other quest views share one indexed resident read.
      expect(residents).toHaveBeenCalledTimes(1)
      expect(enumerations).toBe(0)
    } finally {
      eng.world.state.entities = entities
      residents.mockRestore()
    }
  })

  it('reflects a quest added or removed between snapshots', () => {
    const eng = play()
    eng.quests.load([questDef])
    expect(snapshot(eng).quests.board).toEqual([])

    addQuest(eng, 'offered')
    expect(snapshot(eng).quests.board.map((q) => q.ref)).toEqual(['quest.qa'])

    eng.author(() => eng.world.destroy(eng.world.get('quest.qa')!))
    expect(snapshot(eng).quests.board).toEqual([])
  })

  it('restores the scoped entity list when view assembly throws', () => {
    const eng = play()
    eng.quests.load([questDef])
    const mark = eng.quests.mark
    eng.quests.mark = () => { throw new Error('view failed') }
    expect(() => eng.quests.view(['person1'])).toThrow('view failed')
    eng.quests.mark = mark

    addQuest(eng, 'offered')
    expect(eng.quests.all().map((q) => q.id)).toContain('quest.qa')
  })
})
