import { describe, expect, it } from 'vitest'
import { CRAFTSPERSON, OntologyIndex, ResearchProblem, buildSandbox, inventionId, madeOf, ModPort, RuleLibrary, readResearchReply, readResearchRequest, researchCatalogue, trialResearch, type PixelArt, type ResearchDesign, type TypeDef } from '@openworld/engine'
import { BASE_RULES, RECIPES, STORY_RULES, buildOntology } from '../src/index.ts'

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
    trialResearch(eng, port, { name: { en: 'A material-aware pick', zh: 'A material-aware pick' }, prototype, ingredients: [
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
    const proposal = { name: { en: 'Free treasure', zh: 'Free treasure' }, prototype: 'item/weapon/blade/dragonsbane', ingredients: [{ type: 'item/material/log', count: 1 }] }
    expect(() => trialResearch(eng, port, proposal, `${proposal.prototype}/invention_cheat`)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.lib.types).toHaveLength(0)
  })
  it('says why a recipe is refused as a code, for the panel to say in the player\'s language', () => {
    const { eng, port } = world()
    const cheap = { name: { en: 'A one-log pick', zh: 'A one-log pick' }, prototype: 'item/tool/pickaxe', ingredients: [{ type: 'item/material/log', count: 1 }] }
    let caught: unknown
    try {
      trialResearch(eng, port, cheap, `${cheap.prototype}/invention_cheap`)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ResearchProblem)
    expect((caught as ResearchProblem).code).toBe('cheap')
  })
  it('rejects an unaffordable trial without spending or learning anything', () => {
    const { eng, port } = world()
    const prototype = researchCatalogue(eng).prototypes.find((id) => eng.recipes.get(id)?.station === 'hands')!
    const before = JSON.stringify(eng.world.state)
    const design = { name: { en: 'Oversized pack', zh: 'Oversized pack' }, prototype, ingredients: [{ type: 'item/material/log', count: 64 }, { type: 'item/material/stone', count: 64 }] }
    expect(() => trialResearch(eng, port, design, `${prototype}/invention_unaffordable`)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.lib.types).toHaveLength(0)
  })
  it('cannot learn the same invention twice or spend its materials a second time', () => {
    const { eng, port } = world()
    const prototype = researchCatalogue(eng).prototypes.find((id) => eng.recipes.get(id)?.station === 'hands')!
    const design = { name: { en: 'One trial', zh: 'One trial' }, prototype, ingredients: [{ type: 'item/material/log', count: 10 }, { type: 'item/material/stone', count: 10 }] }
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
    const design = { name: { en: 'Workshop axe', zh: 'Workshop axe' }, prototype, ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }
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
    const design = { name: { en: 'Skilled axe', zh: 'Skilled axe' }, prototype, ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }
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
    const design = { name: { en: 'A different axe', zh: 'A different axe' }, prototype, ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }
    const before = JSON.stringify(eng.world.state)
    expect(() => trialResearch(eng, port, design, id)).toThrow()
    expect(JSON.stringify(eng.world.state)).toBe(before)
    expect(eng.controls.count(id)).toBe(0)
    expect(eng.recipes.has(id)).toBe(false)
    expect(eng.world.onto.data.types[id]).toBeUndefined()
    expect(eng.lib.types).toHaveLength(0)
  })

  // ---------------------------------------------------------------- a new kind, and a variant drawn as itself

  /** A bag with berries and a log in it, as one who wants a jam carries. */
  function pantry() {
    const eng = buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...Array.from({ length: 12 }, (_, i) => ({ key: `berry${i}`, type: 'item/food/berries', inside: 'actor', x: 2, y: 2 })),
      ...Array.from({ length: 6 }, (_, i) => ({ key: `log${i}`, type: 'item/material/log', inside: 'actor', x: 2, y: 2 })),
    ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    return { eng, port: new ModPort(eng) }
  }
  const DOT: PixelArt = { grid: Array.from({ length: 16 }, (_, y) => (y >= 5 && y < 11 ? '.....aaaaaa.....' : '................')), palette: { a: '#aa3355' } }
  const jam = (over: Partial<TypeDef> = {}): TypeDef => ({
    id: 'item/food/berry_jam', name: { en: 'Berry Jam', zh: '浆果酱' }, tags: ['edible', 'fruit', 'sticky', 'glowing'],
    props: { food: 50, heal: 2, material: 'plant', value: 999 }, makeup: [{ type: 'item/food/berries', count: 6 }], station: 'hands', art: DOT, ...over,
  })
  const newDesign = (type: TypeDef): ResearchDesign => ({ kind: 'new', name: type.name as { en: string; zh: string }, idea: 'a jam of berries, to eat on the road', type })

  it('makes a new kind the craftsperson thought needed, held to what its family has: numbers no higher, no tag it has not, worth what went in', () => {
    const { eng, port } = pantry()
    const design = newDesign(jam())
    const id = inventionId(design, 'jam-1')
    expect(id).toBe('item/food/invention_jam_1')
    const made = trialResearch(eng, port, design, id)
    // no more filling than the most filling food worth no more than six berries
    const cost = 6 * Number(eng.world.onto.resolve('item/food/berries').props.value)
    const foods = Object.keys(eng.world.onto.data.types).filter((k) => k.startsWith('item/food/') && k !== id).map((k) => eng.world.onto.resolve(k)).filter((r) => Number(r.props.value) <= cost)
    expect(made.props?.food).toBe(Math.max(...foods.map((r) => Number(r.props.food) || 0)))
    expect(made.props?.food).toBeLessThan(50)
    expect(made.tags).not.toContain('glowing')
    // worth no more than six berries
    expect(made.props?.value).toBe(6 * Number(eng.world.onto.resolve('item/food/berries').props.value))
    expect(made.art).toEqual(DOT)
    expect(made.researched).toBe(true)
    expect(eng.controls.count(id)).toBe(1)
  })

  it('refuses a new kind in a family no craftsperson makes, or with a number its family has none of', () => {
    for (const [type, code] of [[jam({ id: 'item/key/berry_key' }), 'refused'], [jam({ props: { food: 3, material: 'plant', flight: 9 } }), 'refused']] as const) {
      const { eng, port } = pantry()
      const design = newDesign(type)
      let caught: unknown
      try {
        trialResearch(eng, port, design, inventionId(design, 'x'))
      } catch (err) {
        caught = err
      }
      expect((caught as ResearchProblem).code).toBe(code)
      expect(eng.lib.types).toHaveLength(0)
    }
  })

  it('buys a new kind\'s numbers with what goes into it: two sticks make no dragon-slaying blade', () => {
    const eng = buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...Array.from({ length: 4 }, (_, i) => ({ key: `stick${i}`, type: 'item/material/stick', inside: 'actor', x: 2, y: 2 })),
      ...Array.from({ length: 60 }, (_, i) => ({ key: `log${i}`, type: 'item/material/log', inside: 'actor', x: 2, y: 2 })),
    ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const blade = (makeup: TypeDef['makeup']): ResearchDesign => newDesign({ id: 'item/weapon/blade/stick_blade', name: { en: 'Stick Blade', zh: '棍刃' }, tags: ['sharp'], props: { power: 99, material: 'wood' }, makeup, station: 'hands' })
    let caught: unknown
    try {
      trialResearch(eng, new ModPort(eng), blade([{ type: 'item/material/stick', count: 2 }]), 'item/weapon/blade/invention_s')
    } catch (err) {
      caught = err
    }
    expect((caught as ResearchProblem).code).toBe('cheap')
    const made = trialResearch(eng, new ModPort(eng), blade([{ type: 'item/material/log', count: 10 }]), 'item/weapon/blade/invention_l')
    const weapons = Object.keys(eng.world.onto.data.types).filter((k) => k.startsWith('item/weapon/') && !k.includes('invention')).map((k) => eng.world.onto.resolve(k)).filter((r) => !r.tags.includes('quality:legendary') && r.props.relic === undefined)
    expect(made.props?.power).toBe(Math.max(...weapons.filter((r) => Number(r.props.value) <= 20).map((r) => Number(r.props.power) || 0)))
    expect(made.props?.power).toBeLessThan(Math.max(...weapons.map((r) => Number(r.props.power) || 0)))
    // nor, from any amount, a legend's numbers or a relic's name
    const legend = trialResearch(eng, new ModPort(eng), newDesign({ id: 'item/weapon/blade/log_legend', name: { en: 'Log Legend', zh: '原木传奇' }, props: { power: 99, material: 'wood' }, makeup: [{ type: 'item/material/log', count: 30 }], station: 'hands' }), 'item/weapon/blade/invention_g')
    expect(legend.props?.power).toBeLessThan(26)
    expect(() => trialResearch(eng, new ModPort(eng), newDesign({ id: 'item/weapon/blade/fake_bane', name: { en: 'Fake Bane', zh: '假屠龙' }, props: { power: 1, material: 'wood', relic: 'dragonsbane' }, makeup: [{ type: 'item/material/log', count: 10 }], station: 'hands' }), 'item/weapon/blade/invention_r')).toThrow(/relic/)
  })

  it('says every problem of a new kind at once, so a designer mends them in one round', () => {
    const { eng, port } = pantry()
    const hat = newDesign({ id: 'item/clothing/hat/grass_hat', name: { en: 'Grass Hat', zh: '草帽' }, props: { material: 'plant', defense: 1, warmth: 2 }, makeup: [{ type: 'item/food/berries', count: 1 }], station: 'hands' })
    let caught: ResearchProblem | undefined
    try {
      trialResearch(eng, port, hat, 'item/clothing/hat/invention_g')
    } catch (err) {
      caught = err as ResearchProblem
    }
    expect(caught?.code).toBe('cheap')
    expect(caught?.message).toMatch(/so little.*"defense" is not.*"warmth" is not/)
  })

  it('inherits nothing it has not bought: no child of a legend, and a parent\'s numbers held to what its makeup buys', () => {
    const smithy = () => buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...Array.from({ length: 30 }, (_, i) => ({ key: `log${i}`, type: 'item/material/log', inside: 'actor', x: 2, y: 2 })),
      ...Array.from({ length: 4 }, (_, i) => ({ key: `ingot${i}`, type: 'item/material/iron_ingot', inside: 'actor', x: 2, y: 2 })),
    ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    // twenty logs once bought a child of Dragonsbane: its power, its level, the relic and the legend, all inherited
    const eng = smithy()
    const copy = newDesign({ id: 'item/weapon/blade/dragonsbane/log_copy', name: { en: 'Log Copy', zh: '原木复制' }, props: { material: 'wood' }, makeup: [{ type: 'item/material/log', count: 20 }], station: 'hands' })
    expect(() => trialResearch(eng, new ModPort(eng), copy, 'item/weapon/blade/dragonsbane/invention_c')).toThrow(/ordinary family/)
    expect(eng.controls.count('item/material/log')).toBe(30)
    // a sword of four logs: the sword's own power, above what four logs buy among weapons, is held down too
    const eng2 = smithy()
    const onto = eng2.world.onto
    const sword = newDesign({ id: 'item/weapon/blade/sword/log_sword', name: { en: 'Log Sword', zh: '原木剑' }, props: { material: 'wood' }, makeup: [{ type: 'item/material/log', count: 4 }], station: 'hands' })
    const made = trialResearch(eng2, new ModPort(eng2), sword, 'item/weapon/blade/sword/invention_i')
    const cost = 4 * Number(onto.resolve('item/material/log').props.value)
    const kin = Object.keys(onto.data.types).filter((k) => k.startsWith('item/weapon/') && !k.includes('invention')).map((k) => onto.resolve(k)).filter((r) => !r.tags.includes('quality:legendary') && r.props.relic === undefined && Number(r.props.value) <= cost)
    const resolved = onto.resolve(made.id).props
    expect(Number(resolved.power)).toBeLessThanOrEqual(Math.max(...kin.map((r) => Number(r.props.power) || 0)))
    expect(Number(resolved.power)).toBeLessThan(Number(onto.resolve('item/weapon/blade/sword').props.power))
    expect(Number(resolved.value)).toBeLessThanOrEqual(cost)
  })

  it('builds on the game\'s own crafts, not on what the engine happened to hold: an anvil\'s dagger, never a shop\'s offer', () => {
    const eng = buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'anvil', type: 'fixture/furniture/table', x: 3, y: 2, tags: ['station:anvil'] },
      { key: 'hammer', type: 'item/tool/smith_hammer', inside: 'actor', x: 2, y: 2 },
      ...Array.from({ length: 4 }, (_, i) => ({ key: `bar${i}`, type: 'item/material/steel_bar', inside: 'actor', x: 2, y: 2 })),
      ...Array.from({ length: 4 }, (_, i) => ({ key: `plank${i}`, type: 'item/material/plank', inside: 'actor', x: 2, y: 2 })),
    ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const dagger = 'item/weapon/blade/dagger'
    // the engine holds a game recipe only once it is crafted: without the game's, the anvil's dagger is not on offer
    expect(researchCatalogue(eng).prototypes).not.toContain(dagger)
    const offered = researchCatalogue(eng, RECIPES).prototypes
    expect(offered).toContain(dagger)
    // what a shop sells for coin is no craft to build on (unless it is also made of goods)
    const madeOfGoods = new Set(RECIPES.filter((r) => r.needs.every((n) => /^item\/(material|food|gem)\//.test(n.type))).map((r) => r.make.type))
    const bought = RECIPES.filter((r) => r.needs.some((n) => n.type === 'item/misc/thornmark') && !madeOfGoods.has(r.make.type)).map((r) => r.make.type)
    expect(offered.filter((t) => bought.includes(t))).toEqual([])
    // and a new kind of a thing the anvil makes is no way around the anvil: it is a variant of the dagger
    const around = { kind: 'new' as const, name: { en: 'Hand Dirk', zh: '手制短剑' }, idea: 'a dagger made by hand', type: { id: `${dagger}/hand_dirk`, name: { en: 'Hand Dirk', zh: '手制短剑' }, props: { material: 'steel' }, makeup: [{ type: 'item/material/steel_bar', count: 2 }], station: 'hands' } }
    expect(() => trialResearch(eng, new ModPort(eng), around, `${dagger}/invention_h`, RECIPES)).toThrow(/made at its own craft/)
    // the service is told which kinds a craft makes (to hold its design to it), the robe not among them: its one recipe is a set piece
    const crafted = researchCatalogue(eng, RECIPES).crafted ?? []
    expect(crafted).toContain(dagger)
    expect(crafted).not.toContain('item/clothing/robe')
    expect(readResearchRequest({ npc: 'Garrick', message: 'x', history: [], catalogue: researchCatalogue(eng, RECIPES) }).catalogue.crafted).toEqual(crafted)
    const made = trialResearch(eng, new ModPort(eng), { kind: 'variant', name: { en: 'Steel Dirk', zh: '钢短剑' }, prototype: dagger, ingredients: [{ type: 'item/material/steel_bar', count: 2 }, { type: 'item/material/plank', count: 1 }] }, `${dagger}/invention_d`, RECIPES)
    expect(made.props?.material).toBe('steel')
    expect(eng.controls.count(made.id)).toBe(1)
  })

  it('tells the craftsperson what the player makes already (a torch of a stick and grass), never what is bought for coin; another make of it is its variant', () => {
    const eng = buildSandbox({ entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      ...['stick', 'grass', 'cloth'].flatMap((m) => Array.from({ length: 4 }, (_, i) => ({ key: `${m}${i}`, type: `item/material/${m}`, inside: 'actor', x: 2, y: 2 }))),
    ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const torch = 'item/light/torch'
    const c = researchCatalogue(eng, RECIPES)
    expect(c.makes).toContainEqual({ type: torch, needs: [{ type: 'item/material/stick', count: 1 }, { type: 'item/material/grass', count: 1 }], station: 'hands' })
    expect(c.makes!.flatMap((m) => m.needs).some((n) => n.type === 'item/misc/thornmark')).toBe(false)
    // the Starweave Robe is a set piece, not the plain robe one makes
    expect(c.makes!.map((m) => m.type)).not.toContain('item/clothing/robe')
    expect(readResearchRequest({ npc: 'Garrick', message: 'x', history: [], catalogue: c }).catalogue.makes).toEqual(c.makes)
    expect(() => readResearchRequest({ npc: 'Garrick', message: 'x', history: [], catalogue: { ...c, makes: [{ type: torch, needs: [{ type: 'item/material/stick', count: 0 }], station: 'hands' }] } })).toThrow(/catalogue/)
    // a torch of cloth for grass is the torch's variant, lit as a torch is
    expect(c.prototypes).toContain(torch)
    const made = trialResearch(eng, new ModPort(eng), { kind: 'variant', name: { en: 'Cloth Torch', zh: '布火把' }, prototype: torch, ingredients: [{ type: 'item/material/stick', count: 1 }, { type: 'item/material/cloth', count: 1 }] }, `${torch}/invention_c`, RECIPES)
    expect(made.id).toBe(`${torch}/invention_c`)
    expect(eng.world.onto.resolve(made.id).tags).toContain('fire-source')
    expect(eng.controls.count(made.id)).toBe(1)
  })

  it('never sends a designer to a craft research may not build on: a locked candle is the game\'s own', () => {
    const { eng, port } = world()
    const candle = 'item/light/candle'
    expect(researchCatalogue(eng, RECIPES).crafted).toContain(candle)
    expect(researchCatalogue(eng, RECIPES).prototypes).not.toContain(candle)
    const design: ResearchDesign = { kind: 'new', name: { en: 'Log Candle', zh: '木蜡烛' }, idea: 'a candle', type: { id: `${candle}/log_candle`, name: { en: 'Log Candle', zh: '木蜡烛' }, props: { material: 'wood' }, makeup: [{ type: 'item/material/log', count: 2 }], station: 'hands' } }
    expect(() => trialResearch(eng, port, design, `${candle}/invention_l`, RECIPES)).toThrow(/the game's own craft/)
  })

  it('says a variant needs a material to begin with, before anything is tried (berries hold no edge)', () => {
    const { eng, port } = pantry()
    const design: ResearchDesign = { name: { en: 'Berrybrand Axe', zh: 'Berrybrand Axe' }, prototype: 'item/weapon/blade/axe', ingredients: [{ type: 'item/food/berries', count: 10 }, { type: 'item/material/log', count: 4 }] }
    let caught: unknown
    try {
      trialResearch(eng, port, design, inventionId(design, 'b'))
    } catch (err) {
      caught = err
    }
    expect((caught as ResearchProblem).code).toBe('material')
  })

  it('keeps a variant\'s own picture, and reads a new kind and its picture from a reply (a bad picture is refused)', () => {
    const { eng, port } = world()
    const design: ResearchDesign = { name: { en: 'Drawn Pick', zh: 'Drawn Pick' }, prototype: 'item/tool/pickaxe', ingredients: [{ type: 'item/material/stone', count: 14 }, { type: 'item/material/log', count: 3 }], art: DOT }
    expect(trialResearch(eng, port, design, inventionId(design, 'd')).art).toEqual(DOT)
    const catalogue = { prototypes: [], materials: ['item/food/berries'], stations: ['hands'] }
    expect(readResearchReply({ reply: { en: 'A jam!', zh: 'A jam!' }, design: newDesign(jam()) }, catalogue).design).toMatchObject({ kind: 'new', type: { id: 'item/food/berry_jam', art: DOT } })
    expect(() => readResearchReply({ reply: { en: 'A jam!', zh: 'A jam!' }, design: newDesign(jam({ art: { grid: ['x'], palette: {} } as PixelArt })) }, catalogue)).toThrow(/picture/)
  })

  it('carries the offered prototypes\' icons to the service (to be edited), and nothing else; a bad icon is refused', () => {
    const body = (icons: unknown) => ({ npc: 'Garrick', message: 'an iron axe', history: [], catalogue: { prototypes: ['item/weapon/blade/axe'], materials: ['item/material/iron_ingot'], stations: ['hands'], icons } })
    expect(readResearchRequest(body({ 'item/weapon/blade/axe': DOT, 'item/tool/hoe': DOT })).catalogue.icons).toEqual({ 'item/weapon/blade/axe': DOT })
    expect(() => readResearchRequest(body({ 'item/weapon/blade/axe': { grid: ['.'], palette: {} } }))).toThrow(/picture/)
  })

  it('counts a thing made at one\'s feet, as any craft leaves it when the bag has no room', () => {
    const { eng, port } = world()
    const design: ResearchDesign = { name: { en: 'Full Pick', zh: 'Full Pick' }, prototype: 'item/tool/pickaxe', ingredients: [{ type: 'item/material/stone', count: 14 }, { type: 'item/material/log', count: 3 }] }
    const id = inventionId(design, 'f')
    const full = eng.controls.count.bind(eng.controls)
    // a bag with no room: what is made is set down where one stands
    eng.controls.count = (type: string) => (type === id ? 0 : full(type))
    expect(() => trialResearch(eng, port, design, id)).not.toThrow()
  })
})

