# The AI code laid out by concern: a proposal

Status: proposed 2026-10-26, not agreed. Nothing here is done until the team agrees on it. The map of the AI
side as it is now is [ai.md](ai.md).

## 1. Why

The AI side already has its own packages (`modder`, `agent`), and the dependency direction holds (the engine
imports neither; `boundaries.test.ts`). What makes it hard to read is inside them:

| Where | Size now | Why it is hard to read |
|---|---|---|
| `engine/src/mod.ts` | 2,044 lines, 66 lines over 200 characters | the contract, the ModSpec, the port, request building, the validator and the checks of new types in one file |
| `modder/src/pipeline.ts` | 1,321 lines, 30 lines over 200 characters | one `Modder` class does the queue and lanes, the router, creating and drawing, the judges after shipping, faults, revisions, escalation, reflection and the drafter |
| `Modder.work` | 296 lines, one method | the design loop: route, create, fix, verify, audit, review and commit as one `for (;;)` with `continue`s |
| `modder/src/` | 24 files in one folder | the pipeline, the judges, the shared library, the service and the repo agent side by side |
| `modder/src/prompts.ts` | 461 lines | every prompt of every stage |
| `packages/agent` | 3,413 lines | the model backends (used by the game, the editor and the browser) and the self-improving agent (a research system) in one package |

A reader who wants to know "what happens to a request" has to read `work` whole. One who wants to change
the auditor has to find its prompt in `prompts.ts`, its call in `pipeline.ts` and its judge in `audit.ts`.

## 2. Rules for the move

- **No behaviour changes.** Every step only moves code and renames files; the whole suite (about 1,700 tests)
  and `npm run typecheck` must pass unchanged at every step. Behaviour changes go in their own PRs.
- **Public names stay.** `@openworld/engine`, `@openworld/modder` and `@openworld/agent` export what they
  export now (index files re-export from the new places), so games, tools and the editor need no edits
  except deep imports (`@openworld/agent/src/core.ts` and similar, 14 of them).
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

### Step 2: `modder/src` into folders by concern

```
modder/src/
  pipeline/   modder.ts (the Modder class: queue, lanes, resolve, episodes), design.ts (the work loop),
              create.ts (createThing, draft, adopt), draw.ts (pictures), after.ts (what runs after shipping:
              review, audit, escalation, reflection), repo-episode.ts
  judge/      economy.ts, audit.ts, derive.ts, fixes.ts, affordance.ts, detect.ts, quality.ts
  library/    library.ts, library-file.ts, promote.ts, signature.ts
  prompts/    one file per stage: design.ts, router.ts, art.ts, thing.ts, draft.ts, audit.ts, review.ts, reflect.ts
  service/    server.ts, cli.ts, open.ts, offline.ts, repo.ts, validate-cli.ts
  brief.ts, tools.ts, drafts.ts
  index.ts, browser.ts   (the package's two entries stay where they are)
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

Inside `packages/agent`, two folders with an entry each:

```
agent/src/models/   model.ts, model-node.ts, anthropic.ts, providers.ts, providerList.ts, Meter, parseJson
agent/src/rsi/      state.ts, files.ts, files-node.ts, loop.ts, reflect.ts, outer.ts, presets.ts, tools.ts, env.ts, swe.ts, cli.ts
```

`core.ts` (what runs in a browser) keeps exporting the same names. Moving the backends to a package of their
own (`packages/models`) is possible later; the folder split gets most of the clarity for a fraction of the
churn. Risk: low.

### Step 5: long lines

Wrap the lines over 200 characters in the moved files as each step touches them (about 200 in all), by
hand, keeping the repository's style. A formatter is a separate decision: the repository has none, and
introducing one reformats every file.

## 4. Order and size

| Step | What | Risk | Size of the diff |
|---|---|---|---|
| 1 | `mod.ts` into `mod/` | low | moves only |
| 4 | `agent` into `models/` and `rsi/` | low | moves, 14 deep imports |
| 2 | `modder/src` into folders | medium | moves, `Modder` split into files |
| 3 | `work` as named stages | medium to high | rewrite of one method, behaviour kept |
| 5 | long lines | low | as each step touches a file |

Steps 1 and 4 can go first, in either order; step 3 waits for step 2.

## 5. Questions for the team

1. Is the layout of step 2 the one we want, or should the judges live with the engine's validator?
2. Step 4: folders inside `agent` now, or a `packages/models` package straight away?
3. When is a quiet window for steps 2 and 3 (the modder files most PRs touch)?
