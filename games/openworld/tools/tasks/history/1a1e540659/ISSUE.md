# Editor map: pure edit functions (shapes, blocks, buildings, rooms, interiors, duplicate map) and redo in the store

## What is wanted

The editor's map mode needs to be edited the way RPG Maker's is. The edits themselves should live in a new module of pure functions, `packages/editor/src/app/mapEdit.ts`: each takes a map file's data (a `RawChunk`) and changes it, and the store records the change as an undoable edit. The store also needs **redo**, so that an undone edit can be made again.

The editor needs the following:

- **Shapes**: the cells of a brush, a rectangle, an ellipse and a flood fill, and painting the ground or the height over cells.
- **Blocks**: copy a box of a map with the things on it (and what those hold), paste it elsewhere with new ids, cut/clear it, and move it. A single thing can be copied as a block of its own.
- **Things**: move one thing, remove things (with what they hold), and give new things unique ids.
- **Buildings**: stamp a prefab from the catalogue onto a map, find the building under a cell, and remove it.
- **Rooms**: lay a room's walls in a wall style.
- **Interior behind a door**: make a new interior map for a door, with a portal each way.
- **Duplicate a map** with its own ids.
- **Starter catalogue**: it has no prefabs yet and only one room style. It should gain eight houses (`house_orange`, `house_plaster`, `house_thatch`, `house_red`, `house_wood`, `cabin`, `shop`, `hut_straw`) and three more wall styles (`plaster`, `stone`, `moss`) beside `wood`, drawn from the sheets it already has.
- **Redo** in the store (undo's counterpart), with the next undo/redo label exposed so the UI can show it.

## Expected behaviour

**Shapes**
- `brushCells(c, size)` is a square of `size` cells a side about `c`. Size 1 is the cell alone; size 3 is 9 cells starting at (x−1, y−1). An even size reaches further right and down. A size below 1 counts as 1.
- `rectCells(a, b)` is every cell of the box the two corners span, in either corner order (corners (3,1) and (1,2) give 6 cells).
- `ellipseCells(a, b)` is the ellipse inscribed in that box; a cell is in when its centre is. On a 7×5 box the corners are out and the middle row is whole (7 cells). A single-cell box gives that cell.
- `floodCells(chunk, layer, from)` is the cells joined to `from` by their sides that hold the same value on the layer (`'ground'` or `'height'`); a height with no heights written reads as `'0'`. Off the map it gives no cells.
- `valueAt(chunk, layer, c)` is the ground character or the height digit at a cell, `undefined` off the map.
- `paint(chunk, layer, cells, value)` writes the value over the cells; cells off the map are left alone. Painting a height creates the heights when none are written, and removes them again once every height is 0.

**Things and blocks**
- `idsOf(chunks, people?)` is the set of ids already taken by things and people.
- `copyBlock(chunk, box, prefabs?)` gives a block holding the box's ground rows, heights, the things on its tiles together with everything they hold (inside or in hand, at any depth), and the stamps (buildings) and rooms lying wholly inside the box, with places relative to the box's top left. A box is clipped to the map.
- `copyThing(chunk, id)` gives a block of one tile-standing thing and what it holds, which leaves the ground as it is when pasted. It gives nothing for an unknown thing or one not on a tile.
- `pasteBlock(chunk, block, at, taken, prefabs?)` lays the block with its top left at `at`: ground and heights where they fall on the map, stamps and rooms that fit wholly on the map, and the things as new ones. It returns the new ids. The ids are new (`<map id>.<kind's last word><n>`, with `n` the first number not taken, and `taken` updated), what holds what is renumbered alike, a thing's home (`ai.home`) moves with it. Things that fall off the map are left out, with everything they hold. The original stays untouched. Pasting a block copied from a house does not make a portal for the copy.
- `moveThing(chunk, id, to)` moves a tile-standing thing (and its home) to a cell of the map; it returns false for an unknown thing, one not on a tile, or a target off the map.
- `removeThings(chunk, ids)` removes the things and what they hold, returning how many went.
- `clearBlock(chunk, box, ground?, prefabs?)` removes the box's things, the buildings and rooms wholly in it, gives its cells the ground (if given) and height 0.
- `moveBlock(chunk, box, delta, ground, prefabs?)` moves the box's ground, heights, things (same ids), buildings, rooms, portals, anchors and areas that lie wholly in it by `delta`, gives the cells it leaves the ground `ground`, removes things carried off the map, and returns the box where it now is. Example: a house at (1,1) with a portal on its door at (2,3), an anchor at (2,4) and a sign at (3,4), moved by (5,2) from box (0,0,6,5): the stamp is at (6,3), the portal at (7,5), the anchor at (7,6), the sign at (8,6), and the old cells are the given ground again.
- `groundAround(chunk, box, chars, fallback)` gives the ground character most common just outside a box, walls and doors aside, or the fallback when there is none.

**Buildings and rooms**
- A `Prefab` is `{ tw, th, grid, terrain? }`, where the grid has `#` for solid, `D` for the door, `.` for drawn and free, space for nothing; the solid cells take the prefab's terrain (default `wall`).
- `stampBuilding(chunk, key, prefab, at, chars)` adds `{ key, x, y }` to the map's stamps, paints the solid cells with the character the game writes for the terrain, and paints the door with the door terrain's character. It returns the door cell, or `undefined` if the prefab has no door on the map. Where the game writes no character for the terrain needed (e.g. `wall`), it throws an `EditError` whose message names the terrain, e.g. mentions `wall`.
- `stampAt(chunk, prefabs, cell)` gives the index of the topmost stamp whose picture covers the cell, or `undefined`.
- `removeStamp(chunk, prefabs, index, ground)` takes the stamp away, gives its solid and door cells the ground, and removes the stamps list when empty.
- `room(chunk, style, box, chars, floor?, doorways?)` paints the ring of the box as wall (door at the doorway cells), the inside as the floor if given, and records `{ style, x, y, w, h }` in the map's rooms. It throws an `EditError` when the game writes no wall (or, with doorways, no door) character.
- `roomAt(chunk, cell)` gives the index of the room whose walls are on a cell (the last laid).
- `interiorBehind(chunk, doorCell, spec, chars)` returns a new map file (`RawChunk`) for the interior behind a door, with `spec = { id, name, w, h, style, floor }`. It is a room filling the map (walls ringed, floor inside, a door in the bottom wall, in the middle), of kind `interior`, light `indoor`, zone `peaceful`, with the room recorded. It has a portal from its door back to the outside map, landing just below the outside door; and the outside map gets a portal from the door cell to the interior, landing just above the interior's door, labelled with the interior's name.
- `duplicateMap(chunk, newId, newName, taken)` gives a copy of a map with the new id and name; its things take new ids that begin with the new map's id, with what holds what kept consistent, and their places and homes pointing at the new map.

**Store: redo**
- After `undo()`, `redo()` makes the edit again and returns its label; with nothing to redo it returns `undefined`.
- A multi-cell stroke (changes merged with the same grouping) is undone and redone as one edit.
- Making any new edit clears what could be redone.
- Redo works on added files and on removed files, as undo does.
- `next()` returns `{ undo?: string, redo?: string }`, the labels of the edit an undo or a redo would act on (absent when none). After one undo of an edit labelled `paint`, `next()` is `{ redo: 'paint' }` if nothing else is left to undo.
- Redone edits count as unsaved as the originals did.

**The editor's use of it** (not tested here, but the issue's point): the map gets four layers (ground, height, things, marks) with tools and keys, a status bar, redo beside Undo, and the canvas events for right-button picking, panning and zoom described in the commit message.

