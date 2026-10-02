// The world on its own (docs/game-design.md §3, §5; design.md §5.4–5.8): time and weather,
// people as data, and the four kinds of event the world raises by itself — meet, witness,
// blocked, invalid — with the salience filter, the budgets, the safe defaults and the
// boundaries of the world's own patches.

import { describe, expect, it } from 'vitest'
import {
  ModPort,
  RuleLibrary,
  TICKS_PER_HOUR,
  buildSandbox,
  calendarAt,
  isNight,
  scheduleFor,
  tickAt,
  validatePatch,
  type Engine,
  type LineDef,
  type PersonData,
  type Rule,
  type Scenario,
} from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

/** A 9x9 meadow: the player at (4,5), a person at (4,4), and whatever else. */
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
  eng.interact('interact', 'actor', { e: 'hesper' })
  const said = eng.world.fx.find((f) => f.t === 'say' && f.who === 'hesper')
  return said && said.t === 'say' ? (typeof said.text === 'string' ? said.text : said.text.en) : undefined
}
const L = (key: string, en: string, more: Partial<LineDef> = {}): LineDef => ({ key, text: { en, zh: en }, ...more })
const ticks = (eng: Engine, n: number) => {
  for (let i = 0; i < n; i++) eng.tick()
}

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

  it('rain wets people outdoors and puts out fires', () => {
    const eng = place({}, [{ key: 'hay', type: 'fixture/nature/haystack', x: 1, y: 1, statuses: ['burning'] }])
    eng.world.state.weather = [{ day: 1, weather: 'rain' }]
    ticks(eng, 60)
    expect(eng.world.hasStatus({ e: 'actor' }, 'wet')).toBe(true)
    expect(eng.world.hasStatus({ e: 'hay' }, 'burning')).toBe(false)
  })
})

describe('people', () => {
  it('say the most specific line that fits: first meeting, a fact, the weather, the hour, default — never the same twice in a row', () => {
    const eng = place({ lines: [L('greeting:first', 'Who are you?'), L('fact:nets.mended', 'The line holds.', { once: true }), L('weather:storm', 'Get under something.'), L('default', 'A'), L('default', 'B')] })
    expect(talk(eng)).toBe('Who are you?')
    expect(eng.world.fact('met.hesper')).toBe(true)
    const a = talk(eng)
    const b = talk(eng)
    expect([a, b].sort()).toEqual(['A', 'B'])
    eng.world.setFact('nets.mended', 1)
    expect(talk(eng)).toBe('The line holds.')
    expect(['A', 'B']).toContain(talk(eng))
    eng.world.state.weather = [{ day: 1, weather: 'storm' }]
    expect(talk(eng)).toBe('Get under something.')
  })

  it('remember what happened: a topic line is said once while it is fresh', () => {
    const eng = place({ lines: [L('topic:theft', 'I saw that.'), L('default', 'Hm.')] })
    eng.world.state.memory = { hesper: { talked: 1 } }
    eng.world.state.topics = [{ id: 'theft', day: 1, days: 2 }]
    expect(talk(eng)).toBe('I saw that.')
    expect(talk(eng)).toBe('Hm.')
  })

  it('take what they are handed and say what they make of it (no tastes, no points)', () => {
    const eng = place({ lines: [L('given:item/food', 'Thank you.'), L('given', 'What is this?')] })
    const loaf = eng.world.create('item/food/bread', { on: 'hand', holder: 'actor' })
    eng.world.fx = []
    eng.interact('put', 'actor', { e: 'hesper' })
    expect(eng.world.get(loaf.id)!.place).toMatchObject({ on: 'inside', holder: 'hesper' })
    expect(eng.world.fx.some((f) => f.t === 'say' && typeof f.text === 'object' && f.text.en === 'Thank you.')).toBe(true)
  })

  it('follow the most specific schedule: a fact, a storm, the default — and a detour a rule ordered', () => {
    const at = (x: number) => [{ from: 0, to: 24, map: 'sandbox', x, y: 4, activity: `at ${x}` }]
    const eng = place({ schedules: [{ key: 'default', entries: at(1) }, { key: 'storm', entries: at(2) }, { key: 'fact:ford.crossed', entries: at(3) }] })
    const h = eng.world.get('hesper')!
    expect(scheduleFor(eng, h)[0].x).toBe(1)
    eng.world.state.weather = [{ day: 1, weather: 'storm' }]
    expect(scheduleFor(eng, h)[0].x).toBe(2)
    eng.world.setFact('ford.crossed', 1)
    expect(scheduleFor(eng, h)[0].x).toBe(3)
    eng.world.state.maps.sandbox.anchors = { shelter: [6, 6] }
    eng.effects.run({ id: 't', on: 'blocked', when: {}, do: [{ op: 'goto', who: 'actor', anchor: 'shelter', hours: 1 }] }, { kind: 'blocked', roles: { actor: { e: 'hesper' } } })
    expect(scheduleFor(eng, h)[0]).toMatchObject({ x: 6, y: 6, activity: 'shelter' })
  })
})

