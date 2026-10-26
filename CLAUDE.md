# CLAUDE.md — OpenWorld (paper: Large Symbolic World)

A web-playable 2D JRPG world whose state and rules are code; an LLM modder (later)
patches undefined interactions at runtime. Successor to BardOS (`C:\Users\chica\文字游戏`).
Story and world: [docs/lore.md](docs/lore.md) (the user's canonical setting: the Five Sufferings, the
First Night, the five Seal-bearers; every chapter follows it) and [docs/chapter-1.md](docs/chapter-1.md).
Design: [docs/design.md](docs/design.md); the key people's own portraits and event CGs (release 1's cast of six, each designed to a sheet; the CGs drawn as shots): [docs/character-art.md](docs/character-art.md), [docs/cast/](docs/cast/); the agreed world model and base gameplay (not yet built,
steps W1–W10): [docs/world-model.md](docs/world-model.md); the continent — six regions round the Holy City, the backdrop
that fills them, the phases of scaling A–E (A–D built 2026-10-18): [docs/continent.md](docs/continent.md). Release 1 is
Part One, the west bank — its ending at the Ford, the valley, the polished maps, the pictures fixed: [docs/release-1.md](docs/release-1.md). Paper draft lives in Notion ("Large Symbolic World").
OpenWorld is the engine and, for now, also the name of its first game: the engine side lives in `packages/`,
each game in `games/<id>/` (this one `games/openworld/`), and the OpenWorld Editor, a game-making program in the
manner of RPG Maker (a local server and page, or a desktop application, over projects in any folder) —
[docs/engine-split.md](docs/engine-split.md) (agreed 2026-10-10: decisions S1–S6, phases P1–P8; S2 changed: §15).

## Working agreements

- Converse with the user in Chinese; write code, comments and docs in English.
- Build order: a small, polished demo first, then scale. The target is hundreds of maps,
  thousands of NPCs, tens of thousands of items; the demo (the Ford and the maps growing around
  it) is the development scaffold, never an argument against growth. Every element it holds
  witnesses a requirement (docs/game-design.md §9). Basic game systems (bag, crafting, levels,
  hunger) are welcome; never copy one game's own content or loops (Stardew's shipping bin). Keep
  the architecture scale-ready; ask when the scope of a request is ambiguous.
- The subject is the WORLD (vs neural world models), not agents. NPCs are content.
- Second paper thread: RSI of the modder (memory, skills, harness it forms itself), see
  `docs/rsi.md`. It is a paper matter: the demo stays a clean game without it. Evaluation is
  an external benchmark run by the team.
- Commit/push only when asked. End commit messages with the Co-Authored-By line.

## Architecture (strict dependency direction)

```
client (Phaser 4 + DOM HUD)  →  engine (pure TS, in a Web Worker)  →  Mod port  →  modder service (HTTP)
```

- **The engine side imports no game** (docs/engine-split.md S1): `games/*` may import `packages/*`, never
  the reverse, and no game imports another; among the packages, engine ← modules ← runtime, engine ← stdlib ←
  format, modules ← modder → agent. `packages/engine/test/boundaries.test.ts` holds it. A game is handed over instead: the engine's
  `GameDef` (`gamedef.ts`: ontology, base rules, terrain characters) to the modder (`openModder({ game })`,
  `--game <module>`), and the runtime's `ClientGame` (`runtime/src/game.ts`: `useGame()`, read through
  `game()` and never at a module's top level) to the runtime by the game's own entries.

