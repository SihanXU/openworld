# Parallel designs in lanes; created things are made of something; an economy check as a linear programme

## What is wanted

Three related changes to how the modder admits patches.

**1. Designs run in parallel, in lanes.** Today the modder works one design at a time. It should work several at once (the harness's `concurrency.design`, default 4, live requests first). Requests whose patches would be written in the same place must not run side by side: they queue in one lane, so the later one sees what the earlier committed and is often answered by it ("covered") rather than designing again. Requests in different lanes are designed concurrently, each in its own sandbox, and the commit re-validates against the library as it is then.

**2. Every type the AI creates is made of something.** A new type must name `props.material` (one of the world's materials) and a `makeup` (what it is made of, and what it leaves when broken). This applies to every new type, not only ones that can break. A breakable type may instead give its own rule on `threshold/cross` "broken" in place of a makeup. A patch must never define a new ground (`tile/*`), since that leaves cells floorless. The create-stage prompt must tell the AI all this, including the list of materials and the stations. A new type that names a `station` must be craftable as soon as its patch is applied.

**3. An economy check.** Every conversion in the world is a "step" (what it takes, what it gives): a derived recipe, breaking a thing down into its makeup, and each leaf of a rule that uses up an item or takes one in. A mix of steps, each run some number of times, that leaves nothing fewer and something more is a free lunch. Detect this over mixes of any length (not just one or two steps), and have the modder refuse a patch that introduces one, naming the steps and what they make. The base content must have none.

## Expected behaviour

- **Lanes.** Two requests with different event kinds or different host classes are designed at the same time (two at once with a concurrency of 4). Two requests with the same event kind and the same host class (host type's first two path segments, e.g. a slime and a wolf, both under `actor/creature`, offered rope) are in the same lane: only one design runs, and the second is answered as covered by what the first committed (one design in total, outcomes accepted and covered). A request with no host has a lane of its own for its event kind.
- **New types.**
  - A new type without `props.material` is rejected with a message mentioning `props.material`.
  - A new type with a material but no makeup (and no own broken rule) is rejected with a message mentioning `makeup`.
  - A makeup entry naming a type that doesn't exist still gives `makeup[0]: unknown type "…"`.
  - A new type with id under `tile/` is rejected with a message saying a patch cannot make a new kind of ground.
  - A type with `station: 'hands'` (or a workbench) and a valid makeup, once its patch is submitted, appears in the engine's recipes with the makeup as needs and that station.
- **Economy.**
  - A patch with a rule making a club on a workbench come apart into two logs is refused: the error contains "economy", names the recipe for the club and the new rule, and says what ends up more (e.g. "leave more item/material/log (+N…").
  - The same rule yielding one log (what went in) is accepted without an economy error.
  - A cycle of three steps (A→B, B→C, C→A, each 2 in for 3 out) is found as a free lunch using all three steps, even though no pair shows it. Two steps where the round trip loses (A→2B, 2B→A) show none.
  - The base content's steps (recipes, breaking down with the recovery fraction, rules) have no free lunch at any length.
  - A patch is refused only for a free lunch it introduces; one already present among the world's own conversions without the patch isn't blamed on it.

## Requirements

- The default design concurrency is 4 in the default harness (and the modder's fallback when unset); document that it is one per lane.
- Requests in the same lane are strictly serialized, FIFO; the lane is released even when a design fails; lanes in different keys never block each other. Live requests still get priority for the concurrency slots.
- A request that waited in a lane is re-checked against the library as it then is, so it can be answered by what was committed meanwhile.
- Material and makeup are required for all new types, with the existing check that the material is a real material and that makeup types exist (in the world or defined by the same patch) with positive counts.
- The `tile/*` refusal is part of the new-type problems and is reported with the other problems.
- Applying a patch that defines any type derives recipes again so newly craftable things appear immediately.
- The create prompt shows the example type with material, makeup and optional station; lists the world's materials; explains makeup is also what it leaves when broken (so it takes no more than the outcome took to make); says when to use a station; and says new ground can't be made.
- Steps from rules: for each leaf of a rule's tree (branches exclusive), what it takes is an item host that is used up (destroyed or transformed into something concrete) and/or an item put into the host's contents; what it gives is what it spawns and what the host becomes. A leaf that takes nothing or gives nothing is not a step.
- Breaking down a breakable type with makeup is a step that takes one of it and gives the makeup scaled by count, chance and the recovery fraction.
- The free-lunch search is an exact linear programme (maximise total net gain, each step run between 0 and 1 times, no thing ending fewer), and the result gives the steps with how often each runs and what each thing gains.
- Only steps connected (sharing a thing) with the patch's new steps are considered for blame; if the pre-patch steps alone already contain a free lunch, the patch is not refused for it.
- Validation runs the economy check only after the ordinary validation passes, adding its message to the errors and setting `ok` false. The message tells the modder how to fix it (make the outcome take as much as it gives, or give less).

## Interface

All in the modder package unless noted; exported from the package index.

- `laneOf(req: ModRequest): string` — in `packages/modder/src/pipeline.ts`. Returns the lane key: event kind plus the host type's first two path segments (a placeholder when there is no host).
- `freeLunch(steps: Step[]): FreeLunch | undefined` — in `packages/modder/src/economy.ts` (new file, re-exported from `packages/modder/src/index.ts`).
- `economySteps(onto: Ontology, rules: Rule[], recovery: number): Step[]` — same file. All conversions from the ontology (recipes, breakdowns) and the given rules. Step names are of the form `recipe <id>`, `break <id>`, `rule <ruleId>[<path>]`.
- `ruleSteps(rule: Rule, onto: Ontology): Step[]` — same file.
- `connected(steps: Step[], seed: Step[]): Step[]` — same file; the steps that transitively share a thing with the seed.
- `simplexMax(A: number[][], b: number[], c: number[]): number[]` — same file; maximises c·x subject to A x ≤ b, x ≥ 0, with b ≥ 0.
- Type `Step = { name: string; takes: Map<string, number>; gives: Map<string, number> }`.
- Type `FreeLunch = { gain: number; uses: { step: string; times: number }[]; makes: { type: string; n: number }[] }` — `times` scaled so the largest is 1; `makes` lists what the mix leaves more of.
- `createUser(creations: Creation[], materials?: string[]): string` — in `packages/modder/src/prompts.ts`; the new optional second parameter is the list of material names to show.
- `Harness.concurrency.design` default changes to 4 (`packages/agent/src/state.ts`).
- `newTypeProblems` (engine) additionally reports the missing material, missing makeup and `tile/*` problems described above; `ModPort.submit` additionally derives recipes into `eng.recipes` when a patch contains a type artifact.
