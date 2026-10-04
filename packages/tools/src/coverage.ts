// Interaction coverage: every item form (and the empty hand) against every kind of thing the
// player can face, through every act the player's inputs make (use, put, take, hands), resolved
// through the base rule library exactly as the engine previews an act: the act's own outcome and
// the outcomes of the impulses it emits (design.md §5.8–5.9). It is the progress meter for the
// roadmap (docs/roadmap.md, M0) and a regression guard: packages/tools/test/coverage.test.ts
// fails when a combination loses its answer or a form or fixture loses its purpose.
//
//   npm run coverage      → prints the numbers in docs/roadmap.md (§1, §3) and refreshes the
//                           baseline the test guards (packages/tools/test/coverage.baseline.json)

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OntologyIndex, RuleLibrary, SANDBOX_MAP, buildSandbox, isRoot, matchSelector, textOf, type Cond, type Ontology, type Ref, type Rule, type Scenario, type Selector, type Tree, type Verb, type View } from '@lsw/engine'
import { BASE_RULES, FORMS, MATERIALS, RECIPES, TERRAINS, buildOntology } from '@lsw/content'

// ------------------------------------------------------------------ definitions

/**
 * Answers that do not depend on what the thing is: setting it down, finding no room for it,
 * storing it, or a person accepting it. Root rules (no host) are generic too: taking a portable
 * thing, the physics of the elements. Every other rule in an outcome makes it a specific answer.
 */
export const GENERIC_RULES: Record<string, string> = {
  'core/receive-ground': 'set down',
  'core/receive-item': 'set down',
  'core/receive-surface': 'set down',
  'core/receive-solid': 'no room',
  'core/receive-water': 'no room',
  'core/receive-store': 'store',
  'core/taken-container': 'store',
  'people/accept': 'hand over',
}

/**
 * Tags that say what a thing is made of (every material's tags). A rule that singles a thing
 * out only by these ("anything flammable burns in a fire") does not give it a purpose.
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
  /** The rule that answers: the last specific one in the outcome (the deepest), else the act's own. */
  rule?: string
  /** Where the outcome is undefined: the rule whose leaf is a hole. */
  hole?: string
  outcome: Outcome
}

export type Tally = Record<Outcome, number>

export interface Coverage {
  cells: Cell[]
  totals: Tally
  /** Cells answered, per rule. */
  byRule: Record<string, number>
  /** Cells left undefined, per hole. */
  byHole: Record<string, number>
  byHand: Record<string, Tally>
  byTarget: Record<string, Tally>
  /** Item forms and fixture types that no rule gives a purpose. */
  idleForms: string[]
  idleFixtures: string[]
}

/** The coverage without its cells: what the baseline file holds. */
export type Baseline = Omit<Coverage, 'cells'>

// ------------------------------------------------------------------ the swept space

export const ORIGIN = { x: 1, y: 2 } // the player, facing up
export const FRONT = { x: 1, y: 1 } // what they face

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

  const fixtures = Object.keys(onto.types).filter((id) => id === 'fixture' || id.startsWith('fixture/'))
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

/** The acts the player's inputs make: left click uses, right click puts, F takes, E handles bare-handed. */
export function verbsFor(hand: string, target: string): Verb[] {
  // You can use a thing on yourself, but not put it on or take yourself.
  if (target === 'self') return hand ? ['use'] : ['hands']
  return hand ? ['use', 'put'] : ['use', 'take', 'hands']
}

// ------------------------------------------------------------------ the sweep

const isGeneric = (r: Rule | undefined) => !r || isRoot(r) || r.id in GENERIC_RULES

export function sweep(onto: Ontology = buildOntology(), rules: Rule[] = BASE_RULES): Coverage {
  const lib = new RuleLibrary(rules)
  const cells: Cell[] = []
  const fired: { cell: Cell; rules: string[] }[] = []
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
        const p = eng.preview(eng.actEvent(verb, 'actor', ref, instrument))
        const specific = p.rules.filter((id) => !isGeneric(lib.rules.get(id))).at(-1)
        const cell: Cell = {
          hand,
          target: target.id,
          verb,
          rule: specific ?? p.rules[0],
          hole: p.unknown ? (p.hole?.res.hole?.rule.id ?? p.rules.at(-1)) : undefined,
          outcome: p.unknown ? 'undefined' : specific ? 'specific' : 'generic',
        }
        cells.push(cell)
        fired.push({ cell, rules: p.rules })
      }
    })
  }
  return summarize(cells, fired, onto, rules)
}

