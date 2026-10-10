// The holes of a project (docs/engine-split.md §6, what RPG Maker has no counterpart for): every act the player's
// inputs make — a bare hand on a thing (E), a thing in hand used on another (left click), used on oneself (right
// click) — on every kind of thing one may face, resolved as the engine previews an act (its own outcome and the
// impulses it sends). Where the outcome is undefined, the AI answers in play; the editor shows each hole, and
// where its answer would go (the base rule and the branch: design.md §5.16). Taking and putting are physics,
// never holes. OpenWorld's own coverage (tools/src/coverage.ts) counts more finely for its roadmap.

import { buildSandbox, restoreLibrary, type GameEvent, type LibraryData, type Ontology, type Ref, type Resolution, type Rule, type Scenario } from '@openworld/engine'

export type HoleVerb = 'hands' | 'use' | 'self'

export interface HoleCell {
  verb: HoleVerb
  /** The thing in hand ('' for the bare hand). */
  hand: string
  /** What it is done to: a type, or `tile/<terrain>`; the actor itself for `self`. */
  target: string
  /** The base rule that holds the hole, and the branch of its tree to the undefined leaf. */
  rule: string
  path: string[]
  /** The event that reaches it (an act, or an impulse the act sends) and its host's type. */
  kind: string
  host: string
}

export interface HoleReport {
  cells: HoleCell[]
  /** How many acts were tried. */
  checked: number
}

/** The kinds a world is made of: the types no other type is a kind of (an apple, not food). */
const leaves = (onto: Ontology): string[] => { const ids = Object.keys(onto.types); return ids.filter((t) => !ids.some((x) => x.startsWith(t + '/'))) }

/** The kinds of things one faces: fixtures, structures, creatures and people, items lying about, the ground's cells. */
export function targetsOf(onto: Ontology): string[] {
  const types = leaves(onto).filter((t) => /^(fixture|structure|item|actor)\//.test(t) && t !== 'actor/person/player')
  const tiles = Object.keys(onto.terrains).filter((t) => t !== 'void').map((t) => `tile/${t}`)
  return [...types.sort(), ...tiles.sort()]
}

/** What one may hold: every kind of item. */
export const handsOf = (onto: Ontology): string[] => leaves(onto).filter((t) => t.startsWith('item/')).sort()

/** A hole as the engine's preview reports it, or none. */
function holeOf(p: { unknown: boolean; hole?: { ev: GameEvent; res: Resolution } }, typeOf: (r: Ref | undefined) => string): Pick<HoleCell, 'rule' | 'path' | 'kind' | 'host'> | undefined {
  if (!p.unknown || !p.hole?.res.hole) return undefined
  return { rule: p.hole.res.hole.rule.id, path: p.hole.res.hole.path, kind: p.hole.ev.kind, host: typeOf(p.hole.ev.host) }
}

/**
 * The holes of every act on the targets named (default: all), with every hand named (default: every item and
 * the bare hand), by the actor type (default: the player), the game's learned patches answering theirs. Pure
 * and deterministic: a sandbox per target.
 */
export function holesFor(onto: Ontology, rules: Rule[], opts: { targets?: string[]; hands?: string[]; actor?: string; verbs?: HoleVerb[]; learned?: LibraryData } = {}): HoleReport {
  // the patches the game ships with answer their holes (learned/): what is left is the AI's in play
  const lib = restoreLibrary(rules, opts.learned, structuredClone(onto))
  const actorType = opts.actor ?? 'actor/person/player'
  const hands = opts.hands ?? handsOf(onto)
  const verbs = new Set(opts.verbs ?? ['hands', 'use', 'self'])
  const cells: HoleCell[] = []
  let checked = 0
  const sandbox = (target?: string) => {
    const tile = target?.startsWith('tile/')
    const sc: Scenario = {
      ...(tile && { cells: [{ x: 2, y: 1, type: target }] }),
      entities: [{ key: 'actor', type: actorType, x: 2, y: 2 }, ...(target && !tile ? [{ key: 'target', type: target, x: 2, y: 1 }] : []), ...hands.map((h, i) => ({ key: `h${i}`, type: h, x: 2, y: 2, inside: 'actor' }))],
      event: {},
    }
    const eng = buildSandbox(sc, structuredClone(onto), lib)
    const typeOf = (r: Ref | undefined) => (r && 'e' in r ? (eng.world.get(r.e)?.type ?? '') : '')
    return { eng, typeOf, ref: (tile ? eng.world.cellRef('sandbox', 2, 1) : { e: 'target' }) as Ref }
  }
  for (const target of opts.targets ?? targetsOf(onto)) {
    const { eng, typeOf, ref } = sandbox(target)
    const tried = (verb: HoleVerb, hand: string, ev: GameEvent) => {
      checked++
      const h = holeOf(eng.preview(ev), typeOf)
      if (h) cells.push({ verb, hand, target, ...h })
    }
    if (verbs.has('hands')) tried('hands', '', eng.actEvent('hands', 'actor', ref, undefined))
    if (verbs.has('use')) hands.forEach((h, i) => tried('use', h, eng.actEvent('use', 'actor', ref, { e: `h${i}` })))
  }
  if (verbs.has('self') && !opts.targets) {
    const { eng, typeOf } = sandbox()
    hands.forEach((h, i) => {
      checked++
      const hole = holeOf(eng.preview(eng.actEvent('use', 'actor', { e: 'actor' }, { e: `h${i}` })), typeOf)
      if (hole) cells.push({ verb: 'self', hand: h, target: actorType, ...hole })
    })
  }
  return { cells, checked }
}

/** A hole's scenario: the act that reaches it, to replay in a sandbox or to ask the AI about. */
export function holeScenario(c: Pick<HoleCell, 'verb' | 'hand' | 'target'>, actor = 'actor/person/player'): Scenario {
  const tile = c.target.startsWith('tile/')
  const self = c.verb === 'self'
  return {
    ...(tile && { cells: [{ x: 2, y: 1, type: c.target }] }),
    entities: [{ key: 'actor', type: actor, x: 2, y: 2 }, ...(!self && !tile ? [{ key: 'target', type: c.target, x: 2, y: 1 }] : []), ...(c.hand ? [{ key: 'instrument', type: c.hand, x: 2, y: 2, heldBy: 'actor' }] : [])],
    event: { kind: c.verb === 'hands' ? 'act/hands' : 'act/use', actor: 'actor', target: self ? 'actor' : tile ? 'tile:2,1' : 'target', ...(c.hand && { instrument: 'instrument' }) },
  }
}

/** Holes counted by the type they are of (as the target, or as the thing in hand). */
export function holesByType(r: HoleReport): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of r.cells) for (const t of new Set([c.target, c.hand].filter(Boolean))) out.set(t, (out.get(t) ?? 0) + 1)
  return out
}