- `packages/engine` — pure, deterministic, no DOM/AI. World state + indices (`world.ts`),
  rule matching/specificity/library (`rules.ts`), effect primitives (`effects.ts`), event
  dispatch + tick + movement + combat (`engine.ts`), one goal system for every actor (`behaviour.ts`:
  goals in each type's order — encounter, threat, follow, schedule, home, idle; the people's goals and
  their real work in `npc.ts`, the creatures' in `creatures.ts`; a module's goals join them), Mod port: ModSpec / ModRequest / validatePatch / records
  (`mod.ts`), sandbox replay (`sandbox.ts`), snapshots for rendering (`snapshot.ts`: what the view shows and round it),
  a map's things kept as what differs from its file and the maps far behind put away (`sparse.ts`, docs/continent.md §13:
  `from`, `state.chunks`, `Game.keepMaps`/`trim`, the index as the file of the people who travel), the world's indices by
  type, person, prop, kept cell, agent and status by map (`world.ts`: `ofType`, `people`, `withProp` — never a scan over every thing),
  the relief (`relief.ts`: the faces of rock where ground drops south, a cell a level, rock to everyone; `World.stepOver`: only stairs and ramps join levels, a ledge a level high leapt down one way, a higher drop a wall), new game / save (`game.ts`); days, nights and weather spans (`calendar.ts`), people — keyed
  lines, schedule variants with the thing an activity needs, topics (`people.ts`), the story's one
  script (`story.ts`, world-model.md §6.12: steps with triggers — a scene takes control, a beat does
  not — that write only the story and send pushes and notices; steps wait on quests' stages and objectives; hints; the lessons
  of a quest's stage, the tutorial's drills that lock the keys they do not teach, `Controls.allows` — docs/prologue.md); the quests
  (`quests.ts`, docs/quests.md: Bethesda's model — a quest under way is a resident thing whose props are its state; aliases filled
  as it begins (essential people, kept things as derived tags), objectives, stages; it sees news the engine makes after every
  outcome and answers with its own rules, others notify it; the story is the Story Manager: auto starts, radiant offers; offers
  and topics in the talk panel, the journal, tracking, markers); the state is things and the
  clock (world-model.md §3): facts and topics are the story's props, memories each person's,
  a map's named areas are `region` things (`in-region`); invariants live in the engine; events, relations (contact from the relation difference),
  active/dormant maps and the writer (`World.grant`: the mutators throw outside an outcome, the
  clock, loading, the input's posture and the author, and in an outcome beyond its host —
  design.md §5.15; `games/openworld/tools/test/writes.test.ts` scans for writes behind them) in `engine.ts`/`world.ts`; the request, one question per hole and class, the
  validator (host-only writes, never what the economy reads, the rule's place, replay) and the boundaries in `mod.ts` (design.md §5.4–5.16);
  the player's
  inputs (design.md §5.2, the standard of 2026-10-21: four inputs, each one meaning — the left click `primary`,
  the held thing's own use: a tool or a weapon swung, the main hand's weapon or the fist, anything else used on
  oneself; held, a swing goes on, `Controls.again` —; the right click `secondary`, the held thing used on what is
  aimed at, a built thing set up there; E the hand, by the form of what it meets: what lies loose (`World.isLoose`)
  taken, anything else handled; G put, never building: a built thing put down lies loose, packed as `LOOSE`, and a
  tool knocks one set up loose, the `loosen` primitive;
  each as far as its reach: the target's `handsRange`, the world's `carry`, the held thing's `range`,
  held to by the engine for every actor), layers, slots and magnet
  (`controls.ts`, design.md §5.2, with a completeness test); crafting from recipes
  (`controls.ts`; a recipe's `madeOf` keeps the material and quality under the name it gives), gear's rolled extras (`affixes.ts`, `Ontology.affixes`) and sets
  (`Ontology.sets`), read by `World.stat` — mechanisms configured by data, kept in the kernel by decision (docs/engine-split.md §9), what appears by itself — the ground's yield, creatures that come back, the night's walkers (`appear.ts`), experience and levels (`progression.ts`; a skill book asks no points but holds to the tree's `requires`); companions that follow a
  leader (`companion.ts`) — docs/prologue.md; the codex (`codex.ts`: every item kind, person and creature kind, the ones the player carried or saw marked — the reader's record beside the state, saved with the game; its entries `content/src/codex.ts`, its panel J); looks (`looks.ts`, docs/looks.md: a look is a body, a part per slot and a colour per key, on `Entity.look`; the engine checks it against `Ontology.looks`, derives its `look:*` tags (never stored) and its words for the modder; `restyle` changes the host's); postures (design.md §5.17: `POSES` a status may draw its bearer in, `untilMove`, the `settle` impulse every actor answers with the `posture` primitive); the inputs X (draw) and V (sneak) are statuses the input keeps; the AI setting (`quality.ts`, design.md §13: off/low/medium/high for
  things, people, the world, making new kinds and asking ahead — the same wait at every level, a level is how much the AI does in it;
  `Engine.quality` is the player's, never saved; learned rules keep their `tier`, each tier its own trees, a higher answer serving
  the lower settings). What a game hands the
  engine side (`gamedef.ts`) and the map file format (`chunk.ts`, the game's terrain characters a parameter).
  The modules (`module.ts`, docs/engine-split.md §9): those a game's ontology names (`Ontology.modules`) are
  installed with every engine — their primitives, conditions, goals and ModSpec words, and what they put in the
  kernel's slots (`eng.combat`, the kernel's plain one in `blows.ts`; `eng.society`) and hooks (`eng.hooks`).
- `packages/modules` — the engine's official optional systems (S3), a folder each, registered as the package
  loads: `classes` (professions, combat talents, relics, active skills and the skill bar; the combat slot),
  `waypoints`, `boons`, `needs`
  (hunger), `society` (docs/npc-sandbox.md: `social.ts` whose things are, households, deeds seen and judged,
  recognition, memory and regard, gossip, the watches, prices, the talk panel; `conduct.ts` the goals social,
  need and follow; its state in `World.ext`, read with `socialOf(eng)`; the society slot), `loot` (a creature
  kind's own piece of gear, its `trophy` prop: by its chance or surely after `Ontology.loot.pity` fellings, the
  game's words `loot.found`; only a piece some kind of the game names is ever made, whatever a rule sends), `kits`
  (docs/skills.md: every monster's skills, one system — a kind's kit, `Ontology.kits` (`KitSkill`: where it aims, how it
  winds up, moves and chains, when it may be taken up); `pattern.ts` the cells, `cast.ts` a wind-up and its release (behaviour
  memory, lost with a save), `unleash.ts` the one primitive that lands it (a strike, a coat, a push or pull, what it leaves);
  two behaviours take skills up: `kit.ts` the minor monsters' `kit` goal before `threat` (docs/creatures.md), `encounter.ts`
  a boss fight's director (`Ontology.encounters`: phases with a rotation, an opening skill, answering skills; its saved
  memory `Entity.boss`; its plate in the frame, docs/bosses.md); `Frame.telegraphs` for every caster; the act a wind-up
  ends in, `use` with the param `kit`, is the caster's own rule's to answer).
- `packages/stdlib` — the standard library, data (`ontology.json`, `rules.json`): the types and statuses the
  kernel names, the roots of the rule library, the Story Manager's and a quest's rules. A project takes it
  unless its game.json says not.
- `packages/format` — the project format and its compiler (docs/engine-split.md §5): `project.ts` the files
  (game.json, ontology/, rules/, maps/, people/, quests/, story/, catalog.json, client/, learned/ — the patches
  the game ships with —, locales/ — a translation table per language —, extra.json),
  `compile.ts` a project → the bundle and its world, `check.ts` the problems (references, sizes, portals,
  anchors, ties, rules, modules), `json.ts` how files are written, `node.ts` a folder read and a game written,
  `serve.ts` projects served compiled, `cli.ts` (`npm run game -- check|build`), `holes.ts` a project's holes,
  `brushes.ts` the builder's brushes, `crowd.ts` people in bulk, `texts.ts` a game's words (docs/engine-split.md
  §19: written in its source language, game.json `languages`; where a file holds words, read from the schemas;
  the tables `locales/<code>.json` applied as it compiles; inline translations moved into tables; the source
  switched), `localize.ts` a language's rows and states, CSV and PO out and back, `schema.ts` the JSON Schemas
  from the engine's types (`schema/`, `npm run schema`). A bundle (`bundle.json` + `world/` + `assets/`) is a
  whole game: another bundle URL is another game.
- `packages/editor` — the OpenWorld Editor (docs/engine-split.md §6, §11, §15; the plan E1–E7 and E1, E2 as built §16–18; its languages §19), a program of its own: `src/server/`
  — `workspace.ts` where projects are (any folder; a recent list and the editor's settings in `~/.openworld-editor`; shelves: the repo's
  `games/` in development; templates: the starter, empty; a new project in the language chosen), `api.ts` the local service over them (only this host,
  every change with its header), `assets.ts` a project's pictures and sounds and the shipped pack (the Ninja
  Adventure subset: a file used is copied into the project's `assets/na/`; imports go to `assets/own/`),
  `export.ts` + `zip.ts` a project as a playable folder and zip, `server.ts` + `cli.ts` its own server (the built
  page, the built player, the service, the projects compiled; `npm run editor:build` → `dist/`, `npm run
  editor:start`); `desktop/` the Electron shell (outside the root workspaces; `npm run desktop`, `desktop:dist`;
  the `desktop` workflow builds installers). `src/app/` the editor — its own words through `lang.ts` `t()` in the editor's language (a
  setting of the editor's, never a project's; the Chinese in `zh.ts`, every phrase held by `test/words.test.ts`), a game's words through
  `words.ts` (one field each in the game's source language, `ui.ts` `textField`; translations kept for changed words; the preview
  language) —, `home.ts` the first page (recent projects,
  new from a template, open a folder; `dialogs.ts` the folder chooser, the desktop's own dialog there),
  `gameMode.ts` (the game's settings, modules, parameters, cover, interface words, factions, the rest of the
  ontology and the player's tables), `assetsMode.ts` + `sheet.ts` (the catalogue cut from pictures, the files,
  the pack, what needs a picture), `exportDialog.ts`, `store.ts`
  the project in memory (edits, undo and redo, save, compiled as it is now: after a stroke the maps alone, the whole once editing rests), `canvas.ts` the runtime's WorldScene with a
  free camera (the right button picks, the middle pans, Ctrl+wheel zooms), `mapMode.ts` (four layers and their tools; `mapEdit.ts`
  the edits — shapes, fill, blocks copied, pasted and moved, buildings, rooms, the interior behind a door —, `mapForms.ts` a map's
  settings, `mapTree.ts` the maps' tree and the world overview, `thumbs.ts` the palettes' pictures; `quickEvents.ts` + `events.ts` the quick events — a door, a chest, a sign, a bed, a person,
  a merchant, a quest giver — and a thing's own kind), `peopleMode.ts`, `databaseMode.ts` (types, statuses, terrains, recipes; `ontologyFiles.ts`
  where an entry is written), `rulesMode.ts` (a rule's tree and JSON checked as typed, which rule answers here,
  the sandbox), `storyMode.ts` (the story's steps and scene commands, the quests, all as forms: `triggers.ts` a step's and a quest's triggers,
  `sceneForms.ts` a scene's commands and a line shown as the game's dialogue, `form.ts` the forms' controls), `findMode.ts` + `usage.ts`
  (the event searcher: the facts set and read, where an id is used), `holesMode.ts` (the holes panel:
  count, answer by hand, ask the game's modder, review, replay, take into `learned/`), `localeMode.ts` (the Localization mode: the
  languages, a language's table as rows — to translate, to look at again, done —, a place's own, CSV and PO out and back, an older
  project's inline translations moved into tables), `problems.ts` the validation
  panel, `modes.ts` the modes; the map's brushes and the people in bulk come from the format; playtest opens the
  player at a cell, in the preview language (`?lang=`).
- `games/starter` — the minimal game, data only (S6), with its own catalogue and assets (a subset of the CC0
  pack): the kernel with no module plays it (`test/kernel.test.ts`); the editor's new project.
- `games/openworld/content` — ontology (terrains, statuses, elements, types), item catalogue
  (forms × materials × qualities × elements; the continent's goods, `goods.ts`: each region's line, local kinds and named
  pieces as variants of the base forms, and `stockFor` what a place of a region keeps — docs/continent.md §11), crafting recipes (`recipes.ts`), the skill tree (`skills.ts`), the BASE RULE LIBRARY (`rules.ts`), the Ford's
  story rules and invariants (`ford.ts`), the prologue's beats and lessons (`prologue.ts`), the main quest's rules (`quest.ts`,
  docs/main-quest.md), the quests (`quests/`: the main line, the people's errands through `errand()`, the radiant favours, the fairy's guides — teaching quests of the kind `guide` she begins herself on the story's beats, `guides.ts`; docs/quests.md),
  Chapter 1's facts and rules (`chapter1.ts`; its maps and scenes in
  `tools/src/demo/quest/chapter1.ts`, docs/chapter-1.md), the Pilgrim's Road's facts, wayside shrines and their rules
  (`pilgrimage.ts`; its maps and scenes in `tools/src/demo/quest/pilgrimage.ts`, docs/chapter-1.md §14), the fairy's boons (`boons.ts`), the bosses (docs/bosses.md, docs/skills.md: the White Knight and the dragon of Cinder Peak, and three for later — their kits, fights and `boss/<id>` rules, the briars and embers they leave, defeat rules and compatibility migration: `bosses.ts`, `migrateBosses.ts`), the minor monsters' kits and rules (`kits.ts`, docs/creatures.md), what they leave when felled (`drops.ts`: each kind's makeup, the gel, venom sac and ectoplasm only monsters give, the antidote's rules), their levels and numbers (`levels.ts`: one curve read through each kind's role), what both kits share — the helpers, the marks' colours, what clings and the one `body/afflict` rule (`afflictions.ts`), the look table and its generator (`looks.ts`: bodies, parts, colours, `generateLook` seeded by a person's id, `describeLook`), the people's social rules and numbers (`social.ts`: deeds and fines, the watches, talk verbs, the people's rules, prices, and `residence`: the Held Ground's beds for one asked at full regard, taken by the society module's `moveIn`), the Held Ground (`haven.ts`: its steward's panel — the land, its grounds, its buildings and the residents' tents, `HAVEN_UPGRADES`, the recipes a building unlocks (`recipes` → `Recipe.unlockedBy`, made anywhere once it stands) — and the ground's stock; `homestead.ts` its stall, crops, beasts and fish; docs/homestead.md), gear (docs/gear.md: `sets.ts` each profession's armour and trinket sets, forged at an anvil; `trophies.ts` each monster kind's own piece with its pity, the families' sets, the affix table), Firstlight's shops (`village.ts`), the migrations of older saves (`migrate*.ts`: among them `migrateHaven` the widening errands gone, `migrateTents` the tents' rooms, `migratePlots` the Held Ground's plots and the loom, `migrateStock` the merchants' goods, `migrateOverworld`, `migrateSmithy`), its map files' terrain characters (`chunk.ts`), and
  (`pilgrimage.ts`; its maps and scenes in `tools/src/demo/quest/pilgrimage.ts`, docs/chapter-1.md §14), the fairy's boons (`boons.ts`), the bosses (docs/bosses.md, docs/skills.md: the White Knight and the dragon of Cinder Peak, and three for later — their kits, fights and `boss/<id>` rules, the briars and embers they leave, defeat rules and compatibility migration: `bosses.ts`, `migrateBosses.ts`), the minor monsters' kits and rules (`kits.ts`, docs/creatures.md), what they leave when felled (`drops.ts`: each kind's makeup, the gel, venom sac and ectoplasm only monsters give, the antidote's rules), what both kits share — the helpers, the marks' colours, what clings and the one `body/afflict` rule (`afflictions.ts`), the look table and its generator (`looks.ts`: bodies, parts, colours, `generateLook` seeded by a person's id, `describeLook`), the people's social rules and numbers (`social.ts`: deeds and fines, the watches, talk verbs, the people's rules, prices, and `residence`: the Held Ground's beds for one asked at full regard, taken by the society module's `moveIn`), the Held Ground (`haven.ts`: its steward's panel — the land, its grounds, its buildings and the residents' tents, `HAVEN_UPGRADES`, the recipes a building unlocks (`recipes` → `Recipe.unlockedBy`, made anywhere once it stands) — and the ground's stock; `homestead.ts` its stall, crops, beasts and fish; docs/homestead.md), gear (docs/gear.md: `sets.ts` each profession's armour and trinket sets, forged at an anvil; `trophies.ts` each monster kind's own piece with its pity, the families' sets, the affix table), Firstlight's shops (`village.ts`), the migrations of older saves (`migrate*.ts`: among them `migrateHaven` the widening errands gone, `migrateTents` the tents' rooms, `migratePlots` the Held Ground's plots and the loom, `migrateStock` the merchants' goods, `migrateOverworld`, `migrateSmithy`), its map files' terrain characters (`chunk.ts`), and
  (`pilgrimage.ts`; its maps and scenes in `tools/src/demo/quest/pilgrimage.ts`, docs/chapter-1.md §14), the fairy's boons (`boons.ts`), the bosses (docs/bosses.md, docs/skills.md: the White Knight and the dragon of Cinder Peak, and three for later — their kits, fights and `boss/<id>` rules, the briars and embers they leave, defeat rules and compatibility migration: `bosses.ts`, `migrateBosses.ts`), the minor monsters' kits and rules (`kits.ts`, docs/creatures.md), what both kits share — the helpers, the marks' colours, what clings and the one `body/afflict` rule (`afflictions.ts`), the look table and its generator (`looks.ts`: bodies, parts, colours, `generateLook` seeded by a person's id, `describeLook`), the people's social rules and numbers (`social.ts`: deeds and fines, the watches, talk verbs, the people's rules, prices, and `residence`: the Held Ground's beds for one asked at full regard, taken by the society module's `moveIn`), the Held Ground (`haven.ts`: its steward's panel — the land, its grounds, its buildings and the residents' tents, `HAVEN_UPGRADES`, the recipes a building unlocks (`recipes` → `Recipe.unlockedBy`, made anywhere once it stands) — and the ground's stock; `homestead.ts` its stall, crops, beasts and fish; docs/homestead.md), gear (docs/gear.md: `sets.ts` each profession's armour and trinket sets, forged at an anvil; `trophies.ts` each monster kind's own piece with its pity, the families' sets, the affix table), Firstlight's shops (`village.ts`), the migrations of older saves (`migrate*.ts`: among them `migrateHaven` the widening errands gone, `migrateTents` the tents' rooms, `migratePlots` the Held Ground's plots and the loom, `migrateStock` the merchants' goods, `migrateOverworld`, `migrateSmithy`), its map files' terrain characters (`chunk.ts`), and
  the continent's regions (`regions.ts`: one per seal round the Holy City, which are backdrop, the untold gate), and
  `game.ts`, the GameDef the engine side is handed.
- `games/openworld/public` — what the game serves: `assets/na/` (the pack's subset), `assets/lsw/` (the project's
  own art), `world/` (generated by `gen:world`, not committed).
- `games/openworld/tools` — `demo/continent/people.ts` + `folk.ts` (the backdrop's people: a household to every room behind
  its places' doors, `npc.fidelity: 'local'`, laid into its places' files; docs/continent.md §12), `demo/scale.ts` (`npm run scale`: fifty maps, a tick, a frame, a save; and `demo/toolchain.ts`, the world's files and the compile, whole and a map alone), `art/animals.ts` (the project's own sprites → `public/assets/lsw/`), `art/cg/` (the event CGs: `refboard.py` references by tag, `cg.py` a shot drawn to its spec in `shots/<person>.json` and the person made themself from their look portrait, `art/looks/person.ts` that portrait; docs/character-art.md §4b), `art/portraits/` (a person's own portrait: `portrait.py` cut, moods, ship, per person `<id>.json`; docs/character-art.md §4c), `demo/` (the hand-crafted Ford, Firstlight Village west of it (`meadow`) and the forest south of that, and the main quest's maps and scenes in `quest/` (the Pilgrim's Road before the knight in `quest/pilgrimage.ts`) → `public/world/`, each map from its own seed: `builder.ts` the map DSL
  with the tools of composition — curved paths, organic shapes, fences and yards, small things by masks,
  anchors, regions; `world.ts` `buildFord()` — the map, scenes, invariants; `village.ts` Firstlight's houses and the rooms
  behind their doors; `shells.ts` a house's walls owned as the rooms behind its door are (the Ford's maps and the backdrop's); `overworld.ts` the world map from `continent/continent.json` with the hand-made maps on their
  cells; `continent/` the continent (docs/continent.md): `generate.ts` its generator (land, the Ford's barrier, regions,
  grounds, rivers, the gazetteer, roads, reach → `continent.json`, `npm run continent`), `names.ts` places named in both
  languages, `backdrop.ts` a map for every place by its kind and region (the backdrop: `MapData.backdrop`, no story, its own checks
  `test/continent.test.ts`, not the demo's minimality; a city by its quarter's theme), `rooms.ts` a room behind every
  building's door there, furnished by what the building is; a region's look is `RegionDef.look` (the world filter's
  grade and a shade, sent with the map); `stock.ts` what every backdrop place and room keeps — its houses',
  shops', smithies', inns', temples' stores and the dark's chests, by region and use, within capacity, a room's its
  household's (`test/goods.test.ts`); `interiors.ts` the rooms behind the other doors and the tents (Emberfall's houses, the East Road
  farmhouse, the ferry camp's tent, the rotted one, Alberic's); `quest/haven.ts` the Held Ground, its plots and its four
  grounds;
  `people/*.ts` one record per person (`person.ts`: a gender and the look pins the author chose; whether they fight, keep a watch, what they trade — every person does, what fits who they are —, their purse and honesty), `people.ts` `HOUSEHOLDS`; `check.ts` a headless two-day playtest;
  `test/demo.test.ts` the completeness and minimality proof),
  `copyAssets.ts` (catalogue subset of the pack → `public/assets/na/`), `coverage.ts` (every item
  form × every target × every act through the rule library and the impulses it sends, counting
  the holes; the numbers in `docs/roadmap.md` §1), `upstream.ts` (docs/upstream.md: a candidate from
  `modder/src/promote.ts` — a class whose types learned one hole alike — as a content task of the
  agent: `games/openworld/content` writable, `packages/engine` read-only, the issue from the hole's source
  and the evidence, a verdict the agent cannot touch (the generated promotion test from
  `tasks/upstream/promotion.test.ts.tmpl`, the coverage regression, the content suite, the bounds);
  a solved task is a branch and a PR a person merges, recorded as an `upstream` episode).
- `packages/runtime` — the player, a library with no game in it: `game.ts` (what it is handed, `useGame`,
  `useWorker`; where a game's assets, world and saves are; `hasModule`: a module's panels show only where the game
  uses it); `bundle.ts` a bundle by URL → the game, and its plugins; `play/` the engine's player, no game in its
  build (`?game=<url>`, `npm run play`, `npm run build:player`); `main.ts` the page and `worker.ts` the engine thread, each loaded by a game's entry;
  `worker.ts` runs the engine at 10 ticks/s (+ the action prompt);
  `frameDelta.ts` frames as what changed (the page puts them back together), `render/scene.ts` renders snapshots with the Ninja Adventure pack (`render/depth.ts` the draw order; `render/pieces.ts` a building's picture cut into pieces bound to its walls — cracked, burnt, gone as the frame tells them (docs/building.md §10); `render/worldfilter.ts` the world filter a game's `worldFilter` asks for — its grade, ink, paper and hatching — the options' strength, and the signal camera that keeps telegraphs above it); `audio/` the music and the ambience (docs/music.md: `music.ts` the director — the title's, a scene's `music` command, a boss by kind and phase, a fight held past its end, the place's mood by the hour and the weather, its piece held and taken up again, rests in the wilds, every piece at one loudness from the catalogue's measured `loudness` —, `cues.ts` the cues' versions, `ambience.ts` the world's sounds made as it plays, `soundscape.ts` their buses at the player's levels); `assets/figure/` draws looks
  (docs/looks.md): the 24x36 map sprite: the bases and their walk (`bases.ts`: the man, the woman, the child), and frame by frame the outfit and what is worn (`baseoutfit.ts`), the head's parts (`basehead.ts`) and the hair (`basehair.ts`), drawn over ComfyUI drafts (`tools/src/art/looks/sprite/`), the legs and shoes laid on as colour (`basefeet.ts`); the full-body portrait (a dark-fairy-tale line style, every body its own face; its bust in the dialogue box, the whole figure in the creator) from the cut layers in
  `public/assets/lsw/Looks/portrait`, both repainted from the look's colours; `ui/creator.ts` the new game's character creator; a person's own portrait in place of their look's bust (the catalogue's `portraits`, `hud.ts` blinking and speaking); `assets/types.ts` the catalogue's
  contract; `assets/ground.ts` autotiles (the blob layout); `assets/relief.ts` the relief painted from the heights (faces, rims, stairs; both renderers); `ui/` the Stardew-style UI (`hud.ts` clock, bars,
  toolbar, key labels, dialogue; `menu.ts` menu tabs, the character sheet (the engine's numbers, `Frame.player.stats`),
  journal, chest panel, the shops a game lists (`crafting.shops`: shelves with names and `sell`); `panels.ts` a game's own panels
  (`ClientGame.panels`: by the key a rule's `panel` effect opens, told the fx's `by`, loaded when first opened);
  `boons.ts` the boons module's panel for a game with none of its own; `people.ts` the trade and pockets panels (the talk panel is the dialogue's, `hud.ts`); `worldmap.ts` the world map (M) and the minimap; `dev.ts` the Mod Console, dev only; `quality.ts` the options' AI section: presets, a level per kind of work, the detection; `paneltabs.ts` Tab's tabs over an open panel; `keyspage.ts` Options → Keys); `keymap.ts` the keys
  (design.md §5.2: every key an action's, rebound by the player, kept in the browser; the two clicks are the mouse's
  alone; a text's `{key:<action>}` filled with the key now — a game's words name actions, never letters); the worker uses the modder service when one answers
  (`?modder=<url>`, default `localhost:8787` in dev) and syncs the shared library from it. It says no one game's
  words (docs/engine-split.md §15; `test/words.test.ts`): a game's words are its `texts` (over `ui/common.ts`
  STRINGS), its catalogue (`<tag>Mark`, `equipSlots`, a weapon's `swing`), its tables and its panels. Still this
  game's in the runtime: the boss art, preview and animations (and the skill tree, professions, shown only with their module).
- `games/openworld/client` — the game's app: its pages (`index.html`, `boss-gallery.html`, `looks.html`,
  `preview.html`), `vite.config.ts` (public dir `../public`), `src/register.ts` (hands the game over; every page,
  the worker and the game's tests that use the runtime import it first), `src/game.ts` (the ClientGame: content, catalogue, the
  wilderness, the upgrades of older saves, the dev console's shortcuts, its cover, its words), `src/ui/` its own panels
  (`panels.ts` the registry: the companion's, `companion.ts`, opened by `companion` and `boons`; the Held Ground's,
  `homestead.ts` with `stock.ts`, opened by `haven`; each with its .css, loaded when first opened), `src/catalog.ts` (content keys →
  sprites), `src/bundle.ts` the game as a bundle (gen:world writes `public/bundle.json`) and `src/plugin.ts` its code
  for the engine's player, `scripts/bake.ts` the Ford baked into the format (`npm run bake` →
  `games/openworld/project/`, not committed), the boss gallery, studio and challenge, and the looks page.
- `games/openworld/wiki` — the game's Chinese wiki (Stardew-wiki-shaped encyclopedia and design proposal): sources
  `wiki/pages/**.md` ([[links]], {{templates}}; format in 帮助/格式手册), `wiki/site.json` (nav, portal, the systems the
  completeness check requires), `wiki/译名.json`; the generator reads the game (`@openworld-game/content`, `buildFord()`, people,
  the game client's catalogue; `render-map.ts` draws maps as the client does). The pages stay in the root `wiki/` for now
  (the live site and the team's editing use that path). Every item, fixture, person, creature, boss, map
  and quest gets a page; `npm run wiki:check` fails on broken links/templates or a thing/system without a page (CI
  `.github/workflows/wiki.yml`). A change to game content that adds a thing or system needs its wiki page.
  Two editions (`lang.ts`: one build each, every word through `L(zh, en)` or the game's own `say`): Chinese is the source;
  English is its translation at `/wiki/en/`, a page `wiki/en/pages/<the Chinese page's path>.md` whose `source:` is the
  hash of the Chinese text it translates (`npm run wiki:translate -- status | stamp | relink`; untranslated and out-of-date
  pages are shown with a banner, never fail the check), `wiki/en/site.json` the navigation's headings, `wiki/en/terms.json`
  the term table. A link or template argument may name a page in Chinese in an English page: it resolves to the English page
  (`relink` rewrites it); templates have English names too (`TEMPLATE_EN`).
- `packages/agent` — the SWE-style agent and its self-state, task-agnostic (no engine, no content):
  `model.ts` (OpenAI-compatible / scripted / `anthropic.ts` Anthropic's API; `LSW_MODEL_PIN` freezes the provider for an experiment; `LSW_NO_ANTHROPIC=1`
  makes the claude-code backend and `anthropic/*` models refuse on a machine),
  `state.ts` (memory, skills + scripts, harness, hooks, journal, snapshots, ablations), `env.ts` (local /
  docker: a benchmark image's `/testbed` copied out and mounted back, a node mounted for the hooks),
  `tools.ts`, `loop.ts` (the agent loop), `reflect.ts`, `outer.ts` (proposals + meta-validation),
  `presets.ts` (naive / tuned), `swe.ts` + `cli.ts` (SWE-bench instances → predictions.jsonl, N at a
  time, a record per instance, the run's manifest, resumable). See docs/rsi.md and, for the
  experiments, docs/rsi-experiments.md.
- `bench/` — the RSI experiments' benchmark pool (docs/rsi-experiments.md §4.1): `pool.py` counts the
  public SWE-style datasets by date (each at a pinned revision), freezes a pool as identifiers only
  (`bench/pools/`), fetches a pool's instances into `var/bench/`; `fresh/` the fresh pool's miner
  (docs/fresh-pool.md: Python tasks from pull requests after the frozen model's release, on SWE-rebench's
  environments, by SWE-bench's own rules, no model; its stages write to `var/fresh/`, gold patches never
  tracked here). Outside `packages/` and `games/`, so no ladder task's workspace holds it.
- An unattended agent runs commands only in a container (`env.ts` `chooseIsolation`: the
  `lsw-sandbox` image, no network, no `.env`); without Docker it gets no shell and its hooks do
  not run. `LSW_ISOLATION=docker|none` overrides. Never give an unattended agent a local shell.
- `packages/modder` — the modder service (design.md §13, rsi.md). It imports no game: it is handed one
  (`openModder({ game })`; the command line's `--game <module>`, which the root script passes); a world
  repository carries its own ontology. The engine never depends on it. Parts:
  - `model.ts`: a model interface — OpenAI-compatible, or scripted for tests and offline.
  - `pipeline.ts`: comprehend → recall → design (tools) → verify/repair → audit → review → commit →
    record → reflect. The auditor (`audit.ts`) plays against a patch in the sandbox; only what it
    reproduces there, with the patch and not without it, counts. Live designs are routed (design.md §13, the router): local (the request's
    own types) → find (the catalogue) → create (a new type with its 16x16 picture as data).
  - `affordance.ts`: what the host affords for the act (design.md §5.17): the answer's judgment (use, words, none),
    a use held to changing the scene that asked, the verdict on the rule (`Rule.affords`); words are provisional,
    asked again on the player's third try (`ModRequest.again`, the port's `again`), and the answer is final.
  - `tools.ts`: the design tools.
  - `library.ts`: the shared library as an append-only patch log.
  - `quality.ts`: a request's tier as a workload over the harness (medium the harness; low less, high more; never more time);
    `detect.ts`: what the connected model carries — the history's questions and the game's probes (`GameDef.probes`) played
    at every tier by a dry modder, a recommendation per kind of work (`GET /quality`, `POST /quality/detect`).
  - `state.ts`: the self-state — memory, skills, harness, journal, snapshots.
  - `server.ts`, `cli.ts`: the HTTP API and the command line.
  - `repo.ts`, `validate-cli.ts`: a world request as a repository for the agent (the offline profile).
  - The offline driver is `games/openworld/tools/src/curriculum.ts`; engine tasks (hidden fail-to-pass tests) are
    `games/openworld/tools/src/engine-tasks.ts` + `games/openworld/tools/tasks/engine/<id>/`; the ladder — this
  repository's own commits as fail-to-pass tasks at their parents — is `games/openworld/tools/src/ladder.ts` +
  `games/openworld/tools/tasks/history/<sha>/`; one outer-loop turn is
    `games/openworld/tools/src/improve.ts`.
- RSI design changes (what the outer loop may change, how it is judged, the benchmark interface)
  are discussed with the user before they are coded.
- Game mechanics are designed reference-first: read how Elin (installed; decompile
  `Elin_Data/Managed/Elin.dll` with `ilspycmd` into the scratchpad) and other games built it,
  then adapt to our principles; invent only where no game has a model.
- The model is Kimi K3 via OpenRouter, with the key in the gitignored `.env`. Anthropic, Google and OpenAI
  return 403 from here. Never hard-code a provider; tests use `ScriptedModel`. A second backend,
  `claude-code`, calls `claude -p` signed in as the user (Opus 5.5, effort low by default — the least: a call asking for
  more reasoning, the high AI setting's or the offline profile's, gets medium or high; `ClaudeCodeModel`, `effortOf`).
  A third, `anthropic`, calls Anthropic's API with `ANTHROPIC_API_KEY` from `.env` (`anthropic.ts`: the system prompt cached,
  tools as tools, effort per call, the default fallback; the paper's world-side experiments, docs/paper-eval.md).
  `npm run dev` asks which backend to use (or `--backend openrouter|claude-code|anthropic|none`, `LSW_MODEL_BACKEND`).
- Two harness profiles: **live** (a player waits: brief, one call, low reasoning, deterministic fixes,
  derived tests, hedged calls, review after shipping) and **offline** (curriculum, escalations,
  revisions: tools, more reasoning, blocking review). Measure live changes with `npm run latency`.

## Rules of thumb

- New behaviour = a rule (data) in `games/openworld/content/src/rules.ts` or a patch; a rule an input reaches says
  what the input does there (`label`, on the rule or on one of its answers). New primitive,
  condition or event kind = an engine change (and add it to the ModSpec docs in `effects.ts`/`mod.ts`).
- Rules address classes (types/tags/statuses), never instances, unless unavoidable.
- No judgment is "is it the player": who attacks whom (factions + temper + foes), who sees what
  (witnesses of any actor), who collapses (`essential`), using on oneself (`self`) are data any
  actor carries. Only the input knows which actor the keys move.
- **The event model** (design.md §5.4–5.14, agreed and built 2026-10-02; §5.14 records what the
  implementation refined):
  - The game is an ordinary, complete game. It plays to the end without AI.
  - The one AI interface is **the outcome of an event**. Defined: use it. Undefined: ask the
    AI. No AI, a failure or a time-out: the leaf's default, normally nothing.
  - Rules belong to a **host** type (`host × event kind → condition tree`). They **read
    anything and write only their host**; to affect another thing they emit an event (an
    impulse) to it, and it answers.
  - Leaves are effects (an empty list means no change), emit, inherit, or undefined (with a
    default).
  - The event kinds are a closed tree: act, impulse, contact, bump, time, threshold, seen,
    stuck, broken. Contact comes from the relation difference after every outcome, and only
    where a stance meets a reach (a flyer never touches lava).
  - Root defaults decide what is asked: deliberate acts and impulses are undefined; contact,
    time and sight mean no change; elements follow physics.
  - Patches only fill holes, never change defined behaviour (they are a layer consulted only at
    undefined leaves). One question per hole and class. Put places; use applies: taking and
    putting are physics (never asked), using one thing on another is where the AI answers.
  - Behaviour (schedules, temper, behaviour trees) is the game's own logic, not the AI
    interface. An outcome may change its host's script.
  - The player's map is active. Dormant maps are frozen and catch up timers (a status's pulses
    on the way to its end too, each with its own dice) and their inbox when entered. The world, the story and people's records are resident. Events cross maps
    only by address.
  - **Even with no model connected, design every feature for one.** New behaviour goes
    through events and rules, never around them in engine code. A deliberate act on
    something no rule covers stays an undefined leaf (the AI's place to answer). Play without
    a model is kept by the leaf's default and authored fallbacks, never by closing the hole.
- Specificity (base rules): host first (instance-bound, type depth), then event kind depth. Two
  equally specific base rules are an authoring error (the content tests sweep for it). Learned
  rules have places, not ranks (design.md §5.16): one type, the exact kind, one tree per (type,
  kind, hole) that grows by replacing its own open leaves; they never `inherit`, never tie, and no
  regression set is needed because the base is resolved first.
- Game code never writes the state directly and never takes the author's hand (`Engine.author`
  is for tests, world building, loading, migrations and the dev console). A system that changes
  the world does it as events: behaviour makes acts, the clock makes periods and timers, a
  system's own logic runs inside its host's outcome as an effect primitive (design.md §5.15).
- The demo must stay complete: anything added to its maps witnesses a requirement in
  `games/openworld/tools/test/demo.test.ts` (or the test fails), and every requirement is checked on the real map.
- Only the player steps onto portals; NPCs transfer from the adjacent tile.
- Languages (docs/engine-split.md §19): a game's text is written once, in the game's source language (one field in
  the editor, a plain string in its file); its translations are `locales/<code>.json`, applied as it compiles. The
  editor's own words are `t('…')` with an entry in `packages/editor/src/app/zh.ts` (its test fails on a phrase
  without one); the editor's language, the game's and the preview language are three settings, never tied.
- After changing rules, run `npm run coverage` and commit the refreshed baseline with them; a
  finished milestone records its numbers in its row of `docs/roadmap.md` §3. The coverage test
  fails if any form or target loses an answer or a purpose.

## Commands

```bash
npm install
npm run gen:world        # the Ford (default world), the continent's backdrop with it
npm run continent        # the continent made again for the hand-made places (only after one moves) → continent.json
npm run check:world      # headless playtest of it: days kept over two game days, what the world asked
npm run scale            # the world at scale: fifty maps walked into, a tick, a frame on the world map, a save
npm run assets           # copy the catalogue's subset of the asset pack into public/assets/na
npm run loudness         # every music file's loudness measured → client/src/loudness.json (docs/music.md)
npm run dev              # client at http://localhost:5173 + the modder on :8787 (asks for its model; dev:client for the client alone)
npm run dev -- --backend claude-code   # the modder through claude -p (Opus 5.5, effort low)
npm test                 # vitest (engine + base rules + Mod port)
npm run typecheck
npm run check            # both, as CI runs them on every PR and push to main (.github/workflows/check.yml)
npm run coverage         # interaction coverage + refresh its test baseline
npm run build            # gen:world + static build → games/openworld/client/dist
npm run editor           # the OpenWorld Editor on http://localhost:5175/editor/ (the games under games/, and any folder)
npm run editor:build     # the editor as a program → packages/editor/dist (page, player, server, templates, pack)
npm run editor:start     # that build run alone (node packages/editor/dist/server/cli.js --open)
npm run desktop          # the desktop application from the repository (Electron, installed on first run)
npm run desktop:dist     # its installers → packages/editor/desktop/release (NSIS/zip, dmg, AppImage)
npm run play             # the engine's player on :5174 (?game=/games/starter/ or /games/openworld/)
npm run build:player     # the player alone → packages/runtime/dist, the starter built beside it
npm run game -- check games/starter   # a project's problems (build <project> --out <dir>: a bundle)
npm run bake             # OpenWorld as a project in the format → games/openworld/project/
npm run schema           # the project's JSON Schemas from the engine's types
npm run wiki             # the wiki on http://localhost:5180/wiki/, English at /wiki/en/ (wiki:check, wiki:build)
npm run wiki:translate -- status | stamp [file…] | relink [file…]   # the English edition's upkeep
npx tsx games/openworld/tools/src/art/looks/review.ts out.png [mood]   # everyone's portrait and sprite (docs/looks.md)
# portrait parts: a local ComfyUI with Qwen-Image-Edit (tools/src/art/looks/portrait/setup.md), then
#   python -I parts.py <work> && python -I batch.py <work>/jobs.json && python -I build.py <work> games/openworld/public/assets/lsw/Looks/portrait
npm run modder -- serve  # modder service on :8787 (model from LSW_MODEL_URL/KEY/MODEL; data in var/)
npm run modder -- serve 8787 --script packages/modder/fixtures/offline.json --data var/offline
npm run curriculum -- 20 # resolve 20 sampled undefined interactions offline (offline profile)
npm run curriculum -- --n 20 --profile live --by hole --data var/<run>   # live profile, spread over holes; per-step reach
npm run curriculum:report -- var/<run>   # summarise a run: steps, reviews, revisions, spend
npm run ford-live        # the six kinds of hole on the Ford, live (costs model calls)
npm run probes           # the game's probes for the AI setting's detection → games/openworld/content/src/probes.json
npm run eval:objects     # five acts to find a known thing, five to create a new one, live (costs model calls)
npx tsx games/openworld/tools/src/eval/persistence.ts | attack.ts   # the paper's persistence and trust-boundary runs (no model; docs/paper-eval.md)
npx tsx games/openworld/tools/src/eval/controlled.ts items | answer <cond> | judge | report   # the paper's Table 1 (costs model calls)
npm run latency -- --n 20 # live-profile latency bench (fresh library each run; costs model calls)
npm run improve -- --select 8 --confirm 8   # one outer-loop turn (costs model calls)
npm run engine-task -- toggle-status --state <dir>
npm run ladder -- candidates | validate | issues [--limit n] | status   # this repository's commits as fail-to-pass tasks (docs/rsi-experiments.md §5)
npm run rsi -- plan | milestone | heldout <world-vN> --arm G|F   # a milestone of the RSI experiments (§6; needs LSW_MODEL_PIN)
npm run upstream -- scan [--data var] [--sweep]   # candidates for base rules from the learned layer (no model)
npm run upstream -- propose --candidate <n> | propose <hole> <class> [--note …] [--dry] [--max 3]   # one proposal → a PR (costs model calls; --dry prints the issue)
npm run upstream -- status   # the proposals made and how they stand
npm run agent -- swe --instances <file> --state <snapshot> --out predictions.jsonl [--env docker] [--workers 4] [--ablate skills] [--resume]
python bench/pool.py count | freeze <name> | fetch bench/pools/<name>.json   # the benchmark pool (pyarrow; no model)
python bench/fresh/fresh.py recipes | candidates [--limit n] | counts   # the fresh pool's miner, S0–S1 (bench/requirements.txt, a GitHub token)
npm run modder -- stats | snapshot <label> | export [label] | library [remove <id>]
```
