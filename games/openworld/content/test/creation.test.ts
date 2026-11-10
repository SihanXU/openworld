import { describe, expect, it } from 'vitest'
import '@openworld/modules'
import { Game, ModPort, RuleLibrary, buildSandbox, disableWorkshopPackage, readResearchPlan, registerWorkshopCapability, registerWorkshopPackage, restoreLibrary, restoreWorkshopPackages, runWorkshopUse, trialWorkshopPackage, workshopFlights, workshopPackages, type ResearchPlan, type WorkshopDraft, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, RECIPES, STORY_RULES, buildOntology } from '../src/index.ts'

const L = (en: string) => ({ en, zh: en })
const uses: ResearchPlan['uses'] = [
  { id: 'eat', label: L('Eat'), capability: 'eat', target: 'self' },
  { id: 'gift', label: L('Give'), capability: 'gift', target: 'person' },
  { id: 'look', label: L('Inspect'), capability: 'inspect', target: 'self' },
  { id: 'spread', label: L('Spread'), capability: 'spread', target: 'item', params: { foodBoost: 1, duration: 3 } },
  { id: 'throw', label: L('Throw'), capability: 'throw-coat', target: 'creature', params: { substance: 'wet', duration: 3, power: 2 } },
]
function world(material?: string) {
  const ontology = buildOntology()
  if (material) ontology.types['item/food/berries'] = { ...ontology.types['item/food/berries'], props: { ...ontology.types['item/food/berries'].props, material } }
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { hunger: 0, maxHunger: 100 } },
    { key: 'berry', type: 'item/food/berries', heldBy: 'actor', x: 2, y: 2 },
    { key: 'berry2', type: 'item/food/berries', inside: 'actor', x: 2, y: 2 },
    { key: 'bread', type: 'item/food/bread', x: 2, y: 1 },
    { key: 'slime', type: 'actor/creature/slime/green_slime', x: 1, y: 2 },
    ...['log', 'stone'].flatMap(t => Array.from({ length: 20 }, (_, i) => ({ key: `${t}${i}`, type: `item/material/${t}`, inside: 'actor', x: 2, y: 2 }))),
  ], event: {} }, ontology, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  return { eng, port: new ModPort(eng) }
}
const draft = (revision = 3): WorkshopDraft => ({ id: 'berry-uses', revision, typeId: 'item/food/berries', plan: { version: 1, uses: structuredClone(uses) } })
const state = (eng: ReturnType<typeof world>['eng']) => JSON.stringify({ state: eng.world.state, lib: eng.lib.toJSON(), recipes: [...eng.recipes] })
function adopt(eng: ReturnType<typeof world>['eng'], pkg = draft()) {
  const report = trialWorkshopPackage(eng, pkg, RECIPES)
  expect(report.errors, JSON.stringify(report)).toEqual([])
  expect(registerWorkshopPackage(eng, pkg, report, RECIPES).ok).toBe(true)
  return report
}
function settleFlights(eng: ReturnType<typeof world>['eng']) {
  for (let i = 0; i < 5 && workshopFlights(eng).length; i++) eng.tick()
  expect(workshopFlights(eng)).toEqual([])
}

