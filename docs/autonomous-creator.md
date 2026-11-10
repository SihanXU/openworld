# Autonomous NPC append workflow

## Player outcome and ownership

A player gives an order to an NPC. The connected coding agent owns discovery, the use/implementation tree, design choices, source changes, resource work, verification, repair and the final candidate. It may propose additional uses and start bounded delegates. The host provides actual world/source queries and native game operations. The supervisor does not supply a case's file list, parameter choices or repairs.

The same job supports a new item, a new use on an existing object, a map and a reusable mechanism. A use tree includes the target, action, state change, cost, feedback, controls, persistence, dependencies and implementation route. It is not just a list of verbs. A player can give a brief order or precise requirements; the agent expands the unspecified parts and records its choices.

Before creating a job, `POST /creator/discuss` asks the configured model whether a key player choice needs discussion. It returns a short NPC question or accepts the request. It does not create a job or write the world. The runtime passes the actual discussion and final player choice to the existing coding-job entry point without rewriting them into a summary. Explicitly choosing another workshop mode starts a fresh discussion. Active discussion takes precedence over a retained job with the same final confirmation word. Model replies, usage and latency are kept in `discussions/` under the creator data directory. The job then performs the active source/world discovery; the conversational model does not claim to have searched the game.

## Observed gaps and corresponding changes

These observations come from the earlier bending refinement, not from a hypothetical audit.

| Requirement | Earlier observed behavior | Change in this pass |
| --- | --- | --- |
| Independent execution | API/tool loop; supervisor repeatedly supplied files and diagnosis | Native complete coding-agent CLI, MCP tools, persistent session and bounded delegates |
| Active world queries | NPC received a fixed catalogue | Search/inspect actual types, entities, recipes, rules, capabilities, packages, maps and renderer resources |
| Follow associations | Repeated raw file searches, then supervisor supplied links | Subject/use-tree query and associated source/test search; native Read/Grep remain available |
| Continue beyond existing capabilities | Unsupported use became pending | Coding agent can develop a trusted source provider, refresh the registry and continue the same job |
| Ordered durable work | Planning, art and tests spread among external scripts | Stable job/task IDs, dependency graph, decisions, real artifact hashes and host evidence |
| Independent verification/repair | Supervisor orchestrated play and failures | Native trial/use/save operations, focused tests, candidate browser actions/observations and same-session repair feedback |
| Clean source ownership | Mechanism source had no package lifecycle | Versioned trusted providers; capability/provider dependencies and guarded removal |
| Update an installed package | External ID translation and save integration | Origin identity and three-way use-plan updates preserve local type/instance identity |
| Reliable tools | Gutter/CRLF matching, empty replies and truncated tool arguments caused retries | Raw/JSON reads, EOL-preserving checked edits, continuation metadata, bounded empty replies and truncation refusal |
| Evidence matches candidate | External browser/testing state could drift, and a fresh restore changes library log/version bookkeeping | Keep the exact browser input snapshot; compare actual restored rules/state separately and restore in a copy of the job state |
| Bounded discovery and recovery | The first held-out execution exhausted 55 turns in research; a later transcript resume stalled in history compaction | Early provisional tree/task checkpoint, targeted follow-up queries, then recovery from the saved task/candidate rather than repeated transcript replay |
| Native provider preview | A provider file loaded in Node but the browser's worktree URL was wrong; initial open returned a generic timeout | Resolve provider URLs relative to Vite's resolved manifest, request the raw module correctly, and surface actual worker/HTTP startup diagnostics |
| Correct verification failures | A real out-of-range refusal was counted as a worker crash after two successful combat branches | Tag normal gameplay refusal separately; retain it in evidence and require the observed successful action |
| Detachment and receipts | Stored trial receipts named old types/statuses and could block retirement even after removing live references | Ignore historical receipts in dependency checks, preserve the receipt itself and keep the live-reference guard |
| Durable player handoff | The originating browser observer exited under memory pressure while its backend job kept working | Persist the job ID on acknowledgement; a reloaded native save can monitor and apply that same job against current state |

## One job, one chain

