# Surfaces, container capacities and the "put" rules: nothing put down should be lost

## What is wrong (for a fix) or What is wanted (for a feature)

Many "put" interactions have no defined answer. Putting a held item on a table, in water, in lava, against a wall, or into a full container either does nothing meaningful or leaves the item in an undefined state. Taking from a fixture like a table has no answer either. Locking a container with a key is also not possible.

The content should be extended so that:

- Tables, counters, market stalls, benches, altars and anvils count as **surfaces**, and an item can be set on them and later taken back.
- Each container type has a **capacity**, and a container that is full refuses more items.
- Putting an item on water, lava or solid ground has a defined answer, and the item is never silently lost (apart from flammable items deliberately burned in lava).
- Fixtures cannot be picked up.
- A key can lock a closed container, as well as unlock it.
- The rule language gains a way to express "how many things are in/on X", so a rule can compare a container's contents with its capacity.
- The interaction coverage tooling knows about the new generic answers, and exposes what a lost-item sweep needs. Undefined interactions should drop from about 70.4% to about 60.6%.

## Expected behaviour

**Surfaces**
- With an item in hand, facing a table, counter, stall, bench, altar or anvil, "put" is answered by the rule `core/put-on-surface`. The item leaves the hand and lies on the surface's tile.
- "Take" there then picks the item back up (`core/take-item`).
- If several items lie there, the top (most recent) item is taken first. When nothing is left to take, taking from the surface is answered by `core/take-fixed` ("That stays where it is.").
- Taking a fixture in general (nothing else claiming the case) is answered by `core/take-fixed`; containers still answer for themselves.

**Containers**
- Capacities: chest 12, barrel 4, crate 6, clay pot 2, wardrobe 12, shelf 8, bookshelf 8, sack 4.
- Putting into an open container that already holds its capacity is answered by `core/store-full` ("It is full."); the item stays in hand. An open container below capacity still uses `core/store`.
- Any specific item can still be chosen and taken from a full chest of twelve.
- A closed container exposes no contents to the player; an open one does.
- With a key in hand, interacting with a closed, unlocked container is answered by `core/lock`, which adds the `locked` tag. Interacting again with the key is answered by `core/unlock`, which opens it.

**Ground**
- Putting something in water: `core/put-in-water` ("It would sink."), item stays in hand. Filling an empty bucket from water must still be answered by `core/fill-water`.
- Putting something flammable in lava: `core/put-in-lava`; the item is destroyed, with a fire effect and a log message.
- Putting a non-flammable item in lava, or anything against a wall or other solid ground: `core/put-blocked` ("There is no room there."), item stays in hand. This is the last word and must lose to any more specific answer.

**Count condition**
- A rule guard can include a `count` condition naming a role, a place to count (`tile` or `contents`), and a comparison. For `tile` it counts what lies on the role's tile, excluding the role itself. For `contents` it counts what the role contains.
- The comparison accepts numeric bounds such as `gte`, and also accepts a reference to another value, i.e. a property of a role (e.g. the target's `capacity`).
- The condition is checked by patch validation like other conditions: a valid rule passes, and an unknown comparison key is rejected with an error mentioning `count.cmp.<key>` (e.g. `count.cmp.most`).

**No loss sweep**
- For every form held and put against every target type (except a person, who receives gifts, and the player themself), either the item remains in hand, or it is consumed by design (a rule that destroys the held item), or it can be taken back afterwards.

## Requirements

- Table, counter, stall, bench, altar and anvil carry the `surface` tag; chest, barrel, crate, pot, wardrobe, shelf, bookshelf and sack carry a numeric `capacity` property with the values above.
- New rules exist with the ids: `core/take-fixed`, `core/put-on-surface`, `core/put-in-water`, `core/put-in-lava`, `core/put-blocked`, `core/store-full`, `core/lock`.
- Rule precedence is such that: surface placement beats the generic put-down; store-full beats the ordinary store; filling a vessel from water beats put-in-water; specific lava and water answers beat put-blocked; put-blocked is the lowest priority.
- Existing behaviour for unlocking, opening, storing in closed containers etc. remains.
- The new generic rules are classified in the coverage tool's generic-rule table as: put-on-surface → "set down", put-in-water → "no room", put-blocked → "no room", store-full → "store", take-fixed → "nothing to take".
- The `count` condition is supported by rule evaluation and by validation, including referencing a property of a role as the comparison bound.
- The coverage baseline reflects the improved undefined-interaction rate (~60.6%).

## Interface

In `packages/tools/src/coverage.ts`:
- `ORIGIN`: exported constant `{ x: number; y: number }` — the player's position in the swept scenario (currently `{ x: 1, y: 2 }`).
- `FRONT`: exported constant `{ x: number; y: number }` — the tile the player faces (currently `{ x: 1, y: 1 }`).
- `targets(onto: Ontology)`: must be exported from this module (used by tests); each target has an `id` and a `scenario(sc: Scenario)` method that populates the scenario with the target in front of the player. Targets with ids `person` and `self` exist.
- `GENERIC_RULES` gains the entries listed above.

In the rule language (engine package):
- Guard condition `count: { role: <role name>; in: 'tile' | 'contents'; cmp: { gte?, ...numeric comparisons; or a value reference of the form { prop: string; of: <role> } } }`.
- Engine methods used by tests (`playerVerb(verb, flag?, itemId?)`, `facingContainer()`, `hold(actorId)`) are assumed to exist; if any are missing they must be provided with these signatures.

New rule ids (in `packages/content/src/rules.ts`): `core/take-fixed`, `core/put-on-surface`, `core/put-in-water`, `core/put-in-lava`, `core/put-blocked`, `core/store-full`, `core/lock`.