describe('the world raises its own events (design.md §5.4)', () => {
  it('meet: a fiery creature sets dry things alight; what no rule answers is asked, when the player can see it', () => {
    const eng = place({}, [
      { key: 'slime', type: 'actor/creature/slime/fire_slime', x: 1, y: 2 },
      { key: 'hay', type: 'fixture/nature/haystack', x: 2, y: 2 },
      { key: 'chest', type: 'fixture/container/chest', x: 1, y: 3 },
    ])
    const port = new ModPort(eng)
    eng.world.get('slime')!.ai = { behaviour: 'melee', hostile: false, sight: 0, home: { map: 'sandbox', x: 1, y: 1 } }
    eng.step(eng.world.get('slime')!, 'up')
    eng.step(eng.world.get('slime')!, 'down')
    expect(eng.world.hasStatus({ e: 'hay' }, 'burning')).toBe(true)
    const asked = port.records.filter((r) => r.origin === 'world' && r.event.kind === 'meet')
    expect(asked.map((r) => r.event.roles.target)).toEqual([{ e: 'chest' }])
    // nothing froze: the world goes on while it is asked
    expect(eng.world.get('chest')!.frozenBy).toBeUndefined()
  })

  it('witness: the owner objects to a theft (a rule); a bystander is asked about', () => {
    const eng = place({}, [
      { key: 'tobin', type: 'actor/person/peddler', x: 6, y: 5 },
      { key: 'oil', type: 'item/vessel/flask/oil', x: 4, y: 6, props: { owner: 'hesper' } },
    ])
    eng.world.get('tobin')!.npc = { role: 'peddler', schedule: [{ from: 0, to: 24, map: 'sandbox', x: 6, y: 5, activity: 'mind the cart' }], person: {} }
    const port = new ModPort(eng)
    eng.world.fx = []
    eng.interact('take', 'actor', { e: 'oil' })
    expect(eng.trace.some((t) => t.ev.kind === 'witness' && t.ev.about === 'take:owner' && t.rule === 'witness/owner-take')).toBe(true)
    expect(eng.world.state.topics?.some((t) => t.id === 'theft')).toBe(true)
    const bystander = port.records.find((r) => r.event.kind === 'witness')
    expect(bystander).toMatchObject({ origin: 'world', event: { about: 'take:bystander', roles: { actor: { e: 'tobin' } } } })
    expect(bystander!.request.event.detail).toContain('belongs to Hesper')
  })

  it('witness: nobody sees what nobody owns, nor what happens while they sleep', () => {
    const eng = place({}, [{ key: 'stone', type: 'item/material/stone', x: 4, y: 6 }, { key: 'oil', type: 'item/vessel/flask/oil', x: 3, y: 5, props: { owner: 'hesper' } }])
    new ModPort(eng)
    eng.interact('take', 'actor', { e: 'stone' })
    eng.world.get('hesper')!.npc!.schedule = [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'sleep' }]
    eng.interact('take', 'actor', { e: 'oil' })
    expect(eng.trace.some((t) => t.ev.kind === 'witness')).toBe(false)
  })

  it('blocked: a person whose fire is out lights it again (a rule); a burning cart is asked about', () => {
    const eng = place({}, [
      { key: 'fire', type: 'fixture/light/campfire', x: 4, y: 3 },
      { key: 'cart', type: 'fixture/furniture/cart', x: 5, y: 4, statuses: ['burning'] },
    ])
    const port = new ModPort(eng)
    const h = eng.world.get('hesper')!
    h.npc!.schedule = [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'tend the fire', uses: 'fire', need: { status: ['lit'] } }]
    ticks(eng, 12)
    expect(eng.world.hasStatus({ e: 'fire' }, 'lit')).toBe(true)
    h.npc!.schedule = [{ from: 0, to: 24, map: 'sandbox', x: 4, y: 4, activity: 'mind the cart', uses: 'cart', need: { notStatus: ['burning'] } }]
    ticks(eng, 12)
    const r = port.records.find((x) => x.event.kind === 'blocked')
    expect(r).toMatchObject({ origin: 'world', event: { about: 'mind the cart', roles: { target: { e: 'cart' } } } })
    // once an hour at most
    ticks(eng, 40)
    expect(port.records.filter((x) => x.event.kind === 'blocked')).toHaveLength(1)
  })

  it('invalid: content broken by state is asked about; with no answer its fallback keeps it playable', () => {
    const eng = place({}, [{ key: 'winch', type: 'fixture/ferry/winch', x: 6, y: 6, statuses: ['broken'] }])
    eng.loadInvariants(
      [
        {
          id: 'ford.rope',
          giver: 'hesper',
          text: 'a rope must exist while the winch is broken',
          when: { exists: { type: 'fixture/ferry/winch', status: ['broken'] } },
          holds: { exists: { type: 'item/tool/rope' } },
          fallback: [{ op: 'spawn', type: 'item/tool/rope', at: 'tileOf:actor' }],
        },
      ],
      ['ford.'],
    )
    const port = new ModPort(eng)
    ticks(eng, 31)
    const r = port.records.find((x) => x.event.kind === 'invalid')
    expect(r).toMatchObject({ origin: 'world', event: { about: 'ford.rope' } })
    expect(r!.request.event.detail).toContain('a rope must exist')
    expect(Object.values(eng.world.state.entities).some((e) => e.type === 'item/tool/rope')).toBe(false)
    ticks(eng, port.timeoutTicks + 1)
    expect(Object.values(eng.world.state.entities).some((e) => e.type === 'item/tool/rope')).toBe(true)
    // asked once: the invariant holds again, and a broken one does not ask twice
    ticks(eng, 60)
    expect(port.records.filter((x) => x.event.kind === 'invalid')).toHaveLength(1)
  })

  it('physical: a status taking hold of a reactive thing, or lightning on a fixture, is asked about; the open ground is not', () => {
    const eng = place({}, [{ key: 'rope', type: 'item/tool/rope', x: 3, y: 3 }, { key: 'tree', type: 'fixture/nature/dead_tree', x: 6, y: 3 }])
    const port = new ModPort(eng)
    eng.applyStatus({ e: 'rope' }, 'burning')
    eng.applyStatus({ tile: { map: 'sandbox', x: 1, y: 1 } }, 'wet')
    eng.queue({ kind: 'hit', roles: { target: { e: 'tree' } }, element: 'lightning', power: 4 })
    const kinds = port.records.map((r) => `${r.event.kind}:${'e' in (r.event.roles.target ?? {}) ? (r.event.roles.target as { e: string }).e : 'tile'}`)
    expect(kinds).toContain('status:rope')
    expect(kinds).toContain('hit:tree')
    expect(kinds).not.toContain('status:tile')
    expect(port.records.every((r) => r.origin === 'world')).toBe(true)
  })

  it('the player\'s own blows and steps are never world events', () => {
    const eng = place({}, [])
    const port = new ModPort(eng)
    eng.queue({ kind: 'hit', roles: { actor: { e: 'actor' }, target: { tile: { map: 'sandbox', x: 4, y: 6 } } }, power: 2, origin: 'player' })
    expect(port.records).toHaveLength(0)
  })

  it('the world asks within a budget: at most six physical requests a game hour', () => {
    const things = Array.from({ length: 9 }, (_, i) => ({ key: `t${i}`, type: i % 3 === 0 ? 'fixture/nature/haystack' : i % 3 === 1 ? 'fixture/container/barrel' : 'fixture/furniture/washing_line', x: i % 9, y: 1 }))
    const eng = place({}, things)
    const port = new ModPort(eng)
    const types = ['item/tool/rope', 'item/food/bread', 'item/material/log', 'item/material/stick', 'item/material/plank', 'item/document/letter', 'item/material/cloth', 'item/material/wool']
    for (const [i, t] of types.entries()) {
      const e = eng.world.create(t, { on: 'tile', map: 'sandbox', x: i, y: 7 })
      eng.applyStatus({ e: e.id }, 'burning')
    }
    expect(port.records.filter((r) => r.origin === 'world').length).toBe(6)
  })
})

