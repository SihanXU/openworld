// Things the world learns: a patch may bring a new type (a product, a material) with its own
// picture as data. The validator holds its name to the world's conventions and its picture to
// the icon format, and points at what exists when a patch names a type that does not.

import { describe, expect, it } from 'vitest'
import { RuleLibrary, artProblems, buildSandbox, validatePatch, type Patch, type PixelArt, type Rule, type Scenario, type TypeDef } from '@lsw/engine'
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
  kind: 'item',
  name: { en: 'Iron Ingot', zh: '铁锭' },
  tags: ['metal', 'conductive'],
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

  it('points at what exists when a patch names a type that does not', () => {
    expect(check({ artifacts: [{ kind: 'rule', rule: smelt('item/material/iron') }] }).errors.join()).toMatch(/unknown type "item\/material\/iron" — the closest known types: .*item\/material\/iron_ore/)
  })
})
