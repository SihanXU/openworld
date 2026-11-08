import { describe, expect, it } from 'vitest'
import { RuleLibrary, buildSandbox, exportWorkshopPackage, prepareWorkshopImport, prepareWorkshopUpdate, registerWorkshopPackage, runWorkshopUse, trialWorkshopPackage, workshopPackages, type WorkshopDraft } from '@openworld/engine'
import { BASE_RULES, RECIPES, STORY_RULES, buildOntology } from '../src/index.ts'

const L = (en: string) => ({ en, zh: en })
function world() {
  return buildSandbox({ entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2, props: { hunger: 0, maxHunger: 100 } },
    ...['food/berries', 'material/grass', 'material/stone', 'material/log'].flatMap((t, i) => Array.from({ length: 20 }, (_, n) => ({ key: `g${i}_${n}`, type: `item/${t}`, inside: 'actor', x: 2, y: 2 }))),
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
}
function adopt(eng: ReturnType<typeof world>, draft: WorkshopDraft) {
  const report = trialWorkshopPackage(eng, draft, RECIPES)
  expect(report.errors, JSON.stringify(report)).toEqual([])
  const r = registerWorkshopPackage(eng, draft, report, RECIPES)
  expect(r.errors).toEqual([])
  return r.package!
}
const snapshot = (eng: ReturnType<typeof world>) => JSON.stringify({ world: eng.world.state, lib: eng.lib.toJSON(), recipes: [...eng.recipes] })
function jam(): WorkshopDraft {
  return { id: 'portable-jam', revision: 4, typeId: 'item/food/invention_portable_jam', design: { kind: 'new', name: L('Transfer-test jam'), idea: 'A portable berry preserve.', type: { id: 'item/food/invention_portable_jam', name: L('Transfer-test jam'), tags: ['edible', 'portable'], props: { heal: 2, food: 3, material: 'plant', value: 4 }, makeup: [{ type: 'item/food/berries', count: 3 }, { type: 'item/material/grass', count: 1 }], station: 'hands', art: { grid: Array(16).fill('aaaaaaaaaaaaaaaa'), palette: { a: '#a03366' } } } }, plan: { version: 1, uses: [{ id: 'eat', label: L('Eat'), capability: 'eat', target: 'self' }, { id: 'spread', label: L('Spread'), capability: 'spread', target: 'item' }] } }
}

describe('portable creation packages', () => {
  it('updates imported uses without recreating the item, charging its recipe or dropping independent local additions', () => {
    const source = world(), destination = world()
    adopt(source, jam())
    const imported = prepareWorkshopImport(destination, exportWorkshopPackage(source, 'portable-jam'), RECIPES)
    adopt(destination, imported)
    const item = Object.values(destination.world.state.entities).find(e => e.type === imported.typeId)!
    const local = structuredClone(imported.plan)
    local.uses.push({ id: 'local-note', label: L('Local note'), capability: 'inspect', target: 'self' })
    adopt(destination, { id: imported.id, revision: 2, typeId: imported.typeId, plan: local })
    const revised = structuredClone(jam().plan)
    revised.uses.push({ id: 'look', label: L('Look'), capability: 'inspect', target: 'self' })
    adopt(source, { id: 'portable-jam', revision: 5, typeId: jam().typeId, plan: revised })
    const before = snapshot(destination), stock = destination.controls.count('item/food/berries')
    const file = exportWorkshopPackage(source, 'portable-jam'), update = prepareWorkshopUpdate(destination, file)
    expect(update).toMatchObject({ id: imported.id, typeId: imported.typeId, revision: 3 })
    expect(update.design).toBeUndefined()
    expect(update.plan.uses.map(u => u.id)).toEqual(['eat', 'spread', 'local-note', 'look'])
    expect(snapshot(destination)).toBe(before)
    const report = trialWorkshopPackage(destination, update, RECIPES)
    expect(report.ok, JSON.stringify(report)).toBe(true)
    expect(snapshot(destination)).toBe(before)
    expect(registerWorkshopPackage(destination, update, report, RECIPES).ok).toBe(true)
    expect(destination.world.get(item.id)?.type).toBe(imported.typeId)
    expect(destination.controls.count(imported.typeId)).toBe(1)
    expect(destination.controls.count('item/food/berries')).toBe(stock)
    const installed = workshopPackages(destination).find(p => p.id === imported.id && p.enabled)!
    expect(installed.kind).toBe('item')
    expect(installed.typeDefinition?.art).toEqual(file.typeDefinition?.art)
    expect(installed.origin).toMatchObject({ id: 'portable-jam', revision: 5, typeId: jam().typeId })
    expect(installed.origin?.plan?.uses.some(u => u.id === 'local-note')).toBe(false)
    expect(runWorkshopUse(destination, imported.id, 'look', undefined, item.id)).toBe(true)
    expect(() => prepareWorkshopUpdate(destination, file)).toThrow(/newer/)
  })

  it('links legacy imports explicitly and refuses competing use edits or item-definition changes without mutation', () => {
    const source = world(), destination = world()
    adopt(source, jam())
    const imported = prepareWorkshopImport(destination, exportWorkshopPackage(source, 'portable-jam'), RECIPES)
    adopt(destination, imported)
    destination.author(() => {
      const state = destination.world.state as typeof destination.world.state & { workshopPackages: { origin?: unknown }[] }
      for (const p of state.workshopPackages) delete p.origin
    })
    const revised = structuredClone(jam().plan)
    revised.uses.push({ id: 'look', label: L('Look'), capability: 'inspect', target: 'self' })
    adopt(source, { id: 'portable-jam', revision: 5, typeId: jam().typeId, plan: revised })
    const file = exportWorkshopPackage(source, 'portable-jam'), before = snapshot(destination)
    expect(() => prepareWorkshopUpdate(destination, file)).toThrow(/Choose/)
    const update = prepareWorkshopUpdate(destination, file, { packageId: imported.id })
    expect(update.origin?.revision).toBe(5)
    expect(snapshot(destination)).toBe(before)
    const changedDefinition = structuredClone(file)
    changedDefinition.typeDefinition!.props!.food = 9
    expect(() => prepareWorkshopUpdate(destination, changedDefinition, { packageId: imported.id })).toThrow(/migration/)
    const local = structuredClone(imported.plan)
    local.uses[0].label = L('Local eat')
    adopt(destination, { id: imported.id, revision: 2, typeId: imported.typeId, plan: local })
    file.plan.uses[0].label = L('Upstream eat')
    const beforeConflict = snapshot(destination)
    expect(() => prepareWorkshopUpdate(destination, file, { packageId: imported.id })).toThrow(/Conflicting.*eat/)
    expect(snapshot(destination)).toBe(beforeConflict)
  })

  it('maps imported dependencies to their local identities and retains provenance in exports', () => {
    const source = world(), destination = world()
    const base: WorkshopDraft = { id: 'base-uses', revision: 1, typeId: 'item/food/berries', plan: { version: 1, uses: [{ id: 'inspect-base', label: L('Inspect base'), capability: 'inspect', target: 'self' }] } }
    adopt(source, base)
    const imported = prepareWorkshopImport(destination, exportWorkshopPackage(source, base.id))
    adopt(destination, imported)
    adopt(source, { id: 'dependent-uses', revision: 1, typeId: 'item/food/berries', dependsOn: [{ id: base.id, revision: 1 }], plan: { version: 1, uses: [{ id: 'inspect-child', label: L('Inspect child'), capability: 'inspect', target: 'self' }] } })
    const child = prepareWorkshopImport(destination, exportWorkshopPackage(source, 'dependent-uses'))
    expect(child.dependsOn).toEqual([{ id: imported.id, revision: 1 }])
    adopt(destination, child)
    expect(exportWorkshopPackage(destination, imported.id).manifest.origin).toMatchObject({ id: base.id, revision: 1 })
  })

  it('exports a food package, imports without mutation, trial-crafts with receiving resources and actually eats it', () => {
    const source = world(), destination = world()
    adopt(source, jam())
    const sourceBefore = snapshot(source), before = snapshot(destination)
    const file = JSON.parse(JSON.stringify(exportWorkshopPackage(source, 'portable-jam')))
    const originalDesign = jam().design!
    expect(file.typeDefinition.art).toEqual(originalDesign.kind === 'new' ? originalDesign.type!.art : undefined)
    const draft = prepareWorkshopImport(destination, file, RECIPES)
    expect(draft.id).toBe('import-portable-jam')
    expect(draft.typeId).not.toBe(jam().typeId)
    expect(snapshot(destination)).toBe(before)
    const report = trialWorkshopPackage(destination, draft, RECIPES)
    expect(report.errors).toEqual([])
    expect(snapshot(destination)).toBe(before)
    expect(registerWorkshopPackage(destination, draft, report, RECIPES).ok).toBe(true)
    expect(destination.controls.count('item/food/berries')).toBe(17)
    expect(destination.controls.count('item/material/grass')).toBe(19)
    const item = Object.values(destination.world.state.entities).find(e => e.type === draft.typeId)!
    const hunger = destination.world.num(destination.world.player, 'hunger')
    expect(runWorkshopUse(destination, draft.id, 'eat', undefined, item.id)).toBe(true)
    expect(destination.world.num(destination.world.player, 'hunger') - hunger).toBe(3)
    expect(destination.world.get(item.id)).toBeUndefined()
    expect(snapshot(source)).toBe(sourceBefore)
    expect(() => prepareWorkshopImport(destination, file, RECIPES)).toThrow(/already/)
  })

  it('rejects executable fields, unknown capability versions, invalid materials and out-of-family numbers', () => {
    const source = world(), destination = world()
    adopt(source, jam())
    const file = exportWorkshopPackage(source, 'portable-jam'), before = snapshot(destination)
    expect(() => prepareWorkshopImport(destination, { ...file, script: 'eval(1)' }, RECIPES)).toThrow()
    const version = structuredClone(file); version.manifest.capabilityVersions.eat = 999
    expect(() => prepareWorkshopImport(destination, version, RECIPES)).toThrow(/version/)
    const material = structuredClone(file); material.typeDefinition!.makeup![0].type = 'item/material/not_in_this_game'
    expect(() => prepareWorkshopImport(destination, material, RECIPES)).toThrow(/materials/)
    const power = structuredClone(file); power.typeDefinition!.props!.food = 999
    expect(() => prepareWorkshopImport(destination, power, RECIPES)).toThrow()
    const dependency = structuredClone(file); dependency.manifest.dependsOn = [{ id: 'absent', revision: 1 }]
    expect(() => prepareWorkshopImport(destination, dependency, RECIPES)).toThrow(/dependency/)
    expect(snapshot(destination)).toBe(before)
  })

  it('keeps a variant bound to its native craft instead of importing its stats as a new family member', () => {
    const source = world(), destination = world()
    adopt(source, { id: 'portable-pick', revision: 1, typeId: 'item/tool/pickaxe/invention_portable_pick', design: { name: L('Transfer-test pick'), prototype: 'item/tool/pickaxe', ingredients: [{ type: 'item/material/stone', count: 10 }, { type: 'item/material/log', count: 10 }] }, plan: { version: 1, uses: [{ id: 'mine', label: L('Mine'), capability: 'mine', target: 'ground' }] } })
    const file = exportWorkshopPackage(source, 'portable-pick')
    const draft = prepareWorkshopImport(destination, file, RECIPES)
    expect(draft.design?.kind).not.toBe('new')
    adopt(destination, draft)
    expect(destination.controls.count(draft.typeId)).toBe(1)
    const bad = structuredClone(file); bad.typeDefinition!.props!.power = 999
    expect(() => prepareWorkshopImport(world(), bad, RECIPES)).toThrow(/variant/)
  })

  it('requires an existing subject for added-use packages and rechecks resources at the receiving trial', () => {
    const source = world(), destination = world()
    adopt(source, { id: 'berry-inspect', revision: 1, typeId: 'item/food/berries', plan: { version: 1, uses: [{ id: 'look', label: L('Inspect'), capability: 'inspect', target: 'self' }] } })
    const uses = exportWorkshopPackage(source, 'berry-inspect')
    expect(prepareWorkshopImport(destination, uses).design).toBeUndefined()
    adopt(destination, prepareWorkshopImport(destination, uses))
    expect(prepareWorkshopImport(destination, uses).id).toBe('import-berry-inspect-2')
    expect(() => prepareWorkshopImport(destination, { ...uses, typeId: 'item/food/unknown' })).toThrow(/subject/)
    adopt(source, jam())
    const draft = prepareWorkshopImport(destination, exportWorkshopPackage(source, 'portable-jam'), RECIPES)
    destination.author(() => { for (const e of [...Object.values(destination.world.state.entities)]) if (e.type === 'item/food/berries') destination.world.destroy(e) })
    destination.controls.sync()
    const before = snapshot(destination)
    expect(trialWorkshopPackage(destination, draft, RECIPES).ok).toBe(false)
    expect(snapshot(destination)).toBe(before)
  })

  it('imports a native-researched family whose recipes are named set pieces, not ordinary crafts', () => {
    const equippedWorld = () => {
      const eng = world()
      eng.author(() => {
        eng.world.create('fixture/craft/anvil', { on: 'tile', map: 'sandbox', x: 1, y: 2 })
        for (const type of ['leather', 'iron_ingot', 'cloth', 'stick']) for (let i = 0; i < 10; i++) eng.world.create(`item/material/${type}`, { on: 'inside', holder: eng.world.player.id })
      })
      return eng
    }
    const source = equippedWorld(), destination = equippedWorld()
    const pkg: WorkshopDraft = { id: 'portable-bracer', revision: 1, typeId: 'item/clothing/belt/invention_portable_bracer', design: { kind: 'new', name: L('Transfer-test bracer'), idea: 'A wearable bracer, independent of named set bonuses.', type: { id: 'item/clothing/belt/invention_portable_bracer', name: L('Transfer-test bracer'), tags: ['portable', 'wearable', 'clothing'], props: { def: 1, slot: 'arm', material: 'leather', value: 15 }, makeup: [{ type: 'item/material/leather', count: 1 }, { type: 'item/material/iron_ingot', count: 1 }, { type: 'item/material/stone', count: 1 }, { type: 'item/material/cloth', count: 1 }, { type: 'item/material/stick', count: 1 }], station: 'anvil' } }, plan: { version: 1, uses: [{ id: 'wear', label: L('Wear'), capability: 'wear', target: 'self' }] } }
    // Native research accepts this family: its ordinary recipe set is empty.
    adopt(source, pkg)
    const file = exportWorkshopPackage(source, pkg.id), before = snapshot(destination)
    const imported = prepareWorkshopImport(destination, file, RECIPES)
    expect(snapshot(destination)).toBe(before)
    expect(imported.design?.kind).toBe('new')
    adopt(destination, imported)
    expect(destination.controls.count(imported.typeId)).toBe(1)
    const item = Object.values(destination.world.state.entities).find(e => e.type === imported.typeId)!
    expect(runWorkshopUse(destination, imported.id, 'wear', undefined, item.id)).toBe(true)
    expect(destination.world.prop(destination.world.player, 'wear:arm')).toBe(item.id)
  })
})
