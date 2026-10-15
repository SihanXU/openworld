# The OpenWorld Editor as a program of its own: projects anywhere, a local-only service, its own server, asset import, export, and game-neutral interface words

## What is wanted

The editor today is the team's tool over the repository's `games/` folder. It should become a game-making program in the manner of RPG Maker, usable on any project on the disk, runnable by itself, able to import pictures and sounds, able to export a playable game, and with a runtime that no longer carries one game's wording.

1. **Projects anywhere.** A project is any folder containing a `game.json`. The editor keeps a recent list in its own home folder, can show the repository's `games/` as a shelf (in development), and can make new projects from either the starter or an empty template, in a folder the author chooses.
2. **A service for its own machine.** The editor's HTTP service answers only requests addressed to the local machine, and refuses every change request that does not carry the editor's header.
3. **The editor's own server.** One server serves the built editor page, the built player, the service, the shipped asset pack, and the projects compiled as the player fetches them. A build step lays out a distributable folder, and a start command runs it.
4. **Pictures and sounds.** Files can be imported into a project under `assets/own/`. The shipped pack (the Ninja Adventure subset, CC0) is listed, and files from it are copied into a project when it uses them. An Assets mode edits the catalogue by kind, each entry cut from a picture on a grid, and lists what still needs a picture.
5. **Export.** A project can be exported as a folder (the player plus the game compiled beside it) that any web server can serve, optionally with a zip of it. The latest export is served so it can be tried at once.
6. **Desktop application.** The editor is wrapped in an Electron shell outside the root workspaces. The server runs inside it, and the system's folder dialog is bridged to the page. There are npm scripts to run it and to package it, and a workflow that builds installers for Windows, macOS and Linux.
7. **A game-neutral runtime.** The runtime must not hard-code any one game's words. The interface's words become game data, overridable per game through a `texts` table. The Ford's trainer and fairy wording moves into OpenWorld's own client. The cover's companion and credits are data, and module keys in the controls appear only with their module. Saves are named by their game.
8. **Game mode.** A mode in the editor for the game's settings, the engine's modules, the world's parameters, the cover, the interface words, the factions, and the other parts of the ontology and of the player's tables.

## Expected behaviour

**Workspace**
- Creating a project from the `starter` template in a chosen folder gives a project with that folder's name as its key, with the starter's two maps and one person.
- Creating from the `empty` template gives a project with one map (`world`), no people, quests or story. It compiles without errors, and the game starts on that map.
- A `folder` and a `dirName` may be given. The key is derived from the directory name (e.g. `Blank Game` → `blank-game`).
- Without a folder, a project is made under the workspace's default projects folder.
- A new run of the editor remembers earlier projects. They are listed newest first, followed by the shelf's games.
- Opening a folder returns a project under a unique key. A second folder with the same name gets a suffixed key (`forest-2`). Opening an already known folder returns its existing key. A folder with no `game.json` is refused with an error saying it is "not a project".
- Forgetting a project removes it from the list without touching its files. A listed project whose folder has disappeared stays listed, marked `missing`, until forgotten.
- Browsing a folder lists its subfolders, marks those that are projects, and gives the parent folder.
- Keys are safe for the player's URLs: `My Game!` → `my-game`, and a name with no usable characters (e.g. `林间`) → `project`.
- Creating with an invalid id is refused with "not a game id". Creating with an id that already exists is refused with "exists".

**Service**
- A request whose `Host` is not local (a DNS-rebinding attempt such as `evil.example`) gets 403.
- A change request (`PUT`/`POST`/`DELETE`) without the editor's header gets 403. With the header it succeeds.
- `GET /api/workspace` reports the templates (`starter`, `empty`) and the projects.

**Assets**
- `PUT /api/projects/:key/assets/own/<name>` stores the file and answers with `{ path, kind, w, h }` (`kind` is `image` or `sound`; the PNG's size is read from its header).
- Paths outside `own/` (e.g. `na/...`) and paths that escape through `..`, encoded or not, get 400.
- `GET /api/pack` lists the pack's files with `path`, `size`, `kind` and, for images, their size.
- `POST /api/projects/:key/assets/from-pack` with `{ paths }` copies those pack files into the project under `assets/na/` and answers `{ taken: [...] }`.
- `GET /api/projects/:key/assets` lists the project's files, both `own/...` and `na/...`.
- `DELETE` on an own asset removes it.

**Export**
- `POST /api/projects/:key/export` with `{ folder, zip? }` writes the player (without its bundled `games/`), the game compiled under `game/` (the bundle, `world/maps/*.json`, `assets/`), and an `index.html` whose title is the game's name and which carries `<meta name="openworld-game" content="game/" />`. It also writes a marker file (exported as `MARK`).
- The answer carries `dir`, `files`, `warnings` (empty for a clean project), `url`, and, when a zip was asked for, `zip.file`. The zip holds every file of the folder byte for byte, and its entry count equals `files`.
- The export is served at the returned `url`, so `url + 'game/bundle.json'` returns the bundle.
- A later export into its own previous folder replaces it. A non-empty folder that is not a previous export is refused with an error saying it is "not empty", and its contents are left untouched.

**Editor server**
- `/editor/` serves the built page, with correct content types (e.g. `text/javascript` for scripts). `/runtime/play/` serves the player, `/pack/...` serves the pack, and `/` redirects (302) to `/editor/`. Path traversal out of the served roots gives 404.
- `/games/<key>/bundle.json`, `/games/<key>/world/index.json`, `/games/<key>/world/maps/<id>.json` and `/games/<key>/assets/...` serve a project compiled for the player. Assets come from the project's copy, or from the pack's when the project holds none. An unknown key gives 404.
- A project that does not compile gets a 500 whose body says it "does not compile" and lists the errors.
- `startEditor({ root, port: 0, home, projects })` returns a server with `url` (ending in `/editor/`) and `close()`.

**Interface words**
- `ClientGame` gains an optional `texts` table of interface words (`{ en, zh }` per key) over the engine's. When a game's client defines none, `texts` is `undefined` and the engine's words apply. When a bundle's client carries `texts`, `clientGameOf` passes them through.
- The cover's `companion` can be a picture path, and `credit` can be switched off. `clientGameOf` merges these into `cover` alongside the default title (the game's name).
- OpenWorld's client moves its trainer and fairy words into its `texts` (`skillNoProfession`, `boonTitle`, `boonSealedDoc`, `boonOne`) and gives its cover's companion as the fairy's sprite path. Its bundle carries `texts` along.

