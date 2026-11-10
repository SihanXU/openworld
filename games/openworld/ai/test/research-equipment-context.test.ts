import { describe, expect, it } from 'vitest'
import { inventionId, readResearchRequest, researchCatalogue, researchCapabilities, researchVariantCost, trialResearch, type ResearchCatalogue, type ResearchPlan, type ResearchReply } from '@openworld/engine'
import { MemFiles, Modder, ScriptedModel, SelfState, WorldLibrary, type Model } from '@openworld/ai'
import { GAME, RECIPES } from '@openworld-game/content'
import { researchEquipmentRequirements, researchTypeGuidance } from '../../../../packages/ai/src/modder/type-guidance.ts'
import { researchWorld } from '../src/live.ts'

const L = (en: string, zh = en) => ({ en, zh })
function modder(model: Model) { return new Modder({ library: new WorldLibrary(GAME.ontology(), GAME.rules), state: SelfState.open('/equipment-context', undefined, [], new MemFiles()), model, dry: true }) }
const body = (catalogue: ResearchCatalogue, message: string) => ({ npc: 'Garrick', message, history: [], catalogue, create: 'low' as const })

describe('variant planning uses the authoritative economic floor', () => {
  it('repairs the observed 0.13 shortage without changing the requested prototype or first material', async () => {
    const { eng, port } = researchWorld(), w = eng.world
    eng.author(() => w.setProp(w.player, 'profession', 'assassin'))
    const catalogue = researchCatalogue(eng, RECIPES), prototype = 'item/weapon/blade/dagger'
    const draft = { name: L('Steel Short Blade', '钢制短刃'), prototype, ingredients: [{ type: 'item/material/steel_bar', count: 1 }, { type: 'item/material/plank', count: 1 }] }
    const minimum = catalogue.guidance!.prototypes.find(p => p.type === prototype)!.minCost
    const quote = researchVariantCost(w.onto, prototype, draft.ingredients, minimum)
    expect(quote.cost).toBeCloseTo(11.95)
    expect(quote.minimum).toBeCloseTo(12.08)
    const before = structuredClone(w.state)
    expect(() => trialResearch(eng, port, draft, inventionId(draft, 'too_cheap'), RECIPES)).toThrow(/too cheap/)
    expect(w.state).toEqual(before)
    let calls = 0
    const model = new ScriptedModel(messages => {
      calls++
      if (calls === 2) expect(messages.at(-1)!.content).toMatch(/worth 11\.95.*at least 12\.08.*0\.13/)
      return { reply: L('An assassin’s steel short blade.'), design: { ...draft, ingredients: [{ type: 'item/material/steel_bar', count: calls === 1 ? 1 : 2 }, { type: 'item/material/plank', count: 1 }] } }
    })
    const reply = await modder(model).research(body(catalogue, 'A steel short blade with a wooden grip.'))
    expect(calls).toBe(2)
    expect(reply.design).toMatchObject({ prototype, ingredients: [{ type: 'item/material/steel_bar', count: 2 }, { type: 'item/material/plank', count: 1 }] })
    const id = inventionId(reply.design!, 'enough_steel')
    trialResearch(eng, port, reply.design!, id, RECIPES)
    expect(eng.controls.count('item/material/steel_bar')).toBe(18)
    expect(eng.controls.count('item/material/plank')).toBe(19)
    expect(eng.controls.count(id)).toBe(1)
    expect(w.onto.resolve(id).props.material).toBe('steel')
  })
})

