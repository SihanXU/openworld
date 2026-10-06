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
| D8 | Player input | four inputs, one verb each (§5.2): **E** interact bare-handed, **F** take, **left click** interact with the held thing (or strike), **right click** put; a long press chooses the layer; proven complete over the engine's event space |
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

The player never chooses among the verbs. The two keys below do, using the rule library.

### 5.2 Player input: five inputs, one act each

**Why not Stardew's contextual Action key.** Stardew's interaction space is closed: each pair
of (held thing, target) means one thing, a tile holds one thing, and items in the bag do not
act on each other. This world's promise is the opposite: anything may be used on, or put on,
anything. "Holding X at Y" then means at least three different events — apply X to Y, put X
onto Y, or do Y's own thing with a bare hand — and a contextual key always hides one of them.
The first build (two Stardew keys) failed exactly so: where using X on Y was defined, putting X
there was unreachable. Checked against the engine's event space, it had five holes (a take and
a bare-hand interaction on the same fixture; a tool on the ground versus using it on oneself;
layers under a pile; items in the bag as targets; an axe that both chops and strikes).

**The attack key.** Besides the five, **Space** strikes straight ahead with the held weapon (or
a fist): on the press, and again while held, paced by the attack cooldown. It adds no event the
five cannot make (left click with a weapon makes the same blow, aimed at a spot); it is there
for feel, because a fight should not wait for a mouse release or depend on where the cursor is.

**Completeness**, the criterion every input design here must meet:

1. **Expressible**: every player event the engine can make and a rule can define is produced
   by some input.
2. **Unshadowed**: an input state (key, selected slot, aim, chosen layer) makes exactly one
   event; no event is reachable only while another is undefined.
3. **Foreseeable**: before the press, the HUD shows the event it will make. What it says is the
   answering rule's own `label` (or the label of the answer it reaches: food eaten says "Eat
   {instrument}", given to someone "Feed {instrument} to {target}"; a place of the overworld "Enter
   {target}"), the receiver's before the act's own; where no rule says, the input's default, marked
   `?` when the outcome is undefined. A patch carries its own label, so a hole the AI filled says
   what it now does (the validator warns when an input-reached rule has none).

**The player's event space** (from the engine and the rules): `hands(target)` — a hand on it;
`take(target)` — picking crops is a take; `put(held, target)` — sowing, storing and giving are
puts; `use(held, target)` — eating is a use on oneself; `use(none, target)` — the bare body's
blow; `enter(tile)`. Targets: every layer of a tile within the act's reach (people and creatures,
fixtures, the items of a pile, the ground), the player (for use only), and items in the bag or an
open chest.

**The inputs**, one act each (Stardew's and Minecraft's split of hands, items and the world):

| Input | Act | Reach | For |
|---|---|---|---|
| **E** | `hands(target)` | the target's `handsRange` (0: standing on it, a bed; 1, beside it, by default; a sign 2) | talk, open, read, wake, sleep (whatever is held) |
| **F** | `take(target)` | the world's `carry` (1: the cells round, one's own included) | pick up, pick a crop, take from a table |
| **G** | `put(held, target)` | `carry` | place, store, set on a table or fire, sow, hand to a person |
| **Left click** | `use(held, target)`; with nothing held, a blow | the held thing's `range` (1 by default; a spear 2, a bow 6) | tools, weapons, feeding someone, putting armour on someone, the player's experiments; a bare fist hits anything (Minecraft) |
| **Right click** | `use(held, self)` | oneself | eat, drink, put on, a bare fist on oneself; the same act as a left click on one's own place |

**Taking and putting are the world's physics, never asked**: what can be taken is taken, what has
room takes what is put on it, a person takes what is handed to them; anything else refuses, and F
and G are offered only where they would change something. What a thing makes of another is the
left click's: using something on something is where the AI answers ("put places; use applies").
A creature does not take what is put on it; a rope *used* on it holds the rope out to it, and what
it makes of that is its own nature, undefined until the AI says.

Other keys: Esc (menu, and closes anything open), I (inventory), J (journal), M (map), 1–0, -, =
and the wheel (toolbar), Shift (walk), WASD (move). Dialogue moves on with E or a click.

- **The instrument** is the selected toolbar slot: any carried thing, or an empty slot (none).
- **The aim**: the point the mouse is on, when some input reaches it (so how far the pointer
  reaches is the farthest of them, with what is held and what is there); else, for E, F and G, the
  tile in front. A spot shows only the inputs that reach it: far off, perhaps just the bow's shot.
