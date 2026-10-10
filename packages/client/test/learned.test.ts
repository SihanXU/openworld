// A learned thing made at hand from its makeup is crafted from the panel like the content's own:
// the worker tells the panel its recipe, and finds it again when the panel's button names it.

import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type Patch, type SaveData } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '@lsw/content'
import { artsToSend, forgetInvalid, forgetStatus, forgetType, learnedRecipes, recipeById, shareKept, sharedPart, takeDefinitions, withKept } from '../src/learned.ts'

const art = { grid: Array.from({ length: 16 }, (_, y) => (y > 3 && y < 12 ? '....aaaaaaaa....' : '................')), palette: { a: '#a0522d' } }
const twine = (station?: string): Patch => ({
  artifacts: [{ kind: 'type', type: { id: 'item/material/twine', name: { en: 'Twine', zh: '麻绳' }, tags: ['fiber'], props: { material: 'plant' }, makeup: [{ type: 'item/material/grass', count: 2 }], ...(station && { station }), art } as never }],
})
const fresh = () => buildSandbox({ terrain: [['grass', 'grass'], ['grass', 'grass']], entities: [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0 }], event: {} }, buildOntology(), new RuleLibrary(BASE_RULES))

describe('learned recipes', () => {
  it('are the recipes of types a patch brought, and are found by id beside the content\'s', () => {
    const eng = fresh()
    expect(learnedRecipes(eng)).toEqual([])
    expect(new ModPort(eng).submit(undefined, twine('hands')).errors).toEqual([])
    expect(learnedRecipes(eng).map((r) => r.id)).toEqual(['item/material/twine'])
    expect(recipeById(eng, 'item/material/twine')?.needs).toEqual([{ type: 'item/material/grass', count: 2 }])
    // the content's own are still found without an engine
    expect(recipeById(undefined, 'fixture/craft/workbench')?.make.type).toBe('fixture/craft/workbench')
  })

  it('a learned thing only a rule makes (no station) has no recipe', () => {
    const eng = fresh()
    expect(new ModPort(eng).submit(undefined, twine()).errors).toEqual([])
    expect(learnedRecipes(eng)).toEqual([])
  })

  it('a type the shared library rolled back is forgotten with its recipe, unless something here is made of it', () => {
    const eng = fresh()
    new ModPort(eng).submit(undefined, twine('hands'))
    expect(forgetType(eng, 'item/material/twine')).toBe(true)
    expect(eng.lib.types).toEqual([])
    expect(eng.world.onto.hasType('item/material/twine')).toBe(false)
    expect(learnedRecipes(eng)).toEqual([])
    expect(recipeById(eng, 'item/material/twine')).toBeUndefined()
    // a twine already made keeps what it is
    const eng2 = fresh()
    new ModPort(eng2).submit(undefined, twine('hands'))
    eng2.author(() => eng2.world.create('item/material/twine', { on: 'inside', holder: 'actor' }))
    expect(forgetType(eng2, 'item/material/twine')).toBe(false)
    expect(eng2.world.onto.hasType('item/material/twine')).toBe(true)
  })

  it('a synced definition of a learned thing replaces the one kept here, and what was made of it becomes the new kind', () => {
    const eng = fresh()
    const port = new ModPort(eng)
    port.submit(undefined, twine())
    eng.author(() => eng.world.create('item/material/twine', { on: 'inside', holder: 'actor' }))
    const corrected = twine('hands')
    ;(corrected.artifacts[0] as { type: { tags: string[] } }).type.tags = ['fiber', 'cordage']
    // without it the client refuses the library's corrected thing ("a type of this id exists already")
    expect(port.submit(undefined, structuredClone(corrected)).ok).toBe(false)
    expect(takeDefinitions(eng, corrected).replaced).toEqual(['item/material/twine'])
    expect(port.submit(undefined, corrected).errors).toEqual([])
    const held = Object.values(eng.world.state.entities).find((e) => e.type === 'item/material/twine')!
    expect(eng.world.onto.resolve(held.type).tags).toContain('cordage')
    expect(learnedRecipes(eng).map((r) => r.id)).toEqual(['item/material/twine'])
    // the same definition again: nothing to replace
    expect(takeDefinitions(eng, corrected).replaced).toEqual([])
  })

  it('puts the old definition back when the patch that brought the new one is not taken', () => {
    const eng = fresh()
    const port = new ModPort(eng)
    port.submit(undefined, twine('hands'))
    eng.author(() => eng.world.create('item/material/twine', { on: 'inside', holder: 'actor' }))
    const bad = twine('hands')
    ;(bad.artifacts[0] as { type: { props: object } }).type.props = {} // no material: refused
    const took = takeDefinitions(eng, bad)
    expect(port.submit(undefined, bad).ok).toBe(false)
    took.restore()
    expect(eng.world.onto.hasType('item/material/twine')).toBe(true)
    expect(recipeById(eng, 'item/material/twine')?.station).toBe('hands')
  })

  it('a save keeps the learned kinds its own things are of, though another game\'s sync forgot them from the shared library', () => {
    // save A: a twine in the bag, and the twine in its copy of the library (and the status on the player)
    const eng = fresh()
    const port = new ModPort(eng)
    port.submit(undefined, twine('hands'))
    port.submit(undefined, { artifacts: [{ kind: 'status', status: { id: 'honeyed', name: { en: 'Honeyed', zh: '抹了蜂蜜' } } }] })
    eng.author(() => (eng.world.create('item/material/twine', { on: 'inside', holder: 'actor' }), eng.world.setStatus({ e: 'actor' }, 'honeyed', 99)))
    const save = { state: eng.world.state, library: eng.lib.toJSON() } as unknown as SaveData
    // the shared library, as save B left it: the twine and the status forgotten (nothing there had them)
    const shared = { ...eng.lib.toJSON(), types: [], statuses: [] }
    const { library, kept } = withKept(shared, save)
    expect(library!.types.map((t) => t.id)).toEqual(['item/material/twine'])
    expect(library!.statuses.map((x) => x.id)).toEqual(['honeyed'])
    // they are this save's: the shared store is written without them, so another save does not get them back
    expect(kept).toEqual({ types: ['item/material/twine'], statuses: ['honeyed'] })
    const back = sharedPart(library!, { types: new Set(kept.types), statuses: new Set(kept.statuses) })
    expect([back.types, back.statuses]).toEqual([[], []])
    // an answer that brings one of them again makes it the library's (and a refused one puts it back)
    const sets = { types: new Set(kept.types), statuses: new Set(kept.statuses) }
    const undo = shareKept(sets, twine('hands'))
    expect([...sets.types]).toEqual([])
    undo()
    expect([...sets.types]).toEqual(['item/material/twine'])
    // what save A has none of stays forgotten; with nothing forgotten the shared library is taken as it is
    const empty = { state: { ...eng.world.state, entities: { actor: { ...eng.world.state.entities.actor, contents: [], statuses: {} } } }, library: eng.lib.toJSON() } as unknown as SaveData
    expect(withKept(shared, empty).library).toBe(shared)
    expect(withKept(undefined, save).library).toBe(save.library)
  })

  it('a learned kind still named is kept: what a kept thing is made of, and the kind a thing here is a kind of', () => {
    const eng = fresh()
    const port = new ModPort(eng)
    port.submit(undefined, twine('hands'))
    // a rope made of twine, and a thing of a kind of twine
    const rope = { id: 'item/material/twine_rope', name: { en: 'Twine Rope', zh: '麻绳索' }, tags: ['fiber'], props: { material: 'plant' }, makeup: [{ type: 'item/material/twine', count: 3 }], art }
    const fine = { id: 'item/material/twine/fine', name: { en: 'Fine Twine', zh: '细麻绳' }, art }
    expect(port.submit(undefined, { artifacts: [{ kind: 'type', type: rope as never }, { kind: 'type', type: fine as never }] }).errors).toEqual([])
    eng.author(() => eng.world.create('item/material/twine_rope', { on: 'inside', holder: 'actor' }))
    // the rope names twine; the fine twine is a kind of it
    expect(forgetType(eng, 'item/material/twine')).toBe(false)
    const save = { state: eng.world.state, library: eng.lib.toJSON() } as unknown as SaveData
    const { kept } = withKept({ ...eng.lib.toJSON(), types: [] }, save)
    expect(kept.types.sort()).toEqual(['item/material/twine', 'item/material/twine_rope'])
  })

  it('takes a corrected thing the library made under a new id and the same name, the old one kept beside it for what is made of it', () => {
    const eng = fresh()
    const port = new ModPort(eng)
    const old = { id: 'item/food/jam', name: { en: 'Berry Jam', zh: '浆果酱' }, tags: ['sweet'], props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/food/berries', count: 1 }], art }
    ;(eng.lib.addType(old as never), eng.world.onto.addType(old as never))
    eng.author(() => eng.world.create('item/food/jam', { on: 'inside', holder: 'actor' }))
    const corrected: Patch = { artifacts: [{ kind: 'type', type: { ...old, id: 'item/food/berry_jam', tags: ['sweet', 'edible'] } as never }] }
    // without stepping the old one aside the client refuses it: "item/food/jam" already is this thing
    expect(port.submit(undefined, structuredClone(corrected)).ok).toBe(false)
    const took = takeDefinitions(eng, corrected)
    expect(port.submit(undefined, corrected).errors).toEqual([])
    took.done()
    expect(eng.lib.types.map((t) => t.id).sort()).toEqual(['item/food/berry_jam', 'item/food/jam'])
    // with nothing made of the old one, it stays forgotten
    const eng2 = fresh()
    ;(eng2.lib.addType(old as never), eng2.world.onto.addType(old as never))
    const took2 = takeDefinitions(eng2, corrected)
    expect(new ModPort(eng2).submit(undefined, corrected).errors).toEqual([])
    took2.done()
    expect(eng2.lib.types.map((t) => t.id)).toEqual(['item/food/berry_jam'])
    // and on the next load the kept one gives way: the library's corrected kind is not judged "the same thing" as it
    expect(forgetInvalid(eng, new Set(['item/food/jam']))).toEqual([])
    expect(eng.lib.types.map((t) => t.id).sort()).toEqual(['item/food/berry_jam', 'item/food/jam'])
  })

  it('forgets on loading what the checks no longer take (a jam kept from an older client, no edible), unless a thing here needs it', () => {
    const eng = fresh()
    const jam = { id: 'item/food/jam', name: { en: 'Berry Jam', zh: '浆果酱' }, tags: ['sweet'], props: { material: 'plant', food: 4 }, makeup: [{ type: 'item/food/berries', count: 1 }], art }
    const good = (twine('hands').artifacts[0] as { type: import('@lsw/engine').TypeDef }).type
    const glued = { id: 'glued', name: { en: 'Glued', zh: '粘住' }, immobilize: true }
    // as an older client kept them: past the checks of the time
    for (const t of [jam, good] as never[]) (eng.lib.addType(t), eng.world.onto.addType(t))
    ;(eng.lib.addStatus(glued as never), eng.world.onto.addStatus(glued as never))
    // and a learned rule that makes the jam (berries into it): it would make a nameless thing without it
    eng.lib.add({ id: 'patch/berries-to-jam', host: { type: 'item/food/berries' }, on: 'act/use', tree: { do: [{ op: 'transform', into: 'item/food/jam' }] }, source: { origin: 'patch' } } as never)
    // (and one that leaves it as an open leaf's default, or bundles it)
    eng.lib.add({ id: 'patch/stick-jam-default', host: { type: 'item/material/stick' }, on: 'act/use', tree: { undefined: true, default: [{ op: 'spawn', type: 'item/food/jam', at: 'host' }] }, source: { origin: 'patch' } } as never)
    expect(forgetInvalid(eng).sort()).toEqual(['glued', 'item/food/jam', 'patch/berries-to-jam', 'patch/stick-jam-default'])
    expect(eng.lib.types.map((t) => t.id)).toEqual(['item/material/twine'])
    expect(eng.lib.rules.has('patch/berries-to-jam')).toBe(false)
    // a jam in the bag keeps it
    const eng2 = fresh()
    ;(eng2.lib.addType(jam as never), eng2.world.onto.addType(jam as never))
    eng2.author(() => eng2.world.create('item/food/jam', { on: 'inside', holder: 'actor' }))
    expect(forgetInvalid(eng2)).toEqual([])
  })

  it('keeps what a kept kind turns into by a prop (raw eel kept for one in the bag, its cooked kind too, though it fails the checks)', () => {
    const eng = fresh()
    const cooked = { id: 'item/food/cooked_eel', name: { en: 'Cooked Eel', zh: '熟鳗鱼' }, tags: ['edible'], props: { material: 'meat' }, makeup: [{ type: 'item/food/fish/raw', count: 1 }], art }
    const raw = { id: 'item/food/raw_eel', name: { en: 'Raw Eel', zh: '生鳗鱼' }, tags: ['edible', 'raw', 'cookable'], props: { material: 'meat', food: 2, cookedType: cooked.id }, makeup: [{ type: 'item/food/fish/raw', count: 1 }], art }
    for (const t of [raw, cooked] as never[]) (eng.lib.addType(t), eng.world.onto.addType(t))
    eng.author(() => eng.world.create(raw.id, { on: 'inside', holder: 'actor' }))
    // the cooked one fills nothing (no food) and is judged after the raw one: the raw one names it, so it stays
    expect(forgetInvalid(eng)).toEqual([])
    expect(eng.lib.types.map((t) => t.id).sort()).toEqual([cooked.id, raw.id])
  })

  it('sends a learned thing\'s picture once, and again when a definition taken anew redraws it', () => {
    const sent = new Map<string, string>()
    const type = (twine('hands').artifacts[0] as { type: import('@lsw/engine').TypeDef }).type
    expect(artsToSend([type], sent).map((a) => a.id)).toEqual(['item/material/twine'])
    expect(artsToSend([type], sent)).toEqual([])
    const redrawn = { ...type, art: { ...art, palette: { a: '#2e8b57' } } }
    expect(artsToSend([redrawn], sent).map((a) => a.art.palette.a)).toEqual(['#2e8b57'])
  })

  it('a status the library forgot is forgotten unless something has it; a new definition replaces the old', () => {
    const eng = fresh()
    const port = new ModPort(eng)
    const status = (zh: string) => ({ artifacts: [{ kind: 'status' as const, status: { id: 'honeyed', name: { en: 'Honeyed', zh }, overlay: 'oil' } }] })
    expect(port.submit(undefined, status('抹了蜂蜜')).errors).toEqual([])
    expect(takeDefinitions(eng, status('涂了蜜')).replaced).toEqual(['honeyed'])
    expect(port.submit(undefined, status('涂了蜜')).errors).toEqual([])
    expect(eng.lib.statuses.find((x) => x.id === 'honeyed')?.name).toEqual({ en: 'Honeyed', zh: '涂了蜜' })
    eng.author(() => eng.world.setStatus({ e: 'actor' }, 'honeyed', 99))
    expect(forgetStatus(eng, 'honeyed')).toBe(false)
    eng.author(() => eng.world.clearStatus({ e: 'actor' }, 'honeyed'))
    expect(forgetStatus(eng, 'honeyed')).toBe(true)
  })
})

