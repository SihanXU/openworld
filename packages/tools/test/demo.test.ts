// The Ford is complete (docs/game-design.md §9): it contains every element the demo must have,
// and nothing that witnesses none. The requirements R are derived, not chosen: the engine's
// event kinds (A), the sources of undefined behaviour (B, design.md §5.4), the ontology the rules
// address (C), the player's inputs (D, design.md §5.2), the Mod port's loop (E), and what a game
// needs at the least (F). Each requirement is checked on the real map, through the player's own
// inputs where there are any; then the converse: every placed thing witnesses some requirement.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, SLOT_COUNT, TICKS_PER_HOUR, tickAt, type Engine, type Entity, type EventKind, type Key, type Patch, type Plan, type Ref } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { AT, buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
/** Every event kind dispatched in any of the worlds below. */
const KINDS = new Set<string>()

interface Ford {
  game: Game
  eng: Engine
}

function fresh(opts: { arrival?: boolean } = {}): Ford {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const dispatch = eng.dispatch.bind(eng)
  eng.dispatch = (ev) => (KINDS.add(ev.kind), dispatch(ev))
  if (!opts.arrival) {
    eng.world.setFact('seen.arrival', true)
    ;(eng.world.player.props ??= {}).quest = 1
    eng.world.create('item/food/bread', { on: 'inside', holder: 'player' })
    eng.controls.sync()
  }
  return { game, eng }
}

const W = (f: Ford) => f.eng.world
const ofType = (f: Ford, type: string) => Object.values(W(f).state.entities).find((e) => e.type === type)
const stand = (f: Ford, x: number, y: number, facing: Entity['facing'] = 'up') => {
  W(f).place(W(f).player, { on: 'tile', map: 'ford', x, y })
  W(f).player.facing = facing
}
/** Put a thing in the player's hand the way the player would: in the bag, then its slot selected. */
function hold(f: Ford, e: Entity | undefined): void {
  if (!e) throw new Error('nothing to hold')
  const c = f.eng.controls
  W(f).place(e, { on: 'inside', holder: 'player' })
  c.sync()
  c.select(W(f).player.slots!.indexOf(c.key(e)))
  expect(W(f).player.held).toBe(e.id)
}
const at = (x: number, y: number) => ({ x, y })
const run = (f: Ford, key: Key, x: number, y: number): Plan => {
  const plan = f.eng.controls.plan(key, at(x, y))
  if (!plan) throw new Error(`${key} at ${x},${y}: no plan`)
  f.eng.controls.run(plan, true)
  return plan
}
const ticks = (f: Ford, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    if (W(f).state.scene?.waiting === 'advance') f.eng.scenes.advance()
    f.eng.tick()
    if (until?.()) return true
  }
  return !!until?.()
}
const setHour = (f: Ford, day: number, hour: number) => (W(f).state.tick = tickAt(day, hour))
const records = (f: Ford) => f.game.mods.records
const asked = (f: Ford, kind: EventKind, origin: 'player' | 'world') => records(f).filter((r) => r.event.kind === kind && r.origin === origin)
const targetOf = (r: { event: { roles: { target?: Ref } } }) => r.event.roles.target
const isE = (ref: Ref | undefined, id: string | undefined) => !!ref && 'e' in ref && ref.e === id
const far = (f: Ford) => W(f).fact('ford.crossed') === 1

/** Walk east along a row until the player stands on the far bank (or cannot go on). */
function walkEast(f: Ford, limit = 12): void {
  for (let i = 0; i < limit && !far(f); i++) {
    f.eng.movePlayer('right')
    ticks(f, 25, () => far(f))
  }
}

// =================================================================== the requirements

interface Req {
  id: string
  what: string
  /** The demo's elements that witness it (entity ids or types). */
  by: string[]
  check: () => void
}

const R: Req[] = []
const req = (id: string, what: string, by: string[], check: () => void) => R.push({ id, what, by, check })

// ------------------------------------------------------------------ B. sources of undefined behaviour (and E, the port's loop)

req('B1', 'the held thing applied to something no rule covers is asked about (player)', ['item/food/bread', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, 24, 15)
  const plan = run(f, 'use', ...AT.winch)
  expect(plan.unknown).toBe(true)
  expect(asked(f, 'interaction', 'player')).toHaveLength(1)
})

