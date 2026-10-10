// The base rule library under the event model (design.md §5.6–5.11): every rule belongs to a
// host and answers one event kind; effects write only the host and impulses carry everything
// else; the roots make resolution total; the Mod port fills holes and nothing else.

import { describe, expect, it } from 'vitest'
import {
  EVENT_KINDS,
  ModPort,
  RuleLibrary,
  buildSandbox,
  checkExpectations,
  compareSpec,
  holeKey,
  hostsOverlap,
  isRoot,
  kindCovers,
  leaves,
  replay,
  specOf,
  validatePatch,
  type Engine,
  type Patch,
  type Cond,
  type Rule,
  type Scenario,
  type ScenarioEntity,
  type Selector,
  type Tree,
} from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '../src/index.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary(BASE_RULES)
/** A provider still at work: the request stays pending until a patch or the time-out. */
const working = { resolve: () => new Promise<null>(() => {}) }
const field = (rows: string[]) => rows.map((r) => r.split('').map((c) => ({ '.': 'grass', ',': 'drygrass', '~': 'water', '#': 'cobble' })[c]!))
/** A cell of the sandbox: what makes it up on top (world-model.md §4.6). */
const cellOf = (eng: Engine, x: number, y: number) => eng.world.cellRef('sandbox', x, y)
/** A sandbox in strict mode: any change of state outside an outcome throws (design.md §5.13, A2). */
const sandbox = (sc: Scenario, l = lib()): Engine => {
  const eng = buildSandbox(sc, onto, l)
  return eng
}
/** The rules that answered the events an act started, in order. */
const chain = (eng: Engine, f: () => void): (string | undefined)[] => {
  eng.trace = []
  f()
  return eng.trace.map((t) => t.rule)
}
/** The key of the base hole an event falls into (design.md §5.16): where a learned answer is placed. */
const holeOf = (eng: Engine, ev: Parameters<Engine['resolveEvent']>[0]): string => {
  const res = eng.resolveEvent(ev)
  if (!res.hole) throw new Error(`${ev.kind} is defined by ${res.rule?.id}`)
  return holeKey(res.hole.rule.id, res.hole.path)
}

/**
 * Ties (design.md §5.6): two rules on the same kind, equally specific, whose hosts overlap and
 * whose trees could both answer one event. A tree answers in regions: the conjunction of the
 * conditions on the way to each leaf that is not `inherit`. Two regions exclude each other when
 * they need different values of one param, or roles that no one thing could fill (conditions
 * that are not plain conjunctions are taken as possibly true).
 */
function ties(rules: Rule[]): string[] {
  type Atom = Cond
  const regions = (t: Tree, acc: Atom[] = []): Atom[][] => {
    if (t === 'inherit') return []
    if (!('if' in t)) return [acc]
    const atoms = (c: Cond): Atom[] => ('all' in c ? c.all.flatMap(atoms) : [c])
    return [...regions(t.then, [...acc, ...atoms(t.if)]), ...regions(t.else ?? 'inherit', acc)]
  }
  const sels = (as: Atom[]) => {
    const by = new Map<string, Selector[]>()
    const add = (role: string, s: Selector) => by.set(role, [...(by.get(role) ?? []), s])
    for (const a of as) {
      if ('is' in a) add(a.is.role, a.is.sel)
      if ('has' in a) add(a.has.role, { ...(a.has.tag && { tags: [a.has.tag] }), ...(a.has.status && { status: [a.has.status] }) })
    }
    return by
  }
  const params = (as: Atom[]) => new Map(as.flatMap((a) => ('param' in a && typeof a.param.cmp !== 'object' ? [[a.param.key, a.param.cmp] as const] : [])))
  const nones = (as: Atom[]) => new Set(as.flatMap((a) => ('none' in a ? [a.none] : [])))
  const compatible = (x: Atom[], y: Atom[]) => {
    const [px, py] = [params(x), params(y)]
    for (const [k, v] of px) if (py.has(k) && py.get(k) !== v) return false
    const [sx, sy] = [sels(x), sels(y)]
    const [nx, ny] = [nones(x), nones(y)]
    for (const r of nx) if (sy.has(r)) return false
    for (const r of ny) if (sx.has(r)) return false
    for (const [r, a] of sx) for (const s of a) for (const t of sy.get(r) ?? []) if (!hostsOverlap(s, t, onto)) return false
    return true
  }
  const out: string[] = []
  for (const [i, a] of rules.entries())
    for (const b of rules.slice(i + 1)) {
      if (a.on !== b.on || compareSpec(specOf(a), specOf(b)) !== 0 || !hostsOverlap(a.host ?? {}, b.host ?? {}, onto)) continue
      if (regions(a.tree).some((x) => regions(b.tree).some((y) => compatible(x, y)))) out.push(`${a.id} ~ ${b.id}`)
    }
  return out
}

