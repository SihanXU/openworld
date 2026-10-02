# Large Symbolic World — Design

Status: **agreed design; Phase 1 (infra) implemented** (2026-09-30).
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
- When an interaction is **undefined**, the engine raises it through the **Mod port**;
  a modder (later: an LLM service descended from BardOS) returns a **patch** — a
  type-level rule — which the engine validates, applies immediately, and keeps forever.
- The subject is the **world**, not agents. NPCs are world content with rule-driven
  schedules; no LLM runs in the per-frame loop.

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
| D7 | Setting | **Saenvar** (from BardOS) expanded to full scale; the demo is one place in it, the Ford (game-design.md) |
| D8 | Player input | four inputs, one verb each (§5.2): **E** interact bare-handed, **F** take, **left click** interact with the held thing (or strike), **right click** put; a long press chooses the layer; proven complete over the engine's event space |
| D9 | Free-text input | **deferred**; reserved in the ModSpec as the `intent` and `ask` event kinds (§5.4) |
| D10 | Combat | **on-map, real-time** (Zelda / Stardew-like), elemental reactions interacting with the environment |
| D11 | Rule system | **one** rule engine for world interactions, elemental reactions and combat |
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
  content/    ontology, items, NPCs, maps (Tiled JSON), base rule library, Saenvar data
  tools/      world generator (incl. stress world), sprite composer, map generator
  modder/     the modder service, descended from BardOS: pipeline, shared library, self-state (§13)
