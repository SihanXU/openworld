# The modder should design from the request, look things up in the catalogue, and create what the world lacks

## What is wrong (for a fix) or What is wanted (for a feature)

Today a live design is handed the world's whole type catalogue and guesses a type id when the outcome needs a thing. The catalogue grows with content and fills the prompt. The model also invents ids that do not exist, and the world has no way to learn a genuinely new thing (a material, a product) with a picture of its own.

The modder should answer a hole in layers:

1. **local**: the design sees only the request's own types, plus a directory of what lives beside each role's type (in the brief). It answers with a patch, or, if the outcome needs a thing it was not shown, with `{"need": [...]}` instead of guessing an id.
2. **find**: the harness shows the design the closest matches by name for each need, and the whole catalogue. The design answers with a patch using a type that exists, or with `{"create": [...]}` if the world has no such thing.
3. **create**: the design writes the new type beside its rule in the patch. Each new type then gets a 16x16 icon drawn by an artist call, expressed as data. A type whose icon cannot be drawn is still created and shows its parent's picture.

The engine, the modder service and the client all need to support this. The engine must be able to carry a type's picture and hold new types to the world's conventions. The modder must report where a request is and run designs one at a time. The client must wait for a creation, tell the player, and draw learned things.

## Expected behaviour

**Router paths (live profile, no tools)**
- Nothing beyond the request is needed: the design is answered in one call. The design's system prompt carries no type catalogue (its ontology types list is empty) and says there are things beyond the request that it can ask for. The user turn's brief contains a section "The directories of this request (beside each role's type)". For a host of type `actor/creature/slime/green_slime`, a line reads like `- actor/creature/slime/ (green_slime here): green_slime, fire_slime`. The episode's route is `['local']`.
- The design answers `{"need": [{name, why?}]}`. The next turn begins with `# What you asked for` and lists, per need, a line like `"stick" (what it leaves behind): closest by name: item/material/stick`, followed by the catalogue grouped by directory (e.g. `item/material/: …stick…`). If the design then answers with a patch using the existing type, nothing is created. The episode records `route: ['local','find']`, `needed: ['stick']`, `created: []`.
- The design answers `{"create": [{id, name:{en,zh}, why?}]}`. The next turn begins with `# Create`. The design then returns a patch with a `type` artifact beside its rule. The episode records `route: ['local','find','create']` and `created: ['item/material/iron_ingot']`. The route includes `find` even if the design went straight to `create`.
- Asking for more things after the catalogue was shown, or asking to create twice, is not accepted. The design is told to answer with the patch now, through the normal repair budget.
- After the patch validates, each new type without art gets its picture from an artist call (purpose `art`), with two tries. A valid result is stored on the type as `art` and its `sprite` is `art:<type id>`. If both tries are invalid, the type is still created, with no `art` and no `sprite`. The patch that is committed and published to every client carries the type artifact together with the rule.
- Clean created types use the same validation as any patch; a picture that fails validation must not fail the patch.

**Progress**
- `GET /progress?id=<request id>` returns `{stage, creating?}`, where stage is `queued`, `local`, `find`, `create` or `art`. During the artist call, the progress of that request is `{stage:'art', creating:[{en:'Iron Ingot', zh:'铁锭'}]}`. Once the request is finished, progress is undefined. `creating` holds the names of the types being made.
- Progress is tracked per class of request, and looked up through the request id.

**Concurrency**
- Designs run one at a time, live before offline. A request that waited its turn first checks whether what was committed meanwhile already answers it. Two live requests resolved at once never have two design calls running together.
- Reviews, reflections, late escalations and revisions run in the background, up to three at a time. Both limits are harness settings (`concurrency.design` default 1, `concurrency.background` default 3). `settled()` resolves when all background work and the work it started is done.

**Validator: new types**
A type artifact in a patch is checked. A violation is an error naming the type. The messages must contain:
- id already in the world: `exists already` (use it instead of defining it).
- Parent missing (ids with more than two segments, parent not in the world nor another type of the same patch): `parent "<parent>" does not exist`, followed by the closest known types.
- Id not lowercase snake_case segments under the kind (e.g. `item/material/IronIngot`): mentions `snake_case`.
- Name not given as `{en, zh}` with both non-empty (a plain string counts as missing): mentions `both languages`.
- Another name for something the world has (same last segment or same English name, case-insensitive): `"<existing id>" already is this thing`. E.g. a new `item/material/black_rock` named "Coal" gives `"item/material/coal" already is this thing`.
- If it carries art, the picture must be valid (see below).

