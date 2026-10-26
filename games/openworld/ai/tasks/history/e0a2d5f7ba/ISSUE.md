# Live AI-interface run on the Ford, effects written as `{op: {...}}`, and a Mod Console template that fails validation

## What is wrong (for a fix)

Three related problems showed up when the modder's AI interface was tried with a real model on the Ford.

1. **There is no way to run the AI interface live on the Ford.** Nothing plays the Ford's different kinds of holes through the game's own path and lets a real model answer them. Without this, the answers' validity, latency and cost cannot be observed.

2. **The model writes effects in the wrong shape.** Asked for a patch, the live model wrote effects as `{"spawn": {"type": ..., "at": ...}}`, with the op as the key. The engine expects one flat object, `{"op": "spawn", "type": ..., "at": ...}`. The notation in the ModSpec's primitives list suggested the keyed form. Such a patch fails validation and costs a repair turn, even though the rule inside it is correct.

3. **The Mod Console's starting-point patch is not a valid patch for some holes.** The template's test expects the host under the fixed key `"host"`. The scenario names that entity under its own key (the role's key), so the expectation fails validation. A patch that is meant to be a starting point should validate for the holes the Ford reaches.

## Expected behaviour

**Live run.** A command, `npm run ford-live`, plays eight scenarios on the Ford. Each reaches one kind of hole through the game's normal path:
- an undefined act (bread used on the winch)
- a receive (the axe put on the dead tree)
- a strike (the axe on the chopping stump)
- a handle (a bare hand on the raft)
- a take (taking the winch)
- an offer (the rope given to a fire slime)
- a person stuck (Hesper unable to tend her soaked fire)
- broken content (the rope burns)

The live modder profile answers each one, with review, reflection and escalation switched off. Every scenario starts from a fresh library and a fresh self-state. For each one the run prints and records:
- the request
- the episode (attempts, errors, fixes, usage, cost)
- the rules written
- what the game does with the patch afterwards (the replay)
- whether anything is still held

An optional argument selects scenarios by a substring of their name. A leading `-` excludes the matching scenarios instead. Results are written under `var/live-smoke/`, and the total cost is printed. The run needs a model configured in the environment.

**Keyed effects.** A rule whose effects are written with the op as the only key, e.g. `{"addStatus": {"status": "wet", ...}}`, is repaired deterministically to `{"op": "addStatus", "status": "wet", ...}`. This applies to effects in a rule's `tree`, including inside `if`/`then`/`else` branches. It also applies to rules written in the flat form (`do` beside the rule instead of in a tree). The repair is recorded among the attempt's fixes, naming the rule and the number of effects flattened. No repair turn to the model is needed. Effects that already have an `op`, or whose single key is not a known primitive, are left alone.

**ModSpec.** The primitives section of the ModSpec states the shape explicitly. Each effect is one flat object naming its op, for example `{"op": "spawn", "type": "item/tool/rope", "at": "target"}`, never `{"spawn": {…}}`. It also says that the listed `name {args}` entries give the fields that sit beside `op`.

**Console template.** For a record, the template's triggering-case test expects the host entity under the key the scenario's event gives it. It looks for that key among `host`, `instrument`, `actor` and `target`, in that order of preference. It checks `exists: true` only when that key is actually an entity in the scenario. When the host is a tile or a resident with no such entity, the expectation list is empty. The resulting patch validates for an undefined act, a receive, a strike and a handle on the Ford.

## Requirements

- `npm run ford-live` exists and runs the eight scenarios above against the live model. It accepts an optional name filter, with a leading `-` meaning "all but".
- The live run records its results to a file under `var/live-smoke/` and prints a total cost.
- Normalising a model's patch flattens effects written as `{op: {...args}}` into `{op, ...args}`:
  - in a rule's tree, at any depth of `if`/`then`/`else`;
  - in the flat-form (`do` beside the rule) case;
  - the arguments may be absent or non-object, in which case only `op` is produced.
- A repaired patch that is otherwise correct is accepted on the first answer, with no extra model call. The fix is listed in the attempt's fixes.
- Effects that already have an `op`, that have more than one key, or whose single key is not a known primitive are not altered.
- The ModSpec's `primitives` carries the flat-shape statement described above, in addition to the existing primitives and the `_roles` and `_amount` notes.
- The Mod Console's `template` is its own module, free of DOM dependencies, so it can be used headlessly. The UI module that previously held it still exposes `template`.
- The template's expectation uses the scenario's own key for the host, and none when no entity of that key exists. The patch it returns validates against the ontology, the library and the record's scenario for the four kinds of hole named above.

## Interface

- `template(r: RecordView): Patch`, in a new file `packages/client/src/ui/template.ts`. It is the same function as before, moved. `packages/client/src/ui/dev.ts` re-exports it.
- npm script `ford-live` in `package.json`, running `packages/tools/src/ford-live.ts`.
- New file `packages/tools/src/ford-live.ts`, a script with no exports.
- The deterministic-repair path in `packages/modder/src/fixes.ts` gains the keyed-effect flattening. No new exported name is added there. `fixes.ts` now imports `PRIMITIVES` from `@lsw/engine`, so that value must be exported from there. If it is not already, it must be.
