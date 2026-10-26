# Player inputs v2: five inputs with data-driven reach; taking and putting become physics

## What is wanted

The player's controls should become five inputs, each making exactly one act, and each held to a reach that is data rather than a fixed constant.

| Input | Act | Reach |
|---|---|---|
| E | a hand on the target | the target's `handsRange` (a bed 0, a sign 2, a site 0, default 1) |
| F | take | the world's `carry` (default 1) |
| G | put / store / hand to a person | `carry` |
| Left click | use the held thing on the target; with nothing held, a blow (Minecraft's fist) on anything | the held thing's `range` (default 1, a bow 6) |
| Right click | use the held thing on oneself (the same as a left click on one's own place) | oneself |

Today there are four inputs (right click puts), a fixed pointer reach of two rings, and a bare left click that is a hand on most things. Taking and putting also reach undefined outcomes, so the AI is asked about things that are plain physics. All of this should change.

Related behaviour that goes with it:

- E, F and G never take oneself as their target. On one's own place they meet whatever else is there. Only the right click (or a left click on one's own place) targets oneself.
- The engine holds every act to its reach, for every actor (player, AI, boss skills, replays). The magnet, a boss's skill and sandbox replays state their own reach.
- The pointer reaches as far as any input does. A spot shows only the inputs that reach it. Where no input reaches a pointed spot, E, F, G act on the place in front, so the keyboard alone still plays; the mouse's left click does nothing there.
- F and G are offered only where they would change something. The dry run reports this through a new `changes` flag.
- Taking and putting are never asked. A thing that cannot be taken stays where it is with a message. A thing put where nothing has room is refused with a message. A creature does not take what is put on it. A person is still handed it. What a creature makes of a thing held out to it (a rope used on a slime) stays the AI's question.
- Food, draughts and armour used on another feed, dose and dress them. Armour used on a person puts it on them; food feeds someone who gets hungry; a healing drink heals; the fireproof draught coats the other. Used on oneself these still ask for confirmation where they did before.
- E on a companion (Pip) tells what the story asks for now and how.
- Flesh gets hardness 1: a bare fist wears wood down but finds stone too hard ("Too hard.").
- The wardrobe, shelf, bookshelf and sack gain durability and a makeup.
- Generic labels: "Interact with X" for E, "Punch X" for a bare blow, "Use X on yourself" for the right click.
- The client uses G for put, and the right click for use on oneself; the key hints and the focus outline account for the new input.

## Expected behaviour

- With nothing held, a left click on a boulder is a blow labelled "Punch boulder"; running it logs "Too hard."
- A stone two cells away is reachable by no input: `reachable` is false, a left click there offers nothing, F falls back to the place in front, and an engine `take` of it from that distance is undefined and leaves it in place.
- With a bow, a creature in line six cells away is a valid left-click target; one off the line is not.
- A bed's E is offered only when the player stands on it.
- On one's own place with a stick lying there, F targets the stick, never the player. The right click with bread held is `use` on oneself via `use/eat`; a left click on one's own place produces the same act.
- Bread used on a hungry person raises their hunger value and is consumed; a helmet used on a person is worn by them (it sits in their worn slot, held inside them).
- Taking a table is offered by no F plan, and the engine `take` act of it is defined with no undefined step in the trace; the table stays put.
- Choosing F on a pile on a table offers the items but not the table; E on the same spot offers the table.
- Putting a plank into deep water is not offered by G, but the act's answer (`core/receive-water`) still runs and nothing is lost.

## Requirements

- The plan kinds are `hands`, `take`, `put`, `use` and `self`; each plan makes one act, with the verb of its own input (`self` makes `use`). A bare `use` or `self` plan is a blow (`attack: true`), never a hand.
- Completeness: every act within reach is produced by some input, including `use` of each carried thing and a bare blow on oneself via `self`.
- `Engine.inReach(verb, actor, target, instrument)` holds any act to its reach for any actor; `reachOf` gives the reach of a verb/target/instrument. Out-of-reach acts are undefined and change nothing.
- A ranged blow (reach above 1) flies along a row or column; off the line it is not offered.
- Reach params `reach` and `carry` exist in the ontology and default to 1. `handsRange` is data on types: bed 0, site 0, sign 2.
- Distance between things is measured over footprints (`World.distance`).
- Acts made by a boss skill carry their own reach (the distance to the aimed cell), so they are not cut off by the engine's check; likewise the magnet and sandbox replays.
- `core/use` with nothing held is always a blow. `core/taken`, `core/receive`, `fixture/receive` and `creature/not-taken` are defined (no hole). `core/put` hands to a person, refuses on other actors, and otherwise delivers a receive. `core/offered` remains a hole for the AI.
- Companion talk speaks the objective; the separate "take hold of a companion" rule goes away.
- The old fixed `REACH` constant is removed.
- Existing tests are updated to the agreed model; the dry-run coverage count of holes drops because take/put holes are now defined.

## Interface

- `Key` (from `Plan['key']`, in `packages/engine/src/controls.ts`) becomes `'hands' | 'take' | 'put' | 'use' | 'self'`.
- `Plan.changes?: boolean` — set when the dry run of the act changes something (or is unknown).
- Dry-run/preview result gains `changes: boolean` (e.g. `eng.preview(event).changes`).
- `Controls.reachable(at: Aim): boolean` — whether any input can act at the spot; one's own place always can.
- `Engine.inReach(verb: Verb, actor: Id | Entity, target: Ref, instrument?: Ref | null): boolean`.
- `Engine.reachOf(verb: Verb, actor: Entity, target: Entity | undefined, instrument?: Entity): number | undefined`.
- `World.distance(a: Pos, b: Pos | Entity): number` — distance over footprints.
- `eng.act(verb, actor, target, { instrument, params, reach })` accepts an optional `reach` that overrides the default for that act.
- Ontology params: `reach` (default 1), `carry` (default 1). Type prop `handsRange` (number).
- Rules: `use/wear` (and `body/wear` accepting a `wear` param on `offered`).
- `Frame['keys']` (client) gains `put` and `self` entries alongside `hands`, `take`, `use`.
