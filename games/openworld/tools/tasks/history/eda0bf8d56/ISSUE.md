# Replace the two-key controls with four single-verb inputs (hands, take, use, put) that can reach every layer of a tile

## What is wanted

The player currently has two keys, Action and Use, aimed at the mouse's neighbour tile or the tile in front. Each key chooses among several verbs by dry runs through the rule library. As a result one event can shadow another: some interactions the rule library can define cannot be produced by any input.

Replace them with four inputs, one verb each, so that every (verb, instrument, target) the engine can make is reachable from some input:

- **hands** (E): interact with a bare hand, whatever is held. Talk, open, read, sleep, push.
- **take** (F): take something. Pick up, pick a crop, take down.
- **use** (left click): the held thing applied to the target. Tools, eating when aimed at oneself, experiments. Weapons strike.
- **put** (right click): the held thing placed onto or into the target. Place, store, sow, give.

The target of an input is one **layer** of the aimed tile. Layers are people and creatures, fixtures, items (the top of a pile first), the ground, and the player when the aim is their own tile. By default the input acts on a sensible layer. The player can choose any layer explicitly by a long press, which opens a chooser. Items in the bag (or an open chest) must also be targetable, from the inventory's context menu.

Other changes:
- Aiming may now include the player's own tile, not only the 8 neighbours.
- The default layer is the first layer for which the input has a rule. If none has, it is the first layer the input reaches, bare ground included. An object used on bare ground is therefore an experiment for the modder (unknown), not silently dropped.
- Mod-port prefetch is counted once per class of interaction rather than per tile or item.
- Esc opens the menu, I the inventory, J the journal, M the map. The old X/C/Tab/E-menu bindings go. Controls help, HUD key labels, focus outline, objective hints and the inventory UI text follow the new scheme.
- The inventory gains a "drop in front" action.
- In the chest panel, Shift+click moves one item and right click opens the context menu.

## Expected behaviour

- Holding an apple next to a person: `hands` yields an interact with rule `core/talk` and no instrument. `put` yields a put with rule `core/give`.
- `hands` on a chest yields a plan whose panel is the chest. `hands` on a bed asks for confirmation before sleeping.
- `use` aimed at one's own tile while holding bread yields `core/eat` with a confirmation.
- `take` on a loose stone yields a take with rule `core/take-item`.
- `put` with a hoe held yields `core/put-down`. Running it puts the hoe on the tile in front, tools included.
- `use` with an apple on bare ground yields an interact with the ground tile as target and `unknown: true`. This holds both for the default aim and for an explicit tile.
- `use` with a hoe on bare ground yields `core/till`, and running it makes the tile farmland.
- Experiments go to the Mod port. An apple used on a well gets one record. A bare hand `hands` on a boulder gets a record whose event is strict.
- A sword used on a fixture with no reaction yields a plan marked `attack`, and running it sends a `hit` event to the Mod port.
- A sword used on a person yields an interact, not an attack.
- A bare fist used on a creature (a slime) is an attack.
- With a hoe held and a stick on a tile, choosing the ground layer explicitly makes `use` yield `core/till`.
- For a table holding an apple and bread on one tile, the take chooser lists all three (table, apple, bread) as targets.
- A plan for the same key, tile and layer is deterministic.
- Apart from attacks, each input's plan has its own verb: interact for hands and use, take for take, put for put.
- An item in the bag is a target. Use, put and hands on it yield interact, put and interact plans with that item as target. Hands has no instrument.
- The inventory's drop action puts a bag stack on the tile in front of the player.

## Requirements

- Exactly four keys exist: `hands`, `take`, `use`, `put`.
- Each key makes exactly one event of its own verb, apart from the attack case.
- Over all keys, carried and empty slots, aims and layers, every (verb, instrument, target) is produced. Where it applies, this covers target layers such as a pile on a table, a stick on the ground, a person, and the player's own tile.
- The old Action and Use planning entry points are replaced by the new ones.
- The client protocol carries the new key, item-key and chooser messages. The worker answers a chooser request with, for each layer, its name and the label and unknown flag of the plan the key would make there.
- Prefetch deduplication uses one signature per interaction class. The engine exports a function that computes it for a game event.
- The Frame's `keys` field holds a view per input, for all four.
- The layer chooser is keyboard- and mouse-selectable (numbers 1–9, click), is closed by Esc or by a click elsewhere, and pauses the game while open.
- A short press acts at once. A long press opens the chooser.

## Interface

In `@lsw/engine`:

- `type Key = 'hands' | 'take' | 'use' | 'put'` (the type of `Plan['key']`), exported from the engine package.
- `Controls.layers(at: Pos): Ref[]`: all targets at a tile, top first (people, fixtures, items with the top of a pile first, the tile itself, then the player if the tile is the player's own). It excludes the player on other layers.
- `Controls.plan(key: Key, at?: { x: number; y: number }, layer?: number): Plan | undefined`: the plan for a key at an aimed tile (default: the tile in front). `layer` is an index into `layers`, and without it the default layer applies. It replaces `planAction` and `planUse`.
- `Controls.choices(key: Key, at?: { x: number; y: number }): { layer: number; name: Text; plan?: Plan }[]`: one entry per layer, with a display name and the plan the key would make there, if any.
- `Controls.planOnItem(key: Key, item: string): Plan | undefined`: the plan of a key on an item in the bag or open chest as target. `use` and `put` use the held thing as instrument. `hands` has none.
- `Controls.drop(slot: number, toFront: boolean)`: the inventory's drop (for example `drop(slot, true)` sets the stack on the tile in front of the player).
- `signatureOf(engine: Engine, ev: GameEvent): string`: the class signature of an interaction, used to deduplicate prefetches. Exported from `@lsw/engine`.
- `Plan.key` takes the values of `Key`. `Frame['keys']` has the optional fields `hands`, `take`, `use`, `put`, each a `KeyView`.

Client (not under test):

- Worker messages `{ t: 'key'; key; tile?; layer? }`, `{ t: 'keyOnItem'; key; item }` and `{ t: 'choices'; key; tile? }`, and the reply `{ t: 'choices'; key; tile?; list }`.
- `Hud.showChooser`, `Hud.chooseNth`, `Hud.closeChooser`, `Hud.chooserOpen`.
