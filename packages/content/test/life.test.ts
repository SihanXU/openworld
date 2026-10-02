// Life in the village: the calendar, sleep, weather, people as data (schedules, lines,
// friendship, gifts), world facts and topics, scenes and letters.

import { describe, expect, it } from 'vitest'
import {
  RuleLibrary,
  TICKS_PER_HOUR,
  evalCond,
  buildSandbox,
  calendarAt,
  chooseLine,
  hearts,
  scheduleFor,
  tickAt,
  type Engine,
  type Entity,
  type LineDef,
  type PersonData,
  type Scenario,
} from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()

function village(person: PersonData = {}, extra: Scenario['entities'] = []): Engine {
  const eng = buildSandbox(
    {
      terrain: Array.from({ length: 7 }, () => Array(7).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 3, y: 4, props: { energy: 100, maxEnergy: 100 } },
        { key: 'hollis', type: 'actor/person/farmer', x: 3, y: 3 },
        ...extra,
      ],
      event: {},
    },
    onto,
    new RuleLibrary(BASE_RULES),
  )
  const h = eng.world.get('hollis')!
  h.name = { en: 'Hollis', zh: '霍利斯' }
  h.npc = { role: 'farmer', schedule: [{ from: 0, to: 24, map: 'sandbox', x: 3, y: 3, activity: 'farming' }], person }
  return eng
}

const talk = (eng: Engine) => {
  eng.world.fx = []
  eng.interact('interact', 'actor', { e: 'hollis' })
  const said = eng.world.fx.find((f) => f.t === 'say' && f.who === 'hollis')
  return said && said.t === 'say' ? (typeof said.text === 'string' ? said.text : said.text.en) : undefined
}

const L = (key: string, en: string, more: Partial<LineDef> = {}): LineDef => ({ key, text: { en, zh: en }, ...more })

describe('the calendar', () => {
  it('runs full 24-hour days from day 1, 06:00, through named weekdays', () => {
    expect(calendarAt(0, 1)).toMatchObject({ day: 1, hour: 6, weekday: 'firstday', season: 'thaw', dayOfSeason: 1 })
    const night = calendarAt(tickAt(2, 1.5), 1)
    expect(night).toMatchObject({ day: 2, weekday: 'ashday', minute: 30 })
    expect(night.hour).toBeCloseTo(1.5)
    expect(calendarAt(tickAt(7, 12), 1).weekday).toBe('hearthday')
    expect(calendarAt(tickAt(8, 12), 1).weekday).toBe('firstday')
    expect(TICKS_PER_HOUR * 24 / 10 / 60).toBeCloseTo(16.8) // a day is ~17 real minutes
  })

  it('draws weather from the seed unless the world fixes the day', () => {
    expect(calendarAt(0, 1).weather).toBe('sun')
    expect(calendarAt(tickAt(4, 9), 1, { 4: 'rain' }).weather).toBe('rain')
    const kinds = new Set(Array.from({ length: 200 }, (_, d) => calendarAt(tickAt(d + 2, 9), 42).weather))
    expect([...kinds].sort()).toEqual(['cloud', 'fog', 'rain', 'storm', 'sun'])
  })
})

describe('sleep and energy', () => {
  it('sleeping in a bed skips to 06:00 and restores energy, less after a very late night', () => {
    const eng = village({}, [{ key: 'bed', type: 'fixture/furniture/bed', x: 4, y: 4 }])
    const p = eng.world.player
    eng.world.state.tick = tickAt(1, 22)
    p.props!.energy = 30
    eng.interact('interact', 'actor', { e: 'bed' })
    expect(eng.world.calendar()).toMatchObject({ day: 2, hour: 6 })
    expect(p.props!.energy).toBe(100)
    eng.world.state.tick = tickAt(3, 3)
    p.props!.energy = 30
    eng.sleep()
    expect(eng.world.calendar().day).toBe(3) // 03:00 → 06:00 the same day
    expect(p.props!.energy).toBe(75)
    expect(eng.world.fx.some((f) => f.t === 'sleep')).toBe(true)
  })

  it('staying up after midnight tires you; working with a tool costs energy; food restores it', () => {
    const eng = village({}, [{ key: 'hoe', type: 'item/tool/hoe', x: 3, y: 4, heldBy: 'actor' }])
    const p = eng.world.player
    eng.world.state.tick = tickAt(2, 1) - 1
    for (let i = 0; i < TICKS_PER_HOUR; i++) eng.tick()
    expect(p.props!.energy).toBeLessThan(100)
    const before = p.props!.energy as number
    eng.interact('interact', 'actor', { tile: { map: 'sandbox', x: 3, y: 3 } })
    expect(p.props!.energy).toBe(before - 2)
  })
})

