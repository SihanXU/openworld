# CLAUDE.md — OpenWorld (paper: Large Symbolic World)

A web-playable 2D JRPG world whose state and rules are code; an LLM modder (later)
patches undefined interactions at runtime. Successor to BardOS (`C:\Users\chica\文字游戏`).
Story and world: [docs/lore.md](docs/lore.md) (the user's canonical setting: the Five Sufferings, the
First Night, the five Seal-bearers; every chapter follows it) and [docs/chapter-1.md](docs/chapter-1.md).
Design: [docs/design.md](docs/design.md); the agreed world model and base gameplay (not yet built,
steps W1–W10): [docs/world-model.md](docs/world-model.md). Paper draft lives in Notion ("Large Symbolic World").

## Working agreements

- Converse with the user in Chinese; write code, comments and docs in English.
- Build order: a small, polished demo first, then scale. The target is hundreds of maps,
  thousands of NPCs, tens of thousands of items; the demo (the Ford and the maps growing around
  it) is the development scaffold, never an argument against growth. Every element it holds
  witnesses a requirement (docs/game-design.md §9). Basic game systems (bag, crafting, levels,
  hunger) are welcome; never copy one game's own content or loops (Stardew's shipping bin). Keep
  the architecture scale-ready; ask when the scope of a request is ambiguous.
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
  dispatch + tick + movement + combat (`engine.ts`), one goal system for every actor (`behaviour.ts`:
  goals in each type's order — encounter, threat, follow, schedule, home, idle; the people's goals and
  their real work in `npc.ts`, the creatures' in `creatures.ts`, the bosses' locked telegraphs in
  `bosses.ts`, docs/bosses.md), Mod port: ModSpec / ModRequest / validatePatch / records
  (`mod.ts`), sandbox replay (`sandbox.ts`), snapshots for rendering (`snapshot.ts`),
  new game / save (`game.ts`); days, nights and weather spans (`calendar.ts`), people — keyed
  lines, schedule variants with the thing an activity needs, topics (`people.ts`), the story's one
  script (`story.ts`, world-model.md §6.12: steps with triggers — a scene takes control, a beat does
  not — that write only the story and send pushes and notices; guides and hints; a guide's lessons,
  the tutorial's drills that lock the keys they do not teach, `Controls.allows` — docs/prologue.md); the state is things and the
  clock (world-model.md §3): facts and topics are the story's props, memories each person's,
  a map's named areas are `region` things (`in-region`); invariants live in the engine; events, relations (contact from the relation difference),
  active/dormant maps and the writer (`World.grant`: the mutators throw outside an outcome, the
  clock, loading, the input's posture and the author, and in an outcome beyond its host —
  design.md §5.15; `tools/test/writes.test.ts` scans for writes behind them) in `engine.ts`/`world.ts`; the request, one question per hole and class, the
  validator (host-only writes, ties, replay) and the boundaries in `mod.ts` (design.md §5.4–5.14);
  the player's five
  inputs (E hands, F take, G put, left click use — a bare one is a blow —, right click use on oneself;
  each as far as its reach: the target's `handsRange`, the world's `carry`, the held thing's `range`,
  held to by the engine for every actor), layers, slots and magnet
  (`controls.ts`, design.md §5.2, with a completeness test); crafting from recipes
  (`controls.ts`), what appears by itself — the ground's yield, creatures that come back, the night's walkers (`appear.ts`), experience and levels (`progression.ts`), hunger (`hunger.ts`); companions that follow a
  leader (`companion.ts`), waypoint stones (`waypoints.ts`) — docs/prologue.md; the codex (`codex.ts`: every item kind, person and creature kind, the ones the player carried or saw marked — the reader's record beside the state, saved with the game; its entries `content/src/codex.ts`, its panel J).
- `packages/content` — ontology (terrains, statuses, elements, types), item catalogue
  (forms × materials × qualities × elements), crafting recipes (`recipes.ts`), the skill tree (`skills.ts`), the BASE RULE LIBRARY (`rules.ts`), the Ford's
  story rules, objectives and invariants (`ford.ts`), the prologue's objectives and beats (`prologue.ts`), the main quest's rules and objectives (`quest.ts`,
  docs/main-quest.md), Chapter 1's quests, objectives and rules (`chapter1.ts`; its maps and scenes in
  `tools/src/demo/quest/chapter1.ts`, docs/chapter-1.md), the fairy's boons (`boons.ts`), the boss kits (four: the White Knight and three for later), defeat rules and compatibility migration (`bosses.ts`, `migrateBosses.ts`), chunk codec.
- `packages/tools` — `art/animals.ts` (the project's own sprites → `client/public/assets/lsw/`), `demo/` (the hand-crafted Ford, Firstlight Village west of it (`meadow`) and the forest south of that, and the main quest's maps and scenes in `quest/` → `public/world/`, each map from its own seed: `builder.ts` the map DSL
  with the tools of composition — curved paths, organic shapes, fences and yards, small things by masks,
  anchors, regions; `world.ts` `buildFord()` — the map, scenes, invariants;
  `people/*.ts` one record per person (`person.ts`); `check.ts` a headless two-day playtest;
  `test/demo.test.ts` the completeness and minimality proof),
  `copyAssets.ts` (catalogue subset of the pack → `public/assets/na/`), `coverage.ts` (every item
  form × every target × every act through the rule library and the impulses it sends, counting
  the holes; the numbers in `docs/roadmap.md` §1).
- `packages/client` — `worker.ts` runs the engine at 10 ticks/s (+ the action prompt);
  `render/scene.ts` renders snapshots with the Ninja Adventure pack (`render/depth.ts` the draw order); `assets/catalog.ts` maps
  content keys to sprites; `assets/ground.ts` autotiles; `ui/` the Stardew-style UI (`hud.ts` clock, bars,
  toolbar, key labels, dialogue; `menu.ts` menu tabs, journal, chest panel; `worldmap.ts` the world map (M) and the minimap; `dev.ts` the Mod Console, dev only); the worker uses the modder service when one answers
  (`?modder=<url>`, default `localhost:8787` in dev) and syncs the shared library from it.
- `packages/agent` — the SWE-style agent and its self-state, task-agnostic (no engine, no content):
  `model.ts` (OpenAI-compatible / scripted), `state.ts` (memory, skills + scripts, harness, hooks,
  journal, snapshots, ablations), `env.ts` (local / docker), `tools.ts`, `loop.ts` (the agent loop),
  `reflect.ts`, `outer.ts` (proposals + meta-validation), `presets.ts` (naive / tuned), `swe.ts` +
  `cli.ts` (SWE-bench instances → predictions.jsonl). See docs/rsi.md.
- An unattended agent runs commands only in a container (`env.ts` `chooseIsolation`: the
  `lsw-sandbox` image, no network, no `.env`); without Docker it gets no shell and its hooks do
  not run. `LSW_ISOLATION=docker|none` overrides. Never give an unattended agent a local shell.
- `packages/modder` — the modder service (design.md §13, rsi.md). It may depend on content;
  the engine never depends on it. Parts:
  - `model.ts`: a model interface — OpenAI-compatible, or scripted for tests and offline.
  - `pipeline.ts`: comprehend → recall → design (tools) → verify/repair → audit → review → commit →
    record → reflect. The auditor (`audit.ts`) plays against a patch in the sandbox; only what it
    reproduces there, with the patch and not without it, counts. Live designs are routed (design.md §13, the router): local (the request's
    own types) → find (the catalogue) → create (a new type with its 16x16 picture as data).
  - `tools.ts`: the design tools.
  - `library.ts`: the shared library as an append-only patch log.
  - `state.ts`: the self-state — memory, skills, harness, journal, snapshots.
  - `server.ts`, `cli.ts`: the HTTP API and the command line.
  - `repo.ts`, `validate-cli.ts`: a world request as a repository for the agent (the offline profile).
  - The offline driver is `tools/src/curriculum.ts`; engine tasks (hidden fail-to-pass tests) are
    `tools/src/engine-tasks.ts` + `tools/tasks/engine/<id>/`; one outer-loop turn is `tools/src/improve.ts`.
- RSI design changes (what the outer loop may change, how it is judged, the benchmark interface)
  are discussed with the user before they are coded.
- Game mechanics are designed reference-first: read how Elin (installed; decompile
  `Elin_Data/Managed/Elin.dll` with `ilspycmd` into the scratchpad) and other games built it,
  then adapt to our principles; invent only where no game has a model.
- The model is Kimi K3 via OpenRouter, with the key in the gitignored `.env`. Anthropic, Google and OpenAI
  return 403 from here. Never hard-code a provider; tests use `ScriptedModel`. A second backend,
  `claude-code`, calls `claude -p` signed in as the user (Opus 5.5, effort low by default; `ClaudeCodeModel`).
  `npm run dev` asks which backend to use (or `--backend openrouter|claude-code|none`, `LSW_MODEL_BACKEND`).
- Two harness profiles: **live** (a player waits: brief, one call, low reasoning, deterministic fixes,
  derived tests, hedged calls, review after shipping) and **offline** (curriculum, escalations,
  revisions: tools, more reasoning, blocking review). Measure live changes with `npm run latency`.

## Rules of thumb

- New behaviour = a rule (data) in `content/src/rules.ts` or a patch; a rule an input reaches says
  what the input does there (`label`, on the rule or on one of its answers). New primitive,
  condition or event kind = an engine change (and add it to the ModSpec docs in `effects.ts`/`mod.ts`).
- Rules address classes (types/tags/statuses), never instances, unless unavoidable.
- No judgment is "is it the player": who attacks whom (factions + temper + foes), who sees what
  (witnesses of any actor), who collapses (`essential`), using on oneself (`self`) are data any
  actor carries. Only the input knows which actor the keys move.
- **The event model** (design.md §5.4–5.14, agreed and built 2026-10-02; §5.14 records what the
  implementation refined):
  - The game is an ordinary, complete game. It plays to the end without AI.
  - The one AI interface is **the outcome of an event**. Defined: use it. Undefined: ask the
    AI. No AI, a failure or a time-out: the leaf's default, normally nothing.
  - Rules belong to a **host** type (`host × event kind → condition tree`). They **read
    anything and write only their host**; to affect another thing they emit an event (an
    impulse) to it, and it answers.
  - Leaves are effects (an empty list means no change), emit, inherit, or undefined (with a
    default).
  - The event kinds are a closed tree: act, impulse, contact, bump, time, threshold, seen,
    stuck, broken. Contact comes from the relation difference after every outcome, and only
    where a stance meets a reach (a flyer never touches lava).
  - Root defaults decide what is asked: deliberate acts and impulses are undefined; contact,
    time and sight mean no change; elements follow physics.
  - Patches only fill holes, never change defined behaviour (they are a layer consulted only at
    undefined leaves). One question per hole and class. Put places; use applies: taking and
    putting are physics (never asked), using one thing on another is where the AI answers.
  - Behaviour (schedules, temper, behaviour trees) is the game's own logic, not the AI
    interface. An outcome may change its host's script.
  - The player's map is active. Dormant maps are frozen and catch up timers and their inbox
    when entered. The world, the story and people's records are resident. Events cross maps
    only by address.
  - **Even with no model connected, design every feature for one.** New behaviour goes
    through events and rules, never around them in engine code. A deliberate act on
    something no rule covers stays an undefined leaf (the AI's place to answer). Play without
    a model is kept by the leaf's default and authored fallbacks, never by closing the hole.
- Specificity: host first (instance-bound, type depth), then event kind depth. Two equally
  specific rules are rejected by the validator; there is no compose.
- Game code never writes the state directly and never takes the author's hand (`Engine.author`
  is for tests, world building, loading, migrations and the dev console). A system that changes
  the world does it as events: behaviour makes acts, the clock makes periods and timers, a
  system's own logic runs inside its host's outcome as an effect primitive (design.md §5.15).
- The demo must stay complete: anything added to its maps witnesses a requirement in
  `tools/test/demo.test.ts` (or the test fails), and every requirement is checked on the real map.
- Only the player steps onto portals; NPCs transfer from the adjacent tile.
- After changing rules, run `npm run coverage` and commit the refreshed baseline with them; a
  finished milestone records its numbers in its row of `docs/roadmap.md` §3. The coverage test
  fails if any form or target loses an answer or a purpose.

## Commands

```bash
npm install
npm run gen:world        # the Ford (default world)
npm run check:world      # headless playtest of it: days kept over two game days, what the world asked
npm run assets           # copy the catalogue's subset of the asset pack into public/assets/na
npm run dev              # client at http://localhost:5173 + the modder on :8787 (asks for its model; dev:client for the client alone)
npm run dev -- --backend claude-code   # the modder through claude -p (Opus 5.5, effort low)
npm test                 # vitest (engine + base rules + Mod port)
npm run typecheck
npm run coverage         # interaction coverage + refresh its test baseline
npm run build            # gen:world + static build → packages/client/dist
npm run modder -- serve  # modder service on :8787 (model from LSW_MODEL_URL/KEY/MODEL; data in var/)
npm run modder -- serve 8787 --script packages/modder/fixtures/offline.json --data var/offline
npm run curriculum -- 20 # resolve 20 sampled undefined interactions offline (offline profile)
npm run curriculum -- --n 20 --profile live --by hole --data var/<run>   # live profile, spread over holes; per-step reach
npm run curriculum:report -- var/<run>   # summarise a run: steps, reviews, revisions, spend
npm run ford-live        # the six kinds of hole on the Ford, live (costs model calls)
npm run eval:objects     # five acts to find a known thing, five to create a new one, live (costs model calls)
npm run latency -- --n 20 # live-profile latency bench (fresh library each run; costs model calls)
npm run improve -- --select 8 --confirm 8   # one outer-loop turn (costs model calls)
npm run engine-task -- toggle-status --state <dir>
npm run agent -- swe --instances <file> --state <snapshot> --out predictions.jsonl [--env docker]
npm run modder -- stats | snapshot <label> | export [label] | library [remove <id>]
```
