import { describe, expect, it } from 'vitest'
import {
  ModPort,
  RuleLibrary,
  buildSandbox,
  checkExpectations,
  compareSpec,
  patternsOverlap,
  replay,
  specOf,
  validatePatch,
  type Patch,
  type Scenario,
} from '@lsw/engine'
import { BASE_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary(BASE_RULES)
/** A provider still at work: the request stays pending until a patch or the time-out. */
const working = { resolve: () => new Promise<null>(() => {}) }
const field = (rows: string[]) => rows.map((r) => r.split('').map((c) => ({ '.': 'grass', ',': 'drygrass', '~': 'water', '#': 'cobble' })[c]!))

describe('base library', () => {
  it('has unique ids and only known references', () => {
    const ids = new Set<string>()
    for (const r of BASE_RULES) {
      expect(ids.has(r.id), r.id).toBe(false)
      ids.add(r.id)
    }
    // every base rule passes the same validator patches go through (minus the "exists" check)
    const res = validatePatch({ artifacts: BASE_RULES.map((r) => ({ kind: 'rule' as const, rule: r })) }, { ontology: onto, library: new RuleLibrary() })
    // (the base library's generic answers — put down, examine — are deliberately broad; patches may not be)
    expect(res.errors.filter((e) => !e.includes('conflicts') && !e.includes('too broad'))).toEqual([])
  })

  it('has no ties: overlapping base rules never share the same specificity', () => {
    const ties: string[] = []
    for (let i = 0; i < BASE_RULES.length; i++)
      for (let j = i + 1; j < BASE_RULES.length; j++) {
        const a = BASE_RULES[i]
        const b = BASE_RULES[j]
        if (a.on !== b.on || a.compose || b.compose) continue
        if (compareSpec(specOf(a), specOf(b)) !== 0) continue
        if (patternsOverlap(a, b, onto)) ties.push(`${a.id} ~ ${b.id}`)
      }
    expect(ties).toEqual([])
  })

  it('tells apart patterns that need incompatible property values', () => {
    const r = (props: Record<string, object | number>) => ({ id: 'x', on: 'interaction' as const, when: { target: { type: 'fixture', props } }, do: [] })
    expect(patternsOverlap(r({ planks: 2 }), r({ planks: 3 }), onto)).toBe(false)
    expect(patternsOverlap(r({ planks: { lt: 4 } }), r({ planks: { gte: 4 } }), onto)).toBe(false)
    expect(patternsOverlap(r({ planks: { lt: 4 } }), r({ planks: 3 }), onto)).toBe(true)
    expect(patternsOverlap(r({ planks: { gt: 1 } }), r({ planks: { lte: 2 } }), onto)).toBe(true)
  })

  it('orders by specificity: subtype beats supertype, more constraints beat fewer', () => {
    const general = specOf({ id: 'a', on: 'interaction', when: { target: { type: 'actor' } }, do: [] })
    const sub = specOf({ id: 'b', on: 'interaction', when: { target: { type: 'actor/person' } }, do: [] })
    const inst = specOf({ id: 'c', on: 'interaction', when: { target: { id: 'x' } }, do: [] })
    expect(compareSpec(sub, general)).toBeGreaterThan(0)
    expect(compareSpec(inst, sub)).toBeGreaterThan(0)
  })
})

describe('interactions', () => {
  it('douses a burning tile with a water bucket (put) and empties the bucket', () => {
    const sc: Scenario = {
      terrain: field(['...', '.,.', '...']),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 1, y: 2 },
        { key: 'bucket', type: 'item/vessel/bucket/water', x: 1, y: 2, heldBy: 'actor' },
      ],
      event: { verb: 'put', actor: 'actor', target: 'tile:1,1', instrument: 'bucket' },
    }
    const eng = buildSandbox(sc, onto, lib())
    eng.world.setStatus({ tile: { map: 'sandbox', x: 1, y: 1 } }, 'burning', 999)
    const r = replayWith(eng, sc)
    expect(r.rule?.id).toBe('core/douse')
    expect(eng.world.hasStatus({ tile: { map: 'sandbox', x: 1, y: 1 } }, 'burning')).toBe(false)
    expect(eng.world.hasStatus({ tile: { map: 'sandbox', x: 1, y: 1 } }, 'wet')).toBe(true)
    expect(eng.world.get('bucket')!.type).toBe('item/vessel/bucket/empty')
  })

  it('fills an empty flask at a well, then drinks it', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'flask', type: 'item/vessel/flask/empty', x: 2, y: 2, heldBy: 'actor' },
        { key: 'well', type: 'fixture/water/well', x: 2, y: 1 },
      ],
      event: { verb: 'interact', actor: 'actor', target: 'well', instrument: 'flask' },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.resolution.rule?.id).toBe('core/fill-water')
    expect(rp.engine.world.get('flask')!.type).toBe('item/vessel/flask/water')
  })

  it('cooks raw fish on a lit campfire', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'fish', type: 'item/food/fish/raw', x: 2, y: 2, heldBy: 'actor' },
        { key: 'fire', type: 'fixture/light/campfire', x: 2, y: 1, statuses: ['lit'] },
      ],
      event: { verb: 'put', actor: 'actor', target: 'fire', instrument: 'fish' },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.resolution.rule?.id).toBe('core/cook')
    expect(rp.engine.world.get('fish')!.type).toBe('item/food/fish/cooked')
  })

  it('takes an item into the hand, then puts it into an open chest', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'apple', type: 'item/food/apple', x: 2, y: 1 },
        { key: 'chest', type: 'fixture/container/chest', x: 3, y: 2, statuses: ['open'] },
      ],
      event: { verb: 'take', actor: 'actor', target: 'apple' },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.engine.world.get('actor')!.held).toBe('apple')
    const eng = rp.engine
    eng.queue({ kind: 'interaction', verb: 'put', roles: { actor: { e: 'actor' }, target: { e: 'chest' }, instrument: { e: 'apple' } } })
    expect(eng.world.get('chest')!.contents).toContain('apple')
    expect(eng.world.get('actor')!.held).toBeUndefined()
  })

  it('leaves genuinely new combinations undefined', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
        { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
      ],
      event: { verb: 'interact', actor: 'actor', target: 'slime', instrument: 'rope' },
    }
    expect(replay(sc, onto, lib()).resolution.defined).toBe(false)
  })
})