describe('NPC research knows the current actor and native profession tags', () => {
  it('reads the real level/profession and keeps legacy catalogues valid', () => {
    const { eng } = researchWorld()
    eng.author(() => { eng.world.setProp(eng.world.player, 'profession', 'warrior'); eng.world.setProp(eng.world.player, 'level', 8) })
    const catalogue = researchCatalogue(eng, RECIPES)
    expect(catalogue.actor).toEqual({ profession: 'warrior', level: 8 })
    expect(readResearchRequest(body(catalogue, 'A weapon.')).catalogue.actor).toEqual(catalogue.actor)
    const { actor: _actor, ...legacy } = catalogue
    expect(readResearchRequest(body(legacy, 'A weapon.')).catalogue.actor).toBeUndefined()
    expect(() => readResearchRequest(body({ ...catalogue, actor: { level: 0 } }, 'A weapon.'))).toThrow(/actor/)
  })

  it('derives native restrictions from arbitrary profession tags rather than a weapon-name list', () => {
    const onto = GAME.ontology()
    onto.types['item/weapon/novel_focus'] = { id: 'item/weapon/novel_focus', tags: ['profession:astronomer'] }
    onto.types['item/weapon/novel_focus/blue'] = { id: 'item/weapon/novel_focus/blue' }
    const requirements = researchEquipmentRequirements(onto)
    expect(requirements).toContainEqual({ type: 'item/weapon/novel_focus', profession: 'astronomer' })
    expect(requirements.some(r => r.type === 'item/weapon/novel_focus/blue')).toBe(false)
    expect(requirements).toContainEqual({ type: 'item/weapon/magic/staff', profession: 'mage' })
    expect(requirements.some(r => r.type.includes('/wand'))).toBe(false)
  })

  it('prefers usable magic references for a broad request but retains an explicitly requested staff with its requirement', () => {
    const { eng } = researchWorld(), onto = GAME.ontology()
    const catalogue = { ...researchCatalogue(eng, RECIPES), capabilities: researchCapabilities(), actor: { level: 1 } }
    const plan: ResearchPlan = { version: 1, uses: [{ id: 'cast', label: L('Cast'), capability: 'cast', target: 'creature' }] }
    const guide = (intent: string) => researchTypeGuidance(onto, plan, catalogue, intent, GAME.rules, id => id in onto.types)!
    expect(guide('magic weapon for use now').examples[0]).toMatchObject({ usable: true })
    expect(guide('magic weapon for use now').examples[0].requiredProfession).toBeUndefined()
    expect(guide('staff').examples.some(e => e.type.includes('/staff') && e.requiredProfession === 'mage' && e.usable === false)).toBe(true)
  })

  it('uses the same conversation repair to disclose a cross-profession requirement without replacing the sword', async () => {
    const { eng } = researchWorld()
    eng.author(() => eng.world.setProp(eng.world.player, 'profession', 'assassin'))
    const catalogue = researchCatalogue(eng, RECIPES)
    let calls = 0
    const model = new ScriptedModel(messages => {
      calls++
      expect(messages[0].content).toContain('profession assassin')
      expect(messages[0].content).toContain('item/weapon/magic/staff requires mage')
      if (calls === 2) expect(messages.at(-1)!.content).toContain('requires profession warrior')
      return { reply: L(calls === 1 ? 'A wooden sword for you.' : 'This sword requires a warrior to fight with; your friend can use it.'), design: { name: L('Gift Sword', '赠礼剑'), prototype: 'item/weapon/blade/sword', ingredients: [{ type: 'item/material/log', count: 20 }] } }
    })
    const reply = await modder(model).research(body(catalogue, 'I am an assassin, but make a wooden sword for my warrior friend.'))
    expect(calls).toBe(2)
    expect(reply.design).toMatchObject({ prototype: 'item/weapon/blade/sword', ingredients: [{ type: 'item/material/log', count: 20 }] })
  })

  it('accepts an explicit cross-profession request immediately when the NPC states the requirement', async () => {
    const { eng } = researchWorld()
    eng.author(() => eng.world.setProp(eng.world.player, 'profession', 'assassin'))
    let calls = 0
    const reply: ResearchReply = { reply: L('A warrior can fight with this sword; you may give it to your friend.'), design: { name: L('Warrior Friend’s Sword', '战士友人的剑'), prototype: 'item/weapon/blade/sword', ingredients: [{ type: 'item/material/log', count: 20 }] } }
    const model = new ScriptedModel(() => { calls++; return reply })
    expect((await modder(model).research(body(researchCatalogue(eng, RECIPES), 'A sword for my warrior friend.'))).design).toEqual(reply.design)
    expect(calls).toBe(1)
  })
})
