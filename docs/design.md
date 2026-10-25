# Large Symbolic World — Design

Status: **agreed design; Phase 1 (infra) implemented** (2026-09-30). **The event model (§5.4–5.14,
§6, §8) was redesigned and agreed on 2026-10-02; its migration (§5.14) is pending.**
Language: docs and code comments in English; discussion in Chinese.

## 1. What we are building

A **web-playable 2D JRPG-style world** at a scale no interactive AI world has reached
(dozens of maps, thousands of NPCs, tens of thousands of items), whose rules are
**code**, and which an LLM extends **at runtime** by writing patches for interactions
the code does not yet define.

Thesis: *a free, open-ended world does not need a neural world model — a symbolic
engine plus just-in-time code patching is enough, and it is the only route that stays
consistent, persistent and cheap at scale.*

Second thesis: *the world is also where its coder improves itself.* Patching the world
makes the world better, not the coder; recursive self-improvement is the modder's own
memory, skills and harness growing while it patches, until what it formed on its own
solves harder coding tasks than world patches. Design: [rsi.md](rsi.md). The demo game
does not show this; it is a paper thread.

- The game runs on its own. When an interaction **is** defined, no AI is involved.
- The one AI interface is **the outcome of an event** (§5.4). When an outcome is
  **undefined**, the engine raises it through the **Mod port**; a modder (an LLM service
  descended from BardOS) returns a **patch** — a type-level rule that fills that hole — which
  the engine validates, applies immediately, and keeps forever. Without a modder, nothing
  happens and the game plays on.
- The subject is the **world**, not agents. NPCs are world content with their own behaviour,
  as in any game; no LLM runs in the per-frame loop.

Predecessor: **BardOS** (`C:\Users\chica\文字游戏`) — a text RPG engine (Loom) plus an
engine-agnostic LLM modder speaking an `event + context + ModSpec → artifacts`
contract. We keep that contract and its three-layer discipline. What changes:

| | BardOS | Large Symbolic World |
|---|---|---|
| What the AI writes | content (scripts, entities) | **rules** (mechanics) as well as content |
| Form | text feed | 2D tile world, real-time |
| Scale | 31 locations / 41 NPCs / 25 items | dozens of maps / thousands of NPCs / tens of thousands of items |
| Delivery | local dev servers | public static web page + one API service |

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Look & genre | 2D top-down **JRPG** (fantasy towns / overworld / interiors / dungeons) with **Smallville-style living NPC schedules** |
| D2 | Platform | Runs in the browser from a URL; static client + one API service |
| D3 | Rendering | **Phaser** (view + input only) |
| D4 | Simulation | Own **pure TypeScript engine** (no DOM, no AI), run in a **Web Worker** |
| D5 | Maps | **Tiled JSON**, whether hand-made or generated |
| D6 | Art | **16×16**, **Ninja Adventure** (CC0) as the base pack; layered character composition + palette swaps for variety |
| D7 | Setting | our own world, grown out from the Ford (game-design.md) to hundreds of maps; the generated Saenvar world was removed on 2026-10-02 |
| D8 | Player input | four inputs, each one meaning (§5.2, agreed 2026-10-21): the **left click**, the held thing's own use (a tool or a weapon swung, the fist, anything else used on oneself); the **right click**, the held thing used on what is aimed at (and building); **E**, the hand (what lies loose picked up, anything else handled); **G**, put (never builds); a long press of E or G, or Alt with a click, chooses the layer; proven complete over the engine's event space |
| D9 | Free-text input | **deferred**; reserved in the ModSpec as the `intent` and `ask` event kinds (§5.4) |
| D10 | Combat | **on-map, real-time** (Zelda / Stardew-like), elemental reactions interacting with the environment |
| D11 | Rule system | **one** rule engine for world interactions, elemental reactions and combat |
| D13 | Event model | **one AI interface, the outcome of an event**; rules belong to a host and write only it; undefined leaves are the only place the AI enters; without one, nothing happens (§5.4–5.14) |
| D12 | Phase 1 | game infra fully working at target scale; **Mod port defined and exercised by hand**, no LLM wired in |

## 3. Architecture

Strict dependency direction, as in BardOS:

```
client (Phaser + UI)  ──▶  engine (pure TS, in a Worker)  ──Mod port──▶  modder (HTTP service)
   renders, inputs          world state, rules, sim,                  writes patches to the
   talks only to engine     ModSpec, validatePatch, rule library     ModSpec it is handed
```

- **client** never touches world state directly; it sends intents (move, take, put,
  interact, attack) and renders snapshots + events streamed from the Worker.
- **engine** owns all state and all rules. It is deterministic given (state, rule
  library, inputs, seed). It knows nothing about LLMs; it exposes the **Mod port**.
- **modder** is out of process and optional. Without it the game is complete — just
  less free.

### Repository layout (planned)

```
packages/
  engine/     pure TS: world model, ontology, rule engine, sim, NPC schedules,
              pathfinding, chunk streaming, save, Mod port (ModSpec/validatePatch/library)
  client/     Phaser app + UI; boots the engine Worker; Vite build → static site
  content/    ontology, items, NPCs, base rule library, the Ford's story and invariants
  tools/      the map builder and the hand-made maps, the project's own art, coverage, curriculum
  modder/     the modder service, descended from BardOS: pipeline, shared library, self-state (§13)
docs/
```

## 4. World model

> **Superseded by [world-model.md](world-model.md)** (agreed 2026-10-04, not yet built): one
> root type `thing` with no kinds, things and the clock as the whole state, cells with occupied
> spaces, z and height, durability and materials for everything, makeup, two-level maps. This
> section describes the world as built today.

### 4.1 Entities

Everything in the world is an entity with a stable id:

- **Actor** — the player, NPCs, creatures. Position, facing, stats, statuses, inventory,
  held item, schedule (NPCs), faction.
- **Item** — portable things. Lives in exactly one place: on a tile, in a container,
  in an inventory, or held.
- **Fixture** — non-portable things on the map: doors, chests, trees, fires, altars,
  beds, signs. May be containers.
- **Tile** — map cells carry a terrain type and may carry statuses too (wet, burning,
  frozen, electrified), so the environment participates in rules.

Storage is ECS-style (component arrays keyed by id) so thousands of actors and tens of
thousands of items stay cheap to iterate and serialize.

### 4.2 Ontology — what makes type-level rules possible

Every entity has a **type** in a type hierarchy plus **tags** and **properties**:

```
type:  item/container/bucket/water_bucket     (is-a chain: item > container > bucket)
tags:  [liquid:water, wooden, portable]
props: { weight: 3, value: 4, element: "water" }
```

Rules match on types and tags, never on instance ids by default. This is the single
most important data decision: it is what lets one rule cover thousands of instances,
and it is what makes AI patches amortize. The tag vocabulary is curated and versioned
in `content/ontology`; the ModSpec ships it to the modder.

### 4.3 Maps and streaming

- A **map** is a Tiled JSON file (terrain layers + object layer for fixtures/spawns)
  plus an entity manifest. Maps link through **portals** (doors, edges, stairs).
- The world is a graph of maps. Only the player's map is active; the others are dormant
  and frozen, and catch up when entered (§5.12).
- World data is split **per map** into static chunks served as static files; the
  client loads a map's chunk on entry.

## 5. Interaction model

Status: the input (§5.1–5.3) was agreed on 2026-10-01 and is built (`engine/src/controls.ts`,
the client's `ui/`). The event model (§5.4–5.13) was agreed on 2026-10-02 and is built; §5.14
records the migration and what the implementation refined.

Two halves. §5.1–5.3 are what the player does: the input design, taken from Stardew Valley's
wiki and its decompiled source rather than from memory. §5.4–5.14 are the event model: how
anything that happens gets its outcome, and the one place the AI enters.

### 5.1 Engine verbs

Unchanged: **take**, **put**, **interact** (plus the **hit** event for attacks). Every player
action becomes an event:

```
Interaction = { verb, actor, target, instrument?, at, time }
```

The player never chooses among the verbs: each input below makes its own.

### 5.2 Player input: four inputs, each one meaning

**Why not Stardew's contextual Action key.** Stardew's interaction space is closed: each pair
of (held thing, target) means one thing, a tile holds one thing, and items in the bag do not
act on each other. This world's promise is the opposite: anything may be used on, or put on,
anything. "Holding X at Y" then means at least three different events — apply X to Y, put X
onto Y, or do Y's own thing with a bare hand — and a contextual key always hides one of them.
The first build (two Stardew keys) failed exactly so: where using X on Y was defined, putting X
there was unreachable. Checked against the engine's event space, it had five holes (a take and
a bare-hand interaction on the same fixture; a tool on the ground versus using it on oneself;
layers under a pile; items in the bag as targets; an axe that both chops and strikes). A second
contextual click over exact keys (2026-10-14 to 10-20: a right click choosing among E, F, G and R as the
base rules answered) hid nothing, but could not be taught: its rules were long, and the left click's
meaning changed with every thing picked up (a stone in hand turned a punch on a slime into "use the stone
on the slime").

**The standard** (agreed 2026-10-21): four inputs, each with one meaning a player can say in a sentence. What
is held decides only *what* is used, never *which* act; what is aimed at decides only, for the hand, whether it
lies loose or stands.

| Input | Act | Reach | For |
|---|---|---|---|
| **Left click** (`primary`) | the held thing's **own use**: a tool or a weapon (`isTool`, Stardew's line) swung, `use(held, target)` at the aim; nothing held, the blow of the main hand's weapon, else the fist, `use(none, target)`; anything else held, `use(held, self)` wherever one points | the held thing's `range` (1 by default; a spear 2, a bow 6) | weapons, tools (chop, mine, till, harvest, fill, water, light, cast), the fist; eat, drink, put on, read |
| **Right click** (`secondary`) | `use(held, target)`: the held thing on what is aimed at; on oneself, `use(held, self)`; a built thing in hand set up there (it builds: `use/set-structure`, `use/set-fixture`); nothing held, nothing | the held thing's `range` | sow, fertilize, feed, unlock, cook, smelt, write, bait; feeding or dressing someone; every experiment the world has never seen; building by hand |
| **E** (the hand) | what lies loose (`World.isLoose`: an item; a built thing come loose) `take(target)`; anything else `hands(target)`; sneaking, on a person, `take(person)` (their pockets) | `carry` for a take; the target's `handsRange` for a hand (0: standing on it, a bed; 1 by default; a sign 2) | pick up, steal (asked first); talk, open, read, wake, sleep, enter, pick a ripe crop |
| **G** | `put(held, target)` | the world's `carry` (1: the cells round, one's own included) | set down, put in or on, set on a fire, hand to a person; a built thing put down lies loose (G never builds) |

**The left click** is `Controls.plan('primary')`. A swing lands on what is struck — with nothing in hand someone
first, then what cannot be carried, never a loose thing lying there; with a tool, the top layer —, on someone one
talks to (a person, a companion) only with the weapon drawn (X: the blow is meant, docs/npc-sandbox.md; a torch is
not put to a villager by a slip either), never on oneself. A tool swung where the world has never seen it is an
experiment, as any use is (a pickaxe at the grass asks the world); only the bare fist at the bare ground the world
has never seen struck makes nothing. It acts on the press; held, it goes on
(`Controls.again`) at a swing's pace — the attack's cooldown, the same beat for a tool's work — making again only
the act the press made (a blow, or the same rule's work: one tree after another, a row tilled) where the base
rules or a learned answer know it and it changes something, never one that asks first, and never one that undoes
the last (a bucket filled is not poured back). An object used on oneself is made once a press, and where the world
has never seen it, asked first (`Use {instrument} on yourself?`): a stone clicked on by a slip of the finger is no
question for the modder.

**The right click** is `Controls.plan('secondary')`, the exact use: it chooses nothing. Every "use X on Y" the
player makes is a right click, so the experiments — the world's one AI interface reached by hand (§5.11) — are a
deliberate act. A built thing in hand is set up where the cell takes it (the settle check of docs/building.md), on
one's own place too where it can stand with one (a bed under one); held and dragged, a row; a floor in hand, R
turns the click to the ceiling.

**E, by the form of what it meets** (Minecraft's dropped item and block): a thing is either **loose** — an item,
or a built thing come loose, packed where it lies (`LOOSE`, the kernel's `item/misc/bundle/loose`, drawn as what
it holds) — or **set up**. The hand picks up what is loose and handles what is set up. A built thing comes loose
when it comes to rest on a cell by any way but being set up (G, a spill; the `move` primitive without `build`),
and when a tool knocks it (`core/strike`: an axe, a pickaxe or a hammer on a built thing that can be carried —
the `loosen` primitive, what it holds spilling out first); it is set up again by the right click or the build
palette. What F did is so spread: picking up is E, a ripe crop is picked with the hand (`farm/pick` on
`impulse/handle`), taking down is a tool's, a theft is E asked first (`Steal {target}?`), and a pocket picked is E
sneaking.

**The attack key.** Besides these, **Space** strikes straight ahead with the held weapon (else
the one in the main hand, else a tool in hand — a torch swung —, else a fist; never an object that
happens to be held, `weaponOf`): on the press, and again while held, paced by the attack cooldown.
It adds no event the others cannot make (the left click makes the same blow, aimed at a spot); it
is there for feel, because a fight should not depend on where the cursor is, nor on what is held.

**Completeness**, the criterion every input design here must meet:

1. **Expressible**: every player event the engine can make and a rule can define is produced
   by some input.
2. **Unshadowed**: an input state (key, selected slot, aim, chosen layer) makes exactly one
   event; no event is reachable only while another is undefined.
3. **Foreseeable**: before the press, the HUD shows the event it will make. What it says is the
   answering rule's own `label` (or the label of the answer it reaches: food eaten says "Eat
   {instrument}", given to someone "Feed {instrument} to {target}"; a place of the overworld "Enter
   {target}"), the receiver's before the act's own; where no rule says, the input's default, marked
   `?` when the outcome is undefined (and someone will be asked: not where the AI setting turns that
   kind of work off, §13). A patch carries its own label, so a hole the AI filled says what it now does
   (the validator warns when an input-reached rule has none). The tip over the framed spot says it (§5.3).

**The player's event space** (from the engine and the rules): `hands(target)` — a hand on what stands;
`take(target)` — what lies loose; `put(held, target)` — storing and giving are puts; `use(held, target)` —
sowing, feeding, cooking, a tool's work, building by hand; `use(held, self)` — eating is a use on oneself;
`use(none, target)` — the bare body's blow; `enter(tile)`. Targets: every layer of a tile within the act's reach
(people and creatures, fixtures, the items of a pile, the ground, the ceiling), the player (for use only), and items
in the bag or an open chest. A hand on what lies loose is a take (by design: the hand picks it up).

**Taking and putting are the world's physics, never asked**: what can be taken is taken, what has room takes what
is put on it, a person takes what is handed to them; anything else refuses, and E's take and G are offered only
where they would change something. What a thing makes of another is a use's ("put places; use applies"): G never
sows, fills or fertilizes (the rules that answered a put so, `farm/sow-put` and its kin, are gone: a seed put on
farmland lies there). A creature does not take what is put on it; a rope *used* on it holds the rope out to it,
and what it makes of that is its own nature, undefined until the AI says.

Other keys: Esc (menu, and closes anything open), Tab (the bag, with tabs over it to the other panels;
I too), J (journal), M (map), 1–0 and the wheel (toolbar), Shift+Tab and Shift+wheel (the next row to the
toolbar), Shift (walk), WASD (move), X (draw), V (sneak), Q (dash), Shift+1–6 (the skill bar), B (build mode),
R (in build mode, turn; with a floor in hand, the right click to the ceiling). Dialogue moves on with E or a
click; a yes/no question is answered with E.

**The keys are the player's** (2026-10-20, `runtime/src/keymap.ts`): every key the page answers to is an
action's — the hand and put, the turn, the attack, the steps, the panels, the toolbar, the skill bar —, a key and
a spare each, rebound in Options → Keys (a draft until saved, or given up; a key another action holds asks first,
then the two trade; a row set back to its default, or all of them). The left hand is on the keys and the right on
the mouse: the two clicks are the mouse's alone, with no key standing in for them (2026-10-21: the keyboard's
F and R and the both-hands preset are gone). Esc, the developer's ` and the browser's own keys (Ctrl, Alt, F5, F11,
F12) are never bound. The map is the browser's, never the save's: the world never knows which keys move it, and
the engine's inputs (and a lesson's locks) are the same whatever the keys. What the page says of a key follows the
map: the tip, the key table, the corner buttons and slots, a lesson's glyph (its `key`, written as the default map
has it), and any text's `{key:<action>}` — a game's words (a lesson, a quest's hint, a rule's line) and the
interface's own name the action, never the letter (`{key:move}`, `{key:slots}`, `{key:casts}` for the groups; an
aside naming a key the map leaves unbound goes). The wiki fills them with the default map.