describe('fire and elements', () => {
  it('fire spreads across dry grass and burns out to ash', () => {
    const sc: Scenario = {
      terrain: field([',,,,,,,', ',,,,,,,', ',,,,,,,', '#######']),
      entities: [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }],
      event: { kind: 'hit', actor: 'actor', target: 'tile:3,1', element: 'fire', power: 3 },
      ticks: 400,
    }
    const rp = replay(sc, onto, lib())
    const w = rp.engine.world
    let ash = 0
    for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) if (w.terrainAt('sandbox', x, y) === 'ash') ash++
    expect(ash).toBeGreaterThan(8)
    expect(w.terrainAt('sandbox', 3, 3)).toBe('cobble') // stone does not burn
  })

  it('vaporize: fire on a wet creature removes wet and does not set it burning', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 3 },
        { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 2, statuses: ['wet'] },
      ],
      event: { kind: 'hit', actor: 'actor', target: 'slime', element: 'fire', power: 3 },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.resolution.rule?.id).toBe('element/vaporize')
    expect(checkExpectations(rp.engine, [{ key: 'slime', lacksStatus: 'wet' }, { key: 'slime', lacksStatus: 'burning' }])).toEqual([])
  })

  it('freeze: ice on a wet creature immobilizes it', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 3 },
        { key: 'wolf', type: 'actor/creature/beast/wolf', x: 2, y: 2, statuses: ['wet'] },
      ],
      event: { kind: 'hit', actor: 'actor', target: 'wolf', element: 'ice', power: 2 },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.engine.world.hasStatus({ e: 'wolf' }, 'frozen')).toBe(true)
    expect(rp.engine.busy(rp.engine.world.get('wolf')!)).toBe(true)
  })

  it('conduct: lightning arcs through wet neighbours and terminates', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 4 },
        { key: 'a', type: 'actor/creature/slime/green_slime', x: 2, y: 2, statuses: ['wet'] },
        { key: 'b', type: 'actor/creature/slime/green_slime', x: 3, y: 2, statuses: ['wet'] },
        { key: 'c', type: 'actor/creature/slime/green_slime', x: 4, y: 2, statuses: ['wet'] },
        { key: 'dry', type: 'actor/creature/slime/green_slime', x: 2, y: 3 },
      ],
      terrain: field(['.....', '.....', '.....', '.....', '.....']),
      event: { kind: 'hit', actor: 'actor', target: 'a', element: 'lightning', power: 3 },
    }
    const rp = replay(sc, onto, lib())
    const w = rp.engine.world
    for (const k of ['a', 'b', 'c']) expect(w.hasStatus({ e: k }, 'wet'), k).toBe(false)
    const c = w.get('c')
    expect(!c || w.num(c, 'hp') < 9).toBe(true) // reached by the arc (possibly killed)
    expect(w.num(w.get('dry')!, 'hp')).toBe(9)
    expect(rp.errors).toEqual([])
  })

  it('ice turns water into walkable ice', () => {
    const sc: Scenario = {
      terrain: field(['.....', '.~~~.', '.~~~.', '.....']),
      entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 3 }],
      event: { kind: 'hit', actor: 'actor', target: 'tile:2,2', element: 'ice', power: 3 },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.engine.world.terrainAt('sandbox', 2, 2)).toBe('ice')
    expect(rp.engine.world.walkable('sandbox', 2, 2)).toBe(true)
  })

  it('oil + fire explodes', () => {
    const sc: Scenario = {
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 4 },
        { key: 'boar', type: 'actor/creature/beast/boar', x: 2, y: 2, statuses: ['oiled'] },
      ],
      event: { kind: 'hit', actor: 'actor', target: 'boar', element: 'fire', power: 4 },
    }
    const rp = replay(sc, onto, lib())
    expect(rp.resolution.rule?.id).toBe('element/explode-oil')
  })
})

