# Developer playbook: understand, change, run and verify the world

This guide connects the runtime architecture to a bounded development workflow. The maintained user ideas and checkpoints are in [creative-roadmap.md](creative-roadmap.md). The architecture's detailed contracts remain in [ai.md](ai.md), [engine-split.md](engine-split.md), [world-model.md](world-model.md), [byok.md](byok.md) and [npc-sandbox.md](npc-sandbox.md).

For the new NPC modding loop, read [creation-workshop.md](creation-workshop.md) and [creation-pack-authoring.md](creation-pack-authoring.md). Choose **New game -> Creative workshop** for a finite experimentation kit beside Haldor. `npm run test:creation` executes the deterministic invention/use/map/transfer/UI regression set without model calls. The external workbench keeps separate real-model and cached-reply browser evidence.

## 1. What executes the game

```text
Content source / project files
  -> generation and compilation -> bundle + map chunks + assets
  -> browser runtime (Phaser, UI, input, audio)
       <-> engine worker (deterministic world, rules, NPC goals, ticks)
             -> an undefined event or NPC research request
             -> browser BYOK modder worker OR local HTTP modder
             -> model -> validation / bounded design -> client admission / real action
```

The browser's engine worker simulates the single-player world. It is not a thin viewer for a continuously running server world. Normal controls, combat, gathering, crafting, needs, NPC schedules, quests and saves operate without a model. A default handles an unanswered rule hole. Connecting a model adds rule completion and research rather than replacing the game loop.

A coding agent has a different role: it edits source or project data during development. `claude -p` and `codex exec` can also be used as model backends; that print/exec-mode interface does not grant the in-game NPC unrestricted repository authority. The existing offline world-agent workspace has its own allowed files and read-only engine. General source development uses a separate checkout and ordinary reviewable changes.

## 2. Persistence and backend responsibilities

| Data | Authoritative representation / storage | Change boundary |
|---|---|---|
| Authored game | Type/rule/material/recipe/kit/people/quest/map data, compiled bundle, static assets | Project/compiler checks and code review |
| Current world | Engine `WorldState`: entities, places, props, statuses, clock, RNG, world/NPC records and chunk differences | Engine events, rules, modules and authorized authoring |
| Browser save | IndexedDB database `lsw`, object store `kv`, keys `save:<world>:slot1..3` and `lastSlot:<world>`; JSON export/import | `runtime/src/saves.ts`, `engine/src/game.ts` |
| Learned behavior | Library entries and definitions, with save-private content retained in the save | `runtime/src/learned.ts`; shared snapshots exclude private definitions/history |
| Node modder data | `<LSW_DATA or repo/var>/library.jsonl` and `modder-state/` | Append-only library, self-state files and model episodes; `ai/src/service/server.ts` |
| Browser-owned model | Separate `lsw-modder` IndexedDB/memory and local settings | BYOK worker; credentials do not belong in world saves |
| Benchmark evidence | Fixed source revision, fixture/seed, model configuration, budget, raw answers, traces, verifier results and diff | External run directory, separate from game state |

This inspected path uses structured world data, IndexedDB and file logs. It does not require a central PostgreSQL/SQLite simulation database. A hosted modder may distribute accepted shared patches; that is not a multiplayer state-authoritative world server. Accounts, cloud save synchronization and multiplayer authority would be separate features with explicit ownership and conflict rules.

Static map terrain is content. A Game save stores state and changes, and the host reloads the corresponding map content. A meaningful round trip therefore uses the actual base library and map-loading path, not only `RuleLibrary` JSON serialization.

## 3. Atomic objects and coherent change sets

An atomic change is the smallest coherent set that can be admitted, executed and saved together. A line added to JSON is rarely the full unit.