describe('base library', () => {
  it('has unique ids, and every rule passes the patch validator save for what only the base may do', () => {
    const ids = new Set<string>()
    for (const r of [...BASE_RULES, ...STORY_RULES]) {
      expect(ids.has(r.id), r.id).toBe(false)
      ids.add(r.id)
    }
    // the same validator patches go through: known kinds, impulses, primitives, statuses, types, vfx;
    // effects write only their host (no `of`). Only the base may answer for anything (a root rule)
    // and leave an outcome undefined (a hole the AI fills), and only the base hosts a quest's rules (docs/quests.md).
    const res = validatePatch({ artifacts: [...BASE_RULES, ...STORY_RULES].map((r) => ({ kind: 'rule' as const, rule: r })) }, { ontology: onto, library: new RuleLibrary() })
    // ...and only a learned rule has a place (design.md §5.16): one exact type, one kind, a hole, no inherit; a quest is the content's.
    const placement = /host must be exactly|hole required|exact event kind|never inherits|no leaf answers|no default of its own|a quest is the content/
    expect(res.errors.filter((e) => !placement.test(e))).toEqual([])
  })

  it('the root is total: every kind reaches a root rule, and no root rule inherits', () => {
    const roots = BASE_RULES.filter(isRoot)
    for (const r of roots) expect(leaves(r.tree), r.id).not.toContain('inherit')
    for (const kind of EVENT_KINDS) expect(roots.some((r) => kindCovers(r.on, kind)), kind).toBe(true)
  })

  it('has no ties: two equally specific rules on the same kind never both answer one event', () => {
    expect(ties([...BASE_RULES, ...STORY_RULES])).toEqual([])
  })

  it('tells apart hosts that need incompatible property values', () => {
    const h = (props: Record<string, object | number>) => ({ type: 'fixture/build/frame', props })
    expect(hostsOverlap(h({ planks: 2 }), h({ planks: 3 }), onto)).toBe(false)
    expect(hostsOverlap(h({ planks: { lt: 4 } }), h({ planks: { gte: 4 } }), onto)).toBe(false)
    expect(hostsOverlap(h({ planks: { lt: 4 } }), h({ planks: 3 }), onto)).toBe(true)
    expect(hostsOverlap(h({ planks: { gt: 1 } }), h({ planks: { lte: 2 } }), onto)).toBe(true)
  })

  it('orders by specificity: the host first (instance, then type depth, then constraints), the kind next', () => {
    const r = (id: string, host: Rule['host'], on = 'impulse/strike'): Rule => ({ id, host, on, tree: { do: [] } })
    const general = specOf(r('a', { type: 'actor' }))
    const sub = specOf(r('b', { type: 'actor/person' }))
    const inst = specOf(r('c', { id: 'x' }))
    const tagged = specOf(r('d', { type: 'actor/person', tags: ['essential'] }))
    expect(compareSpec(sub, general)).toBeGreaterThan(0)
    expect(compareSpec(inst, sub)).toBeGreaterThan(0)
    expect(compareSpec(tagged, sub)).toBeGreaterThan(0)
    // a deeper host on a branch beats a shallower host on the exact kind
    expect(compareSpec(specOf(r('e', { type: 'actor/person' }, 'impulse')), specOf(r('f', { type: 'actor' }, 'impulse/strike')))).toBeGreaterThan(0)
    // with the same host, the deeper kind wins
    expect(compareSpec(specOf(r('g', { type: 'actor' }, 'impulse/strike')), specOf(r('h', { type: 'actor' }, 'impulse')))).toBeGreaterThan(0)
  })
})

describe('acts and the impulses they send', () => {
  it('douses a burning tile with a water bucket: the bucket pours, the tile answers the water', () => {
    const eng = sandbox({
      terrain: field(['...', '.,.', '...']),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 1, y: 2 },
        { key: 'bucket', type: 'item/vessel/bucket/water', x: 1, y: 2, heldBy: 'actor' },
      ],
      event: {},
    })
    eng.author(() => eng.applyStatus(cellOf(eng, 1, 1), 'burning', 999))
    const rules = chain(eng, () => expect(eng.act('use', 'actor', cellOf(eng, 1, 1)).rule?.id).toBe('use/water'))
    expect(rules).toContain('core/element')
    expect(eng.world.hasStatus(cellOf(eng, 1, 1), 'burning')).toBe(false)
    expect(eng.world.hasStatus(cellOf(eng, 1, 1), 'wet')).toBe(true)
    expect(eng.world.get('bucket')!.type).toBe('item/vessel/bucket/empty')
  })

  it('fills an empty flask at a well', () => {
    const rp = replay(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'flask', type: 'item/vessel/flask/empty', x: 2, y: 2, heldBy: 'actor' },
          { key: 'well', type: 'fixture/water/well', x: 2, y: 1 },
        ],
        event: { kind: 'act/use', actor: 'actor', target: 'well', instrument: 'flask' },
      },
      onto,
      lib(),
    )
    expect(rp.resolution.rule?.id).toBe('use/fill')
    expect(rp.engine.world.get('flask')!.type).toBe('item/vessel/flask/water')
  })

  it('cooks raw fish on a lit campfire: held over it (use), or put to it (the fire takes it and the fish answers the fire)', () => {
    const sc = (verb: 'use' | 'put'): Scenario => ({
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'fish', type: 'item/food/fish/raw', x: 2, y: 2, heldBy: 'actor' },
        { key: 'fire', type: 'fixture/light/campfire', x: 2, y: 1, statuses: ['lit'] },
      ],
      event: { kind: `act/${verb}`, actor: 'actor', target: 'fire', instrument: 'fish' },
    })
    const used = replay(sc('use'), onto, lib())
    expect(used.resolution.rule?.id).toBe('use/cook')
    expect(used.engine.world.get('fish')!.type).toBe('item/food/fish/cooked')
    const eng = sandbox(sc('put'))
    const rules = chain(eng, () => eng.act('put', 'actor', { e: 'fire' }))
    expect(rules.slice(0, 3)).toEqual(['core/put', 'element/burn-away', 'element/cook'])
    expect(eng.world.get('fish')!.type).toBe('item/food/fish/cooked')
  })

  it('takes an item into the hand (it is taken), then puts it into an open chest (the chest takes it)', () => {
    const eng = sandbox({
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'apple', type: 'item/food/apple', x: 2, y: 1 },
        { key: 'chest', type: 'fixture/container/chest', x: 3, y: 2, statuses: ['open'] },
      ],
      event: {},
    })
    // the act, the impulse it sends, then the contact the new relation makes (held: no change)
    expect(chain(eng, () => eng.act('take', 'actor', { e: 'apple' }, { instrument: null })).slice(0, 2)).toEqual(['core/take', 'core/taken'])
    expect(eng.world.get('actor')!.held).toBe('apple')
    expect(chain(eng, () => eng.act('put', 'actor', { e: 'chest' })).slice(0, 3)).toEqual(['core/put', 'core/receive-store', 'core/taken'])
    expect(eng.world.get('chest')!.contents).toContain('apple')
    expect(eng.world.get('actor')!.held).toBeUndefined()
  })

  it('leaves genuinely new combinations undefined, at the root of the act', () => {
    const rp = replay(
      {
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'stone', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
          { key: 'tree', type: 'fixture/nature/dead_tree', x: 2, y: 1 },
        ],
        event: { kind: 'act/use', actor: 'actor', target: 'tree', instrument: 'stone' },
      },
      onto,
      lib(),
    )
    expect(rp.resolution.defined).toBe(false)
    expect(rp.resolution.hole?.rule.id).toBe('core/use')
  })

  it('a chain may reach a hole further on: the act is defined, its impulse is not', () => {
    const eng = sandbox({
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'rock', type: 'fixture/nature/boulder', x: 2, y: 1 },
      ],
      event: {},
    })
    const p = eng.preview(eng.actEvent('hands', 'actor', { e: 'rock' }))
    expect(p).toMatchObject({ defined: true, unknown: true, rules: ['core/hands', 'core/handle'] })
    expect(p.hole?.res.hole?.rule.id).toBe('core/handle')
  })

  it('a document with something written in it is read in hand; one with nothing written is the world\'s to answer', () => {
    const read = (type: string) =>
      replay({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'doc', type, x: 2, y: 2, heldBy: 'actor' }], event: { kind: 'act/use', actor: 'actor', target: 'actor', instrument: 'doc' } }, onto, lib())
    const almanac = read('item/document/almanac')
    expect(almanac.resolution.rule?.id).toBe('use/read')
    expect(almanac.engine.world.fx.some((f) => f.t === 'log' && JSON.stringify(f.text).includes('stop him'))).toBe(true)
    expect(read('item/document/book').resolution.defined).toBe(false)
  })

  it('a shut door hides what is behind it; an open one is a gap', () => {
    for (const [type, seen] of [['structure/door', false], ['structure/door/open', true]] as const) {
      const eng = sandbox({ terrain: field(['.....', '.....', '.....']), entities: [{ key: 'actor', type: 'actor/person/player', x: 0, y: 1 }, { key: 'door', type, x: 2, y: 1 }], event: {} })
      expect(eng.lineOfSight('sandbox', { map: 'sandbox', x: 0, y: 1 }, { map: 'sandbox', x: 4, y: 1 }), type).toBe(seen)
    }
  })
})

