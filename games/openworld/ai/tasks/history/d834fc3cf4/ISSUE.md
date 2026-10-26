# Modder service: shared rule library, tool-using patch design, and a self-state

## What is wanted

Today an undefined interaction waits for a person to write a patch by hand. We want a model-agnostic **modder** service that writes the patch automatically, plus the client and engine support to use it.

The service lives in a new package, `packages/modder`. Given an undefined-interaction request, it does the following:

- Recalls what it has learned before.
- Designs a patch with tools, then validates it and repairs it if needed.
- Has the patch reviewed.
- Commits the patch to a **shared rule library** kept as an append-only patch log.
- Records what happened.
- Reflects on the episode.

It keeps a persistent **self-state**: episodes, lessons, skills, a harness (its tunable settings), a journal, snapshots, and an export.

The client's worker uses the service when one answers, syncs the shared library, and shows player-facing toasts. The engine's Mod port gets an idempotent `submit` and a configurable timeout. An offline tool builds a curriculum from the coverage sweep.

Separately, fix a crash when the music crossfades on quick consecutive map changes.

## Expected behaviour

**Model abstraction**
- A `Model` has `chat(messages, opts)`. Messages are system/user/assistant (optionally with tool calls)/tool messages. Options are `tools`, `json`, `temperature` and `purpose` (`design | review | reflect`). A reply is `{content, toolCalls, usage?}`.
- An OpenAI-compatible adapter (`OpenAICompatModel`) posts to `<baseUrl>/chat/completions`.
  - Tools are sent as function tools.
  - Tool calls and tool results are carried in the OpenAI wire format.
  - Token usage is reported.
  - A reply wrapped in a ```json fence is still parsed.
- A `ScriptedModel` answers from code (a `Script` function). A script file is also supported: entries are tried in order, the first whose `purpose` and `contains` match answers, and an unmatched call answers `{}`, meaning "no patch". Plain strings and objects returned by a script are accepted.

**Pipeline (`Modder.resolve({request, workspace?})` → `ResolveReply`)**
- The design stage may call tools (for example `search_rules`, `get_type`, `dry_run`, `read_skill`). Each call is recorded on the episode.
- A valid patch is committed to the shared library and the outcome is `accepted`. The reply carries the patch and the episode id. The committed rules have `source.author` `'modder'`.
- A rejected draft is repaired: the validator's diagnostics are shown to the model verbatim in a follow-up user turn containing the word "rejected". The harness limits repair rounds, and the default allows several.
  - When the budget is spent, the outcome is `failed`, `patch` is `null`, diagnostics are returned, and the library is untouched.
  - Each attempt is recorded with its phase (`design`, `repair`, `review`) and its errors.
- The reviewer returns `ship` or `revise` with notes. The harness allows one review round by default. A `revise` verdict sends the notes back for a revised draft, and that revision ships unreviewed. The attempt records the review verdict.
- If the shared library already answers the interaction, the outcome is `covered`, no model is called, and the patch that added the answering rule is returned. This works for a different member of the same class (for example another slime). A base rule that the client lacks does not count as covered.
- Without a model, a covered request is still answered. Anything else returns `unavailable`.
- Two concurrent identical requests (same interaction class) are worked once: one is `accepted` and the other `covered`, with a single episode's worth of model calls.
- After an episode, reflection may add lessons (text plus terms such as `verb:interact` and `instrument#fiber`) and may write a skill.
  - A skill is written only once similar work has recurred, controlled by the harness's `skillMinRecurrence`.
  - Skills are offered to later design turns, can be read by name, and have uses and accepted counts booked against them.
  - A skill is revised after use, which bumps its version.
  - `modder.settled()` resolves when background reflection has finished.
- Episode usage counts model calls, input tokens and output tokens. The episode also records the model name, outcome, tools, attempts and `skillsRead`.

**Shared library (`WorldLibrary`)**
- It is built from the ontology, the base rules and an optional log file, with one JSON line per patch or removal.
- Reopening the file rebuilds the same library and the same regression set. A torn last line is skipped.
- Each log entry has a `seq`, a timestamp and either a patch (with its rule ids, the request id and the triggering scenario) or a removal. A removal rolls back a patch rule only.
- The accepted patch's triggering scenario is kept server-side as a regression that later patches must keep answered. A removal drops the regression entries for that rule.
- Clients receive the log without the scenarios.
- Validation uses the shared library plus the client's workspace: its local patch rules, types and statuses, and its regression set. Committing validates and appends atomically.

