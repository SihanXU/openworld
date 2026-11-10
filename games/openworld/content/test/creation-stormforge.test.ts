import { afterEach, describe, expect, it } from 'vitest'
import {
  Game, RuleLibrary, appendWorkshopPlan, buildSandbox, installWorkshopMechanismProvider, registerWorkshopPackage,
  removeWorkshopMechanismProvider, researchCapabilities, restoreLibrary, restoreWorkshopPackages,
  runWorkshopUse, trialWorkshopPackage, workshopMechanismProviders,
  type Engine, type WorkshopDraft, type WorldIndex,
} from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'
import stormforge from '../src/creation-mechanisms/stormforge.ts'

const L = (en: string) => ({ en, zh: en })
const PACKAGE = 'stormfang'
const FUSED = `creation_${PACKAGE}_r1_stormfused`

const engines: Engine[] = []
function world(type = 'item/weapon/magic/wand') {
  const eng = buildSandbox({ terrain: Array.from({ length: 7 }, () => Array(14).fill('grass')), entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 3, props: { hp: 100, maxHp: 100, hunger: 100, maxHunger: 100, ...(type === 'item/weapon/blade/sword' && { profession: 'warrior' }) } },
    { key: 'blade', type, x: 2, y: 3, inside: 'actor' },
    { key: 'skeleton', type: 'actor/creature/undead/skeleton', x: 3, y: 3, props: { hp: 100, maxHp: 100 } },
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  engines.push(eng)
  return eng
}
const draft = (): WorkshopDraft => ({
  id: PACKAGE, revision: 1, typeId: 'item/weapon/magic/wand',
  plan: { version: 1, uses: [
    { id: 'fuse', capability: 'stormfuse', target: 'self', label: L('Fuse'), params: { mode: 'fuse' } },
    { id: 'split', capability: 'stormfuse', target: 'self', label: L('Split'), params: { mode: 'split' } },
    { id: 'strike', capability: 'stormstrike', target: 'creature', label: L('Storm strike'), params: { power: 3 } },
    { id: 'inspect', capability: 'inspect', target: 'self', label: L('Inspect') },
  ] },
})
function adopt(eng: ReturnType<typeof world>) {
  installWorkshopMechanismProvider(stormforge, engines)
  const report = trialWorkshopPackage(eng, draft())
  expect(report.errors, JSON.stringify(report)).toEqual([])
  expect(registerWorkshopPackage(eng, draft(), report).ok).toBe(true)
}
const elementsOf = (eng: Engine, fn: () => boolean) => {
  const mark = eng.traced
  const ok = fn()
  const trace = eng.trace.slice(-Math.min(eng.traced - mark, eng.trace.length))
  return { ok, elements: trace.filter(t => t.ev.kind === 'impulse/element').map(t => t.ev.params?.element as string) }
}
function reload(eng: ReturnType<typeof world>) {
  const w = eng.world
  const map = structuredClone(w.state.maps.sandbox)
  const index: WorldIndex = { name: 'stormforge', version: '1', seed: 1, start: w.state.spawn, maps: [{ id: 'sandbox', name: 'sandbox', kind: 'sandbox', width: 14, height: 7, portals: [], npcs: 0, items: 0 }], npcs: [], player: structuredClone(w.player), stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 0, fixtures: 0 } }
  const save = JSON.parse(JSON.stringify(new Game(eng).save()))
  const game = Game.load(save, index, buildOntology(), restoreLibrary([...BASE_RULES, ...STORY_RULES], save.library, buildOntology()))
  game.loadMapData(map)
  expect(restoreWorkshopPackages(game.engine)).toEqual([])
  return game.engine
}
afterEach(() => {
  for (const eng of engines) {
    const state = eng.world.state as typeof eng.world.state & { workshopPackages?: { enabled: boolean }[] }
    eng.author(() => { for (const p of state.workshopPackages ?? []) p.enabled = false })
  }
  if (workshopMechanismProviders().some(p => p.id === stormforge.id)) removeWorkshopMechanismProvider(stormforge.id, engines)
  engines.length = 0
})