describe('fire and elements', () => {
  const fire = (target: string, element: string, power: number, entities: Scenario['entities'], terrain?: string[][], ticks?: number): Scenario => ({
    terrain,
    entities,
    event: { kind: 'impulse/element', host: target, actor: 'actor', params: { element, power } },
    ticks,
  })

  it('fire spreads across dry grass and burns out to ash; stone does not burn', () => {
    const rp = replay(fire('tile:3,1', 'fire', 3, [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }], field([',,,,,,,', ',,,,,,,', ',,,,,,,', '#######']), 400), onto, lib())
    const w = rp.engine.world
    let ash = 0
    for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) if (w.terrainAt('sandbox', x, y) === 'ash') ash++
    expect(ash).toBeGreaterThan(8)
    expect(w.terrainAt('sandbox', 3, 3)).toBe('cobble')
  })

  it('vaporize: fire on a wet creature dries it (and hurts) and does not set it burning', () => {
    const rp = replay(fire('slime', 'fire', 3, [{ key: 'actor', type: 'actor/person/player', x: 2, y: 3 }, { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 2, statuses: ['wet'] }]), onto, lib())
    expect(rp.resolution.rule?.id).toBe('element/actor')
    expect(checkExpectations(rp.engine, [{ key: 'slime', lacksStatus: 'wet' }, { key: 'slime', lacksStatus: 'burning' }, { key: 'slime', propLt: ['hp', 9] }])).toEqual([])
  })

  it('freeze: ice on a wet creature immobilizes it (the body inherits physics)', () => {
    const rp = replay(fire('wolf', 'ice', 2, [{ key: 'actor', type: 'actor/person/player', x: 2, y: 3 }, { key: 'wolf', type: 'actor/creature/beast/wolf', x: 2, y: 2, statuses: ['wet'] }]), onto, lib())
    expect(rp.resolution.rule?.id).toBe('core/element')
    expect(rp.engine.world.hasStatus({ e: 'wolf' }, 'frozen')).toBe(true)
    expect(rp.engine.busy(rp.engine.world.get('wolf')!)).toBe(true)
  })

  it('conduct: lightning arcs through wet neighbours and terminates', () => {
    const rp = replay(
      fire(
        'a',
        'lightning',
        3,
        [
          { key: 'actor', type: 'actor/person/player', x: 0, y: 4 },
          { key: 'a', type: 'actor/creature/slime/green_slime', x: 2, y: 2, statuses: ['wet'] },
          { key: 'b', type: 'actor/creature/slime/green_slime', x: 3, y: 2, statuses: ['wet'] },
          { key: 'c', type: 'actor/creature/slime/green_slime', x: 4, y: 2, statuses: ['wet'] },
          { key: 'dry', type: 'actor/creature/slime/green_slime', x: 2, y: 3 },
        ],
        field(['.....', '.....', '.....', '.....', '.....']),
      ),
      onto,
      lib(),
    )
    const w = rp.engine.world
    for (const k of ['a', 'b', 'c']) expect(w.hasStatus({ e: k }, 'wet'), k).toBe(false)
    const c = w.get('c')
    expect(!c || w.num(c, 'hp') < 9).toBe(true) // reached by the arc (possibly killed)
    expect(w.num(w.get('dry')!, 'hp')).toBe(9)
    expect(rp.errors).toEqual([])
  })

  it('one frost cast freezes its cell and some beside it, not the whole river', () => {
    const river = field(Array.from({ length: 9 }, () => '~~~~~~~~~'))
    const rp = replay({ ...fire('tile:4,4', 'ice', 2, [{ key: 'actor', type: 'actor/person/player', x: 4, y: 4, props: {} }], river), ticks: 30 }, onto, lib())
    const w = rp.engine.world
    const ice: [number, number][] = []
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (w.terrainAt('sandbox', x, y) === 'ice') ice.push([x, y])
    expect(ice).toContainEqual([4, 4])
    for (const [x, y] of ice) expect(Math.max(Math.abs(x - 4), Math.abs(y - 4)), `${x},${y}`).toBeLessThanOrEqual(1)
  })

  it('ice turns water into walkable ice', () => {
    const rp = replay(fire('tile:2,2', 'ice', 3, [{ key: 'actor', type: 'actor/person/player', x: 2, y: 3 }], field(['.....', '.~~~.', '.~~~.', '.....'])), onto, lib())
    expect(rp.resolution.rule?.id).toBe('element/freeze-water')
    expect(rp.engine.world.terrainAt('sandbox', 2, 2)).toBe('ice')
    expect(rp.engine.world.walkable('sandbox', 2, 2)).toBe(true)
  })

  it('oil + fire explodes, on a thing and on a creature', () => {
    for (const [key, type] of [
      ['barrel', 'fixture/container/barrel'],
      ['boar', 'actor/creature/beast/boar'],
    ]) {
      const rp = replay(fire(key, 'fire', 4, [{ key: 'actor', type: 'actor/person/player', x: 2, y: 4 }, { key, type, x: 2, y: 2, statuses: ['oiled'] }]), onto, lib())
      expect(rp.engine.world.fx.some((f) => f.t === 'vfx' && f.fx === 'explosion'), key).toBe(true)
      expect(rp.engine.world.hasStatus({ e: key }, 'oiled'), key).toBe(false)
    }
  })

  it('a wooden wall burns as any wooden thing: it reaches its neighbours, and one that burns down is ash, not planks', () => {
    const eng = sandbox({
      terrain: field(['.....', '.....', '.....']),
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 2 },
        { key: 'wall', type: 'structure/wall', x: 2, y: 1, statuses: ['burning'], props: { hp: 1 } },
      ],
      event: {},
    })
    const rules = chain(eng, () => {
      for (let i = 0; i < 200 && eng.world.get('wall'); i++) eng.tick()
    })
    expect(rules).toContain('fire/spread-structure')
    expect(rules).toContain('fire/burnt-structure')
    expect(eng.world.get('wall')).toBeUndefined()
    expect(eng.world.placedAt('sandbox', 2, 1).some((e) => e.type === 'item/material/ash')).toBe(true)
    expect(eng.world.placedAt('sandbox', 2, 1).some((e) => e.type === 'item/material/plank')).toBe(false)
  })

  it('something explosive that catches fire goes off: what is round it is struck, and it is gone', () => {
    const rp = replay(
      fire('bomb', 'fire', 2, [
        { key: 'actor', type: 'actor/person/player', x: 0, y: 4 },
        { key: 'bomb', type: 'item/misc/bomb', x: 2, y: 2 },
        { key: 'slime', type: 'actor/creature/slime/green_slime', x: 3, y: 2 },
      ], field(['.....', '.....', '.....', '.....', '.....'])),
      onto,
      lib(),
    )
    const w = rp.engine.world
    expect(w.get('bomb')).toBeUndefined()
    expect(w.fx.some((f) => f.t === 'vfx' && f.fx === 'explosion')).toBe(true)
    const slime = w.get('slime')
    expect(!slime || w.num(slime, 'hp') < 9).toBe(true)
  })

  it('a lit lantern post takes more fire as its flame and does not catch; a cauldron gone out is lit again', () => {
    const post = replay(fire('post', 'fire', 2, [{ key: 'actor', type: 'actor/person/player', x: 2, y: 4 }, { key: 'post', type: 'fixture/light/lantern', x: 2, y: 2, statuses: ['lit'] }]), onto, lib())
    expect(post.engine.world.hasStatus({ e: 'post' }, 'burning')).toBe(false)
    expect(post.engine.world.hasStatus({ e: 'post' }, 'lit')).toBe(true)
    const pot = replay(fire('pot', 'fire', 2, [{ key: 'actor', type: 'actor/person/player', x: 2, y: 4 }, { key: 'pot', type: 'fixture/craft/cauldron', x: 2, y: 2 }]), onto, lib())
    expect(pot.engine.world.hasStatus({ e: 'pot' }, 'lit')).toBe(true)
  })

  it('raw food set on a fire made for cooking cooks, as held over it does; set on a lamp it does not', () => {
    for (const [type, cooks] of [['fixture/craft/cauldron', true], ['fixture/light/brazier', true], ['fixture/light/lamppost', false]] as const) {
      const sc = (verb: 'use' | 'put'): Scenario => ({
        entities: [
          { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
          { key: 'fish', type: 'item/food/fish/raw', x: 2, y: 2, heldBy: 'actor' },
          { key: 'fire', type, x: 2, y: 1, statuses: ['lit'] },
        ],
        event: { kind: `act/${verb}`, actor: 'actor', target: 'fire', instrument: 'fish' },
      })
      for (const verb of ['use', 'put'] as const) {
        const rp = replay(sc(verb), onto, lib())
        expect(rp.engine.world.get('fish')?.type === 'item/food/fish/cooked', `${verb} on ${type}`).toBe(cooks)
      }
    }
  })
})

