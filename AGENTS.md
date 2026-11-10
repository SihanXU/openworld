# Working on this OpenWorld checkout

Follow the working agreements and architecture in `CLAUDE.md`. Converse in Chinese; keep repository code, comments, and documentation in English. Do not commit, push, or open a PR unless the user asks.

## Find the right layer first

- Runtime state, events, rules, save/load, admission and replay: `packages/engine`.
- Combat, needs, social behavior and monster kits: `packages/modules`.
- Player controls, presentation, sound, persistence and AI connection: `packages/runtime`.
- Models, NPC research, rule completion and their checks: `packages/ai`; its local rules are in `packages/ai/docs/AGENTS.md`.
- Persistent game content: `games/openworld/content`; authoring and world generation: `games/openworld/tools`.
- Project compilation and editor drafts: `packages/format`, `packages/editor`.
- Game-specific evaluations: `games/openworld/ai`; external SWE harness: `bench`.

Read `docs/developer-playbook.md` for the execution paths, persistence boundaries, atomic change units and debugging workflow. Read the relevant rows of `docs/creative-roadmap.md` when implementing a user idea; that file is the maintained creative backlog, not an instruction to implement every row at once.

The in-game creator loop and mod references are in `docs/creation-workshop.md`; its source map, capability extension checklist, asset/persistence contracts and verification record are in `docs/creation-pack-authoring.md`. Use `npm run test:creation` for this feature's deterministic regression set, and `npm run typecheck` for the package boundaries.

For autonomous NPC append/revision jobs, read `docs/autonomous-creator.md`. The coding agent owns active search, the use/implementation tree, persistent tasks, implementation, native play checks and repair. Reuse its job/session and domain tools; do not replace missing transitions with supervisor-supplied file excerpts or case-specific repair steps. Preserve current bending/profession presentation unless the player requests a change.

## Work and verify

1. Choose one player outcome and its affected state. Trace its actual input, event, host, rule, receiver and persistent result.
2. Reuse data and existing primitives before introducing engine code. A runtime Patch adds rule/type/status definitions; project-wide maps, material tables, kits and technology belong to authoring or development.
3. Reproduce in a deterministic small world, then run the real control/action path. Check material counts, ownership, definitions, recipes and history before and after refusal as well as success.
4. Check save/load and a second use when the feature persists. Inspect NPC behavior or social memory when the requirement concerns residents.
5. For an AI change, use ScriptedModel first. Make a bounded real-model run when authorized, preserve the replies and world traces, and record calls/tokens/latency. Do not log credentials or treat missing price data as zero cost.
6. For presentation, observe the result at the gameplay camera and action timing. Asset existence or a valid pixel grid does not establish visual quality.
7. Update the affected backlog row, its evidence and next checkpoint. Run the relevant checks in `docs/developer-playbook.md` and leave a reviewable diff.
8. When a trial fails, compare the existing and proposed behavior under the same fixture. Locate the first divergence with a bounded observation. Diagnose a shared fixture or engine failure before changing the proposal. Use the append operation for additive orders and retain existing entries unless the order authorizes a revision.

Preserve package dependency direction and host-only writes; affect another entity through events. Preserve current user changes. Keep new inventions save-private unless explicitly promoting content through the appropriate authoring process.

## Execution notes

Use one task, worktree, and PR. The PR must pass the Linux, Windows, and macOS creator checks and the workflow's `merge-gate`. Have an agent that did not author the change review only the final diff (Opus 5.5 when available). Before merging, confirm the current PR checks and independent review pass, main is healthy, and the PR is mergeable.

Core play runs in the browser's engine worker without a coding agent or model. AI may use a browser BYOK worker or an HTTP modder; a coding agent is a separate development tool.

On Windows, use native Node/npm and Git Bash where required. The known LocalEnv descendant-cleanup failure is recorded in the developer playbook. Use a Linux container for formal unattended terminal/SWE runs, with an independently executed verifier.