**Validator: the picture**
A picture is `{grid, palette}`. It is invalid when:
- the grid is not 16 strings of 16 characters (message mentions `16 strings`);
- the palette has no colour or more than 8;
- a palette key is not one character, is `.`, or its value is not `#rrggbb` (message mentions `#rrggbb`);
- the grid uses characters not in the palette (`not in the palette`);
- it draws almost nothing, i.e. fewer than 20 non-transparent pixels (`almost nothing`).
`.` is transparent.

**Validator: unknown type ids**
An unknown type id in a selector, `spawn` or `transform` is answered with the closest known types, ranked by shared words in id or English name, e.g. `unknown type "item/material/iron" — the closest known types: …item/material/iron_ore…`. When no word is shared, there is no hint.

**ModPort.hold**
`hold(id)` keeps a pending request waiting past the time-out while the modder creates. It returns `true` for a pending request, after which the request stays pending and the things it froze stay frozen however many ticks pass. It returns `false` for an unknown or no-longer-pending request.

**Client**
- A request that waits polls `GET /progress` about once a second. When the stage is `create` or `art`, the client holds the act (if still pending) and shows the HUD message "The world is making something new: <names>" (Chinese: 世界正在创造新物体), once.
- Types with art become textures `art:<id>` (each sent once, at start and when the library changes), used for the map entities and for the bag icons.

## Requirements

- The type catalogue is left out of the design system prompt in the router case. The system prompt stays identical across clients and library versions.
- The brief lists, for each role's type (not tiles) whose parent has a sub-path, the directory of siblings.
- A `need` answer is honoured only in the local stage. A `create` answer is honoured once. Other repeats go through repair.
- Episodes record `route`, `needed` and `created`; attempts can be in phase `find` or `create`.
- The new-type checks are exported so other tools can use them, and run when a patch brings a type.
- Pictures are drawn only after the patch is valid, and a bad picture never blocks the patch.
- Background work respects the concurrency limit; design is serialised with live ahead of offline.
- Existing behaviour for non-router profiles (design with tools) is unchanged: they still see the catalogue.

## Interface

In `@lsw/engine` (types and mod modules):

- `interface PixelArt { grid: string[]; palette: Record<string, string> }` (types.ts)
- `TypeDef.art?: PixelArt`; `TypeDef.sprite` may be `art:<type id>`.
- `artProblems(art: PixelArt): string[]` — what is wrong with a 16x16 picture; empty when valid.
- `newTypeProblems(t: TypeDef, onto: Ontology, patch: Patch): string[]`
- `closestTypes(name: string, onto: Ontology, n?: number): string[]` — default n 6.
- `closest(id: string, onto: Ontology, n?: number): string` — default n 4; `""` or `" — the closest known types: a, b"`.
- `interface ModProgress { stage: 'queued' | 'local' | 'find' | 'create' | 'art'; creating?: Text[] }`
- `ModPort.hold(id: string): boolean`
- `buildModSpec(onto, lib?, opts?: { types?: boolean })` — `types: false` gives an empty ontology types list.

In `@lsw/agent`:

- `Attempt.phase` also accepts `'find' | 'create'`.
- `Episode.route?: ('local'|'find'|'create')[]`, `Episode.needed?: string[]`, `Episode.created?: string[]`.
- `Harness.concurrency?: { design: number; background: number }`; `DEFAULT_HARNESS.concurrency = { design: 1, background: 3 }`.

In the modder package:

- `Modder.progressOf(requestId: string): ModProgress | undefined`.
- Prompts (`prompts.ts`): `ART_SYSTEM`, `artUser`, `catalogueOf`, `createUser`, `findUser`, and types `Creation` (`{id, name:{en,zh}, why?}`) and `Need` (`{name, why?}`). `designSystem` takes a third `router` argument. The find turn starts `# What you asked for`; the create turn starts `# Create`.
- HTTP: `GET /progress?id=` on the modder service.

In the client:

- Worker messages `{ t: 'art'; arts: { id: string; art: PixelArt }[] }` and `{ t: 'creating'; names: Text[] }`.
- `registerArt(scene, id, art)` in `render/assets.ts`.