describe("the base's general cases (design.md §5.16, roadmap G1)", () => {
  const at = (extra: ScenarioEntity[]): Engine => sandbox({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, ...extra], event: {} })

  it('a rope held out to a creature lashes it down and goes onto it; bread it snaps up is gone', () => {
    const eng = at([{ key: 'rope', type: 'item/tool/rope', x: 2, y: 2, heldBy: 'actor' }, { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 }])
    expect(eng.act('use', 'actor', { e: 'slime' }, { instrument: { e: 'rope' } }).defined).toBe(true)
    expect(eng.world.hasStatus({ e: 'slime' }, 'frozen')).toBe(true)
    expect(eng.world.get('rope')!.place).toMatchObject({ holder: 'slime' })
    const fed = at([{ key: 'bread', type: 'item/food/bread', x: 2, y: 2, heldBy: 'actor' }, { key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 }])
    expect(fed.act('use', 'actor', { e: 'slime' }, { instrument: { e: 'bread' } }).defined).toBe(true)
    fed.tick()
    expect(fed.world.get('bread')).toBeUndefined()
    expect(fed.world.get('slime')!.contents ?? []).toEqual([])
  })

  it('a bare hand on a wild creature is bitten; at a lit fire the wet dry off; ore on a lit forge runs into its bar, a cold one wants fire', () => {
    const bite = at([{ key: 'slime', type: 'actor/creature/slime/green_slime', x: 2, y: 1 }])
    const hp = bite.world.num(bite.world.get('actor')!, 'hp')
    bite.act('hands', 'actor', { e: 'slime' }, { instrument: null })
    bite.tick()
    expect(bite.world.num(bite.world.get('actor')!, 'hp')).toBeLessThan(hp)
    const warm = at([{ key: 'fire', type: 'fixture/light/campfire', x: 2, y: 1, statuses: ['lit'] }])
    warm.author(() => warm.world.setStatus({ e: 'actor' }, 'wet', 100))
    warm.act('hands', 'actor', { e: 'fire' }, { instrument: null })
    warm.tick()
    expect(warm.world.hasStatus({ e: 'actor' }, 'wet')).toBe(false)
    const smelt = at([{ key: 'ore', type: 'item/material/iron_ore', x: 2, y: 2, heldBy: 'actor' }, { key: 'forge', type: 'fixture/craft/forge', x: 2, y: 1, statuses: ['lit'] }])
    smelt.act('use', 'actor', { e: 'forge' }, { instrument: { e: 'ore' } })
    expect(smelt.world.get('ore')!.type).toBe('item/material/iron_ingot')
    const cold = at([{ key: 'ore', type: 'item/material/gold_ore', x: 2, y: 2, heldBy: 'actor' }, { key: 'forge', type: 'fixture/craft/forge', x: 2, y: 1 }])
    cold.act('use', 'actor', { e: 'forge' }, { instrument: { e: 'ore' } })
    expect(cold.world.get('ore')!.type).toBe('item/material/gold_ore')
  })
})

