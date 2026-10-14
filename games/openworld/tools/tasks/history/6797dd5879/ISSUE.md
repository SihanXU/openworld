# Editor: database, rules, story and quests modes (P5)

## What is wanted

The editor can place things on maps and edit people, but a game's *content* still has to be written as TypeScript or hand-edited JSON. P5 adds the authoring surfaces that let someone make a game like the starter without writing TypeScript. In a new project a person should be able to define a type, write a rule for it (checked as it is typed, with a "which rule answers here" query that names the rule), set the thing down on a map, add a scene and a quest, then save and compile with no error.

Four new editor modes are wanted, plus the pieces they share.

1. **Database mode** covers the type tree, statuses, terrains and recipes.
   - Types: each type inherits its parent's tags and props, and the editor shows how the world sees the type once inherited. It also lists the rules on the type and offers fields plus a JSON view for editing.
   - Statuses and terrains are edited the same way. A terrain also has the map character a map writes it by.
   - Recipes are read-only. They are what the types' makeup and station give, and are changed in the type.
2. **Rules mode**
   - It lists rules by project file and by the standard library's.
   - It shows a rule's tree in words beside its JSON, and checks the rule as it is typed. The check covers the patch validator's checks that hold for base rules, and the ties with every other rule.
   - It answers "which rule answers here?": given who does what to what with what in hand, it says which rule decides, where in its tree, and whether that is a hole.
   - It has a sandbox that replays a scenario and reports the chain of rules reached, what was said, and what changed.
   - It shows the game's ModSpec as reference.
3. **Story mode** edits the story's steps and their scene commands, and the story's invariants and protected facts.
4. **Quests mode** edits quest lines, start, aliases, objectives and stages. It also lets the author write a new favour from a person.

The editor shell must let a mode draw in the middle of the window instead of the map canvas, because rules, story and quests need the space.

Ontology entries (types, statuses, terrains) must be written where the project already writes them. An entry that exists only in the standard library is overridden by writing the project's own entry in the project's file. Removing the project's entry brings the library's back.

Also update `docs/engine-split.md` section 12 to record P5 as built, and update `CLAUDE.md` to match.

## Expected behaviour

**Ontology entries, written where the project writes them**

- Asking which project file writes a given type, status or terrain returns that file's path. For the starter, `item/tool/axe` is in `ontology/types.json`. It returns nothing for an entry only the standard library has (for example the status `wet` in the starter).
- Setting an existing entry replaces its whole definition in its file. After renaming `item/tool/axe`, the compiled ontology shows the new name.
- Setting a new entry puts it in the first project ontology file that already has that section. If no file has the section, it goes in `ontology/<section>.json`, and that file is created if absent. A file may hold the section as either a list of entries or a record keyed by id, and both forms are supported when reading, replacing, adding and removing.
- Setting an entry that only the library has writes the project's own in the project's file. The compiled ontology then uses the project's definition. For example, giving `wet` a duration of 100 makes the compiled duration 100.
- Removing a project entry deletes it from its file. If the library also defines it, the library's definition is back in the compiled ontology. After removing the project's `wet`, the duration is the library's 400. Removing an entry no project file writes does nothing.

**A rule's tree in words**

The outline of a rule tree, with markup and `&nbsp;` stripped, reads as follows.
- A conditional branch appears as `IF` followed by the condition as compact JSON, for example `IF {"same":["actor","target"]}`. Its then-branch and else-branch follow, indented. A missing else is shown as "else: nothing".
- A leaf of effects appears as `DO`, then its label in curly quotes if it has one, then each effect by its op name followed by its remaining fields as JSON. For example `DO “Eat” log` and so on. Effects are separated by `; `, and an empty leaf says "nothing".
- An undefined leaf appears as `UNDEFINED — the AI answers`, followed by `; meanwhile ` and its default effects if there are any. For example `UNDEFINED — the AI answers; meanwhile destroy`.
- The `inherit` leaf says that the next rule up answers.

## Requirements

- The shell lets a mode supply a middle panel. While such a mode is active, the map canvas is hidden but keeps its place, and it returns when a mode without a middle panel is active.
- The four modes appear in the editor's mode list alongside the existing ones.
- The ontology-file helpers and the outline function behave exactly as in "Expected behaviour".
- Edits to types, statuses, terrains, rules, steps and quests go through the project store, so they are undoable and saved with the project, and the compiled result updates.
- A new rule or a rule being edited is checked live. Invalid JSON is reported. Otherwise the check runs the validator's base-rule checks and the ties against the project's other rules, and reports the problems, or says there are none.
- Ids typed for new entries are validated (types and terrains by lowercase words with `/` for types' paths, rules, steps), and duplicates are refused with a message.
- A terrain's map character is one character and cannot be one already taken by another terrain.
- A library entry (type, status, terrain or rule) can't be removed. Changing it writes the project's own override.
- The docs and `CLAUDE.md` describe P5 as built.

## Interface

In `packages/editor/src/app/ontologyFiles.ts` (new file):

- `type Section = 'types' | 'statuses' | 'terrains'`
- `entryFile(store: Store, section: Section, id: string): string | undefined`
  - the project ontology file that writes the entry, if any.
- `setEntry(store: Store, section: Section, def: { id: string }, why: string): void`
  - writes the whole definition where the entry is written, else in the section's home file, creating the file if needed.
- `removeEntry(store: Store, section: Section, id: string, why: string): void`
  - removes the project's entry. It does nothing when no project file has it.

In `packages/editor/src/app/rulesMode.ts` (new file):

- `outline(t: Tree, depth?: number): string`
  - HTML for a rule tree in words, indented by `depth`. `Tree` is the engine's rule tree type.
- `class RulesMode implements Mode`, with id `'rules'` and label `'Rules'`.

Other new files, in `packages/editor/src/app/`:

- `databaseMode.ts`: `class DatabaseMode implements Mode`, with id `'database'`.
- `storyMode.ts`: `class StoryMode implements Mode` and `class QuestsMode implements Mode`.

Changes to existing files:

- `Mode` in `context.ts` gains an optional `main?(ctx: Ctx, el: HTMLElement): void`, which draws in the middle of the window.
- `MODES` in `modes.ts` lists the four new modes.