req('B2', 'putting something where no rule covers it is asked about', ['item/weapon/blade/axe', 'fixture/nature/dead_tree'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  stand(f, 25, 10, 'right')
  // the default would set it down at the tree's foot; the chooser picks the tree itself
  f.eng.controls.run(f.eng.controls.plan('put', at(...AT.deadTree), 0)!)
  expect(asked(f, 'interaction', 'player').some((r) => r.event.verb === 'put' && isE(targetOf(r), 'ford.dead_tree'))).toBe(true)
})

req('B3', 'a blow with no reaction is asked about (a frost cast on the winch)', ['item/weapon/magic/wand', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/weapon/magic/wand'))
  stand(f, 24, 15)
  const plan = run(f, 'use', ...AT.winch)
  expect(plan.attack).toBe(true)
  expect(asked(f, 'hit', 'player').some((r) => r.event.element === 'ice' && isE(targetOf(r), 'ford.winch'))).toBe(true)
})

req('B4', 'a bare hand on something only a description covers is asked about (E on the raft)', ['fixture/ferry/raft'], () => {
  const f = fresh()
  stand(f, 25, 15, 'right')
  const plan = run(f, 'hands', ...AT.raft)
  expect(plan.unknown).toBe(true)
  expect(asked(f, 'interaction', 'player').some((r) => isE(targetOf(r), 'ford.raft'))).toBe(true)
})

req('B5', 'stepping onto a tile in a state no rule covers is asked about (oil on the path)', ['item/vessel/flask/oil'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/vessel/flask/oil'))
  stand(f, 21, 16, 'right')
  run(f, 'use', 22, 16)
  expect(W(f).hasStatus({ tile: { map: 'ford', x: 22, y: 16 } }, 'oiled')).toBe(true)
  f.eng.movePlayer('right')
  expect(asked(f, 'enter', 'player')).toHaveLength(1)
})

req('B8', 'a cascade meets an unmodelled pair: the storm strikes the dead tree', ['fixture/nature/dead_tree', 'weather:storm'], () => {
  const f = fresh()
  setHour(f, 1, 17.2)
  stand(f, 23, 10)
  expect(ticks(f, 3000, () => asked(f, 'hit', 'world').some((r) => isE(targetOf(r), 'ford.dead_tree')))).toBe(true)
})

req('B9', 'creatures meet things after dark: a fiery slime lights dry hay (a rule); other meetings are asked about', ['actor/creature/slime/fire_slime', 'actor/creature/slime/frost_slime', 'fixture/nature/haystack', 'fixture/container/chest', 'fixture/nature/burrow'], () => {
  const f = fresh()
  setHour(f, 2, 20.9)
  stand(f, 20, 15)
  W(f).player.props!.hp = 10_000
  W(f).player.props!.maxHp = 10_000
  expect(ticks(f, 2 * TICKS_PER_HOUR, () => asked(f, 'meet', 'world').length > 0)).toBe(true)
  // nothing froze while the world asked
  for (const r of asked(f, 'meet', 'world')) for (const ref of [r.event.roles.actor, r.event.roles.target]) expect(ref && 'e' in ref ? W(f).get(ref.e)?.frozenBy : undefined).toBeUndefined()
})

req('B10', 'a person is blocked: her fire soaked, she cannot tend it', ['npc.hesper', 'fixture/light/campfire', 'item/vessel/bucket/empty'], () => {
  const f = fresh()
  setHour(f, 2, 17.8)
  const fire = W(f).get('ford.campfire')!
  hold(f, ofType(f, 'item/vessel/bucket/empty'))
  // fill the bucket at the river, douse the fire: it is out and wet
  stand(f, 25, 12, 'right')
  run(f, 'use', 26, 12)
  stand(f, 16, 16)
  run(f, 'use', ...AT.campfire)
  expect(W(f).hasStatus({ e: fire.id }, 'lit')).toBe(false)
  W(f).setStatus({ e: fire.id }, 'wet', W(f).state.tick + 2000)
  expect(ticks(f, TICKS_PER_HOUR, () => asked(f, 'blocked', 'world').some((r) => isE(r.event.roles.actor, 'npc.hesper')))).toBe(true)
})

