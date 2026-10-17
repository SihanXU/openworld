# OpenWorld: the engine, the game, the editor

Status: **agreed with the user 2026-10-10.** The user asked to take OpenWorld out as a game engine of its
own, keep the present game as one story on it, and build an OpenWorld Editor in the manner of RPG Maker
("OpenWorld拿出来专门当游戏引擎，现在的游戏是其中的一个story作为demo，然后同步还要做一个OpenWorld Editor，
像RPG Maker那样可以自己做游戏"), and accepted every recommendation below; then to build P2–P6 in the same pull request ("p2到p6", P7
left); then, asked whether the editor was a tool for this one game or a game-making program like RPG Maker, to
make it a program of its own now ("现在就往独立软件方向做啊": S2 changed, §15); then, the editor checked against
RPG Maker, its next phase (§16: E1–E7). §8 onwards records what was built.

## 1. Decisions

| # | Decision |
|---|---|
| S1 | **One repository first.** The engine, its modules, the runtime, the editor and the modder live in `packages/`; each game lives in `games/<id>/`. `games/*` may import `packages/*`, never the reverse, and a test holds it. The engine goes to a repository of its own only when its API has settled (P7). |
| S2 | ~~The editor is the team's tool first~~ → **the editor is a game-making program of its own** (changed 2026-10-10, §15): a local server and its page, run from the command line or as a desktop application, over projects in any folder; it ships the pack's pictures and sounds and the templates, and exports a game anyone can play. Inside the repository it is still the team's tool over `games/`, its changes going through pull requests as before. |
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
| **P8 The editor as a program** (S2 changed) | projects in any folder, a recent list, templates; the editor's own server and a build of it; pictures and sounds imported, the pack shipped, the catalogue edited by cutting sprites; export as a playable folder and zip; a desktop shell; the runtime free of one game's words; the game's settings and the rest of its data in forms | a game made, given pictures and exported in the desktop application, with no repository and no TypeScript |
| **E1–E7 The editor as RPG Maker is used** (§16) | the map's feel, OpenWorld's events, the editor's words in two languages, the database in forms, playtest and debug, publishing, the program, the AI in the program | each step's own (§16) |

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
  and the skill bar; it fills the combat slot), `kits` (every monster's skills, the minor monsters' kit goal and a boss fight's encounter goal, `unleash`;
  it took the former `bosses` module in, whose id it still answers to: `EngineModule.formerly`, docs/skills.md), `waypoints`,
  `boons` (needs waypoints), `needs` (hunger: `feed`, the woken-by-hunger word), `society` (the social life and
  conduct of docs/npc-sandbox.md: 24 primitives — `moveIn` the latest, 2026-10-12 —, 9 conditions, the goals
  social, follow and need, the watches as residents; it fills the society slot), `loot` (2026-10-12: a creature
  kind's own piece of gear, its `trophy` prop, found on felling one by its `trophyChance` or surely after
  `Ontology.loot.pity` fellings, the count the feller's `trophy.<type>`; one primitive, `trophy`; the words the
  finder is told are the game's, `loot.found`. Only a piece some kind of the game's own ontology names as its
  trophy is ever made, so no rule, a patch's included, can put another type into a bag by defeat news; its
  chance is a `World.chance` site, so the sandbox explores both outcomes). OpenWorld names all seven
  (`content/src/ontology.ts` `MODULES`).
  **Kept in the kernel**, by decision: looks, experience and levels, the codex, a companion's following, the
  quests and the story — mechanisms every game has, with each game's data; the editor and the AI interface
  stand on them. So are **gear sets** (`Ontology.sets`: a piece's `set` prop, bonuses by the count of slots worn)
  and **rolled affixes** (`Ontology.affixes`, `engine/affixes.ts`: a piece's `sub:<key>` extras, rolled as gear is
  made; of weapons only the one fought with counts, `weaponOf`), decided 2026-10-12: mechanisms configured
  entirely by data, which World.stat reads as it reads any worn number; a game without the tables has neither.
  A recipe's `make` that names or tags what it makes is made as it says; `madeOf` asks for the material and
  quality as well (a set's piece). A skill book asks no points but holds to the tree's `requires`. The runtime
  may import modules (the worker casts, sets the skill bar, takes a profession, chooses a boon through them).
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

## 12. P5 as built (2026-10-10): the database and the logic

- **The database** (`databaseMode.ts`): the type tree (every kind by its path, the library's marked), a
  type's fields (name, tags, props, sprite, solid, makeup, station, tools, yields, stage) and its whole JSON,
  how the world sees it (its inherited tags and props), the rules on it; the statuses; the terrains with the
  character a map writes each by; the recipes the types' makeup gives (`deriveRecipes`). An entry is written
  where the project writes it — a list's item or a record's key, `ontologyFiles.ts` — and an entry of the
  standard library is overridden by the project's own.
- **The rules** (`rulesMode.ts`): every rule by file, the library's among them (overridden by copying);
  a rule's tree in words (IF / DO / ELSE, its labels, its holes and their defaults) beside its JSON, checked
  as it is typed — the patch validator's checks that hold for base rules, and the ties with every other rule
  (`format`'s `ruleProblems`); **which rule answers here** (who does what to what, with what in hand: a
  sandbox of that act, the deciding rule, its leaf, the hole if it is one); the **sandbox** replaying any
  scenario (the chain of rules, what was said and shown, what changed); the game's ModSpec as the reference.
- **The story** (`storyMode.ts`): its steps (a scene or a beat; its trigger, the facts it sets, what the
  companion says), a scene's commands one a line with their kinds and order; the story's invariants,
  protected facts and fixed weather. **The quests**: kind, title, summary, the giver's lines, how it begins,
  aliases, objectives, stages; a new favour from a person.
- **Checked in a browser** (P5's "done when"): in a new project, a type (an apple), a rule for it written
  as JSON (checked clean as typed, and "which rule answers" names it for the apple used on oneself), the apple
  set down on the map, a scene, a quest from Mira — saved, compiled with no error (one warning, rightly: the
  apple's kind `item/food` was not made).

## 13. P6 as built (2026-10-10): the AI as co-author

- **The holes of a project** (`format/src/holes.ts`): every bare hand, every thing in hand and every thing
  used on oneself, on every kind one may face (the ontology's leaf kinds and the ground's cells), resolved as
  the engine previews an act (its outcome and the impulses it sends); where it is undefined, the base rule
  and the branch that hold the hole, the event that reaches it. The starter: 117 holes in 125 acts (40 ms);
  the baked Ford: 89,837 in 103,600 (7 s) — most of a world's acts are the AI's in play, as designed.
- **Learned patches ship with the game**: a project's `learned/*.json` (a patch's rules with their places,
  and the types and statuses it brought) are compiled into the bundle (`Bundle.learned`, `GameDef.learned`);
  every new game and every save begins its library from them (the worker's `libraryFrom`); the compiler
  reports one whose place is gone; the holes are counted with them answering.
- **The holes panel** (`editor/src/app/holesMode.ts`): count the holes (a few kinds at a time), see a kind's,
  and answer one — **by hand** (a rule of the project's for the hole's host and kind, opened in the rule
  editor) or **by the AI**: the editor builds the request the game would make there (`buildRequest` on a
  sandbox of the act) and asks the game's modder (`npm run modder -- serve 8787 --game games/<id>`; it now says
  its game at `/health`, and a request may name its profile: offline by default from the editor, live as in
  play). The patch is read as its tree, **replayed in the sandbox** with it in the library (the chain, what was
  said, what changed), and **taken into the game** (a `learned/` file) or left.
- **The builder's brushes** (`format/src/brushes.ts`, from the Ford's map DSL): a curved path through points
  (Catmull-Rom, frayed edges), an organic patch, small things scattered by a mask of ground, a fenced yard
  with a gate — each from a seed of its own, recorded in the map file (`strokes`); in the map mode as the
  Path, Patch, Scatter and Yard tools.
- **People in bulk** (`format/src/crowd.ts`): a crowd from a seed — names in both languages, a day over a
  map's anchors, a line or two — each an ordinary person file; in the people mode as "Many people".
- **Checked in a browser** (P6's "done when": holes seen and filled in the editor): in a new project the holes
  counted, the bare hand on the slime asked of a modder (a scripted model), its patch reviewed, replayed and
  taken in — counted again, the hole is gone; another answered by hand; a path, a pond, scattered stones and
  five people made with the brushes and the crowd; the project compiled with no problem.
- **Left**: the offline profile is the modder's agent working on the world as a repository with its tools;
  a scripted model answers only the live profile's single call, so the offline path was checked to the
  modder's reply (a failure said plainly), not to a patch. The modder does not yet read a project's learned
  files into its own library (it may answer a hole the game already ships an answer for; the editor's
  count, which does read them, shows no such hole).

## 14. Risks

- **The way the Ford is written changes.** From the TypeScript DSL to data files: for a while the compiler
  takes both authored data and data a script made; the maps are baked once the editor can edit them.
- **Saves.** A map's entities join a save once and are never merged again (`engine.ts` `enterMap`), so a
  changed format means new games or a migration.
- **The proof of minimality** (`demo.test.ts`: every element witnesses a requirement) is this game's method
  and goes with it; the editor may offer it as an optional requirements panel.
- **The product must not eat the paper.** P1–P3 serve the paper as they are (generality, a second game,
  content at scale offline); how far P4 and after go is decided on its own.

## 15. P8 as built (2026-10-10): the editor as a program of its own

The user asked whether the editor edits only this game or makes games as RPG Maker does; it was general (any
project in the format) but tied to the repository's `games/`, with no pictures of its own, no export and no
program to install. Asked to go that way now, S2 changed and this was built.

- **Projects anywhere** (`editor/src/server/workspace.ts`): a project is any folder with a game.json. The editor
  keeps the ones it opened (its recent list, in its own folder: `~/.openworld-editor`, or the desktop's user
  data) and lists its shelves' beside them (the repository's `games/` in development); each has a key made from
  its folder's name, which the editor's URLs and the player's `/games/<key>/` use. A new project is a
  template's copy in a folder the author chooses (default `~/OpenWorld Projects`): **the starter**, or
  **empty** — the starter's kinds of things, rules, pictures and sounds, and one blank map. Forgetting a project
  takes it off the list and touches no file. The first page (`app/home.ts`): the recent projects, the
  repository's games, New project (template, name, id, folder), Open project (a folder chosen in the system's
  dialog on the desktop, else in the editor's own over the service's listing of the disk).
- **The service** (`server/api.ts`) answers only its own machine: a request must name this host (a page of
  another site reached through a name of its own — DNS rebinding — is refused) and every change carries the
  editor's header (`x-openworld-editor`, which another origin cannot send without leave).
- **The editor's own server** (`server/server.ts`, `server/cli.ts`): one Node server for the built page
  (/editor/), the built player (/runtime/play/, the playtest), the service, the pack (/pack/) and the projects
  compiled as the player fetches them. `npm run editor:build` (`scripts/build.ts`) lays a built editor out in
  `packages/editor/dist/` — `editor/`, `player/`, `server/cli.js` (the server bundled for Node, nothing to
  install), `templates/starter/`, `pack/` — and `npm run editor:start` runs it (`node dist/server/cli.js
  --open [--port] [--home] [--projects] [--shelf]`). `npm run editor` stays the same service in Vite's
  development server.
- **Pictures and sounds** (`server/assets.ts`, `app/assetsMode.ts`, `app/sheet.ts`): a project's files are its
  assets/ — the pack's under `na/` (a catalogue writes them bare), the author's under `own/` (imported from the
  disk; the runtime takes `own/` as the game's own art beside `lsw/`), OpenWorld's under `lsw/`. The editor
  ships **the pack**, the Ninja Adventure pack's subset (CC0) OpenWorld uses, as RPG Maker ships its runtime
  package; a pack file an entry uses is copied into the project, so a project is whole on its own. The
  **Assets** mode edits the catalogue (`runtime/src/assets/types.ts`) by kind — items, fixtures (as they are,
  open, lit, turned across, looks of their own), creatures and characters (a sheet: its columns the
  directions, its rows the frames, a portrait), roles, the ground (autotiles, tiles, objects, decals), rooms,
  buildings, effects, music, sounds, the interface — each entry cut from a picture drawn large on a grid (a
  rectangle dragged out, snapped), its fields and how it looks beside it, its JSON; the files of the project
  and of the pack, filtered, imported, removed (only the author's own); and **what needs a picture**: the
  sprite keys the types name and the terrains a map writes that no entry answers. A changed catalogue starts the
  map's renderer again (it loads the pictures as it starts). The Database's type links to its picture.
- **Export** (`server/export.ts`, `server/zip.ts`, `app/exportDialog.ts`): the project compiled (refused while
  it has errors), the built player without the games built beside it, the game under `game/` (bundle, world,
  assets, the plugins it ships as scripts), the page naming it (`<meta name="openworld-game">`, which the
  player reads when no `?game=` is given) and titled by it, a README, a mark that lets a later export replace
  the folder (any other non-empty folder is refused), and a zip of the whole (for itch.io's HTML games; written
  with no dependency). The editor serves the last export at `/exported/<key>/` to be tried at once.
- **The desktop application** (`packages/editor/desktop/`, Electron, outside the root workspaces so that
  `npm install` does not fetch it): the editor's server started inside it on a free port of this machine, its
  page in a window; through `preload.cjs` the page gets the system's folder dialog and a folder shown in the file
  manager, nothing else; the playtest and a tried export open in windows of their own, other links in the
  system's browser; unsaved changes are asked about before a window closes. `npm run desktop` runs it from the
  repository (its games listed too); `npm run desktop:dist` makes the installers (electron-builder: an NSIS
  installer and a zip on Windows, a dmg on macOS, an AppImage on Linux; unsigned), and the `desktop` workflow
  builds the three as artifacts (when the shell changes, when asked, on a tag `editor-v*`).
- **The runtime says no one game's words**: the interface's words are a table a game may write its own way
  (`ClientGame.texts`, a bundle's `client.texts`; the runtime's `STRINGS` are the defaults), and OpenWorld's
  trainer and fairy (the skill tree's "no profession yet", the boons' panel) moved there; the cover's companion
  is the sheet the game names, its credits line the game's or none; the keys of a module's panels (the skill
  bar, the dash, the skill tree) show in the controls only where the game uses the module; a save written out is
  named by its game; the skill tree opens on the game's first direction; the old intro card, unused since the
  cover, is gone.
- **A game's own panels** (2026-10-12, after a review of four commits that had put OpenWorld's panels back in the
  runtime): `ClientGame.panels` maps the key a rule's `panel` effect opens to a factory (`runtime/src/ui/panels.ts`:
  `PanelFactory`, `GamePanel`, `PanelContext` — the overlay to draw in, the menu's acts, close, paint icons, the
  quest log); a panel is told which key opened it and whose rule did (the fx's `by`), one factory under two keys
  is one panel, and a factory may load its panel when first opened (a promise), so the game's worker and its
  tools never load a panel's code. It works the same handed over in code (`register.ts`) and from a bundle (the
  plugin returns the game's `panels`, code beside the bundle's data). The runtime's own panels stay its own
  (the bag, crafting, the journal, a shop, a trainer's professions, the commission board); for a module it keeps
  a panel a game may replace (the boons module's `boons`, the generic list, shown only once the companion has a
  power). OpenWorld's two moved to `games/openworld/client/src/ui/` with their styles: the companion's (Lumi, the
  road and the seals' powers; `companion` and `boons`) and the Held Ground's widenings (`haven`, its materials
  handed and its asks said to whoever opened it, its one stock shown as the one pile every card draws on,
  `stock.ts`). What else the runtime held of OpenWorld became data: the coin's name is its type's (no coin type,
  no purse); a mark over a head is the catalogue's `<tag>Mark` for any tag; a weapon's swing is its catalogue
  entry's `swing` (`sweep`, `shoot`, `point`); the empty body slots' pictures are the catalogue's `ui.equipSlots`
  (else a glyph); a rolled extra's name is its `AffixDef`'s (`name`, `percent`); a trophy's word and a tier's
  lore are the game's texts (`tipTrophy`, `tier:<quality>`); shops are the game's (`crafting.shops`, carried in
  a bundle's `client.crafting`; each shelf a `Text` name and a `sell` flag; none, no shop panel). The character
  sheet's words are `STRINGS`, its profession shown only with the classes module, its food only for one who
  hungers, and its numbers the engine's (`Frame.player.stats`: World.stat's atk, def and critical chance — the
  classes module adds the weapon's own edge — and the power of the weapon fought with), no longer a sum of the
  worn things' props. `runtime/test/words.test.ts` holds it: the runtime's code names none of OpenWorld's people,
  places, coin or tiers, but for the files still listed (the boss art, preview and animations), a list that only
  shrinks.
- **The game's settings and the rest of its data in forms** (`app/gameMode.ts`, the **Game** mode): the game
  (name, version, seed, the standard library taken or not, where and at what hour a new game begins, where the
  world map is laid out from, the player's name and tags), **the engine's modules** (every registered one —
  `registeredModules()` —, what it needs, what it is), the world's parameters (each with what it does, the
  ontology's value beside the game's own), the cover, the interface words (filtered, each beside the engine's),
  the factions (names, whom each attacks on sight), and every other part of the ontology (periods, what appears
  by itself, thresholds, laws, deeds, talk, the social numbers, materials, qualities, efficiency, resistances,
  professions, room roles, goals, elements, effects, tags, the look table) and of the player's tables (item
  forms, crafting, skills, boons, looks, the console's shortcuts), each as the project writes it beside the
  standard library's and what the game gets.
- **Checked**: the service, the workspace, the assets, export and its zip read back byte for byte, the server
  (`editor/test/api.test.ts`, `server.test.ts`); in a browser, the built editor run alone: a new project from the
  empty template, edited, exported, the export played; the Assets mode: a type's missing picture listed, a
  picture taken from the pack, a cut making the entry, an import, the map drawn again with it; the Game mode: a
  module, a parameter, the cover's title and an interface word written and seen in the playtest's cover. The
  desktop application under a virtual display: its first page with the system's dialog bridged, a project made,
  the playtest window; packaged for Linux (AppImage and unpacked, run from its own resources with no repository
  beside it: the pack, the templates, an export) and, from Linux, as a Windows zip.
- **Left**: the installers are unsigned; the modder is still started on its own (`npm run modder -- serve`) for
  the holes panel's AI, and does not yet read a project's learned files; the fonts come from Google Fonts (a
  machine offline draws the fallback); the cover's mountain art is OpenWorld's own, offered to any game.

## 16. The editor as RPG Maker is used: E1–E7 (agreed 2026-10-13)

The user asked for the editor to be checked against RPG Maker's features and the way its users work
("根据rpg maker的功能和操作/交互习惯，检查一下openworlds editor，看看之后的计划是什么，给我一个完整的方案"). The
audit found the skeleton whole — projects, maps, people, the database, rules, the story, quests, assets, export,
the desktop program, and what RPG Maker has no counterpart for (the validation panel, which rule answers here,
the sandbox, the holes and the AI, a playtest from any cell) — and two gaps: **the feel** (few drawing tools; the
right button, the double click and the shortcuts RPG Maker's users reach for do other things or nothing) and
**JSON where RPG Maker has a form** (a step's trigger, a scene's commands, quests, what appears on a map).

### Decisions

| # | Decision |
|---|---|
| E-a | **The editor's words in Chinese and English, switched in the editor** (not Chinese only). |
| E-b | **"Its own kind" stands for RPG Maker's single event**: on one thing, the author asks for a kind of its own; the editor makes a child type of its type, moves the thing to it, and its rules hang there. It feels like giving one event its behaviour; the model is unchanged (S5: rules on types, the holes asked per class). |
| E-c | **No mobile publishing.** A game is exported for the web and, later, as a desktop game. |
| E-d | **The installers stay unsigned** for now (no certificate). |

Not taken from RPG Maker, by the model: behaviour per instance (E-b instead), numbered entries (ids keep their
meaning), passability per tile (it follows terrain and type, `solid`, which suits a large world), and a
turn-based battle database (troops, battle events) unless a module brings one.

### The plan

| Step | What | Done when |
|---|---|---|
| **E1 The map's feel** | rectangle, ellipse and fill beside the pencil, a brush size; the right button picks what is under it (a drag: a block, as a stamp to paste), panning on the middle button or with space held, the wheel scrolls and Ctrl+wheel zooms; a selection copied, cut, pasted and cleared; things dragged to move and nudged with the arrows; redo; layers (ground, height, things, marks) with the others dimmed, a grid; a status bar (the cell, its ground, height and things, the zoom and its presets); a palette of pictures, grouped by kind; buildings (the catalogue's prefabs) and rooms (wall frames) as tools, an interior made from a building's door; the maps as a tree by group, duplicated, with thumbnails, and a world overview by the edge links and portals; a map's settings as forms (what appears, the law, fish) | someone who knows RPG Maker draws a small village with a house and its interior in ten minutes without touching JSON |
| **E2 OpenWorld's events** | a double click opens what is there (a person in the people mode, a thing's kind and rules, a portal's settings); quick events (a door, a chest and what is in it, a sign, a bed, a merchant, a quest giver); "its own kind" (E-b); a form for each scene command (a line with its speaker and portrait, previewed as the game's dialogue; a move or a transfer picked on the map; a fact or a quest's stage from a list); a step's trigger and a quest's stages, objectives and aliases as forms; the facts' list with where each is set and read (RPG Maker's event searcher), and the same for types, items and rules; play from this scene | a story — into the village, a word with someone, a thing given, the quest done — made with no JSON |
| **E6a The editor's words** (from E6, brought forward) | the Chinese/English switch (E-a) over every panel; the shortcuts (F9 the database, Ctrl+R playtest, Ctrl+F a search of the project, F1 help) and their table | the editor reads whole in either language |
| **E3 The database in forms** | a form made from the format's JSON Schemas (`packages/format/schema`) replacing every raw JSON field; the types in tabs by kind (items, weapons, armour, food, furniture, creatures, people), each with templates, an entry duplicated; the skill tree edited on the game's own layout; professions, boons, bosses, the look table and the modules' parameters as forms; a person's social life (trade, purse, watch, household) | no raw JSON box left, JSON kept only as "advanced" |
| **E4 Playtest and debug** | a debug panel in the playtest, the exported player too (facts, time and weather, a transfer, items given, a thing summoned, the learned rules); a playtest from a quest's stage or a scene; a fight or a boss tried alone; a playtest that takes the editor's changes without starting again | — |
| **E5 Publishing** | an export that leaves out the pictures and sounds no entry uses; a desktop game (the Electron shell, Windows, macOS, Linux); an icon, a version and the cover set as it is exported; optionally itch.io in one step. No mobile (E-c) | — |
| **E6 The program** (the rest) | the desktop's own menu bar; help inside and sample projects (a village, a dungeon); the fonts shipped (offline); autosave and recovery after a crash; updates. Signing waits for a certificate (E-d) | — |
| **E7 The AI in the program** | the modder started from the editor, its model and key in the settings; the holes as a heat map over the map and the database; people, quests and scenes drafted by the AI (offline profile), reviewed before they are taken; the modder reads a project's `learned/` | — |

The order is E1, E2, E6a, E3, E4, E5, E7: the first two decide whether it is used as RPG Maker is; the words are
cheap and felt at once. Each step keeps the present rules (typecheck, the suite, the editor's tests, a browser
run of its done-when) and is recorded below as built.

## 17. E1 as built (2026-10-13): the map's feel

- **Layers and tools** (`editor/src/app/mapMode.ts`): the map has four layers, **Ground** (terrain, buildings,
  rooms), **Height**, **Things** (the things and the people standing there) and **Marks** (portals, anchors, areas,
  the start), each with its own tools and the others dimmed on the canvas (the scene's `setEditorDim`). The ground
  and the height: a **pencil** with a brush of 1 to 5, a **rectangle**, an **ellipse**, a **fill** (the cells joined by
  their sides with the same ground), a **selection**; on the ground besides, **Building**, **Room** and the builder's
  Path and Patch. Things: **Select** (a thing or a person clicked, dragged to move, the arrows nudge, Delete removes),
  **Set down** (dragged: one a cell), **Rectangle** (one in every cell), **Erase** (with the brush), Scatter, Yard.
  Marks: a portal, an anchor or the start dragged to move; anchors and areas named in the panel (else the next free
  name), no prompt. Each tool has its key (P, R, E, F, S, B, O, X …), shown on its button.
- **As RPG Maker is used** (`canvas.ts`): the right button picks what is under it — the ground, the height, or a
  thing's kind — and a right-button drag picks a block, which then follows the pointer and is laid at each click
  until Esc; the middle button or space held pans; the wheel scrolls (Shift: across), Ctrl+wheel and a pinch zoom; a
  double click reaches the mode (for E2). A **selection** is copied, cut, pasted (Ctrl+C, X, V), its things taken away
  (Delete), filled, dragged or moved with the arrows; a block carries its ground, heights, things with what they hold
  (new ids when pasted, the same when moved), and the buildings and rooms wholly inside it; a move takes the portals,
  anchors and areas in it too; the cells left get the ground around them. **Redo** beside Undo (Ctrl+Y,
  Ctrl+Shift+Z; the store keeps what was undone until another edit), each button titled with what it would do; a
  field's own Ctrl+Z stays the field's.
- **The status bar**: the cell under the pointer, its ground and character, its height and what stands there; the
  grid (G); the zoom's presets (50 % to 600 %), in and out (+, −), the whole map (Fit, 0).
- **Palettes of pictures** (`thumbs.ts`): the ground as its tile (an autotile's middle, a plain tile, or the thing
  drawn on it), the kinds of things as the canvas draws them (a creature's sheet, a fixture's picture, an item's icon),
  grouped by the first steps of their kind (fixture/furniture, item/tool …) and filtered; the buildings as stamped.
- **Buildings and rooms** (`mapEdit.ts`, as the Ford's builder lays them): a building from the catalogue's prefabs —
  its picture one of the map's stamps, its solid cells the prefab's terrain, its door a door — previewed under the
  pointer with its door marked, removed with its cells given back; a room's walls round a floor in a catalogue
  frame's style, a click on its wall a doorway; **the room behind a door**: a selected door that leads nowhere offers
  to make it — a new interior map (its size, walls, floor and name), its door at the foot, a portal each way, then
  shown. The starter (and so both templates) gained eight houses and four wall styles from the pack's sheets it had.
- **The maps** (`mapTree.ts`): a tree by group (a map's `region`, set in its settings), each with a picture of its
  ground; a map duplicated (its things anew under its id); **the world overview**: the maps the edge links lay out
  where they lie, those reached only by portals in a row below, a line for every portal between two maps, a click
  opening one.
- **A map's settings as forms** (`mapForms.ts`): name, group, kind, light, zone, music (the catalogue's), the law kept
  there (the ontology's laws), fish in its water, and **what appears by itself**: each entry its kinds and weights,
  the grounds, at most so many, every so many ticks, the hours or the night, the weathers, a tag, and a creature's
  behaviour, temper, sight and leash.
- **Checked**: `editor/test/mapEdit.test.ts` (the shapes, the fill, blocks copied, pasted and moved with what their
  things hold, buildings and rooms as the builder lays them, the interior and its portals, a map duplicated, all
  compiled with no new problem on the starter) and the store's redo (`store.test.ts`); in a browser, on a new project
  from the starter, the done-when: the ground painted with each shape, picked with the right button, undone and
  redone; a house stamped and the room behind its door made, furnished, its bed dragged; the chest dragged, nudged,
  copied and pasted; a block picked and laid, a selection cut and pasted; an anchor and an area named; the map's
  group, fish and what appears set; a room with a doorway; heights; a playtest from a cell; a map duplicated; the
  overview — saved, compiled with no problem, no error in the page. The baked Ford opens (7 s) and its overview draws
  its 23 maps (3 s).
- **Left for later**: a person is moved here but made in the people mode; anchors and areas are renamed by removing
  and placing again; a cut leaves the ground around it, not "nothing" (every cell has a ground).

## 18. E2 as built (2026-10-13): OpenWorld's events

- **A double click opens what is there** (the map's Select tools): a person in the people mode, a thing at its kind
  in the database (its fields and the rules on it), a portal in its settings, a door that leads nowhere at the room
  behind it.
- **Quick events** (`app/quickEvents.ts`, `app/events.ts`; the Things layer's **Quick** tool, Q): a **door** to a cell of
  another map — the landing and the way back picked on the map, a portal each way —; a **chest** and what is in it; a
  **sign** with its words in both languages (`text`, `text_zh`, which the standard library's `core/read` says); a
  **bed**; a **person** with a line; a **merchant** (with the society module: tagged `merchant`, a stock and a purse of
  the game's coin, carried); a **quest giver**: a person and a favour of the starter's shape — bring so many of a
  kind, defeat so many, or a word with someone —, its words, its reward. Each is one Undo (the store's `batch`: a map,
  a person's file and a quest's file undone and made again together).
- **Its own kind** (E-b): on a thing, "A kind of its own" makes a child type of its type for it (`TypeDef.own` names
  the thing; the engine reads nothing from it), moves the thing to it and begins a first rule for it in the rules
  mode (a hand on it); for a person, whose hand is their talk, the rules mode is opened on their kind instead. After,
  the button opens its rules. A thing's contents are listed and changed in its form (one more, one fewer, a new kind).
- **A step's trigger and a quest's triggers as forms** (`app/triggers.ts`): a step's `when` is a list of conditions,
  each a row — the map, an area, a spot (picked on the map), the hours, the weather, facts and quests' stages compared
  (is, is not, over, at least …), objectives done, after a step, the morning after, carrying, holding, statuses, a
  skill, near a thing, a room, one's numbers, things on cells (JSON) —, one added from a list; a quest's trigger is a
  kind and its fields — spoken to, given to, carrying, felled, gone, entering a place, objectives, facts, another
  quest's stage or end, a step — and all, any and not of them, nested.
- **A scene's commands as forms** (`app/sceneForms.ts`): each kind named as RPG Maker names its commands (show a line,
  walk to, turn, a mood, wait, fade, transfer, place, give, a fact, a quest's stage, a topic, a status, tell, a card),
  its fields from the project's names (the speaker among the people, the quest's stages by their log, the facts
  known), a cell **picked on the map** (the editor's `pick`: the canvas shown with the maps to choose among, Esc to
  cancel); reordered, copied, removed. **A line is shown as the game shows it**: the runtime's dialogue box, the
  speaker's name and portrait (a look's bust, else the catalogue's faceset in the line's mood), in English or Chinese.
- **The quests as forms**: the quest (kind, repeat, deadline, title, summary, the giver's four lines); how it begins
  (by itself on a trigger, offered by an alias once a trigger holds, by an effect; radiant as JSON); its aliases (this
  one by id, a place, found or made as JSON; essential, a quest item, may stay empty); its objectives (words, whom they
  point at, someone to speak to, counting what is carried or felled or a fact, else done by a trigger); its stages (the
  trigger that reaches it, the journal's line, what is said and by whom, the objectives shown, done and failed, what is
  taken, the reward — experience, things, facts —, completing or failing it; its hint, the stages it follows, its
  effects and lessons as JSON).
- **Find** (`app/findMode.ts`, `app/usage.ts`; RPG Maker's event searcher): the story's facts, each with where it is set
  (a step's facts, a scene's `fact`, a reward, a rule telling the story `fact.<key>`) and read (a trigger, a quest's
  `fact`, a line's `fact:` key or `{fact:…}` slot, a counting objective); and any id — a type and the kinds under it,
  a person, a thing, a map, a quest, a step — with every place that names it, each opening where it is edited. The
  story mode lists the facts with their counts; a step, a quest, a thing and a person have "Where it is used".
- **Play from this scene**: a step's button saves and opens a playtest on its map (its spot, its area's middle, the
  start) with the step begun at once (`?scene=<step>`: the worker's `story.start` before any other step can take
  control).
- **Checked**: `editor/test/events.test.ts` — a door and its way back, a chest's contents, a sign, a merchant, a
  favour, its own kind, the facts set and read and an id's uses on the starter, a batch undone and made again as one,
  and a story made of quick events alone played on the kernel to its end (a villager's favour: spoken to, the stones
  carried, handed in, rewarded). In a browser, E2's done-when on a new project from the starter, with no JSON: Tess
  and her favour (two stones, an axe for it), a chest with two stones, a sign, a door to the cottage and its way back
  picked on the map; a double click on Tess opening her; a scene after the opening — Tess's line (previewed with her
  portrait), her walk to a cell picked on the map, a stone given, a fact set —; the quest's forms; Find naming the
  fact and Tess's four places; the sign given a kind of its own and its first rule; saved with no problem; played from
  the scene, Tess's line shown in the game's box. The saved project then played headless: the opening, Tess's scene
  and her stone, a word with her, a stone from the chest, back to her — done, the stones taken, the axe given.
- **Left for later**: a person's schedule and lines stay the people mode's (the quick events make a person who stands
  where they were put); radiant offers, a stage's effects and lessons, invariants and an alias found or made are JSON
  still (E3's forms from the schemas); "play from this scene" begins the step but sets none of the facts before it.

## 19. A game's languages, and the editor's (agreed and built 2026-10-13)

The first cut of E2 showed every game text as two fields, English beside Chinese, and a second tied the editor's
words to the game's; both were wrong, and the user asked how game editors do it. They keep three things apart:

- **Unreal**: a project's *native culture* (the one its text is written in) and its target cultures; the
  Localization Dashboard gathers the text, exports it to translators (PO), imports it and compiles it per culture;
  "Preview Game Language" plays the game in one of them; the editor's own language is an editor preference.
- **Unity** (Localization package): String Tables, an entry per key with a value per locale, a project's locales,
  a locale chosen for play mode; the editor's language in its Preferences.
- **Godot**: translations as CSV or gettext PO resources in the project's settings, a test locale for running it;
  the editor's language in the Editor Settings.
- **RPG Maker MZ**: none built in; the database is written in one language and plugins carry language packs (CSV,
  JSON) beside it.

**Decisions** (agreed 2026-10-13):

- **L-a** The editor's language is the editor's (`~/.openworld-editor/settings.json`, `/api/settings`; ⚙ on the first
  page and in the header), never a project's: English or Chinese for now (`app/lang.ts`: `t(english, slots)`, the
  Chinese in `app/zh.ts`; `phrase()` marks words a table keeps and `t` says later).
- **L-b** A game is written in one language, its source (game.json `languages: { source, translations }`, English by
  default; OpenWorld and the starter are English). Each text is one field, in that language, whatever the editor
  speaks; a new project is written in the language chosen (the template's words turned round, `switchSource`).
- **L-c** Its translations are tables of their own, `locales/<code>.json` (`LocaleFile`): `entries` a source text and
  how the language says it, wherever it is said; `at` a place that says it otherwise (`file#path`, with the source it
  was made for, so a changed source falls back); `review` the sources to look at again. Where a file holds words is
  read from the format's JSON Schemas (a field of the engine's `Text`), and a thing's written words (`props.text`,
  `text_<code>` beside it) and the client's cover and interface words; never guessed from the words. The compiler
  applies the tables (`applyLocales`): the engine and the runtime read `{ en, zh, … }` as before, `en` every
  reader's fallback.
- **L-d** A preview language, apart from both: what a line's preview and a playtest say (the header's "play in …";
  `?lang=` to the player, not remembered).

**As built**:

- **The format** (`format/src/texts.ts`): the positions (`textsOf`, `filesOf`), `applyLocales` in `compile`,
  `extractLocales` (an older project's translations kept inside its texts moved into tables: each source's most
  common translation an entry, the others by place), `switchSource`, `localeProblems` (a table for a language the
  game does not name; a place's translation whose place no longer says its source). `format/src/localize.ts`: a
  language's rows (a source text once, its places, its translation, its places' own, its state — to translate, to
  look at again, done —, its words kept inside the text), the entries no text says any more and the ones like a
  text's (`likeness`, `suggestions`), CSV and gettext PO out and back (`toCsv`/`fromCsv`, `toPo`/`fromPo`: references,
  `msgctxt` a place, `fuzzy` to look at again), `withImported`, `inlineLanguages`. Schemas: `game.schema.json`'s
  `languages`, `locale.schema.json`.
- **Migrated**: the starter (its files English, `locales/zh.json` 50 entries) and the bake (the Ford's 1,732 entries,
  19 by place; extracted and applied again, the same world).
- **The editor**: every panel's words through `t` (1,131 phrases, each in the Chinese table with its slots); each
  game text one field in the source language (`ui.ts` `textField`, `Form.words`); a text's words changed keep their
  translations, marked to look at again (`words.ts` `written`, one Undo with the edit); what the editor makes with
  words of its own — a favour's lines, a crowd's names, a rule's first line, a patch taken in — written in the
  source language, the translations it knows put in the tables (`adopt`, `adoptTexts`). The **Localization mode**
  (`app/localeMode.ts`): the languages (the source, changed by "change…"; a translation added or dropped with its
  table), a language's rows filtered by state and by words or place, the translation typed, a place's own, "it is
  right", the translation of words like it offered, the table exported (CSV, PO) and imported, the unused entries
  removed, an older project's inline translations moved into the tables (in any language, named or not). The store
  writes a whole file (`set`) and says a batch once.
- **The runtime**: `?lang=`; a game's interface words (`ClientGame.texts`) may be plain strings.
- **Checked**: `format/test/texts.test.ts` (the positions; the starter's tables applied, the same world as with its
  translations inside; places; written in Chinese and back), `format/test/localize.test.ts` (rows and states,
  suggestions, CSV and PO out and back), `editor/test/words.test.ts` (every phrase in the Chinese table with its slots
  and none left over; no two-language field; a changed text's translation kept to look at again; the editor's words
  adopted; a batch said once), `editor/test/api.test.ts` (a project written in Chinese from the starter: its English a
  table, the template's Chinese table gone, compiled clean). In a browser: the first page in English, then in Chinese
  by the setting; a project written in Chinese made from the starter; its map, person and lines one field each in
  Chinese; a line changed and found to look at again in the Localization mode, marked right, a translation typed,
  the table out as CSV and PO and a translator's sheet taken back; the scene's line previewed in English and the
  playtest opened with `lang=en`; the editor back in English over the same Chinese project; the village (an older
  project) offered its 61 inline Chinese texts, moved into a table and undone.
- **Left for later**: the player says English and Chinese only (a table for another language is kept, compiled and
  previewed in the editor; the player falls back to English); the client's other tables (item forms, shops, skills)
  keep their words inside them; machine-translated suggestions (the AI as co-author) are not offered yet.
