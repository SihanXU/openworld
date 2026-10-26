# A held thing the answer transformed loses its slot after a late patch or fallback

## What is wrong

When the player uses a held thing on something (for example iron ore on a lit forge) and the world has no rule for it, a hole is opened and the request goes to the model. If the answer arrives later (a late patch), or the hole is closed by its default (a fallback), the world is changed. The held ore may become an ingot, for instance. But the player's bag is not brought in line with that change. The thing that was transformed no longer has its place in the slots, and the slot the player held it in is left empty.

The same applies in the game: the player waited for the new thing to appear, and it was not in their hand.

Two related gaps make this hard to stage and to measure:

- The debug "give" in the game puts the thing in the player's bag but not on a slot, so a staged act cannot be set up by hand from the Mod Console.
- There is no way to measure live how the router handles acts whose outcome the world already has elsewhere (it should find that thing and make no new type) versus acts whose outcome it does not have (it should create a new, named thing with a picture).

## Expected behaviour

- Player holds iron ore, selected on some slot, and uses it on a lit forge. The hole is pending. A patch is submitted bringing a new type `item/material/iron_ingot` and a rule that smelts the ore. After the patch is applied, the held thing is the ingot, and the slot that held the ore now holds the ingot. The slot is not empty, and it is the same slot index.
- The same holds when the hole is closed by its fallback (the hole's default is run): whatever the default did to the player's things shows in their slots.
- A debug give puts the new thing in the bag and on a slot, so it can be held and used straight away.
- The Mod Console's World tab offers: give a thing (by type id), teleport (optional map, x, y), jump to Emberfall by the lit forge, and set the hour. These are development only. The inputs keep what is typed in them while the numbers on the tab refresh each frame.
- A new command `npm run eval:objects` runs ten acts against a real model: five whose outcome the world has elsewhere (find) and five whose outcome it does not (create). An optional argument limits the run to cases whose name contains it.
  - Each case runs on a fresh library, with review, reflection and escalation off.
  - Each case follows the act through up to four holes, as the game does. A rule writes only its host, so a knife on a haystack may be answered by the knife and then by the haystack.
  - The verdict is given on the world afterwards.
  - Find passes when a thing of an expected type appeared or changed and no new type was created.
  - Create passes when at least one new type was created and appears in the world, and every new type has both English and Chinese names and a picture.
  - The run prints per case the verdict, holes, routes, calls, cost and time. It prints a summary of find and create pass counts and the total cost.
  - It writes the record, the verdicts and the pictures (scaled 8x) to a timestamped folder under `var/eval-objects/`.
- A `dev-claude` launch configuration runs the game's dev server with the claude-code backend.

## Requirements

- After a late patch is applied, the player's slots reflect what the outcome did to their things. A held thing that changed type keeps its slot.
- After a fallback closes a hole, the player's slots reflect what the default did.
- Syncing the bag must be safe when there is no player, or the player no longer exists in the world.
- The debug give puts the created thing in the player's bag and syncs the slots, in a single world write.
- The Mod Console World tab builds its tools once and refreshes only the statistics afterwards. It asks for the spec when it has none, so the type list for the give input is filled.
- The client's Mod Console passes a debug operation through to the worker as a `debug` message.
- The eval needs a model from the environment, and fails with a clear message when none is configured.
- A case whose act is not a hole is skipped, not counted.
- The eval waits for the model rather than the clock, with an overall limit per case.
- The cases:
  - Find: knife on a haystack (grass or wheat), sickle on reeds (grass), knife on a beehive (honey), shovel on pebbles (stone), feather on ink (feather quill).
  - Create: iron ore in a lit forge (an ingot), salt on raw meat (cured meat), frostcap in a lit cauldron (a frost potion), knife on a pumpkin (a carved pumpkin), berries in a lit cauldron (jam).

## Interface

- `npm run eval:objects`, script entry `packages/tools/src/eval-objects.ts`, in the root `package.json`: `tsx packages/tools/src/eval-objects.ts`.
- `DevSend.debug(op)` in `packages/client/src/ui/dev.ts`, where `op` is one of:
  - `{ op: 'give'; type: string }`
  - `{ op: 'teleport'; map?: string; x: number; y: number }`
  - `{ op: 'hour'; hour: number }`
- The `ModConsole` constructor option `debug: (op) => void` in `packages/client/src/main.ts`, which sends `{ t: 'debug', ...op }` to the worker.
- A `dev-claude` entry in `.claude/launch.json`: `npm run dev -- --backend claude-code`, port 5173.
- No new names in the engine. The behaviour is on the existing `ModPort`: submitting a patch for a pending record, and the fallback path, both leave the player's slots synced with the world.