**Self-state (`SelfState`)**
- It persists to a directory: memory (lessons as JSON and markdown), skills (`skills/<name>/SKILL.md` with front matter beginning `---\nname: <name>`), a harness with a version and a `CHANGELOG.md`, and `journal.jsonl`.
  - Journal entries have a `kind`, such as `lesson.add`.
  - A harness change takes a reason. The version starts at 1 and increments with each change, and the reason is appended to the changelog.
- `stats()` includes at least `episodes`, `covered` and `accepted`.
- `snapshot(label)` freezes the state under `snapshots/<label>`.
  - The snapshot contains `memory/lessons.json`, `meta.json` (with `stats`) and `SELF.md`.
  - It returns the snapshot's directory.
  - It throws if the label already exists.
- `render()` produces the single transferable document.

**Signature**
- `signatureOf(request)` gives `{key, terms}`. The same interaction class always gives the same key, different classes give different keys, and an instrument tag shows up as a term like `instrument#fiber`.

**HTTP service (`createModderServer(modder)`)**
- It returns a Node `http.Server`.
- `GET /health` returns `{ok, model, library:{seq,…}}`.
- `POST /resolve` takes a `ResolveBody` and returns a `ResolveReply`.
- `GET /patches?since=N` returns `{seq, entries}` with entries after N.

**CLI (`npm run modder -- <cmd>`)**
- Commands are `serve [port]`, `stats`, `snapshot <label>`, `export [label]`, `library`, `library remove <rule-id>`.
- Options are `--data <dir>`/`$LSW_DATA` and `--script <file>`/`LSW_MODEL_SCRIPT`.
- Env-based model config is `LSW_MODEL_URL`/`LSW_MODEL_KEY`/`LSW_MODEL`.
- An offline fixture scripts a "rope binds creatures" patch. Add launch configurations for `modder` and `modder-offline`, an `npm run curriculum` script, and include the modder package in `typecheck`.

**Engine Mod port**
- `ModPort.timeoutTicks` sets how long an interaction waits for a patch before falling back. It defaults to the current timeout. A late patch still applies.
- `submit` is idempotent. If every artifact in a patch is already held verbatim in the library (provenance aside), the submit returns `ok: true` with the warning `'already in the library'` and does not re-validate.
  - If the record is not yet patched, it is marked patched, a `patched` effect is emitted, and the event is re-queued if it is now defined.
  - A patch with some already-held artifacts has those artifacts dropped, and the rest is validated as usual.
- A rejected `submit` that carries an id for a record that is no longer pending must not trigger the fallback again.
- New wire types describe the client↔service exchange: a workspace, the resolve body and reply, and the patch-log entry.

**Client**
- The worker takes an optional modder URL from `init` (page parameter `?modder=<url>`, `off` to disable, else `VITE_MODDER_URL`, else `http://localhost:8787` in dev).
  - It probes `/health` with a short timeout.
  - If the service answers, it installs the remote provider, uses a 45 s interaction timeout, reports `{t:'modder', online, url, model}`, and syncs the patch log immediately and every 15 s.
  - If the service does not answer, it reports offline.