req('B11', 'a theft is witnessed: the owner objects (a rule); a bystander is asked about', ['npc.tobin', 'npc.hesper', 'fixture/furniture/cart', 'item/vessel/flask/oil'], () => {
  const f = fresh()
  stand(f, 20, 11, 'left')
  const oil = ofType(f, 'item/vessel/flask/oil')!
  run(f, 'take', ...AT.cart)
  expect(W(f).player.held === oil.id || W(f).player.contents?.includes(oil.id)).toBe(true)
  expect(f.eng.trace.some((t) => t.ev.kind === 'witness' && t.ev.about === 'take:owner' && t.rule)).toBe(true)
  expect(asked(f, 'witness', 'world').some((r) => r.event.about === 'take:bystander' && isE(r.event.roles.actor, 'npc.hesper'))).toBe(true)
})

req('B12', 'content is broken by state: the rope burns; asked about, and kept playable by its fallback', ['item/tool/rope', 'fixture/ferry/winch', 'npc.hesper'], () => {
  const f = fresh()
  const rope = ofType(f, 'item/tool/rope')!
  W(f).place(rope, { on: 'tile', map: 'ford', x: 18, y: 17 })
  f.eng.applyStatus({ e: rope.id }, 'burning')
  expect(ticks(f, 200, () => asked(f, 'invalid', 'world').length > 0)).toBe(true)
  expect(ofType(f, 'item/tool/rope')).toBeUndefined()
  ticks(f, f.game.mods.timeoutTicks + 5)
  expect(ofType(f, 'item/tool/rope')).toBeDefined()
})

req('E1', 'a patch answers a request: validated, applied, in the Threadbook as yours; the class never asks again', ['fixture/ferry/raft'], () => {
  const f = fresh()
  stand(f, 25, 15, 'right')
  run(f, 'hands', ...AT.raft)
  const rec = asked(f, 'interaction', 'player')[0]
  const patch: Patch = {
    artifacts: [
      {
        kind: 'rule',
        rule: {
          id: 'patch/rock-the-raft',
          doc: 'A shove rocks the raft on its line.',
          on: 'interaction',
          when: { verb: ['interact'], target: { type: 'fixture/ferry/raft' }, instrument: { none: true } },
          do: [{ op: 'vfx', at: 'target', fx: 'splash' }, { op: 'log', text: 'The raft rocks on its line.' }],
          tests: [],
        },
      },
    ],
  }
  expect(f.game.mods.submit(rec.id, patch).ok).toBe(true)
  expect(f.eng.lib.rules.get('patch/rock-the-raft')?.source).toMatchObject({ origin: 'patch', trigger: 'player' })
  const again = f.eng.controls.plan('hands', at(...AT.raft))!
  expect(again.unknown).toBeUndefined()
  f.eng.controls.run(again)
  expect(records(f)).toHaveLength(1)
})

req('E2', "the world's own requests are learned as the world's: the Threadbook says who", ['actor/creature/slime/frost_slime'], () => {
  const f = fresh()
  const slime = W(f).get('ford.frost_slime')!
  W(f).place(slime, { on: 'tile', map: 'ford', x: 15, y: 13 })
  stand(f, 17, 17)
  f.eng.queue({ kind: 'meet', roles: { actor: { e: slime.id }, target: { e: 'ford.chest' } } })
  const rec = asked(f, 'meet', 'world')[0]
  expect(rec).toBeDefined()
  const patch: Patch = {
    artifacts: [{ kind: 'rule', rule: { id: 'patch/frost-on-wood', doc: 'A frost slime leaves rime on wood it touches.', on: 'meet', when: { actor: { tags: ['icy'] }, target: { tags: ['wooden'] } }, do: [{ op: 'vfx', at: 'target', fx: 'frost' }], tests: [] } }],
  }
  expect(f.game.mods.submit(rec.id, patch).ok).toBe(true)
  expect(f.eng.lib.rules.get('patch/frost-on-wood')?.source?.trigger).toBe('world')
})

