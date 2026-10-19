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
| Live answers by tier (Valid, Wait, Cost) | `npm run latency -- --n 20 --tier low\|medium\|high` | no |
| The router | `npm run eval:objects` | no |
| Table 1, controlled | `npx tsx games/openworld/tools/src/eval/controlled.ts items \| answer <cond> \| repeat \| judge \| report` | C, items: yes |

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

## What the runs found in the game

- **A save lost each clock's phase** (persistence.ts, determinism across a save): the progress of a period on a host's
  own pace (hunger, slower asleep or hungry) was the engine's memory, so a load set it back to the clock's beat and
  hunger fell a tick off. It is kept with the state now (`WorldState.paces`).
- **A rule may raise its host's worth** (attack.ts): `addProp value` on every use is coin from nothing once sold; the
  economy check counts conversions between things, not a thing's worth. Open: the validator could refuse a learned
  rule that writes a prop the economy reads.
- **A fire on a dormant map** burns out to ash on return, where a map in play breaks the woodpile into logs first: a
  status that acts every step is summed up when its map catches up. Open.
