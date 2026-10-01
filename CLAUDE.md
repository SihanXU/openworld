# CLAUDE.md — Large Symbolic World

A web-playable 2D JRPG world whose state and rules are code; an LLM modder (later)
patches undefined interactions at runtime. Successor to BardOS (`C:\Users\chica\文字游戏`).
Design: [docs/design.md](docs/design.md). Paper draft lives in Notion ("Large Symbolic World").

## Working agreements

- Converse with the user in Chinese; write code, comments and docs in English.
- Build order: a small, polished demo first (Hearthvale), then scale. Keep the architecture
  scale-ready; ask when the scope of a request is ambiguous.
- The subject is the WORLD (vs neural world models), not agents. NPCs are content.
- Second paper thread: RSI of the modder (memory, skills, harness it forms itself), see
  `docs/rsi.md`. It is a paper matter: the demo stays a clean game without it. Evaluation is
  an external benchmark run by the team.
- Commit/push only when asked. End commit messages with the Co-Authored-By line.

## Architecture (strict dependency direction)

```
client (Phaser 4 + DOM HUD)  →  engine (pure TS, in a Web Worker)  →  Mod port  →  modder service (HTTP)
```

- `packages/engine` — pure, deterministic, no DOM/AI. World state + indices (`world.ts`),
  rule matching/specificity/library (`rules.ts`), effect primitives (`effects.ts`), event
  dispatch + tick + movement + combat (`engine.ts`), NPC two-fidelity sim (`npc.ts`),
  creatures (`creatures.ts`), Mod port: ModSpec / ModRequest / validatePatch / records
  (`mod.ts`), sandbox replay (`sandbox.ts`), snapshots for rendering (`snapshot.ts`),
  new game / save (`game.ts`).
- `packages/content` — ontology (terrains, statuses, elements, types), item catalogue
  (forms × materials × qualities × elements), the BASE RULE LIBRARY (`rules.ts`), chunk codec.
- `packages/tools` — `demo/` (the hand-crafted Hearthvale demo: builder DSL, maps, people →
  `public/world/`), `genWorld.ts` (Saenvar at scale → `public/world-saenvar/`), `stress.ts`,
  `copyAssets.ts` (catalogue subset of the pack → `public/assets/na/`), `coverage.ts` (every item
  form × every target × every verb through the rule library; the numbers in `docs/roadmap.md` §1).
- `packages/client` — `worker.ts` runs the engine at 10 ticks/s (+ the action prompt);
  `render/scene.ts` renders snapshots with the Ninja Adventure pack; `assets/catalog.ts` maps
  content keys to sprites; `assets/ground.ts` autotiles; `hud.ts` HUD, dialogue, objectives
  and the Mod Console (patch by hand); the worker uses the modder service when one answers
  (`?modder=<url>`, default `localhost:8787` in dev) and syncs the shared library from it.
- `packages/agent` — the SWE-style agent and its self-state, task-agnostic (no engine, no content):
  `model.ts` (OpenAI-compatible / scripted), `state.ts` (memory, skills + scripts, harness, hooks,
  journal, snapshots, ablations), `env.ts` (local / docker), `tools.ts`, `loop.ts` (the agent loop),
  `reflect.ts`, `outer.ts` (proposals + meta-validation), `presets.ts` (naive / tuned), `swe.ts` +
  `cli.ts` (SWE-bench instances → predictions.jsonl). See docs/rsi.md.
- `packages/modder` — the modder service (design.md §13, rsi.md). It may depend on content;
  the engine never depends on it. Parts:
  - `model.ts`: a model interface — OpenAI-compatible, or scripted for tests and offline.
  - `pipeline.ts`: comprehend → recall → design (tools) → verify/repair → review → commit →
    record → reflect.
  - `tools.ts`: the design tools.
  - `library.ts`: the shared library as an append-only patch log.
  - `state.ts`: the self-state — memory, skills, harness, journal, snapshots.
  - `server.ts`, `cli.ts`: the HTTP API and the command line.
  - `repo.ts`, `validate-cli.ts`: a world request as a repository for the agent (the offline profile).
  - The offline driver is `tools/src/curriculum.ts`; engine tasks (hidden fail-to-pass tests) are
    `tools/src/engine-tasks.ts` + `tools/tasks/engine/<id>/`; one outer-loop turn is `tools/src/improve.ts`.
- RSI design changes (what the outer loop may change, how it is judged, the benchmark interface)
  are discussed with the user before they are coded.
- The model is Kimi K3 via OpenRouter, with the key in the gitignored `.env`. Anthropic, Google and OpenAI
  return 403 from here. Never hard-code a provider; tests use `ScriptedModel`.
- Two harness profiles: **live** (a player waits: brief, one call, low reasoning, deterministic fixes,
  derived tests, hedged calls, review after shipping) and **offline** (curriculum, escalations,
  revisions: tools, more reasoning, blocking review). Measure live changes with `npm run latency`.

## Rules of thumb

- New behaviour = a rule (data) in `content/src/rules.ts` or a patch. New primitive,
  condition or event kind = an engine change (and add it to the ModSpec docs in `effects.ts`/`mod.ts`).
- Rules address classes (types/tags/statuses), never instances, unless unavoidable.
- Specificity decides which rule fires: (instance-bound, type depth, constraint count, priority).
  Base rules must not tie at equal specificity on overlapping patterns — the validator checks it.
- Only player interactions can be *undefined*; hits/ticks/status events simply have no effect
  when unmatched.
- Only the player steps onto portals; NPCs transfer from the adjacent tile.
- After changing rules, run `npm run coverage` and commit the refreshed baseline with them; a
  finished milestone records its numbers in its row of `docs/roadmap.md` §3. The coverage test
  fails if any form or target loses an answer or a purpose.

## Commands

```bash
npm install
npm run gen:world        # Hearthvale demo (default world)
npm run gen:saenvar      # the 460-map scale world (?world=saenvar)
npm run assets           # copy the catalogue's subset of the asset pack into public/assets/na
npm run dev              # client at http://localhost:5173
npm test                 # vitest (engine + base rules + Mod port)
npm run typecheck
npm run coverage         # interaction coverage + refresh its test baseline
npx tsx packages/tools/src/stress.ts 6   # full-scale stress run (6 game-hours)
npm run build            # gen:world + static build → packages/client/dist
npm run modder -- serve  # modder service on :8787 (model from LSW_MODEL_URL/KEY/MODEL; data in var/)
npm run modder -- serve 8787 --script packages/modder/fixtures/offline.json --data var/offline
npm run curriculum -- 20 # resolve 20 sampled undefined interactions offline (offline profile)
npm run latency -- --n 20 # live-profile latency bench (fresh library each run; costs model calls)
npm run improve -- --select 8 --confirm 8   # one outer-loop turn (costs model calls)
npm run engine-task -- toggle-status --state <dir>
npm run agent -- swe --instances <file> --state <snapshot> --out predictions.jsonl [--env docker]
npm run modder -- stats | snapshot <label> | export [label] | library [remove <id>]
```
