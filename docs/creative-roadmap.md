# Maintained creative roadmap

This is the user-intent ledger, including the original GazedTown discussion and the OpenWorld collaboration. It preserves ideas for implementation; a backlog entry is not an instruction to build every feature immediately. Keep the current game's authored lore intact and develop larger alternate settings as explicit scenarios/content packages.

Status vocabulary: **existing** = an implementation is present; **verified slice** = the stated behavior was actually exercised; **planned** = implementation/checkpoint is proposed; **feedback** = preserve the observation without treating it as an immediate coding request. Change status only with corresponding evidence.

## 1. Experience and world

| ID | User intent | Current footing / route | Next playable check |
|---|---|---|---|
| VISION-01 | A game with Stardew-like pixel-town readability and interaction, Stanford-town-inspired residents, high freedom and a complete-game feel | Existing pixel RPG and deterministic simulation; rich resident autonomy is developed through needs, work, schedules and social state | A continuous exploration/living/creation journey with understandable choices and consequences |
| WORLD-01 | A beautiful general map, expansion space and enterable interiors | Existing connected outdoor/interior maps and renderer; geography and encounter design remain authoring work | Walk a town route, enter/leave interiors, return and reload without broken portals |
| WORLD-02 | Shops, cafe, market, homes, library and school; detailed rooms and objects | Existing content includes many town/interior types; requested locations must be checked individually when chosen | One location supports a full activity and its residents, not only a room image |
| POLISH-01 | Animated river and trees; convincing character movement and actions; sound, atmosphere and environmental detail | Existing animation, status/VFX and sound systems; original demo feedback remains a quality reference | Observe walking, object use and environmental motion at the gameplay camera with appropriate sound |
| POLISH-02 | Remove the cafe scene's unwanted white outer area; make the room visually complete | Feedback from the earlier demo specifically concerns the white framing, not a demand to fill all walkable space | Scene fills the intended game view; furniture density and passage remain intentional |
| UI-01 | Game controls and UI, with natural modification/interaction entry points | Browser delivery is compatible with full-game presentation; persistent hotkey annotation and dashboard-like framing were disliked in the early demo | Understand, act, receive feedback and return to play with suitable contextual hints |

## 2. Objects, production and interaction

| ID | User intent | Current footing / route | Next playable check |
|---|---|---|---|
| OBJECT-01 | Player and residents pick up, use, exchange and own the same small objects | Existing entities, containers, ownership and shared actor/event semantics | The same object can move between player, world and resident without duplication |
| AI-01 | Ask an NPC to make a new axe, food or other useful thing | Verified slices: jam, pick, hat, steel sword, body armour, berry food and fire focus; real DeepSeek designs, generated icons, actual native use and save round trips | Broaden resident consequences and distinctive activity packages; retain precise cost/stock behavior |
| AI-02 | Improve packages/ai with grounded creation and efficient model use | Implemented stock checks, isolated history, bounded type/plan repair and world-derived capability/type/consumer guidance; real draught rerun used 10,545 input tokens versus 61,577 in the earlier failed attempt | Keep a fixed task set to measure success, actual use, tokens and latency across models; the two observed attempts are case evidence |
| AI-03 | Reason through an object's multiple uses and their consequences: jam can be eaten, spread, thrown or gifted, with coherent pixels and sound | Implemented NPC use plans, shared capabilities including attack/wear/cast, separate isolated trials/adoption, registered save-local packages, ordinary bag uses, notebook reuse, existing-item extension and portable exports/imports | Actual consume/transfer/nutrition, sticky movement, delayed flight/contact, elemental combat and persistence are tested; expand through versioned capability modules and gameplay cases |
| ART-01 | Consistent pixel style, icon drawing, possible ImageGen/pixel-draw tool support | Existing runtime artist returns 16x16 grid/palette; variants reference their prototype; larger assets use offline workflows | Human-check recognizable silhouettes, palette/material consistency and in-game scale; add artist adapters behind the same asset contract |
| DETAIL-01 | Click objects or their parts to inspect meaningful, changing details | Existing targeting/layers, labels, tooltip/codex and state can support object-specific inspection | Inspection reads actual state and reveals meaningful possible actions |
| DETAIL-02 | Eating, coffee-machine adjustment and detailed production interactions | Verified food use; cafe-machine workflow is planned | Inspect tank/grinder -> supply inputs -> adjust -> produce a cup -> drink/give it; material, device, sound and resident state agree |
| HOME-01 | Place furniture, rest, build and personalize places | Existing placement/ownership/furniture/posture primitives; verified shared chair/bench/log-bench sitting, moving away rises normally | Extend a useful home activity and resident use; preserve placement through reload |
| ACTIVITY-01 | Expand map details into gardening and fishing | Existing sow/water/grow/harvest and fishing modules; real AI garden verified harvest -> sit -> move -> return -> reload/reentry | Register coherent activity metadata, tools and resources; reuse the existing fishing HUD on generated regions |
| MINE-01 | Mining and resource-driven progression | Verified slice: invented pick mines a vein and yields collectable ore | Ore -> processing station -> equipment -> exploration/production benefit, with unlocks and persistent depletion |
| TECH-01 | AI helps invent a technology tree | Existing recipe/skill/quest prerequisites; a full generated branch is planned | A three-node branch has reachable inputs, useful outputs, gating and an alternative choice |

