// What a play session found (2026-10-07), each held to: the frame says what is near and what is
// hostile, statuses draw what their data names, a companion struck by its leader takes no harm, a
// made thing is not named twice, and the world waits while the player's own act waits.

import { describe, expect, it } from 'vitest'
import { ModPort, OVERLAYS, OntologyIndex, RuleLibrary, buildSandbox, madeOf, snapshot, validatePatch, type Engine } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

function meadow(extra: { key: string; type: string; x: number; y: number }[] = []): Engine {
  const eng = buildSandbox({ terrain: Array.from({ length: 7 }, () => Array(7).fill('grass')), entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }, ...extra], event: {} }, onto, lib())
  eng.controls.sync()
  return eng
}

describe('the frame', () => {
  it('names the stations within reach: a workbench beside the player, none away from it', () => {
    const near = meadow([{ key: 'bench', type: 'fixture/craft/workbench', x: 4, y: 3 }])
    expect(snapshot(near).player.stations).toContain('workbench')
    expect(snapshot(meadow([{ key: 'bench', type: 'fixture/craft/workbench', x: 6, y: 6 }])).player.stations).toEqual([])
  })

  it('a creature is hostile by what it would do, not by whether it is chasing this moment', () => {
    const eng = meadow([{ key: 'bat', type: 'actor/creature/beast/bat', x: 5, y: 5 }])
    const bat = eng.world.get('bat')!
    eng.author(() => (bat.ai = { behaviour: 'melee', temper: 'aggressive', sight: 6, home: { map: 'sandbox', x: 5, y: 5 }, state: 'return' }))
    expect(snapshot(eng).entities.find((e) => e.id === 'bat')?.hostile).toBe(true)
  })

  it('a status draws what its data names: a lit fire carries its flame', () => {
    const eng = meadow([{ key: 'fire', type: 'fixture/light/campfire', x: 4, y: 3 }])
    eng.author(() => eng.world.setStatus({ e: 'fire' }, 'lit', -1))
    expect(snapshot(eng).entities.find((e) => e.id === 'fire')?.overlays).toEqual(['flame'])
    // every base status that draws names a picture the world can draw
    for (const s of Object.values(onto.statuses)) if (s.overlay) expect(OVERLAYS).toContain(s.overlay)
  })

  it('a learned status may draw only what the world can draw', () => {
    const status = (overlay: string) => validatePatch({ artifacts: [{ kind: 'status', status: { id: 'glowing', name: { en: 'glowing', zh: '发光' }, overlay } }] }, { ontology: onto, library: lib() }).errors.join()
    expect(status('sparkles')).toMatch(/overlay "sparkles" is not one the world can draw/)
    expect(status('flame')).not.toMatch(/overlay/)
  })
})

describe('the inputs', () => {
  it('what lies on a cart comes before the cart, however small it is drawn (F takes the wand, not nothing)', () => {
    const eng = meadow([{ key: 'cart', type: 'fixture/furniture/cart', x: 3, y: 2 }, { key: 'wand', type: 'item/weapon/magic/wand', x: 3, y: 2 }])
    // the view: the pointer meets only the cart's big sprite, beside the wand's small one
    expect(eng.controls.layers({ map: 'sandbox', x: 3, y: 2 }, [{ e: 'cart' }])[0]).toEqual({ e: 'wand' })
    expect(eng.controls.plan('take', { x: 3, y: 2, stack: [{ e: 'cart' }] })?.target).toEqual({ e: 'wand' })
  })
})

