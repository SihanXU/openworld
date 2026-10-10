// The world on its own (docs/game-design.md §3, §5; design.md §5.4–5.13): time and weather,
// people as data, and what the world does by itself — sight, behaviour that cannot go on, the
// story's broken content, physics. Every one of them is an event with one outcome like any
// other: defined, it runs; undefined, the Mod port is asked once per hole and class; with no
// answer, the leaf's default keeps the world going. And the boundaries of what the world's own
// patches may do.

import { describe, expect, it } from 'vitest'
import {
  ModPort,
  RuleLibrary,
  TICKS_PER_HOUR,
  buildSandbox,
  calendarAt,
  holeKey,
  isNight,
  scheduleFor,
  tickAt,
  validatePatch,
  type Effect,
  type Engine,
  type GameEvent,
  type LineDef,
  type PersonData,
  type Rule,
  type Scenario,
} from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])
/** A provider still at work: the request stays pending until a patch or the time-out. */
const working = { resolve: () => new Promise<null>(() => {}) }

/** A 9x9 meadow: the player at (4,5), a person at (4,4), and whatever else. Strict: state changes only in outcomes. */
function place(person: PersonData = {}, extra: Scenario['entities'] = [], size = 9): Engine {
  const eng = buildSandbox(
    {
      terrain: Array.from({ length: size }, () => Array(size).fill('grass')),
      entities: [{ key: 'actor', type: 'actor/person/player', x: 4, y: 5 }, { key: 'hesper', type: 'actor/person/ferrykeeper', x: 4, y: 4 }, ...extra],
      event: {},
    },
    onto,
    lib(),
  )
  const h = eng.world.get('hesper')!
  h.name = { en: 'Hesper', zh: '赫斯珀' }
  h.npc = { role: 'ferrykeeper', schedule: [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'watch the water' }], person }
  return eng
}

const talk = (eng: Engine) => {
  eng.world.fx = []
  eng.act('hands', 'actor', { e: 'hesper' }, { instrument: null })
  const said = eng.world.fx.find((f) => f.t === 'say' && f.who === 'hesper')
  return said && said.t === 'say' ? (typeof said.text === 'string' ? said.text : said.text.en) : undefined
}
const L = (key: string, en: string, more: Partial<LineDef> = {}): LineDef => ({ key, text: { en, zh: en }, ...more })
const ticks = (eng: Engine, n: number) => {
  for (let i = 0; i < n; i++) eng.tick()
}
const fact = (eng: Engine, key: string, value: number) => eng.author(() => eng.world.setFact(key, value))

describe('time and weather', () => {
  it('days and nights, nothing more: day 1 begins at 06:00, a game minute is a second', () => {
    expect(calendarAt(0, 1)).toMatchObject({ day: 1, hour: 6 })
    expect(calendarAt(tickAt(2, 1.5), 1)).toMatchObject({ day: 2, minute: 30 })
    expect(TICKS_PER_HOUR).toBe(600)
    expect(isNight(22)).toBe(true)
    expect(isNight(12)).toBe(false)
  })

  it('the world fixes the weather for spans of time; otherwise the seed draws it', () => {
    const plan = [{ day: 1, from: 17, to: 20, weather: 'storm' as const }]
    expect(calendarAt(tickAt(1, 18), 7, plan).weather).toBe('storm')
    expect(calendarAt(tickAt(1, 12), 7, plan).weather).toBe('sun')
    const days = new Set(Array.from({ length: 40 }, (_, d) => calendarAt(tickAt(d + 2, 12), 7).weather))
    expect(days.size).toBeGreaterThan(2)
  })

  it('rain wets people outdoors and puts out fires (the world\'s clock emits water; each thing answers it)', () => {
    const eng = place({}, [{ key: 'hay', type: 'fixture/nature/haystack', x: 1, y: 1, statuses: ['burning'] }])
    eng.world.weather = [{ day: 1, weather: 'rain' }]
    eng.trace = []
    ticks(eng, 60)
    expect(eng.trace.some((t) => t.ev.kind === 'time/period' && t.ev.params?.name === 'weather' && t.rule === 'world/clocks')).toBe(true)
    expect(eng.world.hasStatus({ e: 'actor' }, 'wet')).toBe(true)
    expect(eng.world.hasStatus({ e: 'hay' }, 'burning')).toBe(false)
  })
})