1. Accept the order and current native save. Create a persistent job ID. Snapshot the current authored source into a worktree; workspace package links point to that worktree, while installed third-party dependencies are reused.
2. Query the actual world and existing subject. Follow its uses, prototypes, recipes, rules, resources, dependencies and tests. Read relevant project contracts before proposing implementation. Record findings once instead of repeatedly injecting the same catalogue.
3. Store a use/implementation tree and a small dependent task set. Split resource/art, mechanism, item, map, integration and verification work only where their outputs differ. Record reuse/new-work decisions and the reason.
4. Implement through existing content/capability interfaces. New data stays save-private. New executable behavior belongs to a trusted source provider, with its own identity/version and declared capability/dependency surface. A JSON use plan never contains arbitrary JavaScript.
5. Propose, trial and adopt the precise current draft in the candidate session. Refusal returns real diagnostics. Trials must leave live state, rule history and RNG unchanged. Adoption rechecks current materials and dependency constraints. Inspect and revise an installed map with its stable package ID, preserving its source entrance.
6. Run focused source checks, exercise actual capability effects and play through native UI inputs. Inspect changed target state, costs, feedback and controls. Save/reload and a second use check persistent behavior. Record actual observations; a screenshot or test exit code alone is not a complete player outcome.
7. Repair failures in the same task/session. Source or resource changes invalidate older evidence. Register actual artifacts and verify tasks through host callbacks; a model cannot mark itself verified by editing a status field.
8. Publish the candidate. Independently restore it with the candidate workspace's own engine/registry and compare the order with the observed outcomes. Promote source only if the base files have not changed concurrently. The runtime admits candidate drafts through the game workshop against the current live state.
9. Keep the job, decisions, artifact ownership and checks for revisions. Export/import/update retain package identity. Disable/remove goes through native dependency checks rather than deleting shared definitions or live instances.

Each order carries a short execution guide with a TODO template and the MCP check for each stage. The agent stores exact world IDs and expected input-to-state outcomes in the job, then verifies each stage as it goes. On retry, it reads the retained job and candidate and resumes at the first actionable unverified task.

## Interfaces and storage

| Layer | Entry / ownership |
| --- | --- |
| Complete agent execution | `packages/ai/src/agent/executor.ts` — native CLI tools, MCP, persistent resume, delegate budget, scrubbed trajectory |
| MCP transport | `packages/ai/src/agent/mcp.ts`; job server `packages/ai/scripts/creator-mcp.ts` |
| Semantic world/source queries | `packages/ai/src/agent/workspace.ts` — actual runtime context, bounded results, source/resource associations |
| Job graph and evidence | `packages/ai/src/agent/jobs.ts` — task IDs, dependencies, artifact hashes, injected host verification |
| Native candidate operations | `packages/ai/src/service/creator-session.ts` — real workshop, engine, catalogue, trial/adopt/use/export/reload |
| Candidate play | `packages/ai/src/service/creator-preview.ts` — native save import, keyboard/mouse input, read-only worker/frame observations |
| Coordination and promotion | `packages/ai/src/service/creator.ts` — isolated workspace, complete agent, independent review, repair/resume, freshness check |
| Trusted mechanism lifecycle | `packages/engine/src/creationProviders.ts`; game-owned source manifest and loader |
| Portable item updates | `packages/engine/src/creationTransfer.ts` — source origin and three-way plan merge |

The configured data directory contains `tasks/<id>/job.json`, its event log, `runs/<id>/order.json`, source baseline/context, executor trajectory, host session/drafts/checks, preview evidence, independent review and promoted-file manifest. Source and art artifacts belong to the worktree; register intentional deliverables. Unregistered top-level diagnostic files stay in the job workspace. Generated world assets are shared references and must not be edited through their links. Credentials are process configuration and are not saved in a job.

World queries read the engine's current save state and ontology, registered capabilities, recipe/rule indices, generated world index and the actual renderer catalogue supplied by the client. The world index and chunks are JSON; the save stores current differences, package identities and library history. There is no second world database to keep in sync. A source query links IDs to matching code and tests, then the agent reads the relevant source range.

To enable the local service, use an existing DeepSeek environment key and native Claude Code on `PATH`:

```sh
npm run modder -- serve 8791 --creator \
  --world games/openworld/public/world/index.json \
  --creator-client games/openworld/client \
  --creator-mechanisms games/openworld/content/src/creation-mechanisms \
  --creator-data var/autonomous-creator
```

