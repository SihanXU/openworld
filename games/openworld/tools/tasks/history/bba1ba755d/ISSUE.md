# Gear laid on a map rolls its extras from the map's shared randomness, so changing the affix table moves the map's ground and things

## What is wrong

Since commit 134c875, a piece of gear that a map builder lays down rolls its affixes (the small "extras" on worn or wielded pieces, drawn from the affix table) from the map's shared random stream. The same stream also drives the terrain strokes and the scatter of things.

Consequences:

- The Ford, the Ossuary, the Sanctum, the Held Ground and its four grounds came out differently from before: different terrain, and different ids and places of their things.
- An older save keeps its things but takes the newly generated ground under them, so things sit on ground they were not made for.
- Any later edit to the affix table (count, pool, weights) would reshuffle every map again.

Related gaps that the same change should close in the demo's checks:

- Several checks (F13, F14, Q1, and others that use the world's first axe, i.e. Gus's stock) count experience or the number of blows that fell a tree or a cow. They hold that axe along with whatever extras it happened to roll, so their sums depend on the affix table.
- The check named T4 lists the forager's sack as its witness but never touches it. The container capacity has no witness of its own.
- Every demo person trades, so the trade verb's merchant condition is never exercised. The condition must stay, since a person record need not trade and the talk tree answers "nothing to sell".
- The Q4g wording says the old mine "holds the only gold", but its check also accepts the Held Ground's quarry.

## Expected behaviour

- The extras of a piece of gear laid on a map are drawn from a random stream of that piece's own, seeded from the piece's id. They are never drawn from the map's stream.
- Changing the affix table (fewer extras, a different pool, different weights) changes what pieces roll, but leaves every map's terrain and every thing's id, type and place exactly as they were.
- The same holds for the goods a person carries (their items and stock): each rolls from a stream seeded by its own id.
- Building the same piece with the same id twice gives the same extras. Different ids give independent streams.
- A caller of the item maker can supply the stream its extras draw on. If none is supplied, the extras draw on the given generator as before.
- Maps built in memory should come out as they did before 134c875 (its parent, fb7bb3a): each map's terrain and things are again as they were. Two exceptions are expected:
  - The Held Ground, whose three residents' tents' plots come from 134c875 itself.
  - The world map (the Pilgrim's Road, from 6cd20e7).
- Checks that use the first axe count with an axe's own sums: its rolled extras are removed before counting.
- The forager's sack, opened by hand in the rotted tent, takes four things put in it and not a fifth. It offers no putting of a fifth, and a fifth put there by force is not taken and says it is full.
- A person without the merchant tag does not offer the trade verb. If trade is requested anyway, no panel opens and the person says they have nothing to sell.
- The Q4g wording says the deep chamber of the old mine holds gold, and that the Held Ground's quarry does too once the steward opens it, and that it is found nowhere else.

## Requirements

- Gear laid on a map (on tiles, in fixtures, in monster loot) and gear carried by people rolls its extras from a stream seeded by the thing's own id.
- The id used for the seed is the id the thing will actually have. A map's things carry the map's id in theirs, so ids are unique across the world.
- The seed derivation is deterministic: the same id always gives the same sequence.
- The map builder gives each thing its id before making it, so the id is known when its extras are rolled.
- The map's own random stream is not consumed by extras. Terrain strokes and scatter draws are unaffected by what gear rolls.
- The demo's checks that depend on the first axe use an axe with its rolled extras taken off.
- A new check shows the forager's sack taking exactly four things and refusing a fifth. The check for T4 no longer names the sack as its witness.
- A new check shows the trade verb's merchant condition with a person who lacks the merchant tag.
- The Q4g wording is corrected as described above.
- A new check shows that another affix table rolls other extras but moves no map's ground or things. It must not be vacuous: some things do roll extras, and the changed table changes them.

## Interface

- `makeItem` in the content package's `items.ts` gains an optional option `extras?: () => number` in its options object. It is the randomness the rolled extras draw on, defaulting to the given `rng`'s own `next`.
- `ownRandom(id: string): () => number` in `games/openworld/tools/src/demo/builder.ts` is exported. It returns a generator of its own, seeded deterministically from the id.
- `itemOf(spec: ItemSpec, id: string): Omit<Entity, 'id' | 'place'>` in `builder.ts` now takes the id of the thing it will be as a second argument.
- `MapBuilder.makeItem(spec: ItemSpec, place: Entity['place']): Entity` in `builder.ts` now takes the place and returns a complete entity with the map's next item id and that place.