describe('stormforge fire-thunder blade', () => {
  it('appends switchable fusion to an equipped longsword and keeps its original strike after reload', () => {
    const typeId = 'item/weapon/blade/sword', eng = world(typeId), target = { e: 'skeleton' }
    installWorkshopMechanismProvider(stormforge, engines)
    eng.controls.wear('blade', true)
    const base: WorkshopDraft = { id: PACKAGE, revision: 1, typeId, plan: { version: 1, uses: [
      { id: 'strike', capability: 'attack', target: 'creature', label: L('Strike a monster') },
    ] } }
    const baseline = trialWorkshopPackage(eng, base)
    expect(baseline.errors).toEqual([])
    expect(registerWorkshopPackage(eng, base, baseline).ok).toBe(true)
    const additions = draft().plan
    expect(() => appendWorkshopPlan(base.plan, additions)).toThrow('strike already exists')
    additions.uses = additions.uses.map(use => use.id === 'strike' ? { ...use, id: 'storm_strike' } : use)
    const next = { ...base, revision: 2, appendFrom: 1, plan: appendWorkshopPlan(base.plan, additions) }
    expect(trialWorkshopPackage(eng, { ...next, plan: additions }).errors).toContain('An append must preserve all installed uses')
    const trial = trialWorkshopPackage(eng, next)
    expect(trial.errors, JSON.stringify(trial)).toEqual([])
    expect(trial.uses.find(use => use.id === 'strike')?.trace.some(t => t.kind === 'impulse/strike')).toBe(true)
    expect(registerWorkshopPackage(eng, next, trial).ok).toBe(true)
    expect(registerWorkshopPackage(eng, next, trial).ok).toBe(false)

    const loaded = reload(eng)
    loaded.author(() => loaded.world.setProp(loaded.world.player, 'profession', 'mage'))
    const blocked = trialWorkshopPackage(loaded, { ...next, revision: 3, appendFrom: 2 })
    expect(blocked.errors.some(error => error.startsWith('strike: Combat refused'))).toBe(true)
    expect(blocked.comparisons?.find(comparison => comparison.use === 'strike')?.baseline.errors[0]).toMatch(/Combat refused/)
    loaded.author(() => loaded.world.setProp(loaded.world.player, 'profession', 'warrior'))
    expect(runWorkshopUse(loaded, PACKAGE, 'strike', target, 'blade')).toBe(true)
    expect(loaded.trace.some(t => t.ev.kind === 'act/use' && t.ev.host.e === 'blade' && t.ev.params?.attack === true)).toBe(true)
    expect(runWorkshopUse(loaded, PACKAGE, 'fuse', undefined, 'blade')).toBe(true)
    expect(elementsOf(loaded, () => runWorkshopUse(loaded, PACKAGE, 'storm_strike', target, 'blade'))).toEqual({ ok: true, elements: ['fire', 'lightning'] })
    expect(runWorkshopUse(loaded, PACKAGE, 'split', undefined, 'blade')).toBe(true)
    expect(elementsOf(loaded, () => runWorkshopUse(loaded, PACKAGE, 'storm_strike', target, 'blade'))).toEqual({ ok: true, elements: ['fire'] })
  })

  it('registers stormfuse and stormstrike and admits the use plan through the real trial', () => {
    const eng = world()
    adopt(eng)
    const ids = researchCapabilities().map(c => c.id)
    expect(ids).toContain('stormfuse')
    expect(ids).toContain('stormstrike')
  })

  it('fuses, strikes with fire and lightning, then splits and strikes single fire', () => {
    const eng = world(), w = eng.world
    adopt(eng)
    expect(runWorkshopUse(eng, PACKAGE, 'fuse', undefined, 'blade')).toBe(true)
    expect(w.hasStatus({ e: w.player.id }, FUSED)).toBe(true)
    const fused = elementsOf(eng, () => runWorkshopUse(eng, PACKAGE, 'strike', { e: 'skeleton' }, 'blade'))
    expect(fused.ok).toBe(true)
    expect(fused.elements).toEqual(expect.arrayContaining(['fire', 'lightning']))
    expect(w.hasStatus({ e: 'skeleton' }, 'burning')).toBe(true)
    expect(w.hasStatus({ e: 'skeleton' }, 'electrified')).toBe(true)
    expect(runWorkshopUse(eng, PACKAGE, 'split', undefined, 'blade')).toBe(true)
    expect(w.hasStatus({ e: w.player.id }, FUSED)).toBe(false)
    const single = elementsOf(eng, () => runWorkshopUse(eng, PACKAGE, 'strike', { e: 'skeleton' }, 'blade'))
    expect(single.ok).toBe(true)
    expect(single.elements).toEqual(['fire'])
  })

  it('persists the fusion state and use plan across save/reload', () => {
    const eng = world()
    adopt(eng)
    expect(runWorkshopUse(eng, PACKAGE, 'fuse', undefined, 'blade')).toBe(true)
    const loaded = reload(eng)
    expect(loaded.world.hasStatus({ e: loaded.world.player.id }, FUSED)).toBe(true)
    expect(runWorkshopUse(loaded, PACKAGE, 'split', undefined, 'blade')).toBe(true)
    expect(loaded.world.hasStatus({ e: loaded.world.player.id }, FUSED)).toBe(false)
  })
})
