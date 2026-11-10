import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, buildSandbox, exportWorkshopPackage, prepareWorkshopImport, registerWorkshopPackage, restoreLibrary, restoreWorkshopPackages, runWorkshopUse, trialWorkshopPackage, workshopChannelState, type WorkshopDraft, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const elements = ['fire', 'wind', 'water', 'earth'] as const
const draft = (): WorkshopDraft => ({ id: 'elemental-focus', revision: 1, typeId: 'item/valuable/amulet', plan: { version: 1, uses: [
  { id: 'wear', capability: 'wear', target: 'self', label: 'Wear' },
  ...elements.map(element => ({ id: element, capability: 'channel', target: 'creature', label: element, params: { element, cooldown: 10, cost: 2 } })),
  { id: 'empower', capability: 'empower', target: 'self', label: 'Convergence', params: { duration: 20, cooldown: 80, cost: 10 } },
] } })
function world() {
  const eng = buildSandbox({ terrain: Array.from({ length: 7 }, () => Array(14).fill('grass')), entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { hp: 100, maxHp: 100, hunger: 100, maxHunger: 100 } },
    { key: 'focus', type: 'item/valuable/amulet', x: 2, y: 3, inside: 'actor' },
    { key: 'skeleton', type: 'actor/creature/undead/skeleton', x: 4, y: 3, props: { hp: 100, maxHp: 100 } },
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  return eng
}
function adopt(eng: ReturnType<typeof world>, pkg = draft()) {
  const before = JSON.stringify({ state: eng.world.state, lib: eng.lib.toJSON() })
  const report = trialWorkshopPackage(eng, pkg)
  expect(report.errors, JSON.stringify(report)).toEqual([])
  expect(JSON.stringify({ state: eng.world.state, lib: eng.lib.toJSON() })).toBe(before)
  expect(registerWorkshopPackage(eng, pkg, report).errors).toEqual([])
  expect(runWorkshopUse(eng, pkg.id, 'wear', undefined, 'focus')).toBe(true)
  return report
}
function reload(eng: ReturnType<typeof world>) {
  const w = eng.world, map = structuredClone(w.state.maps.sandbox)
  const index: WorldIndex = { name: 'channel', version: '1', seed: 1, start: w.state.spawn, maps: [{ id: 'sandbox', name: 'sandbox', kind: 'sandbox', width: 14, height: 7, portals: [], npcs: 0, items: 0 }], npcs: [], player: structuredClone(w.player), stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 0, fixtures: 0 } }
  const save = JSON.parse(JSON.stringify(new Game(eng).save()))
  const game = Game.load(save, index, buildOntology(), restoreLibrary([...BASE_RULES, ...STORY_RULES], save.library, buildOntology()))
  game.loadMapData(map)
  expect(restoreWorkshopPackages(game.engine)).toEqual([])
  return game.engine
}
function released(eng: ReturnType<typeof world>, id = 'elemental-focus') {
  return eng.world.prop(eng.world.player, `creation_${id}_released`)
}
function variantDraft(element: 'water' | 'fire', variantChance: number): WorkshopDraft {
  return { id: 'variant-focus', revision: 1, typeId: 'item/valuable/amulet', plan: { version: 1, uses: [
    { id: 'wear', capability: 'wear', target: 'self', label: 'Wear' },
    { id: 'channel', capability: 'channel', target: 'creature', label: element, params: { element, cooldown: 10, cost: 2, variantChance } },
  ] } }
}
function tickUntilReady(eng: ReturnType<typeof world>) {
  const clocks = workshopChannelState(eng, 'variant-focus')
  while (eng.world.state.tick <= clocks.readyAt || !eng.ready(`atk:${eng.world.player.id}`)) eng.tick()
}