describe('the Mod port', () => {
  const ropeScenario = (): Scenario => ({
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
      { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
    ],
    event: { verb: 'interact', actor: 'actor', target: 'slime', instrument: 'rope' },
  })
  const tiePatch = (): Patch => ({
    author: 'test',
    artifacts: [
      {
        kind: 'rule',
        rule: {
          id: 'patch/rope-binds-creature',
          on: 'interaction',
          when: { verb: ['interact', 'put'], instrument: { tags: ['fiber'] }, target: { type: 'actor/creature', notStatus: ['frozen'] } },
          do: [
            { op: 'addStatus', of: 'target', status: 'frozen', duration: 30 },
            { op: 'destroy', of: 'instrument' },
            { op: 'vfx', at: 'target', fx: 'dust' },
            { op: 'log', text: { en: 'You lash {target} down with the rope.', zh: '你用绳子捆住了{target}。' } },
          ],
          tests: [
            {
              name: 'rope binds a wolf',
              given: {
                entities: [
                  { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
                  { key: 'r', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
                  { key: 'w', type: 'actor/creature/beast/wolf', x: 2, y: 1 },
                ],
                event: { verb: 'interact', actor: 'actor', target: 'w', instrument: 'r' },
              },
              expect: [{ key: 'w', hasStatus: 'frozen' }, { key: 'r', destroyed: true }],
            },
          ],
        },
      },
    ],
  })

  it('raises an undefined interaction, freezes the target, and applies a valid patch', () => {
    const eng = buildSandbox(ropeScenario(), onto, lib())
    const port = new ModPort(eng)
    port.provider = working
    const res = eng.interact('interact', 'actor', { e: 'slime' })
    expect(res.defined).toBe(false)
    expect(port.records).toHaveLength(1)
    const rec = port.records[0]
    expect(rec.status).toBe('pending')
    expect(eng.world.get('slime')!.frozenBy).toBe(rec.id)
    expect(rec.request.event.instrument?.tags).toContain('fiber')
    // the spec is self-describing
    const spec = port.spec()
    expect(spec.primitives.spread).toBeTruthy()
    expect(spec.ontology.statuses.map((s) => s.id)).toContain('frozen')

    const v = port.submit(rec.id, tiePatch())
    expect(v.errors).toEqual([])
    expect(v.ok).toBe(true)
    expect(rec.status).toBe('patched')
    expect(eng.lib.rules.get('patch/rope-binds-creature')?.source?.origin).toBe('patch')
    // re-resolved: the slime is now bound and the rope consumed
    expect(eng.world.hasStatus({ e: 'slime' }, 'frozen')).toBe(true)
    expect(eng.world.get('rope')).toBeUndefined()
    expect(eng.world.get('slime')!.frozenBy).toBeUndefined()
  })

  it('falls back after the timeout and still accepts a late patch', () => {
    const eng = buildSandbox(ropeScenario(), onto, lib())
    const port = new ModPort(eng)
    port.provider = working
    eng.interact('interact', 'actor', { e: 'slime' })
    for (let i = 0; i < 120; i++) eng.tick()
    expect(port.records[0].status).toBe('fallback')
    expect(eng.world.get('slime')?.frozenBy).toBeUndefined()
    expect(port.submit(port.records[0].id, tiePatch()).ok).toBe(true)
    expect(eng.lib.rules.has('patch/rope-binds-creature')).toBe(true)
  })

  it('asks about one class of interaction once at a time, and not forever', () => {
    const eng = buildSandbox(ropeScenario(), onto, lib())
    const port = new ModPort(eng)
    eng.interact('interact', 'actor', { e: 'slime' })
    expect(port.records).toHaveLength(1)
    // while the question is open, the same action does not ask again
    for (let i = 0; i < 120; i++) eng.tick()
    expect(port.records[0].status).toBe('fallback')
    // unanswered: asked once more, then the class simply does nothing this session
    eng.interact('interact', 'actor', { e: 'slime' })
    for (let i = 0; i < 120; i++) eng.tick()
    eng.interact('interact', 'actor', { e: 'slime' })
    expect(port.records).toHaveLength(2)
    // a late patch for either record still teaches the world
    expect(port.submit(port.records[1].id, tiePatch()).ok).toBe(true)
    expect(port.records[1].status).toBe('patched')
    expect(eng.lib.rules.has('patch/rope-binds-creature')).toBe(true)
  })

  it('a dismissed question is not asked again', () => {
    const eng = buildSandbox(ropeScenario(), onto, lib())
    const port = new ModPort(eng)
    eng.interact('interact', 'actor', { e: 'slime' })
    port.dismiss(port.records[0].id)
    eng.interact('interact', 'actor', { e: 'slime' })
    expect(port.records).toHaveLength(1)
  })

  it('rejects unknown statuses, failing tests, and equal-specificity conflicts', () => {
    const base = tiePatch()
    const bad1 = structuredClone(base)
    ;(bad1.artifacts[0] as { rule: { do: unknown[] } }).rule.do = [{ op: 'addStatus', of: 'target', status: 'hogtied' }]
    const r1 = validatePatch(bad1, { ontology: onto, library: lib() })
    expect(r1.ok).toBe(false)
    expect(r1.errors.join()).toMatch(/unknown status "hogtied"/)

    const bad2 = structuredClone(base)
    ;(bad2.artifacts[0] as { rule: { do: unknown[] } }).rule.do = [{ op: 'vfx', at: 'target', fx: 'dust' }]
    const r2 = validatePatch(bad2, { ontology: onto, library: lib() })
    expect(r2.ok).toBe(false)
    expect(r2.errors.join()).toMatch(/lacks status frozen/)

    const bad3: Patch = {
      artifacts: [{ kind: 'rule', rule: { ...BASE_RULES.find((r) => r.id === 'core/talk')!, id: 'patch/talk-2', do: [{ op: 'log', text: 'hi' }] } }],
    }
    const r3 = validatePatch(bad3, { ontology: onto, library: lib() })
    expect(r3.errors.join()).toMatch(/conflicts with "core\/talk"/)
  })

  it('rejects a patch whose rule does not cover the triggering interaction', () => {
    const eng = buildSandbox(ropeScenario(), onto, lib())
    const port = new ModPort(eng)
    eng.interact('interact', 'actor', { e: 'slime' })
    const p = tiePatch()
    ;(p.artifacts[0] as { rule: { when: { target: unknown } } }).rule.when.target = { type: 'actor/creature/beast' }
    const v = port.submit(port.records[0].id, p)
    expect(v.ok).toBe(false)
    expect(v.errors.join()).toMatch(/still undefined/)
  })
})

describe('determinism & persistence', () => {
  it('replays identically from the same seed', () => {
    const run = () => {
      const sc: Scenario = {
        terrain: field([',,,,,', ',,,,,', ',,,,,']),
        entities: [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0 }],
        event: { kind: 'hit', actor: 'actor', target: 'tile:2,1', element: 'fire', power: 3 },
        ticks: 120,
      }
      return JSON.stringify(replay(sc, onto, lib()).engine.world.state)
    }
    expect(run()).toBe(run())
  })

  it('round-trips the rule library through JSON', () => {
    const l = lib()
    l.add({ id: 'patch/x', on: 'interaction', when: { verb: ['take'], target: { type: 'actor/creature' } }, do: [{ op: 'log', text: 'x' }], source: { origin: 'patch' } })
    const back = RuleLibrary.fromJSON(JSON.parse(JSON.stringify(l.toJSON())))
    expect(back.rules.size).toBe(l.rules.size)
    expect(back.patches().map((r) => r.id)).toEqual(['patch/x'])
    expect(back.version).toBe(l.version)
  })
})

function replayWith(eng: ReturnType<typeof buildSandbox>, sc: Scenario) {
  const ev = {
    kind: 'interaction' as const,
    verb: sc.event.verb,
    roles: {
      actor: { e: sc.event.actor! },
      target: sc.event.target!.startsWith('tile:')
        ? { tile: { map: 'sandbox', x: +sc.event.target!.slice(5).split(',')[0], y: +sc.event.target!.slice(5).split(',')[1] } }
        : { e: sc.event.target! },
      instrument: sc.event.instrument ? { e: sc.event.instrument } : undefined,
    },
  }
  const r = eng.resolve(ev)
  eng.queue(ev)
  return r
}

describe('text', () => {
  it('names roles as they were when the rule started, even after it destroyed one', () => {
    const rule = {
      id: 'patch/test-pour-out',
      on: 'interaction' as const,
      when: { verb: ['interact' as const], instrument: { tags: ['fiber'] }, target: { type: 'actor/creature' } },
      do: [
        { op: 'destroy' as const, of: 'instrument' as const },
        { op: 'log' as const, text: { en: 'The {target} eats the {instrument}.', zh: '{target}吃掉了{instrument}。' } },
      ],
    }
    const eng = buildSandbox(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' },
          { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 },
        ],
        event: {},
      },
      onto,
      new RuleLibrary([...BASE_RULES, rule]),
    )
    eng.interact('interact', 'actor', { e: 'slime' })
    const line = eng.world.fx.find((f) => f.t === 'log' && typeof f.text === 'object' && f.text.en.startsWith('The '))
    expect(line && line.t === 'log' && typeof line.text === 'object' && line.text.en).toBe('The green slime eats the Rope.')
  })
})
