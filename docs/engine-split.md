# OpenWorld: the engine, the game, the editor

Status: **agreed with the user 2026-10-10.** The user asked to take OpenWorld out as a game engine of its
own, keep the present game as one story on it, and build an OpenWorld Editor in the manner of RPG Maker
("OpenWorld拿出来专门当游戏引擎，现在的游戏是其中的一个story作为demo，然后同步还要做一个OpenWorld Editor，
像RPG Maker那样可以自己做游戏"), and accepted every recommendation below; then to build P2–P6 in the same pull request ("p2到p6", P7
left). §8 onwards records what was built.

## 1. Decisions

| # | Decision |
|---|---|
| S1 | **One repository first.** The engine, its modules, the runtime, the editor and the modder live in `packages/`; each game lives in `games/<id>/`. `games/*` may import `packages/*`, never the reverse, and a test holds it. The engine goes to a repository of its own only when its API has settled (P7). |
| S2 | **The editor is the team's tool first**: a local web app over the project's files in git, changes going through pull requests as now. A public, packaged editor is decided later. |
| S3 | **This game's systems become the engine's official optional modules** (classes and combat, progression, needs, society, companions, waypoints, bosses, looks, codex), as RPG Maker ships its battle system: a game enables the modules it uses. |
| S4 | **The game is called OpenWorld for now**, like the engine. It lives in `games/openworld/`; its packages are `@openworld-game/*`, the engine's `@openworld/*`. |
| S5 | **The editor takes RPG Maker's feel and OpenWorld's model** (§5): maps, a database, a playtest button; but behaviour is rules on types, never a script per instance, and the holes are where the AI enters. |
| S6 | **A second, minimal game (`games/starter`) proves the engine general**: the kernel without any module runs it; it is the editor's "new project" template and the engine's test fixture. |

## 2. Where we start (audit, 2026-10-10)

What already holds:
- The dependency direction is clean: `engine` imports no other package.
- Rules, story steps, quests, schedules and boss kits are plain data: no field of `engine/src/types.ts` is
  a function, and `gen:world` writes `JSON.stringify` of what the builders made; no closure survives.

What stands in the way:

1. **The game's systems live in the kernel, wired by hand.** The `Engine` constructor makes every subsystem
   (Social, Conduct, NpcSim, Behaviour, Story, Companions, Quests, Controls; `engine.ts` constructor) and
   `tick()` calls them in a fixed order; effects, conditions and goals are closed switches. Content leaks
   into engine code: four professions, about 39 skill ids and 10 relic ids (`combat.ts`), the 20 active
   kinds as code (`actives.ts`), the coin `item/misc/thornmark` (`social.ts`), the story facts `night.shift`
   and `game.difficulty`, the waypoint type, the Ford's save upgrades (`game.ts` `upgrade()`). This also
   breaks world-model.md §1.4 ("the engine holds mechanisms, never numbers").
2. **The content is code that makes data, not data.** Maps are drawn by `MapBuilder` calls whose random
   draws and entity ids (`map~N`) follow call order, so one added stroke moves every draw after it;
   cross-map wiring (edge portals, anchors, household regions, the overworld, protected facts) exists only in
   `buildFord()`; the ontology is assembled by `buildOntology()`; coordinates are written twice, in content
   and in the builders (`FIRSTLIGHT`, `HAVEN`, `BOSS_ARENA`, …).