Connect the game to `?modder=http://127.0.0.1:8791`. The configured research NPC uses the creator service. The original NPC proposal and trial flow is available when the creator service is off. New browser orders retain the ready candidate until the player chooses to load it. The game approves any pending source publication, refreshes trusted providers, and replays native admission against the current save. Source changes that need a worker or page reload go through the live checkpoint.

Protocol 2 is a local JSON API. `POST /creator/jobs` accepts a native save and an order. Read the returned job ID with `GET /creator/jobs?id=…` and retry failures with `POST /creator/jobs/resume`. With `deferSource: true`, a ready candidate that changes source reports `needsPublication`. Approve it with `POST /creator/jobs/approve`. Both action endpoints take an `id`. The coordinator checks the verified source fingerprint at approval and copies source only if the baseline still matches. A candidate with no source files to publish can be loaded into the save directly when the player chooses to load it.

For a custom harness, pass `executeAgent` to `CreatorCoordinator`. The executor receives the separate worktree, order, job-local MCP configuration, and resume and budget options. The coordinator keeps ownership of acceptance and publication. The default executor runs Claude Code, and the `creator` script configures it for DeepSeek. Native Bash is disabled; the agent runs the project's verification through the fixed `run_checks` operations. Enable the local creator service only for trusted development: the host loads candidate game code for verification, and a worktree separates changes without sandboxing that code.

### Delivery check

The new sprint-boots and garden orders came from Haldor's in-game input. The boots order reached the service, but the first connection closed before the player received its reference. The same job was resumed after repairing Windows worktree creation. DeepSeek queried the equipment and movement code, and the preview failed under memory pressure before the boots were verified.

The garden order returned a job ID to the game. DeepSeek built Bloom Garden, passed native map trial and adoption in the candidate, and opened its preview. The draft contained tulips, roses, orchids, and sunflower. The game calls sunflower 向日葵 and sunrose 太阳花, so the proposed seed set missed a named crop. The fresh run stopped before native sowing, watering, harvest, and final acceptance. The source and save gates kept the candidate separate.

An isolated browser check reused the earlier verified Stormfang and courtyard job to exercise the player choice. Load later kept the player at the smithy. Reopening the retained order and choosing Load into this save admitted both drafts and entered the courtyard without submitting a new order. The coordinator regression separately verifies that pending source waits for approval.

### Sunflower refinement

Order `change_9b041c02db784a31a80e505d19473d98` was submitted through Haldor's native dialogue. DeepSeek queried the existing sunflower family, stages, harvest, art and farming rules, then proposed, trialled and adopted a save-private 16×14 garden. This order explicitly selected the existing harvest. It reused the native seed, crop stages, flower, tools, buckets, well and art; no crop mechanism or bespoke art was needed. The agent used native inputs to collect a seed, sow a sprout, water it, wait for the young stage, refill at the well, water again, wait for maturity and harvest. It replayed its retained inputs after a turn limit, captured the result, refreshed types and farming/species checks, published, verified reload and completed its task graph. Independent goal review accepted the candidate.

Separate host QA exercised the same native growing cycle and observed one sunflower and one recovered seed in inventory. The observations and screenshots are in `var/sunflower-demo/native-cycle.json` and its adjacent images. A native reattachment check imported the original save with its retained job reference, chose Load later, retrieved the same ready order, loaded it, walked garden → workshop → garden, exported the native save and reloaded it. It made no new job requests and produced no page errors. That report, video and playable save are under `var/sunflower-demo/` (`handoff.json`, `npc-to-garden.webm`, `flower-garden.openworld-save.json`).

The generation dialogue now shows acknowledgement, work and repair states with a small animated indicator. Leaving the conversation keeps the order running. Existing map changes use the renderer's 220 ms fade. The input harness exposes the loaded game's actual key bindings and an aim action. Successful native inputs are written atomically after each action and can be replayed after an executor turn limit, before a final capture exists. A failed replay preserves its complete input journal. These inputs remain separate from successful gameplay verification.

