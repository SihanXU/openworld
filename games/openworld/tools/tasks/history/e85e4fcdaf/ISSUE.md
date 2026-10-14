# The OpenWorld Editor, first part: maps, people, validation and playtest

## What is wanted

A new package, `packages/editor`, which is the first part of the OpenWorld Editor. An author should be able to make a new map and a person with a day in a browser, and then play them, without writing any TypeScript. It has two halves.

1. **A local service over the projects' files.** Given a folder of games, it lists the projects, reads one, writes one of its files, makes a new project from the starter, and reports what the compiler finds. It writes only the format's files.
2. **The editor's in-memory project.** The project is held in memory. Edits stay unsaved until Save. A stroke is undone in one step. The compiler's view of the project always reflects the project as it is now.

Around those two parts, the editor also needs:

- a UI with a map mode (terrain, heights, things, portals, anchors, areas, the start, a cell inspector, and maps made, resized and deleted);
- a people mode (where a person stands, their day over the anchors, their lines, and their look through the character creator);
- a validation panel;
- playtest from any cell.

On the runtime side, `WorldScene` needs a free camera and an overlay, so the editor can use it as its canvas. The player must accept `?playtest=1&at=<map>,<x>,<y>`, which starts a new game at that place at once and saves nothing. `Game.create` must accept a start given by the caller.

A game's project may also live at `games/<id>/project/`, and its assets in `public/assets`. `npm run editor` starts the editor's dev server, and the editor package is included in the typecheck.

## Expected behaviour

**Service**
- `list()` returns one entry per project in the folder, each with an `id`.
- `read(id)` returns the project: its game, its maps (each with a `file` and `data`) and its people.
- `write(id, file, data)` writes the file exactly as the format's own JSON formatter would, and the compiler then sees the change. After a valid edit to a starter map, `problems(id).problems` is `[]`.
- The service refuses to write anything that is not one of the format's files. A path escaping the project (`../escape.json`) and a file such as `test/kernel.test.ts` both throw an error containing `only the format's files`. Writing to an unknown project throws an error containing `no project`.
- `create(id, name)` makes a new project from the starter with its own id and display name.
  - The starter's `test` folder is not copied.
  - The new project reads back with `game.id` and `game.name` set, and compiles with no problems.
  - A name may be a plain string or a bilingual `{ en, zh }` text.
  - Creating an id that already exists throws an error containing `exists`.
  - Creating an id that is not a valid project id (for example `Bad Id`) throws an error containing `not a project id`.

**Store**
- A store is made from a project id and a project already read. `unsaved()` is 0 at first, and becomes 1 after an edit to one file.
- `compiled()` shows an edit at once, before any save.
- `change(file, why, fn, stroke?)` edits a file through a function. Changes that share a stroke number are undone together in a single `undo()`. `undo()` returns the `why` of what it undid, and returns `undefined` when nothing is left.
- A change that alters nothing is not an edit. It adds nothing to the undo history and does not count as unsaved.
- `add(file, data, why)` and `remove(file, why)` add and remove files. Both can be undone. After removing a person, the compiled index no longer lists that person. After undoing, they are back.
- `list('people')` lists the people files, each with `file` and `data`.

## Requirements

- The service reaches only the format's files inside a project (the game file, maps, people, the ontology and the other files the format defines). It rejects any other path, including ones that climb out of the project.
- The bytes written are identical to what the format's formatter produces for the same data.
- Creating a project copies the starter without its tests, then sets its id and name. It refuses ids that exist or are malformed.
- The store never mutates the project it was given in a way that loses the original. Undo restores the exact earlier state, including after a many-cell stroke.
- A stroke made of many `change` calls with the same stroke number undoes in one step.
- The compiled view is rebuilt from the project as it is now, not from what is on disk.
- `Game.create` accepts a given start (a map and a position), and the editor's canvas uses it to show the person at the keys.
- `WorldScene` offers a free camera (pan, zoom, look at a cell, convert a screen point to a cell) and an overlay hook for drawing the editor's marks.
- The player reads `?playtest=1&at=<map>,<x>,<y>` and begins a new game there at once, without saving it.
- The editor package may import only the engine, the stdlib, the format, the modules and the runtime. The boundary rules must permit exactly this.
- The editor package is part of `npm run typecheck`. `docs/engine-split.md` section 11 and `CLAUDE.md` record the work.

## Interface

- `packages/editor/package.json`: package `@openworld/editor`, private, ES module, with `main` set to `src/server/api.ts`.
- `packages/editor/src/server/api.ts`: exports `class ProjectsApi`.
  - `constructor(gamesDir: string)`
  - `list(): { id: string; name: Text; modules: string[]; maps: number; people: number }[]`
  - `read(id: string)`: returns a project with `game`, `maps: { file: string; data: RawChunk }[]` and the people.
  - `write(id: string, file: string, data: unknown): void`
  - `create(id: string, name: Text | string): void`
  - `problems(id: string): { problems: … }`
- `packages/editor/src/app/store.ts`: exports `class Store`.
  - `constructor(id: string, project: Project)`
  - `static open(id: string): Promise<Store>`
  - `game`: the project's game definition.
  - `get<T>(file: string): T | undefined`
  - `list<T>(dir: string): { file: string; data: T }[]`
  - `maps(): { file: string; data: RawChunk }[]`
  - `mapFile(mapId: string): string | undefined`
  - `change<T>(file: string, why: string, fn: (data: T) => void, stroke?: number): void`
  - `add(file: string, data: unknown, why: string): void`
  - `remove(file: string, why: string): void`
  - `undo(): string | undefined`
  - `unsaved(): number`
  - `save(): Promise<void>`
  - `compiled(): Compiled`
  - `on(listener: (why: string, file?: string) => void): void`
- `Game.create` (engine) takes an option `{ at: { map: string; x: number; y: number } }` for the start.
- `WorldScene` (`packages/runtime/src/render/scene.ts`) gains `setFreeCamera(on: boolean)`, `panBy(dx, dy)`, `zoomBy(factor, x, y)`, `lookAt(x, y)`, `cellAt(px, py): { x: number; y: number } | undefined` and `drawOverlay(fn: (g: Phaser.GameObjects.Graphics, tile: number) => void)`.
- npm script `editor` in the root `package.json`.
- The boundary rule for the `editor` package lists `@openworld/engine`, `@openworld/stdlib`, `@openworld/format`, `@openworld/modules` and `@openworld/runtime` as imports it may make.