docs/
```

## 4. World model

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
- The world is a graph of maps. Only the current map (and its neighbours, prefetched)
  is loaded at full fidelity.
- World data is split **per map** into static chunks served as static files; the
  client loads a map's chunk on entry.

## 5. Interaction model

Status: agreed 2026-10-01. **Built** (2026-10-02): the input (§5.2–5.3: `engine/src/controls.ts`,
the client's `ui/`), every player source (1–5), and the world's own sources 8–12 with the
salience filter, budgets, safe defaults and boundaries (§5.5–5.9). Sources 6–7 stay reserved
(D9). The demo, the Ford, contains an instance of each, proven by its completeness test
(game-design.md §9).

Two halves. §5.1–5.3 are what the player does: the input design, taken from Stardew
Valley's wiki and its decompiled source rather than from memory. §5.4–5.10 are where
**undefined behaviour** comes from. The player is one source of it; the world itself is the
other, as in Oblivion's Radiant AI and Skyrim's Story Manager. An earlier version of this
section said undefined interactions "arise almost entirely from `put X on Y` and
`interact Y holding X`". That was too narrow: it is one source among twelve.

### 5.1 Engine verbs

Unchanged: **take**, **put**, **interact** (plus the **hit** event for attacks). Every player
action becomes an event:

```
Interaction = { verb, actor, target, instrument?, at, time }
```

The player never chooses among the verbs. The two keys below do, using the rule library.

### 5.2 Player input: four inputs, one verb each

**Why not Stardew's contextual Action key.** Stardew's interaction space is closed: each pair
of (held thing, target) means one thing, a tile holds one thing, and items in the bag do not
act on each other. This world's promise is the opposite: anything may be used on, or put on,
anything. "Holding X at Y" then means at least three different events — apply X to Y, put X
onto Y, or do Y's own thing with a bare hand — and a contextual key always hides one of them.
The first build (two Stardew keys) failed exactly so: where using X on Y was defined, putting X
there was unreachable. Checked against the engine's event space, it had five holes (a take and
a bare-hand interaction on the same fixture; a tool on the ground versus using it on oneself;
layers under a pile; items in the bag as targets; an axe that both chops and strikes).

**Completeness**, the criterion every input design here must meet:

1. **Expressible**: every player event the engine can make and a rule can define is produced
   by some input.
2. **Unshadowed**: an input state (key, selected slot, aim, chosen layer) makes exactly one
   event; no event is reachable only while another is undefined.
3. **Foreseeable**: before the press, the HUD shows the event it will make.

**The player's event space** (from the engine and the rules): `take(target)` — picking crops is
a take; `put(held, target)` — sowing and giving are puts; `interact(none, target)`;
`interact(held, target)` — eating is an interaction with oneself; `hit(held or fist, target)`;
`enter(tile)`. Targets: every layer of a tile within reach (people and creatures, fixtures, the
items of a pile, the ground), the player, and items in the bag or an open chest.

**The inputs**, one verb each, as in action RPGs:

| Input | Verb | For |
|---|---|---|
| **E** | `interact(none, target)` — hands | talk, open, read, push, shake (whatever is held) |
| **F** | `take(target)` | pick up, pick a crop, take down, take from a table |
| **Left click** | `interact(held, target)`, or a blow | tools, eating and drinking (click yourself), the player's experiments; weapons strike |
| **Right click** | `put(held, target)` | place, store, set on a table or fire, sow, give |

Other keys: Esc (menu, and closes anything open), I (inventory), J (journal), M (map), 1–0, -, =
and the wheel (toolbar), Shift (walk), WASD (move). Dialogue moves on with E or a click.

- **The instrument** is the selected toolbar slot: any carried thing, or an empty slot (none).
- **The aim**: the mouse's tile when it is the player's own or one of their 8 neighbours, else
  the tile in front.
- **The layer**: by default the first layer (top down) for which the input's verb is defined —
  placing on open ground, tilling it, the table under a pile when putting — else the first it
  reaches, bare ground included, as an experiment that goes to the Mod port (a weapon swung at
  open air comes last). A **long press** of any input opens the chooser: every
  layer of the tile, oneself included on the own tile, each with what the input would do. So
  the default never hides an event.
- **Items in the bag or an open chest** are targets through the context menu (right click on
  the item): use the held thing on it, put the held thing into or onto it, handle it bare-handed.
- **Blows** (a convention the ModSpec states): pure weapons (blades, clubs, bows, wands) strike
  whatever they are used on except people; tools that are also weapons (the axe) strike living
  things and work everything else; a bare fist on a creature punches. A weapon used on a person
  is an interaction, never a blow — no villager is hurt by accident. The events these exclude
  (a pure weapon's `interact` on a non-person, a tool's `hit` on a non-creature) are not player
  events.
- Eating and drinking ask first (yes / no); so does any rule with `confirm`.

**Proof sketch.** An event is (verb, instrument, target). The key fixes the verb; the slot fixes
the instrument, and every carried thing (or none) can be selected; the aim, the chooser and the
context menu reach every target. The three are independent, so their product — the event space
less the stated conventions — is reachable; and a given input state is one dry run, shown by the
label. `packages/content/test/controls.test.ts` checks it by enumeration on a scene with the hard
cases (a pile on a table, a stick on the ground, a person, the own tile, a second thing in the
bag): every (verb, instrument, target) is produced by some input, and each input by one event.

**Undefined behaviour from the inputs**: E on a thing only a catch-all describes (source 4),
left click with an object (source 1) or a weapon (source 3), right click (source 2). They go to
the Mod port as in §5.5.

### 5.3 Inventory, chests, pickup, HUD, menus, time

The craft is Stardew Valley's; the systems are the Ford's own (game-design.md §10 lists what
was cut).

- **Inventory**
  - 10 slots, keys 1–0: the bag is the toolbar, and the selected slot is what the player
    holds; there is no separate hand slot.
  - Equal items stack.
  - In the menu: drag to move, right-click takes one, Shift+right-click takes half, dragging
    an item out of the menu drops it, and a button organizes the bag.
  - Slot order and the selected slot are part of the world state.
- **Chests**
  - The chest's grid is shown above the inventory's grid.
  - Clicking an item moves it to the other side; right-click moves one.
  - Buttons: organize, and fill existing stacks.
- **Pickup**
  - Items that rules spawn (a harvest, logs, loot) pop out, and fly into the bag within 2
    tiles (Stardew's default magnetic radius is 128 px).
  - Items placed in the world are taken with F. Walking through town never vacuums it.
- **HUD**
  - Top right: the day, the weather, a clock dial.
  - Under it, a "!" journal button that flashes on a new objective.
  - Bottom right: the health bar, shown when health is not full or near danger.
  - Bottom: the toolbar. It moves to the top when the player walks near the bottom edge.
  - Bottom left: messages such as "+1 log" or "The world pauses…".
  - The map name fades in when the player enters a map.
  - Development only: the message log, performance numbers, the Mod Console.
- **Menu** (Esc): Inventory, Options. **Journal** (J): the objective, what is done, and the
  Threadbook (§5.9). An ending card closes the story when the goal state is reached.
- **Time** stops while a menu, a dialogue, a scene or a yes/no question is open.
- **Movement** stays on the tile grid, because rules are tile-based, with smooth
  interpolation. Stardew moves freely; this is the one deliberate difference.

### 5.4 Where undefined behaviour comes from

**Undefined** means the world reaches a situation its rules do not decide, but one a
reasonable world would answer.

**A. The player**

| # | Source | Example | Event | Today |
|---|---|---|---|---|
| 1 | apply the held thing to something | an apple on the well | `interaction` (interact holding X) | raised |
| 2 | put something on or into something | a boot into the campfire | `interaction` (put) | raised |
| 3 | a hit with no reaction | lightning on the well, ice on the inn's hearth | `hit` | raised (salient blows) |
| 4 | an empty-handed action nothing defines | push the boulder, shake the scarecrow | `interaction` | swallowed by the "examine" catch-alls |
| 5 | stepping into a tile in some state | walking into fire, onto thin ice | `enter` | raised |
| 6 | a free intent | "I hide behind the barrel until Oda leaves" | `intent` (reserved) | not offered (D9) |
| 7 | a conversation beyond the written lines | ask Fenn who Skipper is | `ask` (reserved) | not offered (D9) |

For source 4, examining becomes a fallback, not a rule that counts as defining the
interaction.

**B. The world, physical**

| # | Source | Example | Event | Today |
|---|---|---|---|---|
| 8 | a status or element cascade meets an unmodelled pair | fire spreads to the beehive, the washing line, the mail; rain on oil; frostcaps in a burning chest | `status`, `hit` (world-made) | raised when salient |
| 9 | creatures meet things and each other | a fire slime walks into the hay; a boar eats crops; a slime meets the campfire | `meet` | raised when salient |

**C. The world, social (the Radiant layer)**

| # | Source | Example | Event | Today |
|---|---|---|---|---|
| 10 | a person's goal is blocked (Oblivion's rake) | a farmer's field burned but his schedule says "farming"; the fire she tends is soaked; a fallen tree blocks the path | `blocked` | raised when seen |
| 11 | witnessed events (Skyrim's Story Manager) | taking from a shelf in front of its owner; lighting the hay with someone watching | `witness` | owner: a rule; bystander: raised when seen |
| 12 | content invalidated by state (BardOS's stage invariant) | a quest giver unavailable, a schedule anchor destroyed, the rope she asked for burned | `invalid` | raised; the invariant's fallback if unanswered |

**How each is built** (`engine.ts`, `npc.ts`, `mod.ts`):

- **8:** a `status` event, or a `hit` nobody aimed (lightning, a spread), that matches no rule.
- **9:** a creature that steps beside a fixture or a creature of another kind emits `meet`
  (each pair at most once a minute).
- **10:** a schedule entry may name the thing its activity `uses` and what it must be
  (`need`); at the anchor, if it is gone or not so — or the anchor cannot be reached — the
  person emits `blocked` (`about` = the activity), at most once an hour.
- **11:** when the player acts on a thing with an `owner` (its own prop, or its container's),
  every person awake within sight (7 tiles) emits `witness` (`about` = `<verb>:owner` or
  `<verb>:bystander`).
- **12:** content declares **invariants** (`Invariant`: while `when`, `holds` must hold; a
  giver; a text; a fallback). A broken one emits `invalid` once.

### 5.5 One pipeline for every source

The resolution order keeps BardOS's three layers for every source:

1. **Rule library**: the most specific matching rule(s) run. No AI.
2. **Mod port**: nothing matches (and, for world events, the event is salient) → the event is
   **undefined** → raise it.
3. **Fallback**: the port returns nothing (no modder, offline, rejected) → a safe default.
   The game never blocks.

Every source is an event. Events resolve through the rule library; when nothing matches,
the salience filter (§5.6) decides whether to ask. A request goes through the Mod port and
comes back as a patch of type-level **rules**. The patch is validated (schema, ontology,
conflicts, sandbox replay, its tests, regression), applied, and persisted in the shared
library, exactly as today.

- **New event kinds** (built): `meet`, `blocked`, `witness`, `invalid`, with `about` in the
  event and the pattern (the activity, `<verb>:owner|bystander`, the invariant id). Planned:
  `arrive` (entering a place in a new state, like BardOS's ambient beat). Reserved: `intent`
  and `ask`.
- **New effects** (built): `give` (a person receives a thing and says their line for it),
  `emote`, `goto` (leave the schedule for a named anchor for some hours), `layLine` (lay
  terrain in a line away from a role: a felled tree across a river).
- **New conditions** (built): `exists` (something matching a selector exists anywhere),
  `weather`. Who saw it is in the event (the witness is its actor).
- The ModSpec documents all of these, and the validator checks them.

Examples of the patches each source asks for:

- **8:** `on status burning, target tag:bees` → the bees swarm (a status on the hive and the
  tiles around it), plus a topic.
- **10:** `on blocked, actor actor/person, activity farming, reason anchor-burnt` → go to the
  inn for the afternoon, say a line, raise a topic.
- **11:** `on witness, about take:owner` → a line, an emote, the topic
  `thief`.
- **12:** `on invalid, fact quest stage …` → a schedule variant or an alternative anchor that
  keeps the quest playable.

### 5.6 When to ask: salience

The world raises hundreds of events a second. Asking about every one would be expensive
and, as Bethesda learned, chaotic. A world event becomes a request only when **all** of
these hold:

- **The world should care.** Either a near-miss exists — a rule for the same event kind
  matches every role but one (the engine's `nearMisses`) — or the subject carries a
  reactive tag (flammable, conductive, edible, living …). With neither, the event simply
  does nothing.
- **It matters.**
  - The player can see it (the active map, in view), or
  - it involves a person, a quest fact or a landmark.
- **It has not been asked yet.** Its class signature (event kind, the roles' types, the
  status or element) has no open request, is under its ask cap (the deduplication in §8), and has not been answered "nothing".
- **There is budget.** Each kind has a rate limit per game hour (to start: physical 6,
  social 4, blocked 2), so one fire does not fan out into forty requests.

### 5.7 How a request waits

- **Player-initiated:** the involved entities freeze locally, as now; the rest of the world
  runs. The fallback runs at the time-out, and a late patch still teaches the world.
- **World-initiated:** the world never freezes. The default runs at once:
  - physical: nothing happens;
  - `blocked`: the person goes home or waits at the nearest free spot;
  - `witness`: no reaction.

  The patch applies to the **next** event of that class, so the world learns after the fact.
- **Exception:** a physical event in view may freeze only the things involved (the beehive)
  for a short time, as in the player's own case.

### 5.8 Boundaries: what world-initiated patches may not do

Oblivion learned this the hard way:

- skooma addicts killed the dealer a quest needed;
- an NPC without a rake killed another NPC for one;
- hungry guards left their posts and the town was robbed;
- an NPC picked up the Skull of Corruption and used it on the player.

Bethesda forbade NPC-on-NPC violence and toned the autonomy down. The level it shipped is
"funny and weirdly charming, without being completely broken". We aim for the same. The
validator enforces these limits on patches triggered by world events:

- **No harm to persons.** No damage or destroy on actors of kind person, and no turning
  people hostile.
- **Quests survive.** No effect may change quest facts, or make a person, item or place that
  a scene or quest requires unavailable (BardOS: every reactive entity resolves sensibly in
  every reachable state).
- **Property.** People may take only unowned things or their own. Taking another person's
  thing is allowed only as a witnessable act, so a `witness` event follows.
- **Bounded spread.** Spread chance stays below 1 (as now), with no unbounded spawn loops.
  A patch's effects stay within the event's neighbourhood.

Player-initiated patches keep today's limits: the player may still set the hay on fire.

### 5.9 Legibility

Pete Hines: players read unexplained autonomy as bugs (they assume a stolen item "disappeared
due to a bug"). So:

- Every learned thread enters the Threadbook with its cause and its author: **you**
  (player-initiated) or **the world** (world-initiated). For example: "Fire reached the
  beehive: the bees swarmed out."
- The first time the player sees a world-learned moment, it gets a light cue: a shimmer on
  the things involved, and "The world pauses…" in the message line.
- People talk about it. World-initiated patches may raise topics, so the village comments on
  it the next day.

### 5.10 Rollout

1. **The input** (§5.2–5.3) and the remaining player sources 3–5. *Done.*
2. **The physical world** (8, 9), with salience and budgets. It is the cleanest to validate
   and the main driver of the undefined frontier's branching ratio *r*: a world whose
   undefined behaviour comes only from the player's hands cannot grow on its own. *Done.*
   Still open: the coverage sweep over status × type and element × type.
3. **Social reactions** (11): witnesses of acts on owned things. *Done.* Still open: the rest
   of Skyrim's event list (casting in public, a body on the square, litter).
4. **Blocked goals** (10) and **content invalidation** (12). *Done.*
5. **Free intent** (6) and **open conversation** (7). Deferred (D9); their event kinds are
   reserved in the ModSpec now.

Sources:

- Stardew Valley:
  - wiki pages [Controls](https://stardewvalleywiki.com/Controls),
    [Inventory](https://stardewvalleywiki.com/Inventory),
    [Friendship](https://stardewvalleywiki.com/Friendship),
    [Energy](https://stardewvalleywiki.com/Energy),
    [Day Cycle](https://stardewvalleywiki.com/Day_Cycle),
    [Options](https://stardewvalleywiki.com/Options),
    [Player Menu](https://stardewvalleywiki.com/Player_Menu);
  - decompiled 1.5.6 source ([WeDias/StardewValley](https://github.com/WeDias/StardewValley)):
    `Game1.pressActionButton`, `Game1.pressUseToolButton`, `NPC.checkAction`,
    `Farmer.magneticRadius`, `Objects/Chest`, `Menus/ItemGrabMenu`, `Menus/DayTimeMoneyBox`.
- Oblivion:
  - [What was Radiant AI, anyway?](https://blog.paavo.me/radiant-ai/);
  - [the Escapist on Oblivion's NPCs](https://www.escapistmagazine.com/oblivion-npcs-brought-their-world-to-life-then-they-nearly-killed-it/);
  - [UESP: Crime](https://en.uesp.net/wiki/Oblivion:Crime);
  - [CS Wiki: AI](https://cs.uesp.net/wiki/AI_Button).
- Skyrim:
  - [Beyond Skyrim: World Interactions](https://wiki.beyondskyrim.org/wiki/Arcane_University:World_Interactions);
  - [Creation Kit: Story Manager](https://ck.uesp.net/wiki/Category:Story_Manager).
- BardOS: `docs/overview.md`, `demo/loom/src/interact.ts` (free action, conversation,
  examine/trigger, ambient arrival, opening), `demo/loom/docs/quests.md` (the stage
  invariant).

## 6. Rule system

### 6.1 Rule shape

Rules are **data** (JSON), not engine code:

```jsonc
{
  "id": "core/douse-fire",
  "on": "interaction",                      // or "hit", "status", "expire", "tick", "enter", "defeat", "meet", "blocked", "witness", "invalid"
  "when": {
    "verb": ["put", "interact"],
    "instrument": { "tags": ["liquid:water"] },
    "target":     { "status": ["burning"] }
  },
  "guard": { "all": [ { "not": { "status": { "of": "target", "has": "frozen" } } } ] },
  "do": [
    { "op": "removeStatus", "of": "target", "status": "burning" },
    { "op": "transform",    "of": "instrument", "into": "item/container/bucket/empty_bucket" },
    { "op": "vfx",          "at": "target", "fx": "steam" },
    { "op": "say",          "who": "actor", "text": { "en": "Hiss…", "zh": "嘶……" } }
  ],
  "priority": 0
}
```

- **Patterns** (`when`) select by verb, type (is-a), tags, statuses, props.
- **Guards** are a small condition language (`all/any/not`, comparisons over props,
  statuses, time, faction standing) — the Loom Condition idea, extended.
- **Effects** (`do`) are drawn from a fixed, typed set of **primitives**:
  `spawn, destroy, transform, move, give, take, addStatus, removeStatus, setProp,
  addProp, damage, heal, setTile, emit (event), vfx, sfx, anim, say, schedule (delayed
  effect)`. Adding a primitive is an engine change; adding behaviour is data.

### 6.2 Specificity and overriding

Several rules may match. The engine orders them by **specificity** (like CSS): an
exact type beats a supertype, more tags/statuses beat fewer, an instance id beats any
type pattern; `priority` breaks ties. By default only the most specific rule fires;
a rule may declare `"compose": true` to run alongside more general ones. This is how a
patch can **override** a general behaviour for a special case without editing it.

### 6.3 Elemental reactions and the environment

Elements are statuses plus an `element` prop on attacks and items:
`fire, water, ice, lightning, earth, wind` (final set in the ontology). Reactions are
ordinary rules on `status-applied` / `hit` events, e.g.

- wet + fire → **vaporize** (remove wet, extra damage, steam)
- wet + ice → **frozen** (immobilize; frozen water tiles become walkable)
- wet + lightning → **conduct** (spreads along wet/water tiles)
- burning on `flammable` tile → **spread** each tick with probability, until `burnt`
- oil + fire → **ignite** (burst)

Because tiles carry statuses, combat and exploration share the same physics: douse a
burning house with a bucket, or lure enemies onto a puddle and hit it with lightning.
All randomness uses the engine's seeded PRNG so replays are exact.

### 6.4 Combat (on-map, real-time)

- Actors have `hp, atk, def, speed` and an optional `combat` profile (hostility,
  behaviour: melee / ranged / caster, element, drops).
- Attacks are **hit events** (`{attacker, target, element, power}`) resolved by rules:
  base damage is a core rule; elemental reactions are rules; a patch can add new ones.
- Enemy behaviour is a small state machine (idle → notice → chase → attack → flee).
- Combat is therefore not a separate system: it is the rule engine plus a hit event
  and an enemy controller.

## 7. NPC simulation at scale

- Each NPC has a **schedule**: a list of `(time window, place, activity)` entries
  (home → work → tavern → home), with variations by day and weather.
- **Full fidelity** on the current map: tile pathfinding (A* over a cached
  walkability grid), animations, reactions to rules.
- **Coarse fidelity** elsewhere: NPCs off-screen jump between schedule anchors on a
  map-level graph; their state is reconciled when the player enters the map.
- Budget target: the active map holds up to a few hundred actors at 60 fps; the rest
  of the world costs O(schedule transitions), not O(frames).

## 8. The Mod port (the AI slot)

The port is the exact contract a modder implements. In Phase 1 it was exercised by hand from
a dev panel; since Phase 2 the modder service (§13) is the provider, and the engine did not
change when it was plugged in.

```ts
interface ModProvider {
  resolve(req: ModRequest, spec: ModSpec): Promise<Patch | null>   // null = declined / failed / offline
}

