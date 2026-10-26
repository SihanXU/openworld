# One goal system for every actor, real work for the woodcutter, and people walking in the way they come

## What is wrong (for a fix) / What is wanted (for a feature)

Right now each kind of non-player actor has its own separate per-tick controller. Creatures have one, bosses have one, people (NPCs) have one, and companions have one. They are invoked independently by the engine tick, so there is no single place that decides what an actor does this turn, and no way for a type or a world to say in what order an actor's concerns come.

Wanted: a single behaviour system for every actor except the one at the keys (the player). Each actor has an ordered list of goals. On its turn the first goal that applies takes the turn. The existing controllers become goals within that system, and everyone not mentioned below behaves as before.

In addition, two behaviours of people need to be real:

1. **Real work.** A person's schedule entry can say they do work: the player's own acts, performed on the nearest thing that fits. The motivating case is Gus the woodcutter. In the forest clearing in the morning he should fell trees with his own iron axe using the same act the player would use, gather the logs that result (carrying at most six), and later stack them on a new wood pile in the village.
2. **Arriving the way one would come.** A person whose schedule takes them to the active map should appear at the edge or portal of the last map on their route (not at the anchor, and not at the portal of the map they happen to be on). For Gus, coming from the forest to the village, that is the village's south edge.

Also needed:
- A new fixture, the wood pile: a wooden container into which the woodcutter stacks logs and from which anyone may take them.
- A people definition can carry items and tags, so Gus can be given his axe, and the world builder can place items from such a definition.
- The world check that stands in the village should count the people who are on, or bound for, the active map.

## Expected behaviour

**Goal order**
- Goal ids: `encounter`, `threat`, `follow`, `schedule`, `home`, `idle`.
- Default order is that sequence. A type may specify its own `goals` order; failing that, the world may; failing that, the default applies.
- The first goal that applies takes the turn, and later ones do not run that tick.
- `threat`, `schedule`, `home`, and `idle` are paced: they wait for the actor's step cooldown to be ready and for it not to be busy. `encounter` and `follow` are not paced.
- During a scene, people on stage (NPCs) do not take paced goals; the script owns them.
- A companion follows its leader wherever the leader goes, including onto other maps, as before.

**Goals, equivalent to the old controllers**
- `encounter`: a boss/sin's telegraph, approach, and release behaviour, exactly as the old boss stepping. It applies (takes the turn) only for a boss with a kit; a boss never falls through to threat, home, or idle.
- `threat`: for a creature with an AI, fight the nearest actor it is hostile to in sight (or, if passive, flee); for a person, flee from what would attack them. It applies only if there is such a thing.
- `follow`: applies for an actor that has a leader.
- `schedule`: a person heads to where their schedule says, as before.
- `home`: an actor with AI that is farther than 4 tiles from home (by day its home, after dark where it roams) heads back.
- `idle`: otherwise a step now and then.

**Work**
- A schedule entry may carry a list of work items. Each names a verb, a target selector, optionally a required held/carried tool selector, a radius around the anchor, and optionally a condition.
- A person at an anchor with work picks the first item whose tool they carry (held or in contents), whose condition holds, and which has a matching target within the radius of the anchor, taking the nearest one. They walk to be beside the target, face it, and do the verb as an ordinary act with the tool as instrument. Work is spaced by a cooldown between acts.
- They keep the target while it still fits. Work that cannot be reached is let go rather than counted as a blocked day.
- Gus, mornings in the forest clearing: fells trees with his axe (stump where it stood, growing back), gathers the logs, up to six. At noon he comes into the village by its south edge and stacks them on the village wood pile (`village.woodpile`), where they are held for anyone to take.

**Arriving**
- A person bound for the active map arrives at the target of the portal (or edge) of the last map on the route into the active map. If no such portal is found, they arrive at their schedule anchor. If the landing spot is not walkable, the nearest free spot is used.

**Check**
- The world check in the village reports the count of people on or bound for the active map (rather than everyone). Dormant maps remain frozen by design.

## Requirements

- A single behaviour system runs every actor except the player each tick, replacing the separate creature, boss, people and companion loops. All of those loops are removed from the engine tick.
- Goal order is resolved as type `goals` → world `goals` → default order; the ontology/type definitions and world data accept a `goals` list.
- The encounter goal can be driven directly for one actor on a map: given the engine, the entity, and the map id, it does that entity's boss turn for that tick and reports whether it took the turn (true) or not (false, e.g. a non-boss).
- Creature fight/home/idle, boss encounter, companion follow, and NPC flee/schedule are each callable as goals returning whether they applied.
- Other actors behave exactly as before: existing creature, boss, companion, and schedule tests must still pass.
- Schedule entries accept `work` (verb, target selector, holding selector, radius, when). A person performs the player's own act through the engine on the nearest fitting target.
- Gus carries an iron axe, fells trees in the forest clearing in the morning, gathers up to six logs, comes into the village at noon via its south edge, and stacks the logs on the wood pile.
- Add the `fixture/container/woodpile` type (wooden, flammable, solid container, capacity 12, drops two logs when broken) and place one in the village with id `village.woodpile`.
- People definitions accept `items` and `tags`; the builder supports placing an item from a definition (`itemOf`).
- The check:world report counts people on or bound for the active map.
- Companions' beat checks (the tutorial) still run on their own schedule.

## Interface

- `packages/engine/src/behaviour.ts` (new, exported from the engine's index):
  - `type GoalId = 'encounter' | 'threat' | 'follow' | 'schedule' | 'home' | 'idle'`
  - `const GOALS: GoalId[]` — default order `['encounter','threat','follow','schedule','home','idle']`
  - `class Behaviour` with `constructor(eng: Engine)`, `goalsOf(e: Entity): GoalId[]`, `tick(active: string): void`
  - `Engine.behaviour: Behaviour`
- `packages/engine/src/bosses.ts`: `encounter(eng: Engine, e: Entity, active: string): boolean` (exported from `@lsw/engine`; replaces `stepBosses`).
- `packages/engine/src/creatures.ts`: `Scene` (`{ active: string; actors: Entity[]; night: boolean; fires?: Pos[] }`), `sceneOf(eng, active): Scene`, `fight(eng, e, sc): boolean`, `home(eng, e, sc): boolean`, `idle(eng, e, sc): boolean`. `stepCreatures` is removed.
- `packages/engine/src/companion.ts`: `Companions.follow(e: Entity): boolean`.
- `packages/engine/src/npc.ts`: `NpcSim.begin(active: string): void`, `NpcSim.flee(e: Entity, active: string): boolean`, `NpcSim.schedule(e: Entity, active: string): boolean`.
- Types: `WorkDef` (`verb`, `target` selector, `holding` selector, `radius: number`, `when` condition), and `ScheduleEntry.work?: WorkDef[]`. `TypeDef.goals?: string[]` and `ResolvedType.goals?: string[]`; the world data may carry `goals`. `PersonDef.items` and `PersonDef.tags`; builder helper `itemOf`.
- Content: type `fixture/container/woodpile`, and entity id `village.woodpile` in the village.
