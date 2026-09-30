// Interaction coverage: every item form (and the empty hand) against every kind of thing the
// player can face, resolved through the base rule library exactly as the engine resolves a
// player verb. It is the progress meter for the roadmap (docs/roadmap.md, M0) and a
// regression guard: packages/tools/test/coverage.test.ts fails when a combination loses its
// answer or a form or fixture loses its purpose.
//
//   npm run coverage      → prints the numbers in docs/roadmap.md §1 and refreshes the
//                           baseline the test guards (packages/tools/test/coverage.baseline.json)

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RuleLibrary, SANDBOX_MAP, buildSandbox, textOf, type Ontology, type Ref, type Rule, type Scenario, type Selector, type Verb } from '@lsw/engine'
import { BASE_RULES, FORMS, MATERIALS, TERRAINS, buildOntology } from '@lsw/content'

// ------------------------------------------------------------------ definitions

/**
 * Answers that do not depend on what the thing is: setting it down, storing it, handing it
 * over, splashing water or oil on it, examining it, or finding nothing to take. Every other
 * rule that answers an interaction is a specific answer.
 */
export const GENERIC_RULES: Record<string, string> = {
  'core/put-down': 'set down',
  'core/put-on-item': 'set down',
  'core/store': 'store',
  'core/store-closed': 'store',
  'core/give': 'hand over',
  'core/splash': 'splash',
  'core/pour-oil': 'splash',
  'core/examine-fixture': 'examine',
  'core/examine-item': 'examine',
  'core/examine-ground': 'examine',
  'core/examine-creature': 'examine',
  'core/examine-self': 'examine',
  'core/take-nothing': 'nothing to take',
  'core/take-closed': 'nothing to take',
  'core/take-empty': 'nothing to take',
}

/**
 * Tags that say what a thing is made of (every material's tags). A rule that singles a role
 * out only by these ("anything flammable burns in a fire") does not give that role a purpose.
 */
export const MATERIAL_TAGS: ReadonlySet<string> = new Set(Object.values(MATERIALS).flatMap((m) => m.tags))

/** Fixture states the world generates and rules test for. */
const OPENABLE = 'container'
const LIGHTABLE = 'lightable'
/** The only fixture the world generator places locked. */
const LOCKABLE = 'fixture/container/chest'

export type Outcome = 'specific' | 'generic' | 'undefined'
export const OUTCOMES: Outcome[] = ['specific', 'generic', 'undefined']

export interface Target {
  /** Stable id: a fixture type with an optional `#state`, `tile:<terrain>`, or a named role. */
  id: string
  scenario: (sc: Scenario) => string
}

export interface Cell {
  /** Item form held, or '' for the empty hand. */
  hand: string
  target: string
  verb: Verb
  /** The rule that answers, if any. */
  rule?: string
  outcome: Outcome
}

export type Tally = Record<Outcome, number>

export interface Coverage {
  cells: Cell[]
  totals: Tally
  /** Cells answered, per rule. */
  byRule: Record<string, number>
  byHand: Record<string, Tally>
  byTarget: Record<string, Tally>
  /** Item forms and fixture types that no rule gives a purpose. */
  idleForms: string[]
  idleFixtures: string[]
}

/** The coverage without its cells: what the baseline file holds. */
export type Baseline = Omit<Coverage, 'cells'>

// ------------------------------------------------------------------ the swept space

const ORIGIN = { x: 1, y: 2 } // the player, facing up
const FRONT = { x: 1, y: 1 } // what they face

function tagsOf(onto: Ontology, type: string): Set<string> {
  const tags = new Set<string>()
  const parts = type.split('/')
  for (let i = 1; i <= parts.length; i++) for (const t of onto.types[parts.slice(0, i).join('/')]?.tags ?? []) tags.add(t)
  return tags
}

/** Everything the player can face: fixtures in each state, terrains, a person, a creature, themselves, a loose item. */
export function targets(onto: Ontology): Target[] {
  const out: Target[] = []
  const place = (id: string, type: string, statuses: string[] = [], tags: string[] = []) =>
    out.push({ id, scenario: (sc) => (sc.entities.push({ key: 'target', type, ...FRONT, statuses, tags }), 'target') })

  const fixtures = Object.keys(onto.types).filter((id) => onto.types[id].kind === 'fixture')
  for (const type of fixtures.filter((id) => !fixtures.some((o) => o.startsWith(id + '/')))) {
    const tags = tagsOf(onto, type)
    place(type, type)
    if (tags.has(OPENABLE)) place(`${type}#open`, type, ['open'])
    if (type === LOCKABLE) place(`${type}#locked`, type, [], ['locked'])
    if (tags.has(LIGHTABLE)) place(`${type}#lit`, type, ['lit'])
  }
  for (const t of TERRAINS)
    out.push({
      id: `tile:${t.id}`,
      scenario: (sc) => {
        sc.terrain![FRONT.y][FRONT.x] = t.id
        return `tile:${FRONT.x},${FRONT.y}`
      },
    })
  place('person', 'actor/person/villager')
  place('creature', 'actor/creature/slime/green_slime')
  out.push({ id: 'self', scenario: () => 'actor' })
  place('item', 'item/material/stone')
  return out
}

/** Held forms are swept as their bare type: material, quality and element vary per instance. */
export const HANDS: string[] = ['', ...FORMS.map((f) => f.id)]

