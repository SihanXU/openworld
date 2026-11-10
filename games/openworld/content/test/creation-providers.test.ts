import { afterEach, describe, expect, it } from 'vitest'
import {
  RuleLibrary, buildSandbox, disableWorkshopPackage, installWorkshopMechanismProvider, removeWorkshopMechanismProvider,
  reconcileWorkshopMechanismProviders, researchCapabilities, runWorkshopUse, trialWorkshopPackage, registerWorkshopPackage, workshopMechanismProviders,
  type Engine, type WorkshopCapability, type WorkshopDraft, type WorkshopMechanismProvider,
} from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const L = (en: string) => ({ en, zh: en })
const engines: Engine[] = []
const installed: string[] = []
function world() {
  const eng = buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'berry', type: 'item/food/berries', inside: 'actor', x: 2, y: 2 },
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  engines.push(eng)
  return eng
}
function provider(id: string, capabilityId = `${id}-mark`, version = 1): WorkshopMechanismProvider {
  return { id, version, capabilities: [{ descriptor: { id: capabilityId, version, label: L('Mark'), description: L('Mark this source once.'), targets: ['self'], params: {} },
    compile: ctx => ({ effects: [{ op: 'setProp', key: `creation_${ctx.packageId}_providerMark`, value: version }] }),
    verify: o => o.trace.some(t => t.kind === 'act/use') ? [] : ['No actual use ran'],
  }] }
}
function install(p: WorkshopMechanismProvider) {
  const info = installWorkshopMechanismProvider(p, engines)
  if (!installed.includes(p.id)) installed.push(p.id)
  return info
}
afterEach(() => {
  for (const eng of engines) {
    const state = eng.world.state as typeof eng.world.state & { workshopPackages?: { enabled: boolean }[] }
    eng.author(() => { for (const p of state.workshopPackages ?? []) p.enabled = false })
  }
  for (const id of installed.reverse()) if (workshopMechanismProviders().some(p => p.id === id)) removeWorkshopMechanismProvider(id, engines)
  installed.length = engines.length = 0
})

describe('trusted mechanism provider lifecycle', () => {
  it('installs an owned compiler, runs its actual use and refuses removal until its content is disabled', () => {
    const eng = world(), p = provider('provider-mark')
    const info = install(p)
    expect(info.capabilities.map(c => c.id)).toEqual(['provider-mark-mark'])
    expect(installWorkshopMechanismProvider(p, engines)).toEqual(info)
    const draft: WorkshopDraft = { id: 'provider-berry', revision: 1, typeId: 'item/food/berries', plan: { version: 1, uses: [{ id: 'mark', label: L('Mark'), capability: 'provider-mark-mark', target: 'self' }] } }
    const report = trialWorkshopPackage(eng, draft)
    expect(report.errors).toEqual([])
    expect(registerWorkshopPackage(eng, draft, report).ok).toBe(true)
    expect(runWorkshopUse(eng, draft.id, 'mark', undefined, 'berry')).toBe(true)
    expect(eng.world.prop(eng.world.get('berry')!, 'creation_provider-berry_providerMark')).toBe(1)
    expect(() => removeWorkshopMechanismProvider(p.id, engines)).toThrow(/Package provider-berry/)
    expect(() => installWorkshopMechanismProvider(provider(p.id, 'provider-mark-mark', 2), engines)).toThrow(/Package/)
    expect(disableWorkshopPackage(eng, draft.id).ok).toBe(true)
    removeWorkshopMechanismProvider(p.id, engines)
    expect(researchCapabilities().some(c => c.id === 'provider-mark-mark')).toBe(false)
    expect(() => runWorkshopUse(eng, draft.id, 'mark', undefined, 'berry')).toThrow(/not enabled/)
  })

  it('checks builtin collisions atomically and requires versioned upgrades', () => {
    const before = researchCapabilities()
    const bad = provider('collision-provider')
    bad.capabilities.push({ ...bad.capabilities[0], descriptor: { ...bad.capabilities[0].descriptor, id: 'eat', version: 99 } })
    expect(() => installWorkshopMechanismProvider(bad, [])).toThrow(/builtin/)
    expect(researchCapabilities()).toEqual(before)
    const first = provider('upgrade-provider')
    install(first)
    expect(() => installWorkshopMechanismProvider(provider(first.id), engines)).toThrow(/newer version/)
    const second = provider(first.id, 'upgrade-provider-mark', 2)
    expect(install(second).version).toBe(2)
    expect(researchCapabilities().find(c => c.id === 'upgrade-provider-mark')?.version).toBe(2)
    second.capabilities[0].compile = () => ({ effects: [] })
    expect(() => installWorkshopMechanismProvider(second, engines)).toThrow(/newer version/)
  })

  it('keeps provider dependency removal ordered and rejects invalid code handlers', () => {
    const base = provider('provider-base'), child = provider('provider-child')
    install(base)
    child.dependsOn = [{ id: base.id, version: 1 }]
    install(child)
    expect(() => removeWorkshopMechanismProvider(base.id, engines)).toThrow(/Provider provider-child/)
    expect(() => installWorkshopMechanismProvider(provider(base.id, 'provider-base-mark', 2), engines)).toThrow(/Provider provider-child/)
    const invalid = provider('invalid-provider')
    invalid.capabilities[0] = { descriptor: invalid.capabilities[0].descriptor } as WorkshopCapability
    expect(() => installWorkshopMechanismProvider(invalid, engines)).toThrow(/compiler/)
    const owners = new Map([[base.id, 'base.ts'], [child.id, 'child.ts']])
    const before = researchCapabilities()
    expect(() => reconcileWorkshopMechanismProviders(owners, [{ file: 'invalid.ts', provider: invalid }], engines)).toThrow(/compiler/)
    expect(researchCapabilities()).toEqual(before)
    expect(workshopMechanismProviders().map(p => p.id)).toEqual([base.id, child.id])
    expect(reconcileWorkshopMechanismProviders(owners, [], engines).size).toBe(0)
    expect(workshopMechanismProviders()).toEqual([])
  })
})