3. **The client carries the game inside it.** Twenty client files import `@lsw/content`; the rules, the
   ontology, skills, recipes and the asset catalogue (`catalog.ts`) are bundled, only maps and `index.json`
   are fetched; the skill tree, boons, professions and boss pages are this game's UI; the renderer names
   content (`'boss:dragon'`, `alberic`, the spring's steam, the `trainer` badge). The map builder imports
   the client's `CATALOG` (tools → client).
4. The engine has no tests of its own: 42 of the 47 test files run on the Ford (`demo.test.ts` with its
   coordinates). The wiki is bound to this game, as it should be: it is the game's wiki.

## 3. Target layout

```
packages/
  engine/    @openworld/engine   the kernel: things and the clock, ontology, rules, effects, events, cells,
                                 paths, the goal framework, schedules and lines, the story's script, quests,
                                 the Mod port, the sandbox, snapshots, saves, the five inputs
  modules/   @openworld/mod-*    optional systems (S3), each with its rules, primitives, goals, HUD panels
  stdlib/    @openworld/stdlib   the standard root types and rules (core/*, the elements' physics)
  format/    @openworld/format   the project format: schema, validator, compiler (project → bundle)
  runtime/   @openworld/runtime  the player: worker, Phaser renderer, generic HUD
  editor/    @openworld/editor   the OpenWorld Editor
  modder/    @openworld/modder   reads the game's ontology and rules; one patch library per game
  agent/     @openworld/agent    unchanged (rsi.md)
games/
  starter/   the minimal game (S6)
  openworld/ the present game: content, maps, people, quests, art, wiki, its own tests
```

The five inputs stay in the kernel: they are the acts of the AI interface (design.md §5.2); only the bag's
size, the magnet and how a tool or weapon is recognised become parameters.

## 4. The module interface (P2)

```ts
interface EngineModule {
  id: string
  effects?: Record<string, EffectHandler>   // new primitives: they run inside their host's outcome, under World.grant
  conds?: Record<string, CondEvaluator>
  goals?: Record<string, Goal>              // behaviour goals
  phases?: { tick?; enterMap?; contact? }   // where in the loop it runs, declared, in a fixed order
  news?: string[]                           // the news kinds quests may hear
  snapshot?: (frame) => …                   // what the HUD needs
  migrations?: Migration[]
  spec: ModSpecSection                      // these primitives in the ModSpec, so the AI knows what this game has
}
```

The ModSpec and `validatePatch` are assembled from the enabled modules: each game gives the AI its own
interface. `tools/test/writes.test.ts` (the scan for writes behind the writer) extends to the modules.
Modules stay deterministic and never take the author's hand.

## 5. The project format (P3)

```
games/<id>/
  game.json         name, version, engine version, enabled modules, world parameters (day length, weather,
                    start, coin type, …)
  ontology/*.json   types, statuses, terrains, elements, materials, factions; items as forms × materials
                    templates, expanded by the engine
  rules/*.json      by host
  maps/<id>.json    terrain layers, heights, entities (stable ids), portals, regions, named anchors
  people/<id>.json  story/*.json  quests/*.json
  catalog.json      sprite sheets, animations, autotile groups, prefabs (replaces catalog.ts)
  assets/           pictures
  scripts/          optional generators (procedural maps, the wilderness): parameters are data, run by seed
```

The compiler does what `buildFord()` does now: it checks references, ties and host-only writes, derives
portals, anchor positions, household regions, the overworld and protected facts, and writes the bundle the
runtime loads by URL. Maps follow world-model.md D20: a map is a generator (seed, parameters) and the
author's changes on top.

## 6. The editor (P4–P6)

| RPG Maker | OpenWorld Editor |
|---|---|
| map and tiles | terrain, heights, autotiles; fixtures, items, people, portals, regions |
| the database | the type tree, items (forms × materials), statuses, elements, recipes, skills, bosses |
| event pages | a type's rules: host × event kind → condition tree |
| event commands | a scene's `SceneCmd` list, the nearest thing |
| an NPC's event | a person: 24-hour schedule, keyed lines, household, look, shop |
| playtest | from any map and cell, with the Mod Console |

What RPG Maker has no counterpart for: **the holes.** For every type the author sees which acts on it are
still undefined (what `coverage.ts` counts), fills one by hand or asks the modder (offline profile) for a
patch, replays it in the sandbox and takes it into the library — design.md §10's "written large offline and
patched free online by one mechanism".

The builder's tools (curved paths, organic shapes, fences and yards, small things by masks) become the
editor's brushes; each stroke keeps its seed and leaves data. The renderer (`WorldScene`) is the editor's
canvas: the catalogue injected, a free camera, no player to follow.

## 7. Phases

Each phase keeps the present rules: typecheck and the full suite green, `check:world`, the coverage baseline
held, the game playable throughout.

| Phase | What | Done when |
|---|---|---|
| **P1 Boundaries** (no change in behaviour) | rename to `@openworld/*`; the client becomes the runtime; the game (content, tools with the demo and art, the wiki's generator, the catalogue, the public assets, its tests) moves to `games/openworld`; the runtime and the modder get the game through one seam instead of importing content; the tools → client import goes; a test holds the direction | nothing in `packages/*/src` imports `games/`; the game plays as before |
| **P2 Kernel and modules** | the module interface; systems out of the kernel, easiest first (waypoints, boons, needs, codex, looks, bosses, companions, progression, then classes, combat and actives, then society and conduct); hard-coded ids and numbers become data or world parameters; the Ford's save upgrades move to the game; the engine's own tests on `games/starter` | the kernel with no module runs the starter; the Ford with every module plays unchanged |
| **P3 Format and compiler** | a JSON Schema generated from `types.ts`; ontology, catalogue, people, story and quests as data files; the Ford's maps baked once into editable data with fixed ids; the runtime loads a bundle by URL with no game in its build; the modder and the wiki read the bundle | another bundle URL is another game |
| **P4 Editor MVP** | a local Node service over the project's files; `WorldScene` as the canvas; maps (terrain, autotiles, heights, entities, portals, regions); people (schedule, lines, look through `creator.ts`); playtest from any cell; a validation panel | a new map and a person with a schedule, made and played without writing TypeScript |
| **P5 Database and logic** | type tree, items, statuses, recipes; the rule editor (tree view, "which rule answers here", ties reported as you type, a sandbox replay); story steps and scene commands; quests' stages, objectives and aliases | a game like the starter made without writing TypeScript |
| **P6 The AI as co-author** | the holes panel (coverage per project); a patch asked for one hole, reviewed and taken; the builder's brushes; people generated in bulk | holes seen and filled in the editor |
| **P7** (later) | the engine side gets a repository of its own and versions; the game depends on them | — |

P2 and P3 overlap where they do not touch (the catalogue as data needs no modules).

## 8. P1 as built (2026-10-10)

- **Names and places.** `@openworld/*` is the engine side (`engine`, `runtime` — the client that was —,
  `modder`, `agent`), `@openworld-game/*` the game (`content`, `tools`, `wiki`, `client`), under
  `games/openworld/`; the public assets (the pack's subset, the project's art, the generated world) are
  `games/openworld/public/`. Root scripts keep their names (`npm run dev`, `build`, `gen:world`, `wiki`…).
- **The seam.** The engine defines `GameDef` (`gamedef.ts`: id, ontology, base rules, terrain characters)
  and owns the map file format (`chunk.ts`). The runtime defines `ClientGame` (`runtime/src/game.ts`:
  the catalogue; item, crafting, skill, boon and look tables; hooks for the wilderness, the upgrades of
  older saves, a new game's marks, the dev console's summon and shortcuts) and reads it only through
  `game()`, never at a module's top level. The runtime is a library; the game owns its app
  (`games/openworld/client`: the pages, the vite config, `register.ts` that hands the game over, the worker
  entry, the catalogue, the boss and looks pages). The modder is handed the game (`openModder({ game })`,
  `--game <module>`); a world repository carries its ontology, so its validator imports none.
- **The direction, held.** `packages/engine/test/boundaries.test.ts`: no package imports a game, each
  imports only what its rule allows, and the eight modder tests still on the game's content are listed
  (the list only shrinks; P2's starter game replaces them). The engine's own tests start there.
- **Checked.** Typecheck, the full suite, `gen:world`, `check:world`, `wiki:check` and the build; in a
  browser, the built game boots, a new game starts, the boss gallery, the challenge and the looks page open.
- **Left for P2**, named where they are: the runtime still carries this game's UI (the skill tree,
  professions, boons, the boss preview and animation clips, the cover's companion and challenge link) and the
  engine its systems (§2). The game's tests that use the runtime import `client/src/register.ts` first, as
  its pages do.
- **To check outside the repository:** the live wiki's server, if it serves `packages/wiki/out` (now
  `games/openworld/wiki/out`, or pass `--out`), and any deployment that took `packages/client/dist` (now
  `games/openworld/client/dist`). The wiki's pages stay in the root `wiki/`.

## 9. P2 as built (2026-10-10)

- **The module interface** (`engine/src/module.ts`). A module is `{ id, needs, effects, conds, goals, spec,
  install, upgrade }` and registers itself when its package loads; an ontology names the modules it uses
  (`Ontology.modules`, from game.json) and every engine made over it installs them in that order (one it names
  that is not loaded is refused). A module's primitives and conditions run through `world.condImpls` and the
  effect runner's default case; its goals join the kernel's (`KERNEL_GOALS`: threat, follow, schedule, home,
  idle; one goal several modules give is tried in their order). The kernel has two **slots** — `eng.combat`
  (`Combat`: refusals, reach, pace, a blow's power and what it carries, the struck one's harm; the kernel's own
  is `plainCombat`, `blows.ts`) and `eng.society` (`Society`: whose things are, who notices, fear, the watch;
  `noSociety` by default) — and **hooks** (`eng.hooks`: a tick's `status`, `behaviour` and `end` steps, entering
  a map, the residents a world needs, learning, the frame's fields, why a sleeper woke), plus `world.wears`
  and `world.ext` for a module's own state. The ModSpec and `validatePatch` are made from the enabled modules:
  the AI is told only of what the game has (`buildModSpec(onto)`, `opsOf(onto)`).
- **Differences from §4.** The modules are one package, `@openworld/modules`, a folder each (they share
  helpers; a package each when one is wanted alone). `phases` became the hooks; `snapshot` the `frame` hook;
  `migrations` each module's `upgrade`. The effect and condition *types* (`types.ts`) still name the modules'
  primitives (`ModuleOp`), so every rule stays type-checked; only their work moved out.
- **The modules**: `classes` (professions and their weapons, the combat talents, relics, the active skills
  and the skill bar; it fills the combat slot), `bosses` (the encounter goal, `release`), `waypoints`,
  `boons` (needs waypoints), `needs` (hunger: `feed`, the woken-by-hunger word), `society` (the social life and
  conduct of docs/npc-sandbox.md: 23 primitives, 9 conditions, the goals social, follow and need, the watches as
  residents; it fills the society slot). OpenWorld names all six (`content/src/ontology.ts` `MODULES`).
  **Kept in the kernel**, by decision: looks, experience and levels, the codex, a companion's following, the
  quests and the story — mechanisms every game has, with each game's data; the editor and the AI interface
  stand on them. The runtime may import modules (the worker casts, sets the skill bar, takes a profession,
  chooses a boon through them).
- **Ids and numbers out of the kernel**: the coin (`ontology.social.coin`), the waypoint stone's type
  (`params.waypoint`), the fact that lengthens the night (`params.nightFact`, the Ford's `night.shift`), the
  professions' names (`ontology.professions`). `game.difficulty` stays the engine's own fact (a new game's
  choice, under `game.`). The Ford's save upgrades are the game's (`GameDef.upgradeSave`,
  `content/src/game.ts`); each module brings its own.
- **The standard library** (`packages/stdlib`, data): what the kernel names and every game starts from — the
  resident, region and site types, the roots of the actor, item and fixture trees, the statuses the kernel and
  the inputs keep, the elements, the `broken` line, and 44 rules (the roots, a fall, a defeat and coming to,
  experience, rising, wearing, the Story Manager and a quest's own rules). Baked once from the Ford's library;
  the Ford keeps its own versions for now (they carry its hunger and professions).
- **The starter** (`games/starter`, S6): a whole game in data files — a glade and a cottage, Mira and her day,
  an axe in a chest, a tree to fell, a slime, a favour, an opening scene — on the kernel and the standard
  library, no module. `games/starter/test/kernel.test.ts` plays it with no module loaded in its process: the
  opening, the chest, the axe and the tree, Mira's day, the favour and its reward, plain combat, sleeping,
  a save. It found one kernel bug: a quest that begins when its giver is spoken to never began (its probe
  had no aliases; `quests.ts` `probe`).
- **Ahead of P3**: the starter is written in the project format (§5) and compiled by `@openworld/format`
  (`packages/format`); the compiler's checks (references, sizes, portals, anchors, ties, rules that write past
  their host) are the Ford's content tests made general (the tie sweep is now `format/src/check.ts` `ties`).
- **Left**: the eight modder tests on the Ford's content (they test the pipeline on the Ford's holes; the
  starter has few) stay listed in `boundaries.test.ts`.

## 10. P3 as built (2026-10-10)

- **The format** (`packages/format`, §5 as built): `project.ts` the files (game.json — with the world's
  `order` of maps, people and quests, the `origin` the world map is laid out from, `plugins` —, ontology/,
  rules/, maps/, people/ with schedules by anchor, quests/, story/, catalog.json, client/, extra.json for what a
  module's data adds to the index), `compile.ts` (the ontology over the standard library's: records by key,
  lists of names joined, keyed lists a later file's entry replacing an earlier file's; rules by id; anchors
  resolved; maps laid out by their edge links; the topics the story raises itself protected), `check.ts` (the
  problems: references, sizes, portals, anchors, holders, aliases, ties, the patch validator's checks on base
  rules, a root that inherits, a kind no root answers, a module not loaded), `json.ts` (how files are written:
  a value on one line when it fits), `node.ts` and `cli.ts` (`npm run game -- check|build <project>`),
  `serve.ts` (a project served compiled as it is asked for, its errors refusing the bundle).
- **JSON Schemas** generated from the engine's types (`npm run schema` → `packages/format/schema/`, seven: game,
  ontology, rules, map, person, quest, story); a test holds them to the types and the starter's files to
  them. They caught one gap at once: the `news` effect's type left out `talk`, which the engine took.
- **The runtime loads a bundle by URL** (`runtime/src/bundle.ts`): `bundle.json` → a `ClientGame`, its assets
  and world beside it; what only code can do comes from the game's plugins (`plugins` in the bundle, loaded in
  the page and the worker). The **player** (`packages/runtime/play`, `npm run play`, `npm run build:player`)
  has no game in its build and plays `?game=<url>` (default: the starter). The runtime keeps each game's
  saves and learned library apart (`ClientGame.saves`; OpenWorld keeps its old names), takes its pictures
  and world from the game's own folders, shows the title, tutorial and other pages a game's cover names, and
  shows a module's panels only where the game uses it (the skill bar, K and U, the purse); a game without a
  look table draws its people from the catalogue's sheets. Checked in a browser: the starter (from the dev
  server and from the static build) and OpenWorld (from its bundle and plugin) both play in the player.