## Requirements

- The functions above are pure over the map file's data: nothing is read from or written to disk, and the same data is changed in place.
- Pasted or duplicated things never reuse an id that is taken; ids of things that hold or are held by each other are renumbered together.
- Buildings, rooms and an interior made with these functions compile with no new problem on the starter project, as does a duplicated map (its copy's chest still holds its axe).
- The starter's catalogue compiles with the new prefabs and room styles; the prefab houses use the existing house tileset picture.
- Redo does not break undo: after redo, a further undo restores the earlier state exactly.
- Undone-then-redone additions and removals of files leave the same files as the original action did.

## Interface

All in `packages/editor/src/app/mapEdit.ts` unless stated.

Types:
- `Cell { x: number; y: number }`
- `Box { x: number; y: number; w: number; h: number }`
- `Layer = 'ground' | 'height'`
- `Block { w; h; rows: string[]; heights?: string[]; entities: Entity[]; stamps?; rooms?; things?: boolean }`
- `Prefab { tw: number; th: number; grid: string[]; terrain?: string }`
- `class EditError extends Error`

Functions:
- `boxOf(a: Cell, b: Cell): Box`
- `brushCells(c: Cell, size: number): Cell[]`
- `rectCells(a: Cell, b: Cell): Cell[]`
- `ellipseCells(a: Cell, b: Cell): Cell[]`
- `valueAt(ch: RawChunk, layer: Layer, c: Cell): string | undefined`
- `floodCells(ch: RawChunk, layer: Layer, from: Cell): Cell[]`
- `groundAround(ch: RawChunk, r: Box, chars: Record<string,string>, fallback: string): string`
- `paint(ch: RawChunk, layer: Layer, cells: Cell[], value: string): void`
- `idsOf(chunks: RawChunk[], people?: string[]): Set<string>`
- `newId(mapId: string, type: string, taken: Set<string>): string`
- `thingsIn(ch: RawChunk, r: Box): Entity[]`
- `moveThing(ch: RawChunk, id: string, to: Cell): boolean`
- `removeThings(ch: RawChunk, ids: string[]): number`
- `copyBlock(ch: RawChunk, r: Box, prefabs?: Record<string, Prefab>): Block`
- `copyThing(ch: RawChunk, id: string): Block | undefined`
- `clip(m: RawChunk['map'], r: Box): Box`
- `clearBlock(ch: RawChunk, r: Box, ground?: string, prefabs?: Record<string, Prefab>): void`
- `pasteBlock(ch: RawChunk, b: Block, at: Cell, taken: Set<string>, prefabs?: Record<string, Prefab>): string[]`
- `moveBlock(ch: RawChunk, r: Box, d: Cell, ground: string, prefabs?: Record<string, Prefab>): Box`
- `charOf(chars: Record<string,string>, terrain: string): string | undefined`
- `stampBuilding(ch: RawChunk, key: string, p: Prefab, at: Cell, chars: Record<string,string>): Cell | undefined`
- `stampAt(ch: RawChunk, prefabs: Record<string, Prefab>, c: Cell): number | undefined`
- `removeStamp(ch: RawChunk, prefabs: Record<string, Prefab>, i: number, ground: string): void`
- `room(ch: RawChunk, style: string, r: Box, chars: Record<string,string>, floor?: string, doorways?: Cell[]): void`
- `roomAt(ch: RawChunk, c: Cell): number | undefined`
- `interiorBehind(ch: RawChunk, door: Cell, spec: { id: string; name: Text; w: number; h: number; style: string; floor: string }, chars: Record<string,string>): RawChunk`
- `duplicateMap(ch: RawChunk, newId: string, newName: Text, taken: Set<string>): RawChunk`

Store (`packages/editor/src/app/store.ts`):
- `Store.redo(): string | undefined`
- `Store.next(): { undo?: string; redo?: string }`

Canvas (`packages/editor/src/app/canvas.ts`, used by the UI): `CellEvent` gains `'rdown' | 'rdrag' | 'rup' | 'double' | 'leave'`; `Keys { shift; alt; ctrl }`; `ZOOMS` (the status bar's zoom presets); `Mode.keydown?(ctx, e): boolean` in `context.ts`.