describe('bounded elemental channeling', () => {
  it('trials the four real reactions and finite mode without changing the running world', () => {
    const eng = world(), report = adopt(eng)
    expect(report.uses).toHaveLength(6)
    expect(eng.world.prop(eng.world.player, 'wear:neck')).toBe('focus')
  })

  it.each(elements)('%s changes the actual dungeon creature, pays once and shares the channel clock', element => {
    const eng = world(), w = eng.world
    adopt(eng)
    if (element === 'water') eng.author(() => w.setStatus({ e: 'skeleton' }, 'burning', w.state.tick + 30))
    const pos = w.posOf(w.get('skeleton'))!, hunger = w.num(w.player, 'hunger')
    expect(runWorkshopUse(eng, 'elemental-focus', element, { e: 'skeleton' }, 'focus')).toBe(true)
    expect(w.num(w.get('skeleton')!, 'hp')).toBeLessThan(100)
    expect(w.num(w.player, 'hunger')).toBe(hunger - 2)
    expect(w.prop(w.player, 'wear:neck')).toBe('focus')
    if (element === 'fire') expect(w.hasStatus({ e: 'skeleton' }, 'burning')).toBe(true)
    if (element === 'water') { expect(w.hasStatus({ e: 'skeleton' }, 'wet')).toBe(true); expect(w.hasStatus({ e: 'skeleton' }, 'burning')).toBe(false) }
    if (element === 'wind') expect(w.posOf(w.get('skeleton'))!.x).toBe(pos.x + 2)
    if (element === 'earth') { expect(w.hasStatus({ e: 'skeleton' }, 'stunned')).toBe(true); expect(eng.busy(w.get('skeleton')!)).toBe(true) }
    const after = JSON.stringify(w.state)
    expect(runWorkshopUse(eng, 'elemental-focus', element === 'fire' ? 'water' : 'fire', { e: 'skeleton' }, 'focus')).toBe(false)
    expect(JSON.stringify(w.state)).toBe(after)
  })

  it('saves mode/cooldowns, releases all four, expires to one element and cannot refresh early', () => {
    const eng = world(), w = eng.world
    adopt(eng)
    const def = w.stat(w.player, 'def'), atk = w.stat(w.player, 'atk')
    expect(runWorkshopUse(eng, 'elemental-focus', 'empower', undefined, 'focus')).toBe(true)
    expect(w.num(w.player, 'hunger')).toBe(90)
    expect(w.stat(w.player, 'def')).toBe(def + 1)
    expect(w.stat(w.player, 'atk')).toBe(atk + 2)
    const clocks = workshopChannelState(eng, 'elemental-focus')
    const loaded = reload(eng)
    expect(workshopChannelState(loaded, 'elemental-focus')).toEqual(clocks)
    expect(runWorkshopUse(loaded, 'elemental-focus', 'empower', undefined, 'focus')).toBe(false)
    expect(runWorkshopUse(loaded, 'elemental-focus', 'fire', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(new Set(loaded.trace.filter(t => t.ev.kind === 'impulse/element').map(t => t.ev.params?.element))).toEqual(new Set(elements))
    const again = reload(loaded)
    expect(runWorkshopUse(again, 'elemental-focus', 'water', { e: 'skeleton' }, 'focus')).toBe(false)
    while (again.world.state.tick <= clocks.empoweredUntil) again.tick()
    expect(again.world.stat(again.world.player, 'def')).toBe(def)
    expect(again.world.stat(again.world.player, 'atk')).toBe(atk)
    expect(runWorkshopUse(again, 'elemental-focus', 'empower', undefined, 'focus')).toBe(false)
    again.author(() => again.world.place(again.world.get('skeleton')!, { on: 'tile', map: 'sandbox', x: 4, y: 3 }))
    const mark = again.traced
    expect(runWorkshopUse(again, 'elemental-focus', 'water', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(again.trace.slice(-Math.min(again.traced - mark, again.trace.length)).filter(t => t.ev.kind === 'impulse/element').map(t => t.ev.params?.element)).toEqual(['water'])
  })

  it('refuses unworn, exhausted, protected and obstructed casts without spending or mutating state', () => {
    const eng = world(), w = eng.world
    adopt(eng)
    const rejects = () => { const state = JSON.stringify(w.state); expect(runWorkshopUse(eng, 'elemental-focus', 'fire', { e: 'skeleton' }, 'focus')).toBe(false); expect(JSON.stringify(w.state)).toBe(state) }
    eng.controls.wear('focus'); rejects()
    eng.controls.wear('focus', true)
    eng.author(() => w.setProp(w.player, 'hunger', 1)); rejects()
    eng.author(() => { w.setProp(w.player, 'hunger', 100); w.setTerrain('sandbox', 3, 3, 'wall') }); rejects()
    eng.author(() => w.setTerrain('sandbox', 3, 3, 'grass'))
    w.onto.data.protection = { subjects: [{ id: 'skeleton' }] }
    rejects()
  })

  it('restores a save whose channel capability version is the original 1 metadata', () => {
    // Old saves record capabilityVersions.channel = 1. The variantChance parameter is an optional,
    // default-preserving extension, so the channel descriptor stays at version 1 and such saves must reload.
    const eng = world(), w = eng.world
    adopt(eng)
    const packages = (w.state as { workshopPackages?: { id: string; capabilityVersions: Record<string, number> }[] }).workshopPackages!
    const pkg = packages.find(p => p.id === 'elemental-focus')!
    expect(pkg.capabilityVersions.channel).toBe(1)
    const restored = reload(eng)
    expect(workshopChannelState(restored, 'elemental-focus')).toBeTruthy()
    expect(runWorkshopUse(restored, 'elemental-focus', 'fire', { e: 'skeleton' }, 'focus')).toBe(true)
  })

  it('transfers the same accessory plan as data and reuses its elemental actions', () => {
    const source = world(), target = world()
    adopt(source)
    const imported = prepareWorkshopImport(target, exportWorkshopPackage(source, 'elemental-focus'))
    adopt(target, imported)
    expect(runWorkshopUse(target, imported.id, 'earth', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(target.world.hasStatus({ e: 'skeleton' }, 'stunned')).toBe(true)
  })

  it('does not enlarge the real player stamina capacity to approve an unusable mode', () => {
    const eng = world(), pkg = draft()
    eng.author(() => { eng.world.setProp(eng.world.player, 'maxHunger', 20); eng.world.setProp(eng.world.player, 'hunger', 10) })
    pkg.plan.uses.find(u => u.capability === 'empower')!.params!.cost = 30
    const before = JSON.stringify({ state: eng.world.state, lib: eng.lib.toJSON() })
    const report = trialWorkshopPackage(eng, pkg)
    expect(report.ok).toBe(false)
    expect(report.errors.join()).toContain('fullness capacity (20)')
    expect(JSON.stringify({ state: eng.world.state, lib: eng.lib.toJSON() })).toBe(before)
  })

  it('variantChance 0 keeps the base family and variantChance 1 always releases the variant', () => {
    const base = world(), bw = base.world
    adopt(base, variantDraft('water', 0))
    expect(runWorkshopUse(base, 'variant-focus', 'channel', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(released(base, 'variant-focus')).toBe('water')
    expect(bw.hasStatus({ e: 'skeleton' }, 'wet')).toBe(true)
    expect(bw.hasStatus({ e: 'skeleton' }, 'frozen')).toBe(false)

    const variant = world(), vw = variant.world
    adopt(variant, variantDraft('water', 1))
    variant.author(() => vw.setStatus({ e: 'skeleton' }, 'wet', vw.state.tick + 400))
    expect(runWorkshopUse(variant, 'variant-focus', 'channel', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(released(variant, 'variant-focus')).toBe('ice')
    expect(vw.hasStatus({ e: 'skeleton' }, 'frozen')).toBe(true)

    const storm = world(), sw = storm.world
    adopt(storm, variantDraft('fire', 1))
    storm.author(() => sw.setStatus({ e: 'skeleton' }, 'wet', sw.state.tick + 400))
    expect(runWorkshopUse(storm, 'variant-focus', 'channel', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(released(storm, 'variant-focus')).toBe('lightning')
    expect(sw.hasStatus({ e: 'skeleton' }, 'electrified')).toBe(true)
  })

  it('uses one saved seeded .25 draw and reloads to a deterministic next cast', () => {
    const eng = world(), w = eng.world
    adopt(eng, variantDraft('water', 0.25))
    eng.author(() => w.setStatus({ e: 'skeleton' }, 'wet', w.state.tick + 400))
    const seed = 123456789
    w.state.rng = seed
    const expected = w.rand() < 0.25 ? 'ice' : 'water'
    w.state.rng = seed
    const mark = eng.traced
    expect(runWorkshopUse(eng, 'variant-focus', 'channel', { e: 'skeleton' }, 'focus')).toBe(true)
    const first = released(eng, 'variant-focus')
    expect(first).toBe(expected)
    const events = eng.trace.slice(-Math.min(eng.traced - mark, eng.trace.length))
    expect(events.filter(t => t.ev.kind === 'impulse/element').map(t => t.ev.params?.element)).toEqual([first])
    const bolts = w.fx.filter(f => f.t === 'vfx' && String(f.fx).startsWith(`bolt:${first}:`))
    expect(bolts).toHaveLength(1)

    const a = reload(eng), b = reload(eng)
    tickUntilReady(a); tickUntilReady(b)
    expect(runWorkshopUse(a, 'variant-focus', 'channel', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(runWorkshopUse(b, 'variant-focus', 'channel', { e: 'skeleton' }, 'focus')).toBe(true)
    expect(released(a, 'variant-focus')).toBe(released(b, 'variant-focus'))
  })

  it('resolves exactly one strike and one matching elemental consequence with the drawn bolt', () => {
    const eng = world(), w = eng.world
    adopt(eng)
    const mark = eng.traced
    expect(runWorkshopUse(eng, 'elemental-focus', 'fire', { e: 'skeleton' }, 'focus')).toBe(true)
    const events = eng.trace.slice(-Math.min(eng.traced - mark, eng.trace.length))
    expect(events.filter(t => t.ev.kind === 'impulse/strike')).toHaveLength(1)
    const elemental = events.filter(t => t.ev.kind === 'impulse/element')
    expect(elemental).toHaveLength(1)
    expect(elemental[0].ev.params?.element).toBe('fire')
    expect(released(eng)).toBe('fire')
    expect(w.fx.filter(f => f.t === 'vfx' && String(f.fx).startsWith('bolt:fire:'))).toHaveLength(1)
  })

  it('keeps live RNG unchanged through trial and refused casts', () => {
    const eng = world(), w = eng.world, pkg = draft()
    const rngBefore = w.state.rng
    const report = trialWorkshopPackage(eng, pkg)
    expect(report.errors).toEqual([])
    expect(w.state.rng).toBe(rngBefore)
    expect(registerWorkshopPackage(eng, pkg, report).errors).toEqual([])
    expect(runWorkshopUse(eng, pkg.id, 'wear', undefined, 'focus')).toBe(true)
    eng.author(() => w.setProp(w.player, 'hunger', 1))
    const refusedRng = w.state.rng
    expect(runWorkshopUse(eng, pkg.id, 'fire', { e: 'skeleton' }, 'focus')).toBe(false)
    expect(w.state.rng).toBe(refusedRng)
  })
})