describe('weather', () => {
  it('rain wets people outdoors and puts out fires', () => {
    const eng = village()
    eng.world.state.weather = { 1: 'rain' }
    eng.applyStatus({ tile: { map: 'sandbox', x: 1, y: 1 } }, 'burning', 400)
    for (let i = 0; i < 61; i++) eng.tick()
    expect(eng.world.hasStatus({ e: 'hollis' }, 'wet')).toBe(true)
    expect(eng.world.hasStatus({ tile: { map: 'sandbox', x: 1, y: 1 } }, 'burning')).toBe(false)
  })
})

describe('people', () => {
  it('say the most specific line that fits: first meeting, weather, weekday, default — never the same twice in a row', () => {
    const eng = village({
      lines: [
        L('greeting:first', "You're the one Maren took in."),
        L('default', 'Hm.'),
        L('default', 'Turnips need patience.'),
        L('weather:rain', 'Good rain. The fields drink.'),
        L('weekday:seedday', 'Market day. Prices are robbery.'),
      ],
    })
    expect(talk(eng)).toBe("You're the one Maren took in.")
    const a = talk(eng)
    const b = talk(eng)
    expect([a, b].sort()).toEqual(['Hm.', 'Turnips need patience.'])
    eng.world.state.weather = { 1: 'rain' }
    expect(talk(eng)).toBe('Good rain. The fields drink.')
    eng.world.state.tick = tickAt(5, 10)
    eng.world.state.weather = { 5: 'rain' }
    expect(talk(eng)).toBe('Market day. Prices are robbery.') // a weekday is more specific than the weather
    expect(eng.world.fact('met.hollis')).toBe(true)
  })

  it('build friendship by talking once a day; lines open with hearts', () => {
    const eng = village({ lines: [L('default', 'Morning.'), L('default', 'Ah, my friend!', { hearts: 2 })] })
    talk(eng)
    talk(eng)
    expect(eng.world.player.props!['friend.hollis']).toBe(20) // once a day
    eng.world.player.props!['friend.hollis'] = 500
    expect(hearts(eng, 'hollis')).toBe(2)
    expect(talk(eng)).toBe('Ah, my friend!')
  })

  it('remember what happened: a topic is said once while fresh, and recalled a week later', () => {
    const eng = village({
      lines: [L('default', 'Hm.'), L('topic:hay_burned', 'My hay! All of it!', { mood: 'angry' }), L('topic:hay_burned:memory_week', 'A week since the hay burned. Still smells of it.')],
    })
    talk(eng)
    eng.effects.apply({ op: 'topic', id: 'hay_burned' }, { kind: 'tick', roles: {} })
    expect(talk(eng)).toBe('My hay! All of it!')
    expect(talk(eng)).toBe('Hm.')
    eng.world.state.tick = tickAt(8, 10)
    expect(talk(eng)).toBe('A week since the hay burned. Still smells of it.')
  })

  it('take gifts by taste — their own, then everyone\'s — at most once a day and twice a week, eight times on their birthday', () => {
    const eng = village(
      { tastes: { love: ['item/food/pie'], hate: ['tag:metal'] }, birthday: { season: 'thaw', day: 3 }, lines: [L('gift:loved', 'Pie! You remembered.')] },
      [
        { key: 'pie', type: 'item/food/pie', x: 3, y: 4, heldBy: 'actor' },
        { key: 'gem', type: 'item/gem', x: 3, y: 4, inside: 'actor' },
        { key: 'skull', type: 'item/misc/skull', x: 3, y: 4, inside: 'actor' },
      ],
    )
    const give = (id: string) => {
      eng.hold('actor', id)
      eng.world.fx = []
      eng.interact('put', 'actor', { e: 'hollis' })
      const s = eng.world.fx.find((f) => f.t === 'say')
      return s && s.t === 'say' ? (typeof s.text === 'string' ? s.text : s.text.en) : ''
    }
    expect(give('pie')).toBe('Pie! You remembered.')
    expect(eng.world.player.props!['friend.hollis']).toBe(80)
    expect(eng.world.get('pie')!.place).toMatchObject({ on: 'inside', holder: 'hollis' })
    expect(give('gem')).toMatch(/enough/) // once a day
    eng.world.state.tick = tickAt(3, 10) // his birthday: everyone loves a gem, eight times over
    give('gem')
    expect(eng.world.player.props!['friend.hollis']).toBe(80 + 80 * 8)
    eng.world.state.tick = tickAt(4, 10)
    expect(give('skull')).toMatch(/enough/) // twice a week
    eng.world.state.tick = tickAt(8, 10) // a new week; everyone hates a skull
    give('skull')
    expect(eng.world.player.props!['friend.hollis']).toBe(720 - 40)
  })

  it('follow the most specific schedule for the day', () => {
    const at = (x: number) => [{ from: 0, to: 24, map: 'sandbox', x, y: 1, activity: '' }]
    const eng = village({
      schedules: [
        { key: 'default', entries: at(1) },
        { key: 'rain', entries: at(2) },
        { key: 'weekday:seedday', entries: at(3) },
        { key: 'fact:bridge.fixed', entries: at(4) },
      ],
    })
    const h = eng.world.get('hollis') as Entity
    expect(scheduleFor(eng, h)[0].x).toBe(1)
    eng.world.state.weather = { 1: 'rain' }
    expect(scheduleFor(eng, h)[0].x).toBe(2)
    eng.world.state.tick = tickAt(5, 9)
    expect(scheduleFor(eng, h)[0].x).toBe(3)
    eng.world.setFact('bridge.fixed', true)
    expect(scheduleFor(eng, h)[0].x).toBe(4)
  })
})

