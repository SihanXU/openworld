import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, buildSandbox, creationPlanProblems, exportWorkshopPackage, prepareWorkshopImport, registerWorkshopPackage, researchCapabilities, restoreLibrary, restoreWorkshopPackages, runWorkshopUse, trialWorkshopPackage, weaponOf, type ResearchUse, type WorkshopDraft, type WorldIndex } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const use = (capability: string, target = 'creature'): ResearchUse => ({ id: capability, label: { en: capability, zh: capability }, capability, target })
const draft = (typeId: string, branch: ResearchUse): WorkshopDraft => ({ id: `native-${branch.capability}`, revision: 1, typeId, plan: { version: 1, uses: [branch] } })
function world(type: string, profession?: string) {
  return buildSandbox({ terrain: Array.from({ length: 4 }, () => Array(8).fill('grass')), entities: [
    { key: 'actor', type: 'actor/person/player', x: 1, y: 1, props: { hp: 100, maxHp: 100, hunger: 100, maxHunger: 100, ...(profession && { profession }) } },
    { key: 'food', type: 'item/food/berries', x: 1, y: 1, heldBy: 'actor' },
    { key: 'old-weapon', type: 'item/weapon/blunt/mace', x: 1, y: 1, inside: 'actor' },
    { key: 'source', type, x: 1, y: 1, inside: 'actor' },
    { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1, props: { hp: 100, maxHp: 100 } },
  ], event: {} }, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
}
function adopt(eng: ReturnType<typeof world>, pkg: WorkshopDraft) {
  const before = JSON.stringify({ world: eng.world.state, lib: eng.lib.toJSON() })
  const report = trialWorkshopPackage(eng, pkg)
  expect(report.errors, JSON.stringify(report)).toEqual([])
  expect(JSON.stringify({ world: eng.world.state, lib: eng.lib.toJSON() })).toBe(before)
  expect(registerWorkshopPackage(eng, pkg, report).errors).toEqual([])
  return report
}
function reload(eng: ReturnType<typeof world>) {
  const w = eng.world, map = structuredClone(w.state.maps.sandbox)
  const index: WorldIndex = { name: 'creation-native', version: '1', seed: 1, start: w.state.spawn, maps: [{ id: 'sandbox', name: 'sandbox', kind: 'sandbox', width: 8, height: 4, portals: [], npcs: 0, items: 0 }], npcs: [], player: structuredClone(w.player), stats: { maps: 1, npcs: 0, creatures: 0, items: 0, itemKinds: 0, fixtures: 0 } }
  const save = JSON.parse(JSON.stringify(new Game(eng).save()))
  const game = Game.load(save, index, buildOntology(), restoreLibrary([...BASE_RULES, ...STORY_RULES], save.library, buildOntology()))
  game.loadMapData(map)
  expect(restoreWorkshopPackages(game.engine)).toEqual([])
  return game.engine
}

describe('native creation capability adapters', () => {
  it('selects the exact bag weapon, deals damage and respects cooldown, then works natively after loading', () => {
    const eng = world('item/weapon/blunt/club'), w = eng.world
    adopt(eng, draft('item/weapon/blunt/club', use('attack')))
    eng.controls.sync()
    eng.controls.swap(w.player.slotItems!.findIndex(group => group?.includes('source')), 12)
    expect(w.player.held).toBe('food')
    expect(runWorkshopUse(eng, 'native-attack', 'attack', { e: 'slime' }, 'source')).toBe(true)
    expect(weaponOf(w, w.player)?.id).toBe('source')
    const hp = w.num(w.get('slime')!, 'hp')
    expect(hp).toBeLessThan(100)
    expect(eng.trace.some(t => t.ev.kind === 'act/use' && t.ev.host.e === 'source' && t.ev.params?.attack === true)).toBe(true)
    expect(runWorkshopUse(eng, 'native-attack', 'attack', { e: 'slime' }, 'source')).toBe(false)
    expect(w.num(w.get('slime')!, 'hp')).toBe(hp)
    const loaded = reload(eng), target = loaded.world.get('slime')!
    loaded.controls.face(loaded.world.posOf(target)!)
    loaded.playerAttack({ e: target.id })
    expect(loaded.world.num(target, 'hp')).toBeLessThan(hp)
    expect(loaded.trace.some(t => t.rule === 'use/weapon')).toBe(true)
  })

  it('wears armour into its real slot, applies defence, keeps it on repeat and persists', () => {
    const eng = world('item/armor/helmet'), w = eng.world
    const candidate = draft('item/armor/helmet', use('wear', 'self'))
    candidate.plan.uses.push(use('inspect', 'self'))
    const report = adopt(eng, candidate)
    expect((report.uses[0].observed.after as { worn: boolean }).worn).toBe(true)
    const def = w.stat(w.player, 'def'), hp = w.num(w.player, 'hp')
    expect(runWorkshopUse(eng, 'native-wear', 'wear', undefined, 'source')).toBe(true)
    expect(w.prop(w.player, 'wear:head')).toBe('source')
    expect(runWorkshopUse(eng, 'native-wear', 'inspect', undefined, 'source')).toBe(true)
    expect(w.prop(w.player, 'wear:head')).toBe('source')
    expect(w.stat(w.player, 'def')).toBe(def + w.num(w.get('source')!, 'def'))
    expect(runWorkshopUse(eng, 'native-wear', 'wear', undefined, 'source')).toBe(true)
    expect(w.prop(w.player, 'wear:head')).toBe('source')
    expect(w.num(w.player, 'hp')).toBe(hp)
    const loaded = reload(eng)
    expect(loaded.world.prop(loaded.world.player, 'wear:head')).toBe('source')
    expect(loaded.world.stat(loaded.world.player, 'def')).toBe(w.stat(w.player, 'def'))
    loaded.controls.wear('source')
    expect(loaded.world.prop(loaded.world.player, 'wear:head')).toBeUndefined()
    expect(loaded.world.stat(loaded.world.player, 'def')).toBe(def)
  })

  it('casts a native elemental spell with bolt feedback and an actual burning target', () => {
    const eng = world('item/weapon/magic/wand'), w = eng.world
    adopt(eng, draft('item/weapon/magic/wand', use('cast')))
    eng.author(() => { w.setProp(w.get('source')!, 'element', 'fire'); w.place(w.get('slime')!, { on: 'tile', map: 'sandbox', x: 4, y: 1 }) })
    expect(runWorkshopUse(eng, 'native-cast', 'cast', { e: 'slime' }, 'source')).toBe(true)
    expect(w.num(w.get('slime')!, 'hp')).toBeLessThan(100)
    expect(w.hasStatus({ e: 'slime' }, 'burning')).toBe(true)
    expect(eng.trace.some(t => t.rule === 'use/spell')).toBe(true)
    expect(eng.trace.some(t => t.ev.kind === 'impulse/element' && t.ev.params?.element === 'fire')).toBe(true)
    expect(w.fx.some(f => f.t === 'vfx' && f.fx.startsWith('bolt:fire:'))).toBe(true)
    const loaded = reload(eng)
    loaded.author(() => loaded.world.clearStatus({ e: 'slime' }, 'burning'))
    loaded.controls.face(loaded.world.posOf(loaded.world.get('slime'))!)
    loaded.playerAttack({ e: 'slime' })
    expect(loaded.world.hasStatus({ e: 'slime' }, 'burning')).toBe(true)
  })

  it('preserves profession restrictions and rejects unsupported source families', () => {
    const eng = world('item/weapon/blade/sword'), w = eng.world
    expect(trialWorkshopPackage(eng, draft('item/weapon/blade/sword', use('attack'))).ok).toBe(false)
    eng.author(() => w.setProp(w.player, 'profession', 'warrior'))
    adopt(eng, draft('item/weapon/blade/sword', use('attack')))
    eng.author(() => w.setProp(w.player, 'profession', 'mage'))
    const before = JSON.stringify(w.state)
    expect(runWorkshopUse(eng, 'native-attack', 'attack', { e: 'slime' }, 'source')).toBe(false)
    expect(JSON.stringify(w.state)).toBe(before)
    const onto = w.onto.data
    for (const cap of ['attack', 'wear', 'cast']) expect(creationPlanProblems({ version: 1, uses: [use(cap, cap === 'wear' ? 'self' : 'creature')] }, onto.types['item/food/berries'], onto).length).toBeGreaterThan(0)
  })

  it('draws the selected magic weapon for an explicit cast at a person', () => {
    const eng = world('item/weapon/magic/wand'), w = eng.world
    const pkg = draft('item/weapon/magic/wand', use('cast', 'person'))
    adopt(eng, pkg)
    let receiver = ''
    eng.author(() => {
      w.setProp(w.get('source')!, 'element', 'fire')
      const person = w.create('actor/person', { on: 'tile', map: 'sandbox', x: 1, y: 2 })
      receiver = person.id
      w.setProp(person, 'hp', 100); w.setProp(person, 'maxHp', 100); w.setProp(person, 'age', 30)
    })
    expect(w.hasStatus({ e: w.player.id }, 'drawn')).toBe(false)
    expect(runWorkshopUse(eng, pkg.id, 'cast', { e: receiver }, 'source')).toBe(true)
    expect(w.hasStatus({ e: w.player.id }, 'drawn')).toBe(true)
    expect(eng.trace.some(t => t.rule === 'use/spell')).toBe(true)
    expect(w.hasStatus({ e: receiver }, 'burning')).toBe(true)
    expect(w.num(w.get(receiver)!, 'hp')).toBeLessThan(100)
  })

  it('imports native capability plans through the existing data-only transfer contract', () => {
    const source = world('item/weapon/magic/wand'), receiving = world('item/weapon/magic/wand')
    adopt(source, draft('item/weapon/magic/wand', use('cast')))
    const imported = prepareWorkshopImport(receiving, JSON.parse(JSON.stringify(exportWorkshopPackage(source, 'native-cast'))))
    adopt(receiving, imported)
    expect(runWorkshopUse(receiving, imported.id, 'cast', { e: 'slime' }, 'source')).toBe(true)
    expect(receiving.world.num(receiving.world.get('slime')!, 'hp')).toBeLessThan(100)
    expect(researchCapabilities().filter(c => ['attack', 'wear', 'cast'].includes(c.id))).toHaveLength(3)
  })
})