describe('people', () => {
  it('say the most specific line that fits: first meeting, a fact, the weather, the hour, default — never the same twice in a row', () => {
    const eng = place({ lines: [L('greeting:first', 'Who are you?'), L('fact:nets.mended', 'The line holds.', { once: true }), L('weather:storm', 'Get under something.'), L('default', 'A'), L('default', 'B')] })
    expect(talk(eng)).toBe('Who are you?')
    expect(eng.world.get('hesper')!.npc!.memory?.talked).toBeDefined()
    const a = talk(eng)
    const b = talk(eng)
    expect([a, b].sort()).toEqual(['A', 'B'])
    fact(eng, 'nets.mended', 1)
    expect(talk(eng)).toBe('The line holds.')
    expect(['A', 'B']).toContain(talk(eng))
    eng.world.weather = [{ day: 1, weather: 'storm' }]
    expect(talk(eng)).toBe('Get under something.')
  })

  it('asked for news with no deed to tell, give the fresh news of the place (their topic line) before "quiet days"', () => {
    const eng = place({ lines: [L('topic:theft', 'I saw that.'), L('default', 'Hm.')] })
    eng.author(() => (eng.world.setFact('topic.theft', 1), eng.world.setFact('topic.theft.days', 2)))
    const ask = () => {
      eng.world.fx = []
      eng.controls.talk('hesper', 'ask')
      return eng.world.fx.flatMap((f) => (f.t === 'say' && f.who === 'hesper' ? [typeof f.text === 'string' ? f.text : f.text.en] : []))
    }
    expect(ask()).toEqual(['I saw that.'])
    // said once: then there is nothing more to tell
    expect(ask()).toEqual(['Nothing much has happened. Quiet days.'])
  })

  it('remember what happened: a topic line is said once while it is fresh', () => {
    const eng = place({ lines: [L('topic:theft', 'I saw that.'), L('default', 'Hm.')] })
    eng.world.get('hesper')!.npc!.memory = { talked: 1 }
    eng.author(() => (eng.world.setFact('topic.theft', 1), eng.world.setFact('topic.theft.days', 2)))
    expect(talk(eng)).toBe('I saw that.')
    expect(talk(eng)).toBe('Hm.')
  })

  it('take what they are handed and say what they make of it (no tastes, no points)', () => {
    const eng = place({ lines: [L('given:item/food', 'Thank you.'), L('given', 'What is this?')] })
    const loaf = eng.author(() => eng.world.create('item/food/bread', { on: 'hand', holder: 'actor' }))
    eng.world.fx = []
    eng.trace = []
    eng.act('put', 'actor', { e: 'hesper' })
    expect(eng.trace.map((t) => t.rule)).toContain('people/accept')
    expect(eng.world.get(loaf.id)!.place).toMatchObject({ on: 'inside', holder: 'hesper' })
    expect(eng.world.fx.some((f) => f.t === 'say' && typeof f.text === 'object' && f.text.en === 'Thank you.')).toBe(true)
  })

  it('follow the most specific schedule: a fact, a storm, the default — and a detour an outcome of their own ordered', () => {
    const at = (x: number) => [{ from: 0, to: 24, map: 'sandbox', x, y: 4, activity: `at ${x}` }]
    const eng = place({ schedules: [{ key: 'default', entries: at(1) }, { key: 'storm', entries: at(2) }, { key: 'fact:ford.crossed', entries: at(3) }] })
    const h = eng.world.get('hesper')!
    expect(scheduleFor(eng, h)[0].x).toBe(1)
    eng.world.weather = [{ day: 1, weather: 'storm' }]
    expect(scheduleFor(eng, h)[0].x).toBe(2)
    fact(eng, 'ford.crossed', 1)
    expect(scheduleFor(eng, h)[0].x).toBe(3)
    // a variant may join a fact and the weather: both holding, it is the more specific
    const both = place({ schedules: [{ key: 'default', entries: at(1) }, { key: 'storm', entries: at(2) }, { key: 'fact:ford.crossed', entries: at(3) }, { key: 'fact:ford.crossed+storm', entries: at(4) }] })
    const h2 = both.world.get('hesper')!
    fact(both, 'ford.crossed', 1)
    expect(scheduleFor(both, h2)[0].x).toBe(3)
    both.world.weather = [{ day: 1, weather: 'storm' }]
    expect(scheduleFor(both, h2)[0].x).toBe(4)
    // an outcome may change its host's script (design.md §5.4): a ferrykeeper who cannot go on takes shelter
    eng.world.state.maps.sandbox.anchors = { shelter: [6, 6] }
    const stuck: GameEvent = { kind: 'stuck', host: { e: 'hesper' }, roles: {}, params: { activity: 'at 3' }, origin: 'world' }
    const open = eng.resolveEvent(stuck)
    eng.lib.add({ id: 'patch/keeper-shelters', host: { type: 'actor/person/ferrykeeper' }, on: 'stuck', hole: holeKey(open.hole!.rule.id, open.hole!.path), at: open.open!.path, tree: { do: [{ op: 'goto', anchor: 'shelter', hours: 1 }] }, source: { origin: 'patch' } })
    eng.queue(stuck)
    expect(scheduleFor(eng, h)[0]).toMatchObject({ x: 6, y: 6, activity: 'shelter' })
  })
})

