# Mechanical repairs for model answers, and derived tests that skip instances a more specific rule answers

## What is wrong

Four problems show up when the modder is driven by a live model, each costing a first answer or teaching the reflection step the wrong lesson:

1. **Slightly malformed JSON is thrown away.** A model writing a deep rule tree often gets only its brackets wrong: one closing `}` too many (an object closed early, so later keys such as `doc` fall into the wrong container), or a closer or two missing at the end. `parseJson` returns nothing for these, so a correct rule is lost.
2. **Terrains named bare.** A model writes `{"kind": "tile", "type": "bush"}` for the bush tile instead of `tile/bush`. The validator only says "unknown type", which does not tell the model (or the user) what the terrain is called.
3. **Derived tests blame the wrong rule.** When a rule's host is a class (e.g. all plants), the harness derives a test by replaying the rule on another instance of that class. If the first instance tried (e.g. flowers) is already answered by a different, more specific rule (another patch, a base rule), the derived test fails and the new rule is flagged as "did not generalize", although nothing is wrong with it.
4. **Unreadable answers get a useless message.** When no patch can be read, the attempt records only "no JSON patch in the answer". This conflates "no JSON at all", "JSON that does not parse", and "JSON without a patch", and the reflection learns a wrong lesson from it. The raw answer is also not kept.

In addition, the curriculum tooling needs to support running with the live profile, sampling by hole, and measuring each patch's reach (see Requirements). Prompts for design and review should also discourage free repeatable gains and lines that read badly when a name slot is the player.

## Expected behaviour

**Bracket repair**
- A string with one `}` too many after a nested object (so a later key lands in an array) parses to the value the author evidently meant: the later key (`doc`) ends up on the right object, and the tree's `then` is intact.
- `parseJson` calls an optional callback when it had to repair brackets, and does not call it for valid JSON.
- A truncated answer (cut mid-tree, more than a couple of closers missing) is NOT completed: `parseJson` returns `undefined`.
- Input whose problem is not brackets yields `undefined` from the repair.

**Bare terrain ids**
- `{kind: 'tile', type: 'bush'}` as a rule host becomes `{kind: 'tile', type: 'tile/bush'}`; a bare terrain in an `is` condition selector (`{type: 'grass'}`) becomes `tile/grass`, including inside nested `all`/`any`/`not` and inside `if` trees. Each qualification is reported as a fix string (a rule with a bad host and a bad condition gives two fixes).
- If a real type of that name exists in the ontology, or is created by a `type` artifact in the same patch, the selector is left untouched and no fix is reported.
- When validation finds `type: "bush"` unknown but `bush` is a terrain, the error says the terrain is named `tile/bush`.
- The pipeline applies this qualification to a drafted patch before validation and records the fixes on the attempt.

**Derived tests**
- For a rule hosted on a class, the derived test is placed on the first other instance that the rule answers, or that is still an open hole. Instances where a different rule already gives a defined answer are skipped. Example: a patch for all plants is tested on something other than flowers if a separate patch already answers flowers; the notes report a derived test on a host and do not mention flowers or "did not generalize".
- If every other instance is answered by a more specific rule, the note says there is no other instance to test on and mentions that the others are answered by more specific rules.
- Candidates from another branch of the type tree are tried before the same family.

**Unreadable answers**
- The attempt's error says which case it is: no JSON at all (keeps the existing "no JSON patch in the answer" wording), JSON that does not parse (with the parser's complaint and where it breaks), or JSON that parses but holds no patch (with the expected shape). The retry message to the model includes that reason.
- The attempt keeps the raw answer (clipped to a bounded length) in a new `raw` field.
- When brackets were repaired, the attempt's fixes include a note saying so.

**Prompts**
- The design and review prompts say that an outcome that makes something must cost or run out (no free repeatable gain). The review prompt and the ModSpec authoring rules say that lines must read right when a name slot is the player ("you"): no verb or possessive directly after a slot.

**Curriculum tooling**
- `npm run curriculum` accepts `--profile live|offline` (default offline), `--by hole` (sample spread over the holes the cells reach, each hole with its share of n and at least two, so rarer questions are not crowded out) and `--data <dir>`.
- After each step the coverage is re-swept; the number of undefined cells that step's patch answered is recorded, with each step as a JSON row in a run file under `<data>/runs/`.
- `npm run curriculum:report -- [<data dir>]` summarises the latest run: steps, reviews, revisions/escalations, failed first drafts, spend.
- Results and open questions are written into design.md §13.

## Requirements

- Bracket repair handles an extra closer and up to two missing trailing closers; anything beyond that is treated as truncation and not completed.
- `parseJson` keeps its existing behaviour for valid JSON, fenced JSON and outermost-`{...}` extraction; repair is attempted only after those fail.
- Terrain qualification never changes a selector whose type already starts with `tile/`, is a real type, or is not a terrain.
- Qualification returns the patch unchanged (same content) when there are no fixes.
- Derived-test selection looks at no more than a small number of candidates and must not flag a rule as non-generalizing because of an instance answered by a different rule.
- Raw answers on attempts are clipped (about 2000 characters).
- The existing tests keep passing.

## Interface

- `parseJson(text: string, onRepair?: () => void): unknown` — in `@lsw/agent` (`packages/agent/src/model.ts`); the optional callback is new. It is reachable from `@lsw/modder`'s index exports (tests import it from there).
- `repairBrackets(s: string): unknown` — `packages/agent/src/model.ts`; returns the repaired value or `undefined`.
- `qualifyTerrains(patch: Patch, onto: Ontology): { patch: Patch; fixes: string[] }` — `packages/modder/src/fixes.ts`, exported from `@lsw/modder`.
- `deriveTests` — already exists in `packages/modder/src/derive.ts`; it must be exported from `@lsw/modder`'s index so it can be imported from there.
- `Attempt.raw?: string` — `packages/agent/src/state.ts`.
- `pickByHole(cells: Cell[], n: number, seed: number, s: Scope): Cell[]` — `packages/tools/src/scope.ts`.
- CLI options `--profile`, `--by`, `--data` for `packages/tools/src/curriculum.ts`; new script `curriculum:report` in `package.json` backed by `packages/tools/src/curriculum-report.ts`.
