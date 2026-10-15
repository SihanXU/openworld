# One stage clock for everything that grows, one `appear` primitive for everything that appears by itself

## What is wrong (for a fix) or What is wanted (for a feature)

Things that change over time and things that turn up on their own are each handled by a separate mechanism, and every case has its own status, its own rule and its own code:

- **Growth and return.** Stumps regrow through a `regrowing` status and `wood/regrow`. Planted acorns/saplings use `rooting` and `farm/root`. Crops use `farm/grow`. Hens lay through `laying` and `animal/lay-egg`. Ice that froze from water thaws through `frost/thaw`. All do the same job: a clock runs out and the thing becomes something else or leaves something behind.
- **Appearances.** The ground's yield (sticks, stones, grass; returning cows and hens) is done by `forage`, and the night's walkers by a separate `nightspawn`. Both are "something of a weighted type shows up on a free cell, up to a maximum", written twice.

We want:

1. One **stage** mechanism, declared as data on a type or terrain, with one clock status named `stage` and one root rule/primitive that runs it.
2. One **appearance** mechanism, declared as data (on a map and on the world's ontology), with one periodic primitive that runs it.

The old separate mechanisms and statuses go away. Old saves and old chunks must still load.

## Expected behaviour

### Stages

- A type or terrain may declare a stage with: what it becomes next (`into`), how long it lasts (`lasts`), which status is its clock (`clock`, default `stage`), a condition it needs (`needs`), how long to wait before looking again when the need is unmet (`wait`), what it leaves when the stage ends (`yields`), and a visual effect (`fx`).
- The clock starts when a thing comes to exist or is transformed into a type that has a stage (`World.add`/`World.transform`). For a thing already in a stage in a map's own data (e.g. a stump drawn in a chunk), the clock starts when that map arrives (`World.startStages`). Such a stump gets a `stage` status that ends in the future and is not static.
- When the clock runs out:
  - If the stage has `needs` and they are not met, the clock is set again to `wait` ticks later (falling back to `lasts`, then an hour) and nothing else happens.
  - If met, the stage's `yields` are spawned on the thing's tile, the `fx` plays, and the thing transforms into `into`. If there is no `into` but there is `lasts`, the clock starts again.
- Data that uses it:
  - **Stumps and oak saplings** become a tree after two game days (exported as `TREE_GROWS`, 28800 ticks). They need to be out under the sky and nobody standing on them. If someone is on the stump or the sapling, it waits and looks again, and grows once they are gone. A felled tree's stump has its `stage` clock set to `now + TREE_GROWS`.
  - **Crop sprouts and young plants** advance to the next stage on the `watered` clock, and need light (outdoors). An unwatered crop has no `stage` clock and stays as it is. A watered sprout out of doors becomes the young plant when the watering runs out. One indoors, with no light, stays a sprout, still `watered` (it waits).
  - **Thin ice** (made from water, clock `chilled`) thaws back to water.
  - **Hens** lay an egg every three game hours (`LAYS_EVERY` = 1800). The egg is left where she stands, then the clock begins again. A hen created (including by an appearance) has the `stage` status running.
- `regrowing`, `rooting`, `laying` statuses and the rules `wood/regrow`, `farm/grow`, `farm/root`, `animal/lay-egg`, `frost/thaw` are gone. Felling a tree and planting an acorn no longer add a status by hand; the stage starts by itself.
- In saves from before, a thing's `regrowing`, `rooting` or `laying` status (on entities and on old tile overrides) becomes `stage`, with the same end time.

### Appearances

- An appearance is data with: weighted `types`, `on` ground, `max`, `every` (pace), `ring` (distance from the player), `hours`, `weather`, `where` (zone/light of the map), `tag`, `ai` and `statuses`.
- Each map may list its own in `MapData.appear`; the world lists appearances that fit any map its `where` matches in `Ontology.appear`.
- The world's `appear` period (replacing `forage` and `night`) runs the `appear` primitive on the active map: each appearance whose pace is due, at its hours and in its weather, adds one more of one of its weighted types on a free walkable cell of its ground, never within two cells of the player (unless it has a `ring`, which places it at that distance from the player and needs the player on that map), until `max` of it are on the map. "How many are there" counts things with its `tag` if it has one, else things of its types. A creature appears with its behaviour at home where it appeared, with its tag and statuses.
- The night's walkers (zombies 0.6, bats 0.4) are now an ontology appearance: zone `combat`, outdoor light, hours 21–5, ring 6–10, max `NIGHT_CAP` (4), every `NIGHT_EVERY` (60), tag `nightborn`, aggressive melee AI.
- A chunk written the old way (`forage`, one type each) is read as `appear`, both when decoded and when a map arrives. The ground's default pace is `APPEAR_EVERY` (150). Boss challenge and gallery maps clear their `appear`.
- The forage and night-spawn modules, the `forage` primitive and the old `appear {types, ring, cap, tag}` effect shape are replaced by the new ones.

### Reachability

Everything every recipe and building asks for must come back without end, from appearances, the generated wilderness, or stages on a cycle (a stump to a tree, a hen to a hen, a young plant to a ripe plant). The test for this considers a stage that leads back to itself as a renewable source.

## Requirements

- A type or terrain can declare a `stage`; the clock begins on add and transform, and on map arrival for what a map is drawn with.
- The `stage` status exists; `chilled` and `watered` can be a stage's clock.
- One root rule on `time/timer` runs a `grow` primitive; the stage conditions are evaluated against the event's roles.
- A stage's unmet need delays rather than loses growth; a stump or sapling never grows under an actor.
- Hens have `stage` set when they exist, and an egg appears each time it runs out.
- `Ontology.appear`, `MapData.appear`, and the `appear` period/primitive replace forage and the night-spawn. `appear` stays resident-only.
- An old chunk with `forage` and an old save with `regrowing`/`rooting`/`laying` load and behave as the new forms.
- Ford and pasture maps' ground and animal yields keep their caps and can be found on `MapData.appear` with `types` keyed by type.
- All the old exports that tests need are replaced by the new ones below.

## Interface

In `@lsw/engine`:

- `AppearDef` (type, in `types.ts`): `{ types: Record<string, number>; on?: string[]; max: number; every?: number; ring?: [number, number]; hours?: [number, number]; weather?: string[]; where?: { zone?: string; light?: string }; tag?: string; ai?: AiData; statuses?: string[] }`
- `MapData.appear?: AppearDef[]` and `Ontology.appear?: AppearDef[]`.
- `StageDef` (type, in `types.ts`): `{ into?: string; lasts?: number; clock?: string; needs?: Cond; wait?: number; yields?: { type: string; count?: number }[]; fx?: string }`, as `stage?: StageDef` on `TypeDef` and `TerrainDef`.
- `World.startStages(map: string): void` — starts the `stage` clock of everything on that map that is in a stage.
- `appear(eng: Engine, what?: AppearDef): void`, `appearancesOf(eng: Engine, map: MapData): AppearDef[]`, `appearFromForage(map: MapData): AppearDef[] | undefined`, constants `APPEAR_TICK` (30) and `APPEAR_EVERY` (150), exported from the engine (in `appear.ts`; replaces `forage.ts` / `nightspawn.ts` and the exported `FORAGE_EVERY`).
- Effect primitive `grow` (no parameters); the `appear` effect takes optional `what`.
- Status `stage`.

In `@lsw/content`:

- `TREE_GROWS` (28800), `LAYS_EVERY` (1800), `NIGHT_CAP` (4), `NIGHT_EVERY` (60), exported from `ontology.ts` (the last two move from the engine).
- Rule `core/stage` on `time/timer`.
- `RawMap.appear` accepted in chunk files (an older chunk's `forage` still read).
