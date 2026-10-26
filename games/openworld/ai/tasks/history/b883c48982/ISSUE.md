# Move the world's facts, topics, scene, weather, memories and named areas onto things; entering a region becomes contact

## What is wrong (for a fix) or What is wanted (for a feature)

The saved game state still holds data beside the things it belongs to: a table of world facts, a list of topics, the running scene, the weather spans, and a table of NPC memories. A map's named areas (e.g. the Ford's far bank) are plain rectangles in map data, so whether someone stands in one is checked by polling coordinates. The state should be just things and the clock (world-model.md §3, §5.4):

- **Facts are the story's props.** Rules read them through a prop condition on the story or the world. The `setFact`/`addFact` effects and the `fact` condition go away from the rule language. Old rules and patches that use them are rewritten when loaded into the rule library.
- **Topics** are props of the story (`topic.<id>` holds the day raised, `topic.<id>.days` the duration).
- **A person's memory** is their own (`npc.memory`), not a table on the state.
- **The scene** is the story's script, not a field on the state.
- **Weather spans** are authored content loaded with the world on every start, never saved.
- **`visited.<map>`** is a prop of whoever went there.
- **The invariant detector** keeps its own record of what it has reported; this is no longer a fact (`invalid.*`).
- **A map's named areas** become things of type `region` (id derived from map and name, placed as an area), created when the map's data arrives. Standing in one is the relation `in-region` (and `encloses` from the region's side), so entering and leaving are contact events.
- **A scene tied to a region** begins when the player enters that region (or is standing in it as another scene ends) — by event, not by periodic poll. Companion beats read region things.
- **Older saves** are upgraded on load: facts, topics, memories, scene, weather and reported invariants move to their new homes. The Firstlight migration must keep Tobin's memory.

## Expected behaviour

- On a fresh Ford, `regionId('ford', 'far_bank')` names a thing of type `region`. Teleporting the player onto the far landing, at a tick that is not a poll tick, produces `contact/begin` with `how: 'in-region'` hosted by the player (other = that region), and `contact/begin` with `how: 'encloses'` hosted by the region. After one tick, the scene `far_bank` is running.
- `world.scene` reads/writes the running scene (replacing `state.scene`); `world.weather` reads/writes the weather spans (replacing `state.weather`). Assigning `world.weather = [{day, weather}]` changes the weather the calendar reports.
- A topic raised by the story is fresh for its number of days: `world.topicFresh(id)` is true while fresh and false when never raised or expired. The default duration stays 4 days.
- A person's memory is read and written at `entity.npc.memory`. Lines the story has a person say on another's outcome must not alter that person's memory; only their own outcome records it.
- Condition `{prop: {role: 'story' | 'world', key, cmp, default?}}` reads the story's/world's props; when the prop is missing, `default` is used. A world event's patch that sets a protected key on the story is still rejected; a person's own rule writing a prop with the same name is not (it writes the person).
- Invariants are reported once each, tracked in a state field `reported` (list of invariant ids), not as a fact.
- A saved state of a played Ford (600 ticks) contains only these top-level keys: `tick, seed, rng, counter, player, spawn, entities, maps, tiles, loadedMaps, question, dormant, relations, reported`. The story and world things exist (`story` is placed `{on: 'resident'}`) and at least one `region` thing is placed `{on: 'area'}`.
- Loading an old save that has `facts`, `topics`, `memory`, `scene`, `weather` on its state moves them as described and removes the old fields; `visited.*` facts go to the player, `invalid.*` facts go to `reported`.
- `PROTECTED_FACTS` no longer lists `invalid.`.

## Requirements

- Remove `setFact`/`addFact` as effect ops and the `fact` condition; content (bosses, ford, quest rules, companion beats, scenes) uses `setProp`/`addProp` on the story and the `prop` condition with `role: 'story'` and `default: 0`.
- Rules in the old form are rewritten in place when added to a rule library.
- `World.fact`/`setFact` remain as the story's-prop accessors, still only writable inside an outcome.
- The validator accepts `story`/`world` as prop-condition roles and applies the protected-fact check to `setProp`/`addProp` only for resident (story/world) hosts.
- Region things are created on map load (chunk load or `loadMapData`) and for maps already in play from an older save, where those standing in them are in them from the start without an event.
- Region-scene triggers fire on the next tick after the player enters; no poll is needed. If a scene ends while the player stands in a region, that region's scene is checked.
- Companion beat region conditions use region things rather than rectangle checks.
- The Firstlight migration preserves Tobin's memory when replacing his npc data.
- The mod specification text describes the new `prop` condition, drops `fact`, and documents `in-region`/`encloses`.
- The ontology gains the `region` type.

## Interface

- `regionId(map: string, name: string): Id` — exported from the engine package (`world.ts`); the id of a map's named area thing.
- `World.scene` — getter/setter for the running scene (`SceneState | undefined`), replacing `state.scene`.
- `World.weather` — getter/setter for the weather spans, replacing `state.weather`.
- `World.topicFresh(id: string, day?: number): boolean` — whether a topic is still fresh.
- `Engine.ensureRegions(map: string): void` — makes the region things for a map's named areas.
- `WorldState.reported?: string[]` — invariant ids already reported.
- `NpcMemory` stored at `Entity.npc.memory`.
- Entity type `'region'` with place `{on: 'area', map, rects}`.
- Contact `how` values `'in-region'` and `'encloses'`.
- `{prop: {role: Reader, key, cmp?, bounds?, default?}}` where `Reader` is a role name or `'story'`/`'world'`.
- `TOPIC_DAYS` exported from `world.ts`.
- `factsOnTheStory(rule: Rule): Rule` — exported from `rules.ts`; rewrites old fact conditions/effects in place.