| Object | Keep coherent | Observe directly |
|---|---|---|
| Entity | Identity, type, place/container/hand, ownership, quantity, wear slots and statuses | An item has one valid location; take/put/gift/craft does not duplicate it |
| Item type / recipe | Parent capabilities, material, inputs, station/tools, skill/unlock, cost/value, icon and intended use | Exact input consumption, actual output, expected use, second craft/use |
| Rule / status | Host, event, condition branch, effects, receiver events, lifetime and cleanup | Actual trace and target state; protected facts and existing defined behavior remain valid |
| Equipment / skill | Slots, stat consumer, affixes/set, combat behavior, worn look, VFX/SFX and timing | Equip/unequip changes stats and appearance; contact produces the claimed effect |
| Material | Material item versus material-definition table, economic/combat multipliers, recipes | Mining/crafting/use/economy read the same supported material definition |
| Map / region | Terrain and relief, entrances/portals, anchors, contents, reachability, camera/art/audio | Enter, navigate, perform a goal, leave, return and reload |
| NPC / relationship | Identity, household/home/job, needs/schedule, inventory, memory and per-pair regard | Resident reaches/uses the relevant thing; action changes memory or regard through the actual social path |
| Quest / technology | Trigger, stage/objective, aliases, prerequisites, rewards and downstream consumers | A reachable action advances the goal, spends/gives the correct resource and persists |
| Content package / save | Definitions, assets, dependency IDs, version, migration and private/shared scope | New game and old save load; removal/migration handles existing instances |

Research has two stages: proposal and confirmation. Proposal uses current catalogue hints. Confirmation rechecks the current save, builds a sandbox, admits the proposed type and runs the normal craft there, then synchronously admits/crafts in the live engine. A refusal check includes world, library history, type/ontology, recipes, inventory and ownership. The local history-array isolation regression protects this boundary.

Rules mutate their host. They affect others by emitting events that the recipient's rules answer. New property names need a real consumer; a `firePower` field alone does not create a fire attack. New mechanics that need another primitive or stat consumer belong to module/engine development.

## 4. Choose the implementation path

1. **Runtime interaction:** inspect the triggering undefined event and its ModRequest; propose a bounded Patch, validate, replay and submit. Patches add rules, types and statuses, not maps or arbitrary replacements for defined rules.
2. **NPC research:** catalogue -> conversation -> variant or new-kind workshop -> icon -> confirmation -> trial -> normal craft -> actual use -> saved result and research outcome.
3. **Authored expansion:** create data/assets through the editor or source, compile/check references, connect maps and NPC anchors, and verify an integrated player journey. Map/person drafts are a starting point.
4. **New engine capability:** formulate an issue, develop in an isolated checkout/container, add the primitive/consumer/module and meaningful tests, run F2P/P2P and a real gameplay case, then present the diff.

For a player-requested new region, the coherent deliverable is a region brief, connected maps, resources, threats, residents/roles, a goal, return route and persistent consequences. Start with one complete small region before increasing its size.

Adopted item uses are available through the normal inventory context menu as well as the notebook. Native attack/wear/cast go through existing combat and slot controls; bag-to-bag uses preserve both item instances. For map details, reuse fixture/crop for harvestable plants and the shared furniture posture rules for sitting. Crops and fishing already have activity modules; new regions should register their activity configuration and resource/tool loops rather than copy those systems.

Before treating a creative use as playable, work through the reusable player-operation checklist in `docs/creation-pack-authoring.md`: source/equip entry, select/cycle, aim/target/range, execute/repeat, cancel/return, feedback, key/modal conflicts, source disable, save/reload, and real UI acceptance.

## 5. Run locally

From the repository root, with dependencies installed from the lockfile:

```powershell
npm run gen:world
# Direct workspace invocation forwards Vite options correctly.
npm run dev -w @openworld-game/client -- --host 127.0.0.1 --port 5183 --strictPort
```

Open `http://127.0.0.1:5183/?modder=off` and use the game's **Play without AI** path for independent core play. The local browser check exercised the actual title/creator/journey flow, player movement, companion following, inventory and world-map UI without model calls. For an AI-enabled development service in another terminal, map existing process credentials without writing them to a file:

