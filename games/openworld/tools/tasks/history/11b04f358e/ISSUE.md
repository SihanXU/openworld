# Editor: build OpenWorld's "quick events" as pure data helpers (door, chest, sign, merchant, favour quest, a thing's own kind) and usage lookups for Find

## What is wanted

The editor's map author should be able to make the common kinds of "event" without writing JSON, in the way RPG Maker's quick events work. Each event must be plain format data (map things and portals, a person's file, a quest's file), never a script for one instance. This issue asks for the pure, editor-independent helpers that build that data, plus the lookup functions that tell the author where a fact or an id is used.

The helpers are:

- A **door** to another place, optionally with its **way back**.
- A **chest** (any container) and what it holds.
- A **sign** with its words.
- A **person**, and a **merchant** (the society module's trade).
- A **favour** as a quest: bring things, defeat things, or have a word with someone.
- Ids for new people and quests, derived from names and titles.
- A thing's **own kind**: a child type for one thing, and a first rule for it, so that behaviour for a single event remains rules on a type.
- **Usage lookups**: for each story fact, where it is set and where it is read; and for any id (a type and the kinds under it, a person, a thing, a map, a quest, a step, a rule), every place in the project that names it.

The store must also support a **batch**: several edits made together that undo and redo as one step.

A story made only of these quick events must play correctly on the kernel to its end. For example, a villager asks for two stones, the stones are brought, and she rewards the player.

## Expected behaviour

**Door**
- Laying a door at a cell on a map puts a portal there leading to the target map and cell. If the game defines a door terrain character, the cell is painted with it.
- With a way back, the other map gets a door and portal at the chosen cell. That portal leads back to this map at the cell just below the door (the way a door is left). Below the map's bottom edge, the cell is clamped.
- Laying a door again on a cell that already has a portal replaces that portal. It must not double it.
- A cell off the map is refused with an editing error.

**Chest and contents**
- A chest is placed at a cell, and each requested item type is created the requested number of times, held inside the chest. Every created thing gets an id that is unique on the map and does not collide with any existing id. The chest's id is returned. For example, the first chest on map `a` is `a.chest1`.
- Counts that are zero or negative create nothing.

**Sign**
- A sign is a readable thing at a cell. Its words are stored as props: `text` (English) and, when a second language is given, `text_zh`. A plain string gives only `text`.

**Person and merchant**
- A person id is `npc.<word>` from the name (lowercased, non-alphanumerics collapsed to `_`). If it is taken, a numeric suffix is added: `npc.old_tom` becomes `npc.old_tom2`.
- A person stands on a tile of a map, faces down, and has an optional first line (default key).
- A merchant is a person tagged `merchant` with props `purse` (a number) and `stock` (`type*n|type*n`). It also carries the stock items and, when a coin type is given, that many coin items, all held inside the merchant. For example, a stock of 2 bread and a purse of 3 of coin `item/misc/coin` gives five carried items, in that order: bread, bread, coin, coin, coin.

**Favour quest**
- A quest id comes from the title (lowercase, words joined by `_`) and gets a suffix `_2`, `_3` and so on when taken. `Three Stones` becomes `three_stones`.
- A favour quest begins when its giver is spoken to, and is shaped like the starter's `firewood`: aliases, objectives, stages.
  - A **talk** favour has aliases `giver` and `other`. Its final stage is number 100, triggers on talking to `other`, completes the quest, and is spoken by `other`.
  - A **bring** favour counts what the taker carries. A **defeat** favour counts what they fell. Both then require going back to the giver. The final stage requires talking to the giver and the objective met. A bring favour takes the items asked for. The stage then gives the reward and completes the quest.
  - Ask, waiting and thanks lines and a reward (xp and items) are carried through.

**Its own kind**
- The child type id is the thing's type path plus a word from its name (or the last part of its id): `fixture/sign` with name `Old Sign` gives `fixture/sign/old_sign`. If that is taken in the ontology, `_2`, `_3` … are tried.
- A first rule is built for that type: hosted on the new type, triggered by `impulse/handle` (a hand on it). It says something, and the author writes the rest.
- Giving a thing its own kind on the starter, and registering the type in the ontology, must leave the project free of errors, and the original parent type must still exist.

**Batch**
- Several store changes made inside one batch are labelled with a single description, which is reported as the next undo step. One undo reverses all of them (a new person's file and a map's new chest, for instance). One redo restores all of them.

**Usage lookups**
- For facts: for each fact key, the places that set it and the places that read it, with the file and the step or quest id it sits in. A step in a story that has `facts: {...}` for a key sets it. A step whose `when` mentions the key reads it. Setting and reading are separate entries with `how` equal to `set` or `read`.
- For an id: every place in the files whose value or key is that id, each entry with the file, the id of the thing it sits in when there is one, and the path inside the file. The `how` of an entry is `set`, `read` or `names`. When the id is a type, the kinds under it count too. For example, the starter's `npc.mira` is named in `quests/firewood.json` and `people/mira.json`, and the type `item/tool` is named by the map `maps/glade.json` at the thing `glade.axe`.
- The editor has a mode that shows these as lists of places, each opening where it is edited.

## Requirements

- The helpers work on the format's data and do not touch the page. Each is usable on its own.
- The helpers throw the editor's existing editing error for cells off the map.
- Generated ids never collide with ids already in use. A `taken` set is supplied and is respected.
- A door with a way back does not leave a stale portal on the cell it replaces on either map.
- The next undo label for a batch is the batch's label. A batch is undone or redone as one step.
- After a batch holding a quest giver (a person file plus a favour quest) and its own-kind change, the compiled project has no errors. Played from the start, the player can talk to the person, the quest becomes `active`, carry two stones, talk again, and the quest becomes `done`. The stones are taken, and the reward (such as an axe) is given.
- The new context services are available to the editor's modes:
  - A playtest can be opened with a scene (a step of the story begun at once).
  - A cell can be asked for on a map and returned, or cancelled with Esc.

## Interface

In `packages/editor/src/app/events.ts` (new file):

- `door(here: RawChunk, at: Cell, to: { map: string; x: number; y: number; label?: Text }, chars: Record<string, string>, back?: { chunk: RawChunk; at: Cell; label?: Text }): void`
- `wayBack(here: RawChunk['map'], at: Cell, back: { chunk: RawChunk; at: Cell; label?: Text }, chars: Record<string, string>): void`
- `contents(holder: string, mapId: string, items: { type: string; count: number }[], taken: Set<string>): Entity[]`
- `setDown(ch: RawChunk, type: string, at: Cell, taken: Set<string>, extra?: Partial<Entity>): Entity`
- `chest(ch: RawChunk, type: string, at: Cell, items: { type: string; count: number }[], taken: Set<string>): string` (returns the chest's id)
- `sign(ch: RawChunk, type: string, at: Cell, text: Text, taken: Set<string>): string` (returns the sign's id)
- `personId(name: string, taken: Set<string>): string`
- `interface PersonSpec { id: string; name: Text; type: string; at: { map: string; x: number; y: number }; line?: Text }`
- `person(o: PersonSpec): PersonFile`
- `merchant(o: PersonSpec & { stock: { type: string; count: number }[]; purse: number; coin?: string }): PersonFile` (the file also has `tags`, `props`, and `_items`)
- `type Favour = { kind: 'bring'; what: string; count: number } | { kind: 'talk'; to: string; toName: Text } | { kind: 'defeat'; what: string; count: number }`
- `interface FavourSpec { id: string; title: Text; giver: string; favour: Favour; ask: Text; waiting?: Text; thanks: Text; reward: { xp?: number; items?: { type: string; count: number }[] } }`
- `favourQuest(o: FavourSpec): QuestDef`
- `questId(title: string, taken: Set<string>): string`
- `ownKindId(e: Entity, types: Record<string, unknown>): string`
- `ownKindRule(type: string, name: Text): Rule`

In `packages/editor/src/app/usage.ts`:

- `factUses(files: { file: string; data: unknown }[]): Map<string, Use[]>`. The map key is the fact key.
- `usesOf(files: { file: string; data: unknown }[], id: string, isType?: boolean): Use[]`. With `isType` true, kinds under the id count too.
- `modeOf(file: string): string`, the editor mode that edits a file.
- `interface Use { file: string; at?: string; path: string; how: 'set' | 'read' | 'names' }`

In `packages/editor/src/app/mapEdit.ts`:

- `idsOf(chunks: RawChunk[], extra?: string[]): Set<string>`, the set of ids already in use on the given maps, plus any extra ids.

In `packages/editor/src/app/store.ts`:

- `Store.batch(label: string, fn: () => void): void`: edits made inside `fn` are one undo step labelled `label`.
- `Store.next(): { undo?: string; redo?: string }`: the labels of the next undo and redo steps.

In `packages/editor/src/app/ontologyFiles.ts`:

- `setEntry(...)` for adding a type to the ontology, used as `setEntry(store, 'types', { id, name }, label)`.

In the engine's `TypeDef`:

- `own?: string`, the id of the one thing whose own kind this type is.

In `packages/editor/src/app/context.ts` (the `Ctx` interface):

- `playtest(at?: { map: string; x: number; y: number }, o?: { scene?: string }): Promise<void>`
- `pick(why: string, map?: string): Promise<{ map: string; x: number; y: number } | undefined>`

A new `FindMode` (id `find`) in `packages/editor/src/app/findMode.ts`.
