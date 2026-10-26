# The Ford: lay the map out to a plan, and export the stand positions the completeness proof needs

## What is wrong (for a fix) or What is wanted (for a feature)

The Ford demo map (`packages/tools/src/demo/world.ts`) is a scattered map. The river is a straight band, the edges are noise, and the sprites in the catalog are not the pack's right pieces for the things drawn. The completeness proof (the demo test) also hard-codes tile coordinates, so any change to the map breaks it.

We want the Ford redrawn as a designed place, and the proof to read positions from the map's own tables instead of fixed coordinates.

The layout should be:

- **North:** a mossy cliff along the north edge, with the slimes' hollow and a cave mound at its foot. Trodden earth and bones lie before the hollow.
- **River:**
  - It comes down from the cliff and narrows to three tiles at the dead tree's spit.
  - It widens into a still pool at the landing, then bends away to the south.
  - Its banks are grass, with no square sand patches.
  - The dead tree stays felled only from the west, across the water.
- **Landing:**
  - A rope post.
  - Short piers on both sides of the pool, with a gap between them that the ferry crossed.
  - The boat at the near pier.
- **Camp:** a clearing with a tent, the chest, and a stone-ring fire. Around the fire are a log bench and a cooking rack. Nearby are a stump, a woodpile and a lantern by the road.
- **Rest of the map:**
  - A dry meadow of loose tall grass.
  - A marsh of round ponds among tall grass.
  - The frost slime's corner, white with rime.
  - Woods of a single season each.
  - A signpost where the road east leaves the far bank.

Rendering should also change:

- Loose growth (tall grass, flowers, bushes, and ground details such as reeds, ferns, tufts, clover, pebbles, leaves, puddles) is drawn a few pixels off the tile grid.
- Part of the tall-grass tiles stay bare, so a meadow does not read as planted rows.
- Autumn, blossom and snow trees become their own terrains rather than being mixed into the general tree or pine lists.
- The catalog gains the sprites the new layout needs. These are the bench, rack, stump table, mat, blanket, rope coil, reeds, bones, signpost, moss and the mossy cliff-face pieces. The hollow, winch, ferry and raft fixtures get sprites that fit their new roles.

## Expected behaviour

- The demo world builds, and the story is still completable by all three routes: the ferry, the dead tree, and the ice.
- The map exports `AT` (where things are) and a new `STAND` table (where a person stands to use them). The proof reads positions from these two tables, so moving things on the map does not require editing the proof.
- Each `STAND` position is open, walkable ground next to what it is for. Examples:
  - `tree` is west of the dead tree, across the water, and is the only side it can be felled from.
  - `winch` is just south of the winch, on the landing.
  - `fill` is a bank tile with water directly east of it, to fill a bucket.
  - `castFrom` is a bank tile with the river directly east of it, where frost is cast to start a path across.
  - `raft` is the end of the near pier, with the boat directly east of it.
  - `chest` is south of the chest.
  - `tobin` is south of the peddler's place by the cart.
  - `cart` is east of the cart, facing its pile.
  - `road` is open ground with open ground east of it, so a thing can be used on the tile to its right and then stepped onto.
  - `meadow` is in the dry meadow.
  - `frostGround` is near where the frost slime roams at night, well away from the fire.
  - `byFire` is a spot by the fire, inside its reach.
- The far bank is still the goal region. Reaching it ends the story, however the player got there.
- Slimes, scenes and schedules still work with the moved positions:
  - The arrival scene places Hesper and the player so they face each other.
  - The night destinations of the slimes are reachable open ground.
  - Anchors keep their meaning, at their new places.
- Any rendered tile of tall grass may be left bare. Loose-growth offsets are deterministic per tile, so a tile always draws the same way.

## Requirements

- `AT` keeps all its existing keys and gains no others. The values are new, and every one is a valid in-bounds tile on the map.
- `STAND` is a new export with at least the keys named above: `tree`, `winch`, `castFrom`, `fill`, `raft`, `chest`, `tobin`, `cart`, `road`, `meadow`, `frostGround`, `byFire`. Every value is a `[x, y]` pair, and every position is walkable and not blocked by terrain or a fixture.
- Each key's meaning is as in the examples above. In particular:
  - Using the winch from `STAND.winch` works.
  - Using the held item on the tile east of `STAND.road` works and the tile is then steppable.
  - Water lies directly east of `STAND.fill`.
  - The river lies directly east of `STAND.castFrom`, so frost cast from there can start a path across.
  - The raft is directly east of `STAND.raft`.
  - `STAND.tree` is west of the dead tree, and the player can strike it from there facing right.
  - `STAND.cart` is east of the cart.
  - The tile north of `STAND.tobin` is where Tobin stands.
- The far bank region and its goal still end the story. The far-landing anchor is reachable from the near side only by one of the three routes, never walking around.
- `buildFord()` still returns a valid index and chunks, and a saved game reloads onto the new map with the player where it was.
- The existing completeness requirements still hold with the positions read from `AT` / `STAND`:
  - Unknown interactions are asked about.
  - Cascades work.
  - Creatures meet things after dark.
  - A theft is witnessed.
  - The rope burns.
  - Patches are applied, rejected or persisted.
  - Risk and recovery.
  - The wild attacks by faction.
  - Save and continue.
  - Legible plans.
- The renderer and the catalog changes must not change engine behaviour. Terrains that were added for the seasons must be known to the renderer's solid and walkable handling in the same way as `tree` and `pine`.

## Interface

In `packages/tools/src/demo/world.ts`:

- `export const STAND: { readonly tree: readonly [number, number]; readonly winch: readonly [number, number]; readonly castFrom: readonly [number, number]; readonly fill: readonly [number, number]; readonly raft: readonly [number, number]; readonly chest: readonly [number, number]; readonly tobin: readonly [number, number]; readonly cart: readonly [number, number]; readonly road: readonly [number, number]; readonly meadow: readonly [number, number]; readonly frostGround: readonly [number, number]; readonly byFire: readonly [number, number] }`, exported alongside the existing `AT`.
- `AT` keeps its existing export and keys, with new coordinate values.
- `FAR_BANK: number`, the first column of the far-bank (goal) region, replaces the old `RIVER` export.

In `packages/client/src/assets/catalog.ts`:

- New terrain-object lists: `tree_autumn`, `tree_blossom`, `pine_snow`.
- New terrain pieces: `cliff_l`, `cliff_m`, `cliff_r`.
- New scenery or decor groups: `bench`, `rack`, `stump_table`, `mat`, `blanket`, `rope_coil`, `reeds`, `bones`, `signpost`, `moss`.

No new names are added in `scene.ts`.
