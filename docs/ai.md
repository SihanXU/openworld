# The AI in OpenWorld: a map

One page for finding your way around the AI side of the repository: what it is, how one question travels
from the game to a model and back, who checks what, and which file does which job. The design and its history
stay where they are (design.md §5.11, §5.16, §5.17, §8, §13; rsi.md; byok.md; upstream.md; paper-eval.md);
this page points at them.

## 1. What the AI is here

The game is complete without a model. Its state and rules are code, and every event has one outcome given by
the rules of its host. Where a rule leaves an outcome undefined (a hole), the game asks a model for the missing
rule, a patch. A patch is untrusted data until the engine validates it; once taken, it answers that hole for
every instance of the host's type, for every player. With no model, a failure or a time-out, the hole's default
runs (normally nothing).

That one interface, the outcome of an event, is the only place the AI enters play. Authoring (the editor's
drafter), the self-improving agent (RSI) and the evaluations all reuse the same pipeline and the same checks.

## 2. The layers and their direction

```
games/openworld/ai          OpenWorld's drivers: curriculum, improve, rsi, upstream, latency, eval/*   (may import all)
packages/ai                 all the AI: models, the modder, its checks, the shared library, the
                            agent and its self-state, the service, the player's own modder     → runtime, format, engine
packages/editor             authoring: holes panel, AI drafter (asks the modder over HTTP)     → format, engine
packages/runtime            play: asks a modder, syncs the shared library; finds the player's
                            own modder through one glob (`runtime/src/ai.ts`)                  → format, engine
packages/format             a project's holes, the checks of a new thing                       → engine
packages/engine             the contract: requests, the validator, the port, the sandbox       → (nothing)
```

The engine imports none of the others, nothing outside `packages/ai` and `games/*/ai` imports the AI, the AI
imports no game, and what runs in a browser (`ai/src/browser.ts`, `ai/src/player/`) imports no Node.
`packages/engine/test/boundaries.test.ts` holds the first three, `packages/runtime/test/browser-boundaries.test.ts` the fourth. Delete `packages/ai` and `games/*/ai` and the game
still typechecks, passes its tests, plays and builds (the `no-ai` job in `.github/workflows/check.yml`).
The package's own entry is `packages/ai/docs/AGENTS.md`.

## 3. One question, end to end

1. **A hole.** The engine resolves an event and reaches an undefined leaf (`engine/src/rules.ts`). The
   participants are held (design.md §5.11, "waiting is the same for every event"); the rest of the world runs.
2. **The request.** `ModPort` (`engine/src/mod.ts`) records the hole and builds a `ModRequest`
   (`buildRequest`): the event, the host, the path to the hole, the context, and a `Scenario` that can replay it.
   One question per hole and class (`classKey`).
3. **The link.** The runtime's worker sends it to a modder through `ModderLink` (`runtime/src/modderLink.ts`):
   a service over HTTP, or the player's own modder in a worker of the page (`ai/src/player/localModder.ts`, `byok.md`). Both
   answer the same five calls: health, resolve, progress, patches, fault.
4. **The pipeline.** `Modder.resolve` (`ai/src/modder/pipeline.ts`) works it in stages:
   - *comprehend*: the request's signature (`signature.ts`); the shared library may already cover it (no model);
   - *recall*: lessons, similar episodes and skills from the self-state; the brief (`brief.ts`);
   - *design*: the model's answer. Live, it is one call routed local → find → create (design.md §13, the
     router); a thing the world lacks is created with its 16×16 picture (`artUser`, drawn while the rules are
     written). Offline, it is a tool-using conversation, or the repo agent (`repo.ts`);
   - *fix*: deterministic repairs and placement (`fixes.ts`, `placePatch`), the derived test (`derive.ts`);
   - *verify*: the library's validation (section 4); diagnostics go back to the model for a repair round;
   - *judge*: the auditor and the reviewer, before shipping or after, by profile and tier (section 5);
   - *commit*: the patch joins the shared library's append-only log (`library.ts`);
   - *record, reflect*: the episode is kept; lessons and skills are written in the background (`agent`).
5. **The answer arrives.** `ModPort.submit` validates the patch again on the client, with the client's own
   library and protected facts, and adds it to the patch layer. The held event replays. An answer that comes
   after the wait still applies if it can; a refused answer runs the default.