## Requirements

- Every behaviour listed above holds, including the exact status codes (400, 403, 404, 500, 302) and the error wording named.
- Existing `ProjectsApi` behaviour (list, read, write only the format's files, problems) continues to work. Projects are now identified by `key`, and `create` takes an options object.
- The service refuses non-local hosts for all requests and header-less changes for all mutating methods.
- Asset paths are validated against traversal. Imports go only under `own/`.
- Export never deletes a folder that is not empty and was not made by a previous export.
- The engine's runtime contains no one game's wording. A game with no `texts` behaves as before with the engine's words.
- OpenWorld's own game keeps its current wording, now supplied through its client data.
- The build step produces `packages/editor/dist` containing the editor page, the player, the server (`server/cli.js`, `server/server.js`), the starter template, and the pack. Root `package.json` has the scripts `editor:build`, `editor:start`, `desktop`, `desktop:dist`.
- The desktop shell lives in `packages/editor/desktop` with its own `package.json`, outside the root workspaces. It runs the editor's server on a free port and exposes `pickFolder` and `showFolder` to the page.

## Interface

- `packages/editor/src/server/api.ts`
  - `HEADER` (string constant: the request header every change must carry), exported from here; `packages/editor/src/server/headers.ts` also exports it.
  - `class ProjectsApi` — constructor takes either a games folder path or a `Workspace`, with an optional second argument `{ pack?: string; player?: () => string | undefined }`.
    - `list(): { key: string; ... }[]`
    - `read(key): ...`
    - `problems(key): ...`
    - `create({ id, name, template?, folder?, dirName? })` — `name` is a string or `{ en, zh }`.
    - `handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>` — resolves true when the request was answered, false when it is not the service's.
- `packages/editor/src/server/workspace.ts`
  - `class Workspace`, constructor `{ home: string; shelves?: string[]; templates: Template[]; projects: string }`
    - `create({ template, id, name, folder?, dirName? })` → project summary `{ key, id, dir, maps, people, ... }`
    - `open(dir: string)` → project summary (throws "not a project")
    - `forget(key: string): void`
    - `list()` → summaries (with `missing?: boolean`)
    - `dir(key: string): string`
    - `browse(dir: string)` → `{ dirs: { name: string; project: boolean }[]; parent: string; ... }`
  - `keyOf(name: string): string`
- `packages/editor/src/server/assets.ts`
  - `pngSize(file: string): { w: number; h: number } | undefined`
  - `type AssetFile = { path: string; size: number; kind: 'image' | 'sound' | ...; w?: number; h?: number }`
- `packages/editor/src/server/export.ts`
  - `MARK` (string): the name of the marker file in an exported folder.
- `packages/editor/src/server/server.ts`
  - `templatesOf(starterDir: string): Template[]` — the `starter` and `empty` templates, in that order.
  - `startEditor(opts: { root: string; port?: number; home?: string; projects?: string; shell?: string; shelves?: string[] }): Promise<EditorServer>`
  - `type EditorServer = { url: string; close(): Promise<void> }`
- `packages/editor/src/server/cli.ts` — the command line (`--open`).
- `packages/editor/src/app/api.ts` — `call<T>(path, init?)`, `interface Desktop { pickFolder(o?): Promise<string | undefined>; showFolder(path): Promise<void> }`, `desktop(): Desktop | undefined`.
- `packages/editor/src/app/assetsMode.ts` — `AssetsMode` (the Assets mode).
- `packages/editor/scripts/build.ts` — the build script.
- `packages/editor/desktop/` — `main.mjs`, `preload.cjs`, `package.json`.
- Runtime client types:
  - `ClientGame.texts?: Record<string, { en: string; zh: string }>`
  - The client part of a bundle accepts `texts` and a cover with `companion?: string` and `credit?: boolean`.
  - `clientGameOf(bundle, url)` returns a `ClientGame` whose `texts` is the bundle's, or `undefined`, and whose `cover` merges the default title (the game's name) with the bundle's cover fields.
- Root `package.json` scripts: `editor:build`, `editor:start`, `desktop`, `desktop:dist`.