- **OpenWorld as a bundle**: `client/src/bundle.ts` (`gen:world` writes `public/bundle.json`), its plugin
  `client/src/plugin.ts` (the wilderness, the save upgrades, its look generator, its dev summons). Its own app
  stays as it was (it hands the game over in code: its pages, its quick reloads while it is written).
- **The Ford baked** (`client/scripts/bake.ts`, `npm run bake`): OpenWorld written as a project in the format,
  the ids its builders gave kept, into `games/openworld/project/` — not committed: the builders stay the
  source until the team chooses to edit these files instead (risk 1 below). The compiler makes the very
  world of it gen:world makes, through its files too (`client/test/bake.test.ts`), with no error; its six
  warnings are the Ford's own (four people of a role no type defines, a chicken's missing parent type).
- **The modder and the wiki read the bundle**: the modder takes `--game` as a bundle, a project's folder or a
  module (`open.ts` `loadGame`); the wiki takes the ontology and the catalogue from the bundle the player
  loads (`wiki/src/bundle.ts`), its world from the builders.
- **The starter** became self-contained: its catalogue (`catalog.json`) and its pictures and sounds
  (`assets/`, a 5 MB subset of the CC0 pack) are its own.

## 11. P4 as built (2026-10-10): the editor's first part

- **The service** (`packages/editor/src/server/api.ts`): a local Node service over the projects' files —
  the games under `games/` (a project at `games/<id>/` or, baked, at `games/<id>/project/`), a project read,
  a file written as the format writes it (only the format's files: never a test, never outside the
  project), a file removed, a new project made from the starter, the compiler's problems. It runs inside the
  editor's dev server (`npm run editor`, :5175), which also serves the games compiled (`format/src/serve.ts`)
  and the engine's player for the playtest. Changes go through git as any other.
