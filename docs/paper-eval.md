# The paper's evaluation of the world (§7)

The world-side experiments of the paper (Overleaf, §7 "Evaluation of the World"), what runs them, and how they were run
at `world-v0` (tag on main, commit 25e0477, 2026-10-19). Their outputs go to `var/eval/` (not committed); the numbers
are in the paper.

## The model

The world-side experiments use Claude Opus 5.5 at low effort through Anthropic's API: the modder's backend
`anthropic` (`packages/agent/src/anthropic.ts`; `LSW_MODEL_BACKEND=anthropic`, the key `ANTHROPIC_API_KEY` in the
gitignored `.env`, `LSW_CLAUDE_MODEL` and `LSW_CLAUDE_EFFORT` as for `claude-code`). A call is one Messages request: the
system prompt cached, tools as tools, the effort the call asks for (never under the floor), and a declined call goes to
the model's default fallback, which the reply names as its provider. Its cost is reckoned from the reported usage at
the list prices. The RSI experiments (§8) still name Kimi K3 (docs/rsi-experiments.md §3).

## What runs them

| Paper | Command | No model? |
|---|---|---|
| Table 2, scale | `npm run scale` (five runs, medians), `npx tsx <figures/src/counts.ts>` in the paper's repository | yes |
| Openness | the coverage sweep (`coverage.ts` `sweep`; the paper's `figures/src/sweep.ts`) | yes |
| Openness, amortization | `npm run curriculum -- --n 100 --profile live --by hole --data var/eval/curriculum-claude` (each step's coverage after it) | no |
| Openness, composition | `npx tsx games/openworld/tools/src/eval/composition.ts <a run's library.jsonl>` | yes |
| Cost over play | `npx tsx games/openworld/tools/src/eval/play.ts --players 8 --hours 20` | yes |
| Persistence and consistency | `npx tsx games/openworld/tools/src/eval/persistence.ts --days 1,7` | yes |
| The trust boundary under attack | `npx tsx games/openworld/tools/src/eval/attack.ts` | yes |
| Live answers by tier (Valid, Wait, Cost) | `npm run latency -- --n 20 --tier low\|medium\|high` (the tier set on the request's scenario, which the request's own defers to) | no |
| The router | `npm run eval:objects` | no |
| Table 1, controlled | `npx tsx games/openworld/tools/src/eval/controlled.ts items \| answer <cond> \| repeat \| judge \| report` | C, items: yes |
| Table 1, the human study (Appendix D) | `npx tsx games/openworld/tools/src/eval/study.ts build \| serve <results dir> [--port 8080] \| score <results dir>` | yes |
| The running world | `npx tsx games/openworld/tools/src/eval/running.ts --players 3 --hours 24 --budget 15` | no |

- **persistence.ts** walks the world as the worker does (maps made or read when needed, the far ones put away, read
  again on the way back). Five probes — a thing placed, a fixture set burning, a creature felled, an item given to a
  person, a crop planted — each left for a minute, an hour, a day and seven days on a far map, or saved and loaded, and
  compared thing by thing with a run that never left. Determinism: three seeded 24-hour sessions with a random walk,
  hashed every hour (the player's map, what is carried, what is nowhere), replayed, and replayed across a save.
- **composition.ts** plays every learned rule of a library in the scene that asked for it, over the base rules and all
  the learned ones, and reads the chain from the engine's trace: its length, and which rules besides its own answer it.
- **play.ts**: scripted explorers (a bag of ten things the world places, two changed every hour; they walk, travel every
  two hours to a played or a backdrop map, and use, hand, take and put on what is about them), with nobody to ask; the
  game's mod port records each situation that fell undefined, keyed as the modder keys one question per situation. The
  model calls an hour are the situations first reached in it, by a player alone or by all of them on one library.
- **attack.ts** poses 39 answers written to be broken or malicious (twelve classes) to the validator with the scene that
  asked, and plays what passes it in the sandbox against the act without it.
- **controlled.ts**: `items` draws 30 held-out authored situations (a base rule that answers a use removed: its
  situations become holes, the rule is the reference) and 30 undefined ones (stratified by the hand's family and the
  target's class). `answer A` is the modder (live, one fresh modder a situation, its review and audit run before the
  rule is read back), `B` a narrator (the same model, told the scene and the world, saying what happens), `C` the
  removed rule, and `no-brief`, `no-fixes`, `no-test`, `no-review`, `no-audit`, `no-router` the ablations (the harness's
  switches; `design.fixes` and `design.router` were added for them). A and C are told by one template from what the
  replay changed. `repeat` asks the narrator each undefined situation five times. `judge` has the model rate each
  sentence (sense, fit: 1–7) and choose between conditions two at a time; `report` writes the table (TrueSkill over the
  choices).
- **study.ts**: `build` draws each situation's frame with the game's renderer (the one acting facing what they act on,
  what they hold from the catalogue) and writes one page (`var/eval/study/index.html`) with the outcomes of A, B and C
  and twelve lists (30 ratings and 15 choices each, three attention checks). The page takes `?list=`, `PROLIFIC_PID`,
  `?submit=` and `?cc=` (Prolific's return); `serve` hosts it and writes one file a participant; `score` excludes those
  who fail two checks or rate faster than 2.5 s at the median, and gives the table and the model judge's agreement.
- **running.ts**: explorers as play.ts's, each in a world of its own, and one modder (the default tier, revisions off)
  answering into one shared library every world syncs from; a player's act that waits pauses its world for 20 s at
  most. It reads the answers learned and where they were used, the chains a learned rule's outcome led into the base
  rules, the deeds remembered and the bounties, the quests' stages. `--budget` stops asking once the spend reaches it.

## What the runs found in the game

- **A save lost each clock's phase** (persistence.ts, determinism across a save): the progress of a period on a host's
  own pace (hunger, slower asleep or hungry) was the engine's memory, so a load set it back to the clock's beat and
  hunger fell a tick off. It is kept with the state now (`WorldState.paces`).
- **A rule may raise its host's worth** (attack.ts): `addProp value` on every use is coin from nothing once sold; the
  economy check counts conversions between things, not a thing's worth. Fixed after world-v0 (PR #112,
  `fix/learned-worth`): the validator refuses a learned rule that writes what the economy reads; with it all 39 attacks
  are stopped, 27 by the validator and 12 at run time.
- **A fire on a dormant map** burnt out to ash on return, where a map in play breaks the woodpile into logs first: a
  status that acts every step was summed up when its map caught up (only its end ran). Fixed after world-v0 (PR #113,
  `fix/dormant-pulses`): entering a map runs its statuses' clocks tick by tick where something comes due, as a tick in
  play does — each pulse of a status that ends, then its end, at the tick it falls on, with dice of its own (the world's
  seed, the thing, the status, the tick), so a pulse rolls the same in play and caught up. With it, all five probes come
  back the same at every absence (a minute to seven days) and after a save, and the three seeded sessions replay
  identically, across a save too (persistence.ts on this branch with #113 merged).

## What the runs found in the modder

- **Every first answer writes its rule bare** (controlled.ts, `no-fixes`): Opus 5.5 puts the rule's fields straight in
  the patch's `artifacts` instead of `{kind: 'rule', rule}`; `normalizePatch` wraps it silently. Without the repairs
  no first answer is valid and 52 of 60 are accepted after a repair round. The prompt never shows an artifact's shape.
- **A revision costs some 25 answers**: the review and the audit run after an answer ships and cost little themselves;
  the revisions they ask for are worked offline by the repository agent (tools, medium reasoning), whose history the
  `anthropic` backend does not cache: a median of $1.23 each against $0.05 for the answer. In condition A, 9 revisions
  for 60 answers made an answer cost $0.27 in all. Caching the agent loop's history (a breakpoint on its last message)
  would cut most of that.
- **A quarter of the reviewer's requests are false alarms**: of 49 requests for revision, 12 say a rule written for a
  plain blow swallows blows that carry an element; replayed, such a blow never reaches it (core/strike's element branch
  answers, and a learned rule is consulted only at the hole). The review prompt does not say where the rule sits. Open:
  tell the reviewer the rule's place (the path to its hole).
- **The model judge cannot tell the ablations apart** (all rated 5.6–6.2 of 7, none chosen over A more often than
  chance), and prefers the modder's own answers to the authors' (it is the same model). The human study is to come.

- **The high tier is late for the player who asked** (latency.ts, 20 uses a tier): low 18/20 held (no repair round),
  median 7.4 s, $0.045; medium 20/20, 8.6 s, $0.055; high 20/20, all valid at the first answer, but 27.3 s and $0.108,
  15 of 20 after `AI_WAIT_MS` (20 s): the blocking review and medium effort.

## Spend

What the runs recorded at the list prices, 2026-10-19: the controlled conditions $142 (the answers $23, the reviews
and audits $6, the offline revisions they asked for $113), the curriculum $12, the live bench (twice, the first at one tier by mistake) about $8, the router $2,
the judge and the narrator about $6 — some $170.
