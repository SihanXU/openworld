# The AI code laid out by concern: a proposal

Status: proposed 2026-10-26. Step 0 is done: all the AI is one package, `packages/ai`, laid out by domain
(`models/`, `modder/`, `checks/`, `library/`, `agent/`, `service/`, `player/`), and OpenWorld's drivers are in
`games/openworld/ai`; delete both and the game plays. Steps 1 to 5 are not agreed yet. The map of the AI side
as it is now is [ai.md](ai.md).

## 1. Why

The AI side is its own package (`packages/ai`), and the dependency direction holds (nothing outside it imports
it; `boundaries.test.ts`). What makes it hard to read is inside them:

| Where | Size now | Why it is hard to read |
|---|---|---|
| `engine/src/mod.ts` | 2,044 lines, 66 lines over 200 characters | the contract, the ModSpec, the port, request building, the validator and the checks of new types in one file |
| `ai/src/modder/pipeline.ts` | 1,321 lines, 30 lines over 200 characters | one `Modder` class does the queue and lanes, the router, creating and drawing, the judges after shipping, faults, revisions, escalation, reflection and the drafter |
| `Modder.work` | 296 lines, one method | the design loop: route, create, fix, verify, audit, review and commit as one `for (;;)` with `continue`s |
| `ai/src/modder/prompts.ts` | 461 lines | every prompt of every stage |

A reader who wants to know "what happens to a request" has to read `work` whole. One who wants to change
the auditor has to find its prompt in `prompts.ts`, its call in `pipeline.ts` and its judge in `audit.ts`.

## 2. Rules for the move

- **No behaviour changes.** Every step only moves code and renames files; the whole suite (about 1,700 tests)
  and `npm run typecheck` must pass unchanged at every step. Behaviour changes go in their own PRs.
- **Public names stay.** `@openworld/engine` and `@openworld/ai` export what they export now (index files
  re-export from the new places).
- **One step, one PR**, each small enough to review in one sitting. Each is merged before the next starts.
- **Coordinate.** A move conflicts with every open PR that touches the moved file. Before each step: list the
  open PRs touching it, merge or rebase them first, and announce the step's window.

## 3. The steps

### Step 1: `engine/src/mod.ts` into `engine/src/mod/`

The file already has sections (`// ------ contract`, `the wire`, `the ModSpec`, `the port`, `building
requests`, `validation`, `the base library's own check`, `ties`, `new types`). Each becomes a file:

```
engine/src/mod/
  contract.ts   Patch, Artifact, ModRequest, ModSpec types, ResolveBody, ResolveReply, PatchLogEntry, ValidationResult
  spec.ts       buildModSpec
  port.ts       ModPort, placePatch, restoreLibrary, alreadyHeld
  request.ts    buildRequest, buildScenario, summarize, worldLine, attemptLine, signatureOf, classKey
  validate.ts   validatePatch, the base library's own check
  ties.ts       hostsOverlap, rulesTie
  types.ts      newTypeProblems, newStatusProblems, namesClash, artProblems, closestTypes
  index.ts      re-exports (engine/src/index.ts imports from here)
```

Risk: low; mechanical. The largest piece, `validatePatch` (about 470 lines), stays one function for now.

### Step 2: `ai/src/modder` into files by stage

**Not taken (2026-10-26).** Fewer, whole files were chosen over more of them: the prompts stay one file, the
`Modder` class one file, and the modder's small files were merged instead (`request.ts`, `answer.ts`). What
follows is the plan as it was.

Step 0 put the judges in `checks/`, the library in `library/` and the service in `service/`. What is left is
the `Modder` class and the prompts:

```
ai/src/modder/
  pipeline/   modder.ts (the Modder class: queue, lanes, resolve, episodes), design.ts (the work loop),
              create.ts (createThing, draft, adopt), draw.ts (pictures), after.ts (what runs after shipping:
              review, audit, escalation, reflection), repo-episode.ts
  prompts/    one file per stage: design.ts, router.ts, art.ts, thing.ts, draft.ts, audit.ts, review.ts, reflect.ts
```

Splitting `Modder` across files: the methods that are one stage (`createThing`, `draft`, `adopt`; `drawAll`,
`drawOne`, `draw`; `afterwards`, `audit`, `reflect`; `repoEpisode`) move to functions that take the modder's
state as an argument; the class keeps the queue, the lanes and `resolve`. Risk: medium; the class's private
state has to be passed explicitly, which is also what makes it readable.

### Step 3: the design loop as named stages

`Modder.work` becomes a loop over named stages, each a function of one context object (the request, the
library workspace, the messages, the attempts, the stage reached) that returns what happens next: ask the
model again with a message, go to another stage, ship, or fail. The stages are the ones the file's header
already names: route (local, find, create), fix, verify, audit, review, commit.

This is the one step that rewrites code rather than moving it. It needs, besides the suite, the backend smoke
run (a new thing with its pictures, a live answer audited after shipping, an offline answer with a blocking
audit and review) on all three backends before and after, with the same outcomes. Risk: medium to high; it
is the heart of the modder, so it goes last among the modder steps and alone in its PR.

### Step 4: the model backends apart from the self-improving agent

Done in step 0: `ai/src/models/` (backends) and `ai/src/agent/` (the agent and its self-state). Moving the
backends to a package of their own (`packages/models`) is possible later.

### Step 5: long lines

Wrap the lines over 200 characters in the moved files as each step touches them (about 200 in all), by
hand, keeping the repository's style. A formatter is a separate decision: the repository has none, and
introducing one reformats every file.

## 4. Order and size

| Step | What | Risk | Size of the diff |
|---|---|---|---|
| 0 | one `packages/ai`, by domain; the game plays without it | low | moves (done) |
| 1 | `mod.ts` into `mod/` | low | moves only |
| 2 | `ai/src/modder` into files by stage | medium | moves, `Modder` split into files |
| 3 | `work` as named stages | medium to high | rewrite of one method, behaviour kept |
| 5 | long lines | low | as each step touches a file |

Step 1 can go any time; step 3 waits for step 2.

## 5. Questions for the team

1. Is the layout of step 2 the one we want, or should the judges live with the engine's validator?
2. When is a quiet window for steps 2 and 3 (the modder files most PRs touch)?