- **The editor** (`packages/editor/src/app`): the project in memory (`store.ts`: every file by path, edits
  unsaved until Save, a brush stroke undone at once, the compiler run on the project as it is now — it is
  pure, so the canvas and the validation panel never wait on a save); the canvas (`canvas.ts`) is the
  runtime's own WorldScene over an engine made from the compiled project — autotiles, heights, rooms, every
  thing and person where a new game finds them — with a free camera (`setFreeCamera`, `panBy`, `zoomBy`,
  `cellAt`, `drawOverlay`, added to the scene for it); the **map** (`mapMode.ts`: terrain and heights
  painted, things set down and taken away, portals, anchors, areas, the start; a cell's things in the
  inspector, an entity's type, name, place, tags, props and behaviour; a map's settings, size, new and
  deleted maps); the **people** (`peopleMode.ts`: who, where they stand, their day over the maps' anchors
  with its gaps and overlaps said, their keyed lines, their look through the runtime's character creator
  where the game has a look table); the **validation panel** (`problems.ts`, each problem a link to where it
  is); **playtest** from the start or any cell (the player's `?playtest=1&at=<map>,<x>,<y>`: a new game at
  once, nothing saved).
- **Checked in a browser**: a new project from the starter; a new map, an anchor on it, a person whose day
  is there — made, saved, compiled with no problem and played, with no TypeScript written (P4's "done
  when"); painting, setting down, saving to the file; the baked Ford opened and drawn.

## 12. Risks

- **The way the Ford is written changes.** From the TypeScript DSL to data files: for a while the compiler
  takes both authored data and data a script made; the maps are baked once the editor can edit them.
- **Saves.** A map's entities join a save once and are never merged again (`engine.ts` `enterMap`), so a
  changed format means new games or a migration.
- **The proof of minimality** (`demo.test.ts`: every element witnesses a requirement) is this game's method
  and goes with it; the editor may offer it as an optional requirements panel.
- **The product must not eat the paper.** P1–P3 serve the paper as they are (generality, a second game,
  content at scale offline); how far P4 and after go is decided on its own.
