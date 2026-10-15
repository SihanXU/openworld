# Things that turn (stairs, stakes, fences) should face the one who sets them, and the builder should be able to pick the way

## What is wanted

Today only stairs have a facing, and only when set down by hand. A fence never has a way, and building through the placement system does not turn the builder toward what they build. We want a general notion of "a thing that turns":

- Stairs, stakes and a fence turn.
- When such a thing is set down by hand, or becomes another such thing where it lies (sticks into stakes, stakes into a fence), it faces the way the one who made it was facing, its front toward them. One that already has a facing keeps it.
- When building through placement, the builder first turns toward the cell being built, or toward a way explicitly chosen (the build palette's R key), and the thing built takes that facing.
- In the client, a fence facing east or west is drawn "across" (a north-south rail picture), and the build palette's ghost and the hand's ghost show a direction arrow for anything that turns, with the fence's across picture when it will face east or west.

## Expected behaviour

- A builder standing south of the target cell places a fence: the fence faces `up` (running east-west across their way).
- Placing a fence with an explicit facing of `right` gives a fence facing `right`, regardless of where the builder stands.
- A player standing east of a cell, holding stairs and setting them down by hand on that cell: the stairs face `left` (they go up westward).
- Stakes made from sticks, and a fence made from stakes, take the maker's facing if they have none; if they already have one, it is unchanged.
- Stairs behave as before.
- The placement flow passes the palette's chosen direction through to the placement function; with none chosen, the builder's direction to the cell is used. If the builder is on the target cell itself and no facing is given, their facing is left unchanged.

## Requirements

- Add a content tag `turns` to stairs, stakes and the fence; the "set down" behaviour keys off this tag, not off the stairs tag.
- A thing with `turns` that is set down on a tile takes the setter's facing, when the setter has one.
- A thing with `turns` that transforms in place takes the maker's facing only when it has none yet, and the maker has one.
- Placement turns the builder to face the target (or the given facing) before the build steps run, so the built thing inherits it.
- The facing the palette chooses reaches placement from the client's worker.
- Rendering: a fixture with an `across` picture and a facing of left or right is drawn with that picture; the palette and hand ghosts show an arrow for anything that turns, and the across picture for a fence that will face east or west.
- The catalogue gives the fence an `across` picture (the vertical rail).
- Documentation (building doc, wiki pages for fence and building) reflects the new behaviour.
- Existing tests continue to pass.

## Interface

- `performPlacement(eng: Engine, actorId: Id, recipe: PlacementRecipe, at: Pos, facing?: Dir): PlacementPreview` in `packages/engine/src/placement.ts` — new optional fifth parameter `facing`, a `Dir` (`'up' | 'right' | 'down' | 'left'`).
- Ontology tag `turns` on `structure/stairs`, `fixture/fence` and `fixture/build/stakes` (`packages/content/src/ontology.ts`).
- Catalogue fixture entry field `across?: SpriteDef` (`packages/client/src/assets/types.ts`), set for `fixture:fence` in `packages/client/src/assets/catalog.ts`.
- Client building-mode paint callback takes an optional second argument: `paint?: (sprite: string, across?: boolean) => HTMLCanvasElement | undefined`.
- The worker's placement message carries an optional `facing` (a `Dir`), which is forwarded to `performPlacement`.
