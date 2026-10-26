# packages/ai: the AI side of the game

Everything that calls a model lives here. The game does not need it: delete `packages/ai` and `games/*/ai`, and the
game still typechecks, passes its tests, plays and builds (`packages/engine/test/boundaries.test.ts` and the `no-ai`
job in `.github/workflows/check.yml` hold this). Read [docs/ai.md](../../../docs/ai.md) for the design: what the AI
answers, the checks a patch passes, the two profiles.

## The one interface

The engine raises a hole (an undefined leaf) as a `ModRequest` through its `ModPort` (`packages/engine/src/mod.ts`).
This package answers with a `Patch`; the engine's `validatePatch` decides whether it may enter. The contract stays in
the engine because shipped patches (`learned/`) need it with no AI present. Nothing here writes the world directly.

The runtime finds the player's own modder through one glob (`packages/runtime/src/ai.ts`, which loads
`src/player/index.ts`). With the AI gone the glob finds nothing and the game offers no model.

## Layout

| Folder | What it holds |
|---|---|
| `src/models/` | Model backends behind one `Model` interface: OpenAI-compatible, `claude -p` (`model-node.ts`), Anthropic Messages (`anthropic.ts`), scripted for tests; the provider list. |
| `src/modder/` | The modder: `pipeline.ts` (comprehend, recall, design, verify and repair, audit, review, commit, record, reflect), its prompts, tools, deterministic fixes, derived tests, tiers, and the detection of what a connected model carries (`detect.ts`, a dry modder at every tier). |
| `src/checks/` | The checks beyond the engine's validator: the auditor (`audit.ts`, harm by construction), the economy LP (`economy.ts`). |
| `src/library/` | The shared library as an append-only patch log, its file form, promotion of learned patches. |
| `src/agent/` | The task-agnostic SWE-style agent and its self-state (memory, skills, harness, journal, snapshots), the outer loop, sandboxed environments. |
| `src/service/` | The HTTP service (`server.ts`), a world request as a repository for the agent (`repo.ts`), the offline script. |
| `src/player/` | The player's own modder in a browser worker (bring your own key) and the plugin the runtime loads. |
| `scripts/` | Entry points: `modder.ts` (`npm run modder`), `agent.ts` (`npm run agent`). |
| `test/` | Tests that need only the engine and a scripted model. Tests that need a game live in `games/<game>/ai/test/`. |
| `fixtures/`, `sandbox/` | The offline script for `serve --script`; the agent's Docker image. |

`src/browser.ts` is what runs in a browser (no `node:` imports, checked by the boundaries test); `src/index.ts` adds
the Node-only parts.

A game's own AI drivers (curriculum, evaluations, the outer loop's turns, engine tasks) live in
`games/<game>/ai/`, not here, because they read that game's content.

## Rules

- Imports go one way: `ai` may import the engine, modules, format and runtime; nothing outside `packages/ai` and
  `games/*/ai` imports `ai`. The boundaries test fails otherwise.
- Inside the package the folders are layers, bottom up: `models`, `agent`, `checks`, `library`, `modder`,
  `service`, `player`. A folder imports only those below it (type-only imports aside), and `src/` never imports
  `scripts/` or `test/`. `test/package.test.ts` holds this and the top-level layout.
- Never hard-code a provider. Tests use `ScriptedModel`.
- An unattended agent runs commands only in a container (`agent/env.ts`, `chooseIsolation`).
- RSI design changes (what the outer loop may change, how it is judged) are discussed with the user before they are
  coded.

## Checks

```bash
npm run typecheck
npx vitest run packages/ai games/openworld/ai packages/engine/test/boundaries.test.ts packages/runtime/test/browser-boundaries.test.ts
```
