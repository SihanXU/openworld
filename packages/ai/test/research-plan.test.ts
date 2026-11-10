import { describe, expect, it } from 'vitest'
import { readResearchRequest, researchCapabilities, type CapabilityDescriptor, type Ontology, type ResearchPlan } from '@openworld/engine'
import { STDLIB_ONTOLOGY, STDLIB_RULES } from '@openworld/stdlib'
import { MemFiles } from '../src/agent/files.ts'
import { SelfState } from '../src/agent/state.ts'
import { WorldLibrary } from '../src/library/library.ts'
import { ScriptedModel } from '../src/models/model.ts'
import { Modder } from '../src/modder/pipeline.ts'
import { researchConversation } from '../src/modder/research.ts'

const words = (en: string) => ({ en, zh: en })
const capabilities: CapabilityDescriptor[] = [
  { id: 'eat', version: 1, label: words('Eat'), description: words('Consume one unit to restore hunger.'), targets: ['self'], params: {} },
  { id: 'gift', version: 1, label: words('Give as a gift'), description: words('Transfer the item to a person.'), targets: ['person'], params: {} },
  { id: 'inspect', version: 1, label: words('Inspect'), description: words('Inspect the actual item.'), targets: ['self'], params: {} },
  { id: 'throw-coat', version: 1, label: words('Throw'), description: words('Spend one item and coat the recipient.'), targets: ['person', 'item', 'ground'], params: { power: { type: 'number', min: 0, max: 5, default: 0 }, substance: { type: 'string', enum: ['wet', 'sticky'], default: 'wet' } } },
]
const use = (id: string, target = id === 'gift' ? 'person' : 'self') => ({ id, label: words(id), capability: id, target })
const plan = (...ids: string[]): ResearchPlan => ({ version: 1, uses: ids.map((id) => use(id)) })
const request = (message = 'Make a useful food.') => ({ npc: 'Craftsperson', message, history: [], catalogue: { prototypes: [], materials: [], capabilities } })
const design = { kind: 'new', name: words('New Item'), idea: 'an ordinary useful item' }
const answer = (p: ResearchPlan) => ({ reply: words('Here is a proposal.'), design, plan: p })

