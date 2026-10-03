// The Ford is complete (docs/game-design.md §9): it contains every element the demo must have,
// and nothing that witnesses none. The requirements R are derived, not chosen: the engine's
// event kinds (A, design.md §5.7), the sources of undefined behaviour (B, the table in §5.13),
// the ontology the rules address (C), the player's inputs (D, §5.2), the AI interface's loop (E,
// §5.11), and what a game needs at the least (F). Each requirement is checked on the real map,
// through the player's own inputs where there are any, with the world in strict mode: a change of
// state outside an outcome throws (§5.13, A2). Then the event model's own checks (§5.13), and the
// converse: every placed thing witnesses some requirement.

import { describe, expect, it } from 'vitest'
import {
  EVENT_KINDS,
  FIRE_RADIUS,
  FORAGE_EVERY,
  Game,
  RuleLibrary,
  SLOT_COUNT,
  TICKS_PER_HOUR,
  isRoot,
  kindCovers,
  leaves,
  rulesTie,
  tickAt,
  xpToNext,
  type Engine,
  type Entity,
  type GameEvent,
  type Key,
  type Patch,
  type Plan,
  type Ref,
} from '@lsw/engine'
import { BASE_RULES, FORM_BY_ID, RECIPE_BY_ID, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { AT, SOUTH_GAP, STAND, WEST_GAP, buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
/** Every event kind made in any of the worlds below: dispatched, or offered and passed over because nothing could answer it (no change). */
const KINDS = new Set<string>()

interface Ford {
  game: Game
  eng: Engine
  /** Every event this world dispatched, in order. */
  events: GameEvent[]
  /** Every event it made, dispatched or not (offered: made only if some rule could answer it). */
  made: GameEvent[]
}

/** A fresh Ford. `ai: false` plays it with no modder at all; otherwise a modder that never answers (the tests answer by hand, or the time-out does). */
function fresh(opts: { arrival?: boolean; ai?: boolean } = {}): Ford {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  if (opts.ai !== false) game.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = game.engine
  const events: GameEvent[] = []
  const made: GameEvent[] = []
  const dispatch = eng.dispatch.bind(eng)
  eng.dispatch = (ev) => (KINDS.add(ev.kind), events.push(ev), made.push(ev), dispatch(ev))
  const offer = eng.offer.bind(eng)
  eng.offer = (ev) => (KINDS.add(ev.kind), made.push(ev), offer(ev))
  const f = { game, eng, events, made }
  if (!opts.arrival)
    author(f, () => {
      eng.world.setFact('seen.arrival', true)
      ;(eng.world.player.props ??= {}).quest = 1
      eng.world.create('item/food/bread', { on: 'inside', holder: 'player' })
      eng.controls.sync()
    })
  // from here on, only outcomes change the world (and the tests, as its author, in `author`)
  eng.world.strict = true
  return f
}

const W = (f: Ford) => f.eng.world
/** The test sets the scene: an author's hand, not a change the world made. */
const author = <T>(f: Ford, fn: () => T): T => W(f).write(fn)
const ofType = (f: Ford, type: string) => Object.values(W(f).state.entities).find((e) => e.type === type)
const stand = (f: Ford, x: number, y: number, facing: Entity['facing'] = 'up', map = 'ford') =>
  author(f, () => {
    W(f).place(W(f).player, { on: 'tile', map, x, y })
    W(f).player.facing = facing
  })
/** Put a thing in the player's hand the way the player would: in the bag, then its slot selected. */
function hold(f: Ford, e: Entity | undefined): void {
  if (!e) throw new Error('nothing to hold')
  const c = f.eng.controls
  author(f, () => W(f).place(e, { on: 'inside', holder: 'player' }))
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
const asked = (f: Ford, kind: string, origin: 'player' | 'world') => records(f).filter((r) => r.event.kind === kind && r.origin === origin)
const isE = (ref: Ref | undefined, id: string | undefined) => !!ref && 'e' in ref && ref.e === id
const hostIs = (ev: GameEvent, id: string | undefined) => isE(ev.host, id)
const far = (f: Ford) => W(f).fact('ford.crossed') === 1

/** Walk east along a row until the player stands on the far bank (or cannot go on). */
function walkEast(f: Ford, limit = 12): void {
  for (let i = 0; i < limit && !far(f); i++) {
    f.eng.movePlayer('right')
    ticks(f, 25, () => far(f))
  }
}

// ------------------------------------------------------------------ the three ways across (F2, and the check without an AI)

/** The ferry: the rope from her chest, the winch mended, and she takes you over. */
function byFerry(f: Ford): void {
  stand(f, ...STAND.chest)
  const open = run(f, 'hands', ...AT.chest)
  expect(open.panel).toBe('ford.chest')
  f.eng.controls.transfer('ford.chest', 'chest', ofType(f, 'item/tool/rope')!.id, true)
  hold(f, ofType(f, 'item/tool/rope'))
  stand(f, ...STAND.winch)
  expect(run(f, 'put', ...AT.winch).rule).toBe('ford/mend-winch')
  const h = W(f).posOf(W(f).get('npc.hesper')!)!
  stand(f, h.x, h.y + 1 <= 20 && W(f).walkable('ford', h.x, h.y + 1) ? h.y + 1 : h.y - 1)
  expect(run(f, 'hands', h.x, h.y).rule).toBe('ford/ask-crossing')
  ticks(f, 600, () => far(f))
}

/** The dead tree: the axe, three blows from the west, and a walk across. */
function byTree(f: Ford): void {
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  stand(f, ...STAND.tree, 'right')
  for (let i = 0; i < 3; i++) run(f, 'use', ...AT.deadTree)
  expect(W(f).fact('ford.tree')).toBe(1)
  walkEast(f)
}

/** The ice: bread for the peddler's frost wand, then a path frozen across. */
function byIce(f: Ford): void {
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, ...STAND.tobin)
  expect(run(f, 'put', STAND.tobin[0], STAND.tobin[1] - 1).rule).toBe('ford/feed-peddler')
  stand(f, ...STAND.cart, 'left')
  const wand = ofType(f, 'item/weapon/magic/wand')!
  f.eng.controls.run(f.eng.controls.plan('take', at(...AT.cart), 1)!)
  hold(f, W(f).get(wand.id))
  stand(f, ...STAND.castFrom, 'right')
  for (let i = 0; i < 12 && !far(f); i++) {
    const p = W(f).posOf(W(f).player)!
    if (!W(f).walkable('ford', p.x + 1, p.y)) {
      run(f, 'use', p.x + 1, p.y)
      ticks(f, 6)
    }
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

// ------------------------------------------------------------------ B. sources of undefined behaviour (design.md §5.13), and E, the AI interface's loop

req('B1', 'using a thing on something its nature says nothing about is undefined at the root, and asked (bread on the winch)', ['item/food/bread', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, ...STAND.winch)
  const plan = run(f, 'use', ...AT.winch)
  expect(plan.unknown).toBe(true)
  const r = asked(f, 'act/use', 'player')
  expect(r).toHaveLength(1)
  expect(r[0].request.hole.rule).toBe('core/use')
})

req('B2', 'putting something on a thing that does not say how it receives it is asked, hosted by the receiver (the axe on the dead tree)', ['item/weapon/blade/axe', 'fixture/nature/dead_tree'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  stand(f, ...STAND.tree, 'right')
  // the default would set it down at the tree's foot; the chooser picks the tree itself
  f.eng.controls.run(f.eng.controls.plan('put', at(...AT.deadTree), 0)!)
  expect(asked(f, 'impulse/receive', 'player').some((r) => hostIs(r.event, 'ford.dead_tree') && r.request.hole.rule === 'core/receive')).toBe(true)
})

req('B3', 'a blow on a thing with no answer to it is asked, hosted by the one struck (an axe at the winch)', ['item/weapon/blade/axe', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  stand(f, ...STAND.winch)
  const plan = run(f, 'use', ...AT.winch)
  expect(plan.unknown).toBe(true)
  expect(asked(f, 'impulse/strike', 'player').some((r) => hostIs(r.event, 'ford.winch') && r.request.hole.rule === 'core/strike')).toBe(true)
})

req('B4', 'a bare hand on something that does not say how it is handled is asked (E on the raft)', ['fixture/ferry/raft'], () => {
  const f = fresh()
  stand(f, ...STAND.raft, 'right')
  const plan = run(f, 'hands', ...AT.raft)
  expect(plan.unknown).toBe(true)
  expect(asked(f, 'impulse/handle', 'player').some((r) => hostIs(r.event, 'ford.raft'))).toBe(true)
})

req('B5', 'stepping onto a tile in a state is contact, answered by the tile (oil on the path: no change at the root, nothing asked)', ['item/vessel/flask/oil'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/vessel/flask/oil'))
  stand(f, ...STAND.road, 'right')
  const tile = { map: 'ford', x: STAND.road[0] + 1, y: STAND.road[1] }
  run(f, 'use', tile.x, tile.y)
  expect(W(f).hasStatus({ tile }, 'oiled')).toBe(true)
  f.events.length = 0
  f.eng.movePlayer('right')
  const touch = f.events.find((e) => e.kind === 'contact/begin' && 'tile' in e.host && e.host.tile.x === tile.x && e.host.tile.y === tile.y)
  expect(touch?.params?.how).toBe('under')
  expect(records(f)).toHaveLength(0)
})

req('B8', "a cascade reaches things as impulses: the storm's lightning seeks the dead tree, which takes it by physics", ['fixture/nature/dead_tree', 'weather:storm'], () => {
  const f = fresh()
  setHour(f, 1, 17.2)
  stand(f, ...STAND.tree)
  expect(ticks(f, 3000, () => f.events.some((e) => e.kind === 'impulse/element' && e.params?.element === 'lightning' && hostIs(e, 'ford.dead_tree') && e.origin === 'world'))).toBe(true)
})

req('B9', 'creatures meet things, each side for itself: a fire slime running up against dry hay sets it alight (its own rule); after dark the slimes touch the world and nothing is held', ['actor/creature/slime/fire_slime', 'actor/creature/slime/frost_slime', 'fixture/nature/haystack'], () => {
  const f = fresh()
  const slime = W(f).get('ford.fire_slime')!
  const hay = ofType(f, 'fixture/nature/haystack')!
  const hp = W(f).posOf(hay)!
  author(f, () => W(f).place(slime, { on: 'tile', map: 'ford', x: hp.x - 1, y: hp.y }))
  f.eng.step(slime, 'right')
  expect(W(f).hasStatus({ e: hay.id }, 'burning')).toBe(true)
  // after dark, the slimes are out: their contacts are events, answered without holding anyone
  const g = fresh()
  setHour(g, 2, 20.9)
  stand(g, ...STAND.winch)
  author(g, () => {
    W(g).player.props!.hp = 10_000
    W(g).player.props!.maxHp = 10_000
  })
  const slimes = ['ford.fire_slime', 'ford.frost_slime']
  expect(ticks(g, 2 * TICKS_PER_HOUR, () => g.events.some((e) => e.kind.startsWith('contact/') && slimes.some((s) => hostIs(e, s))))).toBe(true)
  for (const s of slimes) expect(W(g).get(s)?.frozenBy).toBeUndefined()
})

req('B10', 'a person is stuck: her fire soaked, she cannot tend it; asked, hosted by her', ['npc.hesper', 'fixture/light/campfire', 'item/vessel/bucket/empty'], () => {
  const f = fresh()
  setHour(f, 2, 17.8)
  const fire = W(f).get('ford.campfire')!
  hold(f, ofType(f, 'item/vessel/bucket/empty'))
  // fill the bucket at the river, douse the fire: it is out and wet
  stand(f, ...STAND.fill, 'right')
  run(f, 'use', STAND.fill[0] + 1, STAND.fill[1])
  stand(f, ...AT.spawn)
  run(f, 'use', ...AT.campfire)
  expect(W(f).hasStatus({ e: fire.id }, 'lit')).toBe(false)
  author(f, () => W(f).setStatus({ e: fire.id }, 'wet', W(f).state.tick + 2000))
  expect(ticks(f, TICKS_PER_HOUR, () => asked(f, 'stuck', 'world').some((r) => hostIs(r.event, 'npc.hesper')))).toBe(true)
})

req('B11', 'an act is seen by those who can see it: the owner of what was taken objects (her rule); a bystander sees it too (no change at the root)', ['npc.tobin', 'npc.hesper', 'fixture/furniture/cart', 'item/vessel/flask/oil'], () => {
  const f = fresh()
  stand(f, ...STAND.cart, 'left')
  const oil = ofType(f, 'item/vessel/flask/oil')!
  run(f, 'take', ...AT.cart)
  expect(W(f).player.held === oil.id || W(f).player.contents?.includes(oil.id)).toBe(true)
  const seen = f.eng.trace.filter((t) => t.ev.kind === 'seen' && t.ev.params?.act === 'take')
  expect(seen.some((t) => hostIs(t.ev, 'npc.tobin') && t.ev.params?.owner === 'mine' && t.rule === 'seen/owner-take')).toBe(true)
  expect(seen.some((t) => hostIs(t.ev, 'npc.hesper') && t.ev.params?.owner === 'another' && t.defined)).toBe(true)
})

req('B12', 'content is broken by state: the rope burns; the story is asked, and its fallback keeps the Ford playable', ['item/tool/rope', 'fixture/ferry/winch', 'npc.hesper'], () => {
  const f = fresh()
  const rope = ofType(f, 'item/tool/rope')!
  author(f, () => W(f).place(rope, { on: 'tile', map: 'ford', x: STAND.road[0], y: STAND.road[1] }))
  f.eng.queue({ kind: 'impulse/element', host: { e: rope.id }, roles: {}, params: { element: 'fire', power: 2 }, origin: 'world' })
  expect(ticks(f, 200, () => asked(f, 'broken', 'world').length > 0)).toBe(true)
  expect(ofType(f, 'item/tool/rope')).toBeUndefined()
  ticks(f, f.game.mods.timeoutTicks + 5)
  expect(ofType(f, 'item/tool/rope')).toBeDefined()
})

const raftPatch = (id: string): Patch => ({
  artifacts: [
    {
      kind: 'rule',
      rule: {
        id,
        doc: 'A shove rocks the raft on its line.',
        host: { type: 'fixture/ferry/raft' },
        on: 'impulse/handle',
        tree: { do: [{ op: 'vfx', fx: 'splash' }, { op: 'log', text: 'The raft rocks on its line.' }] },
        tests: [],
      },
    },
  ],
})

req('E1', 'a patch answers a request: validated, applied, in the Threadbook as yours; the class never asks again', ['fixture/ferry/raft'], () => {
  const f = fresh()
  stand(f, ...STAND.raft, 'right')
  run(f, 'hands', ...AT.raft)
  const rec = asked(f, 'impulse/handle', 'player')[0]
  // while the world works it out, the one acting is at it too: no other act, no step
  expect(W(f).player.frozenBy).toBe(rec.id)
  expect(f.eng.movePlayer('left')).toBe(false)
  expect(f.eng.controls.plan('hands', at(...AT.raft))).toBeDefined()
  expect(f.game.mods.submit(rec.id, raftPatch('patch/rock-the-raft')).ok).toBe(true)
  expect(W(f).player.frozenBy).toBeUndefined()
  expect(f.eng.lib.rules.get('patch/rock-the-raft')?.source).toMatchObject({ origin: 'patch', trigger: 'player' })
  const again = f.eng.controls.plan('hands', at(...AT.raft))!
  expect(again.unknown).toBeUndefined()
  f.eng.controls.run(again)
  expect(records(f)).toHaveLength(1)
})

/** A person who cannot go on with their day (as behaviour reports it). */
const stuck = (f: Ford, who: string): void =>
  f.eng.queue({ kind: 'stuck', host: { e: who }, roles: { target: { e: 'ford.campfire' } }, params: { activity: 'tend the fire' }, origin: 'world' })

req('E2', "the world's own requests are learned as the world's: the Threadbook says who", ['npc.hesper'], () => {
  const f = fresh()
  stand(f, ...STAND.byFire)
  stuck(f, 'npc.hesper')
  const rec = asked(f, 'stuck', 'world')[0]
  expect(rec).toBeDefined()
  const patch: Patch = {
    artifacts: [
      {
        kind: 'rule',
        rule: {
          id: 'patch/sigh-at-the-fire',
          doc: 'A person kept from their task sighs and waits.',
          host: { type: 'actor/person' },
          on: 'stuck',
          tree: { do: [{ op: 'emote', mood: 'sad' }, { op: 'say', text: { en: 'Not now, then.', zh: '那就等等吧。' } }] },
          tests: [],
        },
      },
    ],
  }
  expect(f.game.mods.submit(rec.id, patch).ok).toBe(true)
  expect(f.eng.lib.rules.get('patch/sigh-at-the-fire')?.source?.trigger).toBe('world')
})

req('E3', "a patch that breaks the rules is rejected and the default stands; the world's patches never harm a person", ['npc.tobin'], () => {
  const f = fresh()
  stand(f, ...STAND.raft, 'right')
  run(f, 'hands', ...AT.raft)
  const rec = asked(f, 'impulse/handle', 'player')[0]
  const bad = f.game.mods.submit(rec.id, { artifacts: [{ kind: 'rule', rule: { id: 'patch/bad', host: { type: 'fixture/ferry/raft' }, on: 'impulse/handle', tree: { do: [{ op: 'addStatus', status: 'no-such-status' }] } } }] })
  expect(bad.ok).toBe(false)
  expect(rec.status).toBe('rejected')
  // a person kept from their day, answered with violence, is refused
  const g = fresh()
  stuck(g, 'npc.tobin')
  const w = asked(g, 'stuck', 'world')[0]
  const hurt = g.game.mods.submit(w.id, { artifacts: [{ kind: 'rule', rule: { id: 'patch/hurt', host: { type: 'actor/person' }, on: 'stuck', tree: { do: [{ op: 'hurt', amount: 3 }] } } }] })
  expect(hurt.errors.join()).toContain('may not harm a person')
})

req('E4', 'the library is shared and persistent: a save keeps it, a new game keeps it', [], () => {
  const f = fresh()
  stand(f, ...STAND.raft, 'right')
  run(f, 'hands', ...AT.raft)
  const rec = asked(f, 'impulse/handle', 'player')[0]
  expect(f.game.mods.submit(rec.id, raftPatch('patch/raft')).ok).toBe(true)
  const save = f.game.save()
  const { index } = buildFord()
  const loaded = Game.load(JSON.parse(JSON.stringify(save)), index, onto)
  expect(loaded.engine.lib.rules.has('patch/raft')).toBe(true)
  const next = Game.create(index, onto, f.eng.lib)
  expect(next.engine.lib.rules.has('patch/raft')).toBe(true)
})

// ------------------------------------------------------------------ C. the ontology the rules address

req('C1', 'every kind of thing: the player, people, creatures, items, fixtures, tiles with statuses, and the residents', ['npc.hesper', 'npc.tobin', 'actor/creature/slime/fire_slime', 'item/tool/rope', 'fixture/light/campfire'], () => {
  const f = fresh()
  const kinds = new Set<string>(Object.values(W(f).state.entities).filter((e) => e.place.on !== 'none').map((e) => (e.npc ? 'person' : e.ai ? 'creature' : W(f).kindOf(e))))
  for (const k of ['actor', 'person', 'creature', 'item', 'fixture', 'resident']) expect([k, kinds.has(k)]).toEqual([k, true])
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
  stand(f, ...STAND.cart, 'left')
  const layers = f.eng.controls.layers({ map: 'ford', ...at(...AT.cart) })
  const kinds = layers.map((r) => ('tile' in r ? 'ground' : W(f).kindOf(W(f).get(r.e)!)))
  expect(kinds).toEqual(['item', 'item', 'fixture', 'ground'])
  hold(f, ofType(f, 'item/food/bread'))
  for (const key of ['hands', 'take', 'use', 'put'] as Key[]) {
    const choices = f.eng.controls.choices(key, at(...AT.cart))
    expect(choices.every((c) => c.plan)).toBe(true)
  }
  // oneself, a person and a creature, from the own tile and beside them
  stand(f, ...STAND.tobin)
  expect(f.eng.controls.layers({ map: 'ford', x: STAND.tobin[0], y: STAND.tobin[1] }).some((r) => 'e' in r && r.e === 'player')).toBe(true)
  expect(f.eng.controls.plan('hands', at(STAND.tobin[0], STAND.tobin[1] - 1))?.target).toEqual({ e: 'npc.tobin' })
  const slime = W(f).get('ford.fire_slime')!
  author(f, () => W(f).place(slime, { on: 'tile', map: 'ford', x: STAND.tobin[0] - 1, y: STAND.tobin[1] }))
  expect(f.eng.controls.plan('use', at(STAND.tobin[0] - 1, STAND.tobin[1]))?.target).toEqual({ e: slime.id })
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
  byFerry(f)
  expect(far(f)).toBe(true)
})

req('F2b', 'the dead tree: the axe, three blows from the west, and a walk across', ['item/weapon/blade/axe', 'fixture/nature/dead_tree'], () => {
  const f = fresh()
  byTree(f)
  expect(far(f)).toBe(true)
})

req('F2c', "the ice: bread for the peddler's frost wand, then a path frozen across", ['npc.tobin', 'item/food/bread', 'item/weapon/magic/wand'], () => {
  const f = fresh()
  byIce(f)
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

/** A blow as the world deals it: an impulse to the one struck, from whoever struck. */
const strike = (f: Ford, who: Entity, power: number, by: Ref, element?: string) =>
  f.eng.queue({ kind: 'impulse/strike', host: { e: who.id }, roles: { actor: by, source: by }, params: { power, edge: 'blunt', ...(element ? { element } : {}) }, origin: 'world' })

req('F4', 'risk, and recovery: anyone at no health — the player as any person — collapses for a while and comes to, the story intact', ['actor/creature/slime/fire_slime', 'npc.tobin'], () => {
  const f = fresh()
  stand(f, ...STAND.road)
  const slime: Ref = { e: 'ford.fire_slime' }
  for (const who of [W(f).player, W(f).get('npc.tobin')!]) {
    strike(f, who, 999, slime, 'fire')
    ticks(f, 2)
    expect(W(f).hasStatus({ e: who.id }, 'down')).toBe(true)
    expect(f.eng.busy(who)).toBe(true)
    ticks(f, 320)
    expect(W(f).hasStatus({ e: who.id }, 'down')).toBe(false)
    expect(W(f).num(who, 'hp')).toBeGreaterThan(0)
    expect(W(f).get(who.id)).toBeDefined()
  }
  expect(W(f).num(W(f).player, 'quest')).toBe(1)
})

req('F10', 'the wild attacks folk by faction — the player and people alike, after dark or once struck; people run; a lit fire keeps the wild off', ['actor/creature/slime/frost_slime', 'npc.tobin', 'fixture/light/campfire'], () => {
  const f = fresh()
  const slime = W(f).get('ford.frost_slime')!
  const tobin = W(f).get('npc.tobin')!
  setHour(f, 2, 12)
  expect([f.eng.hostileTo(slime, tobin), f.eng.hostileTo(slime, W(f).player)]).toEqual([false, false])
  setHour(f, 2, 22.5)
  expect([f.eng.hostileTo(slime, tobin), f.eng.hostileTo(slime, W(f).player)]).toEqual([true, true])
  setHour(f, 2, 12)
  strike(f, slime, 1, { e: tobin.id })
  expect([f.eng.hostileTo(slime, tobin), f.eng.hostileTo(slime, W(f).player)]).toEqual([true, false])
  // after dark, out in the meadow far from the fire: it goes for Tobin, and he runs (or takes the blow)
  const g = fresh()
  setHour(g, 2, 22.5)
  stand(g, ...STAND.road)
  const s2 = W(g).get('ford.frost_slime')!
  const t2 = W(g).get('npc.tobin')!
  author(g, () => {
    W(g).place(t2, { on: 'tile', map: 'ford', x: STAND.frostGround[0] - 2, y: STAND.frostGround[1] })
    W(g).place(s2, { on: 'tile', map: 'ford', x: STAND.frostGround[0], y: STAND.frostGround[1] })
  })
  const hp = W(g).num(t2, 'hp')
  let ran = 0
  ticks(g, 400, () => {
    const p = W(g).posOf(t2)!
    ran = Math.max(ran, Math.abs(p.x - (STAND.frostGround[0] - 2)) + Math.abs(p.y - STAND.frostGround[1]))
    return false
  })
  expect(ran).toBeGreaterThanOrEqual(2)
  // one who cannot run (frozen stiff beside it, on its ground) is struck
  author(g, () => {
    W(g).place(t2, { on: 'tile', map: 'ford', x: STAND.frostGround[0], y: STAND.frostGround[1] })
    W(g).place(s2, { on: 'tile', map: 'ford', x: STAND.frostGround[0] + 1, y: STAND.frostGround[1] })
    W(g).setStatus({ e: t2.id }, 'frozen', W(g).state.tick + 200)
  })
  ticks(g, 60)
  expect(W(g).num(t2, 'hp')).toBeLessThan(hp)
  // a lit fire: the slime roams up to the camp at night, and never into the fire's reach
  const h = fresh()
  setHour(h, 2, 21.2)
  stand(h, ...STAND.road)
  const s3 = W(h).get('ford.frost_slime')!
  s3.ai!.night = { map: 'ford', x: AT.campfire[0], y: AT.campfire[1] + 1 }
  let nearest = Infinity
  ticks(h, 1500, () => {
    const p = W(h).posOf(s3)!
    const d = Math.max(Math.abs(p.x - AT.campfire[0]), Math.abs(p.y - AT.campfire[1]))
    nearest = Math.min(nearest, d)
    return false
  })
  expect(nearest).toBe(FIRE_RADIUS + 1)
})

/** Everything on the Ford that is there to be seen: each is a thing, none a picture. */
const SEEN = ['fixture/tent', 'fixture/furniture/bench/log', 'fixture/furniture/rack', 'fixture/nature/logpile/stack', 'fixture/nature/stump', 'fixture/light/lantern', 'fixture/nature/boulder', 'fixture/sign', 'item/material/bone', 'fixture/nature/moss', 'fixture/nature/flowers', 'fixture/nature/reeds', 'fixture/nature/ferns', 'fixture/nature/leaves', 'fixture/nature/pebbles', 'fixture/nature/tuft']
req('F11', 'a place, not a picture: all that is drawn or in the way is terrain or a thing; an input meets the top of what is drawn where it points, any of it by a long press, and what nothing defines goes to the world', SEEN, () => {
  const f = fresh()
  // the map carries no picture of its own: a chunk is terrain, anchors, and things
  const raw = buildFord().chunks[0].map as unknown as Record<string, unknown>
  expect(raw.decor).toBeUndefined()
  // nor a wall of its own: what blocks is solid terrain or a solid thing
  expect(raw.solid).toBeUndefined()
  for (const type of SEEN) expect([type, !!ofType(f, type)]).toEqual([type, true])
  // the old axe on the chopping stump, pointed at where the stump is drawn over the grass
  const stump = ofType(f, 'fixture/nature/stump')!
  const { x, y } = stump.place as { x: number; y: number }
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  stand(f, x - 1, y, 'right')
  const point = { x, y, stack: [{ e: stump.id }] }
  const plan = f.eng.controls.plan('use', point)!
  expect(plan.target).toEqual({ e: stump.id })
  // the long press reaches what lies under it: the ground
  expect(f.eng.controls.choices('use', point).map((c) => c.plan?.target)).toEqual([{ e: stump.id }, { tile: { map: 'ford', x, y } }])
  f.eng.controls.run(plan, true)
  expect(plan.unknown).toBe(true)
  // the blow is the axe's; what the stump does when struck is undefined, and asked of the stump
  expect(asked(f, 'impulse/strike', 'player').some((r) => hostIs(r.event, stump.id))).toBe(true)
  // a thing drawn over the tile beside its own is met there too: the tent, pointed at its wall
  const tent = ofType(f, 'fixture/tent')!
  const t = tent.place as { x: number; y: number }
  stand(f, t.x - 2, t.y - 1, 'right')
  expect(f.eng.controls.plan('hands', { x: t.x - 1, y: t.y - 1, stack: [{ e: tent.id }] })?.target).toEqual({ e: tent.id })
  // it is in the way over its whole base while it stands, and nowhere once it is gone
  const base = [-1, 0, 1].flatMap((dx) => [0, -1, -2].map((dy) => [t.x + dx, t.y + dy] as const))
  expect(base.every(([x, y]) => !W(f).walkable('ford', x, y))).toBe(true)
  author(f, () => W(f).destroy(tent))
  expect(base.every(([x, y]) => W(f).walkable('ford', x, y))).toBe(true)
})

req('F5', 'the world acts alone: a storm strikes, the slimes come out of their burrow at night, people keep their day', ['weather:storm', 'actor/creature/slime/fire_slime', 'fixture/nature/burrow', 'npc.hesper', 'npc.tobin'], () => {
  const f = fresh()
  stand(f, ...AT.spawn)
  const strikes: unknown[] = []
  const watch = () => (strikes.push(...W(f).fx.filter((x) => x.t === 'strike')), (W(f).fx = []), false)
  // 20:50, after the storm: Hesper tends the fire, as her evening says
  ticks(f, Math.round(7.83 * TICKS_PER_HOUR), watch)
  expect(strikes.length).toBeGreaterThan(0)
  const h = W(f).posOf(W(f).get('npc.hesper')!)!
  const fire = W(f).map('ford')!.anchors!['camp.fire']
  expect(Math.abs(h.x - fire[0]) + Math.abs(h.y - fire[1])).toBeLessThanOrEqual(2)
  // 22:00: the fire slime has left the hollow by its burrow
  ticks(f, Math.round(1.17 * TICKS_PER_HOUR), watch)
  const slime = W(f).posOf(W(f).get('ford.fire_slime')!)!
  expect(Math.abs(slime.x - AT.fireSlime[0]) + Math.abs(slime.y - AT.fireSlime[1])).toBeGreaterThan(3)
  expect(Math.abs(AT.burrow[0] - AT.fireSlime[0]) + Math.abs(AT.burrow[1] - AT.fireSlime[1])).toBeLessThanOrEqual(3)
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
  stand(f, ...STAND.road)
  author(f, () => W(f).setFact('ford.tree', 1))
  const save = JSON.parse(JSON.stringify(f.game.save()))
  const { index, chunks } = buildFord()
  const g = Game.load(save, index, onto)
  g.loadMapData(decodeChunk(chunks[0]).map)
  expect(g.engine.world.posOf(g.engine.world.player)).toMatchObject({ x: STAND.road[0], y: STAND.road[1] })
  expect(g.engine.world.fact('ford.tree')).toBe(1)
})

req('F8', 'legible: before a press, every input shows what it will do, and the unknown is marked', ['fixture/ferry/raft', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, ...STAND.raft, 'right')
  for (const key of ['hands', 'take', 'use', 'put'] as Key[]) expect(f.eng.controls.plan(key, at(...AT.raft))?.label).toBeDefined()
  expect(f.eng.controls.plan('hands', at(...AT.raft))?.unknown).toBe(true)
  stand(f, ...STAND.winch)
  expect(f.eng.controls.plan('use', at(...AT.winch))?.unknown).toBe(true)
  expect(SLOT_COUNT).toBe(30)
})

const FORAGE = ['item/material/stick', 'item/material/stone', 'item/material/grass']
const lying = (f: Ford, type: string, map = 'ford') => Object.values(W(f).state.entities).filter((e) => e.type === type && e.place.on === 'tile' && e.place.map === map)
/** An open tile beside (x, y), and the way to face from it. */
function beside(f: Ford, x: number, y: number): [number, number, Entity['facing']] {
  for (const [dx, dy, dir] of [[-1, 0, 'right'], [1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']] as const)
    if (W(f).walkable('ford', x + dx, y + dy)) return [x + dx, y + dy, dir]
  throw new Error(`nothing open beside ${x},${y}`)
}

req('F12', "the ground yields sticks, stones and grass (Don't Starve): taken by hand, they craft the first tools, which fell a tree and break a boulder", [...FORAGE, 'fixture/nature/boulder'], () => {
  const f = fresh()
  const c = f.eng.controls
  // gather everything lying about, through the take key
  for (const type of FORAGE)
    for (const e of lying(f, type)) {
      const [x, y, dir] = beside(f, e.place.on === 'tile' ? e.place.x : 0, e.place.on === 'tile' ? e.place.y : 0)
      stand(f, x, y, dir)
      run(f, 'take', ...([e.place.on === 'tile' && e.place.x, e.place.on === 'tile' && e.place.y] as [number, number]))
    }
  for (const type of FORAGE) expect(c.count(type)).toBeGreaterThanOrEqual(3)
  const axe = RECIPE_BY_ID['stone-axe']
  const pick = RECIPE_BY_ID['stone-pickaxe']
  expect(c.craft(axe)).toBe(true)
  expect(c.craft(pick)).toBe(true)
  // what they used up is gone; with too little, nothing is made
  expect(c.count('item/material/stone')).toBe(lying(fresh(), 'item/material/stone').length - 3)
  const made = (type: string) => [...(W(f).player.contents ?? []), W(f).player.held].map((id) => W(f).get(id)).find((e) => e?.type === type)!
  expect(made('item/weapon/blade/axe').name).toEqual({ en: 'Stone Axe', zh: '石斧' })
  expect(made('item/tool/pickaxe').name).toEqual({ en: 'Stone Pickaxe', zh: '石镐' })
  while (c.canCraft(pick)) c.craft(pick)
  expect(c.craft(pick)).toBe(false)
  // the stone axe fells a tree: two swings, a stump, logs
  hold(f, made('item/weapon/blade/axe'))
  let tree: [number, number] | undefined
  for (let y = 3; y < 28 && !tree; y++) for (let x = 0; x < 3 && !tree; x++) if (W(f).terrainAt('ford', x, y) === 'tree' && W(f).walkable('ford', x + 1, y)) tree = [x, y]
  stand(f, tree![0] + 1, tree![1], 'left')
  run(f, 'use', ...tree!)
  run(f, 'use', ...tree!)
  expect(W(f).terrainAt('ford', ...tree!)).toBe('stump')
  // the stone pickaxe breaks a boulder in three blows
  hold(f, made('item/tool/pickaxe'))
  const boulder = ofType(f, 'fixture/nature/boulder')!
  const bp = W(f).posOf(boulder)!
  const [sx, sy, dir] = beside(f, bp.x, bp.y)
  stand(f, sx, sy, dir)
  const stones = lying(f, 'item/material/stone').length
  for (let i = 0; i < 3; i++) run(f, 'use', bp.x, bp.y)
  expect(W(f).get(boulder.id)).toBeUndefined()
  expect(lying(f, 'item/material/stone').length).toBeGreaterThan(stones)
  // and the ground yields again over time, never more than a handful of each
  author(f, () => {
    for (const type of FORAGE) for (const e of lying(f, type)) W(f).destroy(e)
  })
  ticks(f, FORAGE_EVERY * 40)
  const forage = W(f).map('ford')!.forage!
  for (const type of FORAGE) {
    expect(lying(f, type).length).toBeGreaterThan(0)
    expect(lying(f, type).length).toBeLessThanOrEqual(forage.find((g) => g.type === type)!.max)
  }
})

req('F13', 'a defeated foe teaches whoever struck it: experience, levels, a skill point', ['actor/creature/slime/fire_slime', 'actor/creature/slime/frost_slime'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  const p = W(f).player
  for (const id of ['ford.fire_slime', 'ford.frost_slime']) {
    const s = W(f).get(id)!
    author(f, () => {
      W(f).place(s, { on: 'tile', map: 'ford', x: 16, y: 18 })
      s.props = { ...(s.props ?? {}), hp: 1 }
    })
    stand(f, 16, 17, 'down')
    f.eng.setCooldown('atk:player', 0)
    run(f, 'use', 16, 18)
    expect(W(f).get(id)).toBeUndefined()
  }
  // each slime is worth its full health (11); twenty make the second level
  expect(xpToNext(1)).toBe(20)
  expect(p.props).toMatchObject({ level: 2, xp: 2, skillPoints: 1 })
})

const COW = 'actor/creature/animal/cow'
const HEN = 'actor/creature/animal/chicken'
const onMeadow = (f: Ford, type: string) => Object.values(W(f).state.entities).filter((e) => e.type === type && e.place.on === 'tile' && e.place.map === 'meadow')

req('F14', 'west of the Ford a meadow (Minecraft): cows and hens that run when struck and come back slowly; meat from both, eggs from hens; each food feeds its own amount', [COW, HEN], () => {
  const f = fresh()
  const p = W(f).player
  // the road's gap in the western woods leads there
  stand(f, 1, WEST_GAP[1], 'left')
  f.eng.movePlayer('left')
  expect(W(f).posOf(p)?.map).toBe('meadow')
  expect(onMeadow(f, COW).length).toBeGreaterThan(0)
  expect(onMeadow(f, HEN).length).toBeGreaterThan(0)
  const here = W(f).posOf(p)!
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  // a struck cow runs from whoever struck it, and never strikes back
  const cow = onMeadow(f, COW)[0]
  author(f, () => {
    W(f).place(cow, { on: 'tile', map: 'meadow', x: here.x - 1, y: here.y })
    p.facing = 'left'
  })
  f.eng.setCooldown('atk:player', 0)
  run(f, 'use', here.x - 1, here.y)
  const hp = W(f).num(p, 'hp')
  ticks(f, 60)
  const cp = W(f).posOf(cow)!
  expect(Math.abs(cp.x - here.x) + Math.abs(cp.y - here.y)).toBeGreaterThan(2)
  expect(W(f).num(p, 'hp')).toBeGreaterThanOrEqual(hp)
  // a cow leaves meat, a hen chicken
  const meat = (type: string) => Object.values(W(f).state.entities).filter((e) => e.type === type).length
  // each killed on its own tile beside the player (west, then north), so their drops do not mix
  for (const [type, food, n, dx, dy, face] of [[COW, 'item/food/meat/raw', 2, -1, 0, 'left'], [HEN, 'item/food/chicken/raw', 1, 0, -1, 'up']] as const) {
    const a = onMeadow(f, type)[0]
    const before = meat(food)
    const [ax, ay] = [here.x + dx, here.y + dy]
    stand(f, here.x, here.y, face, 'meadow')
    author(f, () => {
      W(f).place(a, { on: 'tile', map: 'meadow', x: ax, y: ay })
      a.props = { ...(a.props ?? {}), hp: 1 }
    })
    f.eng.setCooldown('atk:player', 0)
    run(f, 'use', ax, ay)
    expect(W(f).get(a.id)).toBeUndefined()
    expect(meat(food) - before).toBe(n)
    // what a creature leaves lies where it fell: no magnet, taken with F
    ticks(f, 10)
    const there = W(f).entitiesAt('meadow', ax, ay).filter((e) => e.type === food)
    expect(there.length).toBe(n)
    expect(there.every((e) => !e.dropped)).toBe(true)
    const carried = f.eng.controls.count(food)
    run(f, 'take', ax, ay)
    expect(f.eng.controls.count(food)).toBe(carried + 1)
  }
  // a hen lays an egg where she stands, and starts on the next
  const hen = onMeadow(f, HEN)[0]
  const eggs = meat('item/food/egg/raw')
  author(f, () => W(f).setStatus({ e: hen.id }, 'laying', W(f).state.tick + 1))
  ticks(f, 3)
  expect(meat('item/food/egg/raw')).toBe(eggs + 1)
  const egg = lying(f, 'item/food/egg/raw', 'meadow').find((e) => !e.dropped)
  expect(egg).toBeDefined()
  expect(W(f).hasStatus({ e: hen.id }, 'laying')).toBe(true)
  // each food feeds its own amount: hunger rises by its `food`
  for (const type of ['item/food/meat/raw', 'item/food/chicken/raw', 'item/food/egg/raw']) {
    const e = Object.values(W(f).state.entities).find((x) => x.type === type)!
    author(f, () => W(f).place(e, { on: 'inside', holder: 'player' }))
    f.eng.controls.sync()
    f.eng.controls.select(p.slots!.indexOf(f.eng.controls.key(e)))
    p.props!.hunger = 5
    f.eng.act('use', p.id, { e: p.id })
    expect([type, p.props!.hunger]).toEqual([type, 5 + Number(FORM_BY_ID[type].props!.food)])
  }
  // the meadow's ground yields sticks, stones and grass too
  for (const type of FORAGE) expect(lying(f, type, 'meadow').length).toBeGreaterThan(0)
  // and they come back, slowly, never more than the meadow holds
  author(f, () => {
    for (const type of [COW, HEN]) for (const e of onMeadow(f, type)) W(f).destroy(e)
  })
  ticks(f, 1200)
  expect(onMeadow(f, COW).length).toBeLessThanOrEqual(1)
  expect(onMeadow(f, HEN).length).toBeLessThanOrEqual(2)
  ticks(f, 1200 * 6)
  const forage = W(f).map('meadow')!.forage!
  for (const type of [COW, HEN]) {
    expect(onMeadow(f, type).length).toBeGreaterThan(0)
    expect(onMeadow(f, type).length).toBeLessThanOrEqual(forage.find((g) => g.type === type)!.max)
  }
  expect(onMeadow(f, HEN).every((h) => W(f).hasStatus({ e: h.id }, 'laying'))).toBe(true)
})

req('F15', 'south of the meadow, a forest: many trees within reach, and an axe fells them (two swings: a stump, logs and a stick)', [], () => {
  const f = fresh()
  const p = W(f).player
  // the meadow's trail south leads there
  stand(f, SOUTH_GAP[1], W(f).map('meadow')!.height - 2, 'down', 'meadow')
  f.eng.movePlayer('down')
  const here = W(f).posOf(p)!
  expect(here.map).toBe('forest')
  // the woods are thick, and a good many of their trees stand beside ground the player can reach
  const map = W(f).map('forest')!
  const wood = (x: number, y: number) => ['tree', 'pine'].includes(W(f).terrainAt('forest', x, y))
  const seen = new Set<string>()
  const q: [number, number][] = [[here.x, here.y]]
  while (q.length) {
    const [x, y] = q.pop()!
    if (seen.has(`${x},${y}`) || !W(f).walkable('forest', x, y, p.id)) continue
    seen.add(`${x},${y}`)
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  const SIDES = [[1, 0, 'left'], [-1, 0, 'right'], [0, 1, 'up'], [0, -1, 'down']] as const
  const reachable: [number, number, number, number, Entity['facing']][] = []
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      if (!wood(x, y)) continue
      const side = SIDES.find(([dx, dy]) => seen.has(`${x + dx},${y + dy}`))
      if (side) reachable.push([x, y, x + side[0], y + side[1], side[2]])
    }
  expect(reachable.length).toBeGreaterThan(100)
  // the old axe fells one: two swings
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  const [tx, ty, sx, sy, face] = reachable[Math.floor(reachable.length / 2)]
  stand(f, sx, sy, face, 'forest')
  const logs = () => Object.values(W(f).state.entities).filter((e) => e.type === 'item/material/log').length
  const before = logs()
  run(f, 'use', tx, ty)
  run(f, 'use', tx, ty)
  expect(W(f).terrainAt('forest', tx, ty)).toBe('stump')
  expect(logs() - before).toBe(2)
})

req('F9', 'the arrival opens the story: the scene, the loaf in the pack, the objective', ['npc.hesper', 'npc.tobin', 'item/food/bread'], () => {
  const f = fresh({ arrival: true })
  expect(ticks(f, 300, () => W(f).num(W(f).player, 'quest') === 1 && !W(f).state.scene)).toBe(true)
  expect(W(f).player.contents?.some((id) => W(f).get(id)?.type === 'item/food/bread') || W(f).get(W(f).player.held)?.type === 'item/food/bread').toBe(true)
})

// =================================================================== the proof

describe('the Ford is complete', () => {
  for (const r of R) it(`${r.id}: ${r.what}`, r.check)

  it('A: every event kind of the closed tree occurs on this map, and no other', () => {
    // kinds the requirements above need not reach on their own
    if (!KINDS.has('act/craft') || !KINDS.has('act/move')) {
      const f = fresh()
      f.eng.movePlayer('left')
    }
    if (!KINDS.has('impulse/push') || !KINDS.has('bump')) {
      // pressing on into Tobin: he makes way (a push); walking into the cart: a bump
      const f = fresh()
      const t = W(f).posOf(W(f).get('npc.tobin')!)!
      stand(f, t.x, t.y + 1, 'up')
      for (let i = 0; i < 20 && !KINDS.has('impulse/push'); i++) {
        f.eng.movePlayer('up')
        f.eng.tick()
      }
      stand(f, ...STAND.cart, 'left')
      f.eng.movePlayer('left')
    }
    if (!KINDS.has('contact/end') || !KINDS.has('contact/stay')) {
      const f = fresh()
      stand(f, ...STAND.road, 'right')
      f.eng.movePlayer('right')
      ticks(f, 10)
    }
    for (const k of EVENT_KINDS) expect([k, KINDS.has(k)]).toEqual([k, true])
    // the kinds are closed: the engine made nothing outside the tree
    expect([...KINDS].filter((k) => !(EVENT_KINDS as readonly string[]).includes(k))).toEqual([])
  })
})

describe('the event model is complete (design.md §5.13)', () => {
  const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])

  it('the root is total: a rule for every kind, none of whose leaves inherits', () => {
    for (const kind of EVENT_KINDS) {
      const roots = lib.candidates(kind, undefined).filter(isRoot)
      expect([kind, roots.length > 0]).toEqual([kind, true])
      for (const r of roots) expect([r.id, leaves(r.tree).includes('inherit')]).toEqual([r.id, false])
    }
  })

  it('no two base rules tie: no event can reach two rules of equal specificity', () => {
    const rules = [...BASE_RULES, ...STORY_RULES]
    const ties: string[] = []
    for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) if (rulesTie(rules[i], rules[j], onto)) ties.push(`${rules[i].id} ~ ${rules[j].id}`)
    expect(ties).toEqual([])
  })

  it('the base rules write only their host: no effect names another', () => {
    for (const r of [...BASE_RULES, ...STORY_RULES]) for (const l of leaves(r.tree)) if (typeof l === 'object' && 'do' in l) for (const e of l.do) expect([r.id, 'of' in e]).toEqual([r.id, false])
  })

  it('every rule answers a kind of the tree', () => {
    for (const r of [...BASE_RULES, ...STORY_RULES]) expect([r.id, EVENT_KINDS.some((k) => kindCovers(r.on, k))]).toEqual([r.id, true])
  })

  it('state changes only in outcomes: a whole day at the Ford, in strict mode', { timeout: 60_000 }, () => {
    const f = fresh()
    stand(f, ...AT.spawn)
    ticks(f, 24 * TICKS_PER_HOUR)
    expect(W(f).strict).toBe(true)
  })

  it('the relation difference: a thing put in a chest is in it, a thing set down is on the ground', () => {
    const f = fresh()
    stand(f, ...STAND.chest)
    run(f, 'hands', ...AT.chest)
    hold(f, ofType(f, 'item/light/torch'))
    const torch = W(f).player.held!
    f.made.length = 0
    f.eng.controls.transfer('ford.chest', 'bag', torch, true)
    expect(W(f).get(torch)!.place).toEqual({ on: 'inside', holder: 'ford.chest' })
    expect(f.made.some((e) => e.kind === 'contact/begin' && hostIs(e, torch) && e.params?.how === 'in')).toBe(true)
    expect(f.made.some((e) => e.kind === 'contact/begin' && hostIs(e, 'ford.chest') && e.params?.how === 'contains')).toBe(true)
    expect(f.made.some((e) => e.kind === 'contact/end' && hostIs(e, torch) && e.params?.how === 'held')).toBe(true)
    // and one set down on the ground lies on it
    // the loaf from the pack (a stack is held from its first loaf)
    hold(f, W(f).get(W(f).player.contents!.find((id) => W(f).get(id)?.type === 'item/food/bread')))
    const bread = W(f).player.held!
    f.made.length = 0
    stand(f, ...STAND.road, 'right')
    run(f, 'put', STAND.road[0] + 1, STAND.road[1])
    expect(f.made.some((e) => e.kind === 'contact/begin' && hostIs(e, bread) && e.params?.how === 'on')).toBe(true)
  })

  it('playable without an AI: each way across reaches the far bank and never meets an undefined outcome', () => {
    for (const route of [byFerry, byTree, byIce]) {
      const f = fresh({ ai: false })
      route(f)
      expect([route.name, far(f)]).toEqual([route.name, true])
      expect([route.name, records(f).map((r) => r.request.summary)]).toEqual([route.name, []])
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