- Synced patches go through the local `submit` (so through the engine's validator), and removals only remove patch-origin rules.
- The HUD shows a modder status chip in the mods panel.
- With a modder online, an undefined interaction shows a "the world is working it out" toast. The matching "learned something new" toast, shown on a patch, includes the rule's doc. Without a modder, the old toasts remain.

**Tools**
- Add an offline curriculum generator over the coverage sweep (`npm run curriculum`).

**Music fix**
- When the track changes again while a previous crossfade is still running, the old track's tweens are stopped. The old track is faded out only if it is playing, and otherwise destroyed immediately, with no crash.

## Requirements

- Every patch from a model, from sync, or by hand goes through the validator before it changes a library.
- The library's patch log is append-only. A rollback adds a removal entry rather than editing history.
- A reopened library file reproduces the same rules and regression set.
- A covered request never calls the model.
- Concurrent equal-class requests produce a single design episode.
- Harness limits (repair rounds, review rounds, reflection and skill thresholds) are honoured and can be changed, with each change versioned and logged.
- With no model configured, the service still answers from the library and reports `unavailable` otherwise.
- The default Mod port timeout is unchanged for clients without a modder.
- `submit` of a patch already in the library is a harmless no-op, whether the patch arrives by sync or by reply.
- Changing the music quickly across maps no longer throws.
- Typecheck covers the new package.

## Interface

New package `@lsw/modder` (`packages/modder`, `main: src/index.ts`) re-exporting `model`, `signature`, `library`, `state`, `tools`, `prompts`, `pipeline`, `server` and `open`.

**`model.ts`**
- Types: `ToolSpec {name, description, parameters}`, `ToolCall {id, name, args}`, `ChatMessage`, `ChatOptions {tools?, json?, temperature?, purpose?}`, `ModelReply {content, toolCalls, usage?: {input, output}}`, `Model {readonly name; chat(messages, opts?): Promise<ModelReply>}`.
- `OpenAIConfig {baseUrl, apiKey, model, timeoutMs?, extraBody?}`.
- `class OpenAICompatModel implements Model` — `constructor(cfg: OpenAIConfig)`.
- `type Script = (messages, opts, call: number) => ModelReply | string | object | Promise<…>`.
- `class ScriptedModel implements Model` — `constructor(script: Script, name = 'scripted')`, with a `calls` counter.
- `interface ScriptEntry {purpose?, contains?, reply}`; `scriptFromFile(path): ScriptedModel`.
- `parseJson(text): unknown`.
- `class Meter implements Model` — wraps a model and counts calls and tokens.
- An environment-based model constructor (`LSW_MODEL_SCRIPT`, `LSW_MODEL_URL`, `LSW_MODEL_KEY`, `LSW_MODEL`).

**`signature.ts`**
- `signatureOf(req: ModRequest): { key: string; terms: string[]; … }`.

**`library.ts`**
- `class WorldLibrary` — `constructor(ontology: Ontology, base: Rule[], file?: string)`.
  - Fields: `lib: RuleLibrary`, `log: PatchLogEntry[]`, `regression: {scenario, rule}[]`, `seq` (getter).
  - Methods: `since(seq)`, `patchRules()`, `workspace(ws?)`, `spec(ws?)`, `fullOntology()`, `covering(req)`, `validate(patch, req?, ws?)`, `commit(patch, req?, ws?, now?) → CommitResult`, `remove(ruleId, now?) → boolean`.
- `CommitResult {ok, result, rules, seq?}`.

**`state.ts`**
- `class SelfState` — `static open(dir)`.
  - Property: `dir`.
  - Methods: `episode(id)`, `lessons()`, `skills()`, `skill(name)`, `harness()`, `setHarness(h, reason)`, `stats()`, `snapshots()`, `snapshot(label, extra?) → string`, `render() → string`.
  - Harness shape: `repair: {maxRounds}`, `reflect: {enabled, skillMinRecurrence}`, `version`.
  - Episode shape: `id`, `outcome`, `model`, `tools[{name}]`, `attempts[{phase, errors, review?}]`, `usage {calls, input, output}`, `skillsRead`.
  - Lesson shape: `text`, `terms`, `episodes`.
  - Skill shape: `name`, `description`, `triggers`, `body`, `version`, `uses`, `accepted`.

**`pipeline.ts`**
- `class Modder` — `constructor({library, state, model?, log?})`, exposing `opts`, `model`.
  - Methods: `resolve(body: ResolveBody): Promise<ResolveReply>`, `settled(): Promise<void>`.

**`server.ts`**
- `createModderServer(modder): http.Server`.

**`open.ts`**
- `REPO`, `openModder({data?, model?, log?})` returning a `Modder`.

**`tools.ts` / `prompts.ts`**
- Design-time tools (`search_rules`, `get_type`, `dry_run`, `read_skill`, …) and the stage prompts. No names are required beyond the tool names above.

**CLI and fixtures**
- `src/cli.ts` and `fixtures/offline.json`.

**`@lsw/engine` (`mod.ts`)**
- `interface ModWorkspace {patches?: {rules: Rule[]; types?: TypeDef[]; statuses?: StatusDef[]}; regression?: {scenario, rule}[]}`.
- `interface ResolveBody {request: ModRequest; workspace?: ModWorkspace}`.
- `interface ResolveReply {patch: Patch | null; outcome: 'accepted' | 'covered' | 'failed' | 'unavailable'; episode?: string; diagnostics?: string[]}`.
- `type PatchLogEntry = {seq, at, patch, rules, request?, scenario?} | {seq, at, remove}`.
- `ModPort.timeoutTicks: number`.
- `alreadyHeld(lib: RuleLibrary, a: Artifact): boolean`.

**Client**
- `ToWorker` `init` gains `modder?: string`; `FromWorker` gains `{t:'modder'; online; url?; model?}`.
- `Hud.modder` and `Hud.setModder(m)`.

**Tools**
- `packages/tools/src/curriculum.ts`, with the `curriculum` npm script. Its exports are covered by a tools test and follow the coverage sweep's output.
