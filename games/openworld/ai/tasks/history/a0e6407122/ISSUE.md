# Fixes from an eight-hour play session: saves, sleep, labels, eggs, and the modder's waits

## What is wrong

An extended play session (tutorial, chapter 1 through the finale, Haven, the modder live and offline) found a set of defects across the client, engine, content, demo, modder, and agent.

**Client**
- "Save and return to the title" opens the title before the worker's `saved` message arrives. The title reads the slot from storage too early, so Continue loads an older save (data loss).
- On every load the client replays the shared patch log from seq 0. Patches are rejected again, and a patch removed in the Mod Console comes back.
- A patch synced from the shared log loses its request id, so the Threadbook doesn't credit the player's own revision to the player.
- Sleep is one long step. The worker blocks for several seconds, the clock doesn't show the night passing, and a second E while asleep sleeps another day.
- In the tutorial the world map is empty, because the clearing has no place on the overworld layout.
- The dev `hour` op can set the clock back. Cooldowns and timers are ticks and end up in the future, so the player can't move or strike until time catches up.
- The quest log doesn't list finished quests, and the shop tab doesn't refresh while open.

**Engine and content**
- Using a worn item on oneself still offers "Put on", and a worn weapon never reads as wielded or put away. There is no condition to ask whether a thing is worn.
- `transform` drops the host's material and quality from its name (a "master" bucket filled loses "master").
- `breakdown` puts parts and spill at the host's own z, so planks hang in the air when the host stood on a raised level (z=1).
- Hens lay without limit. The pasture caught up 704 eggs on entry and a save reached 1.35 MB.
- A single freeze-water cast freezes a whole river row, because even the weak spread keeps spreading.
- A first greeting still plays after the NPC has already talked about a quest.
- A test whose `given` isn't a scenario crashes with `.some` of undefined instead of saying what's wrong.
- Buildings have two names: campfire is 篝火 in some places and 营火 in others, chest is 木箱 / 箱子, sign is 路牌 / 告示牌.

**Demo**
- The far bank of the Ford plays chapter one's hook at any quest stage.
- Homes share one anchor cell.
- Statues are not named as statues.
- Bram's first greeting mentions a level.
- Some topics the story raises (crossed, crown, dragon_slain, flame_stolen) have no topic lines.

**Modder and agent**
- A failed audit is journaled as if it found nothing, and `ford-live` doesn't show the failure.
- An offline background revision holds the lane, so a player's live request waits behind it past its time-out.
- A claude-code reply with a sentence before the tool-call object isn't parsed as a tool call, even if the sentence contains braces.

## Expected behaviour

**Client**
- Going back to the title waits until the slot write has finished, then opens the title, exactly once. If no save arrives (nothing was saved, e.g. after a fall), it goes on after 2 s anyway. A save signal with nothing waiting does nothing.
- The client stores how far its library has synced the service's log and passes it at start. Loading resumes from there instead of 0.
  - The stored position only counts for the same service URL.
  - The position is stored after the library it belongs to, if the library changed.
  - If the service's log is shorter than the stored position, the client resyncs from 0.
- A patch synced from the log carries its request id. If the id is one of this game's own requests, the rule's source is credited to that request. An id belonging to another game is not credited.
- A long step (sleep) passes at most one game hour per tick when the client asks for that. The clock is seen to run, and a second E while asleep does nothing. Harm still stops it. Without the setting, a long step passes at once as before.
- When the overworld layout has no place for the current map and nothing else has been seen, the world map shows the current map alone.
- Setting the dev hour moves forward only. An hour earlier than now means that hour on the next day.
- The quest log lists finished quests (by title, last). With none in progress but some finished, it says nothing is under way rather than "no quests taken". The shop tab refreshes live, including when stations change.

**Engine and content**
- A new condition `worn: <role>` is true when the role's thing is worn or wielded by its carrier. Using one's own held item reads:
  - Ordinary gear: "Put on X" / "Take off X" (穿上 / 脱下).
  - Weapons: "Wield X" / "Put away X" (装备 / 收起). The log lines follow the same wording.
- `transform` renames from the new type, keeping the host's material and quality. A name that said neither goes.
- `breakdown` lands parts and spill on the first floor below the host. It keeps the host's level only where another floor lies under it.
- A hen does not lay while 12 eggs lie on her map, whether she is active or away. She lays again once they are taken. `count` conditions accept `in: 'map'`, counting things on the role's map besides itself. The validator and the mod spec document it.
- Freeze-water spreads only for power 2 or more. One cast freezes its own cell and some cells beside it, and no further.
- The quest op records that the NPC has been talked to, so their first-meeting line doesn't play after a quest conversation.
- Building a scenario from a `given` that isn't a scenario fails with a message saying it is not a scenario and what one needs (`entities`). The validator reports the same message rather than a crash.
- Each building's panel name is the same as the name of the thing it builds: 营火, 箱子, 告示牌 (the wiki keeps 篝火 as an alias).

**Demo**
- `far_bank` applies only below quest 2. A silent `far_bank_late` step covers later visits (at the finale: no hook, the river is just marked crossed).
- Homes no longer share an anchor cell, statues are named as statues, and Bram's first greeting is level-neutral.
- Topic lines exist for crossed, crown, dragon_slain and flame_stolen.

**Modder and agent**
- A failed audit is journaled with its error message, and `ford-live` prints FAILED.
- Offline revisions take no lane. A player's live request in the same lane resolves while such a revision is still being designed.
- A claude-code reply with prose (possibly containing braces) before the `{"tool_calls": ...}` object is parsed into its tool calls, with empty content.

## Requirements

- Each fix above has a regression test, and the suite, typecheck and coverage stay green.
- Save-then-title ordering: the title never opens before the slot write completes, and never more than once per request; a new request replaces a pending one.
- Existing behaviour is unchanged when the new options are unset (no chunk size → long steps pass at once; no `answers` → patch credit as before; no stored seq → sync from 0).
- Building labels in `BUILDINGS` match the Chinese names of their result types, including the campfire's log line.
- A hen's egg cap must behave the same whether she is simulated or her map is dormant and caught up on entry.
- The new `worn` condition and `count.in: 'map'` are accepted by the patch validator and described in the mod spec.
- Patches that already validate must still validate.

## Interface

- `packages/client/src/afterSave.ts`: `export class AfterSave` with
  - `then(fn: () => void, ms?: number): void` — runs `fn` once the next save is written, or after `ms` (default 2000) if none comes; replaces any pending one.
  - `written(): void` — runs what is waiting, once; does nothing if nothing waits.
  - `cancel(): void`.
- `packages/client/src/protocol.ts`:
  - `init` message gains `librarySeq?: number`.
  - New `FromWorker` message `{ t: 'synced'; url: string; seq: number; changed: boolean }`.
- `Engine.fastForwardChunk?: number` (engine) — the most ticks of a long step that pass in one tick.
- `ModPort.submit(id, patch, scenario?, answers?: string)` — `answers` is the request a shared patch was made for.
- Condition `{ worn: RoleName }`, and `{ count: { in: 'contents' | 'tile' | 'map', ... } }`.
- Content exports (from `@lsw/content`): `EGGS_LIE` (12, the egg cap) and `LAYS_EVERY` (ticks between eggs).
- Journal entry for a failed audit has an `error: string` field.
- Demo: new step `far_bank_late`; `FAR_BANK` and `buildFord` exported from `packages/tools/src/demo/world.ts` as the tests use them.
- Other names exposed: `madeOf` from `@lsw/engine` (used to compute a name from type, material and quality).