describe('the boundaries of the world\'s own patches (design.md §5.8)', () => {
  const witness: Scenario = {
    entities: [
      { key: 'w', type: 'actor/person/peddler', x: 1, y: 1 },
      { key: 'thing', type: 'item/vessel/flask/oil', x: 2, y: 2, props: { owner: 'x' } },
    ],
    player: '__player',
    event: { kind: 'witness', actor: 'w', target: 'thing', about: 'take:bystander' },
  }
  const rule = (id: string, effects: Rule['do']): Rule => ({ id, on: 'witness', when: { about: ['take:bystander'], actor: { type: 'actor/person' } }, do: effects, tests: [] })
  const check = (r: Rule, world = true) => validatePatch({ artifacts: [{ kind: 'rule', rule: r }] }, { ontology: onto, library: lib(), scenario: witness, world, protectedFacts: ['ford.'] })

  it('a person may react — a line, an emote, a topic, a detour', () => {
    expect(check(rule('patch/shrug', [{ op: 'say', who: 'actor', text: 'Not my business.' }, { op: 'emote', who: 'actor', mood: 'shy' }, { op: 'topic', id: 'gossip' }])).errors).toEqual([])
  })

  it('but is never harmed, and never changes the story', () => {
    expect(check(rule('patch/hurt', [{ op: 'damage', of: 'actor', amount: 5 }])).errors.join()).toContain('may not harm a person')
    expect(check(rule('patch/story', [{ op: 'setFact', key: 'ford.crossed', value: 1 }])).errors.join()).toContain("story's fact")
    // the player's own patches keep today's limits
    expect(check(rule('patch/hurt2', [{ op: 'damage', of: 'actor', amount: 5 }]), false).errors).toEqual([])
  })
})