```powershell
$env:LSW_MODEL_BACKEND = 'openrouter' # the generic OpenAI-compatible backend name
$env:LSW_MODEL_URL = $env:DEEPSEEK_BASE_URL
$env:LSW_MODEL_KEY = $env:DEEPSEEK_API_KEY
$env:LSW_MODEL = 'deepseek-chat'
npm run modder -- serve 8787
```

The browser can use a local HTTP modder or choose its own provider in model settings; consult `docs/byok.md` for selection and storage. `--backend claude-code`, `codex` and `anthropic` are other supported development backends. Do not print the environment or place credentials in generated game content, screenshots or saves.

Run one explicitly selected real-model research case rather than the entire suite by default:

```powershell
npm run eval:research -- berry-jam
```

This existing evaluation exercises design and real trial crafting. Inspect its report and additionally test the requested use and full save/load. The local workbench's bounded integration runner demonstrates food consumption, mining, wearing, precise resource deltas and private scope. A model configured in settings is distinct from a confirmed model response and successful world change.

## 6. Debug one causal chain

Record the requirement as an observable player result, then follow:

```text
control/aim -> plan -> action/event -> host + matching rule/branch
 -> emitted recipient event -> state change / output / feedback
 -> world frame and UI -> save -> load -> second action
```

- Reproduce with `buildSandbox` or a small actual-content fixture. Set up the world using author APIs; execute the feature through controls/events.
- Use `ScriptedModel` to separate game behavior and validation from model uncertainty. Preserve a failing fixture before fixing the mechanism.
- For a real-model failure, identify conversation, type design, drawing, admission, trial, use or persistence as the first failing stage. Preserve intermediate data.
- Clone state **and library history** for trials. Keep RNG/seed, unlocked state, tools and stations explicit.
- Verify receiver/NPC consequences rather than a generated line claiming success. For presentation, inspect contact, pose, timing, sound and UI state together.
- Save consumed resources, restore the actual game/map context, then repeat the relevant action. Check that private inventions stay private.
- Update the relevant creative-backlog row with an evidence path and remaining work.

## 7. Checks and evaluation

```powershell
npm run typecheck
node node_modules/vitest/vitest.mjs run packages/ai/test/research.test.ts packages/ai/test/research-workshop.test.ts games/openworld/content/test/research.test.ts games/openworld/ai/test/private-research.test.ts packages/engine/test/library-clone.test.ts --maxWorkers 1
```

Also follow `packages/ai/docs/AGENTS.md` for AI changes and run the affected package/boundary checks. Expand tests when the changed dependency or failure requires it. Existing tests and traces are reusable evidence; do not rerun expensive unrelated workloads merely to increase the count.

Keep three evaluation tracks separate: runtime rule completion, NPC invention/use, and project-level SWE. Freeze source/content versions, fixture/seed, model/configuration, budget and driver. Judge world-state outcomes, regression, atomic rejection, persistence and actual behavior; record calls/tokens/latency and reported costs. Formal SWE tasks should keep hidden tests/verifiers outside the candidate workspace.

### Known Windows execution issue

The current LocalEnv descendant-cleanup test can return after roughly 30 seconds despite a 500ms deadline. A portable child-import fixture exposes this remaining failure. Keep this as an infrastructure failure rather than a model/game-task failure. Formal unattended terminal/SWE execution should use a Linux container and independently run verifier. A future fix must prove both prompt return and actual descendant termination; closing a pipe or skipping the assertion is insufficient.

## 8. Maintaining familiarity

Keep this playbook as the execution map and `creative-roadmap.md` as the user-intent ledger. For each completed idea, retain the content/source delta, a small reproducible case, the actual behavior trace and the visual/audio observation it needs. Move reusable successful content into a versioned content package or authored game data. These records let the next coding agent begin at the relevant interface and checkpoint instead of reconstructing the project from a chat transcript.