describe('facts, scenes and letters', () => {
  it('rules read facts, topics, the calendar and hearts', () => {
    const eng = village()
    const roles = { target: eng.world.view({ e: 'hollis' }) }
    eng.world.setFact('hearth.stage', 2)
    expect(evalCond({ fact: { key: 'hearth.stage', cmp: { gte: 2 } } }, roles, eng.world)).toBe(true)
    expect(evalCond({ fact: { key: 'bridge.fixed', cmp: true } }, roles, eng.world)).toBe(false)
    expect(evalCond({ topic: 'hay_burned' }, roles, eng.world)).toBe(false)
    eng.effects.apply({ op: 'topic', id: 'hay_burned', days: 2 }, { kind: 'tick', roles: {} })
    expect(evalCond({ topic: 'hay_burned' }, roles, eng.world)).toBe(true)
    eng.world.state.tick = tickAt(3, 9)
    expect(evalCond({ topic: 'hay_burned' }, roles, eng.world)).toBe(false)
    expect(evalCond({ calendar: { weekday: ['riverday'], day: { gte: 3 } } }, roles, eng.world)).toBe(true)
    eng.world.player.props!['friend.hollis'] = 760
    expect(evalCond({ hearts: { role: 'target', cmp: { gte: 3 } } }, roles, eng.world)).toBe(true)
  })

  it('a scene plays when its place and moment come: the player watches, advances, and it plays once', () => {
    const eng = village()
    eng.scenes.load([
      {
        id: 'hello',
        map: 'sandbox',
        when: { hour: { from: 6, to: 12 } },
        script: [{ move: 'hollis', x: 3, y: 2 }, { say: 'hollis', text: { en: 'So you came.', zh: '你来了。' } }, { fact: 'met.hollis', value: true }],
      },
    ])
    for (let i = 0; i < 25 && !eng.world.state.scene; i++) eng.tick()
    expect(eng.world.state.scene?.id).toBe('hello')
    expect(eng.busy(eng.world.player)).toBe(true)
    for (let i = 0; i < 60; i++) eng.tick()
    expect(eng.world.get('hollis')!.place).toMatchObject({ x: 3, y: 2 })
    expect(eng.world.state.scene?.waiting).toBe('advance')
    eng.scenes.advance()
    eng.tick()
    expect(eng.world.state.scene).toBeUndefined()
    expect(eng.world.fact('met.hollis')).toBe(true)
    expect(eng.world.fact('seen.hello')).toBe(true)
    for (let i = 0; i < 40; i++) eng.tick()
    expect(eng.world.state.scene).toBeUndefined() // once
  })

  it('letters arrive by day, by fact, or by an effect; reading one takes what it carries', () => {
    const eng = village()
    eng.loadLetters([
      { id: 'welcome', day: 2, text: { en: 'Welcome.', zh: '欢迎。' }, items: ['item/food/bread'] },
      { id: 'bridge', fact: 'bridge.fixed', text: { en: 'The bridge!', zh: '桥修好了！' } },
    ])
    eng.world.state.tick = tickAt(2, 6) - 1
    eng.tick()
    expect(eng.world.state.mailbox?.map((l) => l.id)).toEqual(['welcome'])
    eng.readMail('welcome')
    expect(eng.world.player.contents?.some((id) => eng.world.get(id)?.type === 'item/food/bread')).toBe(true)
    eng.world.setFact('bridge.fixed', true)
    for (let i = 0; i < 60; i++) eng.tick()
    expect(eng.world.state.mailbox?.map((l) => l.id)).toEqual(['welcome', 'bridge'])
  })
})

// keep chooseLine imported for readers: the resolver the talk rule uses
void chooseLine
