// A learned thing made at hand from its makeup is crafted from the panel like the content's own:
// the worker tells the panel its recipe, and finds it again when the panel's button names it.

// the game handed to the runtime first, as its pages do (client/src/register.ts)
import '../src/register.ts'
import { describe, expect, it } from 'vitest'
import { ModPort, RuleLibrary, buildSandbox, type Patch, type Rule, type SaveData } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '@openworld-game/content'
import { adoptDefinitions, artsToSend, forgetInvalid, forgetStatus, forgetType, learnedRecipes, recipeOf, shareKept, sharedPart, takeDefinitions, takeLogEntries, withKept } from '@openworld/runtime/src/learned.ts'

const art = { grid: Array.from({ length: 16 }, (_, y) => (y > 3 && y < 12 ? '....aaaaaaaa....' : '................')), palette: { a: '#a0522d' } }
const twine = (station?: string): Patch => ({
  artifacts: [{ kind: 'type', type: { id: 'item/material/twine', name: { en: 'Twine', zh: '麻绳' }, tags: ['fiber'], props: { material: 'plant' }, makeup: [{ type: 'item/material/grass', count: 2 }], ...(station && { station }), art } as never }],
})
const fresh = () => buildSandbox({ terrain: [['grass', 'grass'], ['grass', 'grass']], entities: [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0 }], event: {} }, buildOntology(), new RuleLibrary(BASE_RULES))

