import { describe, expect, it } from 'vitest'
import { inventionId, registerWorkshopPackage, researchCatalogue, researchCapabilities, runWorkshopUse, trialResearch, trialWorkshopPackage, type ResearchPlan } from '@openworld/engine'
import { MemFiles, Modder, ScriptedModel, SelfState, WorldLibrary, type ChatMessage, type ChatOptions } from '@openworld/ai'
import { GAME, RECIPES } from '@openworld-game/content'
import { researchWorld } from '../src/live.ts'

const text = (en: string, zh = en) => ({ en, zh })
// The first real vague-jam run fixed foodBoost at 3 while its admitted source had only 2 food.
const proposed: ResearchPlan = { version: 1, uses: [
  { id: 'spread_jam', label: text('Spread on food', '涂在食物上'), capability: 'spread', target: 'item', params: { foodBoost: 3, duration: 300 } },
  { id: 'inspect_jam', label: text('Inspect', '查看'), capability: 'inspect', target: 'self', params: {} },
] }
const jam = { id: 'item/food/berries/jam', name: text('Berry Jam', '浆果酱'), tags: ['edible', 'portable'], props: { value: 3, heal: 2, food: 2, material: 'plant' }, makeup: [{ type: 'item/food/berries', count: 3 }, { type: 'item/material/grass', count: 1 }], station: 'hands' }
function setup(repair: (messages: ChatMessage[]) => object, wrongStation = false, inputPlan = proposed) {
  const { eng, port } = researchWorld()
  let designers = 0, repairs = 0
  const model = new ScriptedModel((messages, options: ChatOptions) => {
    if (options.purpose === 'create-plan-repair') { repairs++; return repair(messages) }
    if (messages[0].content.startsWith('You are a craftsperson')) return { reply: text('A berry spread.', '可以做浆果酱。'), design: { kind: 'new', name: jam.name, idea: 'an edible berry spread' }, plan: inputPlan }
    designers++
    return { patch: { artifacts: [{ kind: 'type', type: { ...jam, station: wrongStation && designers === 1 ? 'workbench' : 'hands' } }] } }
  })
  const library = new WorldLibrary(GAME.ontology(), GAME.rules)
  const state = SelfState.open('/balance', undefined, [], new MemFiles())
  const modder = new Modder({ library, state, model, dry: true })
  const request = (message: string) => ({ npc: 'Garrick', message, history: [], catalogue: { ...researchCatalogue(eng, RECIPES), capabilities: researchCapabilities() }, create: 'low' as const })
  return { eng, port, library, modder, request, counts: () => ({ designers, repairs }) }
}

describe('a researched use plan fits the real food data after type design', () => {
  it('repairs the plan once instead of asking the designer repeatedly for impossible nutrition', async () => {
    const fixed: ResearchPlan = { ...proposed, uses: proposed.uses.map((use) => use.capability === 'spread' ? { ...use, params: { duration: 300 } } : use) }
    const t = setup((messages) => {
      const actual = JSON.parse(messages[1].content).actual
      expect(actual.props.food).toBe(2)
      expect(messages[1].content).toContain('foodBoost exceeds the source food value')
      return { ready: true, reply: text('Spread its actual nutrition onto food.', '涂在食物上，转移这份果酱实际含有的营养。'), plan: fixed }
    })
    const reply = await t.modder.research(t.request('做个果酱'))
    expect(t.counts()).toEqual({ designers: 1, repairs: 1 })
    expect(reply.plan).toEqual(fixed)
    const id = inventionId(reply.design!, 'plan_balance')
    trialResearch(t.eng, t.port, reply.design!, id, RECIPES)
    expect(t.eng.world.onto.resolve(id).props.food).toBe(2)
    expect(t.eng.controls.count(id)).toBe(1)
    const uses = { id: 'balanced_jam_uses', revision: 1, typeId: id, plan: reply.plan! }
    const trial = trialWorkshopPackage(t.eng, uses, RECIPES)
    expect(trial.errors).toEqual([])
    expect(registerWorkshopPackage(t.eng, uses, trial, RECIPES).ok).toBe(true)
    const w = t.eng.world, at = w.posOf(w.player)!
    let bread!: ReturnType<typeof w.create>
    t.eng.author(() => { bread = w.create('item/food/bread', { on: 'tile', map: at.map, x: at.x, y: at.y + 1 }) })
    const foodBefore = w.num(bread, 'food')
    expect(runWorkshopUse(t.eng, uses.id, 'spread_jam', { e: bread.id })).toBe(true)
    expect(t.eng.controls.count(id)).toBe(0)
    expect(w.num(bread, 'food') - foodBefore).toBe(2)
    expect(t.library.lib.types).toEqual([])
  })

  it('does not add a plan-repair call when source-dependent nutrition was left unbound', async () => {
    const unbound = { ...proposed, uses: proposed.uses.map((use) => use.capability === 'spread' ? { ...use, params: { duration: 300 } } : use) }
    const t = setup(() => { throw new Error('No plan repair should be needed') }, false, unbound)
    const reply = await t.modder.research(t.request('做个果酱'))
    expect(t.counts()).toEqual({ designers: 1, repairs: 0 })
    expect(reply.plan).toEqual(unbound)
  })

  it('asks the player when an explicit nutrition requirement exceeds the actual source', async () => {
    const t = setup(() => ({ ready: false, reply: text('This portion supplies 2, not the 3 you require. Should I keep the spread at its actual nutrition?', '这份果酱只有2点营养，达不到你要求的3点。要按实际营养保留涂抹用途吗？'), plan: { version: 1, uses: [], pending: [{ idea: text('Add exactly 3 food', '必须增加3点饱腹'), reason: text('The source provides only 2.', '这份原料产物只提供2点。') }] } }))
    const before = structuredClone(t.eng.world.state)
    const reply = await t.modder.research(t.request('做果酱，每次涂抹必须增加3点饱腹，少一点都不行。'))
    expect(t.counts()).toEqual({ designers: 1, repairs: 1 })
    expect(reply.design).toBeUndefined()
    expect(reply.plan?.pending).toHaveLength(1)
    expect(t.eng.world.state).toEqual(before)
    expect(t.library.lib.types).toEqual([])
  })

  it('does not silently drop the requested use while claiming the final plan is ready', async () => {
    const t = setup(() => ({ ready: true, reply: text('Inspect it instead.'), plan: { version: 1, uses: [proposed.uses[1]] } }))
    await expect(t.modder.research(t.request('做个能涂在食物上的果酱'))).rejects.toThrow(/preserve the proposed uses/)
    expect(t.counts()).toEqual({ designers: 1, repairs: 1 })
    expect(t.library.log).toEqual([])
  })

  it('sends an unreachable station back to the designer before offering the recipe', async () => {
    const fixed = { ...proposed, uses: proposed.uses.map((use) => use.capability === 'spread' ? { ...use, params: { duration: 300 } } : use) }
    const t = setup(() => ({ ready: true, reply: text('A berry spread made by hand.'), plan: fixed }), true)
    const reply = await t.modder.research(t.request('做个果酱'))
    expect(t.counts()).toEqual({ designers: 2, repairs: 1 })
    expect(reply.design).toMatchObject({ kind: 'new', type: { station: 'hands' } })
    trialResearch(t.eng, t.port, reply.design!, inventionId(reply.design!, 'station_balance'), RECIPES)
  })
})
