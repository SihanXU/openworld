# Regression set keeps a player's act scene as it was after the act, so replays resolve as undefined and every later patch is refused

## What is wrong

`ModPort.observe` builds the scenario for a player's act only after the act has run. The scene therefore lacks whatever the act used up or changed (a bread eaten, a log split). When the regression set replays that scenario, the act no longer resolves, because the item it needs is gone. The validator then refuses every later patch with "an act resolved by ... became undefined", even when the patch has nothing to do with that act.

## Expected behaviour

- The scene of a player's act is captured before the act is dispatched, and the regression entry stores that scene together with the id of the rule that answered.
- Example: a player holding an apple does `use` on themself and `use/eat` answers. The apple is gone from the world afterwards. The regression set still has exactly one entry, and its scenario still contains the `item/food/apple` entity. Replaying that scenario resolves as defined, by the same rule recorded in the entry.
- A patch for an unrelated behaviour (for example, a rope binding a creature) validated against a regression set containing that entry produces no errors.
- Only acts by the player are captured. Moves, and anything that is not an `act/*` event, are not added to the regression set, as before.
- If the scene cannot be built, the act is simply not recorded. This must not break the act or the engine.
- The regression set keeps its existing cap of the 40 most recent entries.
- Acts that are not defined (no rule answered) are not recorded, as before.

## Requirements

- The engine asks the undefined-sink for the scene before it dispatches a player's act, and only for player-origin acts.
- After dispatch, the engine passes that earlier scene, along with the answering rule's id, to the sink's `observe`.
- `ModPort` builds the scene on request and stores it in the regression set on `observe`. It does not rebuild the scene from the post-act world.
- A sink that does not provide the new scene hook keeps working. `observe` is called without a scene and records nothing.
- Existing behaviour of the sink for raising undefined acts and ticking is unchanged.

## Interface

- `UndefinedSink.scene?(ev: GameEvent): Scenario | undefined` in `packages/engine/src/engine.ts`. It is optional and returns the scene of a player's act before it happens.
- `UndefinedSink.observe?(ev: GameEvent, rule: string, scene?: Scenario): void` in the same file. This is the existing method with a new optional third parameter.
- `ModPort.scene(ev: GameEvent): Scenario | undefined` in `packages/engine/src/mod.ts`. It returns `undefined` for non-`act/*` events and for `act/move`.
- `ModPort.observe(ev: GameEvent, rule: string, scene?: Scenario): void` in `packages/engine/src/mod.ts`. This is the existing method with the new optional scene parameter.