interface ModRequest {
  event: UndefinedInteraction                   // the Interaction + why it was undefined
  context: WorldContext                         // generic projection: the involved entities
                                                //   (type chain, tags, props, statuses),
                                                //   nearby entities, map, time, recent events,
                                                //   and the rules that *nearly* matched
  spec: ModSpec                                 // what may be authored and how
}

interface ModSpec {
  ruleSchema: JSONSchema                        // the rule shape above
  primitives: PrimitiveSpec[]                   // every effect op + its argument types
  ontology: { types: TypeTree, tags: TagDef[], statuses: StatusDef[], elements: string[] }
  assets: { vfx: string[], sfx: string[], anims: string[], sprites: SpriteIndex }
  rules: string[]                               // authoring rules: type-level first,
                                                //   no instance ids unless necessary,
                                                //   must not contradict existing rules, …
}

interface Patch { artifacts: Artifact[]; note?: string; author?: string }
type Artifact =
  | { kind: 'rule';   rule: Rule }          // new behaviour; rule.tests carries its own tests
  | { kind: 'type';   type: TypeDef }       // a new item/fixture/actor type if the outcome needs one
  | { kind: 'status'; status: StatusDef }   // a new status if the outcome needs one
```

`ModRequest` also carries a **scenario**: a self-contained 7×7 snapshot of the interaction's
neighbourhood that the validator replays in a sandbox engine (and that patch tests reuse).

Lifecycle of a patch:

1. **Detect** — the rule library finds no match for an interaction.
2. **Freeze locally** — only the involved entities pause; a "…" bubble shows. The rest
   of the world keeps running.
3. **Request** — `ModRequest` is built and sent through the configured provider.
4. **Validate** (`validatePatch`, the engine is the trust boundary):
   schema check → ontology check (types/tags/assets exist) → effect type check →
   conflict check against existing rules at the same specificity → **sandbox replay**
   of the triggering interaction and of the patch's own `tests` on a copy of the state.
5. **Apply** — the rule enters the library; the frozen interaction is re-resolved and
   now hits it.
6. **Persist** — see §9.

Failures at any step fall back to the safe default (nothing happens; the game never blocks).

**One question at a time.** Requests are keyed by the interaction's class (event kind, verb,
the roles' types or terrain). While one is open the same class does not ask again; a class is
asked at most twice a session; a class dismissed by hand ("nothing happens") is not asked
again. A late patch still applies (`ModPort`, `signatureOf`).

**Dev panel (Phase 1):** lists undefined interactions as they happen, shows the exact
`ModRequest` JSON, and lets a human paste a `Patch` that goes through the same
validate → apply → persist path. This proves the port end to end without an LLM, and
the logged requests become the modder's test set later.

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
- Saves live in the browser. The rule library is fetched at boot (and, later, synced
  from the modder service).
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

Direction from the user: build a small but refined demo first, then scale. The 460-map world
stays as the scale track (`?world=saenvar`); the default world is hand-crafted.

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

### The self-improving agent (2026-10-01)

The offline profile no longer uses the patch pipeline. A request is worked by an SWE-style agent
(`packages/agent`) as a **repository**: rules as files, the ModSpec as docs, the validator as the
tests. The same agent works engine issues (hidden fail-to-pass tests) and SWE-bench instances,
and an outer loop lets it change its own loop under meta-validation. Design, guard rails and
smoke results: [rsi.md](rsi.md).

## 14. Next

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
- Live runs of the world's own requests through the modder (built and tested offline): budgets
  and salience tuned against what players see.
- Free-text input (deferred, D9).