The live run exposed a Git binary-diff allocation failure while a browser was open. Source fingerprints now reuse their existing digest after checking source metadata and bytes. The retained job received host-tool upgrades and resumed under the same ID. The host also fixed native aim/wait/replay tools, checkpoint-first continuation and generation UI. The handoff check found a stale NPC conversation after admission moved the player to a new map; successful admission now closes it when the map changes. The agent's garden and farming rules were not hand-edited.

A separate real DeepSeek conversation probe entered “I want a garden” through the native NPC UI and received a question about decoration versus planting and harvesting. The follow-up selected sunflower sowing, watering, growth and the existing harvest and was accepted through the discussion API. A complete first-turn order was also accepted immediately. `discussion.json` records this entry-path probe separately from the completed garden job; it did not launch another coding job.

## Acceptance record

The final acceptance run must preserve the original order, task graph, domain-tool trace, coding-agent trajectory and exact interventions. Record separately:

- What the agent actually queried and designed.
- Which new implementation/resource work it chose and performed.
- Which real state changes, controls and persistence behavior occurred.
- Which failures it diagnosed and repaired itself.
- Whether the host needed a generic infrastructure fix or the supervisor supplied case-specific help.

An implementation may have good individual content while this workflow is still missing a transition. Report that transition precisely and continue fixing it; do not substitute content quality or a test count for autonomous execution.

The native DeepSeek/Claude Code transport smoke made three real MCP calls (`read_change_job`, `creator_status`, `search_world`) on a retained native save. Bare mode exposed only Bash/Edit/Read even with an explicit tool list. The executor now uses the full native CLI with job-scoped settings and exits on a failed required MCP connection. A separate live probe launched one native delegate, observed its Read tool call, and received the project name it read. This demonstrates delegation availability; the fusion order did not require a delegate.

The separate browser smoke imported the same save through the native file picker, moved from `(6,10)` to `(6,13)` by holding ArrowDown for 350 ms and recorded three merged-frame changes with no page or worker errors. This establishes the verification tool path; it is not the held-out gameplay result.

### Held-out order: Stormfang and Stormforge Courtyard

The original order was entered in Haldor's native research conversation. It asked for a fire/lightning fusion weapon, a switch between single and fused modes, and an accessible sparring courtyard. The order left materials, effects, appearance and controls to the agent. Its sole initial POST created `change_de64c0935f784a15bf212f9fd00a5a13`.

- DeepSeek queried inventory and craft requirements, read saved use trees and found the relevant source and tests. It then persisted its own use tree and five dependent tasks. The first pass reached its turn budget before recording this plan.
- It wrote the `stormforge` provider and focused tests. In the candidate, it loaded the provider, proposed Stormfang, saw the native material-field refusal, repaired the same draft and successfully trialed and adopted revision 2. It also created and adopted the 9×9 courtyard with a native skeleton and return gate.
- The first browser attempts failed on a worktree module URL. The host fixed the generic loader and verified boot, then resumed the same persisted job. The host did not choose the recipe, provider implementation, gameplay parameters or map layout. A long old-session compaction was stopped; a fresh CLI context immediately read the existing job and drafts and continued native checks.
- Native browser inputs selected the fusion use, approached a reachable target and struck the skeleton. Its HP changed from 45 to 39, with both burning and electrified status and fire/spark effects. The agent then selected split and performed a single-fire strike. The earlier out-of-range refusal was retained; the old capture gate incorrectly classified it as a crash. The new observer separates this from runtime failures.
- The agent invoked native replay for the 30 retained inputs (about 16 seconds), recaptured the effects, refreshed checks, verified all tasks and completed the job. An independent acceptance retry reused those completed tasks after fixing library metadata comparison. It restored the candidate in a fresh process, reviewed the observed behavior and promoted the provider, manifest and focused test. Intermediate diagnostic files remain with the job.
- The original browser observation process exited under memory pressure after it placed the order. For the final native reattachment check, the host imported the original live save snapshot with the same retained job reference. The game resumed the ready job, admitted both drafts through the ordinary workshop, marked the job applied and saved the result. The reconnect made zero POST requests and produced no worker errors. Separate native input QA walked courtyard → smithy → courtyard with that adopted save.

