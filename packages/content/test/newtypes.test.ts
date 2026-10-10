// Things the world learns: a patch may bring a new type (a product, a material) with its own
// picture as data. The validator holds its name to the world's conventions and its picture to
// the icon format, and points at what exists when a patch names a type that does not.

import { describe, expect, it } from 'vitest'
import { ModPort, OntologyIndex, RuleLibrary, artProblems, buildSandbox, deriveRecipes, holeKey, scenarioEvent, snapshot, validatePatch, type Patch, type PixelArt, type Rule, type Scenario, type TypeDef } from '@lsw/engine'
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

// A new thing the world has no word for yet: bone ash, what a bone leaves in a forge's heat (ore in a
// lit forge is the base's own now, smelt/ore, and its ingots are the catalogue's).
const ingot = (over: Partial<TypeDef> = {}): TypeDef => ({
  id: 'item/material/bone_ash',
  name: { en: 'Bone Ash', zh: '骨灰' },
  tags: ['powder', 'mineral'],
  props: { material: 'bone' },
  makeup: [{ type: 'item/material/bone', count: 1 }],
  sprite: 'art:item/material/bone_ash',
  art: INGOT_ART,
  ...over,
})

const scenario: Scenario = {
  entities: [
    { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
    { key: 'held', type: 'item/material/bone', x: 2, y: 2, heldBy: 'actor' },
    { key: 'it', type: 'fixture/craft/forge', x: 2, y: 1, statuses: ['lit'] },
  ],
  event: { kind: 'act/use', actor: 'actor', instrument: 'held', target: 'it', host: 'held' },
}
/** The hole the bone on the forge falls into: where the bone's own answer is placed (design.md §5.16). */
const USE_HOLE = (() => {
  const eng = buildSandbox(scenario, onto, lib())
  const res = eng.resolveEvent(scenarioEvent(scenario, eng))
  if (!res.hole) throw new Error(`the bone on the forge is defined by ${res.rule?.id}`)
  return holeKey(res.hole.rule.id, res.hole.path)
})()

/** A bone used on a lit forge becomes the new bone ash. */
const smelt = (into = 'item/material/bone_ash'): Rule => ({
  id: 'patch/bone-calcines',
  host: { type: 'item/material/bone' },
  on: 'act/use',
  hole: USE_HOLE,
  at: [],
  doc: 'A bone used on a lit forge is calcined into bone ash.',
  tree: { if: { is: { role: 'target', sel: { type: 'fixture/craft/forge', status: ['lit'] } } }, then: { do: [{ op: 'transform', into }, { op: 'vfx', at: 'target', fx: 'sparks' }] }, else: { undefined: true } },
})

const check = (patch: Patch) => validatePatch(patch, { ontology: onto, library: lib(), scenario })

describe('a patch that brings a new thing', () => {
  it('may define a new type with its own picture and make it', () => {
    const res = check({ artifacts: [{ kind: 'type', type: ingot() }, { kind: 'rule', rule: smelt() }] })
    expect(res.errors).toEqual([])
    // and the world can hold it: the engine resolves the bone into the new ash
    const eng = buildSandbox(scenario, onto, lib())
    eng.lib.addType(ingot())
    eng.world.onto.addType(ingot())
    eng.lib.add(smelt())
    eng.act('use', 'actor', { e: 'it' })
    expect(eng.world.get('held')!.type).toBe('item/material/bone_ash')
  })

  it('is drawn by its own picture though the patch names no sprite (the art is the picture)', () => {
    const index = new OntologyIndex({ ...onto, types: { ...onto.types } })
    const { sprite: _, ...bare } = ingot()
    index.addType(bare)
    expect(index.resolve(bare.id).sprite).toBe('art:item/material/bone_ash')
    // a kind of it with no picture of its own looks like it
    index.addType({ id: 'item/material/bone_ash/fine', name: { en: 'Fine Bone Ash', zh: '细骨灰' } })
    expect(index.resolve('item/material/bone_ash/fine').sprite).toBe('art:item/material/bone_ash')
    // an agent is drawn by its kind's sheet, which a 16x16 picture is not: a new wolf looks like a wolf
    index.addType({ id: 'actor/creature/beast/wolf/ash_wolf', name: { en: 'Ash Wolf', zh: '灰狼' }, art: INGOT_ART })
    expect(index.resolve('actor/creature/beast/wolf/ash_wolf').sprite).toBe(index.resolve('actor/creature/beast/wolf').sprite)
  })

  it('names it by the world\'s conventions: new, under a parent that exists, snake_case, in both languages', () => {
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(ingot({ id: 'item/material/bone' }))).toMatch(/exists already/)
    expect(errors(ingot({ id: 'item/powders/bone_ash' }))).toMatch(/parent "item\/powders" does not exist/)
    expect(errors(ingot({ id: 'item/material/BoneAsh' }))).toMatch(/snake_case/)
    expect(errors(ingot({ name: { en: 'Bone Ash', zh: '' } }))).toMatch(/both languages/)
    expect(errors(ingot({ name: 'Bone Ash' as never }))).toMatch(/both languages/)
  })

  it('says what it is made of (material and makeup), and is never a new kind of ground', () => {
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(ingot({ props: {} }))).toMatch(/props\.material/)
    expect(errors(ingot({ makeup: undefined }))).toMatch(/makeup/)
    expect(errors(ingot({ makeup: [{ type: 'item/material/iron', count: 1 }] }))).toMatch(/makeup\[0\]: unknown type "item\/material\/iron"/)
    expect(errors(ingot({ id: 'tile/frost_crust', name: { en: 'Frost Crust', zh: '霜壳' } }))).toMatch(/new kind of ground/)
  })

  it('a thing made at hand or at a station can leave the hand it is made into: a fixture says it is portable', () => {
    const stool = (tags: string[]) => ingot({ id: 'fixture/furniture/stool', name: { en: 'Stool', zh: '凳子' }, tags, props: { material: 'wood' }, makeup: [{ type: 'item/material/plank', count: 1 }], station: 'hands' })
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(stool([]))).toMatch(/"portable"/)
    expect(errors(stool(['portable']))).not.toMatch(/portable/)
    // an item is carried by its kind, and a fixture nobody makes stays where it is set
    expect(errors(ingot({ station: 'hands' }))).not.toMatch(/portable/)
    expect(errors({ ...stool([]), station: undefined })).not.toMatch(/portable/)
    // what the check spares: made without the tag, it comes into the hand and can never be set down
    const eng = buildSandbox({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'plank', type: 'item/material/plank', x: 2, y: 2, heldBy: 'actor' }], event: {} }, onto, lib())
    const t = stool([])
    eng.world.onto.addType(t)
    eng.lib.addType(t, 'test')
    for (const r of deriveRecipes(eng.world.onto)) eng.recipes.set(r.id, r)
    expect(eng.controls.craft(eng.recipes.get(t.id)!)).toBe(true)
    for (let i = 0; i < 5; i++) eng.tick()
    const made = Object.values(eng.world.state.entities).find((e) => e.type === t.id)!
    eng.controls.sync()
    eng.controls.run(eng.controls.plan('use', { x: 3, y: 2 })!)
    for (let i = 0; i < 5; i++) eng.tick()
    expect(eng.world.get(made.id)?.place).toMatchObject({ on: 'hand' })
  })

  it('what cannot be carried is never left in a hand: made there or turned into it there, it is set down at its holder\'s feet', () => {
    const chairOf = (effects: unknown[]) => {
      const l = lib()
      l.add({ id: 'patch/plank-chair', host: { type: 'item/material/plank' }, on: 'act/use', tree: { do: effects } } as Rule, 'test')
      const eng = buildSandbox({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'plank', type: 'item/material/plank', x: 2, y: 2, heldBy: 'actor' }], event: {} }, onto, l)
      eng.act('use', 'actor', eng.world.cellRef('sandbox', 3, 2))
      for (let i = 0; i < 3; i++) eng.tick()
      return Object.values(eng.world.state.entities).find((e) => e.type === 'fixture/furniture/chair')?.place
    }
    // the held plank becomes a chair
    expect(chairOf([{ op: 'transform', into: 'fixture/furniture/chair' }])).toMatchObject({ on: 'tile', x: 2, y: 2 })
    // a chair made into the maker's hand
    expect(chairOf([{ op: 'spawn', type: 'fixture/furniture/chair', at: 'actor', into: 'hand' }, { op: 'destroy' }])).toMatchObject({ on: 'tile', x: 2, y: 2 })
  })

  it('a drink in a vessel names the vessel it leaves: drunk without one, it would be there to drink again', () => {
    const juice = (props: Record<string, unknown>) => ingot({ id: 'item/vessel/flask/apple_juice', name: { en: 'Apple Juice', zh: '苹果汁' }, tags: ['liquid', 'drinkable'], props: { material: 'glass', food: 3, ...props }, makeup: [{ type: 'item/vessel/flask/empty', count: 1 }] })
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(juice({}))).toMatch(/emptyType/)
    expect(errors(juice({ emptyType: 'item/vessel/flask/nothing' }))).toMatch(/emptyType/)
    expect(errors(juice({ emptyType: 'item/vessel/flask/empty' }))).not.toMatch(/emptyType/)
    // what the check spares: drunk, a flask that names no empty one is still full
    const t = juice({})
    const l = lib()
    l.addType(t, 'test')
    const eng = buildSandbox({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: t.id, x: 2, y: 2, heldBy: 'actor' }], event: {} }, buildOntology(), l)
    eng.author(() => eng.world.setProp(eng.world.player, 'hunger', 0))
    eng.act('use', 'actor', { e: 'actor' })
    for (let i = 0; i < 3; i++) eng.tick()
    expect(eng.world.num(eng.world.player, 'hunger')).toBe(3)
    expect(eng.world.get('held')?.type).toBe(t.id)
  })

  it('a seed sown by its tag names the crop it becomes: sown without one, it lies on the farmland as a seed', () => {
    const seed = (props: Record<string, unknown>) => ingot({ id: 'item/seed/moonbean', name: { en: 'Moonbean Seeds', zh: '月豆种子' }, tags: ['plantable'], props: { material: 'plant', ...props }, makeup: [{ type: 'item/material/herb', count: 1 }] })
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(seed({}))).toMatch(/cropType/)
    expect(errors(seed({ cropType: 'fixture/crop/moonbean/sprout' }))).toMatch(/cropType/)
    expect(errors(seed({ cropType: 'fixture/crop/carrot/sprout' }))).not.toMatch(/cropType/)
    // what the check spares: "You sow" it, and it is still a seed, lying on the farmland
    const t = seed({})
    const l = lib()
    l.addType(t, 'test')
    const eng = buildSandbox({ terrain: Array.from({ length: 5 }, () => Array<string>(5).fill('farmland')), entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: t.id, x: 2, y: 2, heldBy: 'actor' }], event: {} }, buildOntology(), l)
    eng.act('use', 'actor', eng.world.cellRef('sandbox', 3, 2))
    for (let i = 0; i < 3; i++) eng.tick()
    expect(eng.world.get('held')).toMatchObject({ type: t.id, place: { on: 'tile', x: 3, y: 2 } })
  })

  it('so does every thing a rule turns by its tag: raw food its cooked one, an empty vessel its full one, ore its bar', () => {
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    const raw = (props: Record<string, unknown>) => ingot({ id: 'item/food/raw_eel', name: { en: 'Raw Eel Steak', zh: '生鳗鱼排' }, tags: ['edible', 'raw', 'cookable'], props: { material: 'meat', food: 2, ...props } })
    expect(errors(raw({}))).toMatch(/cookedType/)
    expect(errors(raw({ cookedType: 'item/food/fish/cooked' }))).not.toMatch(/cookedType/)
    const jug = (props: Record<string, unknown>) => ingot({ id: 'item/vessel/jug_empty', name: { en: 'Empty Jug', zh: '空水罐' }, tags: ['empty-vessel'], props: { material: 'clay', ...props } })
    expect(errors(jug({}))).toMatch(/waterType/)
    expect(errors(jug({ waterType: 'item/vessel/flask/water' }))).not.toMatch(/waterType/)
    const ore = (props: Record<string, unknown>) => ingot({ id: 'item/material/copper_ore', name: { en: 'Copper Ore', zh: '铜矿石' }, tags: ['ore'], props: { material: 'stone', ...props } })
    expect(errors(ore({}))).toMatch(/smelts/)
    expect(errors(ore({ smelts: 'item/material/iron_ingot' }))).not.toMatch(/smelts/)
    // a vessel of a liquid is poured out (water on a fire, oil on the ground) and left empty
    const pail = (props: Record<string, unknown>) => ingot({ id: 'item/vessel/bucket/brine', name: { en: 'Bucket of Brine', zh: '一桶盐水' }, tags: ['liquid', 'liquid:water'], props: { material: 'wood', ...props } })
    expect(errors(pail({}))).toMatch(/emptyType/)
    expect(errors(pail({ emptyType: 'item/vessel/bucket/empty' }))).not.toMatch(/emptyType/)
  })

  it('a food carries the tag it is eaten (or drunk) by: item/food does not give it, and the base then eats it', () => {
    const jam = (tags: string[]) => ingot({ id: 'item/food/bone_broth', name: { en: 'Bone Broth', zh: '骨头汤' }, tags, props: { material: 'bone', food: 4 } })
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    expect(errors(jam(['warm']))).toMatch(/eaten by the tag "edible"/)
    // something that nourishes under another parent needs it too
    expect(errors(ingot({ props: { material: 'bone', food: 2 } }))).toMatch(/eaten by the tag "edible"/)
    expect(errors(jam(['edible', 'warm']))).not.toMatch(/edible/)
    // eaten, it fills by its food: a dish without one is eaten and gone, and fills nothing
    expect(errors({ ...jam(['edible']), props: { material: 'bone' } })).toMatch(/props\.food/)
    expect(errors(jam(['edible']))).not.toMatch(/props\.food/)
    expect(errors(jam(['drinkable', 'liquid']))).not.toMatch(/edible/)
    // a potion is drunk by its kind: one the world learns needs no tag of its own
    const potion = ingot({ id: 'item/potion/frost_tonic', name: { en: 'Frost Tonic', zh: '霜之药剂' }, tags: ['cold'], props: { material: 'glass' } })
    expect(errors(potion)).not.toMatch(/edible|drinkable/)
    expect(new OntologyIndex({ ...onto, types: { ...onto.types, [potion.id]: potion } }).resolve(potion.id).tags).toContain('drinkable')
    // with the tag, the base's own eating answers it: the hole is not asked of every new food
    const lib2 = lib()
    lib2.addType(jam(['edible']), 'test')
    const sc: Scenario = { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: 'item/food/bone_broth', x: 2, y: 2, heldBy: 'actor' }], event: { kind: 'act/use', actor: 'actor', instrument: 'held', target: 'actor', host: 'held' } }
    const onto2 = buildOntology()
    onto2.types['item/food/bone_broth'] = jam(['edible'])
    const eng = buildSandbox(sc, onto2, lib2)
    expect(eng.resolveEvent(scenarioEvent(sc, eng)).rule?.id).toBe('use/eat')
  })

  it('a thing worn names its slot: item/clothing gives none, and wearing does nothing without one', () => {
    const errors = (t: TypeDef) => check({ artifacts: [{ kind: 'type', type: t }, { kind: 'rule', rule: smelt(t.id) }] }).errors.join('\n')
    const scarf = (props: Record<string, unknown>) => ingot({ id: 'item/clothing/bone_scarf', name: { en: 'Bone Scarf', zh: '骨围巾' }, tags: ['warm'], props: { material: 'bone', ...props } })
    expect(errors(scarf({}))).toMatch(/props\.slot/)
    expect(errors(scarf({ slot: 'scarf' }))).toMatch(/props\.slot/)
    expect(errors(scarf({ slot: 'neck' }))).not.toMatch(/slot/)
    // a weapon has its slot from its kind
    expect(errors(ingot({ id: 'item/weapon/blunt/bone_mace', name: { en: 'Bone Mace', zh: '骨锤' }, tags: [], props: { material: 'bone' } }))).not.toMatch(/slot/)
  })

  it('requires positive safe integers for makeup counts, keeping chance separate', () => {
    for (const count of [0.5, 0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const res = check({ artifacts: [{ kind: 'type', type: ingot({ makeup: [{ type: 'item/material/bone', count }] }) }, { kind: 'rule', rule: smelt() }] })
      expect(res.errors.join(), String(count)).toMatch(/makeup\[0\]\.count.*positive safe integer/)
    }
    expect(check({ artifacts: [{ kind: 'type', type: ingot({ makeup: [{ type: 'item/material/bone', count: 1, chance: 0.5 }] }) }, { kind: 'rule', rule: smelt() }] }).ok).toBe(true)
  })

  it('refuses invalid recipe counts at execution, and consumes one ingredient for one craft', () => {
    const scene = structuredClone(scenario)
    scene.entities.find((e) => e.key === 'held')!.heldBy = undefined
    scene.entities.find((e) => e.key === 'held')!.inside = 'actor'
    for (const count of [0.5, 0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1]) {
      const eng = buildSandbox(scene, onto, lib())
      eng.world.onto.addType(ingot())
      eng.recipes.set('test/ingot', { id: 'test/ingot', name: 'Bone Ash', sprite: ingot().id, needs: [{ type: 'item/material/bone', count }], make: { type: ingot().id }, station: 'hands' })
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

  it('arrives in the hand that waited for it: the held bone becomes the ash, in the same slot', () => {
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
    expect(held.type).toBe('item/material/bone_ash')
    expect(eng.world.player.slots![slot]).toBe(eng.controls.key(held))
  })

  it('can be crafted as soon as it is learned, when it says where it is made', () => {
    const eng = buildSandbox(scenario, onto, lib())
    const port = new ModPort(eng)
    const nail = { id: 'item/material/bone_needle', name: { en: 'Bone Needle', zh: '骨针' }, props: { material: 'bone' }, makeup: [{ type: 'item/material/bone', count: 1 }], station: 'hands' } as TypeDef
    expect(eng.recipes.has(nail.id)).toBe(false)
    port.submit(undefined, { artifacts: [{ kind: 'type', type: nail }, { kind: 'rule', rule: { ...smelt(nail.id), id: 'patch/bone-to-needle' } }] })
    expect(eng.recipes.get(nail.id)).toMatchObject({ needs: [{ type: 'item/material/bone', count: 1 }], station: 'hands' })
  })

  it('points at what exists when a patch names a type that does not', () => {
    expect(check({ artifacts: [{ kind: 'rule', rule: smelt('item/material/iron') }] }).errors.join()).toMatch(/unknown type "item\/material\/iron" — the closest known types: .*item\/material\/iron_ore/)
  })
})

describe('a patch that brings a status', () => {
  it('cannot redefine a base status or change an already frozen actor', () => {
    const patch: Patch = { artifacts: [{ kind: 'status', status: { id: 'frozen', duration: 1, immobilize: false } }, { kind: 'rule', rule: smelt('item/material/ash') }] }
    const eng = buildSandbox({ ...scenario, entities: scenario.entities.map((e) => e.key === 'actor' ? { ...e, statuses: ['frozen'] } : e) }, onto, lib())
    const port = new ModPort(eng)
    expect(eng.busy(eng.world.get('actor')!)).toBe(true)
    const result = port.submit(undefined, patch)
    expect(result.ok).toBe(false)
    expect(result.errors.join()).toMatch(/status.*frozen.*different definition/)
    expect(eng.busy(eng.world.get('actor')!)).toBe(true)
  })

  it('draws over a cell as over a thing: the cell tells the overlay its learned status names', () => {
    const eng = buildSandbox(scenario, onto, lib())
    expect(new ModPort(eng).submit(undefined, { artifacts: [{ kind: 'status', status: { id: 'muddy', name: { en: 'Muddy', zh: '泥泞' }, overlay: 'wet' } }] }).errors).toEqual([])
    const cell = eng.world.cellRef('sandbox', 1, 1)
    eng.author(() => eng.world.setStatus(cell, 'muddy', 99))
    const tile = snapshot(eng).tiles.find((t) => t.x === 1 && t.y === 1)
    expect(tile?.statuses).toContain('muddy')
    expect(tile?.overlays).toEqual({ muddy: 'wet' })
  })

  it('says plainly that a thing alone answers nothing: the event still needs a rule', () => {
    const res = check({ artifacts: [{ kind: 'type', type: ingot() }] })
    expect(res.ok).toBe(false)
    expect(res.errors.join()).not.toMatch(/Cannot read/)
    expect(res.errors.join()).toMatch(/no rule/)
  })

  it('never holds anyone still for good: a status that immobilizes ends, as given or as defined', () => {
    // a new one names how long it lasts
    const still = { id: 'glued', name: { en: 'Glued', zh: '粘住' }, immobilize: true }
    const alone = (status: object) => validatePatch({ artifacts: [{ kind: 'status', status: status as never }] }, { ontology: onto, library: lib() })
    expect(alone(still).errors.join()).toMatch(/holds.*still.*duration/)
    expect(alone({ ...still, duration: 30 }).errors).toEqual([])
    // the world's own `asleep` has no length of its own (the engine gives one): a patch that gives it says how long
    const lull = (duration?: number): Patch => ({ artifacts: [{ kind: 'rule', rule: { ...smelt(), id: 'patch/bone-lulls', tree: { do: [{ op: 'addStatus', status: 'asleep', ...(duration !== undefined && { duration }) }] } } }] })
    expect(check(lull()).errors.join()).toMatch(/asleep.*never end/)
    expect(check(lull(-1)).errors.join()).toMatch(/asleep.*never end/)
    expect(check(lull(60)).errors.join()).not.toMatch(/never end/)
    // a duration of 0 is for good too, though the status's own runs out (frozen lasts 40 ticks)
    const freeze = (duration: number): Patch => ({ artifacts: [{ kind: 'rule', rule: { ...smelt(), id: 'patch/bone-freezes', tree: { do: [{ op: 'addStatus', status: 'frozen', duration }] } } }] })
    expect(check(freeze(0)).errors.join()).toMatch(/frozen.*never end/)
    expect(check(freeze(20)).errors.join()).not.toMatch(/never end/)
  })

  it('cannot redefine a shared status or an earlier status in the same patch', () => {
    const status = { id: 'test_still', name: { en: 'Still', zh: '静止' }, duration: 30, immobilize: true }
    const library = lib()
    library.addStatus(status)
    const changed = { ...status, immobilize: false }
    expect(validatePatch({ artifacts: [{ kind: 'status', status: changed }] }, { ontology: onto, library }).errors.join()).toMatch(/different definition/)
    expect(check({ artifacts: [{ kind: 'status', status }, { kind: 'status', status: changed }] }).errors.join()).toMatch(/different definition/)
  })

  it('names a new status (the things that have it show it), in both languages', () => {
    const errors = (status: object) => validatePatch({ artifacts: [{ kind: 'status', status: status as never }] }, { ontology: onto, library: lib() }).errors.join()
    expect(errors({ id: 'honeyed', overlay: 'oil' })).toMatch(/a new status says what it is called/)
    expect(errors({ id: 'honeyed', name: { en: 'Honeyed', zh: '' }, overlay: 'oil' })).toMatch(/a new status says what it is called/)
    expect(errors({ id: 'honeyed', name: { en: 'Honeyed', zh: '抹了蜂蜜' }, overlay: 'oil' })).toBe('')
    // a status the world has already, the same again: no name asked of it
    expect(errors(onto.statuses.wet)).toBe('')
  })

  it('accepts identical definitions regardless of object key order', () => {
    const frozen = onto.statuses.frozen
    const reordered = Object.fromEntries(Object.entries(frozen).reverse()) as typeof frozen
    const status = { id: 'test_still', name: { en: 'Still', zh: '静止' }, props: { speed: 1, def: 2 }, duration: 30 }
    const library = lib()
    library.addStatus(status)
    expect(validatePatch({ artifacts: [{ kind: 'status', status: reordered }, { kind: 'status', status: { duration: 30, props: { def: 2, speed: 1 }, name: { zh: '静止', en: 'Still' }, id: status.id } }] }, { ontology: onto, library }).ok).toBe(true)
    expect(validatePatch({ artifacts: [{ kind: 'status', status }, { kind: 'status', status: structuredClone(status) }] }, { ontology: onto, library: lib() }).ok).toBe(true)
  })
})