describe('the Mod port', () => {
  // A stone used on a dead tree: nothing in the base says what that does (a rope on a creature is
  // the base's now: it is held out to it, and a creature is lashed down by anything fibrous).
  const stoneScenario = (): Scenario => ({
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'stone', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
      { key: 'tree', type: 'fixture/nature/dead_tree', x: 2, y: 1 },
    ],
    event: {},
  })
  const stoneOnTree = (eng: Engine) => eng.act('use', 'actor', { e: 'tree' })
  /** The hole the stone on the dead tree falls into (core/use, the branch for an instrument on no site, no creature). */
  const USE_HOLE = (() => {
    const eng = sandbox(stoneScenario())
    return holeOf(eng, eng.actEvent('use', 'actor', { e: 'tree' }, { e: 'stone' }))
  })()
  /**
   * The stone's nature (driven into dead wood, it wedges and is spent) and the dead tree's (wedged, it
   * is notched): each writes only itself, and each is one type's own answer at one hole (design.md §5.16).
   */
  const stonePatch = (): Patch => ({
    author: 'test',
    artifacts: [
      {
        kind: 'rule',
        rule: {
          id: 'patch/stone-wedges-dead-tree',
          host: { type: 'item/material/stone' },
          on: 'act/use',
          hole: USE_HOLE,
          at: [],
          tree: {
            if: { is: { role: 'target', sel: { type: 'fixture/nature/dead_tree', notStatus: ['notched'] } } },
            then: {
              do: [
                { op: 'emit', impulse: 'handle', to: 'target', params: { how: 'wedge' } },
                { op: 'vfx', at: 'target', fx: 'dust' },
                { op: 'log', text: { en: 'You drive {host} into {target}.', zh: '你把{host}砸进了{target}。' } },
                { op: 'destroy' },
              ],
            },
            else: { undefined: true },
          },
          tests: [
            {
              name: 'a stone wedges a dead tree',
              given: {
                entities: [
                  { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
                  { key: 'r', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' },
                  { key: 's', type: 'fixture/nature/dead_tree', x: 2, y: 1 },
                ],
                event: { kind: 'act/use', actor: 'actor', target: 's', instrument: 'r' },
              },
              expect: [{ key: 's', hasStatus: 'notched' }, { key: 'r', destroyed: true }],
            },
          ],
        },
      },
      {
        kind: 'rule',
        rule: {
          id: 'patch/dead-tree-wedged',
          host: { type: 'fixture/nature/dead_tree' },
          on: 'impulse/handle',
          hole: 'core/handle',
          at: [],
          tree: { if: { param: { key: 'how', cmp: 'wedge' } }, then: { do: [{ op: 'addStatus', status: 'notched', duration: 30 }] }, else: { undefined: true } },
        },
      },
    ],
  })

  it('raises an undefined outcome, holds its participants, and applies a valid patch', () => {
    const eng = sandbox(stoneScenario())
    const port = new ModPort(eng)
    port.provider = working
    const res = stoneOnTree(eng)
    expect(res.defined).toBe(false)
    expect(port.records).toHaveLength(1)
    const rec = port.records[0]
    expect(rec.status).toBe('pending')
    expect(rec.origin).toBe('player')
    // the host (the stone), the target and the one who acted all wait for the outcome
    for (const id of ['stone', 'tree', 'actor']) expect(eng.world.get(id)!.frozenBy, id).toBe(rec.id)
    expect(rec.request.event.kind).toBe('act/use')
    expect(rec.request.event.host?.tags).toContain('stone')
    expect(rec.request.hole.rule).toBe('core/use')
    // the spec is self-describing
    const spec = port.spec()
    expect(spec.primitives.emit).toBeTruthy()
    expect(spec.impulses.strike).toBeTruthy()
    expect(spec.ontology.statuses.map((s) => s.id)).toContain('notched')
    // a status is named for the model as a type is: `stirred` is the water's, not "agitated"
    expect(spec.ontology.statuses.find((s) => s.id === 'stirred')?.name).toBe('stirred up')

    const v = port.submit(rec.id, stonePatch())
    expect(v.errors).toEqual([])
    expect(v.ok).toBe(true)
    expect(rec.status).toBe('patched')
    expect(eng.lib.rules.get('patch/stone-wedges-dead-tree')?.source?.origin).toBe('patch')
    // replayed: the tree is now notched (its own answer to the stone) and the stone spent
    expect(eng.world.hasStatus({ e: 'tree' }, 'notched')).toBe(true)
    expect(eng.world.get('stone')).toBeUndefined()
    expect(eng.world.get('tree')!.frozenBy).toBeUndefined()
    expect(eng.world.get('actor')!.frozenBy).toBeUndefined()
  })

  it('runs the default after the time-out and still accepts a late patch', () => {
    const eng = sandbox(stoneScenario())
    const port = new ModPort(eng)
    port.provider = working
    stoneOnTree(eng)
    for (let i = 0; i < 120; i++) eng.tick()
    expect(port.records[0].status).toBe('fallback')
    expect(eng.world.fx.some((f) => f.t === 'log' && typeof f.text === 'object' && f.text.en === 'Nothing happens.')).toBe(true)
    expect(eng.world.get('tree')?.frozenBy).toBeUndefined()
    expect(port.submit(port.records[0].id, stonePatch()).ok).toBe(true)
    expect(eng.lib.rules.has('patch/stone-wedges-dead-tree')).toBe(true)
  })

  it('lets the host adopt what its own answer brings before taking it, and puts it back when the answer is refused', async () => {
    const calls: string[] = []
    for (const [patch, taken] of [[stonePatch(), true], [{ artifacts: [{ kind: 'rule', rule: { id: 'patch/broken', host: { type: 'item/material/stone' }, on: 'act/use' } }] } as unknown as Patch, false]] as const) {
      const eng = sandbox(stoneScenario())
      const port = new ModPort(eng)
      port.provider = { resolve: async () => patch }
      // put back before the hole's default runs, so the default sees the world's definitions
      const ranDefault = () => eng.world.fx.some((f) => f.t === 'log' && typeof f.text === 'object' && f.text.en === 'Nothing happens.')
      port.adopt = (p) => (calls.push(`adopt ${p.artifacts.length}`), { restore: () => calls.push(`restore${ranDefault() ? ' after the default' : ''}`) })
      stoneOnTree(eng)
      await new Promise((r) => setTimeout(r, 0))
      expect(port.records[0].status).toBe(taken ? 'patched' : 'rejected')
    }
    expect(calls).toEqual(['adopt 2', 'adopt 1', 'restore'])
  })

  it('lets the ground go when the outcome comes: a cell asked about takes the next act', () => {
    const eng = sandbox(stoneScenario())
    const port = new ModPort(eng)
    port.provider = working
    const ground = cellOf(eng, 2, 3)
    eng.act('use', 'actor', ground)
    expect(port.records[0]?.status).toBe('pending')
    expect(eng.world.get((ground as { e: string }).e)!.frozenBy).toBe(port.records[0].id)
    for (let i = 0; i < 120; i++) eng.tick()
    expect(port.records[0].status).toBe('fallback')
    // the cell's own thing is kept for its id, not in the state: it is let go all the same
    expect(eng.world.get((ground as { e: string }).e)!.frozenBy).toBeUndefined()
    eng.act('put', 'actor', ground, { instrument: { e: 'stone' } })
    expect(eng.world.posOf(eng.world.get('stone')!)).toMatchObject({ x: 2, y: 3 })
  })

  it('credits a shared patch to this game\'s own request (a revision of its answer), and only that', () => {
    const eng = sandbox(stoneScenario())
    const port = new ModPort(eng)
    port.provider = working
    stoneOnTree(eng)
    const mine = port.records[0].id
    for (let i = 0; i < 120; i++) eng.tick()
    const scene = port.records[0].request.scenario
    expect(port.submit(undefined, stonePatch(), scene, [], mine).errors).toEqual([])
    expect(eng.lib.rules.get('patch/stone-wedges-dead-tree')!.source).toMatchObject({ request: mine })
    const eng2 = sandbox(stoneScenario())
    const port2 = new ModPort(eng2)
    expect(port2.submit(undefined, stonePatch(), scene, [], 'req-of-another-game').errors).toEqual([])
    expect(eng2.lib.rules.get('patch/stone-wedges-dead-tree')!.source?.request).toBeUndefined()
  })

  it('asks about one hole and class once at a time, and a question that failed not again this session', async () => {
    const two = (): Scenario => ({
      ...stoneScenario(),
      entities: [
        ...stoneScenario().entities,
        { key: 'other', type: 'actor/person/farmer', x: 4, y: 2 },
        { key: 'stone2', type: 'item/material/stone', x: 4, y: 2, heldBy: 'other' },
        { key: 'tree2', type: 'fixture/nature/dead_tree', x: 4, y: 1 },
      ],
    })
    const eng = sandbox(two())
    const port = new ModPort(eng)
    port.provider = working
    stoneOnTree(eng)
    // while the question is open, the same hole and class (another stone, another dead tree) wait for it:
    // nothing more is asked, nothing more is held, and the default runs for the second
    expect(eng.act('use', 'other', { e: 'tree2' }).defined).toBe(false)
    expect(port.records).toHaveLength(1)
    expect(eng.world.get('tree2')!.frozenBy).toBeUndefined()

    // a provider that cannot answer: the default runs, and the class is not asked again
    const eng2 = sandbox(two())
    const port2 = new ModPort(eng2)
    let calls = 0
    port2.provider = {
      resolve: async () => {
        calls++
        return null
      },
    }
    stoneOnTree(eng2)
    await Promise.resolve()
    await Promise.resolve()
    expect(port2.records[0].status).toBe('fallback')
    expect(eng2.world.get('actor')!.frozenBy).toBeUndefined()
    eng2.act('use', 'other', { e: 'tree2' })
    stoneOnTree(eng2)
    expect(port2.records).toHaveLength(1)
    expect(calls).toBe(1)
    // a late patch still teaches the world
    expect(port2.submit(port2.records[0].id, stonePatch()).ok).toBe(true)
    expect(port2.records[0].status).toBe('patched')
    expect(eng2.lib.rules.has('patch/stone-wedges-dead-tree')).toBe(true)
  })

  it('a dismissed question is not asked again', () => {
    const eng = sandbox(stoneScenario())
    const port = new ModPort(eng)
    stoneOnTree(eng)
    port.dismiss(port.records[0].id)
    stoneOnTree(eng)
    expect(port.records).toHaveLength(1)
  })

  it('rejects unknown statuses, failing tests, and a second answer at a leaf already answered', () => {
    const base = stonePatch()
    const bad1 = structuredClone(base)
    ;(bad1.artifacts[1] as { rule: Rule }).rule.tree = { do: [{ op: 'addStatus', status: 'hogtied' }] }
    const r1 = validatePatch(bad1, { ontology: onto, library: lib() })
    expect(r1.ok).toBe(false)
    expect(r1.errors.join()).toMatch(/unknown status "hogtied"/)

    const bad2 = structuredClone(base)
    ;(bad2.artifacts[1] as { rule: Rule }).rule.tree = { do: [{ op: 'vfx', fx: 'dust' }] }
    const r2 = validatePatch(bad2, { ontology: onto, library: lib() })
    expect(r2.ok).toBe(false)
    expect(r2.errors.join()).toMatch(/lacks status notched/)

    // the dead tree's answer to being handled is already in: there is no second answer at that leaf
    const l = lib()
    l.add({ id: 'patch/dead-tree-hands', host: { type: 'fixture/nature/dead_tree' }, on: 'impulse/handle', hole: 'core/handle', tree: { do: [{ op: 'vfx', fx: 'dust' }] }, source: { origin: 'patch' } })
    const r3 = validatePatch(base, { ontology: onto, library: l })
    expect(r3.errors.join()).toMatch(/rule "patch\/dead-tree-wedged".at: that leaf is already answered/)
    // and a path below a leaf needs a tree to stand in
    const r4 = validatePatch({ artifacts: [{ kind: 'rule', rule: { ...(base.artifacts[1] as { rule: Rule }).rule, at: ['x'] } }] }, { ontology: onto, library: lib() })
    expect(r4.errors.join()).toMatch(/has no tree at this hole yet/)
  })

  it('a patch is one type\'s own at one hole, writes only it, answers one kind, and never inherits', () => {
    const one = (rule: object) => validatePatch({ artifacts: [{ kind: 'rule', rule: { host: { type: 'item/material/stone' }, on: 'act/use', hole: USE_HOLE, ...rule } as Rule }] }, { ontology: onto, library: lib() }).errors.join()
    expect(one({ id: 'patch/a', host: undefined, tree: { do: [{ op: 'vfx', fx: 'dust' }] } })).toMatch(/host must be exactly \{type:/)
    expect(one({ id: 'patch/a2', host: { type: 'item', tags: ['stone'] }, tree: { do: [{ op: 'vfx', fx: 'dust' }] } })).toMatch(/host must be exactly \{type:/)
    expect(one({ id: 'patch/b', tree: { do: [{ op: 'addStatus', of: 'target', status: 'frozen' }] } })).toMatch(/no "of"/)
    expect(one({ id: 'patch/c', tree: { if: { none: 'target' }, then: { do: [] }, else: 'inherit' } })).toMatch(/never inherits/)
    expect(one({ id: 'patch/c2', tree: { if: { none: 'target' }, then: { do: [] } } })).toMatch(/never inherits/)
    expect(one({ id: 'patch/c3', tree: { undefined: true } })).toMatch(/no leaf answers/)
    expect(one({ id: 'patch/d', on: 'interaction', tree: { do: [] } })).toMatch(/on must be the exact event kind/)
    expect(one({ id: 'patch/d2', on: 'act', tree: { do: [] } })).toMatch(/one kind, not a branch/)
    expect(one({ id: 'patch/d3', hole: undefined, tree: { do: [] } })).toMatch(/hole required/)
    expect(one({ id: 'patch/e', tree: { do: [{ op: 'emit', impulse: 'bind', to: 'target' }] } })).toMatch(/unknown impulse "bind"/)
  })

  it('rejects a patch whose rule does not answer the triggering event', () => {
    const eng = sandbox(stoneScenario())
    const port = new ModPort(eng)
    stoneOnTree(eng)
    const p = stonePatch()
    ;(p.artifacts[0] as { rule: Rule }).rule.tree = { if: { is: { role: 'target', sel: { type: 'fixture/nature/beehive' } } }, then: { do: [{ op: 'destroy' }] } }
    const v = port.submit(port.records[0].id, p)
    expect(v.ok).toBe(false)
    expect(v.errors.join()).toMatch(/still undefined/)
  })

  it('patches only fill holes: a patch on a defined outcome is never consulted', () => {
    const eng = sandbox({
      entities: [
        { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
        { key: 'apple', type: 'item/food/apple', x: 2, y: 2, heldBy: 'actor' },
        { key: 'well', type: 'fixture/water/well', x: 2, y: 1 },
      ],
      event: {},
    })
    const onWell = eng.actEvent('use', 'actor', { e: 'well' }, { e: 'apple' })
    expect(eng.resolveEvent(onWell)).toMatchObject({ defined: false, open: { path: [] } })
    eng.lib.add({ id: 'patch/apple-explodes', host: { type: 'item/food/apple' }, on: 'act/use', hole: holeOf(eng, onWell), tree: { do: [{ op: 'vfx', fx: 'explosion' }] }, source: { origin: 'patch' } })
    // eaten (defined by the base): the patch is not asked
    expect(eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'actor' }, { e: 'apple' })).rule?.id).toBe('use/eat')
    // on the well (a hole): the patch answers
    const r = eng.resolveEvent(onWell)
    expect(r).toMatchObject({ defined: true, rule: { id: 'patch/apple-explodes' }, hole: { rule: { id: 'core/use' } } })
    // the apple's own: a loaf on the well is another type's hole, still open
    eng.author(() => eng.world.create('item/food/bread', { on: 'tile', map: 'sandbox', x: 2, y: 2 }))
    const loaf = Object.values(eng.world.state.entities).find((e) => e.type === 'item/food/bread')!
    expect(eng.resolveEvent(eng.actEvent('use', 'actor', { e: 'well' }, { e: loaf.id })).defined).toBe(false)
  })
})

describe('determinism & persistence', () => {
  it('replays identically from the same seed', () => {
    const run = () =>
      JSON.stringify(
        replay(
          {
            terrain: field([',,,,,', ',,,,,', ',,,,,']),
            entities: [{ key: 'actor', type: 'actor/person/player', x: 0, y: 0 }],
            event: { kind: 'impulse/element', host: 'tile:2,1', actor: 'actor', params: { element: 'fire', power: 3 } },
            ticks: 120,
          },
          onto,
          lib(),
        ).engine.world.state,
      )
    expect(run()).toBe(run())
  })

  it('round-trips the rule library through JSON', () => {
    const l = lib()
    l.add({ id: 'patch/x', host: { type: 'actor/creature/slime/green_slime' }, on: 'impulse/handle', hole: 'core/handle', tree: { do: [{ op: 'log', text: 'x' }] }, source: { origin: 'patch' } })
    const back = RuleLibrary.fromJSON(JSON.parse(JSON.stringify(l.toJSON())))
    expect(back.rules.size).toBe(l.rules.size)
    expect(back.patches().map((r) => r.id)).toEqual(['patch/x'])
    expect(back.version).toBe(l.version)
  })
})

describe('text', () => {
  it('names roles as they were when the outcome started, even after it destroyed its host', () => {
    const rule: Rule = {
      id: 'test/slime-eats-rope',
      host: { tags: ['fiber'], type: 'item' },
      on: 'act/use',
      tree: {
        if: { is: { role: 'target', sel: { type: 'actor/creature' } } },
        then: { do: [{ op: 'destroy' }, { op: 'log', text: { en: 'The {target} eats the {host}.', zh: '{target}吃掉了{host}。' } }] },
      },
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
    eng.act('use', 'actor', { e: 'slime' })
    expect(eng.world.get('rope')).toBeUndefined()
    const line = eng.world.fx.find((f) => f.t === 'log' && typeof f.text === 'object' && f.text.en.startsWith('The '))
    expect(line && line.t === 'log' && typeof line.text === 'object' && line.text.en).toBe('The green slime eats the Rope.')
  })
})

describe('a test whose given is not a scenario', () => {
  it('is told what a scenario is, not met with a crash deep inside', () => {
    expect(() => buildSandbox({ from: 'request' } as unknown as Scenario, onto, lib())).toThrow(/not a scenario.*entities/)
    // a learned rule in its place (design.md §5.16): the stone's, at the hole a stone used on a dead tree falls into
    const at = sandbox({ entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'stone', type: 'item/material/stone', x: 2, y: 2, heldBy: 'actor' }, { key: 'tree', type: 'fixture/nature/dead_tree', x: 2, y: 1 }], event: {} })
    const hole = holeOf(at, at.actEvent('use', 'actor', { e: 'tree' }, { e: 'stone' }))
    const rule: Rule = { id: 'patch/test-shape', host: { type: 'item/material/stone' }, on: 'act/use', hole, at: [], tree: { do: [{ op: 'log', text: { en: 'Clack.', zh: '咔。' } }] }, tests: [{ given: { from: 'request' } as unknown as Scenario, expect: [] }] }
    const res = validatePatch({ author: 'test', artifacts: [{ kind: 'rule', rule }] }, { ontology: onto, library: lib() })
    const said = res.errors.join('\n')
    expect(said).toMatch(/not a scenario/)
    expect(said).not.toMatch(/Cannot read properties/)
  })
})
