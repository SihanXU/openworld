# Modder pipeline checks can be skipped, pass vacuously, or disagree between copies

## What is wrong

An audit of the modder pipeline found five places where a check can be skipped, can pass without checking anything, or where two copies of one rule disagree.

1. **Two class keys.** The engine's port and the modder service each compute "one question per hole and class" on their own. The service includes the host's statuses. The engine counts the resident roles. The same request can therefore get different keys on the two sides.
2. **Review with no verdict becomes `ship`.** If the reviewer's reply has no readable verdict, it is treated as `ship`. In blocking mode, a patch then ships unreviewed. A verdict written in capitals (e.g. `REVISE`) is also not read as what it says.
3. **Vacuous derived tests.** When a rule's effects are only props, moves or narration, the derived test gets an empty expectation list. That passes trivially and is counted as "generalizes", although nothing was checked.
4. **Create before find.** A `create` answered at the local stage skips the catalogue, and the episode's recorded route claims a find that never happened. The closest-type matching is plain word overlap, so "Sticks" does not match "stick", and Chinese names are ignored. The duplicate check on new types has the same gaps.
5. **Synced and restored patches go unchecked.**
   - The service strips the scene from the patch log it sends to clients. A patch from the shared library, or a prefetched one, is therefore submitted with no scene: no sandbox replay and no repeat/endless-yield check runs.
   - Patch rules restored from a saved library are re-added with no validation.

## Expected behaviour

**Class key**
- The engine exposes one definition of the class of an undefined outcome. It is built from: the hole (rule plus branch path), the event kind, the host's type, the other roles' types, and the branching params.
- A role that is the host itself counts as `self`.
- The actor and source roles are left out. Resident roles are left out. Host statuses are left out.
- The client's port and the modder service both key by this definition. On real requests they give identical keys.

**Review**
- A reply with no readable verdict is asked once more.
- If the second reply also has none, the review is recorded as verdict `error` with no notes. It is never recorded as `ship`.
- Verdicts are read case-insensitively and with surrounding whitespace trimmed. `REVISE` means revise.

**Derived tests**
- There is a new expectation, `{resolvedBy: ruleId}`, which passes only if the event was answered by that rule. Every derived test includes it.
- A numeric prop that went up or down is recorded by direction: `propGt` if it rose, `propLt` if it fell. The comparison point is the value the instance had before. A prop the entity did not have counts from 0.
- When a derived test is generalized to another host, numbers are compared by direction only, because their starting values differ per instance.
- A rule whose derived test can only check that it answers (nothing else observable) says so in the notes. For example, a rule that only logs text gets exactly `[{resolvedBy: <rule id>}]` and a note containing "checks only that the rule answers".
- Rule-level tests (in validation and in the library's regression runs) are evaluated with the resolution available, so `resolvedBy` works there.

**Find before create**
- If a creation's name is close to things already in the catalogue, the episode goes through find first. The route is `['local', 'find']` and the find prompt lists the proposed name with the close existing types. If find answers with a patch using an existing type, no new type is created.
- The route records only what actually happened.
- Matching and the duplicate check treat singular and plural as the same (sticks = stick, berries = berry, boxes = box). They also compare Chinese names.
- A new type is refused with a message containing "already is this thing" when it matches an existing type by any of these:
  - the same leaf of the id, in either number (`item/material/sticks` vs `item/material/stick`);
  - the same English name;
  - the same Chinese name.
- A type with a genuinely different name in both languages is not refused for this reason.
- Closest-type lookup puts a same-name match (either language, either number) first.

**Replayed sync**
- Each entry in the patch log that clients receive carries the scene it answered.
- A client submitting a free-standing patch (shared library, prefetch) can pass the scene it came with, and the patch is checked there. A patch that would be an endless yield in that scene is refused with the usual "endless yield" error.
- A request's own scene takes precedence over a passed one.
- When a saved library is loaded, each patch rule is validated again. Base rules come fresh from content. Types and statuses are restored as before. A rule that no longer validates is left out and reported through an optional callback with its id and the first reason. Rules already present, and non-patch rules, are skipped as before. The log and version are restored as before. The client worker uses this restore path and passes the world's protected facts.

## Requirements

- One class-key definition lives in the engine and is used by the engine's signature and the modder's signature, so the same request yields the same key on both sides.
- Resident roles and host statuses must not affect the key. Branching params must.
- A review without a verdict is retried exactly once, then recorded as `error`. It must never be treated as `ship`.
- `resolvedBy` is a valid expectation in patches, validation, the modder-spec description of expectations, and the service's regression runs.
- Every derived test includes `resolvedBy` for its rule. Numeric changes are recorded as `propGt` / `propLt` by direction.
- Derived tests generalize on direction, not on exact starting numbers.
- A creation with a close catalogue match goes through find, and the recorded route matches what happened.
- Duplicate detection and closest-type matching handle singular/plural and Chinese names.
- The service's patch log keeps the scene on each entry. Clients replay synced and prefetched patches in that scene, including the repeat check.
- Saved library patch rules are validated again on load, and invalid ones are dropped with a report.
- Existing behaviour stays the same where not mentioned.

## Interface

In `@lsw/engine`:

- `restoreLibrary(base: Rule[], saved: LibraryData | undefined, ontology: Ontology, protectedFacts?: string[], dropped?: (id: string, why: string) => void): RuleLibrary`
  - Builds a library from base rules, then restores the saved types, statuses and patch rules (each validated), log and version.
- `classKey(c: { hole: string; kind: string; host: string; roles: [string, string][]; params?: Record<string, unknown> }): string`
  - The single class-key definition.
- `holeKey(rule: string, path: string[]): string`
  - A hole as a key: the rule id, plus the branch path when there is one.
- `BRANCHING_PARAMS: string[]`
  - The params whose value is part of an outcome's class.
- `ModPort.submit(id: string | undefined, patch: Patch, scenario?: Scenario): ValidationResult`
  - Adds the optional third argument.
- `Expectation` gains the variant `{ resolvedBy: string }`.
- `checkExpectations(eng: Engine, exps: Expectation[], res?: Resolution): string[]`
  - Adds the optional resolution argument, which `resolvedBy` reads.
- `closestTypes(name: string, onto: Ontology, n?: number, zh?: string): string[]`
  - Adds the optional Chinese-name argument.

In the modder package: no new exported names. The patch log entries returned by `WorldLibrary.since` and the service's `/patches` endpoint keep their `scenario` field instead of having it cleared.
