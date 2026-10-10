# OpenWorld: the engine, the game, the editor

Status: **agreed with the user 2026-10-10.** The user asked to take OpenWorld out as a game engine of its
own, keep the present game as one story on it, and build an OpenWorld Editor in the manner of RPG Maker
("OpenWorld拿出来专门当游戏引擎，现在的游戏是其中的一个story作为demo，然后同步还要做一个OpenWorld Editor，
像RPG Maker那样可以自己做游戏"), and accepted every recommendation below. P1 is being built; §8 records
what was built.

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

## 8. P1 as built

(filled in as the steps land)

## 9. Risks

- **The way the Ford is written changes.** From the TypeScript DSL to data files: for a while the compiler
  takes both authored data and data a script made; the maps are baked once the editor can edit them.
- **Saves.** A map's entities join a save once and are never merged again (`engine.ts` `enterMap`), so a
  changed format means new games or a migration.
- **The proof of minimality** (`demo.test.ts`: every element witnesses a requirement) is this game's method
  and goes with it; the editor may offer it as an optional requirements panel.
- **The product must not eat the paper.** P1–P3 serve the paper as they are (generality, a second game,
  content at scale offline); how far P4 and after go is decided on its own.