describe('the world\'s own events are events like any other (design.md §5.7–5.11)', () => {
  it('contact and bumps: a fiery creature sets dry things alight; what nothing answers is no change, and nothing is asked', () => {
    const eng = place({}, [
      { key: 'slime', type: 'actor/creature/slime/fire_slime', x: 1, y: 2 },
      { key: 'hay', type: 'fixture/nature/haystack', x: 2, y: 2 },
      { key: 'chest', type: 'fixture/container/chest', x: 1, y: 3 },
    ])
    const port = new ModPort(eng)
    port.provider = working
    const slime = eng.world.get('slime')!
    eng.trace = []
    eng.step(slime, 'right') // into the haystack
    eng.step(slime, 'down') // into the chest
    expect(eng.trace.some((t) => t.ev.kind === 'bump' && t.rule === 'fire/fiery-bump')).toBe(true)
    expect(eng.world.hasStatus({ e: 'hay' }, 'burning')).toBe(true)
    expect(eng.world.hasStatus({ e: 'chest' }, 'burning')).toBe(false)
    expect(port.records).toHaveLength(0)
    expect(eng.world.get('chest')!.frozenBy).toBeUndefined()
  })

  it('seen: the owner objects to a theft (a rule); a bystander sees it too, which is no change', () => {
    const eng = place({}, [
      { key: 'tobin', type: 'actor/person/peddler', x: 6, y: 5 },
      { key: 'oil', type: 'item/vessel/flask/oil', x: 4, y: 6, props: { owner: 'hesper' } },
    ])
    eng.world.get('tobin')!.npc = { role: 'peddler', schedule: [{ from: 0, to: 24, map: 'sandbox', x: 6, y: 5, activity: 'mind the cart' }], person: {} }
    const port = new ModPort(eng)
    eng.trace = []
    eng.act('take', 'actor', { e: 'oil' }, { instrument: null })
    const seen = eng.trace.filter((t) => t.ev.kind === 'seen')
    expect(seen.find((t) => 'e' in t.ev.host && t.ev.host.e === 'hesper')).toMatchObject({ rule: 'people/see', defined: true, ev: { params: { act: 'take', owner: 'mine' } } })
    expect(seen.find((t) => 'e' in t.ev.host && t.ev.host.e === 'tobin')).toMatchObject({ rule: 'people/see', defined: true, ev: { params: { owner: 'another' } } })
    // both took it in: a theft, against her (docs/npc-sandbox.md)
    expect(eng.world.get('hesper')!.npc!.memory?.deeds?.[0]).toMatchObject({ deed: 'theft', against: 'hesper' })
    expect(eng.world.get('tobin')!.npc!.memory?.deeds?.[0]).toMatchObject({ deed: 'theft', against: 'hesper' })
    expect(eng.world.topicFresh('theft')).toBe(true)
    expect(port.records).toHaveLength(0)
  })

  it('seen: what nobody owns is nobody\'s business, and the sleeping see nothing', () => {
    const eng = place({}, [{ key: 'stone', type: 'item/material/stone', x: 4, y: 6 }, { key: 'oil', type: 'item/vessel/flask/oil', x: 3, y: 5, props: { owner: 'hesper' } }])
    new ModPort(eng)
    eng.trace = []
    eng.act('take', 'actor', { e: 'stone' }, { instrument: null })
    const byHesper = () => eng.trace.filter((t) => t.ev.kind === 'seen' && 'e' in t.ev.host && t.ev.host.e === 'hesper')
    expect(byHesper().map((t) => [t.ev.params?.owner, t.rule])).toEqual([['nobody', 'people/see']])
    expect(eng.world.get('hesper')!.npc!.memory?.deeds ?? []).toEqual([])
    eng.world.get('hesper')!.npc!.schedule = [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'sleep' }]
    eng.trace = []
    eng.act('take', 'actor', { e: 'oil' }, { instrument: null })
    expect(byHesper()).toEqual([])
    expect(eng.world.topicFresh('theft')).toBe(false)
  })

  it('stuck: a person whose fire is out lights it again (a rule); a burning cart is asked about, at most once an hour', () => {
    const eng = place({}, [
      { key: 'fire', type: 'fixture/light/campfire', x: 4, y: 3 },
      { key: 'cart', type: 'fixture/furniture/cart', x: 5, y: 4, statuses: ['burning'] },
    ])
    const port = new ModPort(eng)
    const h = eng.world.get('hesper')!
    h.npc!.schedule = [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'tend the fire', uses: 'fire', need: { status: ['lit'] } }]
    ticks(eng, 12)
    expect(eng.world.hasStatus({ e: 'fire' }, 'lit')).toBe(true)
    expect(port.records).toHaveLength(0)
    h.npc!.schedule = [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'mind the cart', uses: 'cart', need: { notStatus: ['burning'] } }]
    ticks(eng, 12)
    const r = port.records.find((x) => x.event.kind === 'stuck')
    expect(r).toMatchObject({ origin: 'world', event: { params: { activity: 'mind the cart' }, roles: { target: { e: 'cart' } } }, request: { hole: { rule: 'core/stuck' } } })
    expect(r!.request.event.detail).toContain('mind the cart')
    ticks(eng, 40)
    expect(port.records.filter((x) => x.event.kind === 'stuck')).toHaveLength(1)
  })

  it('broken: content broken by state is asked about; with no answer its fallback keeps it playable', () => {
    const eng = place({}, [{ key: 'winch', type: 'fixture/ferry/winch', x: 6, y: 6, statuses: ['broken'] }])
    eng.loadInvariants(
      [
        {
          id: 'ford.rope',
          giver: 'hesper',
          text: 'a rope must exist while the winch is broken',
          when: { exists: { type: 'fixture/ferry/winch', status: ['broken'] } },
          holds: { exists: { type: 'item/tool/rope' } },
          fallback: [{ op: 'spawn', type: 'item/tool/rope', at: 'tileOf:target' }],
        },
      ],
      ['ford.'],
    )
    const port = new ModPort(eng)
    port.provider = working
    const ropes = () => Object.values(eng.world.state.entities).filter((e) => e.type === 'item/tool/rope').length
    ticks(eng, 31)
    const r = port.records.find((x) => x.event.kind === 'broken')
    expect(r).toMatchObject({ origin: 'world', status: 'pending', event: { params: { invariant: 'ford.rope' } }, request: { hole: { rule: 'core/broken' } } })
    expect(r!.request.event.detail).toContain('a rope must exist')
    expect(ropes()).toBe(0)
    ticks(eng, port.timeoutTicks + 1)
    expect(r!.status).toBe('fallback')
    expect(ropes()).toBe(1)
    // asked once: the invariant holds again, and a broken one does not ask twice
    ticks(eng, 60)
    expect(port.records.filter((x) => x.event.kind === 'broken')).toHaveLength(1)
  })

  it('physics answers by itself: a status taken on is no change unless the host says; lightning sets a dry tree burning — nothing is asked', () => {
    const eng = place({}, [{ key: 'rope', type: 'item/tool/rope', x: 3, y: 3 }, { key: 'tree', type: 'fixture/nature/dead_tree', x: 6, y: 3 }])
    const port = new ModPort(eng)
    port.provider = working
    eng.author(() => eng.applyStatus({ e: 'rope' }, 'burning'))
    eng.author(() => eng.applyStatus(eng.world.cellRef('sandbox', 1, 1), 'wet'))
    eng.queue({ kind: 'impulse/element', host: { e: 'tree' }, roles: {}, params: { element: 'lightning', power: 4 }, origin: 'world' })
    expect(eng.world.hasStatus({ e: 'tree' }, 'burning')).toBe(true)
    expect(port.records).toHaveLength(0)
  })

  it('who started the chain is kept: the player\'s own, or the world\'s', () => {
    const eng = place({}, [{ key: 'rock', type: 'fixture/nature/boulder', x: 4, y: 6 }, { key: 'rock2', type: 'fixture/nature/boulder', x: 7, y: 7 }])
    const port = new ModPort(eng)
    port.provider = working
    eng.act('hands', 'actor', { e: 'rock' }, { instrument: null })
    expect(port.records[0]).toMatchObject({ origin: 'player', event: { kind: 'impulse/handle', cause: 'actor' } })
    eng.queue({ kind: 'impulse/push', host: { e: 'rock2' }, roles: {}, params: { dir: 'up' }, origin: 'world' })
    expect(port.records[1]).toMatchObject({ origin: 'world', event: { kind: 'impulse/push' } })
  })

  it('one question per hole and class: many things of one class reaching the same hole ask once', () => {
    const things = Array.from({ length: 4 }, (_, i) => ({ key: `b${i}`, type: 'fixture/sacred/statue', x: i * 2, y: 1 }))
    const eng = place({}, [...things, { key: 'well', type: 'fixture/water/well', x: 1, y: 7 }])
    const port = new ModPort(eng)
    port.provider = working
    const strike = (id: string) => eng.queue({ kind: 'impulse/strike', host: { e: id }, roles: {}, params: { power: 2, edge: 'blunt' }, origin: 'world' })
    for (const t of things) strike(t.key)
    expect(port.records).toHaveLength(1)
    // only the first is held while it is asked; the rest ran their default
    expect(things.filter((t) => eng.world.get(t.key)!.frozenBy).map((t) => t.key)).toEqual(['b0'])
    strike('well')
    expect(port.records).toHaveLength(2)
  })
})

