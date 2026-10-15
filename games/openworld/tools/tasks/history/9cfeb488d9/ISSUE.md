# Learned things: crafting, forgetting, keeping, redrawing; the modder asked until it answers; lines about the player agree with "you"

## What is wanted

Play-testing the things the world learns from the modder (AI-made types, their recipes, statuses) found that the client handles them badly. Add the missing behaviour, in a new client module for learned things and a retrying helper for the modder connection.

1. **Recipes of learned things.** A type a patch brings that has a station and a makeup is crafted like the content's own recipes. The client needs to list these recipes and look any recipe up by id, whether it is the content's or a learned one.
2. **Forgetting.** When the shared library rolls a learned type or status back, the client forgets it too, unless something in this world still needs it.
3. **Replacing a definition.** A synced patch can bring a type or status this client already learned differently. The client takes the new definition, and the old one can be put back if the patch is then refused.
4. **Saves keep what they need.** The shared library is common to all saves, so another game's sync may have forgotten a kind that this save's things are of. That save must get it back from its own library copy, without writing it back to the shared store.
5. **Pictures.** A learned thing's picture is sent to the main thread once, and sent again when a new definition redraws it.
6. **Loading.** A learned kind or status that today's checks no longer accept (one an older client kept) is forgotten on load, unless something needs it.
7. **The modder connection** is asked again until it answers, with growing waits, instead of once.
8. **Lines about the player.** A line is written about anyone, and a name slot reads "you" when it is the player. The words after it must agree: "…{actor} comes up clean" must not read "you comes".

## Expected behaviour

### Learned recipes
- Before any patch, `learnedRecipes(engine)` is `[]`. After a patch brings type `item/material/twine` with station `hands` and makeup 2× `item/material/grass`, it returns that one recipe, with id `item/material/twine` and needs `[{type:'item/material/grass',count:2}]`.
- A learned type with no station has no recipe.
- `recipeById(engine, id)` finds a learned recipe by id. It also finds a content recipe such as `fixture/craft/workbench` when the engine is `undefined`. An unknown id gives `undefined`.

### Forgetting a type
- `forgetType(engine, id)` returns `true` and removes the type from the library and the ontology, along with its recipe, when nothing needs it.
- It returns `false` and changes nothing when the type is not learned here.
- It also returns `false` when it is still wanted:
  - an entity is of that type or of a kind of it (a type under `id/`);
  - another learned type is a kind of it;
  - another learned type names it in its makeup, its stage `into` or `yields`, or a string prop that is a type id (for example `cookedType`).

### Forgetting a status
- `forgetStatus(engine, id)` returns `true` and removes it from the library and the ontology.
- It returns `false` if the status is unknown or if any entity currently has it.

### Taking a synced definition
`takeDefinitions(engine, patch)` runs before the patch is submitted. It returns `{ replaced, restore, done }`.
- **Same id, different definition.** If the patch's type or status has the same id as a learned one but a different definition, the old one is removed and its id appears in `replaced`. Its recipe is removed too, and the new definition makes it again if it has a station. Submitting the patch then succeeds, and things already made of the old type become the new kind.
- **No change.** If the definition is identical, or the id is not learned, `replaced` is `[]`.
- **Same name, new id.** Suppose a learned type has the same name as one the patch brings under another id (a corrected "Berry Jam" under a new id, with the old one kept for what is made of it). The old one steps aside while the patch is judged, so the name clash does not refuse the patch.
- **`done()`**, called after the patch is taken, puts back only the stepped-aside types something here is still made of, and returns their ids. With nothing made of them they stay forgotten.
- **`restore()`**, called when the patch is refused, puts every replaced and stepped-aside definition back, with recipes.

### Saves keep what their things need
`withKept(shared, save)` returns `{ library, kept: { types, statuses } }` (id arrays).
- **What it adds.** To the shared library it adds, from the save's own library:
  - types the save's entities are of, or are kinds of, that the shared library lacks;
  - the types those name, followed transitively (makeup, stage, yields, string props that are type ids);
  - statuses some entity of the save has that the shared library lacks.
- **`kept`.** It lists exactly what was added.
- **Nothing to add.** `library` is the same `shared` object, and `kept` is empty.
- **No shared library.** If `shared` is undefined, `library` is the save's own library.

`sharedPart(library, kept)` takes `kept` as `{types: Set, statuses: Set}` and returns the library without those types and statuses. With nothing kept it returns the library itself.

`shareKept(kept, patch)` is called when an answer is taken. Every type or status the patch brings that is in the kept sets is removed from them, because it is the library's again. It returns a function that puts them back if the answer is refused.

### Pictures
`artsToSend(types, sent)` returns `{id, art}` for each type with art that has not been sent in its current form, and records it in `sent`.
- A first call returns the type.
- A repeat call with the same art returns `[]`.
- Changed art is returned again.
- Types without art are skipped.

### Forgetting on load
`forgetInvalid(engine, kept = new Set())` returns the ids it forgot.
- **What it judges.** Each learned type is judged by the type checks against the world and the rest of what was learned, with its own learned rules counted as part of the patch. Each learned status is judged by the status checks. A failing one is forgotten with `forgetType` / `forgetStatus`, so anything that still needs it is kept.
- **Examples that go.**
  - A jam with `food` but no edible tag.
  - A status that immobilizes but never ends.