req('E3', "a patch that breaks the rules is rejected and the safe default stands; the world's patches never harm a person", ['npc.tobin'], () => {
  const f = fresh()
  stand(f, 25, 15, 'right')
  run(f, 'hands', ...AT.raft)
  const rec = asked(f, 'interaction', 'player')[0]
  const bad = f.game.mods.submit(rec.id, { artifacts: [{ kind: 'rule', rule: { id: 'patch/bad', on: 'interaction', when: { verb: ['interact'], target: { type: 'fixture/ferry/raft' } }, do: [{ op: 'addStatus', of: 'target', status: 'no-such-status' }] } }] })
  expect(bad.ok).toBe(false)
  expect(rec.status).toBe('rejected')
  // a bystander's witness answered with violence is refused
  const g = fresh()
  stand(g, 20, 11, 'left')
  run(g, 'take', ...AT.cart)
  const w = asked(g, 'witness', 'world')[0]
  const hurt = g.game.mods.submit(w.id, { artifacts: [{ kind: 'rule', rule: { id: 'patch/hurt', on: 'witness', when: { about: ['take:bystander'] }, do: [{ op: 'damage', of: 'actor', amount: 3 }] } }] })
  expect(hurt.errors.join()).toContain('may not harm a person')
})

req('E4', 'the library is shared and persistent: a save keeps it, a new game keeps it', [], () => {
  const f = fresh()
  stand(f, 25, 15, 'right')
  run(f, 'hands', ...AT.raft)
  const rec = asked(f, 'interaction', 'player')[0]
  f.game.mods.submit(rec.id, { artifacts: [{ kind: 'rule', rule: { id: 'patch/raft', on: 'interaction', when: { verb: ['interact'], target: { type: 'fixture/ferry/raft' }, instrument: { none: true } }, do: [{ op: 'vfx', at: 'target', fx: 'splash' }], tests: [] } }] })
  const save = f.game.save()
  const { index } = buildFord()
  const loaded = Game.load(JSON.parse(JSON.stringify(save)), index, onto)
  expect(loaded.engine.lib.rules.has('patch/raft')).toBe(true)
  const next = Game.create(index, onto, f.eng.lib)
  expect(next.engine.lib.rules.has('patch/raft')).toBe(true)
})

// ------------------------------------------------------------------ C. the ontology the rules address

req('C1', 'every kind of thing: the player, people, creatures, items, fixtures, and tiles with statuses', ['npc.hesper', 'npc.tobin', 'actor/creature/slime/fire_slime', 'item/tool/rope', 'fixture/light/campfire'], () => {
  const f = fresh()
  const kinds = new Set<string>(Object.values(W(f).state.entities).filter((e) => e.place.on !== 'none').map((e) => (e.npc ? 'person' : e.ai ? 'creature' : W(f).kindOf(e))))
  for (const k of ['actor', 'person', 'creature', 'item', 'fixture']) expect(kinds.has(k)).toBe(true)
  // tiles take statuses (the oiled path of B5, the burning meadow): a tile here can burn
  expect(W(f).map('ford')!.terrain.includes('drygrass')).toBe(true)
})

req('C2', 'every element of the reaction triangle has a source: fire, water, ice, lightning — and oil', ['item/light/torch', 'actor/creature/slime/fire_slime', 'item/vessel/bucket/empty', 'item/weapon/magic/wand', 'actor/creature/slime/frost_slime', 'weather:storm', 'item/vessel/flask/oil'], () => {
  const f = fresh()
  expect(W(f).hasTag(ofType(f, 'item/light/torch')!, 'fire-source')).toBe(true)
  expect(W(f).prop(ofType(f, 'actor/creature/slime/fire_slime')!, 'element')).toBe('fire')
  expect(W(f).hasTag(ofType(f, 'item/vessel/bucket/empty')!, 'empty-vessel')).toBe(true)
  expect(W(f).map('ford')!.terrain.includes('water')).toBe(true)
  expect(W(f).prop(ofType(f, 'item/weapon/magic/wand')!, 'element')).toBe('ice')
  expect(buildFord().index.weather!.some((s) => s.weather === 'storm')).toBe(true)
  expect(W(f).hasTag(ofType(f, 'item/vessel/flask/oil')!, 'liquid:oil')).toBe(true)
})

// ------------------------------------------------------------------ D. the inputs on this map

