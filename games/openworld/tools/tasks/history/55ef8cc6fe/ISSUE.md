# Play-session fixes: the world waits on the player's act, hostility by disposition, status overlays as data, and smaller naming/prune fixes

## What is wrong

Playing a fresh save turned up several defects in the engine, content and modder library:

1. **The world does not wait for the player's own act.** While the player's act waits for its outcome (e.g. the modder is being asked), only the act's participants freeze, so other creatures (bats) keep moving during what should be a pause. The world's own questions must not stop it, and a wait must not last forever.
2. **Hostility in the frame is wrong.** An entity with AI is reported hostile only if it is chasing at this moment. A bat that has turned back reports non-hostile and gets a green HP bar.
3. **Status overlays are hard-coded by status name.** Learned statuses cannot draw anything, and a lit campfire (whose type already has its own lit frames) would be drawn with a flame on top as well.
4. **A companion struck by its leader is a silent target.** It should take the blow and react.
5. **A made thing is named twice by its material** (木木桶 instead of 木桶).
6. **Library prune** judges each patch against the whole library minus itself, instead of against what existed before it. A patch that depends on a type brought by an earlier patch can be judged wrongly (and an earlier patch that has been rolled back is not accounted for).
7. **Client labelling:** the minimap zone label does not relabel on a language switch, and a fixture-type item (e.g. a workbench) shows a blank inventory icon.

## Expected behaviour

- **World pause.** When a pending undefined-outcome record belongs to the player's own act (origin `player`), the port reports it as "asking", and the host's world clock stops while it is. Pending records from the world (origin other than player) do not count. Once the record is resolved (answer or fallback), nothing is asking. The host falls back after 20 s of real time waiting for an answer, and after 120 s when the wait is for something being made (the record has no deadline).
- **Hostile.** An entity with AI is reported hostile in the frame according to whether it would be hostile to the player (its factions, temper, foes), whatever its current AI state. A bat in `return` state with an aggressive temper is hostile. HP bars: red when hostile, green for people and companions, amber otherwise.
- **Status overlays.** There is a closed set of overlay names: `fire`, `flame`, `ice`, `spark`, `wet`, `oil`. Each entity in the frame lists the overlays its statuses name, in the order it holds them (omitted when none). A lit campfire's frame lists `['flame']`. Every base status that has an overlay uses one from the set. The validator rejects a learned status whose overlay is not in the set, with an error of the form `overlay "sparkles" is not one the world can draw: one of fire, flame, …`; `flame` is accepted. The modder's authoring guidance mentions the set. The client draws the picture for each overlay name, and a type with its own lit frames shows those instead of a flame overlay.
- **Companion struck by its leader.** A new condition `leads: [roleA, roleB]` is true when roleA is an entity and roleB is its companion (roleB's `companion` prop names roleA). It is usable in rules and in patches (roles validated), and listed in the modder's condition vocabulary. A content rule makes a companion hit by its leader (strike impulse) take the damage as a blow, show a surprised emote and say a line. A strike from anyone else behaves as before, with no word from the companion.
- **Naming.** A made thing's name leaves out the material when the base name already begins with it: bucket of wood → `木桶`; an axe of stone remains `石斧`.
- **Prune.** Each live patch is judged against the entries before it (lower seq) that have not themselves been rolled back. A patch whose own types are introduced by itself is valid; an older patch invalid under current rules is rolled back, together with later patches depending on it; running prune again rolls back nothing.
- **Client.** The minimap zone label updates on language switch. An item whose icon is missing falls back to the fixture's base sprite.

## Requirements

- `ModPort` exposes the player's pending record, or `undefined`.
- The worker loop stops the world while that is set, and falls back after the wall-clock limits above.
- The frame's `hostile` uses the engine's hostility judgement toward the player.
- Frame entities carry `overlays` as described; status data uses only names from the closed set.
- The validator rejects unknown overlay names with the message above.
- The `leads` condition is evaluated, validated and documented as described, and the companion rule exists.
- Material is not repeated in made names.
- Prune judges each entry against earlier, still-standing entries only.
- Minimap relabel and the icon fallback work as described.
- Existing behaviour otherwise unchanged.

## Interface

- `OVERLAYS` — `readonly ['fire', 'flame', 'ice', 'spark', 'wet', 'oil']`, exported from `@lsw/engine` (defined in the engine's `types.ts`).
- `ModPort.asking` — getter, `UndefinedRecord | undefined`, in the engine's `mod.ts`.
- `EntitySnap.overlays?: string[]` — in the engine's `snapshot.ts`.
- `Cond` gains `{ leads: [RoleName, RoleName] }` — in the engine's `types.ts`.
- `Minimap.relabel(): void` — in the client's `ui/worldmap.ts`.
- Content rule id `companion/struck`.
