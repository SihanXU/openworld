// The affordance set (design.md §5.17): a bare hand (E) on things the base rules leave undefined, each labelled
// with what a player would reasonably expect. Positives have a common use for the act — something to sit on, lie
// on, kneel at, drink from — and must get real state; negatives have none — a rock, a fence, moss — and must get a
// short line or nothing, no invented mechanics. It measures the modder's judgment both ways: neither shrugs nor
// invents. The cases are checked without a model (test/affordance-set.test.ts): each is still a hole.

import { ModPort, RuleLibrary, buildSandbox, type Engine, type Scenario } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'

export interface AffordanceCase {
  name: string
  target: string
  /** what a player would expect of a bare hand on it: a use (real state), or words only (a line, or nothing) */
  expect: 'use' | 'words'
  /** the use, in words (for the record) */
  use?: string
  /** the thing is someone's: its owner stands by (context.whose) */
  owned?: boolean
}

export const AFFORDANCE_CASES: AffordanceCase[] = [
  { name: 'chair', target: 'fixture/furniture/chair', expect: 'use', use: 'sit' },
  { name: 'bench', target: 'fixture/furniture/bench', expect: 'use', use: 'sit' },
  { name: 'log bench', target: 'fixture/furniture/bench/log', expect: 'use', use: 'sit' },
  { name: 'stump', target: 'fixture/nature/stump', expect: 'use', use: 'sit' },
  { name: 'haystack', target: 'fixture/nature/haystack', expect: 'use', use: 'lie in it' },
  { name: 'well', target: 'fixture/water/well', expect: 'use', use: 'draw water, drink' },
  { name: 'fountain', target: 'fixture/water/fountain', expect: 'use', use: 'drink, wash' },
  { name: "someone's chair", target: 'fixture/furniture/chair', expect: 'use', use: 'sit (its owner by)', owned: true },
  { name: 'boulder', target: 'fixture/nature/boulder', expect: 'words' },
  { name: 'fence', target: 'fixture/fence', expect: 'words' },
  { name: 'statue', target: 'fixture/sacred/statue', expect: 'words' },
  { name: 'lamppost', target: 'fixture/light/lamppost', expect: 'words' },
  { name: 'mist', target: 'fixture/nature/mist', expect: 'words' },
  { name: 'dead tree', target: 'fixture/nature/dead_tree', expect: 'words' },
  { name: 'table', target: 'fixture/furniture/table', expect: 'words' },
  { name: 'counter', target: 'fixture/furniture/counter', expect: 'words' },
]

/** The scene of a case: the player beside the thing (and, for an owned one, its owner beside them). */
export function caseScene(c: AffordanceCase): Scenario {
  return {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'it', type: c.target, x: 2, y: 1, ...(c.owned && { props: { owner: 'owner' } }) },
      ...(c.owned ? [{ key: 'owner', type: 'actor/person', x: 3, y: 1 }] : []),
    ],
    event: {},
  }
}

/** A bare hand on the case's thing, through the engine's own path: the engine and the port that holds its question. */
export function askCase(c: AffordanceCase, lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])): { eng: Engine; port: ModPort } {
  const eng = buildSandbox(caseScene(c), buildOntology(), lib)
  const port = new ModPort(eng)
  eng.act('hands', 'actor', { e: 'it' }, { instrument: null })
  return { eng, port }
}
