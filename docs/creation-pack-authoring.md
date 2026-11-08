# Maintaining a playable creation

Read `creation-workshop.md` for design decisions and references. This file is the maintenance checklist and source map for the implemented workshop. The atomic unit is a versioned package: an item definition or existing subject, its use plan, capability versions, dependencies, owned rules/statuses, and trial evidence. Array positions are storage, never identity.

## Player loop

Choose **New game -> Creative workshop** to start beside Haldor with a finite kit. Talk normally, choose **Make something together**, then offer a short or detailed idea. Item/map tabs start another idea. The held-item button starts a uses-only subject. The NPC can propose useful branches and keep unsupported ideas pending; the player can revise the plan in ordinary language.

**Try** runs each branch in an isolated world/library. **Adopt** rechecks the current world and creates one item, adds uses, or connects a region. Adopted uses also appear in the ordinary inventory context menu. An item-target use lets the player choose its receiver in that bag, preserving both exact instance IDs. The notebook retains discussion, revisions and detailed evidence; successful trial details are collapsed by default. A new proposal invalidates the previous trial. Export creates a JSON content file; import creates a new draft requiring trial/adoption in the receiving world. The normal encounter-time AI rule-completion path continues alongside this explicit authoring loop.

The game runs its engine in the browser worker. The connected model brainstorms/designs/draws on request; it does not simulate every tick. The HTTP modder and browser BYOK worker both use the same request contracts. A development coding agent changes capability implementations and authored content separately.

## Source and ownership

| Responsibility | Source |
|---|---|
| Conversation, type prerequisites, one bounded plan repair | `packages/ai/src/modder/research.ts`, `pipeline.ts`, `prompts.ts` |
| Plan parser, capability registry/compiler, actual-use trials, registration, revisions | `packages/engine/src/creation.ts` |
| Portable item/use manifest validation | `packages/engine/src/creationTransfer.ts` |
| Map references/navigation, local chunks, portals, disable/restore | `packages/engine/src/creationMaps.ts` |
| Save-local player draft and trial/adoption orchestration | `packages/runtime/src/workshop.ts` |
| Worker messages, NPC requests, map streaming, load restoration | `packages/runtime/src/worker.ts`, `protocol.ts` |
| Game UI, targeting and JSON file handling | `packages/runtime/src/main.ts`, `ui/research.ts`, `ui/research.css` |
| Pixel data -> texture, world effects -> animation/audio | `packages/runtime/src/render/assets.ts`, `render/scene.ts` |
| Finite creator start kit | `games/openworld/client/src/creator.ts`, `games/openworld/tools/src/demo/world.ts` |

Generated item art is a 16x16 palette/grid stored in the type definition and exported with it; the renderer registers `art:<typeId>`. Existing forms retain their catalogue sprite. This is the game's existing runtime pixel artist, not a separate ImageGen service. Map drafts reuse known terrain and object assets. Sounds and impact FX are registered presentation code, shared by capabilities, with no arbitrary model-supplied media URL.

NPC sketches receive original-game `artReferences`, independently of variant permissions. They use one generation call and one inspection/repair call. Equipment and true variants preserve the source pose, outline and transparent openings (mask IoU at least 0.9); new food forms use the reference for style and can change silhouette. Final checks and host geometry determine acceptance. A repair that damages a valid reference-preserving original retains that generated original, with explicit provenance. Original, repaired, reference, checks and fallback remain in sketch evidence. The admitted final art follows ordinary save/export behavior. Unrelated runtime rule drawing does not gain these extra calls.

A failed item trial supplies bounded `trialFeedback` with the current revision and actual check errors to the next NPC conversation. Revising the draft clears that evidence. A use plan without either a design or a selected existing subject is repaired in the existing conversation repair round; it cannot silently leave the UI with an uncraftable proposal.

## A use tree is an executable contract

Every ready branch needs a registered capability, target class and bounded parameters. `pending` is a creative backlog, not executable behavior. The shared vocabulary includes eat, drink, feed, gift, inspect, spread, throw-coat, mine, attack, wear and cast. Native attack/cast select the exact bag weapon and reuse combat, profession, range, cooldown and recipient rules. An explicit attack on a person draws the weapon through normal controls. Wear uses the real slot/stat consumer. Magic elements use the world's registered element vocabulary. Do not add inspect/gift as filler: offer branches that answer the request or a concrete NPC suggestion.

For example, one inventory unit of jam can be eaten, spread onto food, gifted or thrown. These are alternatives consuming/transferring the same unit. Spreading transfers actual source nutrition by default. A reusable empty bottle, multiple portions, preservation, alcohol intoxication or a persistent sticky floor each need their own represented state and supported mechanic; an NPC description does not implement them.

Other useful small designs include a berry tonic to drink/gift/throw, a mining tool with inspection marks, a lamp oil flask to apply a known coating, and a lunch to feed a resident. A future picnic set, machine or portal room should be its own coherent package with fixtures, recipes and behavior rather than hidden object-name conditionals.

## Reusable player-operation checklist

Plan each recurring use against the actual input model; do not invent keys or a parallel interaction system.

