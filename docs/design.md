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
| D7 | Setting | **Saenvar** (from BardOS) expanded to full scale |
| D8 | Player input | two keys, **Action** and **Use** (after Stardew Valley, §5.2), over the engine's three verbs **take**, **put**, **interact** (+ hit); the keys choose the verb |
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

Status: **agreed 2026-10-01, not yet built** (the current build still uses the F/G/E/U/Space
keys of Phase 1).

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

### 5.2 Player input: two keys (after Stardew Valley)

| | Keyboard | Mouse |
|---|---|---|
| **Use** | C · Space | left click |
| **Action** | X · Enter | right click |
| Menu | Esc · E | |
| Journal (objectives) | F | |
| Map | M | |
| Toolbar | 1–0, -, = · Tab (next row) | wheel |
| Run | Shift | |

Space and Enter are conveniences; the rest are Stardew's own bindings.

**The target tile.** This follows `Game1.pressActionButton`:

- It is the mouse's tile if that tile is one of the player's 8 neighbours; otherwise it is the
  tile the player faces.
- Action is forgiving. If nothing answers on the target tile, it also tries the tile below
  it, the tile above it, then the player's own tile.
- The target is always outlined. Above it, a label shows what each key will do, taken from a
  dry run.

**Action resolves in this order; the first step that is defined (by dry run) wins:**

1. A dialogue is open: the first press finishes the typing, the next advances or confirms a
   choice.
2. The target:
   - a person: if the player holds a giftable (non-tool) item, give it (`put`); otherwise
     talk (`interact`, empty hand). In Stardew (`NPC.checkAction`) the gift wins over talk,
     so to chat you switch to a tool or an empty slot.
   - a container: open the transfer panel.
   - a bed: ask "Sleep until morning? Yes / No".
   - a door, sign or board: enter or read.
   - a ripe crop or a loose item: take it.
   - something that accepts the held item (a fish on a campfire, a log into a fire): put it.
3. The player holds a placeable item: place it in front (`put` on the tile).
4. The player holds food or drink: ask "Eat X? Yes / No" ("Drink X?" for drinks).

**Action never raises an undefined interaction.**

**Use:**

- A tool, weapon or wand swings or casts at the target. A tool applies itself (`interact`
  holding the tool). A weapon or wand makes a **hit**, and the elemental reactions follow.
- A tool or weapon facing a person becomes Action, so a villager is never hurt by accident
  (`pressUseToolButton`).
