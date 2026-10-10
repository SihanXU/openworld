// A world's own interaction space. The coverage sweep is over the whole content catalogue; the
// demo (the Ford) holds a small part of it. The scope lists what a world actually
// contains — item forms, fixtures in the states they appear in, terrains, people, creatures —
// and how often a player meets each, so the curriculum spends its budget where players are.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Rng, type Ontology } from '@openworld/engine'
import { FORMS, decodeChunk, decodeMap, type RawChunk } from '@openworld-game/content'
import { OUTCOMES, targets, type Cell, type Tally } from './coverage.ts'

export const DEMO = fileURLToPath(new URL('../../public/world', import.meta.url))

export interface Scope {
  /** item form → instances in the world ('' = the empty hand) */
  hands: Map<string, number>
  /** coverage target id → how often it occurs */
  targets: Map<string, number>
}

interface Ent {
  type: string
  tags?: string[]
  statuses?: Record<string, number>
}

export function worldScope(onto: Ontology, dir = DEMO): Scope {
  if (!existsSync(join(dir, 'maps'))) throw new Error(`no world at ${dir} (npm run gen:world)`)
  const known = new Set(targets(onto).map((t) => t.id))
  const forms = FORMS.map((f) => f.id)
  const hands = new Map<string, number>()
  const tgt = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n)
  const leafFixture = (type: string) => {
    // coverage sweeps leaf fixture types; an instance of a deeper type counts for its sweep id
    let t = type
    while (t && !known.has(t)) t = t.split('/').slice(0, -1).join('/')
    return t
  }
  for (const f of readdirSync(join(dir, 'maps'))) {
    const raw = JSON.parse(readFileSync(join(dir, 'maps', f), 'utf8')) as RawChunk
    for (const t of decodeMap(raw.map).terrain) add(tgt, `tile:${t}`)
    for (const e of Object.values(decodeChunk(raw).entities ?? {}) as Ent[]) {
      if (e.type.startsWith('item/')) {
        const form = forms.find((id) => e.type === id || e.type.startsWith(id + '/'))
        if (form) add(hands, form)
        add(tgt, 'item')
      } else if (e.type.startsWith('fixture/')) {
        const base = leafFixture(e.type)
        if (!base) continue
        const state = e.statuses?.open !== undefined ? '#open' : e.statuses?.lit !== undefined ? '#lit' : e.tags?.includes('locked') ? '#locked' : ''
        add(tgt, base + state)
        if (state) add(tgt, base, 0.5) // it can be closed, put out, unlocked
      } else if (e.type.startsWith('actor/creature')) add(tgt, 'creature')
      else if (e.type.startsWith('actor/person')) add(tgt, 'person')
    }
  }
  const index = join(dir, 'index.json')
  const people = existsSync(index) ? (JSON.parse(readFileSync(index, 'utf8')) as { npcs?: unknown[] }).npcs?.length ?? 0 : 0
  if (people) add(tgt, 'person', people)
  const most = Math.max(...hands.values())
  hands.set('', most) // the empty hand is always at hand
  tgt.set('self', Math.max(...[...tgt.values()].filter((v) => v < 200)))
  for (const k of [...tgt.keys()]) if (!known.has(k)) tgt.delete(k)
  return { hands, targets: tgt }
}

export const inScope = (c: Cell, s: Scope) => s.hands.has(c.hand) && s.targets.has(c.target)

/** How likely a player is to try it: things met often, held often, weigh more (log-damped). */
export function weightOf(c: Cell, s: Scope): number {
  return Math.log1p(s.hands.get(c.hand) ?? 0) * Math.log1p(s.targets.get(c.target) ?? 0)
}

/**
 * A weighted sample without replacement (Efraimidis–Spirakis), with a cap per target and per
 * held form so a hundred draws are not a hundred campfires.
 */
export function pickWeighted(cells: Cell[], n: number, seed: number, s: Scope): Cell[] {
  const rng = new Rng(seed)
  const keyed = cells
    .filter((c) => inScope(c, s))
    .map((c) => ({ c, k: Math.pow(rng.next(), 1 / Math.max(1e-6, weightOf(c, s))) }))
    .sort((a, b) => b.k - a.k)
  const cap = Math.max(2, Math.ceil(n / 25))
  const perTarget = new Map<string, number>()
  const perHand = new Map<string, number>()
  const out: Cell[] = []
  for (const { c } of keyed) {
    if (out.length >= n) break
    if ((perTarget.get(c.target) ?? 0) >= cap || (perHand.get(c.hand) ?? 0) >= cap) continue
    perTarget.set(c.target, (perTarget.get(c.target) ?? 0) + 1)
    perHand.set(c.hand, (perHand.get(c.hand) ?? 0) + 1)
    out.push(c)
  }
  return out
}

/**
 * A weighted sample spread over the holes the cells reach (`core/use`, `core/receive`,
 * `core/strike`, …): each hole gets its share of n, and at least two, so the thousands of
 * undefined uses do not crowd out the rarer kinds of question.
 */
export function pickByHole(cells: Cell[], n: number, seed: number, s: Scope): Cell[] {
  const by = new Map<string, Cell[]>()
  for (const c of cells) if (c.hole && inScope(c, s)) (by.get(c.hole) ?? by.set(c.hole, []).get(c.hole)!).push(c)
  const total = [...by.values()].reduce((a, cs) => a + cs.length, 0)
  const holes = [...by.keys()].sort()
  const quota = new Map(holes.map((h) => [h, Math.min(by.get(h)!.length, Math.max(2, Math.round((n * by.get(h)!.length) / total)))]))
  // trim the largest shares until the quotas add up to n
  while ([...quota.values()].reduce((a, b) => a + b, 0) > n) {
    const big = holes.reduce((a, b) => (quota.get(a)! >= quota.get(b)! ? a : b))
    if (quota.get(big)! <= 2) break
    quota.set(big, quota.get(big)! - 1)
  }
  return holes.flatMap((h, i) => pickWeighted(by.get(h)!, quota.get(h)!, seed + i, s))
}

/** Outcome totals over the scope only. */
export function scopedTotals(cells: Cell[], s: Scope): Tally & { total: number } {
  const t = { specific: 0, generic: 0, undefined: 0, total: 0 }
  for (const c of cells) if (inScope(c, s)) (t[c.outcome]++, t.total++)
  void OUTCOMES
  return t
}