## 3. Equipment, combat and new regions

| ID | User intent | Current footing / route | Next playable check |
|---|---|---|---|
| GEAR-01 | Armor attributes and visible equipment coverage | Existing slots, materials/quality, affixes/sets and partial worn-look bindings; AI body armour verified in body slot with defence 0 -> 2 after real save/load | Equip/unequip one complete outfit; verify stats, look, animation and save state together |
| GEAR-02 | Weapon/material fusion and distinctive results | Existing makeup/recipes/type inheritance/stat/status systems; arbitrary multi-tool fusion needs explicit design | Consume two intended inputs, produce one bounded weapon and observe its claimed effect on a real target |
| COMBAT-01 | New weapon effects, skills and enemies | Existing monster kits, encounters, elemental/status primitives and FX assets; AI sword damages a target, AI fire focus casts native spells and burns creatures/persons | Extend a distinct combat ability with preparation/release/contact/recovery, reaction, interruption and repeated-use checks |
| REGION-01 | Desert, hell-like underground areas and more monsters | Existing map/terrain/region/monster authoring; requested regions remain planned | A small connected region has resources, threat, a goal, inhabitants and a safe return route |
| REGION-02 | Describe a desired new world to a coding agent and have it build one | In-game bounded map creation/editing now trials navigation/references, connects gates, saves dynamic state and supports export/import; a real-model glade passed keyboard return/reload/reentry | Next add resident/quest/resource progression contracts and enter/accomplish/return checks; a connected map is the current slice of a larger world package |

## 4. Residents, relationships and god mode

| ID | User intent | Current footing / route | Next playable check |
|---|---|---|---|
| NPC-01 | Fun personas, relationships, normal interactions and a sense of purposeful action | Existing roles, schedules, needs, work, memory/social mechanisms; a Stanford-town-style LLM planning layer would be a deliberate addition | Residents choose a relevant action because of actual needs/knowledge and use the required objects |
| NPC-02 | New items and player actions affect residents | Verified slices: invented jam feeds an NPC; crafting and gifting it transfers ownership and raises regard, persisting after reload | Add voluntary resident consumption/work, memories and observable follow-up actions |
| SOCIAL-01 | Friendship/affection with richer personal preferences and consequences | Existing per-pair regard/social memory; verified new-jam gift raises neutral smith's regard from 0 to 3.2 and survives reload | Broaden preferences and shared experiences; check downstream actions and repeat-gift behavior |
| SOCIAL-02 | Potential romantic relationships and personal story development | Planned experience beyond existing goodwill/household mechanics | Consensual relationship stages, preferences and remembered shared events produce distinct choices; verify state progression and saved consequences |
| GOD-01 | Edit relations, personas and settings; inspect before/after reactions | Planned explicit author/scenario interface; runtime hole-filling cannot substitute for overriding defined world settings | Branch a save, apply a coherent edit, preserve a before snapshot/event history and observe behavior under the new setting |
| ERA-01 | Switch eras with different places, objects and ways of living | Planned scenario/content overlays, asset sets and migration policy | Switch one small area between two eras; define inventory, identities, memory, technology and map-state transitions explicitly |

