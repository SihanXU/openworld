// Things the world learns: a patch may bring a new type (a product, a material) with its own
// picture as data. The validator holds its name to the world's conventions and its picture to
// the icon format, and points at what exists when a patch names a type that does not.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, artProblems, buildSandbox, validatePatch, type Patch, type PixelArt, type Rule, type Scenario, type TypeDef } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

const INGOT_ART: PixelArt = {
  grid: [
    '................',
    '................',
    '................',
    '....kkkkkkkkk...',
    '...kaaeaaaaaak..',
    '..kaeaaaaaaabk..',
    '.kaaaaaaaaabbck.',
    'kbbbbbbbbbbbcck.',
    'kbbbbbbbbbbccdk.',
    'kbccbbbbbbbccdk.',
    'kcccccccccccddk.',
    'kccccccccccddk..',
    '.kkkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  palette: { k: '#141b1b', e: '#eef2f0', a: '#b9c1c6', b: '#8a949c', c: '#5e6870', d: '#3e464e' },
}

const ingot = (over: Partial<TypeDef> = {}): TypeDef => ({
  id: 'item/material/iron_ingot',
  name: { en: 'Iron Ingot', zh: '铁锭' },
  tags: ['metal', 'conductive'],
  props: { material: 'iron' },
  makeup: [{ type: 'item/material/iron_ore', count: 1 }],
  sprite: 'art:item/material/iron_ingot',
  art: INGOT_ART,
  ...over,
})

/** Iron ore used on a lit forge becomes the new ingot. */
const smelt = (into = 'item/material/iron_ingot'): Rule => ({
  id: 'patch/iron-ore-smelts',
  host: { type: 'item/material/iron_ore' },
  on: 'act/use',
  doc: 'Iron ore used on a lit forge is smelted into an ingot.',
  tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/forge', status: ['lit'] } } }, then: { do: [{ op: 'transform', into }, { op: 'vfx', at: 'target', fx: 'sparks' }] } },
})

const scenario: Scenario = {
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: 'item/material/iron_ore', x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: 'fixture/craft/forge', x: 2, y: 1, statuses: ['lit'] },
  ],
  event: { kind: 'act/use', actor: 'actor', instrument: 'held', target: 'it', host: 'held' },
}

const check = (patch: Patch) => validatePatch(patch, { ontology: onto, library: lib(), scenario })

