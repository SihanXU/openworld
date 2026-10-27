import { describe, expect, it } from 'vitest'
import { CRAFTSPERSON, OntologyIndex, buildSandbox, madeOf, ModPort, RuleLibrary, researchCatalogue, trialResearch, type ResearchDesign } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

function world() {
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    ...Array.from({ length: 30 }, (_, i) => ({ key: `log${i}`, type: 'item/material/log', inside: 'actor', x: 2, y: 2 })),
    ...Array.from({ length: 30 }, (_, i) => ({ key: `stone${i}`, type: 'item/material/stone', inside: 'actor', x: 2, y: 2 })),
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  return { eng, port: new ModPort(eng) }
}

describe('research in the actual game', () => {
  it('is talked over with those who make things: a smith, an innkeeper, a herbalist; not a guard or a child', () => {
    const onto = new OntologyIndex(buildOntology())
    const crafts = (role: string) => onto.resolve(`actor/person/${role}`).tags.includes(CRAFTSPERSON)
    expect(['smith', 'innkeeper', 'herbalist'].map(crafts)).toEqual([true, true, true])
    expect(['guard', 'child', 'villager', 'beggar'].map(crafts)).toEqual([false, false, false, false])
  })

  it.each(['stone', 'log'])('keeps the ordinary crafting material effects when %s is first', (main) => {
    const { eng, port } = world()
    const prototype = 'item/tool/pickaxe'
    const material = main === 'stone' ? 'stone' : 'wood'
    const second = main === 'stone' ? 'log' : 'stone'
    const id = `${prototype}/invention_${main}`
    trialResearch(eng, port, { name: 'A material-aware pick', prototype, ingredients: [
      { type: `item/material/${main}`, count: 10 }, { type: `item/material/${second}`, count: 10 },
    ] }, id)
    const item = Object.values(eng.world.state.entities).find((e) => e.type === id)!
    const native = madeOf(eng.world.onto.data, eng.world.onto, prototype, material, 'common', 1)
    expect(eng.world.num(item, 'power')).toBe(native.props!.power)
    expect(eng.world.materialOf(item)?.id).toBe(material)
    for (const tag of native.tags ?? []) expect(eng.world.hasTag(item, tag)).toBe(true)
  })

  it('finds unlocked crafts and trial-crafts a persistent new recipe through normal events', () => {
    const { eng, port } = world()
    const c = researchCatalogue(eng)
    expect(c.guidance?.materials.find((m) => m.type === 'item/material/log')?.available).toBe(30)
    expect(c.guidance?.prototypes.every((p) => p.minCost > 0)).toBe(true)
    expect(c.prototypes.length).toBeGreaterThan(0)
    const prototype = c.prototypes.find((id) => eng.recipes.get(id)?.station === 'hands')!
    expect(prototype).toBeTruthy()
    const design: ResearchDesign = { name: { en: 'Stonebound invention', zh: '石缚新作' }, prototype, ingredients: [{ type: 'item/material/log', count: 10 }, { type: 'item/material/stone', count: 10 }] }
    const id = `${prototype}/invention_${'f2658e53-8f55-4421-9e1f-3323e793879e'.replaceAll('-', '_')}`
    const type = trialResearch(eng, port, design, id)
    expect(type.researched).toBe(true)
    expect(eng.controls.count(id)).toBe(1)
    expect(eng.controls.count('item/material/log')).toBe(20)
    expect(eng.controls.count('item/material/stone')).toBe(20)
    expect(eng.recipes.has(id)).toBe(true)
    expect(eng.controls.craft(eng.recipes.get(id)!)).toBe(true)
    expect(eng.controls.count(id)).toBe(2)
  })
  it('does not spend materials or learn a recipe when the proposal bypasses price or unlock checks', () => {
    const { eng, port } = world()
    const before = JSON.stringify(eng.world.state)
    const proposal = { name: 'Free treasure', prototype: 'item/weapon/blade/dragonsbane', ingredients: [{ type: 'item/material/log', count: 1 }] }
    expect(() => trialResearch(eng, port, proposal, `${proposal.prototype}/invention_cheat`)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.lib.types).toHaveLength(0)
  })
  it('rejects an unaffordable trial without spending or learning anything', () => {
    const { eng, port } = world()
    const prototype = researchCatalogue(eng).prototypes.find((id) => eng.recipes.get(id)?.station === 'hands')!
    const before = JSON.stringify(eng.world.state)
    const design = { name: 'Oversized pack', prototype, ingredients: [{ type: 'item/material/log', count: 64 }, { type: 'item/material/stone', count: 64 }] }
    expect(() => trialResearch(eng, port, design, `${prototype}/invention_unaffordable`)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.lib.types).toHaveLength(0)
  })
  it('cannot learn the same invention twice or spend its materials a second time', () => {
    const { eng, port } = world()
    const prototype = researchCatalogue(eng).prototypes.find((id) => eng.recipes.get(id)?.station === 'hands')!
    const design = { name: 'One trial', prototype, ingredients: [{ type: 'item/material/log', count: 10 }, { type: 'item/material/stone', count: 10 }] }
    const id = `${prototype}/invention_once`
    trialResearch(eng, port, design, id)
    const before = JSON.stringify(eng.world.state)
    expect(() => trialResearch(eng, port, design, id)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.controls.count(id)).toBe(1)
  })

  it('keeps a workshop requirement even when the proposed ingredients are carried', () => {
    const { eng, port } = world()
    const prototype = 'item/weapon/blade/axe'
    const recipe = eng.recipes.get(prototype)!
    expect(recipe).toBeTruthy()
    eng.recipes.set(prototype, { ...recipe, station: 'anvil' })
    const before = JSON.stringify(eng.world.state)
    const design = { name: 'Workshop axe', prototype, ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }
    expect(() => trialResearch(eng, port, design, `${prototype}/invention_workshop`)).toThrow(/crafting station/)
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.lib.types).toHaveLength(0)
  })

  it('rechecks a skill lost between proposing and confirming', () => {
    const { eng, port } = world()
    const prototype = 'item/weapon/blade/axe'
    expect(researchCatalogue(eng).prototypes).toContain(prototype)
    eng.recipes.set(prototype, { ...eng.recipes.get(prototype)!, skill: 'smithing' })
    const before = JSON.stringify(eng.world.state)
    const design = { name: 'Skilled axe', prototype, ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }
    expect(researchCatalogue(eng).prototypes).not.toContain(prototype)
    expect(() => trialResearch(eng, port, design, `${prototype}/invention_skill`)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.lib.types).toHaveLength(0)
  })

  it('does not bypass a tutorial that permits only one named recipe', () => {
    const { eng, port } = world()
    const prototype = 'item/weapon/blade/axe'
    eng.quests.load([{
      id: 'research-gate', kind: 'main', title: 'A first craft', summary: 'Learn the ordinary recipe first.', start: { manual: true },
      stages: [{ n: 0, lessons: [{ id: 'ordinary-axe', allow: ['craft'], only: [prototype], done: { facts: { 'qa.finished': true } } }] }],
    }])
    eng.author(() => eng.world.add({ id: 'quest.research-gate', type: 'resident/quest', place: { on: 'resident' }, props: { quest: 'research-gate', state: 'active', stage: 0, by: 'actor' } }))
    expect(eng.story.lesson()?.def.id).toBe('ordinary-axe')
    const id = `${prototype}/invention_tutorial_bypass`
    const design = { name: 'A different axe', prototype, ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }
    const before = JSON.stringify(eng.world.state)
    expect(() => trialResearch(eng, port, design, id)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.controls.count(id)).toBe(0)
    expect(eng.recipes.has(id)).toBe(false)
    expect(eng.world.onto.data.types[id]).toBeUndefined()
    expect(eng.lib.types).toHaveLength(0)
  })
})
