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
| D8 | Player verbs | exactly three: **take**, **put**, **interact** (+ one held-item slot) |
| D9 | Free-text input | **not in scope** for now |
| D10 | Combat | **on-map, real-time** (Zelda / Stardew-like), elemental reactions interacting with the environment |
| D11 | Rule system | **one** rule engine for world interactions, elemental reactions and combat |
| D12 | Phase 1 | game infra fully working at target scale; **Mod port defined and exercised by hand**, no LLM wired in |

## 3. Architecture

Strict dependency direction, as in BardOS:

```
client (Phaser + UI)  ──▶  engine (pure TS, in a Worker)  ──Mod port──▶  modder (later; HTTP)
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
  modder/     (later) the LLM service, descended from BardOS
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

### 5.1 Player verbs

The player has an inventory and **one held-item slot**.

| Verb | Target | Meaning |
|---|---|---|
| **take** | item on tile / in container / fixture that yields items | move it to hand (or inventory) |
| **put** | tile / container / fixture / actor | place the held item there (onto an actor = give) |
| **interact** | actor / fixture / item / tile | empty-handed: talk, open, examine, activate; holding X: *apply X to the target* |
| attack (combat) | direction / target | swing / cast the equipped weapon or element |

Every player action becomes an **interaction event**:

```
Interaction = { verb, actor, target, instrument?, at, time }
```

`instrument` is the held item (for `put` it is the item being placed). Undefined
interactions arise almost entirely from `put X on Y` and `interact Y holding X` — tens
of thousands of items × every target is a naturally open combinatorial space, with
only three verbs to learn.

### 5.2 Resolution order (as in BardOS's three layers)

1. **Rule library** — the most specific matching rule(s) run. No AI.
2. **Mod port** — nothing matches → the interaction is **undefined** → raise it.
3. **Fallback** — the port returns nothing (no modder, offline, rejected) → a
   generic, safe default ("nothing happens", a shrug bubble). The game never blocks.

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

## 8. The Mod port (the AI slot — defined now, wired later)

The port is the exact contract a modder will implement. In Phase 1 it is exercised by
hand from a dev panel; nothing in the engine changes when an LLM is plugged in.

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

Failures at any step fall back to §5.2 step 3.

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
- Phase 1 keeps the library local (a file / IndexedDB) behind the same interface a
  server store will implement.

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

## 13. After Phase 1

- Modder service: port BardOS's pipeline (comprehend → query → design → review) to
  author **rules** against this ModSpec; add a rule-library search tool so it reuses and
  generalizes instead of duplicating.
- Offline content generation at full scale through the same modder.
- Public deployment with the shared rule library.
- Paper metrics: rule-library growth, patch reuse rate, LLM calls per play-hour over
  time, validation pass rate, consistency checks, play-tester plausibility ratings.
- Free-text input (deferred, D9).