God edits must distinguish world facts, a resident's observations/memory and the intervention history. An altered fact does not automatically erase what a resident remembers. The retained/reset-memory policy is a scenario choice to specify when implementing GOD-01.

## 5. Development and evaluation

| ID | User intent | Implementation / maintenance contract |
|---|---|---|
| DEV-01 | A roadmap with demo/general map, logic, debugging, environment, art, full experience, AI residents, god mode, eras/items and expansion hooks | Maintain the checkpoints below and the evidence for each affected journey |
| DEV-02 | A coding agent that knows the project, changes it coherently and can sandbox/debug it | Root AGENTS.md plus developer-playbook.md; narrow source map, reproducible fixture, actual input/trace, save/use checks and reviewable diff |
| DEV-03 | Flexible use of models and agents, including DeepSeek and Claude Code | Runtime model, artist and development agent are separate choices; bound calls, keep credentials out of content, preserve cost/latency evidence |
| DEV-04 | A creator's test island (assistant proposal) | Planned connected small area with a craftsperson, mineable vein, cooking station and usable furniture; test an idea immediately, then promote its tested data/assets into a content package |
| DEV-05 | Durable autonomous NPC append jobs | Stormfang exercised composed item/mechanism/map creation. The sunflower order completed independent discovery, native sow/water/grow/harvest, publication and acceptance; host QA covered load later, admission, return/reentry and native save reload. Vague orders now have a short NPC discussion before the coding job. Regression covers publication recovery, admission retry, adoption order, persisted native inputs and checkpoint-first continuation. See autonomous-creator.md for the evidence and host interventions. |
| EVAL-01 | Stable frontier-style evaluation of adding and maintaining the world | Separate rule completion, NPC invention/use and project SWE; reuse official/existing harnesses, independent state verifiers and F2P/P2P regression |

Cross-media references were explicitly deferred by the user and are outside the active work.

## 6. Checkpoints

| Checkpoint | Deliverable | Completion evidence |
|---|---|---|
| C0: grounded creation | Understand the code, fix stock/trial issues, run three real-model examples | Verified jam eating/feeding, pick mining, hat wearing, exact cost, private scope, save/reload and recraft; retain the local workbench records |
| C1: useful creation and feedback | Fixed tasks for tools, food and wearable items; resident use/preferences and efficient family context | Actual use and resident consequences pass, including refusal, persistence and regression; compare model cost/latency |
| C2: a detailed room | A workshop/cafe with a complete production/living interaction | Whole activity is understandable and repeatable, with devices, objects, residents, animation and sound |
| C3: a coherent region | Connected maps, resource chain, encounter and resident/quest loop | Enter -> explore -> gain a resource/capability -> return, with reachable goals and persistent changes |
| C4: world-development SWE | Isolated project tasks and hidden world-state verifiers | New requests pass, old behavior remains, dependencies/saves are handled and diff/trajectory are inspectable |
| C5: scalable content | Versioned content packages, dependency/migration rules, asset cache and fixed regression suite | Repeated expansions remain playable, explainable, saveable and maintainable |
| C6: resident and god/era extensions | Explicit scenario/memory/intervention policy and author controls | Before/after behavior is observable; era transitions preserve the specified world invariants |

## 7. Update protocol