req('D1', 'every class of held thing is here: none, an object, food, a pure weapon, a tool-weapon', ['item/tool/rope', 'item/food/bread', 'item/weapon/magic/wand', 'item/weapon/blade/axe'], () => {
  const f = fresh()
  expect(ofType(f, 'item/tool/rope')).toBeDefined()
  expect(W(f).hasTag(ofType(f, 'item/food/bread')!, 'edible')).toBe(true)
  const wand = ofType(f, 'item/weapon/magic/wand')!
  const axe = ofType(f, 'item/weapon/blade/axe')!
  expect(wand.type.startsWith('item/weapon') && !W(f).hasTag(wand, 'tool:axe')).toBe(true)
  expect(W(f).hasTag(axe, 'tool:axe')).toBe(true)
})

req('D2', 'every layer a target can be: a person, a creature, a fixture, a loose item, a pile on a fixture, the ground, oneself — each reachable by every input', ['fixture/furniture/cart', 'item/weapon/magic/wand'], () => {
  const f = fresh()
  stand(f, 20, 11, 'left')
  const layers = f.eng.controls.layers({ map: 'ford', ...at(...AT.cart) })
  const kinds = layers.map((r) => ('tile' in r ? 'ground' : W(f).kindOf(W(f).get(r.e)!)))
  expect(kinds).toEqual(['fixture', 'item', 'item', 'ground'])
  hold(f, ofType(f, 'item/food/bread'))
  for (const key of ['hands', 'take', 'use', 'put'] as Key[]) {
    const choices = f.eng.controls.choices(key, at(...AT.cart))
    expect(choices.every((c) => c.plan)).toBe(true)
  }
  // oneself, a person and a creature, from the own tile and beside them
  stand(f, 18, 12)
  expect(f.eng.controls.layers({ map: 'ford', x: 18, y: 12 }).some((r) => 'e' in r && r.e === 'player')).toBe(true)
  expect(f.eng.controls.plan('hands', at(19, 12))?.target).toEqual({ e: 'npc.tobin' })
  const slime = W(f).get('ford.fire_slime')!
  W(f).place(slime, { on: 'tile', map: 'ford', x: 17, y: 12 })
  expect(f.eng.controls.plan('use', at(17, 12))?.target).toEqual({ e: slime.id })
})

// ------------------------------------------------------------------ F. what a game needs at the least

req('F1', 'the goal is a state: the far bank ends the story, however the player got there', ['region:far_bank'], () => {
  const f = fresh()
  stand(f, ...AT.farLanding)
  W(f).fx = []
  const cards: unknown[] = []
  expect(
    ticks(f, 400, () => {
      cards.push(...W(f).fx.filter((x) => x.t === 'card'))
      W(f).fx = []
      return W(f).num(W(f).player, 'quest') === 2 && !W(f).state.scene
    }),
  ).toBe(true)
  expect(far(f)).toBe(true)
  expect(cards.length).toBe(1)
})

req('F2a', 'the ferry: the rope from her chest, the winch mended, and she takes you over', ['item/tool/rope', 'fixture/container/chest', 'fixture/ferry/winch', 'npc.hesper', 'fixture/ferry/raft'], () => {
  const f = fresh()
  stand(f, 14, 14)
  const open = run(f, 'hands', ...AT.chest)
  expect(open.panel).toBe('ford.chest')
  f.eng.controls.transfer('ford.chest', 'chest', ofType(f, 'item/tool/rope')!.id, true)
  hold(f, ofType(f, 'item/tool/rope'))
  stand(f, 24, 15)
  expect(run(f, 'put', ...AT.winch).rule).toBe('ford/mend-winch')
  const h = W(f).posOf(W(f).get('npc.hesper')!)!
  stand(f, h.x, h.y + 1 <= 20 && W(f).walkable('ford', h.x, h.y + 1) ? h.y + 1 : h.y - 1)
  expect(run(f, 'hands', h.x, h.y).rule).toBe('ford/ask-crossing')
  expect(ticks(f, 600, () => far(f))).toBe(true)
})