describe('the Mod port holds up', () => {
  it('a question with no reply at all (the service down) is asked again, a few times, not given up at once', async () => {
    const eng = place({}, [{ key: 'b', type: 'fixture/sacred/statue', x: 2, y: 1 }])
    const port = new ModPort(eng)
    let asked = 0
    port.provider = { resolve: () => (asked++, Promise.reject(new Error('fetch failed'))) }
    const strike = () => eng.queue({ kind: 'impulse/strike', host: { e: 'b' }, roles: {}, params: { power: 2, edge: 'blunt' }, origin: 'world' })
    for (let i = 0; i < 5; i++) {
      strike()
      await Promise.resolve()
      await Promise.resolve()
    }
    expect(asked).toBe(3)
    expect(eng.world.get('b')!.frozenBy).toBeUndefined()
  })

  it('a request carries the lines said lately, after the frame drained them', () => {
    const eng = place({}, [{ key: 'b', type: 'fixture/sacred/statue', x: 2, y: 1 }])
    const port = new ModPort(eng)
    eng.world.fx.push({ t: 'log', text: { en: 'The ferry bell rings.', zh: '渡口的钟响了。' } })
    eng.world.drainFx()
    eng.queue({ kind: 'impulse/strike', host: { e: 'b' }, roles: {}, params: { power: 2, edge: 'blunt' }, origin: 'world' })
    expect(port.records[0].request.context.recent).toContain('The ferry bell rings.')
  })

  it('a thing that changes type takes up the cells of its new footprint', () => {
    const grow: Rule = { id: 'test/grow', host: { type: 'actor/creature/slime' }, on: 'impulse/handle', tree: { do: [{ op: 'transform', into: 'actor/creature/sin/lust' }] } }
    const eng = buildSandbox(
      { terrain: Array.from({ length: 9 }, () => Array(9).fill('grass')), entities: [{ key: 'actor', type: 'actor/person/player', x: 4, y: 5 }, { key: 'c', type: 'actor/creature/slime/green_slime', x: 4, y: 4 }], event: {} },
      onto,
      new RuleLibrary([...BASE_RULES, ...STORY_RULES, grow]),
    )
    const w = eng.world
    eng.act('hands', 'actor', { e: 'c' }, { instrument: null })
    const c = w.get('c')!
    expect(c.type).toBe('actor/creature/sin/lust')
    const cells = w.occupiedCells(c)
    expect(cells.length).toBeGreaterThan(1)
    for (const [x, y] of cells) expect(w.entitiesAt('sandbox', x, y).map((e) => e.id)).toContain('c')
  })
})

