# Make the event model hold by construction: every change is an outcome, and an outcome writes only its host

## What is wrong

Systems added after the event-model migration change the world outside events:

- Companions and the tutorial's beats, quests, professions and the skill tree, combat talents, the seven sins and the night all write state from code.
- Striking Pip down changes nothing the world can answer.
- Quests write the player's bag from a person's rule.
- The night makes and unmakes creatures from code.

The only guard is `world.strict`, which is on only in tests, and any code can take the writer. The two rules that every change is an outcome (A2) and that an outcome writes only its host and what it holds or makes (A3) are therefore not enforced.

## Expected behaviour

**The writer.** The world's mutators (create, destroy, place, setTerrain, setFact, prop and status writes, and so on) throw unless the engine's single writer has been lent to the caller. The writer is lent only to:

- outcomes, while an event's effect is applied;
- the clock;
- loading;
- the input's posture (facing, selection and the like);
- the author: tests, building, migrations, the dev console and the like. The author lends it explicitly through a call that takes a function and returns that function's result.

Inside an outcome, the mutators also throw when the target is not one of these:

- the event's host;
- something the host holds;
- something that outcome made.

Facts may be written only when the host is the story (a resident) or the world. An error thrown by such a write is never swallowed as a rule warning. The old `world.strict` switch no longer exists, because the guard is always on.

**The systems become events.** Each of these changes state only through acts, impulses and outcomes:

- **Companion.**
  - Each hop is an act of moving. When struck down it cannot follow, and it reports `stuck` (activity `follow`).
  - That event is undefined at the root, so the AI answers. With no AI it waits, comes to, and follows again.
  - Striking Pip down now changes something the world can answer.
- **Beats.**
  - The story keeps the facts and notifies the leader of its stage.
  - The person keeps the prologue stage in a prop.
- **Experiments.**
  - The count comes from a companion seeing an act whose chain reached an undefined outcome. The story counts it as `world.experiments`.
  - The `defined` param of `seen` now means that the act and everything it set going were all defined.
- **Quests.**
  - The person tells the story, and the story's quests effect writes the quest facts.
  - The reward is spawned into the taker's bag.
  - Experience and stage reach the taker as notices it keeps itself.
  - What was to be brought is taken by the giver. A handed-in quest item goes into the giver's bag instead of vanishing.
  - A defeat is counted when the defeated creature's rule notifies the story with its type. The emit effect needs a param form that resolves to the type of a role, written `{ typeOf: <role> }`.
- **Learning.** Skills and professions are learned through a new act `act/learn`, which has a root rule and a `learn` outcome, like `craft`.
- **Talents.**
  - A strike carries `bleed` and `drain`.
  - The struck one's `hurt` opens a `bleeding` status and sends a `restore` back to the striker.
  - `adrenaline` is a status.
  - Arcane Recovery and Shadow Recovery are rules on the defeat notice, which now carries the last blow's instrument.
- **Acts of moving.** The dash and waypoint travel are acts.
- **Sins.**
  - A sin's blow, when its telegraph runs out, is an act (`use` with its own body on the aimed tile) answered by a `release` outcome.
  - `release` sends strike, push and coat impulses to the victims, who answer them themselves.
  - A coat of `mired` or `entranced` adds that status.
- **Night.**
  - The world's `night` period makes creatures `appear`: zombies and bats, outdoors, between 21:00 and 05:00, up to a cap, tagged `nightborn`.
  - The night-born crumble by their own `dawn` period rule in daylight.
- **`visited.<map>`.** It is the traveller's own prop. The `met.<id>` fact is dropped, because the person's memory already records the first meeting.
- **Statuses.**
  - A status remembers who gave it, so its time events name the giver. A kill by a fire or a bleed you caused gives you experience.
  - A status may keep its own pulse pace (`every`).
- **Other changes.** `heal` rounds up. `migrateBosses` lives in its own content file rather than in the sins file.

## Requirements

- The mutators throw unless the writer has been lent. Outcomes, the clock, loading, the input's posture and the author lend it, and nothing else can take it.
- Existing code that legitimately builds or changes the world outside events (scenario building, migrations on loading, the dev console, the boss gallery and challenge set-up) runs under the author.
- Inside an outcome, writes beyond the host, what it holds and what it makes throw. Fact writes throw unless the host is the story or the world. Write errors propagate and are not turned into rule warnings.
- No source in the engine or content writes the world behind the mutators (for example by assigning to entity fields or state directly). `author` and `grant` are used only in the places where they are allowed. This must be checkable by scanning the source.
- The companion, beats, experiments, quests, learning, talents, dash and waypoint travel, sins and night behave as described above, purely through events.
- A status records its giver, and a status definition may set its own pulse pace.
- Existing behaviour that does not change above is preserved. The full suite, the typecheck and the world check pass, and design.md records the model (§5.15).

## Interface

- `Engine.author<T>(fn: () => T): T`, in the engine. It lends the writer for the duration of `fn` and returns its result. The same call can be nested.
- `World.author<T>(fn: () => T): T`, in the engine's world. It does the same at the world level, so a nested call is accepted inside `Engine.author`.
- `World.grant`, in the engine's world. It is the single lending point that claims and lends the writer. It is internal, and no code outside the allowed places may call it.
- Removed: `World.strict`. The guard is always on.
- `NIGHT_EVERY` and `NIGHT_CAP`, exported from the engine package, as the night period's cadence and the night-born population cap. `NIGHT_EVERY` is a number of ticks and `NIGHT_CAP` is a count.
- `releaseSkill(eng: Engine, e: Entity, ev: GameEvent): void`, exported from the engine's bosses module. It is the `release` outcome.
- `migrateBosses(game: Game, road?: MapChunk): void`, in `packages/content/src/migrateBosses.ts` and re-exported from the content index. It has the same behaviour as before and is run by the author on loading.
- New act `act/learn`, with the effect ops `learn`, `release`, `quests` and `appear`.
- New emit param value `{ typeOf: RoleName }`.
- New impulses and notices:
  - `impulse/coat` with param `substance`;
  - `impulse/push` with param `dir`;
  - `restore`;
  - notify `what` values `experiment`, `defeat` (now with `type` and the instrument), `prologue` and `reward`.
- Strike params `bleed` and `drain`. The `Strike` result gains `bleed: number` and `drain: number`.
- New statuses `bleeding` and `adrenaline`, each with `every: 10`. `StatusDef` gains an optional `every?: number`.
- New periods `night` (the world's) and `dawn` (hosted by actors tagged `nightborn`).
- New prop `visited.<map>` on the traveller, set when it arrives on a map. The `met.<id>` fact no longer exists.
- Companion type `actor/companion` gains `sight: 8`.