describe('a patch that brings a new thing', () => {
  it('may define a new type with its own picture and make it', () => {
    const res = check({ artifacts: [{ kind: 'type', type: ingot() }, { kind: 'rule', rule: smelt() }] })
    expect(res.errors).toEqual([])
    // and the world can hold it: the engine resolves the ore into the new ingot
    const eng = buildSandbox(scenario, onto, lib())
    eng.lib.addType(ingot())
    eng.world.onto.addType(ingot())
    eng.lib.add(smelt())
    eng.act('use', 'actor', { e: 'it' })
    expect(eng.world.get('held')!.type).toBe('item/material/iron_ingot')
  })

  it('names it by the world\'s conventions: new, under a parent that exists, snake_case, in both languages', () => {
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(ingot({ id: 'item/material/iron_ore' }))).toMatch(/exists already/)
    expect(errors(ingot({ id: 'item/metals/iron_ingot' }))).toMatch(/parent "item\/metals" does not exist/)
    expect(errors(ingot({ id: 'item/material/IronIngot' }))).toMatch(/snake_case/)
    expect(errors(ingot({ name: { en: 'Iron Ingot', zh: '' } }))).toMatch(/both languages/)
    expect(errors(ingot({ name: 'Iron Ingot' as never }))).toMatch(/both languages/)
  })

  it('says what it is made of (material and makeup), and is never a new kind of ground', () => {
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(ingot({ props: {} }))).toMatch(/props\.material/)
    expect(errors(ingot({ makeup: undefined }))).toMatch(/makeup/)
    expect(errors(ingot({ makeup: [{ type: 'item/material/iron', count: 1 }] }))).toMatch(/makeup\[0\]: unknown type "item\/material\/iron"/)
    expect(errors(ingot({ id: 'tile/frost_crust', name: { en: 'Frost Crust', zh: '霜壳' } }))).toMatch(/new kind of ground/)
  })

  it('requires positive safe integers for makeup counts, keeping chance separate', () => {
    for (const count of [0.5, 0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const res = check({ artifacts: [{ kind: 'type', type: ingot({ makeup: [{ type: 'item/material/iron_ore', count }] }) }, { kind: 'rule', rule: smelt() }] })
      expect(res.errors.join(), String(count)).toMatch(/makeup\[0\]\.count.*positive safe integer/)
    }
    expect(check({ artifacts: [{ kind: 'type', type: ingot({ makeup: [{ type: 'item/material/iron_ore', count: 1, chance: 0.5 }] }) }, { kind: 'rule', rule: smelt() }] }).ok).toBe(true)
  })

  it('refuses invalid recipe counts at execution, and consumes one ingredient for one craft', () => {
    const scene = structuredClone(scenario)
    scene.entities.find((e) => e.key === 'held')!.heldBy = undefined
    scene.entities.find((e) => e.key === 'held')!.inside = 'actor'
    for (const count of [0.5, 0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1]) {
      const eng = buildSandbox(scene, onto, lib())
      eng.world.onto.addType(ingot())
      eng.recipes.set('test/ingot', { id: 'test/ingot', name: 'Ingot', sprite: ingot().id, needs: [{ type: 'item/material/iron_ore', count }], make: { type: ingot().id }, station: 'hands' })
      for (let i = 0; i < 3; i++) eng.act('craft', 'actor', { e: 'actor' }, { instrument: null, params: { recipe: 'test/ingot' } })
      const made = Object.values(eng.world.state.entities).filter((e) => e.type === ingot().id && eng.world.get(e.id))
      expect(made.length, String(count)).toBe(count === 1 ? 1 : 0)
      expect(!!eng.world.get('held'), String(count)).toBe(count !== 1)
    }
  })

  it('is not another name for something the world has', () => {
    const coal = ingot({ id: 'item/material/black_rock', name: { en: 'Coal', zh: '黑石' } })
    expect(check({ artifacts: [{ kind: 'type', type: coal }, { kind: 'rule', rule: smelt(coal.id) }] }).errors.join()).toMatch(/"item\/material\/coal" already is this thing/)
  })

  it('draws a valid 16x16 picture', () => {
    expect(artProblems(INGOT_ART)).toEqual([])
    expect(artProblems({ ...INGOT_ART, grid: INGOT_ART.grid.slice(1) }).join()).toMatch(/16 strings/)
    expect(artProblems({ ...INGOT_ART, palette: { ...INGOT_ART.palette, k: 'black' } }).join()).toMatch(/#rrggbb/)
    expect(artProblems({ ...INGOT_ART, palette: { a: '#ffffff' } }).join()).toMatch(/not in the palette/)
    expect(artProblems({ grid: Array(16).fill('.'.repeat(16)), palette: { a: '#ffffff' } }).join()).toMatch(/almost nothing/)
  })

  it('arrives in the hand that waited for it: the held ore becomes the ingot, in the same slot', () => {
    const eng = buildSandbox(scenario, onto, lib())
    eng.world.player.facing = 'up'
    eng.controls.sync()
    const port = new ModPort(eng)
    port.provider = { resolve: () => new Promise(() => {}) }
    eng.act('use', 'actor', { e: 'it' }, { instrument: { e: 'held' } })
    const rec = port.records[0]
    const slot = eng.world.player.selected!
    port.submit(rec.id, { artifacts: [{ kind: 'type', type: ingot() }, { kind: 'rule', rule: smelt() }] })
    const held = eng.world.get(eng.world.player.held!)!
    expect(held.type).toBe('item/material/iron_ingot')
    expect(eng.world.player.slots![slot]).toBe(eng.controls.key(held))
  })

  it('can be crafted as soon as it is learned, when it says where it is made', () => {
    const eng = buildSandbox(scenario, onto, lib())
    const port = new ModPort(eng)
    const nail = { id: 'item/material/iron_nail', name: { en: 'Iron Nail', zh: '铁钉' }, props: { material: 'iron' }, makeup: [{ type: 'item/material/iron_ore', count: 1 }], station: 'hands' } as TypeDef
    expect(eng.recipes.has(nail.id)).toBe(false)
    port.submit(undefined, { artifacts: [{ kind: 'type', type: nail }, { kind: 'rule', rule: { ...smelt(nail.id), id: 'patch/ore-to-nail' } }] })
    expect(eng.recipes.get(nail.id)).toMatchObject({ needs: [{ type: 'item/material/iron_ore', count: 1 }], station: 'hands' })
  })

  it('points at what exists when a patch names a type that does not', () => {
    expect(check({ artifacts: [{ kind: 'rule', rule: smelt('item/material/iron') }] }).errors.join()).toMatch(/unknown type "item\/material\/iron" — the closest known types: .*item\/material\/iron_ore/)
  })
})

describe('a patch that brings a status', () => {
  it('cannot redefine a base status or change an already frozen actor', () => {
    const patch: Patch = { artifacts: [{ kind: 'status', status: { id: 'frozen', duration: 1, immobilize: false } }, { kind: 'rule', rule: smelt('item/material/iron_ore') }] }
    const eng = buildSandbox({ ...scenario, entities: scenario.entities.map((e) => e.key === 'actor' ? { ...e, statuses: ['frozen'] } : e) }, onto, lib())
    const port = new ModPort(eng)
    expect(eng.busy(eng.world.get('actor')!)).toBe(true)
    const result = port.submit(undefined, patch)
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toMatch(/status.*frozen.*different definition/)
    expect(eng.busy(eng.world.get('actor')!)).toBe(true)
  })

  it('cannot redefine a shared status or an earlier status in the same patch', () => {
    const status = { id: 'test_still', duration: 30, immobilize: true }
    const library = lib()
    library.addStatus(status)
    const changed = { ...status, immobilize: false }
    expect(validatePatch({ artifacts: [{ kind: 'status', status: changed }] }, { ontology: onto, library }).errors.join()).toMatch(/different definition/)
    expect(check({ artifacts: [{ kind: 'status', status }, { kind: 'status', status: changed }] }).errors.join()).toMatch(/different definition/)
  })

  it('accepts identical definitions regardless of object key order', () => {
    const frozen = onto.statuses.frozen
    const reordered = Object.fromEntries(Object.entries(frozen).reverse()) as typeof frozen
    const status = { id: 'test_still', props: { speed: 1, def: 2 }, duration: 30 }
    const library = lib()
    library.addStatus(status)
    expect(validatePatch({ artifacts: [{ kind: 'status', status: reordered }, { kind: 'status', status: { duration: 30, props: { def: 2, speed: 1 }, id: status.id } }] }, { ontology: onto, library }).ok).toBe(true)
    expect(validatePatch({ artifacts: [{ kind: 'status', status }, { kind: 'status', status: structuredClone(status) }] }, { ontology: onto, library: lib() }).ok).toBe(true)
  })
})
