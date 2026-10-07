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
  textOf,
  EVENT_KINDS,
  FIRE_RADIUS,
  APPEAR_EVERY,
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
  astar,
  performPlacement,
  regionId,
  madeOf,
  travelToWaypoint,
  PROFESSION_LEVEL,
  CEILING,
  activeBoon,
  boonsOf,
  snapshot,
  type Engine,
  type Entity,
  type GameEvent,
  type Key,
  type Patch,
  type Plan,
  type Ref,
  type World,
} from '@lsw/engine'
import { ALBERIC_ID, BOSS_BY_ID, DRAWINGS, OBJECTIVES, BASE_RULES, CROP_STAGES, NIGHT_CAP, NIGHT_EVERY, TREE_GROWS, FIRSTLIGHT, PROLOGUE_AT_FOOT, PROLOGUE_DONE, TUTORIAL_DONE, TUTORIAL_OPEN, FORM_BY_ID, PLACEMENT_BY_ID, PROFESSION_BY_ID, RECIPE_BY_ID, SKILLS, STORY_RULES, VEGETABLE_CROPS, WILD_W, buildOntology, decodeChunk, wildCell, wildChunk, wildChunkFor } from '@lsw/content'
import { BLOCK, OVERWORLD } from '../src/demo/overworld.ts'
import { AT, FOOTBRIDGE, PASTURE_GAP, SOUTH_GAP, STAND, WEST_GAP, buildFord } from '../src/demo/world.ts'
import { DRAGON_AT, EAST_ROAD, EMBERFALL, PASS } from '../src/demo/quest/maps.ts'
import { GARDEN } from '../src/demo/garden.ts'
import { HOLLOW } from '../src/demo/hollow.ts'
import { PAT, TUTORIAL } from '../src/demo/prologue.ts'

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
  // the Ford's tests begin where the prologue ends: down the mountain, on the Ford (docs/prologue.md)
  author(f, () => ((eng.world.player.props ??= {}).prologue = PROLOGUE_DONE))
  eng.author(() => eng.teleport(eng.world.player, { map: 'ford', x: AT.spawn[0], y: AT.spawn[1] }))
  if (!opts.arrival)
    author(f, () => {
      eng.world.author(() => eng.world.setFact('seen.arrival', true))
      // and the village's welcome (docs/chapter-1.md §6): the chapter's own requirement plays it
      eng.world.author(() => eng.world.setFact('seen.village_arrival', true))
      ;(eng.world.player.props ??= {}).quest = 1
      eng.world.author(() => eng.world.create('item/food/bread', { on: 'inside', holder: 'player' }))
      eng.controls.sync()
    })
  // from here on, only outcomes change the world (and the tests, as its author, in `author`)
  return f
}

