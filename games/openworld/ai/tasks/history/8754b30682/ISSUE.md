# Playthrough fixes, part 1: the wait on the model is said and can be skipped, a flying companion does not block placing, attended people hold their round

## What is wrong

A full playthrough on a new save showed several problems:

1. **The wait on the model looks like a freeze.** While the world works out the outcome of an act the player made (an act with no defined rule), nothing on screen says so. The player cannot choose to stop waiting.
2. **A skipped act is replayed later.** If the player gives up on waiting, the act's default runs. A late answer then completes the act anyway, behind them. Example: a skipped "hands on the oil flask" picks up the merchant's oil ten seconds later.
3. **A flying companion blocks placement.** With the fairy hovering over a tile, pressing G (put) there targets the fairy, and nothing can be set on the ground beneath it. The tutorial's wall-building step cannot be completed while the fairy sits there.
4. **People on a round chase the player.** Handing bread to Tobin or herbs to Wren means following them, because they keep walking while the player stands beside them and faces them.
5. **Autosave runs while the player is in danger.** The worker's own minute save, and the saves on arriving on a map or as the story moves, can capture a state mid-fight. "Load from before the fall" can then load the lost fight. The client also has a duplicate autosave of its own.
6. **The tutorial does not say where the ceiling is laid.** The ceiling is drawn one tile higher than where it is set, which confuses players.
7. **A new thread's toast in Chinese shows the model's English doc** instead of the rule's label.

## Expected behaviour

**The wait**
- While the player's act waits for the model, a line shows mid-screen: the world is working this out, with seconds elapsed so far and the maximum wait. It exists in English and Chinese, and it mentions that Esc stops the wait. It disappears when the wait ends.
- Esc during that wait does not wait: the act's default runs immediately. Esc does nothing special when no wait is shown.
- An act whose wait was declined (Esc) and whose answer arrives late: the answer is still learned (the rule is added to the library and the record is patched), but the act is **not** replayed.
- An act that timed out (not declined) and whose answer arrives late still completes the act, as before.

**Fairy and placement**
- With a flyer hovering on the aimed tile, the put key (G) targets the thing on the ground under it (so a wall can be set down), and the plan's verb is `put`.
- The hands key (E) on the same tile still targets the flyer (talks to it).
- A flyer is skipped only when the key has no plan for it and a lower layer has one. Otherwise targeting is unchanged.

**Attended people**
- A person on their own round (schedule, home, idle; never a threat reaction) holds it for a few turns (about a dozen of their turns) while another agent stands beside them and faces them. This applies only to a player-like agent with no round of its own (not an NPC, not an AI-driven creature).
- Afterwards they go on with their round. The hold ends if the other stops facing them, and the count resets then.
- A person never holds for another person on a round (two would hold each other forever).

**Saves**
- The worker's periodic save (each minute, on arriving, as the story moves) is postponed while the player is in danger: hurt within the last 15 seconds, or a hostile creature within 8 tiles on the same map.
- The client's own duplicate autosave is removed.

**Text**
- The tutorial's house objective hint and the "Warm!" story line say: point just above your head (the ceiling is drawn a tile up), then hold G and choose the ceiling. Both English and Chinese.
- In Chinese, a new thread's toast uses the rule's label. If the label has no placeholder (it names no one), use it; otherwise show nothing extra. In English the doc is used as before.

## Requirements

- A declined fallback marks the record so a later submitted answer is learned but never replays the held event.
- A timed-out fallback (the default) behaves exactly as before.
- The worker reports the wait (seconds elapsed, limit) with each frame while the player's act is being asked about, and none otherwise. The limit is the one that applies to the kind of wait in progress.
- The client accepts a "skip learning" message and applies the declined fallback to the act currently being asked about.
- Targeting changes affect only the first layer when it is a flyer (tagged airborne) with no plan for that key.
- Attendance never extends beyond a fixed small number of turns while the other stays facing.
- Danger is measured in game ticks (about 150 ticks, i.e. 15 s) and by tile distance (8). Hostility is judged by the engine's own hostility relation.

## Interface

- `ModPort.fallback(id: string, declined?: boolean): void` in `packages/engine/src/mod.ts` — `declined` defaults to `false`.
- `UndefinedRecord.declined?: boolean` in `packages/engine/src/mod.ts`.
- `ToWorker` gains `{ t: 'skipLearning' }` in `packages/client/src/protocol.ts`.
- `FromWorker` `'frame'` message gains optional `learning?: { seconds: number; limit: number }` in `packages/client/src/protocol.ts`.
- `Hud.learning: boolean` and `Hud.setLearning(l: { seconds: number; limit: number } | undefined): void` in `packages/client/src/ui/hud.ts`.