describe('the NPC plans uses from registered capabilities', () => {
  it('keeps repeated invalid-prototype diagnostics in a normal NPC discussion episode', async () => {
    let calls = 0
    const model = new ScriptedModel(() => { calls++; return { reply: words('A wand.'), design: { name: words('Wand'), prototype: 'item/weapon/magic/wand', ingredients: [{ type: 'item/material/stone', count: 1 }] } } })
    const fs = new MemFiles(), state = SelfState.open('/semantic', undefined, [], fs)
    const library = new WorldLibrary(STDLIB_ONTOLOGY as Ontology, STDLIB_RULES)
    const result = await new Modder({ library, state, model }).research({ ...request('A magic item.'), catalogue: { prototypes: [], materials: ['item/material/stone'] } })
    expect(calls).toBe(2)
    expect(result.design).toBeUndefined()
    expect(result.plan?.uses).toEqual([])
    expect(result.reply).toMatchObject({ zh: expect.stringContaining('可行的设计') })
    const own = SelfState.open('/semantic/people/craftsperson', undefined, [], fs)
    const entry = own.episodes()[0]
    expect(entry.outcome).toBe('covered')
    expect(own.episode(entry.id)?.attempts[0].errors.join('; ')).toContain('item/weapon/magic/wand')
    expect(library.log).toEqual([])
  })

  it('propagates a provider failure during the repair instead of treating it as an invalid design', async () => {
    let calls = 0
    const model = new ScriptedModel(() => {
      if (++calls === 2) throw new Error('Provider connection failed')
      return { reply: words('A wand.'), design: { name: words('Wand'), prototype: 'item/weapon/magic/wand', ingredients: [{ type: 'item/material/stone', count: 1 }] } }
    })
    await expect(researchConversation(model, { ...request(), catalogue: { prototypes: [], materials: ['item/material/stone'] } })).rejects.toThrow('Provider connection failed')
    expect(calls).toBe(2)
  })

  it('reads the actual engine capability catalogue, including bounded camel-case parameters', () => {
    const registered = researchCapabilities()
    const body = { ...request(), catalogue: { ...request().catalogue, capabilities: registered }, plan: { version: 1, uses: [{ ...use('spread', 'item'), params: { foodBoost: 2, duration: 300 } }] } }
    expect(readResearchRequest(body).catalogue.capabilities).toEqual(registered)
    expect(readResearchRequest(body).plan).toEqual(body.plan)
  })

  it.each([
    ['Make some fruit preserves.', plan('eat', 'gift')],
    ['Make a healing draught that can also be thrown.', { version: 1 as const, uses: [use('inspect'), { ...use('throw-coat', 'person'), params: { substance: 'wet', power: 0 } }] }],
    ['Make a wooden kitchen tool.', plan('inspect', 'gift')],
  ])('uses the same open workshop contract for %s without a fixed questionnaire', async (message, selected) => {
    let calls = 0
    const model = new ScriptedModel((messages) => {
      calls++
      expect(messages[0].content).toContain('think through a few useful and interesting uses')
      expect(messages[0].content).toContain('throw-coat')
      expect(JSON.parse(messages[1].content).message).toBe(message)
      return answer(selected)
    })
    expect((await researchConversation(model, request(message))).plan).toEqual(selected)
    expect(calls).toBe(1)
  })

  it('repairs an invented capability into an explicitly pending idea', async () => {
    const asked: string[] = []
    const corrected: ResearchPlan = { ...plan('inspect'), pending: [{ idea: words('Travel through time'), reason: words('There is no registered time travel capability.') }] }
    const model = new ScriptedModel((messages) => {
      asked.push(messages.at(-1)!.content)
      return answer(asked.length === 1 ? plan('time-travel') : corrected)
    })
    expect((await researchConversation(model, request('A cup that travels through time.'))).plan).toEqual(corrected)
    expect(asked).toHaveLength(2)
    expect(asked[1]).toMatch(/time-travel.*not registered/)
  })

  it.each([
    [{ ...use('gift', 'self') }, /gift targets person/],
    [{ ...use('throw-coat', 'person'), params: { power: 99 } }, /parameter "power"/],
    [{ ...use('throw-coat', 'person'), params: { substance: 'gold' } }, /parameter "substance"/],
    [{ ...use('gift'), params: { freeGold: 1 } }, /no parameter "freeGold"/],
  ])('repairs an invalid target or parameter without granting it authority', async (bad, expected) => {
    const asked: string[] = []
    const model = new ScriptedModel((messages) => {
      asked.push(messages.at(-1)!.content)
      return answer(asked.length === 1 ? { version: 1, uses: [bad] } : plan('inspect'))
    })
    expect((await researchConversation(model, request())).plan).toEqual(plan('inspect'))
    expect(asked).toHaveLength(2)
    expect(asked[1]).toMatch(expected)
  })

  it('asks a consequential question without forcing a premature recipe or plan', async () => {
    const reply = words('Should it be spent after one use, or kept as a reusable vessel?')
    const model = new ScriptedModel(() => ({ reply, design: null }))
    expect(await researchConversation(model, request('Make a refillable flask or a single dose.'))).toEqual({ reply })
  })

  it('repairs a creative recipe that omits its uses, while legacy recipe clients remain compatible', async () => {
    let calls = 0
    const model = new ScriptedModel(() => ++calls === 1 ? { reply: words('A new item.'), design } : answer(plan('inspect')))
    expect((await researchConversation(model, request())).plan).toEqual(plan('inspect'))
    expect(calls).toBe(2)
    const legacy = new ScriptedModel(() => ({ reply: words('A new item.'), design }))
    expect((await researchConversation(legacy, { ...request(), catalogue: { prototypes: [], materials: [] } })).design).toEqual(design)
  })

  it('extends an existing save item with no original materials or second crafting round', async () => {
    const body = { ...request('Add a gift use, and keep the inspection.'), subject: { typeId: 'item/vessel/invention_saved_cup', name: words('Saved Cup'), plan: plan('inspect') }, create: 'low' as const }
    expect(readResearchRequest(body).subject).toEqual(body.subject)
    let calls = 0
    const selected = plan('inspect', 'gift')
    const model = new ScriptedModel((messages) => {
      calls++
      expect(JSON.parse(messages[1].content).subject).toEqual(body.subject)
      return { reply: words('It can also be given as a gift.'), design: null, plan: selected }
    })
    const library = new WorldLibrary(STDLIB_ONTOLOGY as Ontology, STDLIB_RULES)
    const state = SelfState.open('/planner', undefined, [], new MemFiles())
    const modder = new Modder({ library, state, model, dry: true })
    expect(await modder.research(body)).toEqual({ reply: words('It can also be given as a gift.'), plan: selected })
    expect(calls).toBe(1)
    expect(library.lib.types).toEqual([])
    expect(library.log).toEqual([])
  })

  it('repairs a request to extend an existing item if the model tries to craft another one', async () => {
    const body = { ...request('Give this cup another use.'), subject: { typeId: 'item/vessel/invention_saved_cup', name: words('Saved Cup'), plan: plan('inspect') } }
    let calls = 0
    const model = new ScriptedModel(() => ++calls === 1 ? answer(plan('inspect')) : { reply: words('Keep the cup; add the gift use.'), design: null, plan: plan('inspect', 'gift') })
    expect((await researchConversation(model, body)).design).toBeUndefined()
    expect(calls).toBe(2)
  })

  it('records the game outcome for an added use even when there is no new recipe', async () => {
    const selected = plan('inspect', 'gift')
    const body = { ...request('Add a gift use.'), subject: { typeId: 'item/vessel/invention_saved_cup', name: words('Saved Cup'), plan: plan('inspect') } }
    const library = new WorldLibrary(STDLIB_ONTOLOGY as Ontology, STDLIB_RULES)
    const fs = new MemFiles()
    const state = SelfState.open('/outcome', undefined, [], fs)
    state.setHarness({ ...state.harness(), reflect: { ...state.harness().reflect, enabled: false } }, 'test')
    const modder = new Modder({ library, state, model: new ScriptedModel(() => ({ reply: words('Add the gift use.'), design: null, plan: selected })) })
    const reply = await modder.research(body)
    expect(reply.episode).toBeTruthy()
    expect(modder.researchOutcome({ episode: reply.episode, result: 'made' })).toEqual({ ok: true })
    const person = SelfState.open('/outcome/people/craftsperson', undefined, [], fs)
    const episodes = person.episodes()
    expect(episodes).toHaveLength(1)
    expect(person.episode(episodes[0].id)).toMatchObject({ outcome: 'accepted', patch: { plan: selected } })
    expect(library.log).toEqual([])
  })

  it('repairs a variant plan against the actual prototype during the same conversation', async () => {
    const onto: Ontology = { ...STDLIB_ONTOLOGY as Ontology, types: {
      ...STDLIB_ONTOLOGY.types,
      'item/material/log': { id: 'item/material/log', name: words('Log'), props: { value: 2, material: 'wood' } },
      'item/tool/hammer': { id: 'item/tool/hammer', name: words('Hammer'), props: { value: 2, material: 'wood' } },
    } }
    const asked: string[] = []
    const model = new ScriptedModel((messages) => {
      asked.push(messages.at(-1)!.content)
      return { reply: words('A wooden mallet.'), design: { name: words('Wooden Mallet'), prototype: 'item/tool/hammer', ingredients: [{ type: 'item/material/log', count: 1 }] }, plan: asked.length === 1 ? plan('eat') : plan('inspect', 'gift') }
    })
    const library = new WorldLibrary(onto, STDLIB_RULES)
    const modder = new Modder({ library, state: SelfState.open('/variant', undefined, [], new MemFiles()), model, dry: true })
    const reply = await modder.research({ ...request('A wooden mallet.'), catalogue: { materials: ['item/material/log'], prototypes: ['item/tool/hammer'], capabilities }, create: 'low' })
    expect(reply.plan).toEqual(plan('inspect', 'gift'))
    expect(asked).toHaveLength(2)
    expect(asked[1]).toMatch(/not edible food/)
    expect(library.lib.types).toEqual([])
  })

  it('holds the new type to its planned uses in the existing designer repair loop', async () => {
    const pulp = 'item/material/fruit_pulp'
    const onto: Ontology = { ...STDLIB_ONTOLOGY as Ontology, types: {
      ...STDLIB_ONTOLOGY.types,
      [pulp]: { id: pulp, name: words('Fruit Pulp'), props: { value: 2 } },
      'item/vessel': { id: 'item/vessel', name: words('Vessel') },
      'item/vessel/cup': { id: 'item/vessel/cup', name: words('Cup'), props: { value: 2 } },
      'item/food': { id: 'item/food', name: words('Food'), tags: ['edible'], props: { value: 2, food: 2 } },
      'item/food/fruit': { id: 'item/food/fruit', name: words('Fruit'), props: { value: 2, food: 2 } },
    } }
    const asked: string[] = []
    let calls = 0
    const model = new ScriptedModel((messages) => {
      calls++
      if (messages[0].content.startsWith('You are a craftsperson')) return { ...answer(plan('eat', 'gift')), design: { ...design, name: words('Fruit Paste'), idea: 'an edible portion of fruit pulp' } }
      asked.push(messages.at(-1)!.content)
      return { patch: { artifacts: [{ kind: 'type', type: { id: asked.length === 1 ? 'item/vessel/fruit_paste' : 'item/food/fruit_paste', name: words('Fruit Paste'), props: { value: 2 }, makeup: [{ type: pulp, count: 1 }], station: 'hands' } }] } }
    })
    const library = new WorldLibrary(onto, STDLIB_RULES)
    const modder = new Modder({ library, state: SelfState.open('/new', undefined, [], new MemFiles()), model, dry: true })
    const reply = await modder.research({ ...request('Make a portion of fruit paste.'), catalogue: { materials: [pulp], prototypes: [], capabilities }, create: 'low' })
    expect(asked).toHaveLength(2)
    expect(asked[0]).toContain('"capability":"eat"')
    expect(asked[1]).toMatch(/not edible food/)
    expect(reply.design).toMatchObject({ kind: 'new', type: { id: 'item/food/fruit_paste' } })
    expect(reply.plan).toEqual(plan('eat', 'gift'))
    expect(calls).toBe(3)
    expect(library.lib.types).toEqual([])
  })
})
