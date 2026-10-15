# Judge by data, not by "is it the player": factions, temper, fire-fear, downed actors, and locking the actor while the world learns

## What is wrong

Much of the engine and content decides things by asking "is this the player?" rather than by looking at data any actor carries. As a result:

- Only the player can be attacked. Creatures have a boolean `hostile` flag that is set only when the player strikes them. People are never targets, and nobody but the player can be a foe.
- At no health the player is teleported to spawn, while everyone else is destroyed. People can't survive being hurt.
- Creatures wander and chase through fire freely, so a tended campfire gives a camp no protection. People never run from anything.
- Witnesses only react to the *player* acting on another's thing. Using something on oneself (eat, drink, examine) is keyed on "the target is the player". Story rules in the Ford are keyed on `player: true`. Mod-port freezing, "ask the modder" filters and the stepping-into-a-tile world event all assume the player.
- While the modder works out an undefined act, the one acting is not locked. They can walk away or start another act, and the client shows no sign that they are working.

## Expected behaviour

**Factions.** Actors belong to factions through `faction:<id>` tags, and the ontology declares factions, each with a list of factions it is hostile to. People are `folk` and creatures are `wild`; the wild is hostile to folk (the player is a person, so is included); folk are hostile to no one.

**Temper.** A creature's AI has a temper: `aggressive` (hostile whenever its faction says so), `nocturnal` (only after dark), or `wary` (never by faction). Whoever strikes an actor that has an AI becomes one of its foes, and a foe is always attacked, whatever the temper. A creature may have a leash (a distance from where it lives, with a sensible default) beyond which it stops chasing. By day it lives at its home, after dark at its night place if it has one. It attacks the nearest hostile actor it can see. Nobody attacks one who is down.

In the Ford, the frost slime is nocturnal and the fire slime is wary.

**Fire.** Creatures that are not fiery keep away from lit and burning things: they don't step within the fire radius of one, and don't chase anyone standing within it. A tended fire protects a camp. People who see something that would attack them nearby run from it, preferring the direction of a fire; one who cannot run (e.g. frozen stiff) takes the blow.

**Defeat.** At no health, essential actors (people, including the player) are not removed. They get a `down` status that lasts a while and immobilises them, and then come to with part of their health. Anything else is defeated and removed as before. The player no longer respawns at spawn. A downed actor takes no further damage.

**Witnesses.** Any actor acting on a thing owned by another is seen by people awake (and not busy) within sight of the doer. The witness event has actor = the witness, target = the doer, instrument = the thing. The Ford's "wand is yours" rule is adjusted to match.

**Self.** Using something on oneself is expressed by a new `self` selector (true/false: the role is or isn't the event's actor), not by "the target is the player". Core eat, drink, examine-self, give and talk rules use it. Story rules that said "the player" now say "a person".

**World events.** Anyone stepping into a tile in some state can be raised to the modder as a world event (`enter` is a world kind), and the "ask the modder" filters no longer exempt only the player.

**Locking the actor.** While the modder works out an act, everyone in it — including the one acting — is frozen: no step, no other act, no key labels. The lock is released when the patch or the fallback arrives. On the client, the one acting shows a working animation with a turning spark over their head; a downed actor lies on the ground; things the act waits on still shimmer.

## Requirements

- `Ontology` gains `factions`; person types carry `faction:folk` and `essential`; creature types carry `faction:wild`. The mod spec exposes factions and the `self` selector, and its text no longer says the player is the only subject of witness and world events.
- Creature AI uses `temper` (`aggressive` | `nocturnal` | `wary`), an optional `leash`, and a list of `foes`, in place of the old `hostile` flag.
- `Engine.hostileTo(a, b)` follows the rules above: foes always; otherwise by faction hostility subject to temper (nocturnal only at night, wary never); false for a downed target, for a non-actor, or for a creature without an AI.
- Damage records the striker as a foe of an AI actor (never itself), and does nothing to a downed actor. At zero health it raises `defeat` regardless of who is hit.
- Defeat rules: essential actors get `down` and later, on expiry, return to life with positive health. Non-essential actors are destroyed. `destroy` never removes an essential actor.
- A downed actor is `busy`, and an actor frozen by a pending act is `busy`.
- Creature movement and chase honour fire avoidance and leash. In the Ford at night with a lit camp fire, a frost slime roaming toward the camp comes no closer than one tile outside the fire radius.
- People flee a would-be attacker (within a few tiles), toward fire if one is near, and take the blow if they cannot move.
- Witness events fire for any doer, not only the player; the mod port's validation of world-event patches forbids harming either actor or target for witness/invalid events (blocked still may target the person it concerns).
- Selector satisfiability analysis treats `self: true` as disjoint from non-actors and from `self: false`.
- Signatures for modder requests treat "target is the actor" as `self`, not "target is the player".
- Mod-port freezing covers actor, target and instrument. Stepping and facing are refused while busy, and the worker sends no key labels while the player is busy.
- The completeness proof includes a scenario for danger by faction, flight, and fire, and checks the actor lock after a request is raised and its release after the patch is submitted; the collapse-and-come-to scenario covers the player and a person alike.

## Interface

- `Ontology.factions?: Record<string, { name: { en: string; zh: string }; hostile?: string[] }>` — in the engine's ontology type; content fills it with `folk` and `wild`.
- Status `down` (`duration: 300`, `immobilize: true`) in the content statuses.
- Tags `faction:folk`, `faction:wild`, `essential` on the actor types.
- Rule selector field `self?: boolean` (in the engine's selector type, matching, and the mod spec's selector docs).
- AI fields on creature AI: `temper?: 'aggressive' | 'nocturnal' | 'wary'`, `leash?: number`, `foes?: string[]` (replacing `hostile`). Tests set `ai = { behaviour: 'melee', temper: 'wary', sight: 0, home }`.
- `Engine.hostileTo(a: Entity, b: Entity): boolean`
- `Engine.factionsOf(e: Entity): string[]`
- `Engine.fires(map: string): Pos[]`
- `Engine.fearsFire(e: Entity): boolean`
- `FIRE_RADIUS` exported from `@lsw/engine` (value used by the fire-avoidance distance).
- Content rules `combat/down` (on `defeat`, essential actors) and `combat/come-to` (on `expire` of `down`).
- `WORLD_KINDS` includes `'enter'`.