For a selected row, add a short implementation note with: the player outcome, touched data/source/assets, evidence command or artifact, current status and next failure/decision. Preserve the user's original intent. Keep **implemented**, **observed**, and **planned** distinct. A test count or generated image alone does not close a player-experience checkpoint.

Reusable successful additions should become authored data or a versioned content package with tests. The conversation is context; this ledger and the executable examples are the durable implementation record.

### AI-03 design note: coherent multipurpose objects

The maintained implementation and mod-system references are in `creation-workshop.md`; source/asset links and the extension/verification/registration checklist are in `creation-pack-authoring.md`. Historical model replies remain evidence, while the present task centers on controlled multipurpose behavior and reusable content packages.

### Append production orders (2026-11-03)

The retained order set and real-model evidence live in `outputs/openworld-workbench/creation-append` outside the checkout. These orders extend the same workshop, registry, native actions and save format.

| Intent | Verified result | Shared implementation / next checkpoint |
|---|---|---|
| Repair swords and armour using the game's art | Actual NPC sword and leather cuirass retain original silhouettes and material edits; rejected repairs preserve a valid original with explicit evidence | `artReferences`, two-call sketch review, final art saved/exported; continue selecting recognizably compatible source forms |
| Jam can be eaten, gifted and thrown at people/creatures | Actual stone jar works on both target classes, consumes one item, harms and slows; an NPC uses-only revision adds the omitted person branch without recrafting | Material-dependent impact verification, delayed flight and recipient coating; reusable empty containers remain their own represented mechanic |
| Sunflower, orchid, sunrose, rose, tulip and wheat gardening | Actual AI garden harvested all six; normal seed selection, sowing, bucket watering and well refill work for flower and wheat; all species complete native growth cycles in content tests | One species table and original-pack art; extend species art through the same reference/artist contract |
| Secret forest with river, falls, bridge, flowers, fireflies and pavilion | Retained actual DeepSeek layout supports both-bank traversal, landmark access, return, reload and continued animation/audio | Structured paint compiles exact rows; native reach and footprints; map-local environment and original projected pavilion strips |
| Four-element bending, accessory and temporary empowered mode | Actual NPC wrist focus wears in its slot, channels four distinct effects and kills a native dungeon foe; temporary stats, costs, saved cooldown and expiry verified; browser UI passed Z/click/repeat/empower/cancel/native hotbar/unequip, and lightning/ice bolts hit a native dungeon creature | Shared `channel`/`empower`; player operation includes Z select/cycle on the clickable ability strip, left-click aim, Esc cancel, hotbar deselect; `empower` preserves the channel and `this bracer sets `variantChance`=.25 (75/25); channel v1's optional parameter DEFAULT remains 0 for fixed older plans |
| Make the additions coexist and remain playable | Four real NPC packages plus both actual maps imported/trialled/adopted into one finite-kit save; exact aggregate materials and one of each item; native menu file import works | Maintain the combined importable save and per-order evidence; no source-entity merging |

`ResearchPlan` now records action/target/parameters and pending ideas. Registered capabilities provide preconditions, bounded compilers, recipient behavior, presentation events and actual-result verifiers. `WorkshopPackage` owns the type/use plan, capability versions, rules/statuses and dependencies; save-local evidence binds adoption to the exact tested draft. Compose shared behavior instead of generating each object/action pair independently.

Packaging must have an explicit representation. An abstract single food unit and a reusable jar containing multiple portions imply different opening, consumption, breakage, empty-container and gift-value rules. Descriptions and sprites must follow the chosen representation. Check that spreading portions and producing empty containers cannot create resources or food value repeatedly without spending the source.

Read the smallest relevant closure: type parents and capability consumers, recipes/materials, target families, event/schema constraints, existing asset IDs and regression cases. Produce a coherent content delta with definition/recipe/rule/status/asset changes, tests and persistence dependencies. Add a shared mechanic once when existing rules cannot express it; keep per-item names and asset selection in data. Sandbox feedback stays in the trial record; committed world events drive player-facing effects.