function verbsFor(hand: string, target: string): Verb[] {
  const verbs: Verb[] = hand ? ['put', 'interact'] : ['take', 'interact']
  // You can use a thing on yourself, but not put it on or take yourself.
  return target === 'self' ? ['interact'] : verbs
}

// ------------------------------------------------------------------ the sweep

export function sweep(onto: Ontology = buildOntology(), rules: Rule[] = BASE_RULES): Coverage {
  const lib = new RuleLibrary(rules)
  const cells: Cell[] = []
  for (const target of targets(onto)) {
    // One sandbox per target; every form waits in the player's pack. Selectors read an
    // instrument's type, tags, statuses and props, never where it is kept.
    const sc: Scenario = {
      terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
      entities: [
        { key: 'actor', type: 'actor/person/player', ...ORIGIN },
        ...FORMS.map((f, i) => ({ key: `hand${i}`, type: f.id, ...ORIGIN, inside: 'actor' })),
      ],
      event: {},
    }
    const key = target.scenario(sc)
    const eng = buildSandbox(sc, onto, lib)
    const ref: Ref = key === 'actor' || key === 'target' ? { e: key } : { tile: { map: SANDBOX_MAP, ...FRONT } }
    HANDS.forEach((hand, i) => {
      for (const verb of verbsFor(hand, target.id)) {
        const instrument: Ref | undefined = hand ? { e: `hand${i - 1}` } : undefined
        const res = eng.resolve({ kind: 'interaction', verb, roles: { actor: { e: 'actor' }, target: ref, instrument }, at: { map: SANDBOX_MAP, ...FRONT } })
        const rule = res.rule?.id
        cells.push({ hand, target: target.id, verb, rule, outcome: !rule ? 'undefined' : rule in GENERIC_RULES ? 'generic' : 'specific' })
      }
    })
  }
  return summarize(cells, rules)
}

const zero = (): Tally => ({ specific: 0, generic: 0, undefined: 0 })

/** True when a selector picks its role out by what it is for, not merely by kind or material. */
function purposeful(sel: Selector | undefined): boolean {
  if (!sel) return false
  return !!sel.type || !!sel.id || (sel.tags ?? []).some((t) => !MATERIAL_TAGS.has(t))
}

function summarize(cells: Cell[], rules: Rule[]): Coverage {
  const byId = new Map(rules.map((r) => [r.id, r]))
  const totals = zero()
  const byRule: Record<string, number> = {}
  const byHand: Record<string, Tally> = {}
  const byTarget: Record<string, Tally> = {}
  const usedForms = new Set<string>()
  const usedFixtures = new Set<string>()
  for (const c of cells) {
    totals[c.outcome]++
    ;(byHand[c.hand || '(empty hand)'] ??= zero())[c.outcome]++
    ;(byTarget[c.target] ??= zero())[c.outcome]++
    if (!c.rule) continue
    byRule[c.rule] = (byRule[c.rule] ?? 0) + 1
    const when = byId.get(c.rule)!.when
    if (c.hand && purposeful(when.instrument)) usedForms.add(c.hand)
    if (c.target.startsWith('fixture/') && purposeful(when.target)) usedFixtures.add(c.target.split('#')[0])
  }
  // A held item's power is added to every attack (Engine.attack): weapons have a purpose.
  for (const f of FORMS) if (typeof f.props?.power === 'number') usedForms.add(f.id)
  const fixtures = [...new Set(cells.map((c) => c.target).filter((t) => t.startsWith('fixture/')).map((t) => t.split('#')[0]))]
  return {
    cells,
    totals,
    byRule: sortKeys(byRule),
    byHand,
    byTarget,
    idleForms: FORMS.map((f) => f.id).filter((id) => !usedForms.has(id)),
    idleFixtures: fixtures.filter((id) => !usedFixtures.has(id)),
  }
}

function sortKeys<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
}

// ------------------------------------------------------------------ report

const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)}%`

export function baseline(cov: Coverage): Baseline {
  const { cells: _cells, ...rest } = cov
  return rest
}

/** The numbers docs/roadmap.md §1 quotes, as text. */
export function report(cov: Coverage, onto: Ontology = buildOntology()): string {
  const n = cov.cells.length
  const name = (id: string) => textOf(onto.types[id]?.name) || id.split('/').pop()!
  const fixtures = new Set(Object.keys(cov.byTarget).filter((t) => t.startsWith('fixture/')).map((t) => t.split('#')[0])).size
  const row = (o: Outcome) => `${o.padEnd(9)} ${String(cov.totals[o]).padStart(6)}  ${pct(cov.totals[o], n).padStart(6)}`
  return [
    `${n} combinations (${HANDS.length - 1} forms + the empty hand × ${Object.keys(cov.byTarget).length} targets)`,
    ...OUTCOMES.map(row),
    '',
    `${cov.idleForms.length} of ${FORMS.length} item forms without a purpose: ${cov.idleForms.map(name).join(', ')}`,
    `${cov.idleFixtures.length} of ${fixtures} fixture types without a purpose: ${cov.idleFixtures.map(name).join(', ')}`,
  ].join('\n')
}

// ------------------------------------------------------------------ CLI

export const BASELINE = fileURLToPath(new URL('../test/coverage.baseline.json', import.meta.url))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const onto = buildOntology()
  const cov = sweep(onto)
  writeFileSync(BASELINE, JSON.stringify(baseline(cov), null, 1) + '\n')
  console.log(report(cov, onto))
}