const W = (f: Ford) => f.eng.world
/** What the demo's checks call a thing's form: a body that acts, a thing to carry, or what stands there — read from its data. */
const formOf = (w: World, e: Entity) => (w.isPlaceless(e) ? 'resident' : w.isAgent(e) ? 'actor' : w.isPortable(e) ? 'item' : 'fixture')
/** The test sets the scene: an author's hand, not a change the world made. */
const author = <T>(f: Ford, fn: () => T): T => f.eng.author(fn)
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
const run = (f: Ford, key: Key, x: number, y: number, layer = 0): Plan => {
  const plan = f.eng.controls.plan(key, at(x, y), layer)
  if (!plan) throw new Error(`${key} at ${x},${y}: no plan`)
  f.eng.controls.run(plan, true)
  return plan
}
const ticks = (f: Ford, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    if (W(f).scene?.waiting === 'advance') f.eng.story.advance()
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
  // the peddler and his cart are in Firstlight Village now (docs/firstlight-village.md)
  stand(f, ...STAND.tobin, 'up', FIRSTLIGHT.map)
  expect(run(f, 'put', STAND.tobin[0], STAND.tobin[1] - 1).rule).toBe('ford/feed-peddler')
  stand(f, ...STAND.cart, 'left', FIRSTLIGHT.map)
  const wand = ofType(f, 'item/weapon/magic/wand')!
  f.eng.controls.run(f.eng.controls.plan('take', at(...AT.cart), 1)!)
  hold(f, W(f).get(wand.id))
  stand(f, ...STAND.castFrom, 'right')
  // the river is wider than it was: more frost, more steps
  for (let i = 0; i < 18 && !far(f); i++) {
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

req('B2', 'putting is physics, never asked: the axe put on the dead tree is set down at its foot (what one makes of a thing goes by the left click)', ['item/weapon/blade/axe', 'fixture/nature/dead_tree'], () => {
  const f = fresh()
  const axe = ofType(f, 'item/weapon/blade/axe')!
  hold(f, axe)
  stand(f, ...STAND.tree, 'right')
  const plan = f.eng.controls.plan('put', at(...AT.deadTree), 0)!
  expect(plan.target).toEqual({ e: 'ford.dead_tree' })
  expect(plan.unknown).toBeFalsy()
  f.eng.controls.run(plan)
  expect(W(f).get(axe.id)!.place).toMatchObject({ on: 'tile', x: AT.deadTree[0], y: AT.deadTree[1] })
  expect(asked(f, 'impulse/receive', 'player')).toEqual([])
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
  const road = W(f).cellRef('ford', tile.x, tile.y)
  expect(W(f).hasStatus(road, 'oiled')).toBe(true)
  f.events.length = 0
  f.eng.movePlayer('right')
  const touch = f.events.find((e) => e.kind === 'contact/begin' && e.host.e === road.e)
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
  // the cart is in Firstlight Village; the ferrykeeper is visiting, a bystander
  author(f, () => W(f).place(W(f).get('npc.hesper')!, { on: 'tile', map: FIRSTLIGHT.map, x: 29, y: 16 }))
  stand(f, ...STAND.cart, 'left', FIRSTLIGHT.map)
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
  const kinds = new Set<string>(Object.values(W(f).state.entities).filter((e) => e.place.on !== 'none').map((e) => (e.npc ? 'person' : e.ai ? 'creature' : formOf(W(f), e))))
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
  // the cart is in Firstlight Village now
  stand(f, ...STAND.cart, 'left', FIRSTLIGHT.map)
  const layers = f.eng.controls.layers({ map: FIRSTLIGHT.map, ...at(...AT.cart) })
  const kinds = layers.map((r) => (W(f).isTerrain(W(f).get(r.e)!) ? 'ground' : formOf(W(f), W(f).get(r.e)!)))
  expect(kinds).toEqual(['item', 'item', 'fixture', 'ground'])
  hold(f, ofType(f, 'item/food/bread'))
  for (const key of ['hands', 'take', 'use', 'put'] as Key[]) {
    const choices = f.eng.controls.choices(key, at(...AT.cart))
    expect(choices.every((c) => c.plan)).toBe(true)
  }
  // oneself, a person and a creature, from the own tile and beside them
  stand(f, ...STAND.tobin, 'up', FIRSTLIGHT.map)
  expect(f.eng.controls.layers({ map: FIRSTLIGHT.map, x: STAND.tobin[0], y: STAND.tobin[1] }).some((r) => 'e' in r && r.e === 'player')).toBe(true)
  expect(f.eng.controls.plan('hands', at(STAND.tobin[0], STAND.tobin[1] - 1))?.target).toEqual({ e: 'npc.tobin' })
  const slime = W(f).get('ford.fire_slime')!
  author(f, () => W(f).place(slime, { on: 'tile', map: FIRSTLIGHT.map, x: STAND.tobin[0] - 1, y: STAND.tobin[1] }))
  expect(f.eng.controls.plan('use', at(STAND.tobin[0] - 1, STAND.tobin[1]))?.target).toEqual({ e: slime.id })
})

// ------------------------------------------------------------------ F. what a game needs at the least

req('F1', 'the goal is a state: the far bank ends the bridge stage, however the player got there', ['region:far_bank'], () => {
  const f = fresh()
  // set down on the landing, then a step on it: arriving is an outcome (the author's hand makes no contact)
  stand(f, ...AT.farLanding, 'right')
  walk(f, 'right')
  W(f).fx = []
  const cards: unknown[] = []
  expect(
    ticks(f, 400, () => {
      cards.push(...W(f).fx.filter((x) => x.t === 'card'))
      W(f).fx = []
      return W(f).num(W(f).player, 'quest') === 2 && !W(f).scene
    }),
  ).toBe(true)
  expect(far(f)).toBe(true)
  // the chapter goes on past the bridge (docs/chapter-1.md): no card here
  expect(cards.length).toBe(0)
})

req('F1b', 'a story step begins on entering an authored region: the far bank is a thing, entering it is contact (in-region), and its scene starts on the next tick, not at a poll', ['region:far_bank'], () => {
  const f = fresh()
  const bank = W(f).get(regionId('ford', 'far_bank'))!
  expect(bank.type).toBe('region')
  // a tick no poll falls on
  W(f).state.tick += 5 - (W(f).state.tick % 20)
  f.made.length = 0
  author(f, () => f.eng.teleport(W(f).player, { map: 'ford', x: AT.farLanding[0], y: AT.farLanding[1] }))
  const enter = f.made.filter((ev) => ev.kind === 'contact/begin' && ev.params?.how === 'in-region' && hostIs(ev, W(f).state.player))
  // (an event is recorded when offered and again when dispatched)
  expect(new Set(enter.map((ev) => ev.roles.other && 'e' in ev.roles.other && ev.roles.other.e))).toEqual(new Set([bank.id]))
  expect(f.made.some((ev) => ev.kind === 'contact/begin' && ev.params?.how === 'encloses' && hostIs(ev, bank.id))).toBe(true)
  f.eng.tick()
  expect(W(f).scene?.id).toBe('far_bank')
})

req('F2a', 'the ferry:the rope from her chest, the winch mended, and she takes you over', ['item/tool/rope', 'fixture/container/chest', 'fixture/ferry/winch', 'npc.hesper', 'fixture/ferry/raft'], () => {
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
    // time runs on the active map: the peddler is tested at his home in Firstlight Village
    if (who.npc) stand(f, ...STAND.cart, 'left', FIRSTLIGHT.map)
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
  expect(f.eng.controls.choices('use', point).map((c) => c.plan?.target)).toEqual([{ e: stump.id }, W(f).cellRef('ford', x, y)])
  // the blow is the axe's; the stump has durability and breaks into what it is made of (world-model.md §6.3)
  expect(plan.unknown).toBeFalsy()
  f.eng.controls.run(plan, true)
  expect(W(f).get(stump.id)).toBeUndefined()
  expect(W(f).placedAt('ford', x, y).some((e) => e.type === 'item/material/log')).toBe(true)
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

req('F8', 'legible: before a press, every input that reaches shows what it will do (taking what cannot be taken is no option), and the unknown is marked', ['fixture/ferry/raft', 'fixture/ferry/winch'], () => {
  const f = fresh()
  hold(f, ofType(f, 'item/food/bread'))
  stand(f, ...STAND.raft, 'right')
  for (const key of ['hands', 'put', 'use'] as Key[]) expect(f.eng.controls.plan(key, at(...AT.raft))?.label).toBeDefined()
  expect(f.eng.controls.plan('take', at(...AT.raft))?.target).not.toEqual({ e: 'ford.raft' })
  expect(textOf(f.eng.controls.plan('self')?.label)).toBe('Eat Bread')
  expect(f.eng.controls.plan('hands', at(...AT.raft))?.unknown).toBe(true)
  stand(f, ...STAND.winch)
  expect(f.eng.controls.plan('use', at(...AT.winch))?.unknown).toBe(true)
  expect(SLOT_COUNT).toBe(30)
})

const FORAGE = ['item/material/stick', 'item/material/stone', 'item/material/grass']
const lying = (f: Ford, type: string, map = 'ford') => Object.values(W(f).state.entities).filter((e) => e.type === type && e.place.on === 'tile' && e.place.map === map)
/** An open tile beside (x, y), and the way to face from it. */
function beside(f: Ford, x: number, y: number, map = 'ford'): [number, number, Entity['facing']] {
  for (const [dx, dy, dir] of [[-1, 0, 'right'], [1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']] as const)
    if (W(f).walkable(map, x + dx, y + dy)) return [x + dx, y + dy, dir]
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
  const axe = RECIPE_BY_ID['item/weapon/blade/axe']
  const pick = RECIPE_BY_ID['item/tool/pickaxe']
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
  // the stone pickaxe breaks a boulder in two blows (its durability), into stones (its makeup)
  hold(f, made('item/tool/pickaxe'))
  const boulder = ofType(f, 'fixture/nature/boulder')!
  const bp = W(f).posOf(boulder)!
  const [sx, sy, dir] = beside(f, bp.x, bp.y)
  stand(f, sx, sy, dir)
  const stones = lying(f, 'item/material/stone').length
  for (let i = 0; i < 2; i++) run(f, 'use', bp.x, bp.y)
  expect(W(f).get(boulder.id)).toBeUndefined()
  expect(lying(f, 'item/material/stone').length).toBeGreaterThan(stones)
  // and the ground yields again over time, never more than a handful of each
  author(f, () => {
    for (const type of FORAGE) for (const e of lying(f, type)) W(f).destroy(e)
  })
  ticks(f, APPEAR_EVERY * 40)
  const appear = W(f).map('ford')!.appear!
  for (const type of FORAGE) {
    expect(lying(f, type).length).toBeGreaterThan(0)
    expect(lying(f, type).length).toBeLessThanOrEqual(appear.find((g) => type in g.types)!.max)
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
const onMeadow = (f: Ford, type: string) => Object.values(W(f).state.entities).filter((e) => e.type === type && e.place.on === 'tile' && e.place.map === 'pasture')

req('F14', 'west of the Ford the village, and south of it the grassland (Minecraft): cows and hens that run when struck and come back slowly; meat from both, eggs from hens; each food feeds its own amount', [COW, HEN], () => {
  const f = fresh()
  const p = W(f).player
  // the road's gap in the western woods leads to the village, its trail south to the grassland
  stand(f, 1, WEST_GAP[1], 'left')
  f.eng.movePlayer('left')
  expect(W(f).posOf(p)?.map).toBe('meadow')
  // the village itself keeps no herd
  for (const type of [COW, HEN]) expect(Object.values(W(f).state.entities).filter((e) => e.type === type && e.place.on === 'tile' && e.place.map === 'meadow')).toEqual([])
  stand(f, SOUTH_GAP[1], W(f).map('meadow')!.height - 2, 'down', 'meadow')
  ticks(f, 3)
  f.eng.movePlayer('down')
  expect(W(f).posOf(p)?.map).toBe('pasture')
  expect(onMeadow(f, COW).length).toBeGreaterThan(0)
  expect(onMeadow(f, HEN).length).toBeGreaterThan(0)
  const here = W(f).posOf(p)!
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  // a struck cow runs from whoever struck it, and never strikes back
  const cow = onMeadow(f, COW)[0]
  author(f, () => {
    W(f).place(cow, { on: 'tile', map: 'pasture', x: here.x - 1, y: here.y })
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
    stand(f, here.x, here.y, face, 'pasture')
    author(f, () => {
      W(f).place(a, { on: 'tile', map: 'pasture', x: ax, y: ay })
      a.props = { ...(a.props ?? {}), hp: 1 }
    })
    f.eng.setCooldown('atk:player', 0)
    run(f, 'use', ax, ay)
    expect(W(f).get(a.id)).toBeUndefined()
    expect(meat(food) - before).toBe(n)
    // what a creature leaves lies where it fell: no magnet, taken with F
    ticks(f, 10)
    const there = W(f).entitiesAt('pasture', ax, ay).filter((e) => e.type === food)
    expect(there.length).toBe(n)
    expect(there.every((e) => !e.dropped)).toBe(true)
    const carried = f.eng.controls.count(food)
    run(f, 'take', ax, ay)
    expect(f.eng.controls.count(food)).toBe(carried + 1)
  }
  // a hen lays an egg where she stands, and starts on the next
  const hen = onMeadow(f, HEN)[0]
  const eggs = meat('item/food/egg/raw')
  author(f, () => W(f).setStatus({ e: hen.id }, 'stage', W(f).state.tick + 1))
  ticks(f, 3)
  expect(meat('item/food/egg/raw')).toBe(eggs + 1)
  const egg = lying(f, 'item/food/egg/raw', 'pasture').find((e) => !e.dropped)
  expect(egg).toBeDefined()
  expect(W(f).hasStatus({ e: hen.id }, 'stage')).toBe(true)
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
  for (const type of FORAGE) expect(lying(f, type, 'pasture').length).toBeGreaterThan(0)
  // and they come back, slowly, never more than the meadow holds
  author(f, () => {
    for (const type of [COW, HEN]) for (const e of onMeadow(f, type)) W(f).destroy(e)
  })
  ticks(f, 1200)
  expect(onMeadow(f, COW).length).toBeLessThanOrEqual(1)
  expect(onMeadow(f, HEN).length).toBeLessThanOrEqual(2)
  ticks(f, 1200 * 6)
  const appear = W(f).map('pasture')!.appear!
  for (const type of [COW, HEN]) {
    expect(onMeadow(f, type).length).toBeGreaterThan(0)
    expect(onMeadow(f, type).length).toBeLessThanOrEqual(appear.find((g) => type in g.types)!.max)
  }
  // a hen comes laying: her stage's clock runs from when she appears
  expect(onMeadow(f, HEN).every((h) => W(f).hasStatus({ e: h.id }, 'stage'))).toBe(true)
})

req('F15', 'south of the grassland, a forest: many trees within reach, and an axe fells them (two swings: a stump, logs and a stick)', [], () => {
  const f = fresh()
  const p = W(f).player
  // the grassland's trail south leads there
  stand(f, PASTURE_GAP[1], W(f).map('pasture')!.height - 2, 'down', 'pasture')
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

req('F9', 'the arrival opens the story: the scene, the loaf in the pack, and Hesper sends you to the village first (its rescue opens the bridge chapter, docs/quests.md)', ['npc.hesper', 'item/food/bread'], () => {
  const f = fresh({ arrival: true })
  expect(ticks(f, 300, () => W(f).fact('village.sent') === 1 && !W(f).scene)).toBe(true)
  expect(W(f).num(W(f).player, 'quest')).toBe(0)
  expect(W(f).player.contents?.some((id) => W(f).get(id)?.type === 'item/food/bread') || W(f).get(W(f).player.held)?.type === 'item/food/bread').toBe(true)
})

// =================================================================== the proof

// ------------------------------------------------------------------ W. the world model: breaking (world-model.md §10.3)

/** A thing made the way a recipe makes it, in the player's bag (the test's own hand). */
function made(f: Ford, recipe: string, material = 'stone'): Entity {
  const make = madeOf(W(f).onto.data, W(f).onto, RECIPE_BY_ID[recipe].make.type, material)
  const e = author(f, () => W(f).add({ id: `given.${recipe}`, ...make, place: { on: 'inside', holder: 'player' } }))
  f.eng.controls.sync()
  return e
}
/** A cell of `terrain` on a map with open ground beside it. */
function cellOf(f: Ford, map: string, terrain: string): [number, number] {
  const m = W(f).map(map)!
  for (let y = 1; y < m.height - 1; y++)
    for (let x = 1; x < m.width - 1; x++)
      if (W(f).terrainAt(map, x, y) === terrain && [[-1, 0], [1, 0], [0, 1], [0, -1]].some(([dx, dy]) => W(f).walkable(map, x + dx, y + dy))) return [x, y]
  throw new Error(`no ${terrain} on ${map}`)
}

req('W1', 'a stone axe fells a tree in two blows (its durability, as an axe works on wood): it becomes a stump and drops logs', [], () => {
  const f = fresh()
  hold(f, made(f, 'item/weapon/blade/axe'))
  const [x, y] = cellOf(f, 'ford', 'tree')
  const [sx, sy, d] = beside(f, x, y)
  stand(f, sx, sy, d)
  const tree = W(f).cellTop('ford', x, y)!
  run(f, 'use', x, y)
  expect(W(f).num(tree, 'hp')).toBeLessThan(W(f).num(tree, 'maxHp'))
  expect(W(f).terrainAt('ford', x, y)).toBe('tree')
  run(f, 'use', x, y)
  expect(W(f).terrainAt('ford', x, y)).toBe('stump')
  expect(W(f).placedAt('ford', x, y).filter((e) => e.type === 'item/material/log').length).toBeGreaterThanOrEqual(2)
  expect(records(f)).toHaveLength(0)
})

req('W2', 'a wooden club on rock: too hard — the rock is untouched, it is said, and nothing is asked', [], () => {
  const f = fresh()
  const club = author(f, () => W(f).create('item/weapon/blunt/club', { on: 'inside', holder: 'player' }, { tags: ['material:wood', 'wooden', 'flammable'] }))
  f.eng.controls.sync()
  hold(f, club)
  const [x, y] = cellOf(f, 'hollow', 'rock')
  const [sx, sy, d] = beside(f, x, y, 'hollow')
  stand(f, sx, sy, d, 'hollow')
  const rock = W(f).cellTop('hollow', x, y)!
  W(f).fx = []
  const plan = run(f, 'use', x, y)
  expect(plan.unknown).toBeFalsy()
  expect(W(f).num(rock, 'hp')).toBe(W(f).num(rock, 'maxHp'))
  expect(W(f).fx.some((x) => x.t === 'log' && (x.text as { en: string }).en === 'Too hard.')).toBe(true)
  expect(records(f)).toHaveLength(0)
})

req('W3', 'a stone pickaxe breaks rock in two blows and gives back stone (its makeup, at the recovery rate); the ground under it shows', [], () => {
  const f = fresh()
  hold(f, made(f, 'item/tool/pickaxe'))
  const [x, y] = cellOf(f, 'hollow', 'rock')
  const [sx, sy, d] = beside(f, x, y, 'hollow')
  stand(f, sx, sy, d, 'hollow')
  run(f, 'use', x, y)
  expect(W(f).terrainAt('hollow', x, y)).toBe('rock')
  run(f, 'use', x, y)
  expect(W(f).terrainAt('hollow', x, y)).not.toBe('rock')
  expect(W(f).walkable('hollow', x, y)).toBe(true)
  expect(W(f).placedAt('hollow', x, y).some((e) => e.type === 'item/material/stone')).toBe(true)
  expect(records(f)).toHaveLength(0)
})

/** One step the player's own way (an act of moving), and the time it takes. */
function walk(f: Ford, dir: Entity['facing']): { map: string; x: number; y: number } {
  f.eng.movePlayer(dir!)
  ticks(f, 8)
  return W(f).posOf(W(f).player)!
}

req('W8', "height: the high ground at the mountain's foot stands two levels above the land below its face of rock; down the ramp and back up unharmed; off the edge a drop of two levels hurts, and the face cannot be climbed", [], () => {
  const f = fresh()
  // the ramp where the trail comes down: each row half a level lower
  const [rx, ry] = PAT.ramp
  expect([0, 1, 2, 3, 4].map((d) => W(f).heightAt('foot', rx, ry + d))).toEqual([4, 3, 2, 1, 0])
  stand(f, rx, ry, 'down', 'foot')
  const hp = W(f).num(W(f).player, 'hp')
  for (let i = 0; i < 4; i++) walk(f, 'down')
  expect(W(f).posOf(W(f).player)).toMatchObject({ x: rx, y: ry + 4 })
  for (let i = 0; i < 4; i++) walk(f, 'up')
  expect(W(f).posOf(W(f).player)).toMatchObject({ x: rx, y: ry })
  expect(W(f).num(W(f).player, 'hp')).toBe(hp)
  // the face beside it, opened (as a pickaxe would): stepping off is a fall of two levels
  const x = rx + 3
  author(f, () => W(f).destroy(W(f).cellTop('foot', x, ry + 2)!))
  stand(f, x, ry + 2, 'down', 'foot')
  expect(walk(f, 'down')).toMatchObject({ x, y: ry + 3 })
  expect(W(f).num(W(f).player, 'hp')).toBeLessThan(hp)
  // and it cannot be climbed back
  expect(walk(f, 'up')).toMatchObject({ x, y: ry + 3 })
})

/** Make the map a wait for is (a wilderness is made from the world's seed and its cell, as the client does). */
function arrive(f: Ford): void {
  const to = f.eng.pendingTransition?.map
  if (!to) return
  const made = wildChunkFor(W(f), to)
  if (!made) throw new Error(`no map ${to}`)
  f.game.loadChunk(made)
}
/** Into the place the player stands on (E on its site, world-model.md §5.6). */
function goIn(f: Ford): void {
  const p = W(f).posOf(W(f).player)!
  const site = W(f).coveringAt(p.map, p.x, p.y).concat(W(f).entitiesAt(p.map, p.x, p.y)).find((e) => e.type.startsWith('site'))!
  f.eng.act('hands', 'player', { e: site.id }, { instrument: null })
  arrive(f)
}
/** The overworld tiles one can walk to from a tile (over its open ground). */
function reach(f: Ford, x: number, y: number): Set<string> {
  const seen = new Set([`${x},${y}`])
  const queue: [number, number][] = [[x, y]]
  while (queue.length) {
    const [cx, cy] = queue.pop()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${cx + dx},${cy + dy}`
      if (seen.has(k) || !W(f).passable(OVERWORLD, cx + dx, cy + dy)) continue
      seen.add(k)
      queue.push([cx + dx, cy + dy])
    }
  }
  return seen
}

req('W4', 'every map but the tutorial lies on the overworld, and its edges are open: mined through the rock at the pass\'s north edge, one walks out onto its cell there', ['site/place'], () => {
  const f = fresh()
  for (const m of W(f).state.loadedMaps.filter((id) => id !== OVERWORLD && id !== 'tutorial' && id !== 'offstage')) {
    const site = W(f).map(m)!.site!
    expect([m, site.map]).toEqual([m, OVERWORLD])
    expect([m, W(f).entitiesAt(OVERWORLD, site.x + 1, site.y + BLOCK - 1).some((e) => e.type === 'site/place' && e.props?.map === m)]).toEqual([m, true])
  }
  // the pass's north rim: two rows of rock above open ground
  const x = [...Array(26).keys()].map((i) => i + 2).find((x) => W(f).terrainAt('pass', x, 0) === 'rock' && W(f).terrainAt('pass', x, 1) === 'rock' && W(f).walkable('pass', x, 2))!
  hold(f, made(f, 'item/tool/pickaxe'))
  stand(f, x, 2, 'up', 'pass')
  for (let i = 0; i < 2; i++) run(f, 'use', x, 1)
  expect(walk(f, 'up')).toMatchObject({ map: 'pass', x, y: 1 })
  for (let i = 0; i < 2; i++) run(f, 'use', x, 0)
  expect(walk(f, 'up')).toMatchObject({ map: 'pass', x, y: 0 })
  const out = walk(f, 'up')
  expect(out.map).toBe(OVERWORLD)
  const site = W(f).map('pass')!.site!
  expect(out.x - site.x).toBeGreaterThanOrEqual(0)
  expect(out.x - site.x).toBeLessThan(BLOCK)
  // the north row of its block: the side it left by
  expect(out.y).toBe(site.y)
  // and E on its place there takes one back in, on that side
  goIn(f)
  expect(W(f).posOf(W(f).player)!.map).toBe('pass')
  expect(W(f).posOf(W(f).player)!.y).toBeLessThan(W(f).map('pass')!.height / 4)
})

req('W5', 'an overworld step passes its time at once (half an hour on plains, by its ground), and hunger falls; harm stops it', [], () => {
  const f = fresh()
  const ford = W(f).map('ford')!.site!
  // west of the river, on the meadow's cell
  stand(f, ford.x - 2, ford.y + 1, 'left', OVERWORLD)
  const t0 = W(f).state.tick
  const hunger = W(f).num(W(f).player, 'hunger')
  walk(f, 'left')
  const took = W(f).state.tick - t0
  const cost = W(f).num(W(f).cellTop(OVERWORLD, ford.x - 3, ford.y + 1)!, 'cost', 1)
  expect(took).toBeGreaterThanOrEqual(30 * cost * TICKS_PER_HOUR / 60)
  expect(W(f).num(W(f).player, 'hunger')).toBeLessThan(hunger)
  // burning, one is hurt on the way: the step's time stops passing
  author(f, () => f.eng.applyStatus({ e: W(f).player.id }, 'burning', 600))
  const t1 = W(f).state.tick
  walk(f, 'left')
  expect(W(f).state.tick - t1).toBeLessThan(took)
})

req('W6', 'the river is a barrier on the overworld too: from the west bank no way leads to the far bank but the Ford; one comes into the Ford from the east on the far bank', ['region:far_bank'], () => {
  const f = fresh()
  const ford = W(f).map('ford')!.site!
  const west = reach(f, ford.x, ford.y + 1)
  const east = [ford.x + BLOCK - 1, ford.y + 1] as const
  expect(W(f).passable(OVERWORLD, ...east)).toBe(true)
  expect(west.has(`${east[0]},${east[1]}`)).toBe(false)
  const road = W(f).map('eastroad')!.site!
  expect(west.has(`${road.x + 1},${road.y + 1}`)).toBe(false)
  // from the east road's cell, west into the Ford's: the far bank
  stand(f, road.x, road.y + 1, 'left', OVERWORLD)
  expect(walk(f, 'left')).toMatchObject({ map: OVERWORLD, x: east[0] })
  goIn(f)
  expect(W(f).within(W(f).player, regionId('ford', 'far_bank'))).toBe(true)
})

req('W7', 'a wilderness is made from the world\'s seed and its cell: entered, left and entered again — or saved and loaded — it is the same map, with what one changed kept', ['site/wild'], () => {
  const f = fresh()
  const site = Object.values(W(f).state.entities).find((e) => e.type === 'site/wild' && e.props?.ground === 'ow_plain')!
  const at = site.place as { x: number; y: number }
  stand(f, at.x, at.y - 1, 'up', OVERWORLD)
  goIn(f)
  const id = String(site.props!.map)
  expect(W(f).posOf(W(f).player)!.map).toBe(id)
  const terrain = [...W(f).map(id)!.terrain]
  // the same seed and cell give the same map
  const again = wildChunk(W(f).state.seed, wildCell(id)!.cx, wildCell(id)!.cy, 'ow_plain', W(f).map(id)!.site)
  expect(again.map.terrain).toEqual(terrain)
  // change it: a tree gone, a stone set down
  const t = terrain.findIndex((x) => x === 'tree')
  const [tx, ty] = [t % WILD_W, Math.floor(t / WILD_W)]
  author(f, () => W(f).destroy(W(f).cellTop(id, tx, ty)!))
  author(f, () => W(f).create('item/material/stone', { on: 'tile', map: id, x: tx, y: ty }, { id: 'w7.stone' }))
  // out by its west edge, and in again
  const p = W(f).posOf(W(f).player)!
  stand(f, 0, p.y, 'left', id)
  expect(walk(f, 'left').map).toBe(OVERWORLD)
  goIn(f)
  expect(W(f).posOf(W(f).player)!.map).toBe(id)
  expect(W(f).terrainAt(id, tx, ty)).not.toBe('tree')
  expect(W(f).get('w7.stone')?.place).toMatchObject({ map: id, x: tx, y: ty })
  // saved and loaded: the map is made again, the changes come from the save
  const loaded = Game.load(structuredClone(f.game.save()), buildFord().index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  loaded.loadMapData(wildChunkFor(loaded.engine.world, id)!.map)
  expect(loaded.engine.world.terrainAt(id, tx, ty)).not.toBe('tree')
  expect(loaded.engine.world.get('w7.stone')).toBeDefined()
})

req('W9', 'a recipe derived from what a thing is made of, made at the village workbench: it takes its main ingredient\'s material, and a quality by its maker\'s level; away from a workbench it is not made', ['fixture/craft/workbench'], () => {
  const f = fresh()
  const c = f.eng.controls
  const recipe = RECIPE_BY_ID['item/armor/shield']
  expect(recipe).toMatchObject({ station: 'workbench', needs: [{ type: 'item/material/plank', count: 3 }, { type: 'item/material/stick', count: 1 }] })
  const supply = () =>
    author(f, () => {
      for (let i = 0; i < 3; i++) W(f).create('item/material/plank', { on: 'inside', holder: 'player' })
      W(f).create('item/material/stick', { on: 'inside', holder: 'player' })
    })
  const shields = () => (W(f).player.contents ?? []).map((id) => W(f).get(id)!).filter((e) => e.type === 'item/armor/shield')
  supply()
  c.sync()
  // on the Ford, no workbench at hand: nothing is made, nothing used up
  c.craft(recipe)
  expect(shields()).toHaveLength(0)
  expect(c.count('item/material/plank')).toBe(3)
  // beside the village's
  stand(f, 11, 19, 'up', FIRSTLIGHT.map)
  expect(c.craft(recipe)).toBe(true)
  const plain = shields()[0]
  expect(plain.name).toEqual({ en: 'Wooden Shield', zh: '木盾牌' })
  expect(W(f).materialOf(plain)?.id).toBe('wood')
  // a maker well above the recipe's level makes it finer
  author(f, () => W(f).setProp(W(f).player, 'level', 4))
  supply()
  c.sync()
  expect(c.craft(recipe)).toBe(true)
  const fine = shields().find((e) => e.id !== plain.id)!
  expect(fine.name).toEqual({ en: 'Fine Wooden Shield', zh: '精良木盾牌' })
  expect(W(f).hasTag(fine, 'quality:fine')).toBe(true)
  expect(records(f)).toHaveLength(0)
})

/** A room of one cell on the Ford, built: four walls round it and a floor laid over it (the roof). Returns the cell. */
function buildRoom(f: Ford): [number, number] {
  let at: [number, number] | undefined
  for (let y = 4; y < 26 && !at; y++) for (let x = 4; x < 40 && !at; x++) if ([-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => W(f).walkable('ford', x + dx, y + dy) && !W(f).placedAt('ford', x + dx, y + dy).length && W(f).heightAt('ford', x + dx, y + dy) === 0))) at = [x, y]
  const [x, y] = at!
  const put = (type: string, cx: number, cy: number, ceiling = false) => {
    const thing = author(f, () => W(f).add({ ...madeOf(W(f).onto.data, W(f).onto, type, 'wood'), id: `room.${type}.${cx}.${cy}`, place: { on: 'inside', holder: 'player' } }))
    // in the ceiling: the open air a storey up (docs/building.md)
    const target = ceiling ? W(f).get(W(f).cellRef('ford', cx, cy, 1).e)! : W(f).placedAt('ford', cx, cy).find((e) => e.type.startsWith('structure')) ?? W(f).cellTop('ford', cx, cy)!
    f.eng.act('put', 'player', { e: target.id }, { instrument: { e: thing.id } })
  }
  stand(f, x, y, 'up')
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put('structure/wall', x + dx, y + dy)
  put('structure/floor', x, y, true)
  return [x, y]
}

req('W10', 'a room: a cell walled all round and covered (a floor laid over it) is a room; a bed in it makes it a bedroom; a night there gives everything back', [], () => {
  const f = fresh()
  const [x, y] = buildRoom(f)
  expect(W(f).covered('ford', x, y)).toBe(true)
  const room = () => W(f).regionsAt('ford', x, y).find((r) => r.type === 'region/room')
  expect(room()).toBeDefined()
  expect(room()!.props?.size).toBe(1)
  expect(W(f).hasTag(room()!, 'role:bedroom')).toBe(false)
  const bed = author(f, () => W(f).create('fixture/furniture/bed', { on: 'tile', map: 'ford', x, y }))
  expect(W(f).hasTag(room()!, 'role:bedroom')).toBe(true)
  // hurt (and fed: a starving sleeper wakes), one lies down there: by morning, whole again
  author(f, () => { W(f).setProp(W(f).player, 'hp', 10); W(f).setProp(W(f).player, 'hunger', W(f).num(W(f).player, 'maxHunger')) })
  setHour(f, 1, 22)
  f.eng.act('hands', 'player', { e: bed.id }, { instrument: null })
  f.eng.tick()
  expect(W(f).num(W(f).player, 'hp')).toBe(W(f).num(W(f).player, 'maxHp'))
  expect(Math.floor(W(f).hour()) % 24).toBe(6)
  // a room is a thing one can name (found, not kept); a wall taken away, it is no room at all
  expect(W(f).get(room()!.id)).toMatchObject({ type: 'region/room' })
  author(f, () => W(f).destroy(W(f).placedAt('ford', x + 1, y).find((e) => e.type === 'structure/wall')!))
  expect(room()).toBeUndefined()
  expect(W(f).covered('ford', x, y)).toBe(true)
})

req('W11', 'rain falls only on what is out under the sky: in the room one stays dry; outside, one is soaked', [], () => {
  const f = fresh()
  const [x, y] = buildRoom(f)
  const hen = author(f, () => W(f).create('actor/creature/animal/chicken', { on: 'tile', map: 'ford', x: x + 3, y }))
  // the evening's rain (day 1, after the storm)
  setHour(f, 1, 21)
  expect(W(f).calendar().weather).toBe('rain')
  ticks(f, 130, () => W(f).hasStatus({ e: hen.id }, 'wet'))
  expect(W(f).hasStatus({ e: hen.id }, 'wet')).toBe(true)
  expect(W(f).hasStatus({ e: W(f).player.id }, 'wet')).toBe(false)
})

req('W16', 'stages: a watered sprout out under the sky grows a stage, one in a room waits for light; a felled tree\'s stump grows back into a tree, but not up through someone standing on it', [], () => {
  const f = fresh()
  const [x, y] = buildRoom(f)
  // an open cell outside, a few steps off
  let out: [number, number] | undefined
  for (let d = 3; d < 12 && !out; d++) for (const [ox, oy] of [[x + d, y], [x - d, y], [x, y + d], [x, y - d]]) if (!out && W(f).walkable('ford', ox, oy) && !W(f).placedAt('ford', ox, oy).length && !W(f).covered('ford', ox, oy)) out = [ox, oy]
  const sprout = (cx: number, cy: number) => author(f, () => W(f).create('fixture/crop/carrot/sprout', { on: 'tile', map: 'ford', x: cx, y: cy }))
  const inside = sprout(x, y)
  const outside = sprout(...out!)
  // nothing starts a crop's stage but water: unwatered, it stays
  expect(W(f).hasStatus({ e: outside.id }, 'stage')).toBe(false)
  for (const s of [inside, outside]) author(f, () => W(f).setStatus({ e: s.id }, 'watered', W(f).state.tick + 2))
  ticks(f, 5)
  expect(W(f).get(outside.id)?.type).toBe('fixture/crop/carrot/young')
  expect(W(f).get(inside.id)?.type).toBe('fixture/crop/carrot/sprout')
  // in the dark it waits, and looks again
  expect(W(f).hasStatus({ e: inside.id }, 'watered')).toBe(true)
  // a tree felled: its stump grows back on its own clock (two game days)
  const map = W(f).map('ford')!
  const i = map.terrain.findIndex((t, k) => t === 'tree' && !W(f).placedAt('ford', k % map.width, Math.floor(k / map.width)).length)
  const [tx, ty] = [i % map.width, Math.floor(i / map.width)]
  const tree = W(f).get(W(f).cellRef('ford', tx, ty).e)!
  author(f, () => W(f).transform(tree, 'tile/stump'))
  const stump = W(f).occupant('ford', tx, ty, 'soil') ?? W(f).get(tree.id)!
  expect(stump.type).toBe('tile/stump')
  expect(W(f).statusesOf({ e: stump.id })?.stage).toBe(W(f).state.tick + TREE_GROWS)
  // someone standing on it: it waits
  stand(f, tx, ty, 'down')
  author(f, () => W(f).setStatus({ e: stump.id }, 'stage', W(f).state.tick + 1))
  ticks(f, 3)
  expect(W(f).terrainAt('ford', tx, ty)).toBe('stump')
  expect(W(f).hasStatus({ e: stump.id }, 'stage')).toBe(true)
  // gone, it grows
  stand(f, ...out!, 'down')
  author(f, () => W(f).setStatus({ e: stump.id }, 'stage', W(f).state.tick + 1))
  ticks(f, 3)
  expect(W(f).terrainAt('ford', tx, ty)).toBe('tree')
})

req('W17', 'combat by what things are made of: iron strikes harder than wood, fine harder than crude; a helmet put on oneself takes a share off every blow (one to a slot; put on again, it comes off); what resists an element takes its share of that harm away, all of it at full', [], () => {
  const f = fresh()
  const w = W(f)
  const made = (type: string, material?: string, quality?: string) => madeOf(w.onto.data, w.onto, type, material, quality)
  // the form's power times the material's factor and the quality's (Elin)
  expect(made('item/weapon/blade/sword', 'wood').props?.power).toBe(3)
  expect(made('item/weapon/blade/sword', 'iron').props?.power).toBe(6)
  expect(made('item/weapon/blade/sword', 'iron', 'crude').props?.power).toBe(5)
  expect(made('item/weapon/blade/sword', 'iron', 'fine').props?.power).toBe(8)
  expect(made('item/armor/helmet', 'iron').props?.def).toBe(2)
  expect(made('item/armor/breastplate', 'leather').props?.def).toBe(3)
  // a blow on the player: as hard as it is, less its defence
  const p = w.player
  const blow = (n: number, element?: string, pierce = false) => {
    author(f, () => w.setProp(p, 'hp', 40))
    author(f, () => f.eng.hurt(p, n, element, pierce))
    return 40 - w.num(p, 'hp')
  }
  expect(blow(6)).toBe(6)
  // put on oneself (right click on one's own place): worn
  const helmet = author(f, () => w.add({ ...made('item/armor/helmet', 'iron'), id: 'w17.helmet', place: { on: 'inside', holder: 'player' } }))
  stand(f, 20, 14, 'up')
  hold(f, helmet)
  expect(run(f, 'self', 20, 14).rule).toBe('body/wear')
  expect(w.prop(p, 'wear:head')).toBe(helmet.id)
  expect(w.stat(p, 'def')).toBe(2)
  expect(blow(6)).toBe(4)
  // a hat on the same head: the helmet comes off
  const hat = author(f, () => w.add({ ...made('item/clothing/hat', 'cloth'), id: 'w17.hat', place: { on: 'inside', holder: 'player' } }))
  hold(f, hat)
  run(f, 'self', 20, 14)
  expect(w.prop(p, 'wear:head')).toBe(hat.id)
  expect(w.stat(p, 'def')).toBe(0)
  // the helmet again, and again: on, then off
  hold(f, helmet)
  run(f, 'self', 20, 14)
  expect(w.prop(p, 'wear:head')).toBe(helmet.id)
  run(f, 'self', 20, 14)
  expect(w.prop(p, 'wear:head')).toBeUndefined()
  // what is no longer one's own is not worn
  run(f, 'self', 20, 14)
  author(f, () => w.place(w.get(helmet.id)!, { on: 'tile', map: 'ford', x: 21, y: 14 }))
  expect(w.stat(p, 'def')).toBe(0)
  // resistances: the herbalist's draught takes three quarters of fire's harm; a cloak that resists fire, the rest
  expect(blow(8, 'fire', true)).toBe(8)
  author(f, () => f.eng.applyStatus({ e: p.id }, 'fireproof'))
  expect(blow(8, 'fire', true)).toBe(2)
  expect(blow(8, 'ice', true)).toBe(8)
  const cloak = author(f, () => w.add({ ...made('item/clothing/cloak', 'leather'), id: 'w17.cloak', props: { slot: 'back', resFire: 25 }, place: { on: 'inside', holder: 'player' } }))
  hold(f, cloak)
  run(f, 'self', 20, 14)
  expect(w.stat(p, 'resFire')).toBe(100)
  expect(blow(8, 'fire', true)).toBe(0)
})

req('W14', 'real work, and walking in: mornings the woodcutter fells trees in the forest with his axe and gathers the logs; at noon he comes into the village by its south edge and stacks them on the wood pile', ['fixture/container/woodpile', 'npc.gus'], () => {
  const f = fresh()
  const w = W(f)
  const gus = () => w.get('npc.gus')!
  const logs = (e: Entity) => [...(e.held ? [e.held] : []), ...(e.contents ?? [])].filter((id) => w.get(id)?.type === 'item/material/log').length
  const [cx, cy] = [23, 7]
  const trees = () => { let n = 0; for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) if (w.terrainAt('forest', x, y) === 'tree') n++; return n }
  // he carries his own axe; felling is a woodcutter's skill
  expect(gus().contents?.some((id) => w.get(id)?.type === 'item/weapon/blade/axe')).toBe(true)
  // a morning: the player comes down the grassland's trail into the forest, and he is at work there
  setHour(f, 2, 7)
  stand(f, PASTURE_GAP[1], w.map('pasture')!.height - 2, 'down', 'pasture')
  f.eng.movePlayer('down')
  expect(w.posOf(w.player)!.map).toBe('forest')
  expect(w.posOf(gus())!.map).toBe('forest')
  const before = trees()
  ticks(f, 1500, () => logs(gus()) >= 3)
  // a tree felled with his own swings (a stump where it stood, growing back), its logs gathered
  expect(trees()).toBeLessThan(before)
  expect(logs(gus())).toBeGreaterThanOrEqual(3)
  // noon: the player is in the village; on the hour he comes in by its south edge (the way from the forest)
  author(f, () => f.eng.teleport(w.player, { map: 'meadow', x: 20, y: 14 }))
  setHour(f, 2, 11.99)
  ticks(f, 30, () => w.posOf(gus())!.map === 'meadow')
  const came = w.posOf(gus())!
  expect(came.map).toBe('meadow')
  expect(came.y).toBeGreaterThanOrEqual(w.map('meadow')!.height - 4)
  // and walks to the wood pile and stacks the logs on it, where anyone may take them
  const pile = () => w.get('village.woodpile')!
  ticks(f, 3000, () => (pile().contents ?? []).length >= 3)
  expect((pile().contents ?? []).filter((id) => w.get(id)?.type === 'item/material/log').length).toBeGreaterThanOrEqual(3)
})

req('W18', 'the overworld is what it shows: every cell of it one can stand on is a place, entered by standing on it and pressing E, whichever way one faces; the place says its name ("Enter …") and is outlined whole', [], () => {
  const f = fresh()
  const w = W(f)
  const m = w.map('overworld')!
  let tiles = 0
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      if (!w.walkable('overworld', x, y)) continue
      const site = [...w.entitiesAt('overworld', x, y), ...w.coveringAt('overworld', x, y)].find((e) => e.type.startsWith('site'))
      expect([x, y, !!site]).toEqual([x, y, true])
      author(f, () => w.place(w.player, { on: 'tile', map: 'overworld', x, y }))
      for (const facing of ['up', 'down', 'left', 'right'] as const) {
        w.player.facing = facing
        const plan = f.eng.controls.plan('hands')
        expect([x, y, facing, plan?.rule, plan?.target]).toEqual([x, y, facing, 'site/enter', { e: site!.id }])
        expect(textOf(plan!.label).startsWith('Enter ')).toBe(true)
      }
      tiles++
    }
  expect(tiles).toBeGreaterThan(300)
  // a wild place is named by its ground, as drawn
  const wild = Object.values(w.state.entities).find((e) => e.type === 'site/wild' && e.props?.ground === 'ow_forest')!
  expect(f.eng.nameOf({ e: wild.id }, 'zh')).toBe('森林荒野')
})

req('W12', 'a second storey: walls, the ceiling laid over them from below (held up by them), stairs set before its edge, and up one goes; break the wall and the floor comes down, and whoever stood on it falls', [], () => {
  const f = fresh()
  // an open stretch of the Ford, five cells across
  let at: [number, number] | undefined
  for (let y = 3; y < 27 && !at; y++) for (let x = 3; x < 40 && !at; x++) if ([0, 1, 2, 3, 4].every((d) => W(f).walkable('ford', x + d, y) && !W(f).placedAt('ford', x + d, y).length && W(f).heightAt('ford', x + d, y) === 0)) at = [x, y]
  const [x, y] = at!
  const build = (type: string, cx: number, ceiling = false) => {
    // one sets a thing down within reach: beside the cell — on one's storey, or in its ceiling (the open air a storey up)
    stand(f, cx + 1, y, 'left')
    const thing = author(f, () => W(f).add({ ...madeOf(W(f).onto.data, W(f).onto, type, 'wood'), id: `w12.${type}.${cx}`, place: { on: 'inside', holder: 'player' } }))
    const target = ceiling ? W(f).get(W(f).cellRef('ford', cx, y, 1).e)! : W(f).placedAt('ford', cx, y).find((e) => e.type.startsWith('structure')) ?? W(f).cellTop('ford', cx, y)!
    f.eng.act('put', 'player', { e: target.id }, { instrument: { e: thing.id } })
    return W(f).get(thing.id)!
  }
  stand(f, x + 4, y + 1, 'up')
  const wall = build('structure/wall', x)
  expect(wall.place).toMatchObject({ on: 'tile', x, y })
  expect(wall.place.on === 'tile' && wall.place.z).toBeFalsy()
  // the ceiling laid over the wall rests on it, a storey up; one beside it, held up by it (two cells round)
  const over = build('structure/floor', x, true)
  const beside = build('structure/floor', x + 1, true)
  expect(over.place).toMatchObject({ x, y, z: 1 })
  expect(beside.place).toMatchObject({ x: x + 1, y, z: 1 })
  expect(W(f).relationsOf(beside).some((k) => k.startsWith('support|'))).toBe(true)
  // stairs set before the floor's edge, going up west (set from the east): a block one walks onto
  const stairs = build('structure/stairs', x + 2)
  expect(stairs.place).toMatchObject({ x: x + 2, y })
  expect(stairs.facing).toBe('left')
  // up: onto the stairs, then west onto the floor a storey up, then over the wall
  stand(f, x + 3, y, 'left')
  expect(walk(f, 'left')).toMatchObject({ x: x + 2, y })
  expect(walk(f, 'left')).toMatchObject({ x: x + 1, y, z: 1 })
  expect(walk(f, 'left')).toMatchObject({ x, y, z: 1 })
  // the wall broken: the floors come down, and the one standing there with them
  author(f, () => f.eng.hurt(W(f).get(wall.id)!, 99, undefined, true))
  ticks(f, 3)
  expect(W(f).get(wall.id)).toBeUndefined()
  expect(W(f).get(beside.id)).toBeUndefined()
  expect(W(f).get(over.id)).toBeUndefined()
  expect(W(f).posOf(W(f).player)).toMatchObject({ x, y })
  expect(W(f).posOf(W(f).player)!.z).toBeUndefined()
  // what they were made of comes back (and pops out to the magnet)
  expect(W(f).placedAt('ford', x + 1, y).filter((e) => e.type === 'item/material/plank').length + f.eng.controls.count('item/material/plank')).toBeGreaterThan(0)
})

req('W13', 'a burning wooden wall (the hunter\'s hut at the foot) loses durability as it burns and leaves a burnt wall', [], () => {
  const f = fresh()
  // a dry hour: rain would put the fire out
  while (['rain', 'storm'].includes(W(f).calendar().weather)) W(f).state.tick += TICKS_PER_HOUR
  const [x, y] = cellOf(f, 'foot', 'woodwall')
  stand(f, ...beside(f, x, y, 'foot'), 'foot')
  const wall = W(f).cellTop('foot', x, y)!
  author(f, () => f.eng.applyStatus({ e: wall.id }, 'burning'))
  const full = W(f).num(wall, 'maxHp')
  let least = full
  ticks(f, 80, () => {
    const now = W(f).cellTop('foot', x, y)
    if (now?.type === 'tile/woodwall') least = Math.min(least, W(f).num(now, 'hp'))
    return now?.type === 'tile/burnt_wall'
  })
  expect(least).toBeLessThan(full)
  expect(W(f).terrainAt('foot', x, y)).toBe('burnt_wall')
})

// ------------------------------------------------------------------ the village, the garden, the East Road

req('F16', 'an original vegetable garden and its usable construction/farming kit', [
  ...VEGETABLE_CROPS.flatMap((c) => [...CROP_STAGES.map((s) => `fixture/crop/${c.id}/${s}`), `item/seed/${c.id}`]),
  'fixture/container/crate', 'item/tool/hoe', 'item/tool/sickle', 'item/tool/smith_hammer', 'item/vessel/bucket/water',
  'item/material/plank', 'item/material/stick', 'item/material/stone',
], () => {
  const f = fresh()
  const w = W(f)
  const kit = w.get('ford.garden.supplies')!
  expect(kit.contents).toHaveLength(24)
  expect(kit.contents!.length).toBeLessThanOrEqual(w.num(kit, 'capacity'))
  for (const c of VEGETABLE_CROPS) for (const s of CROP_STAGES) expect(w.get(`ford.garden.${c.id}.${s}`)?.type).toBe(`fixture/crop/${c.id}/${s}`)
  stand(f, GARDEN.supplies[0], GARDEN.supplies[1] + 1, 'up', GARDEN.map)
  expect(f.eng.interact('interact', 'player', { e: kit.id }, { instrument: null }).defined).toBe(true)
  expect(w.hasStatus({ e: kit.id }, 'open')).toBe(true)
  for (const id of [...kit.contents!]) f.eng.interact('take', 'player', { e: id }, { instrument: null })
  f.eng.controls.sync()
  const plot = { map: GARDEN.map, x: GARDEN.x, y: GARDEN.y + 3 }
  stand(f, plot.x, plot.y + 1, 'up', GARDEN.map)
  expect(performPlacement(f.eng, 'player', PLACEMENT_BY_ID['sow-carrot'], plot).ok).toBe(true)
  expect(performPlacement(f.eng, 'player', PLACEMENT_BY_ID.water, plot).ok).toBe(true)
  expect(w.entitiesAt(plot.map, plot.x, plot.y).some((e) => e.type === 'fixture/crop/carrot/sprout')).toBe(true)
  // A bare neighbouring tile can become a working chest, without free spawned material.
  const site = { map: 'ford', x: 20, y: 16 }
  stand(f, site.x + 1, site.y)
  expect(performPlacement(f.eng, 'player', PLACEMENT_BY_ID.chest, site).ok).toBe(true)
  const chest = w.entitiesAt(site.map, site.x, site.y).find((e) => e.type === 'fixture/container/chest')!
  expect(chest).toBeDefined()
  f.eng.interact('interact', 'player', { e: chest.id }, { instrument: null })
  expect(w.hasStatus({ e: chest.id }, 'open')).toBe(true)
  const saved = f.game.save()
  const resumed = Game.load(saved, buildFord().index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const chunk of buildFord().chunks) resumed.loadMapData(decodeChunk(chunk).map)
  expect(resumed.engine.world.get(chest.id)?.type).toBe(chest.type)
  expect(resumed.engine.world.entitiesAt(plot.map, plot.x, plot.y).some((e) => e.statuses?.watered)).toBe(true)
})

req('F17', 'Firstlight Village is the former meadow: homes, a well, a lit square and Tobin; the Ford keeps only its ferrykeeper and a wider river', [
  'fixture/water/well', 'fixture/light/lamppost', 'fixture/light/campfire', 'fixture/furniture/bench/log', 'fixture/sign/noticeboard',
], () => {
  const f = fresh()
  const w = W(f)
  const village = w.map(FIRSTLIGHT.map)!
  const ford = w.map('ford')!
  expect(village.name).toEqual(FIRSTLIGHT.name)
  expect(village.kind).toBe('village')
  expect(village.stamps?.filter((s) => s.key.startsWith('house_'))).toHaveLength(4)
  expect(Object.values(w.state.entities).filter((e) => e.npc && e.place.on === 'tile' && e.place.map === 'ford').map((e) => e.id)).toEqual(['npc.hesper'])
  expect(w.posOf(w.get('npc.tobin'))?.map).toBe(FIRSTLIGHT.map)
  expect(w.posOf(w.get('ford.cart'))).toEqual({ map: FIRSTLIGHT.map, x: FIRSTLIGHT.cart[0], y: FIRSTLIGHT.cart[1] })
  expect(ford.width).toBe(48)
  expect(ford.terrain).not.toContain('farmland')
  expect(Object.values(w.state.entities).some((e) => e.type.startsWith('fixture/crop/') && e.place.on === 'tile' && e.place.map === 'ford')).toBe(false)
  expect(Array.from({ length: 8 }, (_, i) => w.terrainAt('ford', 27 + i, 13))).toEqual(Array<string>(8).fill('water'))
  const tobin = w.get('npc.tobin')!
  for (const variant of tobin.npc!.person!.schedules!) for (const s of variant.entries) {
    expect(s.map).toBe(FIRSTLIGHT.map)
    expect(w.walkable(s.map, s.x, s.y, tobin.id, true)).toBe(true)
    expect(astar(village.width, village.height, (x, y) => !w.blocked(FIRSTLIGHT.map, x, y), 39, 19, s.x, s.y)).toBeDefined()
  }
  for (const s of village.stamps!.filter((s) => s.key.startsWith('house_'))) {
    const x = s.x + 1, y = s.y + 3
    expect(w.terrainAt(FIRSTLIGHT.map, x, y - 1)).toBe('door')
    expect(w.isSolidTerrain(w.terrainAt(FIRSTLIGHT.map, x, y))).toBe(false)
    expect(astar(village.width, village.height, (x, y) => !w.blocked(FIRSTLIGHT.map, x, y), 39, 19, x, y)).toBeDefined()
  }
  stand(f, 21, 15, 'up', FIRSTLIGHT.map)
  const bucket = ofType(f, 'item/vessel/bucket/empty')!
  hold(f, bucket)
  expect(run(f, 'use', ...FIRSTLIGHT.well).rule).toBe('use/fill')
  expect(bucket.type).toBe('item/vessel/bucket/water')
  expect(w.hasStatus({ e: 'village.campfire' }, 'lit')).toBe(true)
  expect(w.hasStatus({ e: 'village.lamp.25' }, 'lit')).toBe(true)
  expect(w.get('village.notice')?.props?.text).toContain('FIRSTLIGHT VILLAGE')
})

// ------------------------------------------------------------------ Q. the main quest (docs/main-quest.md)

req('Q1', 'chapter 1, mend the bridge: the old axe fells a tree, splits its logs into planks, three planks span the footbridge, and the far bank ends the chapter', [], () => {
  const f = fresh()
  const p = W(f).player
  const c = f.eng.controls
  const originalPlanks = new Set(Object.values(W(f).state.entities).filter((e) => e.type === 'item/material/plank').map((e) => e.id))
  expect(W(f).num(p, 'quest')).toBe(1)
  // the gap is water between the footbridge's two standing ends
  for (const x of FOOTBRIDGE.ends) expect(W(f).terrainAt('ford', x, FOOTBRIDGE.y)).toBe('bridge')
  for (const x of FOOTBRIDGE.gap) expect(W(f).terrainAt('ford', x, FOOTBRIDGE.y)).toBe('water')
  // the old axe fells a tree in the western woods: two logs
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  let tree: [number, number] | undefined
  for (let y = 3; y < 28 && !tree; y++) for (let x = 0; x < 4 && !tree; x++) if (W(f).terrainAt('ford', x, y) === 'tree' && W(f).walkable('ford', x + 1, y)) tree = [x, y]
  stand(f, tree![0] + 1, tree![1], 'left')
  run(f, 'use', ...tree!)
  run(f, 'use', ...tree!)
  const logs = Object.values(W(f).state.entities).filter((e) => e.type === 'item/material/log')
  expect(logs.length).toBeGreaterThanOrEqual(2)
  // the axe splits each log where it lies: two planks a log
  for (const log of logs.slice(0, 2)) {
    author(f, () => W(f).place(log, { on: 'tile', map: 'ford', x: STAND.road[0] + 1, y: STAND.road[1] }))
    stand(f, ...STAND.road, 'right')
    run(f, 'use', STAND.road[0] + 1, STAND.road[1])
  }
  const planks = Object.values(W(f).state.entities).filter((e) => e.type === 'item/material/plank' && !originalPlanks.has(e.id))
  expect(planks.length).toBe(4)
  author(f, () => { for (const e of planks) W(f).place(e, { on: 'inside', holder: 'player' }) })
  c.sync()
  // from the near end, a plank laid on the water ahead, a step onto it, and the next
  stand(f, FOOTBRIDGE.ends[0], FOOTBRIDGE.y, 'right')
  c.select(p.slots!.indexOf(c.key(planks[0])))
  expect(W(f).get(p.held)?.type).toBe('item/material/plank')
  for (const x of FOOTBRIDGE.gap) {
    const plan = run(f, 'put', x, FOOTBRIDGE.y)
    expect(plan.rule).toBe('water/bridge')
    expect(W(f).terrainAt('ford', x, FOOTBRIDGE.y)).toBe('bridge')
    f.eng.setCooldown(p.id, 0)
    expect(f.eng.movePlayer('right')).toBe(true)
    ticks(f, 1) // the hand takes the next plank of the stack
  }
  // The longer pier leads to the far bank; the missing span still costs three planks.
  f.eng.setCooldown(p.id, 0)
  walkEast(f)
  expect(ticks(f, 400, () => W(f).num(p, 'quest') === 2 && !W(f).scene)).toBe(true)
  expect(far(f)).toBe(true)
})

const onMap = (f: Ford, type: string, map: string) => Object.values(W(f).state.entities).filter((e) => e.type === type && e.place.on === 'tile' && e.place.map === map)
const fact = (f: Ford, key: string) => W(f).fact(key) ?? 0
const quest = (f: Ford) => W(f).num(W(f).player, 'quest')
/** Walk off a map's edge through its portal (the player's own step). */
function cross(f: Ford, map: string, x: number, y: number, dir: Entity['facing']): string {
  stand(f, x, y, dir, map)
  f.eng.setCooldown('player', 0)
  f.eng.movePlayer(dir!)
  return W(f).posOf(W(f).player)!.map
}
/** Stand beside a person (wherever their day has taken them), facing them. */
function faceNpc(f: Ford, id: string): [number, number] {
  const n = W(f).posOf(W(f).get(id)!)!
  const [x, y, dir] = beside(f, n.x, n.y, n.map)
  stand(f, x, y, dir, n.map)
  return [n.x, n.y]
}
/** Put n things of a type, one by one, on whatever is at (x, y) (right click), through the held stack. */
function putAll(f: Ford, type: string, n: number, x: number, y: number): Plan[] {
  const c = f.eng.controls
  const plans: Plan[] = []
  for (let i = 0; i < n; i++) {
    const e = Object.values(W(f).state.entities).find((x) => x.type === type && (x.place.on === 'inside' || x.place.on === 'hand') && (x.place as { holder: string }).holder === 'player')!
    c.select(W(f).player.slots!.indexOf(c.key(e)))
    plans.push(run(f, 'put', x, y))
    ticks(f, 1)
  }
  return plans
}
const give = (f: Ford, type: string, n: number) => {
  author(f, () => { for (let i = 0; i < n; i++) W(f).create(type, { on: 'inside', holder: 'player' }) })
  f.eng.controls.sync()
}

req('Q2', 'the road east: past the far bank the road leads on; the burned farm shows the dragon\'s mark; wolves and a boar on the road; it ends at Emberfall, once the White Knight has fallen', ['actor/creature/beast/wolf', 'actor/creature/beast/boar'], () => {
  const f = fresh()
  expect(cross(f, 'ford', W(f).map('ford')!.width - 2, EAST_ROAD.fordEast[1], 'right')).toBe('eastroad')
  // the road's dangers
  expect(onMap(f, 'actor/creature/beast/wolf', 'eastroad').length).toBe(2)
  expect(onMap(f, 'actor/creature/beast/boar', 'eastroad').length).toBe(1)
  // the burned farm: the player walks into it and sees the claw marks
  stand(f, 24, 10, 'up', 'eastroad')
  expect(ticks(f, 40, () => (f.eng.movePlayer('up'), W(f).posOf(W(f).player)!.y <= 9))).toBe(true)
  expect(ticks(f, 200, () => fact(f, 'mq.farm') === 1 && !W(f).scene)).toBe(true)
  // the road ends at Emberfall — once the White Knight has fallen (docs/chapter-1.md): until then the way is shut
  expect(cross(f, 'eastroad', EAST_ROAD.w - 2, EAST_ROAD.east[1], 'right')).toBe('eastroad')
  author(f, () => (W(f).setFact('sins.defeated.alberic', 1), W(f).setFact('seen.crown', 1)))
  expect(cross(f, 'eastroad', EAST_ROAD.w - 2, EAST_ROAD.east[1], 'right')).toBe('emberfall')
  expect(ticks(f, 200, () => quest(f) === 3 && !W(f).scene)).toBe(true)
})

req('Q3', 'chapter 3, Emberfall: the elder tells of the dragon, gives bread, and sets the tasks; the smithy and the herbalist\'s cauldron are lit', ['npc.mara', 'fixture/water/well', 'fixture/sign/noticeboard', 'fixture/light/lamppost', 'fixture/craft/forge', 'fixture/craft/anvil', 'fixture/container/barrel', 'fixture/craft/cauldron', 'fixture/container/crate'], () => {
  const f = fresh()
  stand(f, 2, EMBERFALL.west[1], 'right', 'emberfall')
  walk(f, 'right')
  expect(ticks(f, 200, () => quest(f) === 3 && !W(f).scene)).toBe(true)
  for (const t of ['fixture/water/well', 'fixture/sign/noticeboard', 'fixture/light/lamppost', 'fixture/container/barrel', 'fixture/container/crate']) expect(onMap(f, t, 'emberfall').length).toBeGreaterThan(0)
  expect(W(f).hasStatus({ e: 'emberfall.forge' }, 'lit')).toBe(true)
  expect(W(f).hasStatus({ e: 'emberfall.cauldron' }, 'lit')).toBe(true)
  expect(onMap(f, 'fixture/craft/anvil', 'emberfall').length).toBe(1)
  const bread = f.eng.controls.count('item/food/bread')
  run(f, 'hands', ...faceNpc(f, 'npc.mara'))
  expect(ticks(f, 400, () => quest(f) === 4 && !W(f).scene)).toBe(true)
  expect(fact(f, 'mq.council')).toBe(1)
  expect(f.eng.controls.count('item/food/bread')).toBe(bread + 2)
})

req('Q4', 'chapter 4, the old mine: a pickaxe breaks iron and coal from the veins among bats, spiders and the dead; the cyclops guards the deep vein; three ore and two coal and the smith forges Dragonsbane', ['npc.garrick', 'fixture/nature/vein/iron', 'fixture/nature/vein/coal', 'fixture/light/brazier', 'item/tool/pickaxe', 'actor/creature/beast/bat', 'actor/creature/spider', 'actor/creature/undead/skeleton', 'actor/creature/cyclops', 'item/material/iron_ore'], () => {
  const f = fresh()
  const c = f.eng.controls
  author(f, () => W(f).setFact('mq.council', 1))
  // the mine from the village's north road
  expect(cross(f, 'emberfall', EMBERFALL.north[1], 1, 'up')).toBe('mine')
  for (const t of ['actor/creature/beast/bat', 'actor/creature/spider', 'actor/creature/undead/skeleton', 'actor/creature/cyclops', 'fixture/light/brazier']) expect(onMap(f, t, 'mine').length).toBeGreaterThan(0)
  // the old pickaxe at the mouth, taken by hand
  const pick = onMap(f, 'item/tool/pickaxe', 'mine')[0]
  const pp = W(f).posOf(pick)!
  const [px, py, pd] = beside(f, pp.x, pp.y, 'mine')
  stand(f, px, py, pd, 'mine')
  run(f, 'take', pp.x, pp.y)
  hold(f, W(f).get(pick.id))
  // two blows break a vein (its durability, as the pickaxe works on ore); its ore pops out to the magnet
  const mineVein = (type: string) => {
    const v = onMap(f, type, 'mine').find((e) => {
      const p = W(f).posOf(e)!
      try {
        beside(f, p.x, p.y, 'mine')
        return true
      } catch {
        return false
      }
    })!
    const vp = W(f).posOf(v)!
    const [x, y, d] = beside(f, vp.x, vp.y, 'mine')
    stand(f, x, y, d, 'mine')
    for (let i = 0; i < 2; i++) run(f, 'use', vp.x, vp.y)
    expect(W(f).get(v.id)).toBeUndefined()
    ticks(f, 3)
  }
  for (let i = 0; i < 3; i++) mineVein('fixture/nature/vein/iron')
  for (let i = 0; i < 2; i++) mineVein('fixture/nature/vein/coal')
  expect(c.count('item/material/iron_ore')).toBeGreaterThanOrEqual(5)
  expect(c.count('item/material/coal')).toBeGreaterThanOrEqual(3)
  // the cyclops falls (and pays in ore)
  const cy = W(f).get('mine.cyclops')!
  author(f, () => W(f).place(cy, { on: 'tile', map: 'mine', x: 20, y: 25 }))
  cy.props = { ...(cy.props ?? {}), hp: 1 }
  stand(f, 20, 26, 'up', 'mine')
  hold(f, ofType(f, 'item/weapon/blade/axe'))
  f.eng.controls.strike()
  ticks(f, 2)
  expect(W(f).get('mine.cyclops')).toBeUndefined()
  // what it carried lies where it fell, still (taken with F)
  const hoard = W(f).placedAt('mine', 20, 25).filter((e) => e.type === 'item/material/iron_ore')
  expect(hoard).toHaveLength(2)
  expect(hoard.every((e) => !e.dropped)).toBe(true)
  // to the smith: ore and coal put on him, then a word, and the blade
  const [gx, gy] = faceNpc(f, 'npc.garrick')
  expect(putAll(f, 'item/material/iron_ore', 5, gx, gy).map((p) => p.rule)).toEqual(Array(5).fill('mq/smith-ore'))
  expect(putAll(f, 'item/material/coal', 3, gx, gy).map((p) => p.rule)).toEqual(Array(3).fill('mq/smith-coal'))
  run(f, 'hands', ...faceNpc(f, 'npc.garrick'))
  expect(fact(f, 'mq.blade')).toBe(1)
  expect(c.count('item/weapon/blade/dragonsbane')).toBe(1)
})

req('Q5', 'chapter 5, fire and frost: fireweed grows in the meadow and frostcap in the forest; the herbalist brews two fireproof draughts; one drunk, fire does a quarter of its harm; armed and fireproof, the village sends you up the pass', ['npc.wren', 'item/material/fireweed', 'item/material/frostcap'], () => {
  const f = fresh()
  const c = f.eng.controls
  const p = W(f).player
  author(f, () => W(f).setFact('mq.council', 1))
  expect(onMap(f, 'item/material/fireweed', 'meadow').length).toBeGreaterThanOrEqual(3)
  expect(onMap(f, 'item/material/frostcap', 'forest').length).toBeGreaterThanOrEqual(3)
  for (const [type, map] of [['item/material/fireweed', 'meadow'], ['item/material/frostcap', 'forest']] as const)
    author(f, () => { for (const e of onMap(f, type, map).slice(0, 3)) W(f).place(e, { on: 'inside', holder: 'player' }) })
  c.sync()
  const [wx, wy] = faceNpc(f, 'npc.wren')
  expect(putAll(f, 'item/material/fireweed', 3, wx, wy).map((x) => x.rule)).toEqual(Array(3).fill('mq/herbalist-fireweed'))
  expect(putAll(f, 'item/material/frostcap', 3, wx, wy).map((x) => x.rule)).toEqual(Array(3).fill('mq/herbalist-frostcap'))
  run(f, 'hands', ...faceNpc(f, 'npc.wren'))
  expect(fact(f, 'mq.draught')).toBe(1)
  expect(c.count('item/potion/fire_resist')).toBe(2)
  // drunk: fireproof, and fire's harm is a quarter
  const draught = Object.values(W(f).state.entities).find((e) => e.type === 'item/potion/fire_resist')!
  c.sync()
  c.select(p.slots!.indexOf(c.key(draught)))
  f.eng.interact('interact', p.id, { e: p.id }, { instrument: { e: p.held! } })
  expect(W(f).hasStatus({ e: p.id }, 'fireproof')).toBe(true)
  p.props!.hp = 40
  f.eng.damage(p, 12, 'fire', true)
  expect(W(f).num(p, 'hp')).toBe(37)
  // with the blade too, the village sends you up the pass
  author(f, () => W(f).setFact('mq.blade', 1))
  expect(ticks(f, 200, () => quest(f) === 5 && !W(f).scene)).toBe(true)
})

req('Q6', 'chapter 6, the pass and the lair: frost wolves, fire imps and a golem on the way up, a fire to rest by; the dragon wakes at the mouth, calls its whelps at half health, and its fall ends the story', ['actor/creature/beast/frost_wolf', 'actor/creature/imp/fire_imp', 'actor/creature/golem/stone_golem', 'actor/creature/dragon'], () => {
  const f = fresh()
  const p = W(f).player
  // the pass east of the village
  expect(cross(f, 'emberfall', EMBERFALL.w - 2, EMBERFALL.east[1], 'right')).toBe('pass')
  for (const t of ['actor/creature/beast/frost_wolf', 'actor/creature/imp/fire_imp', 'actor/creature/golem/stone_golem']) expect(onMap(f, t, 'pass').length).toBeGreaterThan(0)
  expect(onMap(f, 'fixture/light/campfire', 'pass').some((e) => W(f).hasStatus({ e: e.id }, 'lit'))).toBe(true)
  // the lair at the top: its mouth wakes the dragon
  expect(cross(f, 'pass', PASS.north[1], 1, 'up')).toBe('lair')
  expect(ticks(f, 200, () => quest(f) === 6 && !W(f).scene)).toBe(true)
  const dragon = onMap(f, 'actor/creature/dragon', 'lair')[0]
  expect(W(f).num(dragon, 'range')).toBeGreaterThan(1)
  // Dragonsbane in hand; the dragon brought to bay
  give(f, 'item/weapon/blade/dragonsbane', 1)
  hold(f, Object.values(W(f).state.entities).find((e) => e.type === 'item/weapon/blade/dragonsbane'))
  const strike = () => {
    author(f, () => W(f).place(dragon, { on: 'tile', map: 'lair', x: DRAGON_AT.x, y: DRAGON_AT.y }))
    stand(f, DRAGON_AT.x, DRAGON_AT.y + 1, 'up', 'lair')
    f.eng.setCooldown('atk:player', 0)
    f.eng.controls.strike()
    ticks(f, 1)
  }
  // wounded again once below half, it calls its whelps (once), and they hunt
  dragon.props = { ...(dragon.props ?? {}), hp: 355 }
  strike()
  expect(onMap(f, 'actor/creature/whelp', 'lair').length).toBe(0)
  expect(W(f).num(dragon, 'hp')).toBeLessThan(350)
  strike()
  const whelps = onMap(f, 'actor/creature/whelp', 'lair')
  expect(whelps.length).toBe(3)
  expect(whelps.every((w) => w.ai?.temper === 'aggressive')).toBe(true)
  // they come out around it, never on it
  expect(whelps.every((w) => JSON.stringify(W(f).posOf(w)) !== JSON.stringify(W(f).posOf(dragon)))).toBe(true)
  // its fall ends the story
  dragon.props!.hp = 1
  strike()
  expect(W(f).get(dragon.id)).toBeUndefined()
  W(f).fx = []
  const cards: unknown[] = []
  expect(
    ticks(f, 400, () => {
      cards.push(...W(f).fx.filter((x) => x.t === 'card'))
      W(f).fx = []
      return quest(f) === 7 && !W(f).scene
    }),
  ).toBe(true)
  expect(fact(f, 'mq.dragon')).toBe(1)
  expect(cards.length).toBe(1)
  expect(W(f).num(p, 'level')).toBeGreaterThan(1)
})

req('T1', 'the tutorial, offline and through the player\'s own inputs: one comes round in a clearing, eats, gathers, makes an axe, fells a tree and splits planks, lights a fire, builds a house with a bed and gets through a night while the dead walk; the way out opens only on the first morning after the house, and nothing leads back', [
  'item/food/berries', 'item/material/stick', 'item/material/stone', 'item/material/grass',
], () => {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]), 'tutorial')
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const f: Ford = { game, eng: game.engine, events: [], made: [] }
  const w = W(f)
  const p = w.player
  const c = f.eng.controls
  const T = 'tutorial'
  const stage = () => w.num(p, 'prologue')
  const until = (n: number, limit = 60) => expect(ticks(f, limit, () => stage() >= n), `stage ${n} (at ${stage()})`).toBe(true)
  const carried = (type: string) => [p.held, ...(p.contents ?? [])].map((id) => w.get(id)).find((e) => e?.type === type)
  const count = (type: string) => c.count(type)
  /** F on whatever lies at a spot, from beside it, until nothing more is taken there. */
  const takeAll = (x: number, y: number) => {
    stand(f, x, y + 1, 'up', T)
    for (let i = 0; i < 12; i++) {
      const plan = c.plan('take', at(x, y))
      if (!plan) return
      c.run(plan, true)
      f.eng.tick()
    }
  }
  /** The toolbar holds a stack: one of its kind comes to hand. */
  const grab = (type: string) => {
    c.select(p.slots!.indexOf(c.key(carried(type)!)))
    expect(w.get(p.held)?.type).toBe(type)
  }
  const craft = (type: string, n = 1) => { for (let i = 0; i < n; i++) expect(c.craft(RECIPE_BY_ID[type]), `craft ${type}`).toBe(true) }
  // the morning of day 1: one lies out cold, then comes round, and Pip speaks
  expect(w.posOf(p)).toMatchObject({ map: T, x: TUTORIAL.spawn[0], y: TUTORIAL.spawn[1] })
  expect(Math.floor(w.hour())).toBe(7)
  expect(w.hasStatus({ e: p.id }, 'out_cold')).toBe(true)
  expect(stage()).toBe(0)
  until(1, 80)
  expect(w.hasStatus({ e: p.id }, 'out_cold')).toBe(false)
  // the way out is shut: down the path to the edge, one only stands on it (and Pip says not yet)
  const [ex] = TUTORIAL.exit
  const h = TUTORIAL.size[1]
  stand(f, ex, h - 4, 'down', T)
  for (let i = 0; i < 4; i++) walk(f, 'down')
  expect(w.posOf(p)).toMatchObject({ map: T, x: ex, y: h - 1 })
  expect(w.fact('seen.tut_too_soon')).toBeTruthy()
  // food: F takes the berries, a right click eats them
  const [bx, by] = TUTORIAL.berries[0]
  takeAll(bx, by)
  hold(f, carried('item/food/berries'))
  c.run(c.plan('self')!, true)
  if (w.state.question) c.answer(true)
  until(2)
  // what lies about: sticks, stones, grass
  for (const [x, y] of [...TUTORIAL.sticks, ...TUTORIAL.stones, ...TUTORIAL.grass]) takeAll(x, y)
  until(3)
  // C: a stone axe
  craft('item/weapon/blade/axe')
  until(4)
  // the grove: three trees felled, their logs split into planks where they lie, the planks taken
  hold(f, carried('item/weapon/blade/axe'))
  for (const [x, y] of TUTORIAL.grove.slice(0, 3)) {
    const [sx, sy, d] = beside(f, x, y, T)
    stand(f, sx, sy, d, T)
    for (let i = 0; i < 4 && w.terrainAt(T, x, y) === 'tree'; i++) run(f, 'use', x, y)
    expect(w.terrainAt(T, x, y)).not.toBe('tree')
    // the logs lie in a pile with a stick: what is on top is taken (F) until the axe meets a log
    for (let i = 0; i < 12 && w.placedAt(T, x, y).some((e) => e.type === 'item/material/log'); i++) {
      const top = w.get(c.plan('use', at(x, y))!.target.e)
      if (top?.type === 'item/material/log') run(f, 'use', x, y)
      else run(f, 'take', x, y)
    }
    for (let i = 0; i < 30 && w.placedAt(T, x, y).some((e) => e.type === 'item/material/plank' || e.type === 'item/material/stick'); i++) {
      const plan = c.plan('take', at(x, y))
      if (!plan) break
      c.run(plan, true)
      f.eng.tick()
    }
  }
  expect(count('item/material/plank')).toBeGreaterThanOrEqual(12)
  until(5)
  // B: a ring of stones and sticks is a campfire; C: a torch, and the fire lit with it
  const fire = { map: T, x: 14, y: 18 }
  stand(f, fire.x, fire.y - 1, 'down', T)
  expect(performPlacement(f.eng, 'player', PLACEMENT_BY_ID.campfire, fire).ok).toBe(true)
  craft('item/light/torch')
  hold(f, carried('item/light/torch'))
  run(f, 'use', fire.x, fire.y)
  until(6)
  // a house round oneself: the bed at one's feet, walls and a door round, a floor over it all
  const [hx, hy] = [20, 12]
  stand(f, hx, hy, 'down', T)
  craft('fixture/furniture/bed')
  craft('structure/wall', 3)
  craft('structure/door')
  craft('structure/floor')
  const put = (type: string, x: number, y: number, layer = 0) => {
    grab(type)
    run(f, 'put', x, y, layer)
    f.eng.tick()
  }
  put('fixture/furniture/bed', hx, hy)
  for (const [x, y] of [[hx, hy - 1], [hx - 1, hy], [hx + 1, hy]] as const) put('structure/wall', x, y)
  put('structure/door', hx, hy + 1)
  // the ceiling over one's head: chosen (the chooser's last entry, as a long press of G offers it)
  put('structure/floor', hx, hy, CEILING)
  until(7)
  // one's fill of berries before dark (a hungry sleeper wakes in the night)
  for (const [x, y] of TUTORIAL.berries.slice(1)) takeAll(x, y)
  stand(f, hx, hy, 'down', T)
  for (let i = 0; i < 12 && carried('item/food/berries') && w.num(p, 'hunger') < w.num(p, 'maxHunger'); i++) {
    grab('item/food/berries')
    c.run(c.plan('self')!, true)
    if (w.state.question) c.answer(true)
    f.eng.tick()
  }
  // the day goes by (the test's hand on the clock) and the night comes: the dead walk the clearing,
  // and an hour of it the shut door keeps them out
  setHour(f, 1, 20.9)
  const hp = w.num(p, 'hp')
  let walkers = 0
  ticks(f, 600, () => ((walkers = Math.max(walkers, w.entitiesOnMap(T).filter((e) => w.hasTag(e, 'nightborn')).length)), false))
  expect(walkers).toBeGreaterThan(0)
  expect(w.num(p, 'hp')).toBe(hp)
  // E on the bed at one's feet: one sleeps the night through, and the first morning after the house comes
  expect(stage()).toBe(7)
  const sleep = c.plan('hands', at(hx, hy))!
  expect(sleep.target).toEqual({ e: w.placedAt(T, hx, hy).find((e) => e.type === 'fixture/furniture/bed')!.id })
  c.run(sleep, true)
  until(TUTORIAL_DONE, 200)
  // the first morning after the house: day 2, at first light
  expect(w.calendar().day).toBe(2)
  expect(w.fact(TUTORIAL_OPEN)).toBeTruthy()
  // out of the door and down the path: the way out leads to the foot of the mountain
  run(f, 'hands', hx, hy + 1)
  stand(f, ex, h - 2, 'down', T)
  walk(f, 'down')
  ticks(f, 10)
  expect(w.posOf(p)).toMatchObject({ map: 'foot', x: TUTORIAL.arrive[0], y: TUTORIAL.arrive[1] })
  until(PROLOGUE_AT_FOOT)
  expect(ticks(f, 60, () => w.posOf(w.get('pip')!)?.map === 'foot')).toBe(true)
  // played once: nothing leads back, and it lies nowhere on the overworld
  expect(index.maps.flatMap((m) => m.portals).filter((x) => x.to === T)).toEqual([])
  expect(index.maps.find((m) => m.id === T)!.at).toBeUndefined()
  expect(w.map(T)!.site).toBeUndefined()
})

req('T2', "a game without the tutorial begins on Cloudtop, above the foot of the mountain, at the seal stone's stage, the fairy beside", [], () => {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const s: Ford = { game, eng: game.engine, events: [], made: [] }
  const sw = W(s)
  expect(sw.posOf(sw.player)).toMatchObject({ map: 'summit', x: PAT.spawn[0], y: PAT.spawn[1] })
  expect(sw.num(sw.player, 'prologue')).toBe(PROLOGUE_AT_FOOT)
  expect(sw.hasStatus({ e: sw.player.id }, 'out_cold')).toBe(false)
  expect(sw.posOf(sw.get('pip')!)?.map).toBe('summit')
})

req('P1', "the prologue's end, offline: from Cloudtop (where a new game begins) down the cut, by the foot of the mountain to the Ford, every beat reached through the player's inputs, Pip at your side, the waypoint stone on the world map", [
  'fixture/sacred/waypoint', 'fixture/sacred/seal_stone',
], () => {
  const { index, chunks } = buildFord()
  // no modder at all: every experiment falls back, and the prologue still goes on
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const f: Ford = { game, eng: game.engine, events: [], made: [] }
  const w = W(f)
  const p = w.player
  const stage = () => w.num(p, 'prologue')
  const until = (n: number, limit = 60) => expect(ticks(f, limit, () => stage() >= n), `prologue ${n} (at ${stage()})`).toBe(true)
  const pip = () => w.get('pip')!
  /** E on Pip, wherever it perches: what it says. */
  const askPip = () => {
    ticks(f, 6)
    const at = w.posOf(pip())!
    w.fx.length = 0
    run(f, 'hands', at.x, at.y)
    const said = w.fx.find((x) => x.t === 'say' && x.who === 'pip')
    return said && said.t === 'say' && typeof said.text === 'object' ? (said.text.zh ?? '') : ''
  }
  // the game begins on Cloudtop: down through the gap in the cut, and the trail leads off it onto the foot
  expect(w.posOf(p)?.map).toBe('summit')
  ticks(f, 10)
  expect(w.fact('seen.summit_wake')).toBeTruthy()
  stand(f, PAT.cut[0], PAT.cut[1] - 1, 'down', 'summit')
  for (let i = 0; i < 12 && w.posOf(p)?.map === 'summit'; i++) walk(f, 'down')
  expect(w.posOf(p)?.map).toBe('foot')
  expect(stage()).toBe(PROLOGUE_AT_FOOT)
  expect(askPip()).toContain('世界从没见过')
  // E on the waypoint statue wakes it (Pip pointed it out the first time it came into view)
  stand(f, PAT.footStone[0], PAT.footStone[1] + 1, 'up', 'foot')
  ticks(f, 40)
  expect(w.fact('seen.see_waypoint')).toBeTruthy()
  run(f, 'hands', ...PAT.footStone)
  expect(w.hasStatus({ e: 'wp.foot' }, 'attuned')).toBe(true)
  // walking up to the seal stone: entering its ground starts the beat (an event, not a poll, world-model.md §6.12)
  stand(f, PAT.relic[0], PAT.relic[1] + 6, 'up', 'foot')
  for (let i = 0; i < 5; i++) walk(f, 'up')
  expect(w.posOf(p)).toMatchObject({ map: 'foot', x: PAT.relic[0], y: PAT.relic[1] + 1 })
  ticks(f, 10)
  expect(w.fact('seen.relic')).toBeTruthy()
  // something the world has never seen done to it
  run(f, 'use', ...PAT.relic)
  until(PROLOGUE_AT_FOOT + 1, 200)
  // the trail comes out at the top of the Ford's cliff: the prologue is over, the story begins
  stand(f, 17, 28, 'down', 'foot')
  ticks(f, 5)
  f.eng.movePlayer('down')
  ticks(f, 10)
  expect(w.posOf(p)?.map).toBe('ford')
  until(PROLOGUE_DONE)
  expect(ticks(f, 400, () => w.fact('village.sent') === 1 && !w.scene)).toBe(true)
  expect(w.posOf(pip())?.map).toBe('ford')
  // past the prologue, Pip tells the main story's next step: the village first (docs/quests.md)
  expect(askPip()).toContain('去初原村帮忙')
  // the world map: the foot above the Ford, and the woken statue takes you back up
  const at = new Map(index.maps.map((m) => [m.id, m.at]))
  expect(at.get('ford')).toEqual({ x: 0, y: 0 })
  expect(at.get('foot')!.y).toBe(-30)
  expect(index.waypoints!.map((x) => x.id).sort()).toEqual(['wp.eastroad', 'wp.foot', 'wp.ford', 'wp.summit', 'wp.village'])
  expect(travelToWaypoint(f.eng, 'wp.foot')).toBe(true)
  expect(w.posOf(p)).toMatchObject({ map: 'foot', x: PAT.footStone[0], y: PAT.footStone[1] + 1 })
})

req('P2', 'a profession trainer in Firstlight Village: spoken to, he offers the choice; at level 5 a profession is taken up, its weapon handed over, and a change gives its points back', ['npc.bram'], () => {
  const f = fresh()
  const w = W(f)
  const bram = w.get('npc.bram')!
  const at = w.posOf(bram)!
  expect(at.map).toBe('meadow')
  f.eng.author(() => f.eng.teleport(w.player, { map: at.map, x: at.x, y: at.y + 1 }))
  w.fx.length = 0
  f.eng.interact('interact', 'player', { e: bram.id }, { instrument: null })
  expect(w.fx.some((x) => x.t === 'panel' && x.panel === 'profession')).toBe(true)
  Object.assign(w.player.props!, { level: PROFESSION_LEVEL, skillPoints: 2 })
  expect(f.eng.controls.takeProfession(PROFESSION_BY_ID.mage, SKILLS)).toBeUndefined()
  expect(f.eng.controls.learn(SKILLS.find((s) => s.id === 'mage-focus')!)).toBe(true)
  expect(f.eng.controls.takeProfession(PROFESSION_BY_ID.assassin, SKILLS)).toBeUndefined()
  expect(w.num(w.player, 'skillPoints')).toBe(2)
})

// =================================================================== the village's quests (docs/quests.md)

/** Talk (E) to a person from the tile below them; what they said. */
function talkTo(f: Ford, id: string): string {
  const w = W(f)
  const at = w.posOf(w.get(id)!)!
  f.eng.author(() => f.eng.teleport(w.player, { map: at.map, x: at.x, y: at.y + 1 }))
  w.player.facing = 'up'
  w.fx.length = 0
  f.eng.interact('interact', 'player', { e: id }, { instrument: null })
  const said = w.fx.find((x) => x.t === 'say' && x.who === id)
  return said && said.t === 'say' && typeof said.text === 'object' ? said.text.zh ?? '' : ''
}
/** Fell a creature beside the player, as the player does: a bare-handed blow (it is left with one health). */
function fell(f: Ford, e: Entity): void {
  const w = W(f)
  // an empty slot: a loaf in the hand would be used on it, not swung
  f.eng.controls.sync()
  f.eng.controls.select(w.player.slots!.findIndex((s) => !s))
  const at = w.posOf(e)!
  f.eng.author(() => f.eng.teleport(w.player, { map: at.map, x: at.x, y: at.y + 1 }))
  author(f, () => w.place(e, { on: 'tile', map: at.map, x: at.x, y: at.y }))
  w.player.facing = 'up'
  ;(e.props ??= {}).hp = 1
  f.eng.setCooldown('atk:player', 0)
  f.eng.playerAttack({ e: e.id })
  expect(w.get(e.id) && w.num(e, 'hp') > 0).toBeFalsy()
}
const markOf = (f: Ford, id: string) => f.eng.quests.mark(id)

req('P3', 'the village main quest, before the bridge: Rowan (!) asks you to bring Lina and Oskar back from the Old Barrow, through Thornwood Hollow; find them, fell the warden, hand it in (?) and the bridge chapter opens', ['npc.rowan', 'npc.lina', 'npc.oskar', 'actor/creature/undead/warden'], () => {
  const f = fresh()
  const w = W(f)
  w.player.props!.quest = 0
  author(f, () => w.setFact('village.sent', 1))
  expect(markOf(f, 'npc.rowan')).toBe('!')
  expect(talkTo(f, 'npc.rowan')).toContain('莉娜和奥斯卡')
  expect(w.fact('q.rescue')).toBe('active')
  expect(markOf(f, 'npc.rowan')).toBeUndefined()
  expect(f.eng.quests.log().map((q) => [q.id, q.kind])).toEqual([['rescue', 'main']])
  // south of the forest, the hollow; south of the hollow, the barrow
  const forest = w.map('forest')!
  stand(f, HOLLOW.forestSouth[1], forest.height - 2, 'down', 'forest')
  ticks(f, 3)
  f.eng.movePlayer('down')
  expect(w.posOf(w.player)?.map).toBe('hollow')
  stand(f, HOLLOW.south[1], w.map('hollow')!.height - 2, 'down', 'hollow')
  ticks(f, 3)
  f.eng.movePlayer('down')
  expect(w.posOf(w.player)?.map).toBe('barrow')
  // the two foragers, and the warden
  expect(w.posOf(w.get('npc.lina')!)?.map).toBe('barrow')
  expect(talkTo(f, 'npc.lina')).toContain('我回家了')
  expect(talkTo(f, 'npc.oskar')).toContain('小心那个守卫')
  expect(f.eng.quests.status(f.eng.quests.defs.find((q) => q.id === 'rescue')!)).toBe('active')
  fell(f, w.get('barrow.warden')!)
  expect(markOf(f, 'npc.rowan')).toBe('?')
  const xp = w.num(w.player, 'xp') + 20 * (w.num(w.player, 'level', 1) - 1)
  expect(talkTo(f, 'npc.rowan')).toContain('在圣火前感恩')
  expect(w.fact('q.rescue')).toBe('done')
  // that night, the flame (docs/chapter-1.md): stage 0.5
  expect(w.num(w.player, 'quest')).toBe(0.5)
  expect(w.fact('rescue.lina')).toBe(1)
  expect(w.num(w.player, 'xp') + 20 * (w.num(w.player, 'level', 1) - 1)).toBeGreaterThan(xp)
  expect(f.eng.quests.log()).toEqual([])
})

req('P4', 'the villagers\' errands: three side quests (stew, a lost ring, clearing the hollow) and a daily one (firewood); and the night: zombies and bats in the wild, never in the village, gone at dawn', ['npc.marta', 'actor/creature/slime/green_slime', 'npc.mia', 'npc.holt', 'npc.gus', 'item/valuable/ring'], () => {
  const f = fresh()
  const w = W(f)
  const c = f.eng.controls
  const give = (type: string, n: number) => { author(f, () => { for (let i = 0; i < n; i++) w.create(type, { on: 'inside', holder: 'player' }) }); c.sync() }
  const count = (type: string) => c.count(type)
  // the stew: three beef, two eggs, taken by the cook
  for (const id of ['npc.marta', 'npc.mia', 'npc.gus']) expect(markOf(f, id)).toBe('!')
  expect(markOf(f, 'npc.holt')).toBeUndefined() // the hollow is for level 2
  talkTo(f, 'npc.marta')
  give('item/food/meat/raw', 3)
  give('item/food/egg/raw', 2)
  expect(markOf(f, 'npc.marta')).toBe('?')
  const bread = count('item/food/bread')
  talkTo(f, 'npc.marta')
  expect([w.fact('q.stew'), count('item/food/meat/raw'), count('item/food/egg/raw'), count('item/food/bread') - bread]).toEqual(['done', 0, 0, 3])
  // the ring, in the hollow's thorns
  talkTo(f, 'npc.mia')
  const ring = w.get('quest.mia.ring')!
  const at = w.posOf(ring)!
  expect(at.map).toBe('hollow')
  stand(f, at.x, at.y + 1, 'up', 'hollow')
  run(f, 'take', at.x, at.y)
  expect(talkTo(f, 'npc.mia')).toContain('你找到了')
  // handed in: the ring goes back to Mia (she takes it into her bag)
  expect([w.fact('q.ring'), w.get('quest.mia.ring')?.place]).toEqual(['done', { on: 'inside', holder: 'npc.mia' }])
  // the hollow cleared: six felled there count; elsewhere they do not
  w.player.props!.level = 2
  expect(markOf(f, 'npc.holt')).toBe('!')
  talkTo(f, 'npc.holt')
  fell(f, author(f, () => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'pasture', x: 20, y: 12 })))
  expect(w.fact('q.thorns.kills')).toBe(0)
  for (let i = 0; i < 6; i++) fell(f, author(f, () => w.create('actor/creature/slime/green_slime', { on: 'tile', map: 'hollow', x: 20, y: 10 })))
  expect(f.eng.quests.log().find((q) => q.id === 'thorns')!.goals[0]).toMatchObject({ have: 6, need: 6 })
  talkTo(f, 'npc.holt')
  expect(w.fact('q.thorns')).toBe('done')
  // firewood: once a day
  talkTo(f, 'npc.gus')
  give('item/material/log', 4)
  talkTo(f, 'npc.gus')
  expect(w.fact('q.firewood')).toBe('done')
  expect(markOf(f, 'npc.gus')).toBeUndefined()
  w.state.tick = tickAt(w.calendar().day + 1, 8)
  expect(markOf(f, 'npc.gus')).toBe('!')
  // the night: in the wild (the grassland) they come, a few at a time; in the village, never
  const born = (map: string) => w.entitiesOnMap(map).filter((e) => w.hasTag(e, 'nightborn'))
  stand(f, 20, 12, 'down', 'pasture')
  setHour(f, 2, 22)
  ticks(f, NIGHT_EVERY * 8)
  expect(born('pasture').length).toBeGreaterThan(0)
  expect(born('pasture').length).toBeLessThanOrEqual(NIGHT_CAP)
  expect(born('pasture').every((e) => e.type === 'actor/creature/undead/zombie' || e.type === 'actor/creature/beast/bat')).toBe(true)
  f.eng.author(() => f.eng.teleport(w.player, { map: 'meadow', x: 20, y: 14 }))
  ticks(f, NIGHT_EVERY * 8)
  expect(born('meadow')).toEqual([])
  // dawn: those of the night crumble
  f.eng.author(() => f.eng.teleport(w.player, { map: 'pasture', x: 20, y: 12 }))
  setHour(f, 3, 6)
  ticks(f, 60)
  expect(born('pasture')).toEqual([])
})

// =================================================================== Chapter 1, the First Seal (docs/chapter-1.md)

/** A hand (E) on a thing from the tile below it. */
function touch(f: Ford, id: string): void {
  const w = W(f)
  const at = w.posOf(w.get(id)!)!
  f.eng.author(() => f.eng.teleport(w.player, { map: at.map, x: at.x, y: at.y + 1 }))
  w.player.facing = 'up'
  f.eng.interact('interact', 'player', { e: id }, { instrument: null })
}

req('C1', 'Chapter 1, offline: the night of the flame (the grey man takes it), the letter, the pilgrim\'s road (Fennick, Joss, Hesper), the knight\'s kingdom and the White Knight, the Crown and the fairy\'s first power, the grey man again, a longer night, and home', [
  'npc.ilse', 'npc.severin', 'npc.courier', 'npc.fennick', 'npc.joss', 'npc.nessa', 'actor/creature/sin/alberic', 'region:kingdom', 'fixture/nature/briar', 'fixture/sacred/gravestone', 'fixture/sacred/altar',
], () => {
  const f = fresh()
  const w = W(f)
  const c = f.eng.controls
  const quest = () => w.num(w.player, 'quest')
  // the barrow done (P3): that night, the village gives thanks
  author(f, () => { w.player.props!.quest = 0.5; w.setFact('village.rescued', 1); w.setFact('q.rescue', 'done') })
  expect(OBJECTIVES[0.5].title).toBeDefined()
  f.eng.author(() => f.eng.teleport(w.player, { map: 'meadow', x: 20, y: 14 }))
  expect(w.hasStatus({ e: 'village.campfire' }, 'lit')).toBe(true)
  setHour(f, 1, 21.5)
  expect(ticks(f, 900, () => w.fact('ch1.flame_stolen') === 1 && !w.scene)).toBe(true)
  // the Firstlight gone; the grey man gone with it, to where no one can follow yet
  expect(w.hasStatus({ e: 'village.campfire' }, 'lit')).toBe(false)
  expect(w.posOf(w.get('npc.severin')!)?.map).toBe('offstage')
  expect(quest()).toBe(0.6)
  // dawn: the Church's courier, the proclamation; the courier gone again
  setHour(f, 2, 6)
  expect(ticks(f, 900, () => w.fact('ch1.letter') === 1 && !w.scene)).toBe(true)
  expect(c.count('item/document/proclamation')).toBe(1)
  expect(w.posOf(w.get('npc.courier')!)?.map).toBe('offstage')
  expect(quest()).toBe(0.7)
  // Sister Ilse: the pilgrim's road — Fennick on the knight, Joss on the bridge, Hesper on what she saw
  expect(markOf(f, 'npc.ilse')).toBe('!')
  talkTo(f, 'npc.ilse')
  expect(talkTo(f, 'npc.fennick')).toContain('荆棘')
  talkTo(f, 'npc.joss')
  expect(talkTo(f, 'npc.hesper')).toContain('荆棘冠')
  expect(markOf(f, 'npc.ilse')).toBe('?')
  talkTo(f, 'npc.ilse')
  expect(w.fact('q.pilgrim')).toBe('done')
  expect(quest()).toBe(1)
  // the bridge is Q1's; past the far bank, the White Knight's road (stage 2)
  author(f, () => { w.setFact('ford.crossed', 1); w.player.props!.quest = 2 })
  // into the ring of thorns: the knight speaks once
  stand(f, 32, 11, 'right', 'eastroad')
  expect(ticks(f, 60, () => (f.eng.movePlayer('right'), !!w.fact('seen.kingdom')))).toBe(true)
  ticks(f, 200, () => !w.scene)
  // the First Seal-bearer: softer here than in the Boss Challenge
  const knight = w.get(ALBERIC_ID)!
  expect(knight.boss?.kit).toBe('alberic')
  expect(w.num(knight, 'maxHp')).toBeLessThan(BOSS_BY_ID.alberic.hp)
  expect(w.num(knight, 'skillScale')).toBeLessThan(1)
  // the way to Emberfall shut while he stands
  expect(w.map('eastroad')!.portals.filter((p) => p.to === 'emberfall').every((p) => p.opensWhen === 'sins.defeated.alberic')).toBe(true)
  f.eng.damage(knight, 10000, undefined, true, { e: 'player' })
  expect(w.fact('sins.defeated.alberic')).toBe(1)
  // the Crown, the fairy's first power, the grey man, a longer night
  expect(ticks(f, 1200, () => w.fact('ch1.crown') === 1 && !w.scene)).toBe(true)
  expect(c.count('item/relic/crown_of_thorns')).toBe(1)
  const pip = w.get('pip')!
  expect(boonsOf(w, pip)).toEqual(['xp'])
  expect(activeBoon(pip)).toBe('xp')
  expect(w.stat(w.player, 'xpRate')).toBe(1)
  expect(w.posOf(w.get('npc.severin')!)?.map).toBe('offstage')
  expect(w.fact('night.shift')).toBe(1)
  setHour(f, 3, 20.5)
  expect(w.isNight()).toBe(true)
  expect(quest()).toBe(2.5)
  // home: the village, Nessa's four minutes, the chapter's card
  f.eng.author(() => f.eng.teleport(w.player, { map: 'meadow', x: 20, y: 14 }))
  const cards: unknown[] = []
  expect(ticks(f, 900, () => { cards.push(...w.fx.filter((x) => x.t === 'card')); w.fx = []; return w.fact('ch1.end') === 1 && !w.scene })).toBe(true)
  expect(cards.length).toBe(1)
  expect(quest()).toBe(2.9)
})

req('C2', "Chapter 1's errands: Pell's drawings (four, where the grey man was), Nessa's measure of days (three statues), Fennick's old templar (three of the dead), Joss's ninth nail and Edda's ring (both in the knight's kingdom)", [
  'npc.pell', 'npc.edda', 'fixture/chalk/stone', 'fixture/chalk/door', 'fixture/chalk/bridge', 'fixture/chalk/man', 'item/misc/ninth_nail', 'item/valuable/band', 'item/food/bread',
], () => {
  const f = fresh()
  const w = W(f)
  const c = f.eng.controls
  // Pell's drawings: each read with a hand
  expect(markOf(f, 'npc.pell')).toBe('!')
  talkTo(f, 'npc.pell')
  for (const d of DRAWINGS) {
    touch(f, `ch1.drawing.${d}`)
    expect(w.fact(`ch1.drawing.${d}`)).toBe(1)
  }
  expect(markOf(f, 'npc.pell')).toBe('?')
  talkTo(f, 'npc.pell')
  expect([w.fact('q.drawings'), c.count('item/misc/warm_ember')]).toEqual(['done', 1])
  // the marked loaf the grey man left in the barrow
  expect(Object.values(w.state.entities).some((e) => e.type === 'item/food/bread' && typeof e.name === 'object' && e.name.zh === '印着灰痕的面包')).toBe(true)
  // Nessa's measure: three statues woken
  talkTo(f, 'npc.nessa')
  for (const id of ['wp.village', 'wp.ford', 'wp.eastroad']) touch(f, id)
  expect(w.fact('waypoints.attuned')).toBe(3)
  talkTo(f, 'npc.nessa')
  expect([w.fact('q.measure'), c.count('item/document/almanac')]).toEqual(['done', 1])
  // after the letter: Fennick's night, Joss's nail
  author(f, () => w.setFact('ch1.letter', 1))
  talkTo(f, 'npc.fennick')
  for (let i = 0; i < 3; i++) fell(f, author(f, () => w.create('actor/creature/undead/zombie', { on: 'tile', map: 'pasture', x: 20, y: 12 })))
  talkTo(f, 'npc.fennick')
  expect([w.fact('q.templar'), c.count('item/armor/helmet')]).toEqual(['done', 1])
  talkTo(f, 'npc.joss')
  talkTo(f, 'npc.edda')
  for (const type of ['item/misc/ninth_nail', 'item/valuable/band']) {
    const it = Object.values(w.state.entities).find((e) => e.type === type)!
    const at = w.posOf(it)!
    expect(at.map).toBe('eastroad')
    stand(f, at.x, at.y + 1, 'up', 'eastroad')
    run(f, 'take', at.x, at.y)
    expect(c.count(type)).toBe(1)
  }
  talkTo(f, 'npc.joss')
  talkTo(f, 'npc.edda')
  expect([w.fact('q.nail'), w.fact('q.band'), c.count('item/tool/smith_hammer')]).toEqual(['done', 'done', 1])
})

req('C4', "Chapter 1's story before the knight: the village's welcome, Lina's shut door, the warden's last words, the tale of the First Night (the fairy shivers at the spear), the Ford the night of the theft, Fennick's memory, Hesper's stumps, the road east, Edda in the barn, the grey man's warning, a rest at the statue", [], () => {
  const f = fresh()
  const w = W(f)
  const played = (id: string) => !!w.fact(`seen.${id}`)
  const waitFor = (id: string) => expect(ticks(f, 900, () => played(id) && !w.scene)).toBe(true)
  const go = (map: string, x: number, y: number) => f.eng.author(() => f.eng.teleport(w.player, { map, x, y }))
  /** Step in from outside a region, as a player walks: entering it is what the story hears. */
  const stepInto = (map: string, x: number, y: number, dir: Entity['facing'], id: string) => {
    stand(f, x, y, dir, map)
    expect(ticks(f, 60, () => (f.eng.movePlayer(dir!), played(id)))).toBe(true)
    ticks(f, 900, () => !w.scene)
  }
  // the village's welcome (the fixture skips it; here it plays)
  author(f, () => w.setFact('seen.village_arrival', 0))
  go('meadow', 20, 14)
  waitFor('village_arrival')
  // the barrow: Lina's cell, then the warden's last words
  stepInto('barrow', 10, 17, 'left', 'barrow_cells')
  author(f, () => w.setFact('q.rescue.warden', 1))
  waitFor('warden_falls')
  // dusk after the rescue: the tale, at the flame
  author(f, () => w.setFact('village.rescued', 1))
  go('meadow', 20, 14)
  setHour(f, 2, 18)
  waitFor('tale')
  expect(w.fact('ch1.tale')).toBe(1)
  // the night of the theft, at the Ford
  author(f, () => w.setFact('ch1.flame_stolen', 1))
  go('ford', AT.spawn[0], AT.spawn[1])
  waitFor('ford_night')
  // the pilgrim's road: Fennick's memory in the village, Hesper's stumps at the Ford
  author(f, () => (w.setFact('ch1.letter', 1), w.setFact('q.pilgrim.fennick', 1), w.setFact('q.pilgrim.hesper', 1)))
  go('meadow', 20, 14)
  waitFor('fennick_memory')
  go('ford', AT.spawn[0], AT.spawn[1])
  waitFor('hesper_stumps')
  // over the river: the road east, Edda in the barn, the grey man before the thorns, the statue
  author(f, () => (w.setFact('ford.crossed', 1), w.setFact('seen.burned_farm', 1)))
  go('eastroad', 6, 12)
  waitFor('road_east')
  stepInto('eastroad', 21, 11, 'up', 'edda_barn')
  stepInto('eastroad', 26, 12, 'right', 'severin_warning')
  expect(w.fact('ch1.warned')).toBe(1)
  expect(w.posOf(w.get('npc.severin')!)?.map).toBe('offstage')
  const statue = w.posOf(w.get('wp.eastroad')!)!
  go('eastroad', statue.x, statue.y + 1)
  expect(ticks(f, 60, () => played('statue_rest'))).toBe(true)
})

req('C3', 'the nights lengthen as the seals fall: an hour earlier and half an hour later per seal (the story\'s night.shift), for the creatures and for the screen', [], () => {
  const f = fresh()
  const w = W(f)
  setHour(f, 2, 20.5)
  expect(w.isNight()).toBe(false)
  author(f, () => w.setFact('night.shift', 1))
  expect(w.isNight()).toBe(true)
  setHour(f, 3, 5.25)
  expect(w.isNight()).toBe(true)
  expect(snapshot(f.eng).night).toEqual({ dusk: 20, dawn: 5.5 })
})

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
    const placed = new Set<string>([...chunks.flatMap((c) => c.entities.map((e) => e.type)), ...index.npcs.map((n) => n.id), 'weather:storm', 'region:far_bank', 'region:kingdom'])
    const witnessed = new Set(R.flatMap((r) => r.by))
    const idle = [...placed].filter((p) => !witnessed.has(p))
    expect(idle).toEqual([])
    const unknown = [...witnessed].filter((w) => !placed.has(w))
    expect(unknown).toEqual([])
  })
})