describe('a request the modder is creating things for', () => {
  it('waits past the time-out, holding who is in it, until the patch comes', () => {
    const eng = place({}, [{ key: 'b', type: 'fixture/sacred/statue', x: 2, y: 1 }])
    const port = new ModPort(eng)
    port.provider = working
    eng.queue({ kind: 'impulse/strike', host: { e: 'b' }, roles: {}, params: { power: 2, edge: 'blunt' }, origin: 'world' })
    const rec = port.records[0]
    expect(port.hold(rec.id)).toBe(true)
    ticks(eng, port.timeoutTicks * 3)
    expect(rec.status).toBe('pending')
    expect(eng.world.get('b')!.frozenBy).toBe(rec.id)
    // a request that is not pending any more cannot be held
    expect(port.hold('nope')).toBe(false)
  })
})

describe('the boundaries of the world\'s own patches (design.md §5.11)', () => {
  const stuck: Scenario = {
    entities: [
      { key: 'w', type: 'actor/person/peddler', x: 1, y: 1 },
      { key: 'thing', type: 'item/vessel/flask/oil', x: 2, y: 2, props: { owner: 'x' } },
    ],
    player: '__player',
    event: { kind: 'stuck', host: 'w', target: 'thing', params: { activity: 'mind the cart' } },
  }
  // the peddler's own answer at the hole a stuck person reaches (core/stuck, its root)
  const rule = (id: string, effects: Effect[]): Rule => ({ id, host: { type: 'actor/person/peddler' }, on: 'stuck', hole: 'core/stuck', at: [], tree: { do: effects }, tests: [] })
  const check = (r: Rule, world = true) => validatePatch({ artifacts: [{ kind: 'rule', rule: r }] }, { ontology: onto, library: lib(), scenario: stuck, world, protectedFacts: ['ford.'] })

  it('a person may react — a line, an emote, a topic for the story, a detour', () => {
    expect(
      check(rule('patch/shrug', [{ op: 'say', text: 'Not my business.' }, { op: 'emote', mood: 'shy' }, { op: 'emit', impulse: 'notify', to: 'story', params: { what: 'topic', value: 'gossip' } }, { op: 'goto', anchor: 'home', hours: 1 }])).errors,
    ).toEqual([])
  })

  it('but is never harmed, and never changes the story', () => {
    expect(check(rule('patch/hurt', [{ op: 'hurt', amount: 5 }])).errors.join()).toContain('may not harm a person')
    // the story's facts are its own props: a person's rule writes only the person (its own prop of that name is not the fact)
    expect(check(rule('patch/story', [{ op: 'setProp', key: 'ford.crossed', value: 1 }])).errors.join()).not.toContain("story's fact")
    // the player's own patches keep their limits
    expect(check(rule('patch/hurt2', [{ op: 'hurt', amount: 5 }]), false).errors).toEqual([])
  })
})
