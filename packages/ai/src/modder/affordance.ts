// What a thing affords for an act (design.md §5.17). The modder says it before it designs ("affords"): a common use
// a player would reasonably expect (a chair is sat on), words only (a bare hand on a wall), or nothing. The harness
// holds the answer to it: a use must change the scene that asked, not only speak of it; words are provisional (the
// port asks again when the player keeps trying); nothing is decided.

import { AFFORDANCES, isDo, leaves, patchRules, type Affordance, type ModRequest, type Ontology, type Patch, type Rule, type RuleLibrary } from '@openworld/engine'
import { changesNothing, changesScene } from './derive.ts'

/** The judgment the answer states: `affords` beside the patch, or inside it. */
export function statedAffordance(answer: unknown): Affordance | undefined {
  const o = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {}
  const p = o.patch && typeof o.patch === 'object' ? (o.patch as Record<string, unknown>) : {}
  const x = String(o.affords ?? p.affords ?? '').trim().toLowerCase()
  return (AFFORDANCES as readonly string[]).includes(x) ? (x as Affordance) : undefined
}

/** The rules of the patch that answer the request (its host's type, its kind), not another thing's reply. */
function answering(patch: Patch, req: ModRequest): Rule[] {
  const rules = patchRules(patch)
  const own = rules.filter((r) => r.host?.type === req.event.host?.type && r.on === req.event.kind)
  return own.length ? own : rules.slice(0, 1)
}

/** What a rule's own effects say it is, when the answer did not: a change is a use; lines alone, words; nothing, none. */
function derivedAffordance(r: Rule): Affordance {
  if (!changesNothing(r)) return 'use'
  return JSON.stringify(r.tree).includes('"op":"') ? 'words' : 'none'
}

const SPEAKS = new Set(['vfx', 'say', 'log', 'emote', 'emit'])

/** Does a leaf of the rule change its host itself (a status, a prop, a transform, a spawn…), not only speak or send? */
function writesItself(r: Rule): boolean {
  return leaves(r.tree).some((l) => isDo(l) && l.do.some((e) => !SPEAKS.has(e.op)))
}

export interface Judged {
  patch: Patch
  affords: Affordance
  /** A use that changes nothing in the scene that asked: what to tell the designer. */
  mismatch?: string
  /** What the harness set right by itself. */
  fixes: string[]
}

/**
 * The answer's judgment, held to what the answer does: written on the answering rules (`affords`, and `reasked`
 * when the question was asked again). `force` overrides it (a use that still changed nothing after a repair is
 * kept as words: provisional, so it can grow).
 */
export function judge(patch: Patch, req: ModRequest, stated: Affordance | undefined, lib: RuleLibrary, onto: Ontology, force?: Affordance): Judged {
  const fixes: string[] = []
  const rules = answering(patch, req)
  const derived = rules.map(derivedAffordance)
  let affords: Affordance = force ?? stated ?? (derived.includes('use') ? 'use' : derived.includes('words') ? 'words' : 'none')
  // words or nothing that change the world after all are a use
  if (!force && affords !== 'use' && derived.includes('use')) {
    fixes.push(`judged "${affords}" but the rule changes the world: kept as "use"`)
    affords = 'use'
  }
  // only an answer whose change is all sent to others may change nothing (its receiver may have no answer): one that
  // writes its host, or whose derived test saw the scene change, needs no replay of its own
  const seen = rules.some((r) => writesItself(r) || r.tests?.some((t) => t.name?.startsWith('derived') && (t.expect?.length ?? 0) > 1))
  // the answer is held to what it said: an unsaid judgment is read off the rule, never sent back
  const mismatch =
    !force && stated === 'use' && affords === 'use' && !seen && !changesScene(patch, req, lib, onto)
      ? 'You judged this a use (affords "use"), but in the scene that asked your rule changes nothing: no status, number, thing or cell is different afterwards, only words (an impulse you emit has no answer from its receiver there). Make the use real: state on the host, or an impulse its receiver answers (a posture: emit settle to the actor with {pose}). If the thing truly has no use for this act, answer with affords "words" and a short line.'
      : undefined
  const ids = new Set(rules.map((r) => r.id))
  const artifacts = patch.artifacts.map((a) => (a.kind === 'rule' && ids.has(a.rule.id) ? { ...a, rule: { ...a.rule, affords, ...(req.again && { reasked: true }) } } : a))
  return { patch: { ...patch, artifacts }, affords, mismatch, fixes }
}
