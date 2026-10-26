# Move the trophy into a loot module, and fix the engine gaps the review found (input targeting, weapon extras, craft, skill books, sets/affixes)

## What is wrong

A review of recent direct pushes found game content and bugs in the engine kernel and its AI interface:

1. **The `trophy` primitive is game content living in the kernel.** Its pity count (`WorldParams.trophyPity`) and the words the finder is told ("获得专属装备…") are hard-coded in `effects.ts`. Worse, it makes any type it is told to: any rule or patch can emit defeat news naming any type with chance 1 and put that item in a bag. Its roll also uses `w.rand()`, so the sandbox's exploration of luck cannot take both outcomes.
2. **Input targeting.** The "person-first" target order (a person or creature before what is drawn over them) was meant for E only, but it now also applies to F, G and the left click. F takes the farmer standing behind a stick; a bare click strikes him. A "companion" is also found by the `companion` tag instead of by the `companion` prop naming a leader. `Controls.offer`'s doc names a game panel.
3. **`World.stat` counts extra weapons' `sub:` extras.** A weapon kept worn in the main hand while another is held also adds its extras, though only one is fought with.
4. **`craft` over-merges.** Any recipe that names, tags or gives props to what it makes also gets material and quality tags. The anvil and the bee box gained `material:*` tags, and feed, compost and bought skill books gained `quality:fine` past level 3, so new feed no longer stacks with old feed.
5. **Skill books leap the tree.** Reading a book ignores the skill's `requires`. A Smoke Bomb bought at the bookstand can be read before Shadow Strike.
6. **Sets and affixes are missing from the editor's Game mode.** The compiler also replaces `sets` wholesale when a later ontology file supplies some, instead of merging by id.
7. **Documentation gaps.** `Recipe` lost its JSDoc, `panel` names only one panel, and `dropContents.loose` is undocumented.

## Expected behaviour

**Loot module**
- A new module `loot` (in `packages/modules/src/loot`, exported from the modules index) brings the `trophy` primitive; it leaves the kernel's primitive list. OpenWorld lists `loot` in `MODULES`. The starter, which loads no module, has no `loot` registered.
- The pity is `Ontology.loot.pity` (default 50). `WorldParams.trophyPity` is removed.
- The words told to the one at the keys are `Ontology.loot.found`, with `{item}` replaced by the piece's name in each language. With no `found`, nothing is logged (only the pickup effect shows). OpenWorld's data supplies "A trophy: {item}!" / "获得专属装备：{item}！", with pity 50.
- Only a piece that some kind in the game's own ontology names as its `trophy` prop is ever made. Defeat news naming any other type gets nothing and records no count. A kind added later by the AI (a learned type) does not make its word a trophy.
- The chance roll goes through `World.chance`, so under the sandbox's luck exploration both outcomes are reached.
- The striker's `trophy.<type>` counts are kept as before, so an older save resumes with its count (for example, at 49 the next felling is sure).
- The modules' write-scanning test covers every folder in `packages/modules/src`, so new modules are scanned automatically.

**Input targeting**
- E's order: a person or creature, then a companion, then the rest in layer order. F, G and the left click use plain layer order (F takes the stick over the farmer; a bare click strikes the stick).
- A companion is an actor whose `companion` prop is a string naming a leader. E reaches for a following fairy before the stick under her; for a fairy that follows nobody, the stick comes first.

**Weapon extras**
- Of weapons, only the one fought with (`weaponOf`) adds its `sub:` extras to `World.stat`: the held weapon if any, else the one kept in the main hand. If the same weapon is both held and kept, it counts once.

**Craft**
- A recipe that names, tags or gives props to what it makes makes it exactly as it says. Only a recipe flagged `madeOf` is also made of its main ingredient's material at its maker's quality, with its own name, tags and props laid over that.
- The set-piece recipes carry `madeOf`. A set piece is of the metal it took and at the smith's quality, under the set's name. The anvil is just the anvil the recipe names, with no extra tags. Feed made by hand past level 3 has no extra tags and stacks with older feed.

**Skill books**
- `cannotRead` refuses with a new reason `'requires'` when any of the skill's `requires` is not yet known. Reading in that case keeps the book and teaches nothing. The refusal log names the skills that must come first, in the player's language. Once they are known, the book is read normally.

**Sets and affixes**
- The editor's Game mode lists `sets`, `affixes` and `loot` as parts of the ontology.
- The compiler keys `sets` by `id`, so a later file's set with the same id replaces that one, and the others stay.

**Docs and schemas**
- `Recipe` gets its JSDoc back, `panel` documents "any panel the game's client shows", and `dropContents` documents `loose`.
- Regenerate the JSON schemas: `LootParams` and `Ontology.loot` appear, `trophyPity` goes.

## Requirements

- The kernel keeps no game words and no trophy logic. The `trophy` primitive is a module's and writes only its host (the feller).
- The trophy is made only for pieces named by `trophy` props of the ontology's own types, never learned types.
- The trophy chance roll is a `World.chance` site.
- Pity and found-words come from `Ontology.loot`. The pity default is 50, and no words means no log.
- Existing saves keep their `trophy.<type>` counts, and OpenWorld names `loot` in its modules.
- E's person/companion-first order applies to E only. Companions are identified by their `companion` prop.
- `World.stat` adds `sub:` extras from at most one weapon, the one `weaponOf` returns.
- `craft` merges material and quality only for `madeOf` recipes. The set recipes in `sets.ts` set `madeOf`.
- `cannotRead` honours `requires`, and the refusal names what comes first.
- `sets` merge by `id` in the compiler. The editor Game mode lists `sets`, `affixes` and `loot`.
- The write-scan test enumerates all module folders.
- Docs and schemas are updated consistently.

## Interface

- `LootParams` (type, exported from `@openworld/engine`, in `packages/engine/src/types.ts`): `{ pity?: number; found?: Text }`.
- `Ontology.loot?: LootParams` (in `types.ts`).
- `Recipe.madeOf?: boolean` (in `types.ts`).
- `LootParams` value `LOOT: LootParams` exported from `games/openworld/content/src/trophies.ts` (re-exported by `@openworld-game/content`): `{ pity: 50, found: { en: 'A trophy: {item}!', zh: '获得专属装备：{item}！' } }`. Passed to the ontology as `loot`.
- `lootModule: EngineModule` with id `'loot'`, in `packages/modules/src/loot/index.ts`, registered on import and exported from `@openworld/modules`; it provides the effect `trophy`.
- `trophyTypes(eng: Engine): Set<string>` (in `packages/modules/src/loot/loot.ts`, exported from `@openworld/modules`): the pieces named as `trophy` by the game's own types, excluding learned types (those in `eng.lib.types`).
- `PITY` (const number, 50) and `trophy: EffectImpl` in `loot.ts`.
- `ModuleOp` includes `'trophy'`; `Effect` keeps `{ op: 'trophy' }`.
- `cannotRead` may now return `'requires'` (a `LearnRefusal` value).
- `weaponOf` and `MAINHAND` are used from `@openworld/engine` (export them if not already exported).
- `MODULES` in `games/openworld/content/src/ontology.ts` becomes `['classes', 'bosses', 'waypoints', 'boons', 'needs', 'society', 'loot']`.
- `WorldParams.trophyPity` is removed.