- **The instrument** is the selected toolbar slot: any carried thing, or an empty slot (none).
- **The aim**: the point the mouse is on, when some input reaches it (so how far the pointer
  reaches is the farthest of them, with what is held and what is there); else, for E and G, the
  tile in front. A spot shows only the inputs that reach it: far off, perhaps just the bow's shot.
- **Reach is the engine's**, for every actor: an act whose target lies beyond its reach is not done
  (`Engine.inReach`; Gus works from beside the tree as the player does). A system that pulls from
  farther says how far (the magnet, a sin's skill).
- **E with nothing pointed at** acts on the place in front, unless what is there has no answer
  of its own (undefined, or only the ground touched) and what one stands on has one: the bed one
  lies on, a place of the overworld (a place to a cell since 2026-10-11: standing on its cell,
  facing any way, E enters it; the cell is outlined). What one stands on takes E when its answer
  changes something, and also when it changes nothing but what is in front is only the ground (or
  nothing): a place the story has not opened yet answers E by saying why (`site/enter`, its
  `opensWhen` unset), and that answer reaches the one standing on it rather than the ground's
  "touched" in front (`Controls.plan`, 2026-10-11). The ground underfoot never takes E from
  anything in front. The Ford's cell is the river's (`site/place/crossing`, hands' reach 1): one
  goes in with E from the cell beside it. A press of E that only touches the ground (the floor
  brushed, said by `tile/handle`) does nothing: it would say so at every step; the chooser still
  touches it (`Controls.planFor`, 2026-10-20).
- **Oneself is never E's or G's target**: on one's own place they meet what is there (the
  floor, what lies at one's feet, the bed one stands on). The right click on one's own place is on oneself (or
  sets up the built thing in hand there); the left click's swing never is.
- **The layer**: whatever is drawn at that point, top first — a person, the things lying on a
  table, the table, the canopy of a tree reaching over from behind, the ground last. The view
  alone knows what is drawn where (it tests the pictures' own pixels), so it hands the stack to
  the engine with the aim; with the keyboard the stack is what stands on the front tile, in
  drawing order. A press acts on the **top** layer; what the rule library does not define there
  is an experiment and goes to the Mod port. The **chooser** — a long press of E or G, or Alt with a click (the
  left one where it swings: a tool, a weapon, the bare body) — lists every layer at the point, each with what the
  input would do, the ceiling last (a floor laid in it with a floor in hand; knocked loose with a tool). So nothing
  drawn is out of reach. A plain click never opens it (2026-10-21: a long left press stopped the world mid-fight).
- **Nothing is only a picture**: a map is terrain and things. There is no decoration layer —
  the bench, the stump, a tuft of grass, fallen leaves are entities of their types, so any input
  reaches them and the rules (or the modder) answer for them.
- **Items in the bag or an open chest** are targets through the context menu (right click on
  the item): use the held thing on it, put the held thing into or onto it, handle it bare-handed.
- **Blows** (a convention the ModSpec states): pure weapons (blades, clubs, bows, wands) strike
  whatever they are used on except people; tools that are also weapons (the axe) strike living
  things and work everything else; the bare body strikes whatever it is used on (a fist wears down
  plants and wood, slowly; stone is too hard). A weapon used on a person is a use, never a blow — no
  villager is hurt by accident; the swing strikes a person or a companion only drawn. A blow from afar flies along
  a row or a column. A press never aims a blow at oneself (the chooser still strikes).
- Eating and drinking oneself ask first (yes / no); so does any rule with `confirm`, a theft, and a use on oneself
  the world has never seen. Food, a draught or armour used on another feeds them, doses them, dresses them.

**Proof sketch.** An event is (verb, instrument, target). The input fixes the meaning (E: a hand, or a take of
what lies loose; G: a put; the left click: the held thing's own use — a swing, the bare body's blow, or a use on
oneself; the right click: the use on the aim); the slot fixes the instrument, and every carried thing (or none) can
be selected; the aim, the chooser and the context menu reach every target within the act's reach (one's own place
for a use: the right click, or the left with an object). The three are independent, so their product — the event
space within reach, less the stated conventions (a hand on what lies loose is a take) and the takes and puts that
would change nothing — is reachable; and a given input state is one dry run, shown by the label.
`games/openworld/content/test/controls.test.ts` checks it by enumeration on a scene with the hard cases (a pile on
a table, a stick on the ground, a person, the own tile, a second thing in the bag).

**Undefined behaviour from the inputs**: every input makes an act (§5.7). Where its outcome,
or that of an impulse it emits, reaches an undefined leaf, the AI is asked (§5.11).

As built (2026-10-05): aiming, keyboard layers, reach, blows, menu drops and magnetic pickup
keep the actor's storey. A built floor sits below the things on it in the chooser. A blow keeps
its announced target, including an item in the bag; a chosen target beyond a blocked ray or
off its line is refused.

### 5.3 Inventory, chests, pickup, HUD, menus, time

The craft is Stardew Valley's; the systems are the Ford's own (game-design.md §10 lists what
was cut).

- **Death** (Minecraft's death screen): the one at the keys, felled, lies fallen (`down`, as any
  essential being) and the world stops on a red veil: "You died!", who felled them (the source of
  the harm that did, `combat.lastHurtBy`: no one for a fall, hunger or the world; a wound's pulse
  names whoever opened it), and what may follow by the game's **difficulty**, chosen at a
  new game (the story's fact `game.difficulty`, protected; a game from before is normal):
  - **easy**: get up where one fell, whole, with everything;
  - **normal**: respawn at home — the bed last slept in or the waypoint last woken (the actor's
    `home`, which the bed and the statue tell them), else where the world began — whole, what one
    carried left where one fell (lying still, to go back for);
  - **hardcore**: one life: the slot is saved as it ended and can no longer be played.
  On easy and normal one may instead load a save (a fallen player is not autosaved, so it is from
  before the fall) or go back to the title. Rising is the story's word and the actor's own rule
  (`Engine.respawn` → `notify {what: respawn}` and a push home; `body/rise`), not a write.

- **Inventory**
  - 30 slots in three rows of ten; the first row is the toolbar (keys 1–0), and the selected
    slot is what the player holds; there is no separate hand slot.
  - Shift+Tab (or Shift and the wheel, either way) brings the next row to the toolbar; a new kind takes the
    first free slot, the toolbar's first; with the bag full it stays on the ground. What the magnet
    pulls in never takes the selected slot while another is free (2026-10-20: the drops of a fight
    flew into the empty hand and the fist held them); a take (E) lands in the hand, as it means to.
  - Equal items stack.
  - In the menu: drag to move, right-click takes one, Shift+right-click takes half, Shift+click
    moves a stack between the toolbar and the rest of the bag, dragging an item out of the menu
    drops it, and a button organizes the bag.
  - Slot order and the selected slot are part of the world state.

  As built (2026-10-05): organizing uses the bag's learned capacity, including Big Pack's
  fourth row.

  As built (2026-10-11): the bag panel is a character sheet beside the pack (`runtime/src/ui/menu.ts`).
  On the left: the level and the profession; the player's anime portrait (docs/looks.md) framed
  between the body's slots — head, ear, neck, shoulders, body down one side, hands, the two rings,
  waist, feet down the other —, the main and the off hand beneath it; an embossed silhouette in
  each empty slot (`Ui/EquipSlots.png`); the stats beneath (health, food, attack, the weapon's
  power, defence, critical chance). On the right the pack, its title row carrying the coin one
  carries, labelled with the coin's name (the Dawnmark). What is worn is on the body, not in a bag
  slot (since 2026-10-09).
- **Chests**
  - The chest's grid is shown above the inventory's grid.
  - Clicking an item moves it to the other side; right-click moves one.
  - Buttons: organize, and fill existing stacks.
- **Pickup**
  - Items that rules spawn (a harvest, logs, stones) pop out, and fly into the bag within 2
    tiles (Stardew's default magnetic radius is 128 px). What a creature leaves when it falls
    (its meat, its loot) and a hen's eggs lie still instead (`spawn`/`dropContents` with
    `still`): they are picked up with E. A built thing a tool knocks loose pops out as a harvest does.
  - Items placed in the world are picked up with E. Walking through town never vacuums it.
- **Foraging** (Don't Starve's twigs, flint and grass): a map names what appears on it by itself
  (`MapData.appear`: weighted types, the terrains, a cap, a pace). While the player is on the
  map, one more of each below its cap appears on a free tile at its pace (150 ticks for the
  ground's yield), never right beside the player (`engine/src/appear.ts`, world-model.md §6.9).
  These are picked up with E like any placed item.
- **Crafting** (C, or the menu's Craft tab): recipes are content (`content/src/recipes.ts`);
  each lists what it uses up from the bag and the item it makes. The first tools are the
  catalogue's axe and pickaxe in stone (stone axe: stick, stone, grass; stone pickaxe: two
  sticks, two stones, grass), so the rules that answer an axe or a pickaxe answer them.
- **Creatures find their way**: a step toward a foe or home is greedy; when it is blocked (a
  clump of trees), the creature takes a path around (A*) and keeps to it (`ai.detour`) until it
  arrives or its goal moves. A fire's reach still stops it.
- **Animals** (game-design.md §4b): `behaviour: 'passive'` creatures never attack and run from
  their foes; `MapData.appear` also brings creatures back (with `every`, `ai`, `statuses`).
- **Hunger** (Minecraft's food bar): an actor with `maxHunger` (the player: 20) loses one
  point every 300 ticks; eating feeds it the food's `food` prop (the `feed` primitive in
  `core/eat`). Food does not heal: health comes back from being well fed (below). Medicine eaten
  (the healing herb, `core/eat-medicine`) and drinks (potions, `core/drink`) still heal. At 90 % and up it heals a point every 80 ticks; at 0 it loses one as often, but
  starvation never takes the last point (`engine/src/hunger.ts`).
- **Experience and levels**: the `gainXp` primitive. A defeated actor gives whoever struck
  the last blow experience equal to its maxHp (`combat/defeat`); 20 × level of it raises the
  level, and each level brings a skill point (`engine/src/progression.ts`). Props `xp`,
  `level`, `skillPoints` on any actor. The skill tree that spends the points is not built yet.
- **HUD**
  - Top right: the day, the weather, a clock dial.
  - Under it, a "!" journal button that flashes on a new objective.
  - Bottom: the toolbar, and above it Minecraft's status: the experience bar the toolbar's
    width with the level on it, then ten hearts on the left (each a tenth of maxHp, emptying
    from the right) and ten drumsticks on the right (hunger, emptying from the left). The
    whole block moves to the top when the player walks near the bottom edge.
  - Bottom left: messages such as "+1 log" or "The world pauses…".
  - The interaction (§5.2, foreseeable; 2026-10-14, after the labels' row shook with every step): the spot the
    inputs act on is framed by four small corners that glide to the next spot, faint over the bare ground and
    amber where the world has never seen the act; the pointer is the hand's mark (a glove over what E picks up
    or handles, or where the right click sets up what is held; a speech bubble over someone), with a `?` where
    the right click's use will ask the modder, a `!` where E would take what is another's, faded out of reach;
    and a small tip over the frame says what each input would do there, in the rules' labels — with the
    pointer the left and the right click (where it differs), then E and G; without it (the keys walked last) E
    and G in front. The tip waits until the player stands and the frame has rested a moment,
    so it never lurches with the steps nor flickers as the pointer sweeps.
  - What is held is not drawn in the hand. A sword, a bow and a staff are seen for the moment of a
    blow — swept, drawn and loosed, raised and brought down to point —, following the one who
    struck; other weapons and bare hands show the blow alone (2026-10-12).
  - The map name fades in when the player enters a map.
  - Development only: the message log, performance numbers, the Mod Console.
- **Tooltips** (Minecraft's): hovering an item in the toolbar, the bag, a chest or the
  crafting panel shows a box at the cursor (`client/src/ui/tooltip.ts`): the name in its
  quality's rarity colour, its kind, "When held:" with the blow it makes (atk + power, reach,
  element), what a tool does and what food restores, its material and traits as lore,
  statuses and owner.
- **Menu** (Esc): Inventory, Craft, Options. **Journal** (J): the objective, what is done, and the
  Threadbook (§5.11). An ending card closes the story when the goal state is reached.
- **Time** stops while a menu, a dialogue, a scene or a yes/no question is open.
- **Movement** stays on the tile grid, because rules are tile-based, with smooth
  interpolation. Stardew moves freely; this is the one deliberate difference.

### 5.4 The principle

Agreed 2026-10-02. It replaces the previous model: twelve sources of undefined behaviour, each
asked about on its own terms (player acts frozen and asked, world events through a salience
filter and budgets, some kinds never asked). That model was neither uniform nor complete (§5.13
lists where it fell short).

- **The game is an ordinary, complete game.** The inputs, the behaviour of people and
  creatures, physics, combat and the story are code and rules. It plays to its end, the far
  bank and the ending included, without any AI.
- **There is one AI interface: the outcome of an event.** Every event carries an outcome, and
  every event is resolved the same way: if the rules define the outcome, it is used; if they do
  not, the AI is asked.
- **Without an AI, nothing happens.** No modder, a failure or a time-out: the leaf's default
  runs, which is "no change" unless the author wrote one to keep the story playable. Undefined
  behaviour never stops the game.
- **Behaviour is the game's own logic.** What people and creatures choose to do — schedules,
  temper, fleeing, pathfinding — is behaviour, as in any game, however it is implemented (an
  LLM could drive it). It is not part of this interface. An outcome may change an actor's
  script, as one of its effects; that is the one way an outcome reaches behaviour.

### 5.5 What the world is made of

> The agreed extension is [world-model.md](world-model.md) §3–5: the state is things and the
> clock (facts become props of the story and the world), cells are `(map, x, y, z)` with occupied
> spaces, regions and rooms are things, and maps form two levels (overworld and local maps).

- **Things**, each with a type, props, statuses and a place: on a tile, inside a thing, or in a
  hand. Tiles are things of `tile/*` types; map regions are things too.
- **Stance**: where a thing is — `ground` (the default), `air` (flyers), `water` (swimmers).
- **Reach**: the stances a tile or a thing acts on. Lava reaches `ground`; heat rising from it
  would add `air`. A flyer over lava touches nothing.
- **Resident hosts**: the world, the story, and each person's record (script, schedule,
  attitudes) belong to no map and are always live. The story's facts belong to the story.
- **Maps** are *active* (the player's) or *dormant* (§5.12).

### 5.6 Rules: each thing answers for its own nature

- **A rule belongs to a host type**: `host type × event kind → a condition tree`.
- **Read anything, write only yourself.**
  - An outcome may change its host: its state, props, statuses, place, type, its existence, its
    script. It may also spawn new things and present (lines, effects, sound).
  - To affect anything else it **emits an event** to it, and that thing answers.
  - Influence at a distance is only ever emitted: to an area, a line or a direction, within the
    map.
- Example:
  - Lava: something stands on me → emit `element fire (power)` to it.
  - A person: fire → lose health.
  - A fire slime: fire → undefined, or no change.

  Lava never lists the creatures. A new creature says how it takes fire, and nothing old is
  edited.
- **Conditions** read the host, the event's parameters (power, element, edge, how, verb) and
  the other participants' public types, tags and statuses. Missing data reads as false.
- **Leaves** are of four kinds:
  1. **effects** on the host — an empty list is **no change**, which is a definition;
  2. **emit** events — events nest;
  3. **inherit** — defer to the next less specific rule;
  4. **undefined**, with a default — no change, unless the author wrote one.
- **Resolution** is the same for every event:
  - Take the most specific rule. The host's type decides first (an instance-bound rule, then
    the deeper type); the event kind's depth decides next.
  - Walk its tree to a leaf. `inherit` goes up a level.
  - The root type `thing` has a rule for every root event kind, and none of them inherits, so
    every event reaches a leaf.
  - The validator rejects two base rules that are equally specific; learned rules have places,
    not ranks (§5.16).
- **One outcome per event.** There are no composed rules. Further consequences are further
  events: an act that someone sees is also a `seen` event, with the seer as its host.

### 5.7 Event kinds

The kinds form a closed tree. The engine emits nothing outside it.

| Kind | Made by | Host | Parameters |
|---|---|---|---|
| **act**: `use`, `put`, `take`, `hands` | the inputs, and the behaviour of people and creatures (the same four acts, never "is it the player") | the instrument; with a bare hand, the actor's own hands | the target |
| **impulse** (§5.8) | outcomes | the one it is aimed at | per impulse |
| **contact**: `begin`, `stay` (periodic), `end` | the relation difference (§5.10) | both sides, each for itself | how: `on`, `under`, `in`, `held`, `in-region` |
| **bump** | a step into something solid | both sides | direction |
| **time**: `period`, `timer` | the clock | things with a period or a timer | a status running out, a growth stage, a reset |
| **threshold**: a status gained or lost; a numeric prop crossing a line declared in data | the host's own change | itself | hp reaching 0, hunger running out… |
| **seen** | every act, once it is resolved | each one who can see it: within their sight, line of sight clear, awake, enough light | the act, its outcome, whose things they were before |
| **stuck** | behaviour that cannot go on | the actor itself | what it was doing |
| **broken** | an invariant check | the story | the invariant |
| reserved: `intent`, `ask` | free text, later | as an act | the text |

Sight is each seer's own data: range (an owl sees far at night, the blind not at all), what
blocks it (walls, trees, a tent), wakefulness and light.

### 5.8 Impulses: what one thing does to another

One impulse per channel through which one thing may change another's state:

| Impulse | Changes the receiver's | Parameters |
|---|---|---|
| **strike** | health, breaking | power, edge (`cut`, `blunt`, `pierce`), element (optional) |
| **element** | statuses | `fire`, `water`, `ice`, `lightning`, `wind`, `earth`; power |
| **coat** | statuses | the substance (oil, poison…) |
| **restore** | health, hunger | which, how much |
| **push** | place | direction, force |
| **taken** | its own place (it moves itself into the taker's hand) | the taker |
| **receive** | its contents | the thing, how (`on`, `in`) |
| **offered** | what it holds: it accepts or declines | the thing |
| **handle** | whatever the receiver says: open, close, read, talk | — |
| **notify** | records, attitudes, the story's facts | what happened: you defeated me, the rope is mended, a topic… |
| **settle** | its posture and place (it goes to the source and holds a posture until it moves on, §5.17) | pose (sit, lie, kneel, lean), status |

Checked against the base rules: every cross-thing effect maps to one impulse.

| Effect today | Impulse |
|---|---|
| damage another | strike |
| set another burning, wet, frozen, electrified | element |
| oil another | coat |
| feed, heal | restore |
| give a thing to a person | offered |
| open another's container | handle |
| shove | push |
| a frost wand freezes a line of water | `element ice` emitted along a line; each water tile freezes itself |
| experience to the one who defeated you | notify |
| a story fact, a topic | notify the story |
| change another person's schedule | notify that person, who changes it |

### 5.9 Root defaults: what is asked

> [world-model.md](world-model.md) §7 adds the rows for durability, `broken`, building, support,
> falling, stages, regions and sites; the policy below is unchanged.

The policy: **what someone does on purpose is undefined at the root; what happens around them
all the time is defined by physics at the root.** Authors then leave undefined leaves on
particular types ("a fire slime takes fire: undefined").

| Kind | Root default |
|---|---|
| act | `put` → emit `receive` to the target; `take` → emit `taken`; `hands` → emit `handle`; `use` → undefined. The base rules define `use` for the classes they know: a weapon emits `strike`, food used on oneself emits `restore`… |
| strike, handle, offered, coat, push | undefined. The base rules define the general cases on parent types: a person loses health, a chest opens, a person takes food. |
| element | physics: flammable + fire → burning; water → wet, a fire goes out; ice → wet things freeze, others chill; lightning on a conductor → electrified; otherwise no change |
| taken, receive | a portable thing moves; a surface or container takes it; otherwise undefined |
| restore, notify | defined in data: add to the value, record the fact |
| settle | an actor takes the posture at the source (§5.17); anything else undefined |
| contact, time, seen, bump | no change |
| threshold | hp 0: an `essential` actor goes down and comes to; others are defeated (destroy self, drop what they hold, notify the one who struck). Other thresholds: no change. |
| stuck | undefined; default: wait where it is |
| broken | undefined; default: the invariant's authored fallback |

This table replaces the salience filter: it is data, open to review, and any type may
override it.

At the Ford:

| Situation | Outcome |
|---|---|
| a slime stands on grass | contact, no change |
| a fire slime touches dry grass | the slime's contact rule → `element fire` to the grass → it burns |
| a person on lava | lava's contact rule → `element fire` to them → they lose health |
| a fire slime on lava | it takes fire → undefined: the AI if there is one, else nothing |
| a flyer over lava | its stance is `air`, lava does not reach it: no contact |

### 5.10 Relations, the queue and determinism

- **Relations** are of two kinds:
  - contact — `on` and `under`, when the occupant's stance is in the substrate's reach;
  - containment — `in` a thing, `held` in a hand, `in-region`.
- **The relation difference.** After every outcome, the relations of what it touched are
  recomputed, and the difference emits `contact begin` and `contact end`, whatever caused it:
  - a step;
  - a terrain change (ice melting to water under someone);
  - a spawn or a destroy;
  - a type change, which can change a stance;
  - a thing put into a container (a lit torch into a chest).
- **`contact stay`** is periodic, and is made only for hosts that have a rule for it.
- **Sight is not a standing relation.** An act's seers are computed when it resolves.
- **The queue.** Events an outcome emits join the queue, first in, first out. A tick handles
  them up to a depth bound and defers the rest to the next tick, so no chain loops within a
  tick. An event whose host is gone has no outcome.
- **Determinism.** The same save with the same inputs makes the same world.

### 5.11 The AI interface

- **The request** carries:
  - the event and its host;
  - the path already taken through the condition tree;
  - the participants and their neighbourhood (the 7×7 scenario of §8);
  - the ModSpec.
- **The patch** is a rule:
  - it sits on a host type and an event kind of the AI's choosing;
  - its conditions name classes, not instances;
  - every case it does not match inherits.
- **Validation**, in addition to §8's schema, ontology, sandbox replay and tests:
  1. it writes only its host;
  2. it emits only known kinds;
  3. it is one type's, placed at one open leaf of that type's tree for the hole (§5.16);
  4. **it only fills holes**: by construction, since the learned tree is consulted only where
     the base rules reach an undefined leaf, and a learned rule has no undefined leaf of its own
     that it could close for others.

  Rule 4 makes refinement monotone: the AI never changes defined behaviour. An authored
  outcome that is wrong is fixed by a person, or by offline review.
- As built (2026-10-06), checks that hold their ground:
- **One class key.** The engine's `classKey` (the hole, the kind, the host's type, the other roles'
  types with `self` for the host, the branching params; residents out) is what both the client's
  port and the service key by. They used to disagree (the service added the host's statuses).
- **A review with no verdict is no review.** It is asked once more, then recorded as `error`, never
  as `ship`; a verdict in capitals reads as what it says.
- **A derived test always tests.** It asserts that the rule answers (`resolvedBy`, a new
  expectation), and a number that moved by the way it moved (its start differs per instance).
- **Create only what the world lacks.** A creation asked for at once, whose name is close to
  things the catalogue has, goes through find first; the route is recorded as it happened. A new
  type that is a thing the world has under another number (sticks, stick) or the same Chinese name
  is refused.
- **What comes from elsewhere is checked here.** A shared-library patch comes with the scene it
  answered, and a client replays it there before it takes it (the repeat check included). A saved
  library's patch rules are validated again as they come back (`restoreLibrary`).

**One question at a time.** A hole is asked once per class: while a request is open, the
  same hole and class wait for it, and once it is answered the class never asks again. The
  number of calls is bounded by the (hole, class) pairs that are actually reached, not by how
  often events happen.
- **Waiting is the same for every event.**
  - While an outcome waits, only its participants are held: the host, the other roles, and
    the actor who started the chain (cutting a stump whose `strike` is a hole holds the one
    cutting). They take no other act and show the working animation.
  - Events sent to a held thing queue up. The rest of the world runs.
  - At the time-out the leaf's default runs. A patch that comes later replays the event if
    it still applies.
- **Before the press.** Aiming dry-runs the act through the events it emits. Reaching a hole
  marks the label `?`. Starting the request early (prefetch) is off by default (`?prefetch=1`):
  in play it committed patches to the shared library for acts the player never made, and a failed
  one escalated to an offline run (2026-10-07).
- **Boundaries.**
  - Only the story's own rules write its protected facts (`ford.`, `seen.`, `invalid.`).
  - Only the story raises its own topics (the ones its steps and rules raise, protected as
    `topic.<id>`): a patch, the player's or the world's, may raise a topic of its own, never the
    story's news before it happens.
  - An `essential` actor goes down and is never destroyed.
  - Emitted spread stays within the event's map and below certainty.
- **Legibility.** Every learned thread enters the Threadbook with its cause and with who
  started the chain (you, or the world), and the first time the player sees one there is a
  light cue ("The world pauses…"). People may talk about it: a patch may notify the story of a
  topic.

As built (2026-10-07), after a play session: **the world pauses while the player's own act waits.**
Before, only the event's participants were held (the player among them), and everything else went
on: at night, a held player stood for the model's ten seconds among monsters that kept striking.
Now the host stops the world's clock while a request the player's act raised is pending
(`ModPort.asking`), as it does for a menu, and times the wait in real seconds: 20 for an answer,
120 while new things are made; then the hole's default runs and the world goes on. Questions the
world raises by itself (a fire reaching what nothing defines) do not stop it. **Statuses draw what
their data names**: a status's `overlay` is one of a closed set the client can draw (`OVERLAYS`:
fire, flame, ice, spark, wet, oil), the frame carries each thing's overlays, and a status a patch
defines picks from the same set (the validator refuses any other). A thing with its own lit picture
(a brazier) shows that instead of a flame. **The shared library holds only what holds**: at start the
service judges every live patch, in the log's order, against what came before it, and rolls back
what the validator, as it is now, no longer takes (`modder library prune`). Clients used to refuse
each such patch on every load. The types and statuses a rolled-back patch alone brought go with it
(`removeType`, `removeStatus` in the log), and so does any learned type or status the checks no longer
take; a client forgets them unless something in its world is made of them or has them, and a synced
patch's definition of a learned thing replaces the one a client kept. The developer's lines (a refused patch, a rule set aside) are a
`dev` tone: the console's, never a player's toast. **A key does what its label said**: pressed a
moment after the label named someone who has since stepped off the spot, it still acts on them
while it reaches them (`Controls.planFor`), and what lies on a thing comes before the thing however
small it is drawn. A thing that reaches the bag without an input (a scene's gift) takes its slot
each tick (`Controls.keep`). The client saves quietly each minute and on each new map, but not in
danger (hurt in the last 15 s, or something hostile within 8 tiles): the save loaded after a fall
is never the fight that was lost.

### 5.12 Space and time: active, dormant, resident

**What other games do.**

| Game | Away from the player |
|---|---|
| Oblivion, Skyrim | Loaded cells run in full. Elsewhere, *low processing* runs only travel packages, over cell-to-cell connections, with travel times estimated and the actor moved when the time is up; there is no combat and no health, and actors do not affect each other. |
| Oblivion, Skyrim | Persistent references (quest actors and objects) keep their state; temporary ones reset when their cell does. A cell resets lazily: 10 days after the player left it (30 if cleared), and only once they come back. |
| Skyrim | The Story Manager is a global dispatcher. Events such as a kill, a change of location or a crime carry their data through a tree of conditioned nodes that starts quests, wherever they happened. |
| Minecraft | Only chunks near a player tick. Unloaded chunks stop entirely, crops and redstone included, and nothing is caught up. |
| Stardew Valley | Growth is settled overnight: a crop's growing time is a number of nights. |
| RimWorld | Caravans move abstractly on the world map; a small map is made only when an event happens to them. |

**What this world does.**

| | How it runs |
|---|---|
| the **active** map (the player's) | in full |
| **dormant** maps | frozen: no periods, no contact, creatures still; the time it went dormant is kept |
| **resident** hosts (the world, the story, people's records) | always live |

- **Across maps an event is addressed, never spatial.**
  - It names its receiver: a person, the story, or a named thing, anchor or region of a map.
  - A resident host, or one on the active map, resolves at once.
  - A receiver on a dormant map gets the event in that map's **inbox**, time-stamped and
    saved with the game.
  - Area, line and direction emissions stay on their own map.
- **Entering a map**:
  1. **catch up the timers**: its statuses' clocks run as they would have in play, tick by tick
     where something comes due: every status that ends goes its way to its end — each pulse of
     it (a burning woodpile wears, breaks into its logs and sets the dry grass by it alight; a
     bleed bleeds), then its end (what burnt out is ash, things grow a stage, the map resets) —
     in time order, the clock set back to each tick, each event with dice of its own (the
     world's seed, the thing, the status, the tick; in play too), so it rolls as it would have
     in play. What one starts runs from then and is caught up in turn. A status without an end
     is a state, not a process: it waits, as a period does. The one at the keys and what they
     carry are left out (their clock ran where they were);
  2. **the inbox**, in time order;
  3. **people** whose schedule puts them here now are placed;
  4. **the relation difference over the whole map**, against the relations saved when it
     went dormant;
  5. then the map runs.
- **For authors**: whatever must progress while the player is away is a timer (Stardew's
  nights, Skyrim's cell reset), and so is a process that ends (a status's pulses: a fire that
  burns down, a bleed). A continuous process (creatures roaming, the ground's yield) is a
  period, and it freezes (Minecraft).
- **People**:
  - a person's record is resident, and their body is on a map;
  - on a dormant map the body does not move: entering the map places it by the schedule;
  - a person whose schedule leads to the active map walks in through the portal.
- **Cost**: a tick costs the active map plus the resident hosts that events reach. Entering a
  map costs its inbox plus the ticks at which one of its statuses ended or had a pulse some
  rule acts on (a pulse no rule acts on, by the status it names, brings none:
  `RuleLibrary.mayDo`), at most `CATCH_UP_BUDGET` of them; past that the rest is summed up.
  The number of maps appears in neither.

### 5.13 Completeness

> [world-model.md](world-model.md) §10 re-argues A1–A7 for the extended world and lists the new
> checks (no kinds, one reference form, exclusivity, every damage channel, economy,
> reachability, mirrored barriers, deterministic generation, parameters).

**The claim.** For the simulated world, every consequence passes through an event, and every
event reaches exactly one leaf; only undefined leaves ask the AI, and without one they run
their default. The simulated world is the active map and the resident hosts, continuously, and
a dormant map at the moment it is entered, after the catch-up, the inbox and the relation
difference. What was not simulated while a map slept did not happen; that is the design, not a
gap.

**The assumptions and why they give the claim.**

| | Assumption | What it gives |
|---|---|---|
| A1 | The state is closed: things, tiles, the world's facts, the clock | a consequence is a change of these |
| A2 | Only outcomes and the clock change the state; inputs and behaviour enter as acts | no change bypasses events |
| A3 | An outcome writes only its host, or spawns | between two things, consequences travel only as events |
| A4 | The relation difference runs after every outcome and on entering a map | every contact that begins or ends, whatever caused it, is an event |
| A5 | Gaining and losing statuses are events; numeric thresholds are declared in data; time makes periods and timers | a thing's own changes reach their consequences through events |
| A6 | The root type has a rule for every root kind, none of them inherits; missing data reads false; no two rules tie; trees are walked in order | every event reaches exactly one leaf |
| A7 | The queue has a depth bound per tick; a gone host has no outcome | every chain ends |

A2, A3, A4 and A5 put every consequence on an event; A6 and A7 give every event one leaf. So
undefined behaviour is exactly reaching an undefined leaf.

**The checks, as tests.**

| Check | How |
|---|---|
| state changes only in outcomes | the world's mutators throw unless the engine's one writer is lent to the caller (outcomes, the clock, loading, the input's posture, the author); a scan of the game's source finds no write behind them (§5.15) |
| write only yourself | in an outcome the mutators throw unless what they change is its host, held by it, or made by it, and a fact unless the host is a resident (§5.15); the validator for patches; a lint over the base rules |
| the root is total | the root has a rule for every kind and no `inherit` leaf |
| no ties | the validator |
| worth comes from what a thing is | the validator: a learned rule never writes what the economy reads — a thing's `value`, its material (the prop, a `material:` tag) and quality (its tag), and what its modules' economy names (`ModuleSpec.economy`: a piece of gear's level, what a merchant has each morning); the diagnostic says to make the host another thing (`transform`) or make what it gives (`spawn`). The repeat check counts a participant's worth that keeps rising as a yield (`yieldCycle`), whatever raised it. Found by the paper's attack set (2026-10-19) |
| the kinds are closed | the engine emits only kinds of the tree |
| relation difference | after every outcome and on entering a map |
| playable without an AI | the story's critical path has no undefined leaf: the three routes, dry-run with the AI off |
| the inputs are complete | already proven (§5.2) |
| deterministic, and every chain ends | replay; the depth bound; the termination check on the request's scene (`chainLoop`: a patch whose event sets itself off again is refused with the round); the runtime guards below |

As built (2026-10-06), the runtime guards: what the validator checked beforehand, the engine holds
to while learned rules run (`tools/test/guards.test.ts`).
- **Every chain ends.** What an outcome sets off (an emit, a threshold, a contact, a status) joins its
  chain one step deeper, not only emits. A chain that has to wait for a later tick may run 2,000 more
  events, and no more; at most 2,400 events wait for the next tick. What is dropped is charged to the
  rule whose outcome made it.
- **Numbers stay finite.** An amount that is not a finite number (a prop that is a word, an overflow)
  is refused, and so is a prop written as NaN or Infinity. One effect makes at most `params.spawnMax`
  things (64; the content makes at most 8); a heal never takes; levels come at most a hundred at a time.
- **Things stay where a thing can be.** A place is a whole cell inside its map, or a holder that is
  there and is not the thing nor inside it. One goes only to a map that is loaded, in the portal
  graph, or named by a site. An essential thing may become anything that can act (a spell that
  turns one into a hen), and stays essential as it; never a thing that cannot act.
- **A rule that keeps failing is set aside.** A learned rule's outcome stops at its first refused
  effect; when a base rule refuses what a learned rule sent it, the sender is charged. After three
  failures, or at once for a chain that would not end, the rule goes into the state's `quarantine`
  (kept in saves): it answers no more, and its hole is open again.

**The twelve sources of the previous model**, all covered:

| Source | Here |
|---|---|
| 1, 2, 4: use a thing, put a thing, a bare hand nothing defines | an act; `use` is undefined at the root, and so are `handle`, `offered`, `receive` where nothing answers |
| 3: a blow with no reaction | `strike`, answered by the one struck |
| 5: stepping into a tile in a state | contact, hosted by the tile |
| 6, 7: free intent, open conversation | acts, reserved |
| 8: a status or element cascade | a burning or wet thing emits impulses |
| 9: creatures meet things | contact, each side for itself |
| 10: a goal is blocked | `stuck`, hosted by the person; the outcome may change their script |
| 11: a witness | `seen`, hosted by the seer, carrying the act and its outcome |
| 12: content invalidated | `broken`, hosted by the story; the authored fallback is its default |

**Gaps in the previous model**, closed above:

| Gap | Closed in |
|---|---|
| a torch put in a chest made no event | containment is a relation (§5.10) |
| contact came only from steps, not from terrain changes, spawns, destroys or type changes | the relation difference (§5.10) |
| any rule could write the story's facts or another person's schedule | the story owns its facts; others notify (§5.8) |
| NPCs off the active map jumped between anchors with no relations | dormant maps are frozen; entering places people, then diffs (§5.12) |
| only hp and hunger had thresholds, in engine code | thresholds are declared in data (§5.7) |
| the crafting panel, dropping and chest transfers changed state directly | they are acts |
| walking into something solid was no event | `bump` |
| only one kind of blocked behaviour was reported | behaviour reports `stuck` wherever it cannot go on |
| ties between host specificity and kind specificity were undefined | host first, then kind; ties rejected (§5.6) |

**What this does not guarantee.**
- That a patch is sensible: the validator checks form (writes only its host, fills only
  holes, names classes); plausibility is review's job.
- Art for a type the AI creates.
- How well behaviour is written. It only guarantees that behaviour reports `stuck` when it
  cannot go on.
- Thresholds that were never declared.
- Influence at a distance that no outcome emits: there is none, by A3.

### 5.14 Migration (done 2026-10-02)

The code runs the event model. The previous model's text is in git history, at commit `8be3fbb`.

**What moved.**

- **State changes only in outcomes.** The 42 places that changed state outside the effect
  runner (counted 2026-10-02: damage, movement, teleports, the bag, drops, chests, crafting,
  scene steps, off-map jumps, foraging, hunger, `goto`, loading) are events and base rules now.
  The world's mutators check a write guard: `world.strict` makes any change outside an outcome,
  the clock or loading throw, and the demo's proof runs with it on.
- **Base rules split in two**: the instrument emits an impulse, and the receiver answers it.
  An axe used on a tree emits `strike cut`; the tree, struck by a cut, counts the blows and
  falls.
- **Removed**: the salience filter, the per-kind budgets, the ask cap per session, fallback
  rules and `strict` patterns, composed rules, origin-dependent asks and waits, the world's
  special fallbacks.
- **Rewritten**: the ModSpec, the validator (locality, holes only, ties), the modder's prompts,
  brief, signature, deterministic fixes and derived tests, the coverage tool (it counts holes),
  and the demo's proof (`tools/test/demo.test.ts`, game-design.md §9), which now also checks
  §5.13's table: the root is total, no ties, rules write only their host, the kinds are closed,
  a whole day in strict mode, the relation difference, and the three ways across with no AI.
- The shared library of the previous model (101 patches in the old shape) was archived as
  `var/library.pre-event-model.jsonl`; the live library starts empty.

**Where the implementation refined the design.**

- **Patches form a layer of their own.** Base rules and patches are kept apart. An event is
  resolved through the base rules first; only when that reaches an undefined leaf are the
  patches consulted, most specific first. So "a patch only fills holes" (§5.11, rule 4) holds by
  construction, not by a decision procedure; the validator checks that the triggering event
  now resolves to the patch.
- **Two more acts**: `move` (a step, or going to a place) and `craft` (a recipe from what is
  carried). The bag, drops and chest transfers are `put` and `take` with an `into` parameter.
- **Containment names both sides**: `in`/`contains` and `held`/`holds` (as `on`/`under`).
  Regions are not relations yet (`in-region` is reserved).
- **A tile's relation carries its terrain**, so ice thawing to water underfoot ends one contact
  and begins another, whatever caused the change.
- **Ties are decided on answering regions.** Two rules tie when one event could reach both at
  equal specificity: the same kind, the same specificity, hosts that overlap, and answering
  cases that can hold together (conjunctions over roles' types, tags, statuses, prop ranges and
  parameter values, decided against the ontology). Rules that split one host's cases between
  them (a plank put on a frame, a plank put on a stick) do not tie. The base library has none.
- **Touch is physics at the root.** `contact begin` has a root rule: what burns burns what
  touches it, charged ground shocks what stands on it, wet ground wets it. Types override it
  (lava, the river's edge, a fire slime).
- **Put places; use applies.** Pouring water or oil and holding a flame to something are `use`
  only; putting a vessel or a torch somewhere sets it there (into a chest too).
- **Scenes write only the story.** A scene moves people by sending them a `push` to the place,
  which they answer themselves; it notifies the player of their stage.
- **Rain is water without force**: it wets and douses, it does not wound (a fire slime steams
  in it).
- **Events no rule could answer are not made** (`offer`): a contact `end` or `stay` with only
  the no-change root behind it is passed over, which is the same as dispatching it and changing
  nothing. Every kind is still made where some rule answers it.

### 5.15 Completeness enforced (2026-10-04)

Systems added after the migration (companions and the tutorial's beats, quests, professions and
the skill tree, combat talents, the seven sins, the night) changed the state outside outcomes:
striking Lumi down changed nothing the world could answer, a quest wrote the player's bag from
code, the night made and unmade creatures from the clock's code. The guard of §5.14 could not
see it: it was on only in tests, and any code could take the writer. A2 and A3 are now held by
construction, always.

**The writer.** The world's mutators (place, add, destroy, transform, a prop, a tag, a status,
terrain, a fact) throw unless the one writer is lent to the caller. The engine claims it when it
is made (`World.grant`, once) and lends it to: an outcome (`run`, scoped to its host), the clock
(a status running out), loading (a map, a save brought up to date), the input's posture (what is
in the hand, the slots) and the author (`Engine.author`: tests, world building, the dev console,
migrations of older saves). Within an outcome the mutators also throw unless what they change is
the host, something the host holds, or something the outcome made; a fact unless the host is the
story or the world. A write error is never swallowed as a rule's warning. A scan of the engine's
and the content's source (`tools/test/writes.test.ts`) finds no write behind the mutators (a prop,
a tag, a status, a place, a fact set by hand) outside the world, the effect runner and loading,
and no use of the author's hand in game code.

**Not state.** An actor's posture (which way it faces; what the input puts in its hand) and its
behaviour's memory (a creature's chase, a path, an encounter's telegraph, cooldowns, and
`Entity.combat`: the memory of its own blows and steps — combos, chains, the windows a talent
opens) are its own: written only by its own behaviour and outcomes, never read by rules.

**The systems, as events** (no new event kind but one act):

| Before | Now |
|---|---|
| the companion moved itself by code; struck down, it flew on | each hop is an act of moving (a flyer goes over what stops walkers); when it cannot go on it reports `stuck` (activity `follow`), undefined at the root: the AI answers; with none it waits and comes to |
| beats wrote the leader's props and facts | the story's script (as a scene's): its facts, and a notice of the stage the leader keeps itself (`body/stage`) |
| the dispatcher counted the player's experiments | a companion sees an act whose chain reached an undefined outcome (`seen`, `defined` false: the act and all it set going) and tells the story (`companion/witness`) |
| the teleport set `visited.<map>` facts for the player | the traveller's own props, in its outcome |
| a quest wrote facts, the player's props and bag from the person's rule; the dispatcher counted defeats by the player | the person tells the story; the story's `quests` effect writes its facts, spawns the reward into the taker's bag, notifies the taker (experience, stage) and sends the brought things a `taken` into the giver's bag; a defeat tells the story what fell (`{typeOf}` param), counted for the quests its feller took on (`q.<id>.by`). **2026-10-09** (docs/quests.md): a quest under way is a resident thing of its own; it sees news (a `seen` event) and moves on as its own outcome (`advance`, `stage`), writing only itself; the story begins quests (`begin`, `startQuest`) and keeps the facts it is told (`facts`) |
| the skill tree and the trainer wrote the player's tags and props | `act/learn` (param `skill` or `profession`), like `craft`: the actor's outcome (`learn`) |
| talents healed the striker and bled the target from the striker's code; a clock hurt and healed | the act carries `bleed` and `drain`; the struck one's `hurt` opens `bleeding` and sends a `restore`; `adrenaline` is a status; recoveries on a defeat are the striker's rule (the defeat carries the last blow's instrument) |
| the dash, waypoint travel moved by code | acts of moving |
| a sin's release struck, stepped and statused its victims from code | the sin's act (`use`, its own body), answered by `release` (since 2026-10-16 `unleash`, docs/skills.md): strikes, a push, a coat they answer |
| the night made and destroyed creatures from the clock's code | the world's `night` period → `appear` (world-only); the night-born's own `dawn` rule destroys them |

**Two general refinements.** A status remembers who gave it (the outcome's actor): its time
events name them, so a bleed or a fire one set fells in their name. A status may keep its own
pace (`every`): it pulses counted back from its end, the last pulse as it ends.

Sources:

- Stardew Valley:
  - wiki pages [Controls](https://stardewvalleywiki.com/Controls),
    [Inventory](https://stardewvalleywiki.com/Inventory),
    [Friendship](https://stardewvalleywiki.com/Friendship),
    [Energy](https://stardewvalleywiki.com/Energy),
    [Day Cycle](https://stardewvalleywiki.com/Day_Cycle),
    [Options](https://stardewvalleywiki.com/Options),
    [Player Menu](https://stardewvalleywiki.com/Player_Menu),
    [Crops](https://stardewvalleywiki.com/Crops);
  - decompiled 1.5.6 source ([WeDias/StardewValley](https://github.com/WeDias/StardewValley)):
    `Game1.pressActionButton`, `Game1.pressUseToolButton`, `NPC.checkAction`,
    `Farmer.magneticRadius`, `Objects/Chest`, `Menus/ItemGrabMenu`, `Menus/DayTimeMoneyBox`.
- Oblivion:
  - [What was Radiant AI, anyway?](https://blog.paavo.me/radiant-ai/) (low processing);
  - [the Escapist on Oblivion's NPCs](https://www.escapistmagazine.com/oblivion-npcs-brought-their-world-to-life-then-they-nearly-killed-it/);
  - [UESP: Crime](https://en.uesp.net/wiki/Oblivion:Crime);
  - [CS Wiki: AI](https://cs.uesp.net/wiki/AI_Button).
- Skyrim:
  - [UESP: Respawning](https://en.uesp.net/wiki/Skyrim:Respawning);
    [CK: Cell Reset](https://skyrimck.uesp.net/wiki/Cell_Reset);
  - [UESP: Story Manager event nodes (SMEN)](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format/SMEN);
    [Creation Kit: Story Manager](https://ck.uesp.net/wiki/Category:Story_Manager);
  - [Beyond Skyrim: World Interactions](https://wiki.beyondskyrim.org/wiki/Arcane_University:World_Interactions).
- Minecraft: [chunk loading and lazy chunks](https://ggservers.com/knowledgebase/article/chunk-loading-and-lazy-chunks-in-minecraft-java-edition/);
  [spawn chunks](https://minecraft.fandom.com/wiki/Spawn_chunk).
- RimWorld: [Caravan](https://rimworldwiki.com/wiki/Caravan).
- BardOS: `docs/overview.md`, `demo/loom/src/interact.ts` (free action, conversation,
  examine/trigger, ambient arrival, opening), `demo/loom/docs/quests.md` (the stage
  invariant).

### 5.16 Learned rules take one leaf (2026-10-09)

Agreed with the user, and built. A patch used to name a class (`{type: "item/weapon"}`,
`{tags: ["edible"]}`) and join a layer of learned rules ranked by specificity. Three things
followed from the ranking: two learned rules could tie (the validator refused the later one, and
the modder learnt to add tags to win the ranking); a later, more specific one could shadow an
earlier one, so every patch was replayed against the scenes earlier ones answered (the regression
set); and once a broad patch filled a hole, nothing more specific was ever asked about any
instance of its class. A second observation: none of this guarded anything. What the base rules
define is resolved before the learned layer is consulted at all; a learned rule may not have an
undefined leaf; `inherit` ran on to the next learned rule. So no patch could ever make a defined
outcome undefined, and the regression replay could only ever report a shadowing it then allowed.

**Now a learned rule is one type's, placed at one leaf.**

- Its host is exactly `{type: T}`, the type of the event's host instance; its `on` is the exact
  event kind; `hole` names the base hole it fills (`holeKey`: the base rule and the branch that
  reached it); `at` is the path in the type's tree for that hole to the open leaf it replaces
  (empty for the first answer). The four are set from the request by the harness (`placePatch`),
  never by the model, which writes the tree.
- For each (type, kind, hole) the library keeps **one tree**, composed from its answers in the
  order they were learned: the first answer is the tree; each later one replaces the open leaf at
  its `at`. A leaf keeps the answer it came from, so the rule that decided an event is known, and
  an answer set aside at runtime (`quarantine`) leaves its leaves open again.
- A learned rule never writes `inherit`. A case it does not answer ends in `{"undefined": true}`:
  it stays open, and is asked later; the base hole's default runs there meanwhile. An `if` needs
  an `else`.
- Resolution: the base chain as before; at a hole, the host type's own tree for that hole;
  `Resolution.open` says where an answer would go (the key and the path), and the request carries
  it (`hole.at`). The class key includes it: one question per open leaf and class.

**What this removes.** Ties, the regression set (the client's ring of recent acts, the service's
FIFO, the validator's step 7), `overrides`, `narrowKinds`, and the sibling generalization test (a
learned rule has no siblings; its derived test is the scene that asked). The validator's checks
on a learned rule are: schema, ontology, locality and the world-event boundaries; its place (with
the scene that asked: the host's type, the kind, the hole and the open leaf it reaches; without
one: a first answer, or an open leaf of the library's tree); the sandbox replay of the triggering
event (it resolves to this rule); the repeat check; its own tests. Monotonicity over the base is
by construction, not by test.

**What it costs.** Generalization moves out of the learned layer: a class-wide answer ("natural
fixtures hold nothing put on them", which once answered 1,638 cells) is now one answer per type
reached, and sibling types are answered independently and may disagree. That is the intended
division: the live layer answers one type at one leaf and never interacts with another answer;
what holds for a class belongs in the base rules, which the offline loop may propose (a repo
change with tests, merged by a person) and which then makes the learned trees under it stale
(`RuleLibrary.stale()` lists answers whose leaf is gone or already answered).

**Older patches.** A learned rule without a place (a class host, no `hole`) is kept in a library
but never consulted; `library prune` lists and rolls back what the validator no longer takes, and
`restoreLibrary` drops it from a save with the reason.

**Found in review (the same day), and held to:**

- A leaf that says `undefined` and carries `do` at once is open: the validator refuses it, and the
  engine reads such a leaf as open whatever it carries.
- A question's place is read off the scene **as the library is now**, not as it was when the
  question was asked: another answer may have grown the tree since (the open leaf moved) or taken
  the case (then nothing is placed, and the request is covered). `placePatch` does this in the
  pipeline, the repo mode and the port, so a stale request is still answered.
- A learned rule set aside at run time (`fault`, `quarantine`) answers no more: its own leaves are open
  again for the validator's replays as for the game, while its tree keeps its place, so the answers
  grown below it keep answering (`RuleLibrary.setAside`, kept in saves as `aside`). The same answer
  sent again is refused, and the hole's default runs (the port).
- A rule's `hole` must be an open leaf of a base rule that exists. So a base rule whose branches
  change makes the learned rules below it fail validation on restore, sync and prune, with the
  reason, instead of silently never being consulted; what grew below a rule that is not restored
  is dropped with it (`restoreLibrary`, `stale()`).
- A revision takes its predecessor's place in the tree (the log entry says what it `replaces`;
  `RuleLibrary.add(rule, at, inPlaceOf)`), so the answers that grew below the old one keep their
  place where their paths still fit.
- A boss is not lashed down by a handful of grass: `creature/offered` leaves bosses to their own
  kind's answer.

**The god loop held to its own review (`fix/god-loop`, the same day):**

- A learned rule may give the story a topic and nothing else (`notify` with `what: topic`); a stage,
  a defeat, a reward, a status are the game's own news. The records trust only their own sources
  besides: a person keeps a stage told by the story, a book or a skill (`body/stage`), the story
  settles a quest's word from a person and a defeat from the one felled (`story/quests`).
- The validator knows every tag the world has (the types', the terrains', the instances', the base
  rules') and refuses one nothing carries; families made at run time (`skill:`, `profession:`,
  `faction:`…) pass by their prefix.
- The repeat check counts what the actor gains as a yield too: experience or fullness that goes up
  with nothing between.
- The auditor's deterministic probe runs first: the scene's own act thirty times, with the patch and
  without it; things made or numbers gained beyond what the world gave without the patch are a
  farm, found with no model call. The model is asked only when the probe finds nothing. Its acts
  reach as far as the event did (as the validator's replay).
- A reviewer that gives no verdict before shipping is no review: the rule ships and is reviewed
  after the fact, flagged so. In the repo mode, what the auditor broke goes back to the agent once
  (the findings and the draft in its issue), as the pipeline gives it to the designer.
- A client reports a learned rule it set aside (`POST /fault`); past the harness's bound
  (`faults.remove`, two clients) the rule leaves the shared library and goes to an offline revision.
- While a scene plays, the world's own questions hold nobody: the default runs at once and a late
  answer still applies. A step with a region is looked at again every three seconds while one
  stands in a region (a thing picked up there, the hour), not only on entering it.
- Cost: a sandbox shares the world's ontology (the index copies on its first write) instead of
  cloning 334 types per build; a library builds its indexes once when made or cloned, not once per
  rule; the validation proof's key is the library's version, not every rule stringified; a request
  whose host type has no learned tree at its hole skips the covering replay.

**The base's general cases (the same day).** With generalization moved to the base, the base
took the class-level answers the curriculum had been learning one patch at a time
(`rules.ts` GENERAL): a thing used on a creature is held out to it, as §5.2 says (`core/use`);
a creature lashed down by anything fibrous and fed by anything edible, else its own kind's to
answer (`creature/offered`, still a hole at the root); a wild creature snapping at a bare hand,
animals left to their own rules (`creature/handle`); a cell only touched by a bare hand, but a
place of the overworld entered (`tile/handle`); a lit fire drying and thawing who warms their
hands at it (`fire/warm-hands`); ore smelted in a lit forge into its bar (`smelt/ore`, the ore's
`smelts`; iron and gold ingots are forms now); a down companion waiting (`companion/stuck`); and
anything swung as a blow striking. What §5.2 calls the player's experiments — a thing used on the
ground, on an item, on a person, on oneself, on a fixture with no purpose — stays undefined on
purpose: that is where the AI's answers are interesting, and it is most of the 27,213 `core/use`
holes left. The planner no longer lets the ground's "touched" take E away from an unanswered
thing in front (`controls.ts`: what one stands on wins only with an answer that does something).

### 5.17 What a thing affords (2026-10-25)

Agreed with the user, and built. The case: a bare hand on a chair, again and again, said only "this is a chair".
Three things were behind it. No model was connected, and the hole's default (`core/handle`) read like an
inspection label while the HUD still promised, with its `?`, that the world would learn. With a model (the paper's
running eval, 2026-10-19) the answer was `patch/chair-sit-rest`: labelled "Sit down", it healed the one who sat
by 3 and put a status on the chair. Sitting had no channel: a rule writes only its host, the impulses into an
actor are blows, elements, coats, restores and pushes, and an answer on the actor's side would be one exact type's
(§5.16), so the player's alone. So a heal stood in for it. And any answer closes its (open leaf, class) for good,
so a chair answered with words could never grow a use.

The criterion: **an answer is faithful to what the thing affords for this act and to what a player would reasonably
expect, in context** (whose it is, where, who is near: knocking on a stranger's house wall may matter, on a cliff it
does not). Things with a common use (a chair: sit; hay: lie; a well: draw water) get real state; things with none
get a short in-world line, or nothing. It is not "every act must change the world".

- **The judgment.** The design answers `{"affords": "use" | "words" | "none", "patch": …}`, the judgment first. The
  harness holds the answer to it (`packages/modder/src/affordance.ts`): words or nothing that change the world are a
  use; a use it said that changes nothing in the scene that asked (only words, or an impulse its receiver does not
  answer) is sent back once, and kept as words if it comes back the same; an answer that says nothing is judged by
  its rule, and never sent back. The verdict is written on the answering rule
  (`Rule.affords`). The prompt no longer says "prefer outcomes that change something", which pushed toward
  invention; the reviewer's flag on a rule that only speaks asks it to check the judgment instead.
- **Context.** The request carries `context.whose`: the host's owner and their relation to the doer (the society
  module's `ownerOf`, `relation`), the rooms it stands in, the people near with their regard toward the doer.
- **Postures, the material.** `POSES` (sit, lie, kneel, lean) is the client's vocabulary as `OVERLAYS` is: a
  status may carry `pose` (drawn so: lying turned, seated with the legs folded onto the seat, kneeling lower,
  leaning tilted) and `untilMove` (it ends as its bearer moves from its cell: the effect runner ends it after any
  primitive that carried the host off). The standard library has `seated`, `lying`, `kneeling`, `leaning`; `down`,
  `out_cold`, `asleep` and `jailed` declare `pose: lie` instead of the client knowing their ids. A new impulse,
  `settle {pose, status?}`, is how a thing asks the one who used it to take a posture; the root answers it for every
  actor (`core/settle`: the `posture` primitive, onto the thing's cell when the body fits there, beside it to lean),
  any other host leaves it open. So sitting costs one hole, on the chair's side, and anyone sits: a person of the
  village as the player. A patch may also carry the receiver's rule beside its own (the validator always placed it;
  the ModSpec says so now), for a channel the receiver does not answer yet.
- **Words are provisional.** An answer judged `words` stays open to growth. When the player does the same act on the
  same answer a third time within two minutes (`AGAIN_AFTER`, `AGAIN_WITHIN`: a stray press does not count), the
  port asks again (`ModRequest.again`: the rule, its line, how many tries), held like a hole, the provisional words
  as the default while it waits. The service does not let the words cover their own question; the answer replaces
  them in place (the revision path: `replaces`, `inPlaceOf`) and is final (`Rule.reasked`). `none` is decided at
  once. So a (hole, class) costs at most two calls.
- **No model.** The `?` is shown only while a modder with a model is up (`worker.ts` `asks`), and the default of a
  bare hand on what nothing answers says what was done ("You run a hand over the chair.").

**The evaluation** (`npm run eval:affordance`, `tools/src/eval/affordanceSet.ts`): a bare hand on sixteen things the
base rules leave open, eight with a common use (chair, bench, log bench, stump, haystack, well, fountain, someone's
chair with its owner by) and eight with none (boulder, fence, statue, lamppost, mist, dead tree, table, counter). A
use passes when it was judged a use and the scene changed; a thing with none when it was judged words or nothing and
the scene did not change. It reports both errors apart: `invented` (a use given to a thing with none) and
`shrugged` (words for a thing with a use). A first answer of words is then asked again as a player would ask it
(two more tries), and the final verdict is that second answer.

Kimi K3 (OpenRouter), the live profile, 2026-10-25:

| Run | First answers: uses / none | Invented / shrugged | Final, after asking again | Invented at the end | Calls, cost |
|---|---|---|---|---|---|
| no asking again yet | 6/8 · 8/8 | 0 / 2 | — | — | 16, $0.61 |
| asked again, "they expected more" | 6/8 · 7/8 | 1 / 2 | 8/16 | 7 | 26, $0.56 |
| asked again, judged on the thing alone | 6/8 · 8/8 | 0 / 2 | **14/16** | **0** | 26, $1.07 |

Chairs, benches, a stump and a haystack were sat or lain on (the someone's-chair case too); a boulder, a fence, a
statue, a lamppost, mist, a dead tree, a table and a counter got a line true to them. The second run showed what the
signal costs: told the player "expected more", the model gave the things with no use the one use any of them could
have — leaning (on a boulder, a fence, a lamppost, a table, a counter) or a stick snapped off the dead tree. The
re-ask now says trying again is no sign of a use and a use made up is worse than a line, and the ModSpec says a
posture is a thing's use only where that is what it is for. The two misses are the well and the fountain, judged
words both times ("drawing it needs a vessel, which a hand is not"): defensible for a bare hand, so the labels, not
only the model, are in question there. A larger set and other models are for later.

## 6. Rule system

The shape below is the event model's (§5.6), agreed 2026-10-02 and built (§5.14).

### 6.1 Rule shape

Rules are **data** (JSON), not engine code. A rule names its host type, the event kind it
answers, and a condition tree:

```jsonc
{
  "id": "nature/lava-burns",
  "host": "tile/lava",                         // whose nature this is
  "on": "contact/begin",                       // a kind of the event tree (§5.7)
  "tree": {
    "if": { "how": "under" },                  // something stands on me
    "then": { "emit": [ { "to": "other", "impulse": "element", "element": "fire", "power": 6 } ] },
    "else": "inherit"
  }
}
```

```jsonc
{
  "id": "creature/fire-slime-takes-fire",
  "host": "actor/creature/slime/fire_slime",
  "on": "impulse/element",
  "tree": {
    "if": { "element": "fire" },
    "then": "undefined",                       // the AI answers it; with none, no change
    "else": "inherit"
  }
}
```

- **Conditions** select by the host's own type, tags, statuses and props; by the event's
  parameters; and by the other participants' public types, tags and statuses. They combine
  with `all`, `any` and `not`, and compare props, time, weather and standing.
- **Leaves** (§5.6): `effects` (an empty list means no change), `emit`, `inherit`, and
  `undefined` with an optional authored default.
- **Effects** are drawn from a fixed, typed set of primitives that act on the host:
  `transform, destroy, move, addStatus, removeStatus, setProp, addProp` (a cell is made of
  things, world-model.md §4.6: water freezing is the water transforming), `spawn, dropContents,
  setScript`; presentation: `say, log, vfx, emote, scene`.
  `emit` sends an impulse or a notice to a role, an area, a line, a direction, or a named
  receiver (§5.12).
- Adding a primitive, a condition or an event kind is an engine change; adding behaviour is
  data.

### 6.2 Specificity

Several rules may cover an event. The most specific runs:

1. the host: an instance-bound rule, then the deeper type;
2. the event kind: the deeper kind.

Two rules that tie on both are rejected by the validator. There is no `priority` and no
`compose`: an event has one outcome, and `inherit` is how a special case falls back to the
general one. A patch extends behaviour for a special case by adding a more specific rule; it
never edits the general one (§5.11, holes only).

### 6.3 Elements and the environment

The elements are `fire, water, ice, lightning, wind, earth` (the ontology). An element reaches
a thing as the `element` impulse (§5.8) from whatever emits it: a burning thing, rain, a frost
wand, lava. How the thing answers is its own rule. The root answers by physics (§5.9), so the
classic reactions are general rules on parent types:

- wet + fire → **vaporize**: the water goes, steam rises;
- wet + ice → **frozen**: water tiles become walkable ice;
- wet + lightning → **conduct**: the wet thing re-emits lightning to the wet things it touches;
- burning: a period that emits `element fire` to the flammable things around it, each by
  chance, until the thing burns out;
- oiled + fire → **ignite**, a burst.

Tiles carry statuses, so combat and exploration share one physics: douse a burning house with
a bucket, or lure enemies onto a puddle and strike it with lightning. All randomness uses the
engine's seeded PRNG, so replays are exact.

### 6.4 Combat (on-map, real-time)

**No judgment is "is it the player".** Who attacks whom, who sees what, who collapses and who
flees are decided by data that any actor can carry. The player is an actor/person like any
other; only the input knows which character the keys move.

- **An attack is an act.** Using a weapon (or a fist) on a target emits `strike` with power,
  edge and element. The one struck answers: base rules take health by power less defence,
  and the elemental reactions apply.
- **Defeat is a threshold.** At health 0 the actor answers:
  - an `essential` one (every person, the player too) goes down for 30 s and comes to with
    half its health;
  - the rest are destroyed. They drop what they hold and notify the one who struck them, who
    gains experience.

  Nobody attacks one who is down.
- **Who attacks whom is behaviour** (§5.4):
  - **Factions** are data (`Ontology.factions`). Content has `folk` (every person, the player
    too) and `wild` (creatures), and the wild are hostile to folk.
  - **Temper**: `aggressive` (always), `nocturnal` (after dark), `wary` (never).
  - **Foes**: whoever strikes an actor becomes its foe, attacked on sight.
  - **Leash**: 8 tiles from where it lives.
  - **Fire**: creatures that are not fiery keep 2 tiles from a lit or burning thing.
  - **People run**: a person within 3 tiles of one who would attack them steps away, towards
    a fire's protection.

  An outcome can change any of these on its host (`setScript`).

## 7. NPC simulation at scale

- Behaviour is the game's own logic (§5.4). Each NPC has a **schedule**: a list of
  `(time window, place, activity)` entries (home → work → tavern → home), with variants by day,
  weather and facts; creatures have their temper. Behaviour submits the same four acts as the
  player, and reports `stuck` wherever it cannot go on.
- **The active map** runs in full: tile pathfinding (A* over a cached walkability grid),
  animations, every event.
- **Dormant maps** are frozen (§5.12). People's records stay resident. Entering a map places
  its people by their schedules; a person whose schedule leads to the active map walks in
  through the portal.
- Budget target: the active map holds up to a few hundred actors at 60 fps. The rest of the
  world costs what events reach it, not frames.

## 8. The Mod port (the AI slot)

The port is the exact contract a modder implements. In Phase 1 it was exercised by hand from a
dev panel; since Phase 2 the modder service (§13) is the provider, and the engine did not
change when it was plugged in. Below is the contract for the event model (§5.11), as built.

```ts
interface ModProvider {
  resolve(req: ModRequest, spec: ModSpec): Promise<Patch | null>   // null = declined / failed / offline
}

interface ModRequest {
  id: string
  summary: string                               // one line: "green slime is sent offered (the thing: Rope)"
  origin: 'player' | 'world'                    // who started the chain
  event: {                                      // the event whose outcome is undefined
    kind: EventKind
    params: Record<string, unknown>
    host: EntityInfo                            // whose nature the patch describes
    roles: Partial<Record<RoleName, EntityInfo>>
    detail?: string                             // what a world event is about, in words
  }
  hole: { rule: string; path: string[]; default: Effect[] }  // the base rule whose leaf is
                                                //   undefined, the branches taken to it, and
                                                //   what runs while nobody answers
  context: {                                    // map, anchors, hour, nearby things, the 7×7
    map; anchors; hour; nearby; tiles;          //   terrain and its statuses, recent lines,
    tileStatuses; recent; rules: Rule[]         //   and the rules already consulted for it
  }
  scenario: Scenario                            // a self-contained 7×7 snapshot to replay
}

interface ModSpec {
  ruleSchema: JSONSchema                        // the rule shape (§6.1)
  events: EventKindTree                         // the kinds and their parameters (§5.7, §5.8)
  primitives: PrimitiveSpec[]                   // every effect op + its argument types
  ontology: { types: TypeTree, tags: TagDef[], statuses: StatusDef[], elements: string[] }
  assets: { vfx: string[], sfx: string[], anims: string[], sprites: SpriteIndex }
  rules: string[]                               // authoring rules: write only the host,
                                                //   classes not instances, fill only holes, …
}

interface Patch { artifacts: Artifact[]; note?: string; author?: string }
type Artifact =
  | { kind: 'rule';   rule: Rule }          // a host rule; rule.tests carries its own tests
  | { kind: 'type';   type: TypeDef }       // a new type if the outcome needs one (it inherits)
  | { kind: 'status'; status: StatusDef }   // a new status if the outcome needs one
```

Lifecycle of a patch:

1. **Detect.** An event reaches an undefined leaf.
2. **Hold.** The participants and the actor who started the chain wait, and show a working
   animation. The rest of the world keeps running.
3. **Request.** The `ModRequest` is built and sent through the configured provider. With no
   provider, the leaf's default runs at once.
4. **Validate.** `validatePatch` runs, and the engine is the trust boundary:
   1. schema;
   2. ontology (types, tags, kinds and assets exist);
   3. effect types;
   4. **writes only its host**;
   5. **fills only holes**: by construction — patches are consulted only where the base rules
      reach an undefined leaf (§5.14), and the replay must resolve to the patch;
   6. its place: one type, the exact kind, the hole and the open leaf the scene reaches (§5.16);
   7. **sandbox replay** of the triggering event and of the patch's own `tests`, on a copy of
      the state; the repeat check.
5. **Apply.** The rule enters the library; the held event is replayed and now reaches it.
6. **Persist** (§9).

A failure at any step runs the leaf's default; the game never blocks.

As built (2026-10-05): the service keeps bounded validation proofs keyed by the library
version and the contents of the ontology, workspace, scenario and candidate
artifacts. Adding only tests replays the added tests. Commit reuses a proof only when its
shared-library context matches exactly; any context change requires full validation. Both
luck branches of the repeat check remain.

As built (2026-10-05): request scenarios keep the participants' holding closure, the story
and world props, and storeys. Terrain rows supply each ground cell's top; cell overrides keep
the actual types and state below it and upstairs. Cover above participants is kept before
the limit on loose neighbours. Cell roles use `tile:x,y[,z][:space]`.

As built (2026-10-05): a status artifact may repeat an existing definition, but cannot change
one from the base ontology, shared library or an earlier artifact in the patch. Object key
order does not change a definition. This keeps ontology additions inside the same boundary
as rules that only fill holes.

**One question at a time.** A request is keyed by its hole and its class (the host's type, the
event kind, the parameters the tree branched on, the other roles' types). While one is open,
the same key waits for it. Once it is answered, the class never asks again. A late patch still
applies.

**Dev panel (Phase 1):** lists undefined outcomes as they happen, shows the exact `ModRequest`
JSON, and lets a human paste a `Patch` that goes through the same validate → apply → persist
path. This proves the port end to end without an LLM, and the logged requests become the
modder's test set.

## 9. Persistence and the shared rule library

Two stores, deliberately separate:

| Store | Holds | Scope |
|---|---|---|
| **Rule library** | type-level rules (base + patches), versioned | **global**, shared by all players |
| **Save** | world state of one playthrough (positions, inventories, statuses, quest stages, per-save canon) | per player, in the browser (IndexedDB) |

- A type-level rule ("water douses fire") is physics; it is shared, so one player's
  undefined interaction improves the world for everyone and the LLM cost is paid once.
- Every rule carries provenance (`base` / `patch`, author, request id, timestamp) and
  the library is versioned (append-only log + snapshots), so any patch can be rolled
  back or ablated.
- The modder service hosts the shared library as an append-only patch log
  (`var/library.jsonl`: one line per accepted patch or removal). Clients pull the log and
  run every patch through their own validator; the browser keeps a local copy (IndexedDB),
  so the game still plays offline with what it has learned.

## 10. Content at scale

- **Ontology first**, then instances. Items are generated from ontology templates
  (material × form × quality × element…), so tens of thousands of items are consistent
  and rule-addressable.
- **Maps**: a handful of hand-crafted landmark maps (capital, key towns) in Tiled; the
  rest generated from a semantic layout (districts, roads, buildings, water) → tiles
  with autotiling; interiors and dungeons from room templates.
- **NPCs**: generated with role, home, workplace, schedule, faction, appearance
  (layered sprite parts + palette).
- **Art**: Ninja Adventure 16×16 base; characters composed from layers; items get a
  category icon + palette swap + small overlay badges; statuses render as shader
  overlays (burning, wet, frozen, electrified), so no new art is needed per state.
- Later, the same modder authors content offline in bulk against the same ModSpec — the
  world is *written* large offline and *patched* free online by one mechanism.

## 11. Deployment

- `client` builds to a static site (Cloudflare Pages / Vercel). World chunks are static
  files next to it. Open the URL → play.
- Saves live in the browser, with each dormant map's inbox and saved relations (§5.12). The
  rule library is fetched at boot and synced from the modder service.
- One API service (later) hosts the modder and the shared rule library, with per-player
  rate limits.

## 12. Phase 1 — infra (current scope)

Deliverable: the game runs in a browser at target scale, and the Mod port works end to
end by hand.

1. Engine in a Worker: world model, ontology, rule engine (patterns, guards, specificity,
   primitives, tick/status events), seeded PRNG, save/load.
2. Client: Phaser rendering of Tiled maps, 4-direction movement, camera, portals between
   maps, HUD (held item, inventory, hp), status overlays, VFX presets.
3. Verbs: take / put / interact with the held-item slot; dialogue for empty-handed
   interact.
4. Base rule library: core interactions + elemental reactions + environment spread.
5. Combat core: hit events, damage rule, elemental reactions in combat, a few enemy
   controllers.
6. NPC schedules: full-fidelity pathing on the active map, coarse simulation elsewhere.
7. Mod port: detection, local freeze, `ModRequest` builder, `ModSpec` export,
   `validatePatch` with sandbox replay, rule library with provenance + versions, the
   dev panel.
8. Scale: a generated **stress world** at target scale (dozens of maps, thousands of
   NPCs, tens of thousands of items) with measured load time and frame rate; plus the
   hand-made Saenvar landmark maps.
9. Tests (vitest) for the engine: rule matching/specificity, every primitive, reactions,
   patch validation, save round-trip, determinism.

Acceptance: open the static build → walk across maps → take/put/interact → fire spreads
and is doused → fight with elemental reactions → trigger an undefined interaction →
see its `ModRequest` in the dev panel → paste a patch → it validates, applies, persists,
and fires again after reload.

### Phase 1 — what was built (2026-09-30)

All nine items above are implemented and verified in the browser: the static build plays from a
URL; take/put/interact, fire spread and dousing, elemental combat (vaporize, freeze, conduct,
explode), locked chests and keys, cooking, NPC talk, schedules across 460 maps; an undefined
interaction reaches the Mod Console, a hand-written patch validates, applies, re-resolves the
frozen interaction, generalises to other instances of the class, and persists across reloads.
Notes from verification that changed the design:

- Green grass is not flammable (only dry grass, bushes, trees and wood): otherwise one torch
  burns the whole map.
- Townsfolk pass through each other and path around solid fixtures; the player can push past a
  person by holding the direction (~0.8 s). Only the player steps on portals.
- Empty/full vessels and raw/cooked food are sibling types, not parent/child: children inherit
  tags, so a "water bucket" under "bucket" was still an "empty vessel".
- Conflict checking consults the ontology (plus instance-assignable tags such as materials);
  a unit test asserts the base library has no equal-specificity overlaps.
- Saves carry the world version; incompatible saves are discarded, rule-library patches are kept.

### Phase 1b — a small, polished demo first (2026-09-30)

Direction from the user: build a small but refined demo first, then scale. The default world is
hand-crafted; the generated 460-map world was removed on 2026-10-02.

- **Art**: the Ninja Adventure pack (CC0). `games/openworld/client/src/catalog.ts` maps every
  terrain, fixture, item, creature, character look, VFX, UI piece, music and sound to the pack;
  a preview page (`/src/assets/preview.html`) shows all of it.
- **Renderer** (`packages/runtime/src/render/`): 47-tile blob autotiling (table `BLOB47`) into a
  runtime ground atlas; terrain objects (trees, rocks, tall grass…) that follow terrain state
  (burnt → charred, chopped → stump); prefab buildings stamped by the map author with correct
  occlusion; nine-slice room walls; 4-direction animated actors; status overlays, projectiles,
  day/night light, music per map and sound effects.
- **World** (`games/openworld/tools/src/demo/`): an authoring DSL (terrain painting, prefabs, rooms,
  fixtures, items, creatures, portals). First Hearthvale (15 maps, 12 villagers), replaced on
  2026-10-02 by **the Ford** — one map, two people, minimal and complete (game-design.md).
- **Story as data** (`games/openworld/content/src/ford.ts`): objectives keyed by a player prop, rules
  on classes (the ferrykeeper, the peddler, the dead tree), and invariants that keep it winnable.
- **UI**: JRPG dialogue box with portraits, objective panel, and an action prompt that shows
  what E/F will do — including "the world has never seen this" for undefined interactions.

## 13. Phase 2 — the modder service (2026-10-01)

`packages/modder` closes the loop: an undefined interaction in the browser reaches the
service, which returns a validated patch, and the frozen interaction re-resolves under it.
The model is not chosen yet, so the model is an interface (`model.ts`). Anything
OpenAI-compatible plugs in (OpenRouter reaches most providers). A scripted model answers from
code or a file, for the tests and for running offline.

```
client worker ──POST /resolve {request, workspace}──▶ modder ──▶ ResolveReply {patch, outcome}
              ◀──GET /patches?since=seq── shared library log (every patch re-validated locally)
```

**Pipeline** (`pipeline.ts`), every budget and switch read from the harness file:

1. **Comprehend** — the request's signature: its verb, and each role's type chain, tags and
   statuses, as plain terms. If the shared library already answers the interaction (a sandbox
   replay of the request's scenario), the patch that did is returned with no model call
   (`covered`). Concurrent requests of one class wait for the first instead of paying twice.
2. **Recall** — relevant lessons, similar past episodes, and the skill index, all from the
   self-state. Retrieval is deterministic term overlap: no embeddings, so it can be inspected.
3. **Design** — a tool-using conversation with the ModSpec in the system prompt. The tools are:
   - `search_rules` and `get_rule`, over the rule library;
   - `find_types` and `get_type`, over the ontology;
   - `dry_run`: the real validator, plus a readable account of what the interaction does under
     the draft;
   - `read_skill` and `get_episode`, over the self-state.
4. **Verify / repair** — `validatePatch` against the shared library plus the client's own
   local patches and recent interactions (the *workspace*). The exact diagnostics go back into
   the conversation, up to the harness's repair budget.
5. **Review** — a second opinion on plausibility, scope, consistency and feedback. A `revise`
   verdict sends notes back to design, within a bounded number of rounds.
6. **Commit** — the patch is re-validated against the library as it is now and appended to
   it. Validation and append are synchronous, so the step is atomic.
7. **Record** — the episode: the request, every attempt with its diagnostics, the tools used,
   what was recalled, model calls and tokens, time. Skill use is booked against the outcome,
   and skills that keep doing worse than average are retired.
8. **Reflect** — after replying, the model distils lessons, which are added, supported,
   revised or dropped, each citing its episodes. It writes or revises a skill once that kind
   of work has recurred.

As built (2026-10-06), **the auditor** (`modder/src/audit.ts`), between verify and review: an
agent plays against the patch the way a player out to break the game would. It looks for farms,
cheap roads to rare things (a rope that becomes Dragonsbane passes the validator and the LP: one
for one), softlocks, harm, and runaway chains. It has the sandbox, not an opinion. Its tools are
`look` (the scene) and `run` (play acts, ticks and repeats in a copy of the scene, with the patch
and without it), and each finding is a setup, steps and claims (counts, props, statuses, a thing
gone or become another, an event count). The code judges: a finding counts only when the sandbox
shows it with the patch and not without it, so the model searches and never decides. The offline
profile audits before shipping, and what is broken goes back to the designer with the evidence. The
live profile audits after shipping, and what is broken leaves the shared library at once and goes
to one offline revision. An auditor that fails finds nothing; the journal's audit entry keeps its
`error`, so a failed audit is never counted as a clean one. Harness `audit {enabled, blocking,
rounds, reasoning}`.

**Client.** The worker probes `?modder=<url>` (default `VITE_MODDER_URL`; in development,
`localhost:8787`). If the service answers, the worker becomes the port's provider, waits up to
45 s for a patch (a late patch still applies), and syncs the shared library every 15 s. The
HUD speaks to the player ("Something new… the world is working it out" / "The world learned
something new: <doc>"), and the Mod Console shows the service and model. Without a service the
game is unchanged: undefined interactions fall back and can be patched by hand.

**Offline curriculum** (`npm run curriculum`). It takes a diverse sample of the interactions
the coverage sweep finds undefined, builds each one's request through the real engine path,
and resolves them as if players had tried them. It writes the same library and self-state as
the service does. This is how the world is written large without players, and how self-state
checkpoints are produced between benchmark runs.

**Verified:**
- 13 modder tests with scripted models, covering accept, repair, budget exhaustion, cache
  hits, coalescing, review/revise, skill writing and retirement bookkeeping, snapshots, the
  HTTP API, and the OpenAI wire format (tool calls) against a mock server.
- In the browser with the scripted offline model: rope on a slime goes undefined → the service
  returns `patch/fiber-binds-creature` → the slime is bound and the rope used up. After a
  reload the patch syncs back from the service. An interaction the model cannot answer falls
  back cleanly.

### Live latency (2026-10-01)

**Model.** OpenRouter, with the key in the gitignored `.env`.
- From where the team works, Anthropic, Google and OpenAI refuse requests (HTTP 403, a
  regional restriction).
- Among the models that answer, **Kimi K3** wrote the best patches. DeepSeek V4.1 Flash wrote
  a catch-all rule ("anything on anything: nothing happens"), so the validator now rejects
  interaction rules that select neither the target nor the instrument. GLM 5.3 was good but
  slow; Qwen 3.8 27B could not produce JSON.

**Where the time went.** Measured per call with `npm run latency`:
- The first design took ~100 s per patch, spread over 5–14 calls.
- Most of those calls were `search_rules` turns: up to 26 in one episode. Each turn resent the
  whole conversation and spent reasoning tokens.
- A single call is fast: 4.5 s median for ~11.6k input and ~440 output tokens, at low reasoning.

**What the live profile does now** (the harness's base settings; `offline` overrides them):

| Measure | Effect |
|---|---|
| **Brief** (`brief.ts`): the roles' types and the rules that already speak about this target or instrument, assembled by code | the model answers in one call, with no tools |
| **Low reasoning** | ~1,800 → ~50–150 reasoning tokens per call |
| **Deterministic repairs** (`fixes.ts`): a right rule in the wrong wrapper is re-wrapped; a conflict caused only by an extra verb is narrowed to the verb used | first answers valid 0/5 → 4/4 |
| **Derived tests** (`derive.ts`): the harness replays the rule on another instance of its class and keeps that as its test | fewer output tokens; a rule that does not generalize is flagged |
| **Tail guard**: providers pinned by measurement (`LSW_MODEL_PROVIDERS`); a hedge request to the next provider after 7 s; a 15 s deadline with one retry | stalls of 20–180 s seen before; OpenRouter's own throughput sort picked the slowest provider |
| **Review after shipping**: rules that only narrate, or did not generalize, are always reviewed. A "revise" verdict sends the rule to one offline revision, which *replaces* it in the shared library (remove-then-add in the log) | quality without a model turn on the critical path |
| **Escalation**: a live request that fails is worked again offline in the background | the player gets the fallback now; the world still learns it |

As built (2026-10-05): clean local, find and create routes share the reflection batch. Errors,
repairs, reviews and quality flags still cause immediate reflection. Working notes follow
the static ModSpec in the system prompt so its cache prefix stays intact. The brief sends
its closest rules in full once and the other related rules as summaries; live instructions
name only tools available to that call.

As built (2026-10-10), after a play session on the things the world makes:
- A draft that spawns or transforms into a type the world lacks goes to create with that id
  (`unknownMade`), unless the id is a slip of a known sibling; before, the repair rounds told the
  designer only "unknown type", and it learnt to swap in something known.
- A new thing made on a station (a rule whose branch asks for a workbench) is that station's
  craft: the harness sets its `station`, and its `yields` from the rule's spawn count
  (`stationFromRules`). Learned recipes reach the crafting panel and the build palette.
- What the world uses a thing by is checked on a new type: a food carries `edible` (or a drink
  `drinkable`; item/potion carries it) and fills by a positive `food`; what a base rule turns into the type a prop names
  (`TURNS` in mod.ts: a `plantable` seed its `cropType`, raw `cookable` food its `cookedType`, an
  `empty-vessel` its `waterType`, ore what it `smelts` into, a drinkable vessel its `emptyType`) names it; a thing worn names its slot, a thing made at hand or at a
  station is `portable` (it comes into the maker's hand; the harness adds the tag when it sets the
  station), and a new status its name in both languages. A status that holds one still always ends (a duration, given or defined). The create prompt says what tags are for; the ModSpec guide says that both
  ingredients of a thing made from two are used up, the other by its own answer.
- A revision may define again the types and statuses of the patch it replaces; prune judges it in
  that patch's place.
- An act an answer completes is replayed as `act` runs it, so a patch does the same the first time
  as every time after. A line about anyone agrees with "you" when the slot is the player.
- Every answer a client takes, its own included (`ModPort.adopt`), replaces a learned definition it
  kept when the library brings a corrected one. The library is every save's: a save brings back the
  learned kinds its own things need (`withKept`), and these stay out of the shared store. Each game
  keeps its own definitions (an Engine copies the world's), and on loading a client judges what it
  learned as the library's prune does (`forgetInvalid`).
- A thing that brings its picture is drawn by it (`art:<id>`) whether it names a sprite or not, and a
  definition taken anew redraws it in place; an agent keeps its kind's animated sheet. A cell draws the overlay of a learned status as a thing
  does. The model is shown each status's name, as it is each type's.

**Results.** On 20 unseen curriculum interactions with the live profile:
- 19/19 accepted (one was already covered); the first answer was valid for 17/19;
- **median 5.7 s, max 16.6 s**, 1.1 calls and $0.037 per patch.

The late reviewer shipped 17 of the 19 rules. It sent back 2, both of them narrate-only. One
had a real inconsistency: it ignored ink that the player might be carrying.

**In the game:**
- **Immediate feedback.** The engine logs a neutral line at once ("You try Wine Bottle on
  beehive…"). The line describes the attempt, never its outcome.
- **Bounded wait.** The client waits up to 15 s; a later patch still teaches the world.
- **Prefetch.** Facing an undefined interaction with something in hand for 0.5 s starts the
  request, capped at 40 per session.
- **Measured:** pressing E at once had the effect after 6.3 s. Standing still, the prompt
  turned "defined" after 6.3 s, and E then resolved on the next tick.
- **Engine fix.** Text templates use the role names from the start of the rule, so a
  destroyed or emptied instrument is still named.

**Not yet:**
- Choosing between speed and price per provider: Together is fastest but costs more for Kimi
  than the slower providers.
- Tool skills (sandboxed TypeScript).
- Harness proposals and the meta-validation gate (rsi.md §5.3).
- Per-player rate limits for public deployment.

### Live latency through claude-code (2026-10-09)

Measured on the live design prompt of a stone used on a dead tree (the system prefix 30 k
characters, the user turn 8.5 k), Opus 5.5 at effort low, `claude -p` signed in as the user:

| Call | Wall | API | Output | Thinking |
|---|---|---|---|---|
| a one-word answer, cache cold | 4.4 s | 1.3 s | 4 | 0 |
| a one-word answer, cache warm | 3.3 s | 1.0–1.1 s | 4 | 0 |
| the same with the CLI's non-essential traffic off | **1.5–1.7 s** | 1.1–1.3 s | 4 | 0 |
| a live design, as before | 7.4 s | 4.6 s | 413 | 0 |
| a live design, traffic off | 6.8–7.4 s | 6.5–6.8 s | 566–571 | 137–148 |
| the same prompt, Sonnet 5.5 | 5.8–7.2 s | 5.4–6.4 s | 619–784 | 224–268 |
| the same prompt, Haiku 5.5 | 6.7 s | 6.3 s | 1,147 | 640 |

- **The CLI's own traffic was 2 s of every call**: the update check, telemetry, error reports
  and surveys around the request. `ClaudeCodeModel` now runs the CLI with them off
  (`DISABLE_AUTOUPDATER`, `DISABLE_TELEMETRY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and the
  like), so wall time is the API's: a design loses about 2 s of 7, an agent step (median 3.7 s)
  about half.
- **The rest is output.** The API time is the answer's tokens at roughly 85 a second; the JSON is
  already minified (no newlines). The `summary` field, which nothing read, is gone from the
  answer format. A smaller model is not faster here: Sonnet and Haiku think longer and write more
  for the same rule.
- **Fast mode is not granted** to `-p` on this account (`fast_mode_state: off`). A warm pool of
  pre-spawned CLIs would save only 0.5 s (the CLI does most of its work after reading stdin), so
  there is none.
- The prefix cache holds: 11.2 k tokens read, 4.4 k written per design call (the user turn and
  the CLI's own context), 0 thinking at effort low unless the model chooses to.
- Recorded episodes before this (30, claude-code): design median 6.1 s (p90 8.9 s), agent step
  median 3.7 s (p90 9.9 s), a live episode median 7.1 s.

### The event model, live (2026-10-02)

`npm run ford-live` plays the scenarios on the Ford, each reaching one kind of hole through
the game's own path, and lets the live profile answer with Kimi K3 (review, reflection and
escalation off; a fresh library). Since inputs v2 (§5.2) taking and putting are physics and no
longer holes: the tour has six scenarios; the measurements below are from before, with eight.

| Scenario | Event, hole | Patch | Time |
|---|---|---|---|
| bread used on the winch | `act/use` on the bread, `core/use` | edible things on a mechanism: a line ("gears don't eat") | 7.1 s |
| the axe put on the dead tree | `impulse/receive` on the tree, `core/receive` | it sheds what is put on it: `emit taken` to the item, onto the ground | 6.5 s |
| the axe on the chopping stump | `impulse/strike` on the stump, `core/strike` | a cut with an axe splits it into two sticks | 7.2 s |
| a bare hand on the raft | `impulse/handle` on the raft, `core/handle` | it rocks on its line: only the winch moves it | 6.6 s |
| taking the winch | `impulse/taken` on the winch, `core/taken` | bolted down: a line | 6.1 s |
| the rope given to a fire slime | `impulse/offered` on the slime, `core/offered` | fiery slimes set flammable offerings alight (`emit element fire`) | 11.5 s |
| Hesper's fire soaked | `stuck` on Hesper (world), `core/stuck` | a person whose fire is wet says so and waits by it (`goto`) | 6.0 s |
| the rope burnt | `broken` on the story (world), `core/broken` | a spare rope turns up by the landing | 6.0 s |

- **8/8 accepted, 7/8 first answers valid**, one call each but one, **median 6.6 s**, $0.35 in
  all ($0.044 a patch). Every patch wrote only its host and reached others by impulses; every
  host was a class (a type or tags), never an instance.
- The participants and the actor were held while the patch was worked out and released when
  it came. The Threadbook shows the eight threads, the stuck and broken ones as the world's.
- The same class does not ask again: an apple on the winch resolves to the bread's patch with
  no `?`; a frost slime offered rope (not fiery) still asks; defined behaviour is unchanged.
- **The one failure** wrote effects as `{"spawn": {…}}`, as the ModSpec's own notation
  (`spawn {type, at}`) suggested. The ModSpec now states the shape (`{"op": "spawn", …}`),
  and the deterministic repairs flatten it, so it costs no repair turn.
- The Mod Console's template expected its host under the key `host`. It now uses the host's
  own key in the scenario; `tools/test/console.test.ts` checks that the template is a valid
  patch for an act, a receive, a strike and a handle.

### The curriculum on the event model (2026-10-03)

`npm run curriculum -- --profile live --by hole` samples the demo's undefined cells across the
holes they reach (each hole its share, at least two), answers each with the live profile (late
review on; a failure escalates to the offline agent), and re-sweeps coverage after every step,
so each patch's reach is measured: the undefined cells it answered, its own and the rest of its
class. `npm run curriculum:report` summarises a run.

| | Run 1 (seed 1, 20 cells) | Run 2 (seed 2, 12 cells, the fixes below) |
|---|---|---|
| live accepted / already answered by an earlier patch / failed | 15 / 4 / 1 | 9 / 2 / 1 |
| first answer valid | 13 / 16 | 9 / 10 |
| median live time | 4.7 s | 5.4 s |
| undefined, whole sweep | 20,058 → 18,833 | 20,058 → 18,282 |
| undefined, the Ford's scope | 640 → 505 | 640 → 472 |
| late reviews sent back | 2 of 15 | 4 of 9 |
| offline revisions / escalations accepted | 2/2, 1/1 | 3/4, 1/1 |
| spend | $1.10 | $1.65 |

- **Patches answer classes.** A patch answered 1 to 1,638 cells (median about 5). The wide
  ones are class defaults: a slime takes whatever it is offered (116 cells), natural fixtures
  hold nothing put on them (819, then 1,638). A fifth of the sampled cells were already
  answered by an earlier patch when their turn came.
- **Failures were mechanical**, and are now fixed by the harness:
  - JSON with one `}` too many (the tree closed early): `repairBrackets` drops the closer
    that ended the object too early;
  - effects keyed by their op (`{"spawn": {…}}`, 2026-10-02);
  - a terrain named bare (`"bush"` for `tile/bush`): `qualifyTerrains`, and the validator now
    names the terrain;
  - "no JSON patch in the answer" when the JSON did not parse: the error now says what failed
    and where, because the modder's reflection had learnt the wrong lesson from it ("always
    emit the JSON").
- **Derived tests on the right instance.** The other instance a rule is tested on may already
  be answered by a more specific patch; it is skipped now, instead of flagging the rule as
  not generalizing.
- **Review.** It now also checks free repeatable gains (a stick from every shake of a tree:
  a faucet) and lines that read wrong for the player ("you gathers"). The ModSpec tells
  authors how name slots read. The stricter review sends more rules back, and offline
  revisions cost $0.10–0.44 each: in run 2 they were most of the spend.
- **The offline agent left its workspace** — and now cannot. In one revision it ran commands
  in the real repository (reading engine source, writing a debug script at its root; it
  changed no tracked file). The task ran on the host (`LocalEnv`), and its `validate.mjs`
  named the repository's path. Now (`packages/agent/src/env.ts`, `chooseIsolation`):
  - **With Docker** (the Linux host has it since 2026-10-03), an unattended task's commands run
    in the `lsw-sandbox` container (node, git, ripgrep; built from `packages/agent/sandbox`):
    no network, 1 GB, 1 CPU, 256 processes, the host user's uid. A world task sees its
    workspace and the engine's code read-only under `/repo` — not `.env`, not `var/`. An engine
    task sees its workspace and the host's `node_modules` read-only.
  - **Without Docker** the agent has no shell: no `run` tool, and its own hooks do not run.
    The tests it runs are the validator from the engine's code, never a file it can edit.
    Engine tasks (whose tests run the agent's code) are not made for unattended work at all.
  - Writes cannot leave the workspace through a link (`insideForWrite`). A person who starts a
    task by hand (`npm run agent -- task`, SWE with `--env local`, `npm run engine-task`) may
    let it run commands locally (`localRun`).
  - A task carries its own release (`AgentTask.dispose`), so its container cannot outlive it.
  - Checked on the Linux host: the container cannot write the repository, cannot see `.env`
    or `var/`, has no network; an agent replaying the incident (`cd <repo> && …`) leaves
    nothing there; a real offline revision still succeeds inside (15 steps, $0.12); the whole
    suite passes with no container or workspace left behind.
- **Open question: broad patches close their class.** A patch only fills a hole, and once
  a broad default fills it ("natural fixtures hold nothing"), no more specific question about
  any of those fixtures is asked again. Whether a broad default should stay open to more
  specific answers is a question about the interface (§5.11).

### The router: find, then create (2026-10-04)

A live design no longer carries the world's type catalogue (334 types, 62% of the ModSpec, and
growing with the content). Removing it from the prompt changed nothing measurable on twelve live
cases, and a patch needs a type beyond the request only when its outcome is a thing the request
does not hold (iron from smelting, a stick from a stump). So the design works in layers:

| Layer | Sees | Answers |
|---|---|---|
| **local** | the request's own types: roles, parents, and the directory beside each role's type (brief) | a patch, or `{"need": [{"name", "why"}]}` |
| **find** | the closest types by name, and the whole catalogue (`parent/: children`) | a patch with the type it found, or `{"create": [{"id", "name", "why"}]}` |
| **create** | — | the patch with the new type(s) beside the rule; an artist call draws each new type's 16x16 icon as data |

- **New types** (`TypeDef.art`, sprite `art:<id>`) travel in the patch like any rule, so every
  client gets the thing and its picture with the library log; the client draws the picture as a
  texture. The validator holds a new type to the world's conventions: new, under a parent that
  exists, snake_case, named in both languages, not another name for a known thing; its picture
  to 16x16 and at most 8 colours. An unknown type id is answered with the closest known ones.
- **Pictures.** Opus draws a usable 16x16 icon in one call when it is shown two of the pack's
  icons as character grids (the pack's outline, tones and light). A picture that cannot be drawn
  in two tries leaves the thing with its parent's.
- **The player waits for a creation.** `GET /progress?id=` says where a request is; once it
  creates, the client holds the act past its time-out (`ModPort.hold`) and the HUD says "The
  world is making something new: <names>".
- **Designs in lanes** (`harness.concurrency.design`, 4 at once, live before offline): each is
  worked and validated in its own sandbox, and the commit re-validates against the library as it
  is then. A request whose patch would be written where another's is (the same event kind and
  host class, `laneOf`) waits in that lane and is often answered by what the other committed;
  others are designed side by side. A revision takes no lane: a player's request never waits
  behind one (seen live: 20 s behind a 107 s revision, past the act's time-out). Reviews,
  reflections and escalations run three at a time (`concurrency.background`).
  As built (2026-10-05): before repairing a failed validation, a non-revision request checks
  whether another lane has already answered its hole and class. If so it returns `covered`
  without another design call.
- **A rule writes only its host, so one act can take several holes.** A knife on a haystack is
  answered by the knife (a cut sent to the haystack), and the haystack's answer to a cut is its
  own hole, asked next. `npm run eval:objects` follows an act through up to four holes and judges
  the world afterwards: five acts whose outcome the world has elsewhere (find), five whose outcome
  it does not have (create).

**Measured** (Opus 5.5 at effort low through `claude -p`, 2026-10-04):

| | Passed | Notes |
|---|---|---|
| find | 3/5 | haystack → cut grass and beehive → honey through two holes (the tool's cut, then the target's answer, which asked for the thing and found it); feather on ink → the quill from the ink's directory, in one call |
| create | 2/5 | iron ingot, berry jam (each about 4 calls, 26 s, $0.15–0.17, with a usable picture) |

- Every request that reached find or create was answered by the router as intended. The
  failures stopped at local by choice: reeds cut into a new *reed bundle* rather than cut grass
  (arguably right), pebbles scattered, salt made raw meat more filling (a prop), frostcap hissed
  into steam, a cut pumpkin was only marked cut. Whether the world should make a new thing in
  such cases is a design question about how eager the modder should be, not a defect of the
  router.
- **In the game**: iron ore used on Emberfall's lit forge became an *Iron Ingot* the bag shows
  with its own icon. Gold ore on the same forge: the HUD said "The world is making something new:
  Gold Ingot…", the player waited about 20 s, and the gold ingot came with its picture; it
  survives a reload. A held thing an answer transforms keeps its slot (the bag is synced after a
  late patch or a fallback).
- The Mod Console's World tab gives the player a thing and moves them (development only), to
  stage an act by hand.

### The AI setting (2026-10-13)

The AI has a setting the way a game has graphics settings: a level for each kind of work it does —
off, low, medium, high — and presets that set them all. The levels are agreed with the user:

- **The wait is the same at every level.** The world stands still up to `AI_WAIT_MS` (20 s) for
  the player's own question, as it did (a world's question holds its participants 15 s of game
  time, as it did); then the default runs, and a late answer still teaches the world. A level is
  how much the AI does within that time, so a stronger model carries a higher setting, as a
  stronger card carries higher graphics at the same frame rate. No level buys quality with time.
- **Answers are kept by tier.** A learned rule carries the tier it was answered at (`Rule.tier`;
  none: medium, what every answer before the setting was made at). Each tier has its own trees
  (one per type, kind, hole and tier; §5.16 holds within a tier). An event takes its own tier's
  answer first, then the higher tiers', nearest first: a higher answer serves every lower setting,
  a lower one never a higher. A low answer is not reviewed: it stays a low answer, and the high
  setting asks again over it. Off asks nothing and takes every tier's answers (they cost nothing).
- **The setting is the player's**, kept in the browser like a graphics setting, never in a save
  and never in the harness: the harness is the modder's own (what its outer loop improves), the
  setting an envelope over it. The setting has nothing to do with the RSI thread.

The kinds of work (the engine's `quality.ts`, `categoryOf`; the same from a request,
`categoryOfRequest`):

| | what | off | low | medium | high |
|---|---|---|---|---|---|
| things | the player's acts on things (themselves too) | not asked: the default | | | |
| people | the player's acts on people and creatures | not asked | | | |
| world | what the world does by itself | not asked | | | |
| create | making kinds the world has none of | never | not drawn (the parent's picture) | drawn | drawn with more thought, drawn again if the picture has problems |
| prefetch | asking while the pointer rests on something | never | after 3 s, 4 a game | after 1.5 s, 12 | after 1 s, 30 |

What a tier does for the first three (the client's `buildRequest` sizes the view; the modder's
`quality.ts` lays the workload over the harness for a live request):

| | low | medium | high |
|---|---|---|---|
| what the model sees | the event, its roles and a 3×3 window; no nearby things, no lines said, no rules in force; 4 lessons, no past episodes | as before: 7×7, things within 2 cells (16), the last lines, 8 rules; the harness's recall | things within 4 cells (32), 16 rules; 20 lessons, 8 past episodes |
| what it may use | the request's things only (no catalogue); the host changed only (impulses to others are taken out) | the catalogue; chains | the same |
| how hard it thinks | no reasoning | the harness's (low) | medium |
| what is checked | the validator; no repair | the harness's: derived tests, a repair, review and audit after shipping | two repairs, a review before it ships (on the fast providers) |
| after it ships | nothing (no review, audit, escalation or revision) | the harness's | the harness's |

The offline profile (escalations, revisions, the curriculum, the editor's offline answers) works as
it always did, and keeps its answer in the tier the question was asked at. The editor asks at the
high tier, so an answer an author takes into the game serves every setting.

**Detection** (`packages/modder/src/detect.ts`; `GET /quality`, `POST /quality/detect`, this
machine only). As a game detects the hardware and recommends a preset, the service plays a set of
questions at each tier and recommends, for each kind of work, the highest tier the model answers in
time at least three times in four (below that: low at one in two, else off). The questions are the
service's own history (newest first, one per class, what players asked) and, where it has too few,
the game's probes (`GameDef.probes`, loaded only then; OpenWorld's come from `npm run probes`:
the Ford's kinds of hole, cells of the interaction sweep, what the world asks over a day). Each is
played on the base game alone by a dry modder (designed and validated as ever; nothing committed or
recorded), so the yardstick stays the same from run to run. The result is kept per model
(`quality.json` in the service's data); the options say when it is another model's. Prefetch is a
budget's choice, not the model's: detection leaves it as the player has it.

The options (`packages/runtime/src/ui/quality.ts`): a preset row, a row per kind of work, the
note that the wait is the same at every level, the model, the detection's table (answered in time,
the slowest of nine in ten, per kind and tier) and its recommendation to apply.

On the claude-code backend a call that asks for more reasoning now gets that effort (the configured
effort is the least: `effortOf`); before, every call ran at the configured effort, so the high
tier's reasoning had no effect there.

### The self-improving agent (2026-10-01)

The offline profile no longer uses the patch pipeline. A request is worked by an SWE-style agent
(`packages/agent`) as a **repository**: rules as files, the ModSpec as docs, the validator as the
tests. The same agent works engine issues (hidden fail-to-pass tests) and SWE-bench instances,
and an outer loop lets it change its own loop under meta-validation. Design, guard rails and
smoke results: [rsi.md](rsi.md).

## 14. Next

The world model and base gameplay (state, things, space, breaking, makeup, building, rooms,
storeys, stages, combat, behaviour, the story's script, two-level maps) are agreed in
[world-model.md](world-model.md); its steps W1–W10 (§12 there) are the next engine work.
Near-term gameplay work — interactions and simple loops — is planned in [roadmap.md](roadmap.md).

- Grow the Ford with the offline profile (curriculum, guided by what players actually try);
  watch the live numbers above as the library grows.
- Self-improvement experiments ([rsi.md](rsi.md)): the SWE-style agent, world tasks as
  repositories, engine tasks, the outer loop and the SWE CLI are built and smoke-tested; runs at
  scale and the team's benchmark on snapshots come next.
- Offline content generation at full scale through the same modder.
- Public deployment with the shared rule library.
- Paper metrics: rule-library growth, patch reuse rate, LLM calls per play-hour over
  time, validation pass rate, repair rounds per patch, consistency checks, play-tester
  plausibility ratings; for RSI, the external benchmark at each self-state snapshot.
- **The event model's migration (§5.14)**: the next engine work. The demo's proof and the
  coverage tool follow it.
- Free-text input (deferred, D9).
