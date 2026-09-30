# The self-improving modder (RSI)

Status: **design** (2026-10-01). Not implemented; the modder itself is not wired yet and the
model is not chosen. Evaluation uses an external coding benchmark (see §6) and is run by the
team, not by this codebase. The demo game does not show any of this: it stays a clean game.

## 1. The claim

Patching the world is not, by itself, recursive self-improvement. Each accepted patch makes
the **world** better — one more rule in the library — but leaves the **coder** unchanged: the
next hard request starts from scratch.

The claim is about the coder. While it patches the world, the modder accumulates a
**self-state** of its own:

- **memory** — what happened on every request and what it learned from it;
- **skills** — procedures and tools it wrote for itself and keeps using;
- **harness** — the shape of its own working loop, which it edits.

RSI is shown when the skills and harness it forms *on its own*, while doing world patches, make
it better at **harder coding tasks it was never trained on** — not just faster at more patches
of the same kind. The model weights stay frozen; the improvement lives entirely in the
self-state, which is code and text we can read, version, ablate and roll back.

## 2. Why this world is a good place for it

| Property | Where it comes from |
|---|---|
| An endless stream of **real** coding tasks | every undefined interaction a player reaches is a task; `npm run coverage` enumerates the untouched space (item × target × verb) as a curriculum |
| A **free, executable verifier** | `validatePatch`: schema, ontology, conflict at equal specificity, sandbox replay, the patch's own tests, regression — objective feedback with diagnostics, no human grading |
| **Difficulty that rises by itself** | the larger the rule library, the more a new rule can conflict with, the deeper the chains it joins (fire → ash → fertilizer), and the more often a request needs a new primitive rather than a new rule |
| **Credit assignment** | every rule carries provenance (request, author, time); every self-state change can be tied to the episodes that produced it |

The world and the coder grow together: a bigger world poses harder tasks; a stronger coder lets
the world keep growing.

## 3. Three loops

```
inner   player → undefined interaction → ModRequest → patch → validatePatch → rule library
middle  episodes (request, attempts, diagnostics, outcome) → memory, skills
outer   memory + skills → proposed harness / skill changes → meta-validation → new self-state
```

- **Inner** is the Mod port as built today (design.md §8).
- **Middle** runs after every episode: it records it and distils what is worth keeping.
- **Outer** runs periodically: the modder proposes changes to how it works; they are kept
  only if they do not make it worse (§5.3).

## 4. The self-state

A directory next to the rule library, versioned the same way (append-only log + git), so any
change can be traced, reverted or ablated:

```
modder-state/
  memory/
    episodes/<request-id>.json     # request, every attempt, validator diagnostics, final patch
    lessons.md                     # distilled rules of thumb, each linked to its episodes
  skills/
    <name>/SKILL.md                # when to use it, how, examples (procedural skill)
    <name>/tool.ts                 # optional executable tool, run in a sandbox
    index.json                     # usage count, success rate, cost, provenance
  harness/
    pipeline.json                  # the working loop: stages, tools per stage, retries, checks
    CHANGELOG.md                   # every accepted harness change and the evidence for it
```

### 4.1 Memory

- **Episodes** are written for every request, successful or not, with the validator's exact
  diagnostics (`unknown status "hogtied"`, `conflicts with core/talk at equal specificity`,
  `replay: still undefined`).
- **Lessons** are distilled from episodes after each one ("liquids are selected by tag, not by
  vessel type", "a spread needs chance < 1", "to special-case, add a constraint, don't edit
  the general rule"). Each lesson links to the episodes that support it; lessons contradicted
  by later episodes are revised or dropped.
- **Retrieval**: for a new request, similar episodes (by roles' types, tags, statuses and the
  near-miss rules) and the lessons they cite are put in front of the modder.

### 4.2 Skills

- **Procedural skills** (markdown): e.g. *elemental reaction* (the pattern, the conflicts to
  check with existing reactions, the test scenarios to write), *generalize a selector* (from
  the instance in the request to the widest class that stays plausible), *extend a chain*
  (hook a new product into an existing loop: ash → fertilizer).
- **Tool skills** (TypeScript, sandboxed, with access to the ModSpec, the rule library and
  the sandbox replay): e.g. a scenario builder, a pre-submit conflict finder, a coverage probe
  that lists which neighbouring interactions a draft rule would also answer.
- The modder is prompted to write a skill when the same kind of work recurs; a skill is kept
  while it raises validation pass rate or lowers cost on the episodes that used it, and retired
  otherwise. Usage and outcomes are recorded in `index.json`.

### 4.3 Harness

`pipeline.json` describes the modder's own loop: its stages (comprehend → query → design →
review → describe, as in BardOS), which tools and skills each stage may call, how many repair
rounds follow a rejection, whether to decompose a request into several rules, when to write
tests first. The modder may propose edits to it — add a pre-submit self-check, a retrieval
step over the rule library, a decomposition stage, a sub-agent for test writing.

## 5. Guard rails

1. **The engine stays the trust boundary.** Whatever the self-state becomes, every patch still
   goes through `validatePatch`. A modder that learns to cheat the verifier gains nothing.
2. **Tools run sandboxed**, with read access to the ModSpec, rule library and replay, and no
   write access to the world, the engine or the rule library.
3. **Meta-validation for harness and skill changes**: a proposed change is replayed on a fixed
   set of recorded requests; it is accepted only if pass rate does not drop and cost does not
   rise beyond a margin. The replay set and the external benchmark (§6) are disjoint.
4. **Everything is versioned.** Rolling back the self-state to any earlier point is one command;
   ablations (no memory / no skills / frozen harness) are checkpoints with parts removed.

## 6. Measuring improvement

Out of scope for this codebase; recorded here so the pieces fit:

- The team evaluates on an **external coding benchmark**, once at the start and again at
  several points as the world grows.
- What this codebase must provide: **snapshots** of the self-state at those points, a way to
  run the modder with a given snapshot on arbitrary coding tasks (the self-state must not be
  world-specific in its interface), and the logs that explain what changed between snapshots.
- World-side numbers that go with each snapshot: rule-library size, patches accepted, repair
  rounds per patch, validation pass rate, and the coverage report.

## 7. Build order

1. The modder service (port BardOS's pipeline) with the self-state layout above, read and
   written on every request — memory first.
2. Skills: the writing prompt, the sandbox for tool skills, usage bookkeeping.
3. Harness as data, the proposal step and the meta-validation gate.
4. Snapshot/export of the self-state for the external benchmark runs.

Model choice and budget are deferred.
