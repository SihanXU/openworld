# Death and difficulty: a fallen player is shown as such, and can rise where they fell, at home, or not at all

## What is wanted

When the player character is felled (has the `down` status), the game currently has no notion of what follows. We want a Minecraft-style death and difficulty system:

1. **The frame reports a fall.** While the player is down, the frame says so: who felled them and what the game's difficulty is.
2. **Difficulty** is chosen at a new game: `easy`, `normal` or `hardcore`. It is kept as a story-protected fact, `game.difficulty`. Games with no such fact (older saves) count as `normal`.
3. **Rising again** is a request the story makes and the player character answers by its own rule. The engine offers a respawn operation taking a "home" flag:
   - **easy** (`home` false): the player gets up where they fell, whole, keeping everything they carry.
   - **normal** (`home` true): the player rises at their home, whole, and what they carried (bag and hand) is left on the ground where they fell.
   - **hardcore**: one life. The world has ended, nothing to rise to; the slot is kept as it ended and cannot be played on.
4. **Home** is the bed last slept in or the waypoint statue last woken; with neither, the place the world began. Sleeping in a bed or waking a waypoint records it as the player's home.
5. **Client:** a death screen stops the world ("You died!", the cause, the choices appropriate to the difficulty). The new-game cover lets the player choose a difficulty. A fallen player is not autosaved (so a save to load is from before the fall); a hardcore end is saved and marked as ended, and such a slot is not loadable or auto-selected. A dev console operation can hurt the player so this can be tried.

## Expected behaviour

- A player brought down by a slime: the frame's fallen info names the slime as the cause (readable text containing "slime") and reports the difficulty. With no difficulty fact, it reports `normal`. When the player is not down, no fallen info is present.
- Easy: after a fall and a respawn without home, the player is no longer down, has full hit points, stands on the tile where they fell, and still holds their items (e.g. a loaf of bread). The frame no longer reports a fall.
- Normal: after sleeping in a bed (taking hold of it), the bed becomes the player's home. After being felled elsewhere and respawning with home, the player is no longer down, has full hit points, and stands at or adjacent to (within one tile of) the bed. They no longer carry the bread; exactly one loaf lies on the ground where they fell, as an ordinary placed item (not flagged as dropped loot).
- Waking a waypoint statue (taking hold of it) makes it the player's home. A player with no home has the world's spawn as their home position.
- Respawning when the player is not down does nothing.
- Dropping the contents of an entity now includes what is in its hand as well as its bag.
- Being hurt records who struck last and what kind of thing they were (the type is kept even when the striker is gone), so the cause can be named afterwards.

## Requirements

- The fall, difficulty, and respawn behaviours above work for the player on the engine with the story's rules loaded.
- `game.` facts are protected like the other story facts: only the story's rules and scenes may change them.
- Rising is carried out by the player's own rule in response to a story notification (`respawn`, with whether to drop what is carried). Home is recorded through a notification (`home`) to the player, carrying which thing is the home. Rules need a way to pass "which thing a role is" (its id) as an emitted param.
- Rising restores the player to full hit points and removes the down status; at home it also moves them to the home position (nearest free tile if that is occupied or not walkable).
- A fallen player is never autosaved except at hardcore, where the ended game is saved with a summary marked as ended; the summary also records the difficulty.
- Client messages: `init` accepts an optional difficulty; a `respawn` message with a home flag; a debug `hurt` operation with an amount.

## Interface

In `@lsw/engine`:

- `type Difficulty = 'easy' | 'normal' | 'hardcore'`
- `difficultyOf(eng: Engine): Difficulty` — the game's difficulty (`normal` unless the fact `game.difficulty` is `easy` or `hardcore`).
- `Frame.fallen?: { by?: Text; difficulty: Difficulty }` — present on the frame returned by `snapshot(eng)` while the player is down.
- `Engine.respawn(home: boolean): void` — the story tells the fallen player to rise; no-op if the player is not down.
- `Engine.homeOf(e: Entity): Pos` — where an entity rises at home: beside the thing in its `home` prop, else `world.state.spawn`.
- `CombatState.lastHurtBy?: Id` and `CombatState.lastHurtByType?: string`.
- Effect `emit` params accept `{ idOf: RoleName }` alongside `{ typeOf: RoleName }`.
- Player prop `home` (the id of the bed or waypoint made home), set by a `notify` with `what: 'home'` and `value`.

In client (`packages/client`):

- `ToWorker`: `init` gains `difficulty?: Difficulty`; new `{ t: 'respawn'; home: boolean }`; new `{ t: 'debug'; op: 'hurt'; amount: number }`.
- `SaveSummary` gains `difficulty?: Difficulty` and `ended?: boolean`.
- `DeathScreen` in `ui/death.ts`, with `DeathHandlers { rise(home: boolean); load(); title() }`.
- `Cover.show(panel?: 'load')`; `CoverHandlers.start(slot, data, difficulty?)`.
