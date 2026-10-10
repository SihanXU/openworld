// The standard library (docs/engine-split.md §3): what the kernel names and every game starts from. The resident
// types (the world, the story, a quest under way), regions and sites, the roots of the actor, item and fixture
// trees, the statuses the kernel and the inputs keep (open, down, asleep, drawn, sneaking, a stage's clock …),
// the elements, and the roots of the rule library: resolution is total, taking and putting are physics, the
// elements follow physics, a quest and the Story Manager answer themselves, the fallen rise. It is data
// (`ontology.json`, `rules.json`); a project takes it unless its game.json says `"stdlib": false`, and its own
// files go over it (a type, a status or a rule of the same id replaces the library's).

import type { Ontology, Rule } from '@openworld/engine'
import ontology from '../ontology.json'
import rules from '../rules.json'

export const STDLIB_ONTOLOGY = ontology as unknown as Partial<Ontology>
export const STDLIB_RULES = rules as unknown as Rule[]