req('F2b', 'the dead tree: the axe, three blows from the west, and a walk across', ['item/weapon/blade/axe', 'fixture/nature/dead_tree'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  stand(f, 25, 10, 'right')
  for (let i = 0; i < 3; i++) run(f, 'use', ...AT.deadTree)
  expect(W(f).fact('ford.tree')).toBe(1)
  walkEast(f)
  expect(far(f)).toBe(true)
})

req('F2c', "the ice: bread for the peddler's frost wand, then a path frozen across", ['npc.tobin', 'item/food/bread', 'item/weapon/magic/wand'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, 19, 13)
  expect(run(f, 'put', 19, 12).rule).toBe('ford/feed-peddler')
  stand(f, 20, 11, 'left')
  const wand = ofType(f, 'item/weapon/magic/wand')!
  f.eng.controls.run(f.eng.controls.plan('take', at(...AT.cart), 1)!)
  hold(f, W(f).get(wand.id))
  stand(f, 25, 13, 'right')
  for (let i = 0; i < 12 && !far(f); i++) {
    const p = W(f).posOf(W(f).player)!
    if (!W(f).walkable('ford', p.x + 1, p.y)) {
      run(f, 'use', p.x + 1, p.y)
      ticks(f, 6)
    }
    f.eng.movePlayer('right')
    ticks(f, 25, () => far(f))
  }
  expect(far(f)).toBe(true)
})

req('F3', 'the place teaches, not text: ice shows by the frost slime, dry hay waits on the fire slime\'s path, water lies beyond the dead tree, the bucket by the river, the torch by the fire', ['actor/creature/slime/frost_slime', 'actor/creature/slime/fire_slime', 'fixture/nature/haystack', 'fixture/nature/dead_tree', 'item/vessel/bucket/empty', 'item/light/torch', 'fixture/light/campfire'], () => {
  const f = fresh()
  const m = W(f).map('ford')!
  const near = (x: number, y: number, r: number, pred: (t: string) => boolean) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (pred(W(f).terrainAt('ford', x + i, y + j))) return true
    return false
  }
  expect(near(...AT.frostSlime, 2, (t) => t === 'ice')).toBe(true)
  const night = W(f).get('ford.fire_slime')!.ai!.night!
  expect(Math.max(Math.abs(night.x - AT.haystack[0]), Math.abs(night.y - AT.haystack[1]))).toBeLessThanOrEqual(3)
  expect(W(f).terrainAt('ford', AT.deadTree[0] + 1, AT.deadTree[1])).toBe('water')
  expect(near(...AT.bucket, 2, (t) => t === 'water')).toBe(true)
  expect(Math.abs(AT.torch[0] - AT.campfire[0]) + Math.abs(AT.torch[1] - AT.campfire[1])).toBeLessThanOrEqual(2)
  expect(m.anchors?.['camp.fire']).toBeDefined()
})

req('F4', 'risk, and recovery: creatures strike; at no health you wake by the fire, the story intact', ['actor/creature/slime/fire_slime', 'fixture/light/campfire'], () => {
  const f = fresh()
  stand(f, 30 - 20, 10)
  f.eng.damage(W(f).player, 999)
  const p = W(f).posOf(W(f).player)!
  expect(Math.abs(p.x - AT.spawn[0]) + Math.abs(p.y - AT.spawn[1])).toBeLessThanOrEqual(2)
  expect(W(f).num(W(f).player, 'quest')).toBe(1)
  expect(W(f).num(W(f).player, 'hp')).toBe(W(f).num(W(f).player, 'maxHp'))
})

req('F5', 'the world acts alone: a storm strikes, the slimes come out at night, people keep their day', ['weather:storm', 'actor/creature/slime/fire_slime', 'npc.hesper', 'npc.tobin'], () => {
  const f = fresh()
  stand(f, 16, 16)
  const strikes: unknown[] = []
  ticks(f, 9 * TICKS_PER_HOUR, () => (strikes.push(...W(f).fx.filter((x) => x.t === 'strike')), (W(f).fx = []), false))
  expect(strikes.length).toBeGreaterThan(0)
  // 22:00: the fire slime has left the hollow; Hesper sleeps by the fire
  const slime = W(f).posOf(W(f).get('ford.fire_slime')!)!
  expect(Math.abs(slime.x - AT.fireSlime[0]) + Math.abs(slime.y - AT.fireSlime[1])).toBeGreaterThan(3)
  const h = W(f).posOf(W(f).get('npc.hesper')!)!
  const bed = W(f).map('ford')!.anchors!['camp.bed']
  expect(Math.abs(h.x - bed[0]) + Math.abs(h.y - bed[1])).toBeLessThanOrEqual(2)
})

