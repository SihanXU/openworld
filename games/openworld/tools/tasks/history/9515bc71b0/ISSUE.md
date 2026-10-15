# Remove "kind" from the engine: ask a thing's data, never what kind it is

## What is wrong

Every thing in the world descends from one type tree, and the old "kinds" (actor, item, fixture, tile, resident) are just the roots of that tree. Yet the engine, the content, the modder and the client still carry a separate `kind` concept:

- Type definitions, resolved types, views, selectors and the entity snapshot all have a `kind` field.
- `World.kindOf(entity)` exists, and many places (about 30) branch on it to decide what a thing is and how it behaves.
- Rules and selectors name a kind (`{kind: 'actor'}`, `{kind: 'tile', ...}`).
- New types are required to declare a kind.

This duplicates what the type tree and a thing's own data already say, and it means behaviour depends on a label rather than on properties. The kind concept should be removed entirely, and everything that used it should ask the thing's data instead.

## What is wanted

Remove `kind` as a concept from the engine and everything built on it, and replace each use with a question about the thing's data:

- Whether a thing acts by itself and has a body: an **agent** (this is the `agent` tag, which the actor root carries).
- Whether a thing can be carried: **portable** (the `portable` tag, which the item root carries).
- Which stances a thing can be stood or set on: its **reach** (the fixture root's reach is the ground).
- Whether a thing has no place at all (the story, the world): **placeless**.
- Other behaviour that used the kind reads `sight`, `maxHp`, `level`, and so on; the actor root carries the default `level`.

Selectors that named a kind name the root type instead (`{kind: 'actor'}` becomes `{type: 'actor'}`, likewise for item, fixture, tile, resident).

## Expected behaviour

- The world answers `isAgent(e)`, `isPortable(e)` and `isPlaceless(e)` for an entity, and a test can classify a thing as "resident / actor / item / fixture" purely from these (placeless first, then agent, then portable, otherwise a fixture).
- `World.kindOf` no longer exists; `TypeDef`, `ResolvedType`, `View`, `Selector` and the entity snapshot have no `kind` field. A type definition is valid with just an id, name, tags, props and so on, plus an existing parent type.
- A selector `{type: 'actor'}` matches every actor, `{type: 'tile'}` every tile, `{type: 'item'}` every item, `{type: 'fixture'}` every fixture, as the kind selectors did before. A rule that combined a kind with a more specific type (e.g. `{kind: 'tile', type: 'tile/water'}`) is now just `{type: 'tile/water'}`.
- Rule resolution is unchanged: specificity counts a root type as one constraint and a deeper type as one level deeper, so every rule still wins or loses against the others exactly as before. The coverage numbers do not change.
- Rules entering a library (old saves, old patches) and the modder's drafts that still carry a `kind` in their selectors are upgraded in place to the equivalent type selector. The validator refuses a selector that still names a kind.
- Creating a new type needs only an existing parent type; that is checked along with the type's other problems rather than by a kind.
- The modder's brief, derived tests, signature, tools and prompts, the coverage tool and the client (rendering, HUD, minimap, dev console, patch template) read types and tags instead of kinds. For instance, the client decides "is this an actor" by the `agent` tag and "is this an item" by the `portable` tag.
- Bosses, items, people, fixtures and the residents are defined without a `kind`; the actor root is tagged `agent` and has a default `level`, and the fixture root has the ground reach.
- Periods and thresholds whose hosts were `{kind: 'actor', ...}` use `{type: 'actor', ...}`.

## Requirements

- No source in the engine, content, modder, tools or client branches on a kind of thing, calls `kindOf`, uses an `EntityKind` type, or writes a selector or type with `kind: 'actor' | 'item' | 'fixture' | 'tile' | 'resident'`. A scan of the sources finds none.
- `kind` is removed from `TypeDef`, `ResolvedType`, `View`, `Selector` and the snapshot types, and `World.kindOf` is removed.
- Every one of the former `kindOf` branches now asks data (`agent`, `portable`, reach, placeless, `sight`, `maxHp`, `level`, …) and behaves identically to before in every existing scenario.
- Selector specificity: a root type counts as one constraint; a deeper type counts one level deeper. Rule resolution and coverage figures remain as before.
- Old rules and patches that name a kind are rewritten in place into the equivalent type selector (via `selectByType`) when they enter a library or when a modder's draft is processed; the validator rejects a selector that names a kind.
- A type definition needs only an existing parent; this is reported with the type's other problems.
- The modder's normalisation of a bare terrain id (e.g. `bush`) in a host yields `{type: 'tile/bush'}` with no kind.
- The client, HUD, minimap, dev tools and patch template work from types and tags, with behaviour unchanged (a patch template's fallback host is `{type: 'fixture'}`).
- Existing tests continue to pass once adjusted to the new vocabulary, including those that built type definitions or rules with a kind.
- Documentation (`docs/world-model.md` §4.2 and §12, W1) reflects that there are no kinds.

## Interface

New methods on `World` (in the engine's world module), each taking an entity and returning a boolean:

- `isAgent(e: Entity): boolean` — true when the thing acts by itself with a body (carries the `agent` tag).
- `isPortable(e: Entity): boolean` — true when the thing can be carried (carries the `portable` tag).
- `isPlaceless(e: Entity): boolean` — true when the thing has no place in the world (the story, the world resident).

New helper:

- `selectByType` (in the engine, alongside the rule/selector handling) — upgrades a rule's selector(s) that name a kind into the equivalent type selector, in place. Its exact signature is left to the implementer, but it must be usable on a rule entering a library and on a modder's draft.

Removed names: `World.kindOf`, the `kind` field on `TypeDef`, `ResolvedType`, `View`, `Selector` and the entity snapshot, and the `EntityKind` type.