- **Learned rules.** A learned rule whose effects make a forgotten kind is removed too, and its id is reported. The effects that count are: spawn, transform into, a dropped bundle, and the default of an open leaf, including inside if/then/else trees.
- **Dependencies.** A kind that a kept thing names (for example a `cookedType` of a raw food in the bag) stays, even if it fails the checks on its own.
- **Name clashes.** When two learned types clash by name, the later one counts as the other name. The order is the order first learned, and ids in `kept` come last so the library's corrected kind wins. The old, kept kind is therefore not judged a duplicate and is not forgotten.

### Asking until up
`untilUp(attempt, ms, max = ms)` returns `{ stop }`.
- **First try.** It calls `attempt` immediately.
- **Retries.** While `attempt` resolves `false` it retries after `ms`, then twice as long each time, capped at `max`. With 5000 and 20000 the try times are 0, 5000, 15000, 35000, 55000, 75000.
- **Success.** When `attempt` resolves `true` it makes no more tries.
- **Stopping.** `stop()` cancels tries still to come.
- **Liveness.** `attempt` receives `live()`, which is `true` until `stop()` and `false` afterwards. A probe under way when the connection is replaced can tell it was called off.
- **Wiring.** Use this for the modder connection in the worker.

### Agreeing with "you"
`agreeYou(text)` rewrites text in which the player's name slot appears as the marker `\u0001you\u0002`.

| Input | Output |
|---|---|
| marker + verb | the plural verb ("comes" → "come", "is" → "are", "carries" → "carry", "goes" → "go") |
| marker + `'s` or `’s` | "Your" at sentence start, "your" otherwise |
| marker at sentence start (including after an opening quote) | "You" |
| marker elsewhere | "you" |

- **Irregular verbs.** "dies" → "die", "lies" → "lie", "freezes" → "freeze", "dozes" → "doze", "aches" → "ache", and -oes verbs ("tiptoes" → "tiptoe", "vetoes" → "veto", "echoes" → "echo").
- **Negatives.** "doesn't" → "don't", "isn't" → "aren't", "wasn't" → "weren't", "hasn't" → "haven't" (curly apostrophes too).
- **A "you" that is not the subject.** The following word is not touched. "He hands you this map, gives you his word", "Beside you lies a stone" and "mends you." keep their words.
- **No marker.** The text is unchanged ("The slime comes closer.").
- **Only the first verb.** Only the verb right after the marker is changed.
- **Where it applies.** Lines the engine renders about the player should go through it, so such lines read correctly in play.

## Requirements

- All of the above holds for the functions named in the Interface.
- A learned recipe must reach the crafting panel and the build palette: the worker sends the recipes to the main thread when they change, and the panel lists them after the content's.
- Learned pictures are repainted in place when redrawn, and panels showing them refresh.
- Learned statuses are named in tooltips; one with no name is shown as readable words ("well_honeyed" → "Well honeyed").
- Forgetting must never remove a type or status something in the world still uses.
- Definitions kept only for one save must not be written back to the shared library.
- The new type checks name what a type's tags are for, so the validator is stricter for learned types. `food` is required for edible things, and the table of tags `cropType`, `cookedType`, `waterType`, `smelts`, `emptyType` each need the right tag on the type they name.
- A crafted fixture must be `portable`; the recipe builder that makes stations adds the tag.
- A status that immobilizes must still end.
- A thing that cannot be carried is never left in a hand.
- The death screen names the harm that felled the player, not an older blow.
- Cells that were asked about are released from frozen.
- Firstlight's garden plots and supplies crate are not hidden under tree canopies.
- The existing suite stays green.

## Interface

New file `packages/client/src/learned.ts`, exporting:
- `learnedRecipes(eng: Engine): Recipe[]`
- `recipeById(eng: Engine | undefined, id: string): Recipe | undefined`
- `forgetType(eng: Engine, id: string): boolean`
- `forgetStatus(eng: Engine, id: string): boolean`
- `takeDefinitions(eng: Engine, patch: Patch): { replaced: string[]; restore: () => void; done: () => string[] }`
- `withKept(shared: LibraryData | undefined, save: SaveData | undefined): { library: LibraryData | undefined; kept: { types: string[]; statuses: string[] } }`
- `sharedPart(lib: LibraryData, kept: { types: Set<string>; statuses: Set<string> }): LibraryData`
- `shareKept(kept: { types: Set<string>; statuses: Set<string> }, patch: Patch): () => void`
- `artsToSend(types: TypeDef[], sent: Map<string, string>): { id: string; art: NonNullable<TypeDef['art']> }[]`
- `forgetInvalid(eng: Engine, kept?: Set<string>): string[]`

New file `packages/client/src/untilUp.ts`:
- `untilUp(attempt: (live: () => boolean) => Promise<boolean>, ms: number, max?: number): { stop: () => void }`

Exported from `@lsw/engine`:
- `agreeYou(text: string): string`

The type, status and name-clash checks that `learned.ts` relies on come from `@lsw/engine`: `newTypeProblems`, `newStatusProblems`, `namesClash`, `deriveRecipes`. If any of them is not yet exported, export it with a signature that fits that use. Also add the worker-to-main message `{ t: 'recipes'; recipes: Recipe[] }`; the `library` message gains `statuses: StatusDef[]`.
