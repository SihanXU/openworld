# Cut the tokens and calls the modder spends per hole: stable system prompt, slimmer request, gated reviews, batched reflection

## What is wanted

The modder's model calls per hole cost too much. Four changes:

1. **A cacheable design system prompt.** It should be byte-for-byte identical for every request, every client and every library version, so a provider's prompt cache serves the large ModSpec prefix. Today the ModSpec carries the library version and is built from the base ontology plus the types and statuses patches added. Every accepted patch, and every client with its own additions, changes the system prompt and misses the cache.
2. **A slimmer user turn.** The request JSON the model reads should leave out the scenario, because the harness replays it. When a brief is given, it should also leave out the rules the request carries, because the brief already lists them. Types and statuses that patches added (shared, or a client's own workspace) must still reach the model, so they move into the user turn.
3. **Fewer live reviews.** A review after the fact for a live rule should run only when the harness flagged the rule (it only narrates, or did not generalize). A harness setting brings back the review of every live rule.
4. **Batched reflection.** Live episodes that went cleanly should be reflected on together, several per call, instead of one call each. Episodes that did not go cleanly are reflected on at once, as today. Lessons from a batch cite every episode in it.

## Expected behaviour

**System prompt**
- The ModSpec version string no longer contains `lib@<version>`. It is just `lsw-modspec/2`.
- The design system prompt is built from the base ontology only. Two requests, one made after the shared library has grown and from a client whose workspace adds a status, get exactly the same system prompt as the first request.
- The system prompt contains no `lib@`.
- `buildModSpec` can still be called with a library, in which case the types and statuses it adds are included. The library argument is optional.

**User turn**
- The JSON request in the user turn has no `"scenario"` key.
- When a brief is given, the request's `context.rules` is serialized as an empty list (`"rules":[]`). Without a brief the rules stay.
- When the library or workspace has types or statuses beyond the base ontology, the user turn has a section headed `# Types and statuses added by patches` that lists each type (id, kind, tags, name) and each status (id, duration, immobilize, moveDelay, clears). With none, there is no such section.

**Reviews after the fact**
- A live episode that was accepted with nothing flagged gets no review after the fact by default.
- A live episode with flags still gets one.
- With the harness option `review.unflagged` set to true (and `blocking` false), every accepted live rule is reviewed after the fact, as before. The default is false.

**Batched reflection**
- The harness option `reflect.batch` defaults to 4.
- A live episode counts as clean when it was accepted at its first attempt, nothing was flagged, it is not a revision, and it is not an escalation. Clean live episodes are held until `batch` of them have accumulated. Then one reflection call covers all of them. Before that, no reflection call happens for them.
- With a batch of 4 and four clean live episodes in turn, the first three produce no reflect call and the fourth produces exactly one.
- The batched reflection prompt starts with a heading of the form `# 4 episodes, each accepted at its first answer (reflect on them together)`, then the shared signature terms, then each episode's section, then the lessons on file, skills and similar episodes once.
- A lesson added by a batched reflection lists every episode of the batch, in order. A lesson revised or supported cites each batch episode it does not already cite.
- A single-episode reflection prompt reads as before.
- Every other episode (failed, repaired, flagged, revised, escalated, offline) is reflected on at once, as before. A batch size of 1 or less turns batching off.
- Episodes with outcome `covered` are skipped.

## Requirements

- The design system prompt is identical across requests, clients and library versions.
- No `lib@` in the ModSpec version.
- The user turn omits the scenario, and omits the rules when a brief is given.
- Patch-added types and statuses appear in the user turn, not the system prompt.
- Review after the fact runs only for flagged live rules unless `review.unflagged` is true.
- Clean live episodes are reflected on in batches of `reflect.batch` (default 4), one call per batch.
- Lessons from a batch cite every episode in it, with no duplicate citations.
- Non-clean episodes are reflected on immediately, one per call.
- Existing harnesses without the new fields still work, treating `unflagged` as false and `batch` as unset (no batching).

## Interface

- `buildModSpec(onto: Ontology, lib?: Pick<RuleLibrary, 'types' | 'statuses'>): ModSpec` in `packages/engine/src/mod.ts`. The library is now optional; the version is `'lsw-modspec/2'`.
- `Harness.review.unflagged?: boolean` in `packages/agent/src/state.ts`, default `false` in `DEFAULT_HARNESS`.
- `Harness.reflect.batch?: number` in `packages/agent/src/state.ts`, default `4` in `DEFAULT_HARNESS`.
- `SelfState.applyLessons(ops, episode: string | string[], defaultTerms: string[]): string[]` in `packages/agent/src/state.ts`. `episode` may now be a list of episode ids, each of which is cited.
- `requestView(req: ModRequest, brief: boolean): Omit<ModRequest, 'scenario'>` in `packages/modder/src/prompts.ts`.
- `designUser(req, recall, brief?, added?: { types: TypeDef[]; statuses: StatusDef[] }): string` in `packages/modder/src/prompts.ts`. The new fourth argument carries patch-added types and statuses.
- `reflectUser(eps: Episode | Episode[], coarse, lessons, skills, similar): string` in `packages/modder/src/prompts.ts`. It accepts one episode or several.