6. **Everyone else.** Every client pulls `GET /patches` and takes each entry through the same validator
   (`runtime/src/learned.ts`, `takeLogEntries`). A log with another identity (`log`) is synced from 0.
7. **When a learned rule misbehaves.** The engine sets it aside at run time (`engine.fault`, the quarantine:
   its own leaves open again, the answers grown below it keep answering) and reports it (`POST /fault`). Past
   the bound of reporting clients, the service removes it and asks for a revision offline.

The time a player waits is the same at every AI setting (`AI_WAIT_MS`, `engine/src/quality.ts`).

## 4. The contract

| Type | Where | What |
|---|---|---|
| `ModRequest` | `engine/src/mod.ts` | the question: event, roles, hole, context, scenario, tier |
| `ModSpec` | `engine/src/mod.ts` (`buildModSpec`) | what a patch may say: kinds, conditions, effect primitives, types |
| `Patch`, `Artifact` | `engine/src/mod.ts` | the answer: rules, new types, new statuses |
| `ResolveBody`, `ResolveReply` | `engine/src/mod.ts` | `POST /resolve` |
| `PatchLogEntry` | `engine/src/mod.ts` | one line of the shared library's log |
| `ValidationResult` | `engine/src/mod.ts` | errors and warnings of `validatePatch` |

The service's endpoints are listed at the top of `ai/src/service/server.ts`. Endpoints that cost model calls or
write the library without the AI (`/create`, `/draft`, `/adopt`, `/quality/detect`, the offline profile of
`/resolve`) answer this machine only: a loopback address, no foreign `Origin`, JSON.

## 5. Who checks what

A patch passes every layer below before it ships; the model never decides whether its own answer holds.

| Check | Where | What it refuses |
|---|---|---|
| The validator | `engine/src/mod.ts` `validatePatch` | bad shapes, unknown types, writes beyond the host, a rule placed at a defined leaf, ties, protected story facts, a replay that errors (refused effects included), failing tests |
| The repeat check (endless yield) and the chain bound | `engine/src/sandbox.ts` | a yield with no end (things made, or a number raised every time) under any way its chances may fall (the dice are not rolled: each outcome is followed), a chain that does not settle |
| The economy | `ai/src/checks/economy.ts` | a free lunch: any mix of conversions that makes more than it takes (a linear programme) |
| The probe | `ai/src/checks/audit.ts` `probe` | a farm the act shows when done 30 times, with no model |
| The auditor | `ai/src/checks/audit.ts` | an agent plays against the patch; a finding counts only if the sandbox reproduces it and the code sees a harm in it (`harmOf`: farm, value, harm to what the story needs, softlock, runaway) |
| The reviewer | `pipeline.ts` `review`, `REVIEW_SYSTEM` | a rule a player would find wrong; before shipping when blocking, after when not |
| The client | `ModPort.submit`, `takeLogEntries` | anything the client's own validator refuses |
| Run time | `engine.fault`, quarantine | a learned rule whose effects the engine refuses, or whose chain will not end |

What each tier carries (no review, audit or escalation at low; more reasoning, a blocking review at high) is
`ai/src/modder/quality.ts`; the levels themselves are the engine's (`engine/src/quality.ts`). The detection of
what a connected model carries plays a set of questions at every tier (`ai/src/modder/detect.ts`).

## 6. Profiles

One harness, two profiles (`ai/src/agent/state.ts`, `profileOf`):

- **live**: a player waits. One call from the brief, low reasoning, deterministic fixes, the derived test,
  hedged calls; the audit and review run after shipping.
- **offline**: nobody waits (the curriculum, an escalation of a failed live request, a revision, the editor).
  Tools, more reasoning, a blocking audit and review. By default the repo agent works the question as a
  repository with its own tests (`repo.ts`, `validate-cli.ts`).

## 7. Models

`packages/ai/src/models` holds the only code that talks to a model (`Model`: `chat(messages, opts)`):

| Backend | File | Chosen by |
|---|---|---|
| OpenAI-compatible (OpenRouter by default) | `ai/src/models/model.ts` | `LSW_MODEL_URL`, `LSW_MODEL_KEY`, `LSW_MODEL` |
| Claude Code's print mode (`claude -p`, signed in as the user) | `ai/src/models/model-node.ts` | `--backend claude-code` |
| Anthropic's API | `ai/src/models/model.ts` (`AnthropicModel`) | `--backend anthropic`, `ANTHROPIC_API_KEY` |
| A player's own key, from the browser | `ai/src/models/providers.ts` | the game's options (`byok.md`) |
| Scripted (tests, offline demos) | `ai/src/models/model.ts` `ScriptedModel` | `--script`, `LSW_MODEL_SCRIPT` |