- A non-tool item facing empty ground is placed there (Stardew's left click).
- A non-tool item facing something is **applied to it** (`interact` holding X). These are
  the player's experiments, and they may be undefined (§5.4, source 1).
- An empty hand does nothing.

### 5.3 Inventory, chests, pickup, HUD, menus, time (after Stardew Valley)

- **Inventory**
  - 3 rows × 12 slots. The first row is the toolbar, and the selected slot is what the
    player holds; there is no separate hand slot.
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
  - Items placed in the world are taken with Action. Walking through town never vacuums it.
- **HUD**
  - Top right: date and weekday, weather, season, a clock dial.
  - Under it, a "!" journal button that flashes on a new objective.
  - Bottom right: the energy bar. The health bar shows only when health is not full or in
    dangerous places.
  - Bottom: the toolbar. It moves to the top when the player walks near the bottom edge.
  - Bottom left: messages such as "+2 log" or the energy a meal restored.
  - The map name fades in when the player enters a map.
  - Development only: the message log, performance numbers, the Mod Console.
- **Menu tabs**: Inventory, Social (hearts, gifts this week, talked to today, birthday), Map,
  Threadbook, Letters, Options. The journal opens with F.
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
| 3 | a hit with no reaction | lightning on the well, ice on the inn's hearth | `hit` | silently nothing |
| 4 | an empty-handed action nothing defines | push the boulder, shake the scarecrow | `interaction` | swallowed by the "examine" catch-alls |
| 5 | stepping into a tile in some state | walking into fire, onto thin ice | `enter` | silently nothing |
| 6 | a free intent | "I hide behind the barrel until Oda leaves" | `intent` (reserved) | not offered (D9) |
| 7 | a conversation beyond the written lines | ask Fenn who Skipper is | `ask` (reserved) | not offered (D9) |

For source 4, examining becomes a fallback, not a rule that counts as defining the
interaction.

**B. The world, physical**

| # | Source | Example | Event | Today |
|---|---|---|---|---|
| 8 | a status or element cascade meets an unmodelled pair | fire spreads to the beehive, the washing line, the mail; rain on oil; frostcaps in a burning chest | `status`, `tick`, `hit`, `expire` | silently nothing |
| 9 | creatures meet things and each other | a fire slime walks into the hay; a boar eats crops; a slime meets the campfire | `enter`, `hit`, `meet` (new) | silently nothing |

**C. The world, social (the Radiant layer)**

| # | Source | Example | Event | Today |
|---|---|---|---|---|
| 10 | a person's goal is blocked (Oblivion's rake) | Hollis's fields burned but his schedule says "farming"; Fenn's dock is gone; a bed burned; a fallen tree blocks the path | `blocked` (new) | the person stands or jumps |
| 11 | witnessed events (Skyrim's Story Manager) | taking from Oda's shelf in front of her; lighting the hay with Hollis watching; casting in the inn; a slime's body on the square; litter | `witness` (new) | only the topics we wrote |
| 12 | content invalidated by state (BardOS's stage invariant) | a quest giver unavailable, a schedule anchor destroyed, a letter about a thing that is gone | `invalid` (new) | unchecked |

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

- **New event kinds:** `witness`, `blocked`, `meet`, `arrive` (entering a place in a new
  state, like BardOS's ambient beat) and `invalid`. Also reserved: `intent` and `ask`.
- **New effects for people:** say a line, raise a topic, befriend, emote, set a mood, and
  override the schedule (go to an anchor for N hours).
- **New conditions:** who witnessed, at what distance, and their temperament.
- The ModSpec documents all of these, and the validator checks them.

Examples of the patches each source asks for:

- **8:** `on status burning, target tag:bees` → the bees swarm (a status on the hive and the
  tiles around it), plus a topic.
- **10:** `on blocked, actor actor/person, activity farming, reason anchor-burnt` → go to the
  inn for the afternoon, say a line, raise a topic.
- **11:** `on witness, event take-owned, witness = owner` → friendship −40, a line, the topic
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
  (player-initiated) or **the valley** (world-initiated). For example: "Fire reached the
  beehive: the bees swarmed out."
- The first time the player sees a world-learned moment, it gets a light cue: a shimmer on
  the things involved, and "The valley pauses…" in the message line.
- People talk about it. World-initiated patches may raise topics, so the village comments on
  it the next day.

### 5.10 Rollout

1. **The input** (§5.2–5.3) and the remaining player sources 3–5.
2. **The physical world** (8, 9), with salience and budgets. It is the cleanest to validate
   and the main driver of the undefined frontier's branching ratio *r*: a world whose
   undefined behaviour comes only from the player's hands cannot grow on its own. The
   coverage sweep extends to status × type and element × type.
3. **Social reactions** (11): the event list after Skyrim's Story Manager, with witnesses.
4. **Blocked goals** (10) and **content invalidation** (12).
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
  "on": "interaction",                      // or "tick", "status-applied", "hit", "enter-tile"
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
  fixtures, items, creatures, portals) and the Hearthvale maps + 12 villagers.
- **Story as data** (`packages/content/src/story.ts`): objectives keyed by a player prop and
  advanced by ordinary rules (instance-bound to the unique story NPCs).
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

- Grow Hearthvale with the offline profile (curriculum, guided by what players actually try);
  watch the live numbers above as the library grows.
- Self-improvement experiments ([rsi.md](rsi.md)): the SWE-style agent, world tasks as
  repositories, engine tasks, the outer loop and the SWE CLI are built and smoke-tested; runs at
  scale and the team's benchmark on snapshots come next.
- Offline content generation at full scale through the same modder.
- Public deployment with the shared rule library.
- Paper metrics: rule-library growth, patch reuse rate, LLM calls per play-hour over
  time, validation pass rate, repair rounds per patch, consistency checks, play-tester
  plausibility ratings; for RSI, the external benchmark at each self-state snapshot.
- The sources of undefined behaviour beyond the player's hands (§5.4–5.10): the physical world
  first, then witnessed reactions, blocked goals and invalidated content.
- Free-text input (deferred, D9).