- **Source/equip entry** — name the exact inventory item or equipped slot that starts the use; a channel effect requires a worn accessory or held native magic focus. Other capabilities follow their own source eligibility.
- **Select/cycle** — choose the effect via the clickable ability strip; cycle candidates with **Z**.
- **Aim/target/range** — left-click the target to aim; honor the capability's target class and existing range rules.
- **Execute/repeat** — trigger through the native control and confirm repetition is intentional rather than accidental.
- **Cancel/return** — **Esc** cancels the interaction and returns to the prior state.
- **Feedback** — state the observed result (bolt, transfer, message, status) and whether it is client-visible.
- **Key/modal conflicts** — verify the chosen keys do not collide with a modal, text entry, or an existing binding.
- **Source disable** — select a native hotbar slot to clear the current selection, or unwear/disable the source; confirm the interaction stops when the source is unavailable.
- **Save/reload** — persist and verify the package plan, eligibility, resources, status expiry and cooldown clocks. Frontend selection is transient and is reselected after a page reload rather than persisted.
- **Real UI acceptance** — mark a row as verified only after it passes in the actual browser UI, not from a plan.

## Adding a capability

Use `registerWorkshopCapability` with a stable ID/version, localized descriptor, allowed targets and parameter schema, trusted `compile`, actual-result `verify`, and optional type-precondition `problems`. Built-in capabilities follow this same registry route. The model supplies finite plan data; it never supplies the compiler function. Compilers emit bounded existing rule AST and recipient events, preserving host-only writes. Ordinary controls do not receive creator selection parameters.

Before registering a new mechanism:

1. Identify the player action, source instance, target, allowed range and authoritative state change. Reuse an existing action/effect when possible.
2. Write a real-world fixture proving the receiver changes, the resource is consumed/transferred exactly once, and rejected actions leave it available. Check the consumer of a status, not only its name.
3. Implement feedback using committed world events and actual item assets. For timed behavior, define launch/contact/recovery, interruption and save/load semantics.
4. Add the descriptor/compiler/verifier in one owned module; expose it through `researchCapabilities`. Check unknown version/parameter rejection and ensure a repeated use cannot create resources.
5. Run trial, adopt, real use, save/load, reuse and disable/dependency checks. Then update the capability version and this record.

Do not special-case item names throughout AI, engine and UI. For a new parameter or persistent state, choose the owning module, version its contract, and add one causal regression. A content-only addition should not require editing generic controls/rendering.

`channel` and `empower` are reusable elemental capabilities. A worn accessory or held native focus pays fullness for stamina. Channeling uses a clear row/column: fire burns, water wets/extinguishes, wind displaces, and earth briefly stuns through recipient events. Branches share a saved cooldown. Empower grants a finite four-element mode and temporary combat stats; its duration and recovery persist through load. A target defeated partway through the element sequence receives no postmortem strikes. UI descriptions show actual costs, range and duration.

## Map contract

AI maps place known ordinary objects on known terrain within a bounded grid. IDs are rewritten into the package/revision namespace. Trials check shape/references plus reachable entry, return and object access. Adoption adds visible chalk gates and a connection back to the source. Local map definitions and dynamic entity changes live in the save; reloading a chunk must not resurrect harvested objects. New revisions replace only the owned entrance; older return routes remain usable. A region containing the player or another region's entrance cannot be unplugged.

The initial map mode is a connected exploration/collection region. New resident schedules, quests, dungeon progression, boss kits and technology trees remain separate authored content mechanisms. They should declare dependencies on the region and shared capabilities and be tested as a whole activity.

Map environment configuration can select the registered verdant palette, flowing-water presentation and fireflies. Waterfall and pavilion are game fixtures; bridges use native bridge terrain. Rendering and ambient audio consume this saved configuration and release map-local effects when leaving. Garden species are maintained in a shared content table, reuse original-pack sprites with stated provenance, and use the ordinary seed, farmland, watering, growth and harvest rules. AI map orders choose and place these actual kinds and supplies rather than inventing labels for decorative plants.

The model can describe map rectangles and paths through structured paint; the host compiles them with the existing brush into exact canonical rows. Ordinary legacy rows remain supported and are never cropped to hide counting errors. Landmark access uses native hand range and footprints. Registered catalogue composites can reassemble an original building's projected strips into one ordinary movable fixture texture; the pavilion uses the original slice metadata, and CSS previews share that resulting texture.

## Evidence record for each change

| Check | Record |
|---|---|
| Intent | Player request, accepted branches, pending ideas, consequential questions |
| Research | Relevant primary-source link and the concrete interface decision |
| Pictures/audio | Embedded art or catalogue key; in-game screenshot; committed FX/audio event |
| Mechanism | Input -> rule -> receiver -> resource/state difference -> feedback |
| Isolation | Trial/refusal leaves state, definitions, recipes and rule history unchanged |
| Adoption | Exact tested revision and fresh resource/dependency validation |
| Persistence | Save/load, second action, no duplicated resources or resurrected entities |
| Maintenance | Owned IDs/version, dependencies, export/import, update/disable behavior |

Run `npm run typecheck` and `npm run test:creation`. The focused script includes plan/type guidance, native combat/equipment, transfer/maps, map furniture, inventory menus, NPC movement and workshop UI. Preserve actual model replies, call budgets and failed cases in the external workbench; an automated pass alone does not replace a gameplay-camera review.
