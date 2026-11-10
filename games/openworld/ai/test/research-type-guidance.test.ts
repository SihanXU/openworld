import { describe, expect, it } from 'vitest'
import { researchCapabilities, researchCatalogue, trialWorkshopPackage, inventionId, type ResearchPlan } from '@openworld/engine'
import { MemFiles, Modder, ScriptedModel, SelfState, WorldLibrary } from '@openworld/ai'
import { GAME, RECIPES } from '@openworld-game/content'
import { researchTypeGuidance } from '../../../../packages/ai/src/modder/type-guidance.ts'
import { researchWorld } from '../src/live.ts'

const L = (en: string, zh = en) => ({ en, zh })
const plan: ResearchPlan = { version: 1, uses: [
  { id: 'drink', label: L('Drink'), capability: 'drink', target: 'self' },
  { id: 'gift', label: L('Give'), capability: 'gift', target: 'person' },
  // This drinking-reference case asks for a sticky coating; material-dependent impact has its own creation regression.
  { id: 'throw', label: L('Throw'), capability: 'throw-coat', target: 'creature', params: { substance: 'sticky', duration: 60, power: 0, range: 4 } },
] }
const name = L('Berry Draught', '莓果药水')
const proposal = { reply: L('A refreshing draught.'), design: { kind: 'new', name, idea: 'a refreshing drink that can be given away or thrown' }, plan }
const bad = { id: 'item/vessel/berry_draught', name, tags: ['portable', 'vessel:flask', 'drink', 'gift', 'throwable'], props: { value: 3.5, material: 'glass', element: 'water' }, makeup: [{ type: 'item/food/berries', count: 2 }, { type: 'item/material/stone', count: 1 }], station: 'hands' }
const good = { id: 'item/potion/berry_draught', name, tags: ['portable', 'drinkable'], props: { value: 4, material: 'plant', heal: 2 }, makeup: [{ type: 'item/food/berries', count: 10 }, { type: 'item/material/cloth', count: 1 }], station: 'hands' }

function setup(alwaysBad = false, failModel = false) {
  const { eng } = researchWorld(), onto = GAME.ontology()
  const requests: string[] = []
  const model = new ScriptedModel((messages) => {
    if (messages[0].content.startsWith('You are a craftsperson')) return proposal
    requests.push(messages.at(-1)!.content)
    if (failModel) throw new Error('fetch failed: provider connection was interrupted')
    return { patch: { artifacts: [{ kind: 'type', type: alwaysBad || requests.length === 1 ? bad : good }] } }
  })
  const library = new WorldLibrary(onto, GAME.rules)
  const modder = new Modder({ library, state: SelfState.open('/type-guide', undefined, [], new MemFiles()), model, dry: true })
  const catalogue = { ...researchCatalogue(eng, RECIPES), capabilities: researchCapabilities() }
  const request = { npc: 'Garrick', message: 'Make a refreshing drink I can also give or throw.', history: [], catalogue, create: 'low' as const }
  return { eng, onto, library, modder, catalogue, request, requests }
}

describe('research type design is grounded in actual capability consumers', () => {
  it.each([
    ['drink', 'self', 'drinkable'],
    ['eat', 'self', 'edible'],
    ['mine', 'ground', 'tool:pickaxe'],
  ])('retrieves working %s examples with their actual tags and numbers', (capability, target, tag) => {
    const { onto, catalogue } = setup()
    const selected: ResearchPlan = { version: 1, uses: [{ id: 'use', label: L('Use'), capability, target }] }
    const guide = researchTypeGuidance(onto, selected, catalogue, 'an ordinary useful thing', GAME.rules, id => id in onto.types)!
    expect(guide.jointExamples).toBe(true)
    expect(guide.examples.length).toBeGreaterThan(0)
    expect(guide.examples.every(example => example.tags.includes(tag))).toBe(true)
    expect(guide.requirements[0].missingOnBareItem.length).toBeGreaterThan(0)
    expect(guide.catalogue.length).toBeLessThan(128)
    expect(guide.examples.length).toBeLessThanOrEqual(8)
  })

  it('gives the designer executable drinking references and unmasks the missing tag in the first repair', async () => {
    const t = setup()
    const reply = await t.modder.research(t.request)
    expect(t.requests).toHaveLength(2)
    expect(t.requests[0]).toContain('Working capability references')
    expect(t.requests[0]).toContain('drinkable')
    expect(t.requests[0]).toContain('use/drink')
    expect(t.requests[0].length).toBeLessThan(30_000)
    expect(t.requests[1]).toMatch(/not drinkable/)
    expect(t.requests[1]).toMatch(/"element" is not something a vessel has/)
    expect(reply.design).toMatchObject({ kind: 'new', type: { id: good.id, tags: expect.arrayContaining(['drinkable']) } })
    const draft = { id: 'grounded_draught', revision: 1, typeId: inventionId(reply.design!, 'grounded_draught'), design: reply.design, plan: reply.plan! }
    const trial = trialWorkshopPackage(t.eng, draft, RECIPES)
    expect(trial.errors).toEqual([])
    expect(trial.uses.map(use => use.ok)).toEqual([true, true, true])
    expect(t.library.log).toEqual([])
  })

  it('returns a bounded NPC refusal with actual diagnostics after three unsuitable types', async () => {
    const t = setup(true), before = structuredClone(t.eng.world.state)
    const reply = await t.modder.research(t.request)
    expect(t.requests).toHaveLength(3)
    expect(reply.design).toBeUndefined()
    expect(reply.plan?.uses).toEqual([])
    expect(reply.plan?.pending?.[0].reason).toMatchObject({ en: expect.stringContaining('not drinkable') })
    expect(reply.reply).toMatchObject({ zh: expect.stringContaining('配方') })
    expect(t.eng.world.state).toEqual(before)
    expect(t.library.lib.types).toEqual([])
  })

  it('keeps a real model transport failure distinct from a recipe refusal', async () => {
    const t = setup(false, true)
    await expect(t.modder.research(t.request)).rejects.toThrow(/provider connection was interrupted/)
    expect(t.requests).toHaveLength(1)
    expect(t.library.log).toEqual([])
  })
})