const zero = (): Tally => ({ specific: 0, generic: 0, undefined: 0 })

/** True when a selector picks a thing out by what it is for, not merely by a root type (actor, item, fixture, tile) or material. */
function purposeful(sel: Selector | undefined): boolean {
  if (!sel) return false
  return !!sel.type?.includes('/') || !!sel.id || (sel.tags ?? []).some((t) => !MATERIAL_TAGS.has(t))
}

/** The selectors a condition singles things out by: `is` patterns and what it counts. */
function selectorsOf(c: Cond | undefined): Selector[] {
  if (!c) return []
  if ('all' in c) return c.all.flatMap(selectorsOf)
  if ('any' in c) return c.any.flatMap(selectorsOf)
  if ('not' in c) return []
  if ('is' in c) return [c.is.sel]
  return 'count' in c && c.count.match ? [c.count.match] : []
}

function treeSelectors(t: Tree): Selector[] {
  if (typeof t === 'string' || !('if' in t)) return []
  return [...selectorsOf(t.if), ...treeSelectors(t.then), ...treeSelectors(t.else ?? 'inherit')]
}

/** What a rule singles out: its host and the things its conditions name, when they name a purpose. */
const singles = (r: Rule): Selector[] => [r.host, ...treeSelectors(r.tree)].filter(purposeful) as Selector[]

function summarize(cells: Cell[], fired: { cell: Cell; rules: string[] }[], onto: Ontology, rules: Rule[]): Coverage {
  const byId = new Map(rules.map((r) => [r.id, r]))
  const index = new OntologyIndex(onto)
  const view = (type: string): View => {
    const r = index.resolve(type)
    return { ref: { e: type }, type, tags: new Set(r.tags), statuses: new Set<string>(), props: r.props }
  }
  const fits = (sel: Selector, v: View) => matchSelector({ ...sel, status: undefined, notStatus: undefined, props: undefined }, v)
  const totals = zero()
  const byRule: Record<string, number> = {}
  const byHole: Record<string, number> = {}
  const byHand: Record<string, Tally> = {}
  const byTarget: Record<string, Tally> = {}
  const usedFixtures = new Set<string>()
  for (const c of cells) {
    totals[c.outcome]++
    ;(byHand[c.hand || '(empty hand)'] ??= zero())[c.outcome]++
    ;(byTarget[c.target] ??= zero())[c.outcome]++
    if (c.hole) byHole[c.hole] = (byHole[c.hole] ?? 0) + 1
    if (c.rule && c.outcome !== 'undefined') byRule[c.rule] = (byRule[c.rule] ?? 0) + 1
  }
  // A fixture has a purpose when a rule in some outcome on it singles it out (a table takes what is set on it).
  for (const { cell, rules: ids } of fired) {
    if (!cell.target.startsWith('fixture/')) continue
    const v = view(cell.target.split('#')[0])
    if (ids.some((id) => !isRoot(byId.get(id)!) && singles(byId.get(id)!).some((s) => fits(s, v)))) usedFixtures.add(cell.target.split('#')[0])
  }
  // A form has a purpose when some rule singles it out: as the instrument whose nature an act is
  // (an axe on a tree), as the thing acted on (a log to split), or as something carried (ink to
  // write with). Many of those states are out of the sweep's reach, so they are read from the rules.
  const usedForms = new Set<string>()
  const singled = rules.filter((r) => !isGeneric(r)).flatMap(singles)
  for (const f of FORMS) if (singled.some((sel) => fits(sel, view(f.id)))) usedForms.add(f.id)
  // A held item's power is added to every attack: weapons have a purpose.
  for (const f of FORMS) if (typeof f.props?.power === 'number') usedForms.add(f.id)
  // And a form a crafting recipe uses up (grass, for the first tools).
  for (const r of RECIPES) for (const n of r.needs) usedForms.add(n.type)
  const fixtures = [...new Set(cells.map((c) => c.target).filter((t) => t.startsWith('fixture/')).map((t) => t.split('#')[0]))]
  return {
    cells,
    totals,
    byRule: sortKeys(byRule),
    byHole: sortKeys(byHole),
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
  const holes = Object.entries(cov.byHole).sort((a, b) => b[1] - a[1])
  return [
    `${n} combinations (${HANDS.length - 1} forms + the empty hand × ${Object.keys(cov.byTarget).length} targets × the acts each input makes)`,
    ...OUTCOMES.map(row),
    `undefined at: ${holes.map(([id, k]) => `${id} ${k}`).join(', ')}`,
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
