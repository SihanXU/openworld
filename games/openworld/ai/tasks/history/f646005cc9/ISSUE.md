# A new game begins in a bare tutorial plot, or at the foot of the mountain if the tutorial is skipped

## What is wanted

Today every new game begins on the summit of the mountain. A new game should instead be able to begin in one of two ways:

1. **Tutorial** (the default): a small, bare, closed plot of grass where the player begins alone with the bird (Pip).
2. **Skip the tutorial**: the game begins at the foot of the mountain, on the trail, with the story at the stage of the seal stone (the next beat is the stone's).

The places a game may begin must be data in the world index, not hard-coded, and `Game.create` must be able to begin at a named start. The cover's new-game panel must let the player choose between the two, and the tagline should no longer mention Cloudtop.

## Expected behaviour

**World data**
- The world index has the default `start` plus an optional set of other starts by name. Each names a position and optionally the props the player has there (e.g. the story stage).
- `Game.create(index, ontology, library, start?)`: with no `start`, the game begins at the index's default start. With a name, it begins at that start's position, the player gets that start's props merged over its own, the spawn point is that position, and the companions begin beside it. An unknown name throws an error.
- The generated world's default start is the tutorial plot. It has one other start named `skip`, at the Mountain Foot (on the trail coming down onto the foot), with the prologue stage set to the stage at which the seal stone's beat is next.

**The tutorial plot** (map id `tutorial`, 20×14, player spawn at its (10, 7))
- Grass on every cell and no entities on it other than the player and `pip`.
- No portal, and no place on the overworld (no site), so its edges are the world's edge: walking into any edge leaves the player where they stand.
- Peaceful, with no ground yield: over a full day and night nothing appears on it and nothing comes out of the dark.
- Its map is not placed on the overworld, so checks that every map lies on the overworld must leave it out.

**Skip start**
- Player on map `foot` at the trail position, the prologue stage equal to the new exported stage constant, Pip on the foot map beside the player. Walking down to the seal stone brings its beat (the fact `seen.relic` becomes set).

**Cover / client**
- The new-game panel offers "Tutorial" and "Skip the tutorial" (with Chinese equivalents), Tutorial selected by default, beside the difficulty choice.
- Choosing to skip passes the start name `skip` on to the game's creation (through the worker's init message); choosing the tutorial passes no start.
- The tagline no longer says the game sets out from Cloudtop (both languages).
- The focus box (the aim highlight) is not drawn for a target past the map's edge.

## Requirements

- Starts are expressed as world data and selectable by name in `Game.create`; an unknown start name is an error.
- The default new game begins in the tutorial; `skip` begins at the foot as described.
- The tutorial plot is bare, closed, peaceful, and absent from the overworld; the world's existing tests that iterate every map against the overworld exclude it.
- The prologue stage of the seal stone's beats is available as a named constant so content and the world builder share it.
- Existing scenarios that relied on starting at the summit shelter (the prologue walk-through) must be able to place the player and Pip there themselves, and scenarios that relied on an author's placement making contact with a region must step into the region.
- The client's start handler receives the new-game choice (difficulty and optional start) and forwards both to the worker.

## Interface

- `StartDef` (exported from `packages/engine/src/game.ts`, and thus the engine package): `{ at: Pos; props?: Record<string, PropValue> }`.
- `WorldIndex.starts?: Record<string, StartDef>` in `packages/engine/src/game.ts`.
- `Game.create(index: WorldIndex, ontology: Ontology, library: RuleLibrary, start?: string): Game` in `packages/engine/src/game.ts`.
- `PROLOGUE_AT_FOOT` (number, the seal stone's stage) exported from `packages/content/src/prologue.ts` and the content package.
- `TUTORIAL` exported from `packages/tools/src/demo/prologue.ts`: a constant with `size: [20, 14]`, `spawn: [10, 7]`, and `skip: [20, 3]` (the skip start's position on the foot map).
- `buildTutorial(): MapBuilder` in `packages/tools/src/demo/prologue.ts`, building the map with id `tutorial`.
- `NewGame` (exported from `packages/client/src/ui/cover.ts`): `{ difficulty: Difficulty; start?: string }`; `CoverHandlers.start(slot, data, game?: NewGame)` replaces the former difficulty argument.
- `ToWorker` `init` message gains an optional `start?: string`.