- **Reach is the engine's**, for every actor: an act whose target lies beyond its reach is not done
  (`Engine.inReach`; Gus works from beside the tree as the player does). A system that pulls from
  farther says how far (the magnet, a sin's skill).
- **E with nothing pointed at** acts on the place in front, unless what is there has no answer
  of its own and what one stands on has one: the bed one lies on, a place of the overworld (its
  block of 3×3: standing anywhere on it, facing any way, E enters it; the block is outlined whole).
- **Oneself is never E's, F's or G's target**: on one's own place they meet what is there (the
  floor, what lies at one's feet, the bed one stands on). The left click on one's own place is on
  oneself.
- **The layer**: whatever is drawn at that point, top first — a person, the things lying on a
  table, the table, the canopy of a tree reaching over from behind, the ground last. The view
  alone knows what is drawn where (it tests the pictures' own pixels), so it hands the stack to
  the engine with the aim; with the keyboard the stack is what stands on the front tile, in
  drawing order. A press acts on the **top** layer; what the rule library does not define there
  is an experiment and goes to the Mod port. A **long press** of any input opens the chooser:
  every layer at the point, each with what the input would do. So nothing drawn is out of reach.
- **Nothing is only a picture**: a map is terrain and things. There is no decoration layer —
  the bench, the stump, a tuft of grass, fallen leaves are entities of their types, so any input
  reaches them and the rules (or the modder) answer for them.
- **Items in the bag or an open chest** are targets through the context menu (right click on
  the item): use the held thing on it, put the held thing into or onto it, handle it bare-handed.
- **Blows** (a convention the ModSpec states): pure weapons (blades, clubs, bows, wands) strike
  whatever they are used on except people; tools that are also weapons (the axe) strike living
  things and work everything else; the bare body strikes whatever it is used on (a fist wears down
  plants and wood, slowly; stone is too hard). A weapon used on a person is a use, never a blow — no
  villager is hurt by accident. A blow from afar flies along a row or a column.
- Eating and drinking oneself ask first (yes / no); so does any rule with `confirm`. Food, a
  draught or armour used on another feeds them, doses them, dresses them.

**Proof sketch.** An event is (verb, instrument, target). The key fixes the verb; the slot fixes
the instrument, and every carried thing (or none) can be selected; the aim, the chooser and the
context menu reach every target within the act's reach (one's own place for use: the right
click). The three are independent, so their product — the event space within reach, less the
stated conventions and the takes and puts that would change nothing — is reachable; and a given
input state is one dry run, shown by the label. `packages/content/test/controls.test.ts` checks it
by enumeration on a scene with the hard cases (a pile on a table, a stick on the ground, a person,
the own tile, a second thing in the bag).

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
  essential being) and the world stops on a red veil: "You died!", who felled them (the last who
  struck them, `combat.lastHurtBy`), and what may follow by the game's **difficulty**, chosen at a
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
  - Tab brings the next row to the toolbar (Shift+Tab the previous one); a new kind takes the
    first free slot, the toolbar's first; with the bag full it stays on the ground.
  - Equal items stack.
  - In the menu: drag to move, right-click takes one, Shift+right-click takes half, Shift+click
    moves a stack between the toolbar and the rest of the bag, dragging an item out of the menu
    drops it, and a button organizes the bag.
  - Slot order and the selected slot are part of the world state.

  As built (2026-10-05): organizing uses the bag's learned capacity, including Big Pack's
  fourth row.
- **Chests**
  - The chest's grid is shown above the inventory's grid.
  - Clicking an item moves it to the other side; right-click moves one.
  - Buttons: organize, and fill existing stacks.
- **Pickup**
  - Items that rules spawn (a harvest, logs, stones) pop out, and fly into the bag within 2
    tiles (Stardew's default magnetic radius is 128 px). What a creature leaves when it falls
    (its meat, its loot) and a hen's eggs lie still instead (`spawn`/`dropContents` with
    `still`): they are taken with F.
  - Items placed in the world are taken with F. Walking through town never vacuums it.
- **Foraging** (Don't Starve's twigs, flint and grass): a map names what appears on it by itself
  (`MapData.appear`: weighted types, the terrains, a cap, a pace). While the player is on the
  map, one more of each below its cap appears on a free tile at its pace (150 ticks for the
  ground's yield), never right beside the player (`engine/src/appear.ts`, world-model.md §6.9).
  These are taken with F like any placed item.
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
  - The validator rejects two rules that are equally specific.
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
- **Validation**, in addition to §8's schema, ontology, sandbox replay, tests and regression:
  1. it writes only its host;
  2. it emits only known kinds;
  3. it addresses classes;
  4. **it only fills holes**: every case it matches resolved to an undefined leaf before.
     Conditions are conjunctions over types, tags, statuses and numeric ranges, so whether
     the patch's region lies inside the hole's region can be decided.

  Rule 4 makes refinement monotone: the AI never changes defined behaviour. An authored
  outcome that is wrong is fixed by a person, or by offline review.
- **One question at a time.** A hole is asked once per class: while a request is open, the
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
  marks the label `?` and starts the request early (prefetch).
- **Boundaries.**
  - Only the story's own rules write its protected facts (`ford.`, `seen.`, `invalid.`).
  - An `essential` actor goes down and is never destroyed.
  - Emitted spread stays within the event's map and below certainty.
- **Legibility.** Every learned thread enters the Threadbook with its cause and with who
  started the chain (you, or the world), and the first time the player sees one there is a
  light cue ("The world pauses…"). People may talk about it: a patch may notify the story of a
  topic.

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
  1. **catch up the timers**: every one-shot timer that fell due while it slept runs in time
     order (a burning thing burns out to ash, things grow a stage, the map resets);
  2. **the inbox**, in time order;
  3. **people** whose schedule puts them here now are placed;
  4. **the relation difference over the whole map**, against the relations saved when it
     went dormant;
  5. then the map runs.
- **For authors**: whatever must progress while the player is away is a timer (Stardew's
  nights, Skyrim's cell reset). A continuous process (fire spreading, creatures roaming) is a
  period, and it freezes (Minecraft).
- **People**:
  - a person's record is resident, and their body is on a map;
  - on a dormant map the body does not move: entering the map places it by the schedule;
  - a person whose schedule leads to the active map walks in through the portal.
- **Cost**: a tick costs the active map plus the resident hosts that events reach. Entering a
  map costs its inbox plus the timers that fell due. The number of maps appears in neither.

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
striking Pip down changed nothing the world could answer, a quest wrote the player's bag from
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
| a quest wrote facts, the player's props and bag from the person's rule; the dispatcher counted defeats by the player | the person tells the story; the story's `quests` effect writes its facts, spawns the reward into the taker's bag, notifies the taker (experience, stage) and sends the brought things a `taken` into the giver's bag; a defeat tells the story what fell (`{typeOf}` param), counted for the quests its feller took on (`q.<id>.by`) |
| the skill tree and the trainer wrote the player's tags and props | `act/learn` (param `skill` or `profession`), like `craft`: the actor's outcome (`learn`) |
| talents healed the striker and bled the target from the striker's code; a clock hurt and healed | the act carries `bleed` and `drain`; the struck one's `hurt` opens `bleeding` and sends a `restore`; `adrenaline` is a status; recoveries on a defeat are the striker's rule (the defeat carries the last blow's instrument) |
| the dash, waypoint travel moved by code | acts of moving |
| a sin's release struck, stepped and statused its victims from code | the sin's act (`use`, its own body), answered by `release`: strikes, a push, a coat they answer |
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
   6. no tie with an existing rule;
   7. **sandbox replay** of the triggering event, of the patch's own `tests`, and of the
      regression set, on a copy of the state.
5. **Apply.** The rule enters the library; the held event is replayed and now reaches it.
6. **Persist** (§9).

A failure at any step runs the leaf's default; the game never blocks.

As built (2026-10-05): the service keeps bounded validation proofs keyed by the library
version and the contents of the ontology, workspace, regression set, scenario and candidate
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

- **Art**: the Ninja Adventure pack (CC0). `packages/client/src/assets/catalog.ts` maps every
  terrain, fixture, item, creature, character look, VFX, UI piece, music and sound to the pack;
  a preview page (`/src/assets/preview.html`) shows all of it.
- **Renderer** (`packages/client/src/render/`): 47-tile blob autotiling (table `BLOB47`) into a
  runtime ground atlas; terrain objects (trees, rocks, tall grass…) that follow terrain state
  (burnt → charred, chopped → stump); prefab buildings stamped by the map author with correct
  occlusion; nine-slice room walls; 4-direction animated actors; status overlays, projectiles,
  day/night light, music per map and sound effects.
- **World** (`packages/tools/src/demo/`): an authoring DSL (terrain painting, prefabs, rooms,
  fixtures, items, creatures, portals). First Hearthvale (15 maps, 12 villagers), replaced on
  2026-10-02 by **the Ford** — one map, two people, minimal and complete (game-design.md).
- **Story as data** (`packages/content/src/ford.ts`): objectives keyed by a player prop, rules
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
  others are designed side by side. Reviews, reflections and escalations run three at a time
  (`concurrency.background`).
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