describe('save-local creation capabilities', () => {
  it('checks real harm for positive-power throws and accepts explicitly harmless coatings', () => {
    const {eng}=world('clay'), candidate=draft()
    const branch=candidate.plan.uses.find(u=>u.capability==='throw-coat')!
    candidate.plan.uses=[branch];branch.target='person';branch.params={substance:'sticky',duration:30,power:1}
    expect(trialWorkshopPackage(eng,candidate).errors.join('; ')).toMatch(/did not harm/)
    branch.params.power=3
    expect(trialWorkshopPackage(eng,candidate).errors.join('; ')).toMatch(/did not harm/)
    expect(trialWorkshopPackage(world('stone').eng,candidate).errors).toEqual([])
    branch.params.power=0
    expect(trialWorkshopPackage(eng,candidate).errors).toEqual([])
  })
  it('runs every branch in isolated worlds and keeps the ordinary Mod port attached', () => {
    const { eng, port } = world()
    const before = state(eng)
    const report = trialWorkshopPackage(eng, draft(), RECIPES)
    expect(report.errors, JSON.stringify(report)).toEqual([])
    expect(report.uses).toHaveLength(5)
    expect(state(eng)).toBe(before)
    expect(eng.undefinedSink).toBe(port)
    expect(registerWorkshopPackage(eng, draft(), report, RECIPES).ok).toBe(true)
    expect(eng.undefinedSink).toBe(port)
  })

  it('spreads onto bread, consumes its source once, then actually feeds the enhanced bread', () => {
    const { eng } = world(), w = eng.world
    adopt(eng)
    const baseFood = w.num(w.get('bread')!, 'food')
    expect(runWorkshopUse(eng, 'berry-uses', 'spread', { e: 'bread' }, 'berry')).toBe(true)
    expect(w.get('berry')).toBeUndefined()
    expect(w.num(w.get('bread')!, 'food')).toBe(baseFood + 1)
    expect(runWorkshopUse(eng, 'berry-uses', 'spread', { e: 'bread' }, 'berry')).toBe(false)
    eng.act('take', 'actor', { e: 'bread' }, { instrument: null, params: { into: 'contents' } })
    const before = w.num(w.player, 'hunger')
    eng.act('use', 'actor', { e: 'actor' }, { instrument: { e: 'bread' } })
    expect(w.num(w.player, 'hunger') - before).toBe(baseFood + 1)
    expect(w.get('bread')).toBeUndefined()
    expect(eng.trace.some(t => t.rule === 'use/eat')).toBe(true)
  })

  it('transfers the actual source nutrition when a spread does not specify foodBoost', () => {
    const { eng } = world(), w = eng.world
    const automatic = draft()
    delete automatic.plan.uses.find(u => u.id === 'spread')!.params!.foodBoost
    adopt(eng, automatic)
    const sourceFood = w.num(w.get('berry')!, 'food'), baseFood = w.num(w.get('bread')!, 'food')
    expect(runWorkshopUse(eng, 'berry-uses', 'spread', { e: 'bread' }, 'berry')).toBe(true)
    expect(w.num(w.get('bread')!, 'food')).toBe(baseFood + sourceFood)
    eng.act('take', 'actor', { e: 'bread' }, { instrument: null, params: { into: 'contents' } })
    const before = w.num(w.player, 'hunger')
    eng.act('use', 'actor', { e: 'actor' }, { instrument: { e: 'bread' } })
    expect(w.num(w.player, 'hunger') - before).toBe(baseFood + sourceFood)
    expect(w.get('berry')).toBeUndefined()
    expect(w.get('bread')).toBeUndefined()
  })

  it('throws onto a creature through existing strike and coat receivers, with a finite status', () => {
    const { eng } = world(), w = eng.world
    adopt(eng)
    const hp = w.num(w.get('slime')!, 'hp', w.num(w.get('slime')!, 'maxHp'))
    expect(runWorkshopUse(eng, 'berry-uses', 'throw', { e: 'slime' }, 'berry2')).toBe(true)
    expect(w.get('berry2')!.place).toEqual({ on: 'none' })
    expect(w.hasStatus({ e: 'slime' }, 'wet')).toBe(false)
    expect(w.num(w.get('slime')!, 'hp', w.num(w.get('slime')!, 'maxHp'))).toBe(hp)
    settleFlights(eng)
    expect(w.get('berry2')).toBeUndefined()
    expect(w.hasStatus({ e: 'slime' }, 'wet')).toBe(true)
    expect(w.num(w.get('slime')!, 'hp', w.num(w.get('slime')!, 'maxHp'))).toBeLessThan(hp)
    expect(eng.trace.some(t => t.ev.kind === 'impulse/strike')).toBe(true)
    expect(eng.trace.some(t => t.rule === 'creation/berry-uses/r3/throw/receive')).toBe(true)
    for (let i = 0; i < 4; i++) eng.tick()
    expect(w.hasStatus({ e: 'slime' }, 'wet')).toBe(false)
  })

  it('makes a sticky coating delay actual movement rather than only adding a marker', () => {
    const { eng } = world(), w = eng.world
    eng.author(() => w.destroy(w.get('slime')!))
    const sticky = draft()
    const use = sticky.plan.uses.find(u => u.id === 'throw')!
    use.target = 'person'; use.params = { substance: 'sticky', duration: 20, power: 0 }
    adopt(eng, sticky)
    const base = eng.combat.delay(w.player, w.num(w.player, 'speed', 2), 'move')
    expect(runWorkshopUse(eng, 'berry-uses', 'throw', { e: 'actor' }, 'berry2')).toBe(true)
    settleFlights(eng)
    const slow = eng.combat.delay(w.player, w.num(w.player, 'speed', 2), 'move')
    expect(slow).toBe(base * 2)
    expect(eng.movePlayer('right')).toBe(true)
    for (let i = 1; i < Math.floor(slow); i++) { eng.tick(); expect(eng.movePlayer('left')).toBe(false) }
    eng.tick()
    expect(eng.movePlayer('left')).toBe(true)
  })

  it('preserves ordinary eating and restores authored rules from package data after sparse save', () => {
    const { eng } = world(), w = eng.world
    adopt(eng)
    const map = structuredClone(w.state.maps.sandbox)
    const index: WorldIndex = { name: 'creation', version: '1', seed: 1, start: w.state.spawn, maps: [{ id: 'sandbox', name: 'sandbox', kind: 'sandbox', width: 5, height: 5, portals: [], npcs: 0, items: 0 }], npcs: [], player: structuredClone(w.player), stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 0, fixtures: 0 } }
    const save = JSON.parse(JSON.stringify(new Game(eng).save()))
    expect(save.library.rules.some((r: { id: string }) => r.id.startsWith('creation/'))).toBe(false)
    const loaded = Game.load(save, index, buildOntology(), restoreLibrary([...BASE_RULES, ...STORY_RULES], save.library, buildOntology()))
    loaded.loadMapData(map)
    expect(restoreWorkshopPackages(loaded.engine)).toEqual([])
    expect(runWorkshopUse(loaded.engine, 'berry-uses', 'look', undefined, 'berry')).toBe(true)
    const mark = loaded.engine.traced
    loaded.engine.act('use', 'actor', { e: 'actor' }, { instrument: { e: 'berry' } })
    expect(loaded.engine.trace.slice(-Math.min(loaded.engine.traced - mark, loaded.engine.trace.length)).some(t => t.rule?.startsWith('use/eat')), JSON.stringify(loaded.engine.trace.slice(-8).map(t => ({ kind: t.ev.kind, rule: t.rule })))).toBe(true)
    expect(loaded.engine.world.get('berry')).toBeUndefined()
  })

  it('rejects stale plans, unknown mechanisms and dependencies without changing the world', () => {
    const { eng } = world()
    const report = trialWorkshopPackage(eng, draft(), RECIPES), before = state(eng)
    const changed = draft(); changed.plan.uses[3].params!.foodBoost = 2
    expect(registerWorkshopPackage(eng, changed, report, RECIPES).ok).toBe(false)
    expect(state(eng)).toBe(before)
    const bad = draft(); bad.plan.uses[0].capability = 'teleport-anything'
    expect(trialWorkshopPackage(eng, bad).ok).toBe(false)
    const missing = draft(); missing.dependsOn = [{ id: 'missing', revision: 1 }]
    expect(trialWorkshopPackage(eng, missing).ok).toBe(false)
    expect(state(eng)).toBe(before)
    expect(() => readResearchPlan({ version: 1, uses: [{ ...uses[0], effects: [{ op: 'eval' }] }] })).toThrow()
  })

  it('updates by a later adopted revision and refuses disable while another package depends on it', () => {
    const { eng } = world()
    adopt(eng)
    const update = draft(7)
    adopt(eng, update)
    expect(workshopPackages(eng).filter(p => p.enabled).map(p => p.revision)).toEqual([7])
    expect(eng.lib.rules.has('creation/berry-uses/r3/look/use')).toBe(false)
    const child: WorkshopDraft = { id: 'dependent', revision: 1, typeId: 'item/food/berries', plan: { version: 1, uses: [uses[2]] }, dependsOn: [{ id: 'berry-uses', revision: 7 }] }
    adopt(eng, child)
    expect(trialWorkshopPackage(eng, draft(9)).errors.some(e => e.includes('pins'))).toBe(true)
    expect(disableWorkshopPackage(eng, 'berry-uses').ok).toBe(false)
    expect(disableWorkshopPackage(eng, 'dependent').ok).toBe(true)
    expect(disableWorkshopPackage(eng, 'berry-uses').ok).toBe(true)
    expect(restoreWorkshopPackages(eng)).toEqual([])
    expect(eng.lib.rules.has('creation/berry-uses/r7/look/use')).toBe(false)
    expect(runWorkshopUse.bind(null, eng, 'berry-uses', 'look')).toThrow()
  })

  it('uses the same registry for a developer-provided compiler and verifier', () => {
    registerWorkshopCapability({
      descriptor: { id: 'test-polish', version: 1, label: L('Polish'), description: L('A test capability'), targets: ['self'], params: {} },
      compile: ctx => ({ effects: [{ op: 'setProp', key: `creation_${ctx.packageId}_shine`, value: true }] }),
      verify: o => (o.after.sourceProps as Record<string, unknown>)['creation_polish-test_shine'] === true ? [] : ['not polished'],
    })
    const { eng } = world()
    const pkg: WorkshopDraft = { id: 'polish-test', revision: 1, typeId: 'item/food/berries', plan: { version: 1, uses: [{ id: 'shine', label: L('Polish'), capability: 'test-polish', target: 'self' }] } }
    adopt(eng, pkg)
    expect(runWorkshopUse(eng, 'polish-test', 'shine', undefined, 'berry')).toBe(true)
    expect(eng.world.prop(eng.world.get('berry')!, 'creation_polish-test_shine')).toBe(true)
  })

  it('trial-crafts a new pick, verifies actual mining and blocks deletion of live type references', () => {
    const { eng } = world()
    const pkg: WorkshopDraft = { id: 'new-pick', revision: 2, typeId: 'item/tool/pickaxe/invention_creation_pick', design: { name: L('Creation pick'), prototype: 'item/tool/pickaxe', ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }, plan: { version: 1, uses: [{ id: 'mine', label: L('Mine'), capability: 'mine', target: 'ground' }] } }
    adopt(eng, pkg)
    expect(eng.controls.count(pkg.typeId)).toBe(1)
    expect(eng.controls.count('item/material/log')).toBe(10)
    expect(disableWorkshopPackage(eng, pkg.id).ok).toBe(false)
  })

  it('delegates a healing drink to the real drink rules', () => {
    const { eng } = world()
    const pkg: WorkshopDraft = { id: 'potion-uses', revision: 1, typeId: 'item/potion/healing', plan: { version: 1, uses: [{ id: 'drink', label: L('Drink'), capability: 'drink', target: 'self' }] } }
    const report = trialWorkshopPackage(eng, pkg)
    expect(report.errors, JSON.stringify(report)).toEqual([])
    expect(report.uses[0].trace.some(t => t.rule === 'use/drink')).toBe(true)
  })

  it('rechecks available materials at adoption and keeps a refused adoption atomic', () => {
    const { eng } = world()
    const pkg: WorkshopDraft = { id: 'stock-check', revision: 1, typeId: 'item/tool/pickaxe/invention_stock_check', design: { name: L('Stock pick'), prototype: 'item/tool/pickaxe', ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }, plan: { version: 1, uses: [{ id: 'mine', label: L('Mine'), capability: 'mine', target: 'ground' }] } }
    const report = trialWorkshopPackage(eng, pkg, RECIPES)
    expect(report.ok, JSON.stringify(report)).toBe(true)
    eng.author(() => { for (let i = 0; i < 11; i++) eng.world.destroy(eng.world.get(`log${i}`)!) })
    eng.controls.sync()
    const before = state(eng)
    expect(registerWorkshopPackage(eng, pkg, report, RECIPES).ok).toBe(false)
    expect(state(eng)).toBe(before)
  })

  it('rejects distant, cross-map and wall-obscured targets without spending the item', () => {
    const { eng } = world(), w = eng.world
    adopt(eng)
    eng.author(() => w.place(w.get('slime')!, { on: 'tile', map: 'away', x: 2, y: 2 }))
    expect(runWorkshopUse(eng, 'berry-uses', 'throw', { e: 'slime' }, 'berry2')).toBe(false)
    expect(w.get('berry2')).toBeDefined()
    eng.author(() => {
      w.place(w.get('slime')!, { on: 'tile', map: 'sandbox', x: 2, y: 4 })
      w.setTerrain('sandbox', 2, 3, 'wall')
    })
    expect(runWorkshopUse(eng, 'berry-uses', 'throw', { e: 'slime' }, 'berry2')).toBe(false)
    expect(w.get('berry2')).toBeDefined()
    eng.author(() => {
      w.setTerrain('sandbox', 2, 3, 'grass')
    })
    const short = draft(4)
    short.plan.uses.find(u => u.id === 'throw')!.params!.range = 1
    adopt(eng, short)
    expect(runWorkshopUse(eng, 'berry-uses', 'throw', { e: 'slime' }, 'berry2')).toBe(false)
    expect(w.get('berry2')).toBeDefined()
  })
})
