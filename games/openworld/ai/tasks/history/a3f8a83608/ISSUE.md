# Unify scenes and companion beats into one story script (steps)

## What is wrong

The engine has two parallel mechanisms for the story's script. Scenes (scripted, control-taking sequences) live in the `Scenes` system and `WorldIndex.scenes`. Beats (the tutorial's non-blocking steps with a companion line) live in the `Companions` system and `WorldIndex.beats`. They overlap heavily: both have triggers, both play once and are recorded as facts, and both write only the story's own props and send events to others. But they use different condition types, different fact names (`seen.<id>` vs `beat.<id>`), different check cadences, and different homes in the code.

Objective guides (`@objective`) and the hint (`@hint`) belong to the story's script but are currently hosted by the companion system. The companion should be about following only.

## What is wanted

One story system with one kind of definition, a **step**. A scene is a step that has a script and takes control while it plays. A beat is a step with no script, just facts, stage props, a companion line and a hint. Guides and hints move to the story. Companions keep only following.

Older saves must still load: their `beat.*` records become the new step records.

## Expected behaviour

**Step definition.** A step has an id and a trigger, with these conditions (all optional, all must hold):
- `map`
- `region` (the leader stands in a region of the map)
- `hour` (a range, which may wrap past midnight)
- `weather`
- `facts` (compared against the story's facts)
- `props` (stage props on the leader)
- `carrying` (the leader holds or bags something of a type with this prefix)
- `skill` (any skill, or a named one)
- `after` (another step has played)
- `near` (a type within r tiles of the leader)

A step may also be `manual` (never triggered by itself; only started by an effect) or `repeat` (plays once per day). It may carry:
- `script`: if present, it takes control while it plays, as scenes do now
- `facts`: set on playing
- `props`: stage props the story tells the leader
- `say`: a line the companion speaks in a bubble
- `hint`: what the companion repeats when spoken to

**Playing.**
- A step plays once. On playing, `seen.<id>` is set to the current tick.
- A repeating step also sets `seen.<id>.day` to the current day, and does not play again the same day.
- A step without a script also sets `step.last` to its id, which is what the hint is taken from. A scripted step does not.
- Its facts are set, the leader is notified of its stage props, and the companion says its `say` line if there is one.
- A step with a script takes control until the script ends.
- The `after` condition is satisfied by `seen.<id>` of the other step.

**When steps are looked at.**
- A step with a `region` is checked when the player enters a region and when another step plays or a script ends. It is never polled.
- All other steps are checked every three ticks, only when nothing holds control.
- Only one step plays per check, and beats come first.

**Guides and hint.**
- `@objective` text now comes from the story's guides (same output as before).
- `@hint` text comes from the story: the hint of the step named by `step.last`, falling back to its `say`.
- The companion no longer holds beats, guides, or checks.

**Content and wiring.**
- The world index carries `steps` in place of `scenes` and `beats`.
- The engine exposes the story as `engine.story` in place of `engine.scenes`. It offers `advance()` to move past a said line, and `start(id)` for the scene effect.
- The prologue's beat list is typed as steps with step conditions.
- Anything that cleared `scenes` and `beats` from a world index (the boss challenge, the boss gallery, tests) now clears `steps`.

**Older saves.**
- Loading a save whose story has `beat.<id>` props turns each into the fact `seen.<id>` with the same value. It does not overwrite an existing `seen.<id>`.
- `beat.last` becomes `step.last`.
- The old `beat.*` props are removed from the story.
- A legacy `lastBeat` field also becomes `step.last`.
- After the migration, the hint comes from the latest step.

**Prologue.** Prologue and quests behave as before. The relic beat is a region step, so the player must walk into the relic's ground for it to fire. Being placed already inside the region does not start it.

## Requirements

- Steps and scenes are a single concept and a single list in the world index.
- Region steps are triggered by entering a region (or by another step playing or ending), not by polling.
- Non-region steps are checked every three ticks, one at a time, while no step holds control.
- Beat facts use `seen.<id>`; the latest beat is `step.last`. No `beat.*` facts are written any more.
- Old saves with `beat.*` story props migrate on load as described above and still give the right hint.
- Companions only follow. They no longer own beats, guides, objective text or hint text.
- `@objective` and `@hint` resolve through the story.
- The existing prologue and quest flows, and boss and cell tests, still work with the renamed API.

## Interface

In `packages/engine/src/story.ts` (replaces `scenes.ts`, and is exported from the engine's index):

- `class Story`, available as `engine.story`:
  - `advance(): void`
  - `start(id: string): boolean`
  - `hint(): Text | undefined`
  - `objective(): Text | undefined`
  - `entered(who: Ref): void`
  - `met(c: StepCond, lead?: Entity): boolean`
  - `eligible(d: StepDef): boolean`
  - `load(steps?: StepDef[], guides?: Guide[]): void`
  - `tick(): void`
- `interface Guide` (moved from `companion.ts`)
- `StepDef` and `StepCond` types, exported from the engine (the step types come from the engine's types, and the prologue imports them from `@lsw/engine`)
- `WorldIndex.steps?: StepDef[]` (replaces `scenes` and `beats`)
- Facts: `seen.<id>`, `seen.<id>.day`, `step.last`

Removed: `engine.scenes`, `Scenes`, `Beat`, `BeatCond`, `WorldIndex.scenes`, `WorldIndex.beats`, and the companion's `load`, `objective`, `tick`, `met` and `hint`.