describe('learned recipes', () => {
  it('keeps researched recipes in their own save even when no product remains', () => {
    const eng = fresh()
    const patch = twine('hands')
    const artifact = patch.artifacts[0]
    if (artifact.kind !== 'type') throw new Error('Expected a type')
    artifact.type.researched = true
    artifact.type.craftSkill = 'smith'
    expect(new ModPort(eng).submit(undefined, patch).ok).toBe(true)
    const save = { state: eng.world.state, library: eng.lib.toJSON() } as unknown as SaveData
    const shared = { ...eng.lib.toJSON(), types: [] }
    const { library, kept } = withKept(shared, save)
    expect(kept.types).toEqual(['item/material/twine'])
    expect(library!.types[0].craftSkill).toBe('smith')
    expect(learnedRecipes(eng)[0].skill).toBe('smith')
    expect(sharedPart(library!, { types: new Set(kept.types), statuses: new Set() }).types).toEqual([])
  })
  it('keeps private rules and their unused definitions in one save, out of the shared snapshot and log', () => {
    const eng = fresh()
    const root = twine('hands')
    if (root.artifacts[0].kind !== 'type') throw new Error('Expected a type')
    root.artifacts[0].type.researched = true
    expect(new ModPort(eng).submit(undefined, root).ok).toBe(true)
    const auxiliary = { id: 'item/misc/private_twine_case', name: 'Private Twine Case', tags: ['portable'] }
    eng.lib.addType(auxiliary)
    eng.lib.addStatus({ id: 'private_twine_care', name: 'Twine Care' })
    eng.lib.add({
      id: 'patch/private-twine-care', host: { type: 'item/material/twine' }, on: 'act/use', hole: 'core/use', at: [],
      tree: { do: [{ op: 'log', text: 'The twine is neatly wound.' }] },
      source: { origin: 'patch', local: { types: [auxiliary.id], statuses: ['private_twine_care'] } },
    })
    const save = { state: eng.world.state, library: eng.lib.toJSON() } as unknown as SaveData
    const shared = fresh().lib.toJSON()
    const merged = withKept(shared, save)
    expect(merged.library!.rules.some(r => r.id === 'patch/private-twine-care')).toBe(true)
    expect(merged.kept.types.sort()).toEqual(['item/material/twine', auxiliary.id].sort())
    expect(merged.kept.statuses).toEqual(['private_twine_care'])
    const exported = sharedPart(merged.library!, { types: new Set(merged.kept.types), statuses: new Set(merged.kept.statuses) })
    expect(JSON.stringify(exported)).not.toMatch(/private-twine-care|private_twine_case|private_twine_care|item\/material\/twine/)
    const alone = withKept(undefined, save)
    expect(JSON.stringify(sharedPart(alone.library!, { types: new Set(alone.kept.types), statuses: new Set(alone.kept.statuses) }))).not.toMatch(/private-twine-care|private_twine_case|private_twine_care|item\/material\/twine/)
    expect(withKept(exported, { state: fresh().world.state } as SaveData).library!.rules.some(r => r.id === 'patch/private-twine-care')).toBe(false)
    eng.lib.setAside('patch/private-twine-care')
    const withBranch = withKept(shared, { ...save, library: eng.lib.toJSON() })
    expect(withBranch.library!.aside?.some(a => a.rule.id === 'patch/private-twine-care')).toBe(true)
    expect(JSON.stringify(sharedPart(withBranch.library!, { types: new Set(withBranch.kept.types), statuses: new Set(withBranch.kept.statuses) }))).not.toMatch(/private-twine-care|private_twine_case|private_twine_care/)
    // A later shared patch may independently choose the same id. Loading or syncing it
    // cannot redefine a save's own item/status or remove its provisional branch.
    const publicRule: Rule = { ...save.library.rules.find(r => r.id === 'patch/private-twine-care')!, host: { type: 'item/material/stone' }, source: { origin: 'patch' }, tree: { do: [{ op: 'log', text: 'Public stone care.' }] } }
    const collision = { ...shared, rules: [...shared.rules, publicRule], types: [{ ...auxiliary, name: 'Public Case' }], statuses: [{ id: 'private_twine_care', name: 'Public Care' }] }
    const preserved = withKept(collision, { ...save, library: eng.lib.toJSON() })
    expect(preserved.library!.types.find(t => t.id === auxiliary.id)?.name).toBe('Private Twine Case')
    expect(preserved.library!.statuses.find(s => s.id === 'private_twine_care')?.name).toBe('Twine Care')
    const cached = sharedPart(preserved.library!, { types: new Set(preserved.kept.types), statuses: new Set(preserved.kept.statuses), shadow: preserved.kept.shadow })
    expect(cached.types.find(t => t.id === auxiliary.id)?.name).toBe('Public Case')
    expect(cached.statuses.find(s => s.id === 'private_twine_care')?.name).toBe('Public Care')
    expect(cached.rules.find(r => r.id === publicRule.id)?.host?.type).toBe('item/material/stone')
    expect(cached.rules.find(r => r.id === publicRule.id)?.source?.local).toBeUndefined()
    expect(cached.aside?.some(a => a.rule.id === publicRule.id)).toBe(false)
    expect(withKept(cached, { state: fresh().world.state } as SaveData).library!.types.find(t => t.id === auxiliary.id)?.name).toBe('Public Case')
    const submit = () => { throw new Error('a colliding shared patch must not be submitted') }
    const syncKept = { types: new Set<string>(), statuses: new Set<string>() }
    takeLogEntries(eng, { submit }, syncKept, [
      { seq: 1, removeType: auxiliary.id }, { seq: 2, removeStatus: 'private_twine_care' },
      { seq: 3, remove: 'patch/private-twine-care' }, { seq: 4, patch: { artifacts: [{ kind: 'type', type: collision.types[0] }, { kind: 'rule', rule: publicRule }] } },
    ])
    expect(eng.lib.types.find(t => t.id === auxiliary.id)?.name).toBe('Private Twine Case')
    expect(eng.lib.statuses.find(s => s.id === 'private_twine_care')?.name).toBe('Twine Care')
    expect(eng.lib.isAside('patch/private-twine-care')).toBe(true)
    const syncedPublic = sharedPart(eng.lib.toJSON(), syncKept)
    expect(syncedPublic.types.find(t => t.id === auxiliary.id)?.name).toBe('Public Case')
    expect(syncedPublic.statuses.some(s => s.id === 'private_twine_care')).toBe(false)
    expect(syncedPublic.rules.find(r => r.id === publicRule.id)?.source?.origin).toBe('patch')
    expect(syncedPublic.rules.find(r => r.id === publicRule.id)?.host?.type).toBe('item/material/stone')
    takeLogEntries(eng, { submit }, syncKept, [{ seq: 5, removeType: auxiliary.id }, { seq: 6, remove: publicRule.id }])
    expect(sharedPart(eng.lib.toJSON(), syncKept).types.some(t => t.id === auxiliary.id)).toBe(false)
    expect(sharedPart(eng.lib.toJSON(), syncKept).rules.some(r => r.id === publicRule.id)).toBe(false)
    expect(eng.lib.types.some(t => t.id === auxiliary.id)).toBe(true)
    expect(eng.lib.isAside(publicRule.id)).toBe(true)
    // Retiring a rule must not erase a recipe it introduced. Its private history is
    // kept across multiple loads, without reviving the removed rule or exporting it.
    eng.lib.remove('patch/private-twine-care')
    const retired = withKept(shared, { ...save, library: eng.lib.toJSON() })
    const twice = withKept(shared, { ...save, library: retired.library! })
    expect(twice.library!.types.some(t => t.id === auxiliary.id)).toBe(true)
    expect(twice.library!.statuses.some(s => s.id === 'private_twine_care')).toBe(true)
    expect(twice.library!.rules.some(r => r.id === 'patch/private-twine-care')).toBe(false)
    expect(twice.library!.aside?.some(a => a.rule.id === 'patch/private-twine-care')).toBe(false)
    expect(JSON.stringify(sharedPart(twice.library!, { types: new Set(twice.kept.types), statuses: new Set(twice.kept.statuses) }))).not.toMatch(/private-twine-care|private_twine_case|private_twine_care/)
  })

  it('marks definitions from a private answer as save-owned only after successful admission', () => {
    const eng = fresh()
    const kept = { types: new Set<string>(), statuses: new Set<string>() }
    const patch: Patch = { ...twine('hands'), scope: 'save', artifacts: [
      ...twine('hands').artifacts,
      { kind: 'status', status: { id: 'private_care', name: { en: 'Care', zh: '照料' } } },
    ] }
    const taking = adoptDefinitions(eng, kept, patch)
    expect(kept.types.size).toBe(0)
    expect(new ModPort(eng).submit(undefined, patch).ok).toBe(true)
    taking.done()
    expect(kept.types.has('item/material/twine')).toBe(true)
    expect(kept.statuses.has('private_care')).toBe(true)
  })

  it('are the recipes of types a patch brought, and are found by id beside the content\'s', () => {
    const eng = fresh()
    expect(learnedRecipes(eng)).toEqual([])
    expect(new ModPort(eng).submit(undefined, twine('hands')).errors).toEqual([])
    expect(learnedRecipes(eng).map((r) => r.id)).toEqual(['item/material/twine'])
    expect(recipeOf(eng, 'item/material/twine')?.needs).toEqual([{ type: 'item/material/grass', count: 2 }])
    // the content's own are still found without an engine
    expect(recipeOf(undefined, 'fixture/craft/workbench')?.make.type).toBe('fixture/craft/workbench')
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
    expect(recipeOf(eng, 'item/material/twine')).toBeUndefined()
    // a twine already made keeps what it is
    const eng2 = fresh()
    new ModPort(eng2).submit(undefined, twine('hands'))
    eng2.author(() => eng2.world.create('item/material/twine', { on: 'inside', holder: 'actor' }))
    expect(forgetType(eng2, 'item/material/twine')).toBe(false)
    expect(eng2.world.onto.hasType('item/material/twine')).toBe(true)
    // and so does one put away with its map (docs/continent.md §13): it is the world's, though not in memory
    const eng3 = fresh()
    new ModPort(eng3).submit(undefined, twine('hands'))
    eng3.world.state.chunks = { far: { away: true, things: [{ id: 'far.twine', type: 'item/material/twine', place: { on: 'tile', map: 'far', x: 1, y: 1 } }] } }
    expect(forgetType(eng3, 'item/material/twine')).toBe(false)
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
    expect(recipeOf(eng, 'item/material/twine')?.station).toBe('hands')
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
    const good = (twine('hands').artifacts[0] as { type: import('@openworld/engine').TypeDef }).type
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
    const type = (twine('hands').artifacts[0] as { type: import('@openworld/engine').TypeDef }).type
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