describe('the world', () => {
  it('a companion struck by the one it follows is hurt as by any blow, and says so: it is no silent target', () => {
    const eng = meadow([{ key: 'axe', type: 'item/weapon/blade/axe', x: 3, y: 3 }])
    const w = eng.world
    eng.author(() => {
      w.place(w.get('axe')!, { on: 'hand', holder: 'actor' })
      w.create('actor/companion/fairy', { on: 'tile', map: 'sandbox', x: 3, y: 2 }, { id: 'pip', props: { companion: 'actor' } })
      w.create('actor/person/villager', { on: 'tile', map: 'sandbox', x: 2, y: 2 }, { id: 'other' })
    })
    const pip = w.get('pip')!
    const hp = w.num(pip, 'hp')
    eng.queue({ kind: 'impulse/strike', host: { e: 'pip' }, roles: { actor: { e: 'actor' }, source: { e: 'actor' }, instrument: { e: 'axe' } }, params: { power: 2 }, origin: 'player' })
    expect(w.num(pip, 'hp')).toBeLessThan(hp)
    expect(w.fx.some((f) => f.t === 'say' && f.who === 'pip')).toBe(true)
    // struck by another, a blow as ever (no word from it)
    w.fx.length = 0
    const before = w.num(pip, 'hp')
    eng.queue({ kind: 'impulse/strike', host: { e: 'pip' }, roles: { actor: { e: 'other' }, source: { e: 'other' } }, params: { power: 2 }, origin: 'world' })
    expect(w.num(pip, 'hp')).toBeLessThan(before)
    expect(w.fx.some((f) => f.t === 'say' && f.who === 'pip')).toBe(false)
  })

  it('a thing that reaches the bag without an input (a scene gives bread) takes a slot', () => {
    const eng = meadow()
    const w = eng.world
    eng.author(() => w.create('item/food/bread', { on: 'inside', holder: 'actor' }, { id: 'loaf' }))
    expect((w.player.slots ?? []).filter(Boolean)).toEqual([])
    eng.tick()
    expect((w.player.slots ?? []).filter(Boolean)).toHaveLength(1)
    expect(snapshot(eng).player.slots.filter(Boolean)).toHaveLength(1)
  })

  it('a key acts on whom its label named: a merchant who stepped off the spot still gets the bread', () => {
    const eng = meadow([{ key: 'loaf', type: 'item/food/bread', x: 3, y: 3 }, { key: 'tobin', type: 'actor/person/villager', x: 3, y: 2 }])
    const w = eng.world
    eng.author(() => w.place(w.get('loaf')!, { on: 'hand', holder: 'actor' }))
    const shown = eng.controls.plan('put', { x: 3, y: 2 })!.target
    expect(shown).toEqual({ e: 'tobin' })
    // he walks on before the key is pressed
    eng.author(() => w.place(w.get('tobin')!, { on: 'tile', map: 'sandbox', x: 4, y: 3 }))
    expect(eng.controls.plan('put', { x: 3, y: 2 })?.target).not.toEqual({ e: 'tobin' })
    expect(eng.controls.planFor('put', { x: 3, y: 2 }, 0, shown)?.target).toEqual({ e: 'tobin' })
    // out of reach, the key does what is under the pointer now
    eng.author(() => w.place(w.get('tobin')!, { on: 'tile', map: 'sandbox', x: 6, y: 6 }))
    expect(eng.controls.planFor('put', { x: 3, y: 2 }, 0, shown)?.target).not.toEqual({ e: 'tobin' })
  })

  it('health stops at nothing: a blow far past it fells, and leaves no debt', () => {
    const eng = meadow([{ key: 'slime', type: 'actor/creature/slime/green_slime', x: 3, y: 2 }])
    const slime = eng.world.get('slime')!
    eng.queue({ kind: 'impulse/strike', host: { e: 'slime' }, roles: { actor: { e: 'actor' }, source: { e: 'actor' } }, params: { power: 999 }, origin: 'world' })
    expect(eng.world.get('slime') ? eng.world.num(slime, 'hp') : 0).toBe(0)
    const me = eng.world.player
    eng.queue({ kind: 'impulse/strike', host: { e: me.id }, roles: { actor: { e: 'slime' }, source: { e: 'slime' } }, params: { power: 999 }, origin: 'world' })
    expect(eng.world.num(me, 'hp')).toBe(0)
  })

  it('a made thing is not named twice by its material (a 木桶 of wood stays a 木桶)', () => {
    const made = madeOf(onto, new OntologyIndex(onto), 'item/vessel/bucket/empty', 'wood').name as { en: string; zh: string }
    expect(made.zh).toBe('木桶')
    expect((madeOf(onto, new OntologyIndex(onto), 'item/weapon/blade/axe', 'stone').name as { zh: string }).zh).toBe('石斧')
  })

  it("the player's own act waiting for its outcome is what the host stops the world for; the world's own questions are not", () => {
    const eng = meadow([{ key: 'rope', type: 'item/tool/rope', x: 3, y: 3 }, { key: 'slime', type: 'actor/creature/slime/green_slime', x: 3, y: 2 }])
    eng.author(() => eng.world.place(eng.world.get('rope')!, { on: 'hand', holder: 'actor' }))
    const port = new ModPort(eng)
    port.provider = { resolve: () => new Promise(() => undefined) }
    expect(port.asking).toBeUndefined()
    eng.act('use', 'actor', { e: 'slime' })
    expect(port.asking?.origin).toBe('player')
    port.fallback(port.asking!.id)
    expect(port.asking).toBeUndefined()
  })
})
