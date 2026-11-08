import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, inventionId, researchCatalogue, trialResearch, type Ontology, type TypeDef } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { MemFiles } from '../src/agent/files.ts'
import { SelfState } from '../src/agent/state.ts'
import { WorldLibrary } from '../src/library/library.ts'
import { ScriptedModel } from '../src/models/model.ts'
import { Modder } from '../src/modder/pipeline.ts'

const LOG = 'item/material/log'
const onto: Ontology = {
  ...STDLIB_ONTOLOGY as Ontology,
  types: {
    ...STDLIB_ONTOLOGY.types,
    'item/material': { id: 'item/material', name: 'material' },
    [LOG]: { id: LOG, name: { en: 'Log', zh: '木头' }, props: { value: 2, material: 'wood' } },
    'item/vessel': { id: 'item/vessel', name: 'vessel' },
    'item/vessel/cup': { id: 'item/vessel/cup', name: { en: 'Cup', zh: '杯子' }, props: { value: 2 } },
  },
  terrains: { grass: { id: 'grass', name: 'grass', tags: [] } },
}
const bowl = (count: number): TypeDef => ({ id: 'item/vessel/wood_bowl', name: { en: 'Wooden Bowl', zh: '木碗' }, props: { value: 2 }, makeup: [{ type: LOG, count }], station: 'hands' })

function workshop(counts: number[], inventory = 1) {
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    ...Array.from({ length: inventory }, (_, i) => ({ key: `log${i}`, type: LOG, x: 2, y: 2, inside: 'actor' })),
  ], event: {} }, onto, new RuleLibrary(STDLIB_RULES))
  const library = new WorldLibrary(onto, STDLIB_RULES)
  const asked: string[] = []
  let proposals = 0
  const model = new ScriptedModel((messages) => {
    if (messages[0].content.startsWith('You are a craftsperson')) return { reply: { en: 'A wooden bowl.', zh: '一个木碗。' }, design: { kind: 'new', name: bowl(1).name, idea: 'a bowl carved from a log' } }
    asked.push(messages.at(-1)!.content)
    const count = counts[Math.min(proposals++, counts.length - 1)]
    return { patch: { artifacts: [{ kind: 'type', type: bowl(count) }] } }
  })
  const state = SelfState.open('/research', undefined, [], new MemFiles())
  const modder = new Modder({ library, state, model, dry: true })
  const request = { npc: 'Woodcarver', message: 'A wooden bowl, please.', history: [], catalogue: researchCatalogue(eng), create: 'low' as const }
  return { eng, library, asked, modder, request }
}

describe('a craftsperson designs within the inventory counted by the game', () => {
  it('repairs a new kind before offering it, then trial-crafts exactly its available units', async () => {
    const { eng, library, asked, modder, request } = workshop([2, 1])
    const before = structuredClone(eng.world.state)
    expect(request.catalogue.guidance!.materials).toEqual([{ type: LOG, value: 2, available: 1 }])
    const reply = await modder.research(request)
    expect(asked).toHaveLength(2)
    expect(asked[0]).toContain('available: 1')
    expect(asked[1]).toMatch(/item\/material\/log.*2.*1/)
    expect(reply.design).toMatchObject({ kind: 'new', type: { makeup: [{ type: LOG, count: 1 }] } })
    // Research proposes; only the actual trial changes the save, never the shared library.
    expect(eng.world.state).toEqual(before)
    expect(library.log).toEqual([])
    expect(library.lib.types).toEqual([])
    const id = inventionId(reply.design!, 'available_units')
    trialResearch(eng, new ModPort(eng), reply.design!, id)
    expect(eng.controls.count(LOG)).toBe(0)
    expect(eng.controls.count(id)).toBe(1)
    expect(eng.recipes.get(id)!.needs).toEqual([{ type: LOG, count: 1 }])
    expect(library.lib.types).toEqual([])
  })

  it('stops after three impossible workshop drafts without consuming or learning anything', async () => {
    const { eng, library, asked, modder, request } = workshop([2])
    const before = structuredClone(eng.world.state)
    const reply = await modder.research(request)
    expect(reply.design).toBeUndefined()
    expect(reply.plan?.pending?.[0].reason).toMatchObject({ en: expect.stringMatching(/item\/material\/log.*2.*1/) })
    expect(asked).toHaveLength(3)
    expect(eng.world.state).toEqual(before)
    expect(eng.controls.count(LOG)).toBe(1)
    expect(library.log).toEqual([])
    expect(library.lib.types).toEqual([])
    expect(eng.recipes.size).toBe(0)
  })

  it('rechecks the current save at confirmation when materials have been spent since the proposal', async () => {
    const { eng, modder, request } = workshop([2], 2)
    const reply = await modder.research(request)
    eng.author(() => eng.world.destroy(eng.world.get('log0')!))
    const before = structuredClone(eng.world.state)
    const id = inventionId(reply.design!, 'spent_since_proposal')
    expect(() => trialResearch(eng, new ModPort(eng), reply.design!, id)).toThrow(/recipe materials/)
    expect(eng.world.state).toEqual(before)
    expect(eng.controls.count(LOG)).toBe(1)
    expect(eng.controls.count(id)).toBe(0)
    expect(eng.recipes.has(id)).toBe(false)
    expect(eng.world.onto.data.types[id]).toBeUndefined()
    expect(eng.lib.types).toEqual([])
  })
})
