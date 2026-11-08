# In-game creation workshop

## Goal and player journey

The player may offer a short idea or detailed requirements. The NPC brainstorms grounded possibilities, asks only consequential questions, and retains a revisable use plan. A design becomes an executable local content package after a separate trial. Adopted designs are saved, reusable and extendable; the existing on-encounter hole-completion path remains available.

The journey is: **idea -> NPC discussion -> structured uses and dependencies -> generated data/assets -> isolated trial -> adopt -> play -> revisit and extend**. The UI should show outcomes and creative choices rather than internal file/schema details.

## References and decisions

- [Fabric item registration](https://docs.fabricmc.net/develop/items/first-item): stable namespaced registry identities, separate item/recipe/client asset data. Use explicit package IDs and asset references rather than array positions as identity.
- [tModLoader ModItem](https://docs.tmodloader.net/docs/stable/class_mod_item.html): registered items have specific use, alternate-use, recipe and presentation hooks. Capabilities should have explicit interfaces and reusable implementations.
- [tModLoader world lifecycle](https://docs.tmodloader.net/docs/stable/class_mod_system.html): load/save/unload responsibilities are explicit. Local packages need persistence, dependency checks and a defined disable/update lifecycle.
- [Content Patcher author guide](https://github.com/Pathoschild/StardewMods/blob/develop/ContentPatcher/docs/author-guide.md): content packs describe bounded changes to known assets/data. Keep content manifests separate from reusable mechanics and provide diagnostics.
- [GMod addon layout](https://wiki.facepunch.com/gmod/Addon_Creation) and [hook identities](https://wiki.facepunch.com/gmod/hook.Add): addons group maps, assets and behavior, while named hooks support replacement/removal. Namespace ownership and explicit conflict policy are essential.

These are design references, not dependencies to port. OpenWorld keeps its deterministic engine and existing RuleLibrary rather than introducing another interpreter or arbitrary generated JavaScript.

## Contracts

ResearchPlan is a versioned schema containing named uses, registered capability IDs, targets and bounded parameters; pending ideas stay visible without being represented as implemented abilities. A capability descriptor supplies supported targets/parameters, effects, feedback and trial expectations. The model chooses and configures capabilities; trusted compilers generate their executable rule AST.

Workshop packages have stable identity, revision, content kind, definitions, use plan, capability versions, dependencies and trial evidence. Worker-owned identities and revision checks bind an adoption to the exact tested draft. An adopted item package is save-local. Further use plans become revisions instead of unrelated rule fragments.

There are two admission paths:

1. Existing ModPort hole completion continues to fill only undefined leaves and uses its normal validation/replay.
2. Explicit creator admission compiles registered capabilities to local rules selected by a creation-use parameter. It preserves ordinary actions, validates bounded parameters/effects/ownership, and records the package in the same world/library/save infrastructure.

The second path is an intentional authoring feature, not an exemption for arbitrary model patches. Unsupported mechanisms remain pending until a registered implementation exists.

## Atomic trials and lifecycle

Trial worlds and library histories are isolated. Checks cover actual input/action traces, resource and ownership differences, target behavior, allowed side effects, and persistence. Player-facing sounds/FX come from committed events; trial effects remain in the trial record.

Adoption rechecks current inventory, world conditions and package revision. Updates preserve identity, reject stale revisions and retain usable previous definitions until a new revision succeeds. Disabling/removal must account for live instances, dependent packages and maps; it must not silently leave dangling references. Export/import carries manifest and definitions, with validation against the receiving world's capabilities and assets.

## Maps

The same creative loop applies to maps: AI drafts a bounded map from available terrains, objects and assets; the trial checks shape, references, reachable entry/return, contents and connections in an isolated state. Adoption gives the map a namespaced identity, connects it to the current world, and preserves its content/state in the local creation record for reload. A generated picture or unconnected map draft is not a playable region.

## Checkpoints and actual evidence

1. Freeze shared plan/view/package interfaces and ownership across engine, AI and runtime.
2. Implement registered reusable uses, isolated trials and save-local package lifecycle.
3. Connect NPC discussion, use cards, trial/adoption and the saved creative notebook.
4. Integrate AI map drafts with trial, entry/return and persistence.
5. Test multiple items and existing-item extension with a real model in-game; test combined actions, failure isolation and reload. Preserve model replies and state/visual evidence.

Keep the status and evidence for these checkpoints in the local workbench report. This document describes the design target; exported interfaces, executed tests and player observations establish implementation status.

## Implemented slice (2026-11-03)

The item/use/map workshop is connected to the game's NPC conversation and HTTP/BYOK modder contracts. It supports separate trials/adoption, ordinary inventory uses, saved notebook reuse, existing-item extension, bounded item/map export/import and dependency-aware disabling. Registered capabilities reuse native actions or compile shared recipient-event behavior, including native attack, wear and elemental cast. Thrown items have a bounded persistent flight queue, fixed landing location, delayed impact, one-time consumption, save restoration and item-icon presentation ending at contact. Sticky has actual movement consumers for players, creatures and ordinary walking NPCs.

The new `type-guidance.ts` selects a short set of real game types satisfying the proposed capabilities, with inherited tags/properties, family constraints and consumer references. Type and plan repairs remain bounded. Semantic rejection returns to NPC discussion; a transport failure remains a transport failure.

The follow-up review exercised real DeepSeek sword, body armour, berry food and fire-focus designs through trial, adoption, the native sparse save/load path and actual use. The same variant-cost function now serves proposal checks and craft admission; current player profession accompanies the catalogue; recipe examples do not imply variant eligibility. A valid fire element is admitted on magic families even when ordinary type definitions leave it to instances. These changes address observed generation/use failures without adding another approval layer. The unused package state digest was removed; revision and fresh world checks already bind admission.

Map detail checks covered forge recipes, table surfaces, chairs/benches, ripe berries and a generated garden's harvest/sit/rise journey. Sitting uses shared posture/settle rules for the furniture family. Existing crop and fishing modules provide the next activity route; generated fishing regions will need activity metadata because the current fishing HUD is enabled on specific authored maps.

Actual model cases include vague jam (eat/spread), a berry draught (drink/gift/throw), existing berries (spread/gift/ground throw), and a connected glade. Browser verification covers unchanged trial state/libraries, exact adoption costs, uses-only inventory conservation, actual drinking on an injured fixture, delayed ground impact, and map save/reload/reentry/export. Failed model attempts, full-health drinking and UI-driver corrections remain in the external workbench. The initial map slice reuses known assets; resident schedules, quest chains, technology trees and arbitrary new mechanics remain later capability/content work.

See `creation-pack-authoring.md` for the maintained extension and acceptance workflow.
