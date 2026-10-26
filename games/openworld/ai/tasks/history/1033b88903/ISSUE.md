# Aiming with an axe at a tree beside you hits a farther tree's canopy instead (plus related play-session fixes)

## What is wrong

When the view draws several layers at one point, a key press aimed at that point meets the topmost layer. A tree's crown is drawn over the cells around it, so a tree standing farther away can have its canopy drawn over the tree right beside the player. Aiming at the near tree then picks the farther tree's canopy, which is out of the key's reach, and the key does nothing, or hits the wrong thing. The key should meet the layer it can actually reach.

The same play session turned up several related problems:

- When a chosen slot can't start, the cover (intro screen) stays in "loading" forever and never says why.
- The developer's own log lines (a patch the validator rejected, a rule set aside, a chain of events stopped, a rule's refused effect) appear as warning toasts to the player.
- The shared patch library can hold patches that the validator, now stricter, would no longer accept. Every client rejects them on sync, one rejection each.
- The dev launcher can serve a stale world after the content changes.
- The "what the keys would do" hint near the target can be covered by a companion's speech bubble.
- The crafting menu offers station recipes (e.g. workbench) as craftable when the player is not beside the station.

## Expected behaviour

**Canopy aim.** The player stands at (3,3) facing left, holding an axe. A tree is at (2,3), and another tree at (1,4) whose crown is drawn over (2,3). The view's stack at (2,3) is: the farther tree's crown first, then the tree at (2,3). Planning a `use` at (2,3) with that stack gives a plan whose `at` is (2,3) and whose target is the tree at (2,3), not the farther crown.

- A layer that is drawn over the point but belongs to another cell, and that is beyond the key's reach, is skipped in favour of the next layer.
- A layer that stands on the aimed spot itself stays a candidate even when out of reach. For example, a bed pointed at from beside it is not replaced by its floor.
- Inputs with no key, or the `self` key, keep the existing behaviour.
- The reach check for `use` takes the held item into account.

**Cover start errors.** If the game reports an error while the cover is still showing, the cover shows "The world could not start: <first line of the message, without a leading `Error: `>" (Chinese: 世界没能开始：…) and its buttons become usable again. If the cover is already hidden, the old behaviour stays (a dev-only HUD warning).

**Dev-tone logs.** Log effects can carry a new tone, `dev`. The following use it instead of `warn`: a rejected patch, a learned rule set aside, a stopped event chain, and a rule's refused effect. The HUD sends `dev` lines to the console (`[world] …`) and never shows them as toasts.

**Library prune.** The library can roll back every live patch that the validator no longer accepts. Each patch is judged in the scene it answered, against the library without that patch (its rules and the types it brought). Validator exceptions count as failures. It returns what was rolled back and why. The modder CLI gets `library prune`, which prints each rollback and a summary ("every patch still holds" when none). `serve` prunes at start, before any client can sync, and logs what it rolled back.

**Dev world build.** `npm run dev` rebuilds the world (`gen:world`) before starting the client. If the build fails, it logs that the client serves the last one and carries on.

**Speech bubble vs keys hint.** The hint goes below the target instead of above when a speech bubble overlaps the area it would occupy above.

**Station recipes.**
- The player's frame reports which stations are within reach (the cells around the player, covering both entities and covering cells, by `station:<name>` tags on the thing or its type).
- The crafting menu treats a station recipe as not craftable (zero times) when its station isn't in reach. "hands" or no station is always available.
- The row's station label is marked as short, and the disabled craft button's tooltip says to stand beside the station.
- The engine's craft effect uses the same station check.

## Requirements

- The canopy case above resolves to the near tree at (2,3).
- Out-of-reach layers from other cells are skipped, but layers on the aimed spot are kept.
- `key === undefined` and `'self'` targeting are unchanged.
- The `dev` tone is accepted by the log effect type, goes only to the console, and never produces a toast.
- The four engine log sites listed above emit `dev`.
- The cover reports failure only while it is visible, re-enables its buttons, and shows the localized failure text.
- `prune` rolls back only live patch-origin rules, judges them in log order, and returns `{ rules, reason }[]`. It must not throw when the validator does.
- The CLI `library prune` command exists and `serve` prunes before listening.
- The dev script rebuilds the world before starting the client and survives a failed build.
- The keys hint avoids overlapping speech bubbles.
- Station reach is computed in one place, shared by the frame, the menu and the craft effect.

## Interface

- `World.stationsNear(e: Entity): Set<string>` in `packages/engine/src/world.ts`. Returns the station names (from `station:<name>` tags, on the thing or its type) within one cell of the entity, including covering cells. It is empty when the entity has no position.
- `Frame.player.stations: string[]` in `packages/engine/src/snapshot.ts`. The stations within reach of the player.
- `FxEvent` log tone gains `'dev'`, in `packages/engine/src/types.ts`.
- `WorldLibrary.prune(now?: Date): { rules: string[]; reason: string }[]` in `packages/modder/src/library.ts`.
- `Cover.failed(why: string): void` in `packages/client/src/ui/cover.ts`.
- String key `cvFailed` in `packages/client/src/ui/common.ts`: `['The world could not start:', '世界没能开始：']`.
- CLI subcommand `library prune` in `packages/modder/src/cli.ts`.
