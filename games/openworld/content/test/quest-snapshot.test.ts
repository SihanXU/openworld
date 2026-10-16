import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, snapshot } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

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
  it('scans quests once while assembling marks, journal, targets, board, and lessons', () => {
    const eng = play()
    eng.quests.load([questDef])
    addQuest(eng, 'active')
    const entities = eng.world.state.entities
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
      // Both people exercise mark(); journal, targets, board and lessons' quest reads share one entity scan.
      expect(enumerations).toBe(1)
    } finally {
      eng.world.state.entities = entities
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
