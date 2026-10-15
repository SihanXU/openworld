# The right click should be an engine-level action that chooses an act as the base rules answer

## What is wanted

The "action" (the right click, Stardew's action button) is currently decided on the page, in the runtime, from what the keys would do. It lives outside `Controls` and outside its completeness test, and its choice shifts as the world learns. Examples:

- Once the modder answers a hand on a stone, the click stops picking stones up.
- Without a pointer, an assist sends G's gift or F's take to a cell beside the one in front.
- E doubles as the action.
- No input's label is shown anywhere except the chooser.

The action should be the engine's. `Controls` should be able to plan it, choose it, and list it in the chooser. It should choose as the base rules answer, so learning never changes which act it makes.

Alongside this:

- A press and a choice should be told apart.
- Plans should say when a learned answer decided them.
- Plans should say when the AI setting turns the kind of work off.
- The catalogue should supply the cursor's glove.

## Expected behaviour

**The action, `plan('action', aim, layer?)`, makes one of the other acts:**

- **Someone, or a companion:** a word (the hands' act). Whatever is held is not handed over. An axe in hand is not given to the smith; handing over is G alone.
- **A thing the bare hands do something with** (a chest opens, something is read, a bed is slept in): that hand.
- **A thing that can be taken, where the hands do nothing known** (a stone): a take.
- **Another's thing** (the plan reports `steal`): nothing. Taking it is F's alone.
- **The ground:**
  - a hand that does something there, else
  - a built thing or a fixture in hand, set down (G's act, e.g. a bed), else
  - the held thing used on oneself where that does something (bread eaten), else
  - nothing.
  - A use the world has never seen is not offered on open ground.
- **Pointed at oneself:** any use of what is held, including one the world has never seen (the modder's).
- **Any other thing:** the bare hands' experiment, unknown if the world has never seen it. This is chosen over using the held meal on oneself.
- **Nothing to act on:** no plan.

**Base rules, not learned answers.** A plan whose result came from a learned answer (a patch filling a hole) is marked `learned`. The action counts such a plan as none. With a learned hand on a stone, E still does the learned thing, but the action still picks the stone up.

**Lessons.** A lesson's locked inputs (`def.allow`) are passed over silently, with no refusal shown.
- A lesson allowing only `move`, `select`, `self` with bread in hand makes the action a use on oneself.
- A lesson allowing only `move`, `take` makes the action a take, even over a chest sharing the cell.

**Held long (the chooser).** `choices('action', aim)` lists the action on each layer. On one's own place, oneself comes first. For each entry, `plan('action', aim, layer)` equals the entry's plan.

**A press versus a choice.** The signature is `plan(key, aim, layer?)`. A given layer means the layer was chosen.
- A press never strikes oneself.
- A press never strikes the bare ground the world has never seen struck. A fist on grass asks nothing.
- The chooser still makes both. Use on one's own place is chosen as use on oneself and listed as one layer, not the ground's layers followed by the use on oneself.
- The completeness test must again ask for the blow on oneself and check that no press makes it.

**Without the pointer.** E, F and G act on the cell in front. The assist that moved a key to a neighbouring cell is gone.

**E is a hand again.** E no longer doubles as the action; the right click alone is the action, and it always points.

**The "?" and quiet.** Where the AI setting turns the kind of work off for an unknown outcome, the plan is marked `quiet`. Nothing is asked, and the leaf's default comes. With `things: 'off'`, a hand on a never-seen stone is `unknown` and `quiet`; with it on, it is not `quiet`.

**The frame's view of the keys.** The frame carries what each input would do, the action among them. A view can say that it changes nothing (`idle`), and the action's view says which act it makes (`act`).

**The tip (runtime).** A small tip over the frame says what each input would do there, in the rules' labels.
- With the pointer: the right and left click, then E, F and G where they do something else.
- Without the pointer: E, F and G in front.
- A hand on the ground that changes nothing goes unsaid.
- It appears only once the player stands and the frame has rested.
- It sits on the frame's far side from the player, so it neither lurches with steps nor flickers as the pointer sweeps.
- The floating mark is gone.

**The cursor's glove.** It comes from the catalogue's `ui.cursorHand` in both games, not OpenWorld's `item:gloves`.

**Removed.** `packages/runtime/src/action.ts` and its page test are gone. The action's table is held in the content's controls tests on real things, with a learned answer among them.

**Out of scope.** The Nix environment leaves this change.

**Text.** Update design.md §5.2/§5.3 and D8, CLAUDE.md, README, the controls table, the main quest's hint and the wiki pages (操作, 界面, 背包). They should say: E is a hand, F takes, G puts or hands over, the left click uses what you hold, and the right click does what a thing calls for.

## Requirements

- `Controls.plan('action', aim, layer?)` exists and follows the table above. `'action'` is a valid `Key` for `plan`, `planFor` and `choices`.
- The action chooses by base-rule answers: any plan marked `learned` or `unknown` is treated as no answer when deciding between hand, take, put and self. The exception is the experiment on a thing the hands could try, and oneself pointed at.
- The action never steals, and never gives away what is held.
- `Plan.learned` is set when a learned answer (a patch) is in the rule chain that decides the plan.
- `Plan.quiet` is set when the plan is unknown and the AI-quality setting for that kind of work is `off`.
- Presses (no layer) never produce a blow on oneself or a fist on never-seen bare ground. Choices (a layer given) can.
- The completeness test must still hold. Every act the player can do must be reachable by some press or choice, including the blow on oneself via a choice. Every plan produced by the action has the verb of the act it makes (`hands`, `take`, `put`, `use` or `self`). The same inputs always give the same plan.
- A flyer over the spot that the action has nothing sure to do with is not in the way. The action goes on to what is under it, but still talks to a flyer that is someone.
- `planFor` works with `'action'`.
- Runtime: the page sends the action as its own input, with no page-side decision. `action.ts`, its test, and the page-side hand-off waiting for the worker are removed. The tip, the quiet "?" and the catalogue glove are in place as described above.
- The `cursorHand` entry is present in both games' catalogues, and the runtime catalogue type documents it.
- The main quest's stage-30 hint (English and Chinese) describes the inputs as above.

## Interface

- `Key` (exported from `packages/engine/src/controls.ts`, and from the engine package) widens to `Plan['key'] | 'action'`.
- `Controls.plan(key: Key, aim?: Aim, layer?: number): Plan | undefined`. `layer` is optional; omitted means a press, and a given value means a chosen layer.
- `Controls.planFor(key: Key, aim: Aim | undefined, layer?: number, shown?: Ref): Plan | undefined`.
- `Controls.choices(key: Key, aim?: Aim): { layer: number; name: Text; plan?: Plan }[]`. It accepts `'action'`.
- `Controls.talksTo(r: Ref): boolean`. It is true for a person or a companion.
- `Plan.learned?: boolean`, in `packages/engine/src/types.ts`.
- `Plan.quiet?: boolean`, in `packages/engine/src/types.ts`.
- `Frame.keys` gains an optional `action?: KeyView`.
- `KeyView.idle?: boolean`.
- `KeyView.act?: 'hands' | 'take' | 'put' | 'use' | 'self'`.
- Catalogue `ui.cursorHand`, a 16×16 sprite `Items/Action/Interact.png`, in `games/starter/catalog.json` and in `games/openworld/client/src/catalog.ts`.