`modelFromEnv` (`model-node.ts`) picks one; no provider is hard-coded. Every caller sees the same options
(`json`, `tools`, `reasoning`, `deadlineMs` with 0 for none), and `Meter` counts calls, tokens and cost.

## 8. Authoring

- **The holes panel** (`editor/src/app/holesMode.ts`): every act on every kind that is still undefined
  (`format/src/holes.ts`); answer one by hand, or ask the modder (offline), replay it, take it into the
  game's `learned/` files, which every new game and save begins from.
- **The AI drafter** (`editor/src/app/drafter.ts`): a sentence becomes a new thing (`Modder.createThing`,
  `POST /create`), a person or a map (`Modder.draft`, `POST /draft`, `ai/src/modder/drafts.ts`). A new thing is
  checked by `format/src/things.ts` (it holds, a player can have it, it is good for something, its numbers sit
  among its kind's) and taken in by `newThing.ts` and `POST /adopt`.

## 9. The self-improving agent and the evaluations

- **Three loops** (rsi.md §4): the inner loop works one task (`ai/src/agent/loop.ts`); the middle loop writes
  lessons and skills after it (`reflect.ts`); the outer loop proposes one change to the harness and keeps it
  only if it holds up on recorded tasks (`outer.ts`). Everything it may change is the self-state
  (`state.ts`). RSI design changes are discussed with the user before they are coded (CLAUDE.md).
- **The upstream loop** (upstream.md): where learned answers show that a whole class answers alike
  (`ai/src/library/promote.ts`), a change to the base rules is proposed as a task (`games/openworld/ai/src/upstream.ts`).
- **Drivers and benches** (`games/openworld/ai/src`): `curriculum.ts`, `improve.ts`, `rsi.ts`,
  `latency.ts`, `ladder.ts`, `eval-objects.ts`, `eval-affordance.ts`, and the paper's runs in `eval/`
  (paper-eval.md). An unattended agent runs commands only in a container (`ai/src/agent/env.ts`).

## 10. Where to look

| Concern | Files |
|---|---|
| The contract and the validator | `engine/src/mod.ts`, `engine/src/sandbox.ts`, `engine/src/quality.ts` |
| The pipeline | `ai/src/modder/pipeline.ts`, `prompts.ts`, `brief.ts`, `signature.ts`, `tools.ts`, `affordance.ts` |
| Repairs and tests the harness writes | `ai/src/modder/fixes.ts`, `derive.ts` |
| Judges | `ai/src/checks/economy.ts`, `audit.ts`; `ai/src/modder/quality.ts`, `detect.ts` |
| The shared library | `ai/src/library/library.ts`, `library-file.ts`, `promote.ts` |
| The service | `ai/src/service/server.ts`, `open.ts`; `ai/scripts/modder.ts`; `ai/src/browser.ts` |
| Offline as a repository | `ai/src/service/repo.ts`, `validate-cli.ts`, `offline.ts` |
| Models | `ai/src/models/model.ts`, `model-node.ts`, `anthropic.ts`, `providers.ts`, `providerList.ts` |
| Self-state and RSI | `ai/src/agent/state.ts`, `loop.ts`, `reflect.ts`, `outer.ts`, `presets.ts`, `tools.ts`, `env.ts`, `swe.ts` |
| Play | `runtime/src/worker.ts` (asking, syncing), `learned.ts`, `modderLink.ts`, `ai.ts`, `ownModel.ts`, `ui/modelSettings.ts`, `ui/quality.ts`; `ai/src/player/` |
| Authoring | `editor/src/app/holesMode.ts`, `drafter.ts`, `drafts.ts`, `newThing.ts`; `format/src/holes.ts`, `things.ts` |

Tests: the engine's guards in `engine/test/ai-guards.test.ts`; the AI's own in `ai/test/` (pipeline,
economy, audit, library, models, the agent); those that need the game in `games/openworld/ai/test/`
(`detection-guards`, `audit-harm`, `pipeline-guards`, `service-guards`, `library-log`, `quality`); the game's
own `yield` and `coverage` in `games/openworld/tools/test/`.