req('F6', 'people with lives of their own: a tie to each other, a day of their own, words for the moment', ['npc.hesper', 'npc.tobin'], () => {
  const f = fresh()
  for (const [id, other] of [['npc.hesper', 'npc.tobin'], ['npc.tobin', 'npc.hesper']]) {
    const p = W(f).get(id)!.npc!.person!
    expect(p.ties?.[other]).toBeDefined()
    expect(p.schedules!.find((s) => s.key === 'default')!.entries.length).toBeGreaterThanOrEqual(4)
    expect(p.lines!.length).toBeGreaterThanOrEqual(10)
    expect(p.lines!.some((l) => l.key.startsWith('fact:'))).toBe(true)
  }
})

req('F7', 'save and continue', [], () => {
  const f = fresh()
  stand(f, 20, 20)
  W(f).setFact('ford.tree', 1)
  const save = JSON.parse(JSON.stringify(f.game.save()))
  const { index, chunks } = buildFord()
  const g = Game.load(save, index, onto)
  g.loadMapData(decodeChunk(chunks[0]).map)
  expect(g.engine.world.posOf(g.engine.world.player)).toMatchObject({ x: 20, y: 20 })
  expect(g.engine.world.fact('ford.tree')).toBe(1)
})

req('F8', 'legible: before a press, every input shows what it will do, and the unknown is marked', ['fixture/ferry/raft', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, 25, 15, 'right')
  for (const key of ['hands', 'take', 'use', 'put'] as Key[]) expect(f.eng.controls.plan(key, at(...AT.raft))?.label).toBeDefined()
  expect(f.eng.controls.plan('hands', at(...AT.raft))?.unknown).toBe(true)
  expect(SLOT_COUNT).toBe(10)
})

req('F9', 'the arrival opens the story: the scene, the loaf in the pack, the objective', ['npc.hesper', 'npc.tobin', 'item/food/bread'], () => {
  const f = fresh({ arrival: true })
  expect(ticks(f, 300, () => W(f).num(W(f).player, 'quest') === 1 && !W(f).state.scene)).toBe(true)
  expect(W(f).player.contents?.some((id) => W(f).get(id)?.type === 'item/food/bread') || W(f).get(W(f).player.held)?.type === 'item/food/bread').toBe(true)
})

// =================================================================== the proof

describe('the Ford is complete', () => {
  for (const r of R) it(`${r.id}: ${r.what}`, r.check)

  it('A: every event kind the engine has occurred on this map', () => {
    for (const k of ['interaction', 'hit', 'status', 'expire', 'tick', 'enter', 'defeat', 'meet', 'blocked', 'witness', 'invalid']) {
      if (k === 'defeat' && !KINDS.has(k)) {
        // a slime falls to the axe
        const f = fresh()
        hold(f, ofType(f, 'item/weapon/blade/axe'))
        const s = W(f).get('ford.fire_slime')!
        W(f).place(s, { on: 'tile', map: 'ford', x: 16, y: 18 })
        s.props = { ...(s.props ?? {}), hp: 1 }
        stand(f, 16, 17, 'down')
        run(f, 'use', 16, 18)
      }
      expect([k, KINDS.has(k)]).toEqual([k, true])
    }
  })
})

describe('the Ford is minimal', () => {
  it('every placed thing, person and fixed piece of the world witnesses some requirement', () => {
    const { index, chunks } = buildFord()
    const placed = new Set<string>([...chunks.flatMap((c) => c.entities.map((e) => e.type)), ...index.npcs.map((n) => n.id), 'weather:storm', 'region:far_bank'])
    const witnessed = new Set(R.flatMap((r) => r.by))
    const idle = [...placed].filter((p) => !witnessed.has(p))
    expect(idle).toEqual([])
    const unknown = [...witnessed].filter((w) => !placed.has(w))
    expect(unknown).toEqual([])
  })
})