This run demonstrates independent content design, source discovery, provider implementation, repair from a real craft refusal, and native action verification, with host repairs to generic infrastructure. It was not an uninterrupted first attempt. The case uses the game's existing art/interaction presentation; bespoke sword art and a new control scheme were not part of its evidence. Item update/removal, provider dependency removal, and map revision also have targeted native regression coverage outside this order.

The full job and tool evidence are retained under `var/autonomous-creator/tasks/<id>` and `var/autonomous-creator/runs/<id>`. The native player submission and reconnect checks use `var/creator-acceptance`.

### Maturity follow-up

An unfinished order whose service process stopped is reported as resumable. Asking for the same retained order checks the current service status before deciding to resume. Job results and candidate checkpoints use atomic file replacement. If the initial worktree setup was interrupted, the next attempt preserves that directory and builds a new snapshot.

The integration bundle follows the recorded adoption order. An item crafted and then given a use revision in the same order carries its original design into the final draft so the player's world can craft it once with the revised uses. Publication checks that every draft revision is still enabled. An append bundle cannot carry a staged removal of an existing package.

Source publication checkpoints the accepted candidate and the intended file hashes. If the service stops during publication, resuming the same job finishes the recorded copies without another agent run and refuses to overwrite unrelated source edits. Source can be ready while a save is waiting for admission. If inventory or dependencies have changed, the save records the refusal and keeps the verified drafts. Restore what is missing and repeat the order with the same subject to retry the same job. An unsuccessful check of the bundle leaves the live inventory and installed packages intact. A checkpoint storage failure leaves the current game worker available for retry.

Verify each planned stage with its matching host check (`proposal`, `trial`, `adoption`, `browser-play`, `publication`). A trial can pass before adoption or publication. The final gate still requires all planned tasks, tests and current native play evidence. Independent review reads the evidence for each outcome. A standalone fixture behavior edit has no dedicated portable draft kind.

### Existing weapon revision

The player held the existing Steel Longsword and submitted “给已有武器加可切换的融合用法” once to Haldor (`change_558e6ee9486a4876949b67fafc2c074f`). DeepSeek queried the weapon, its installed package, and the implementation behind the Stormforge capabilities. It added fuse, split, and storm strike to the same package. The first isolated trial refused the existing explicit strike use. DeepSeek removed that use in revision 3, then passed trial, adopted the revision in the candidate, and ran the candidate save/reload check. Wield and inspect remain. The loss of the original strike entry is a behavioral regression against an additive order.

The authoring service was restarted after host memory exhaustion. The resumed run used the same job and retained draft. Candidate browser boot subsequently reported that it could not allocate a Web Audio convolver. The evidence covers the package revision and engine save/reload. The final gate remained failed after retries. The original strike needs to remain available, and both modes still need to be exercised through native controls after reload.

### Additive operations

The NPC's Add Uses choice binds the order to the selected package or existing type. Send the new use entries with `propose_content` and `operation: "append"`. The host composes them with the installed use IDs, pins the baseline revision, and rejects collisions or stale adoption. Use an explicit revision operation to replace a plan where the order permits it. For an existing map, append supplies only new tile objects. It retains the live map ID, old entity IDs, terrain and gates. A full revision of a selected map must be authorized on the incoming order. Multiple adopted steps are replayed in their original order when a later append depends on them.

When a retained use fails, the host runs that use against the installed baseline in the same fixture. A shared failure points to the fixture or the engine. Diagnose the first refused condition before revising the proposal. Trusted source providers can register new capability IDs for use by multiple packages. An equipped-use adapter is opt-in at the provider. Save-local proposals carry capability IDs and parameters.

The retained longsword order was replayed with the same starting save and DeepSeek's three added uses. The revised package survived candidate save/reload. On the same equipped sword, the native strike changed skeleton HP from 100 to 91, the fused strike emitted fire and lightning and reduced HP to 85, and the split strike emitted only fire and reduced HP to 82. A browser playtest loaded the saved revision and used all five actions from the equipped item's native menu. It observed damage, fusion activation and removal, and no action refusals or browser errors.

The `check` workflow runs the portable creator suite on Linux, Windows and macOS. Linux also runs the full suite, including its Docker test, and the AI-free build and play check. The `merge-gate` job requires all three jobs and the three platform results. Require that gate in the repository's merge settings.
