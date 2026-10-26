# Cut redundant world scans, repeated patch validation and wasted prompt content

## What is wanted

The engine and the modder do work every tick or every request that could be skipped without changing any result. Reduce it in these places, keeping all game outcomes the same:

1. **Rooms.** Room shapes are recomputed whenever anything anywhere changes the shape of a cell. Make invalidation per map, and skip scanning altogether for maps that cannot have rooms.
2. **Companions.** Each tick the behaviour step scans every entity to find companions that are away from the active map. Look them up through an index instead.
3. **Validation.** `WorldLibrary.validate` re-runs full validation for an identical patch (for example, validate followed by commit), and again in full when the only change is more tests on a rule. Keep proofs and reuse them where it is sound.
4. **Reflection.** Clean live episodes that went through the find or create route are reflected on one at a time. They should batch the way clean local ones do.
5. **Prompts.** Cached prefix, duplicated brief content and tool mentions when no tools exist.
6. **Test helpers.** HTTP test helpers wait forever on a listen error.

## Expected behaviour

**Rooms**
- An outdoor map (light defaults to outdoor) with nothing in an upper storey (z > 0) that can cover a cell (a floor or volume space) has no rooms. `roomsOf` returns `[]` without scanning cells with `entitiesAt` or `occupant`.
- Building, moving, transforming, destroying or loading such an upper-storey thing on a map makes that map's rooms found again, and the result is correct each time (rooms appear and disappear accordingly).
- A change to cell shape on one map (an entity created, destroyed or transformed there) does not invalidate another map's cached shapes.
- A static cell thing that materialises (for example, a status set on a floor cell) is not a change of shape; shapes stay cached and no rescan happens. Room roles (for example a bed makes a bedroom) are still read fresh on each call without rebuilding shapes.
- A map added later through a chunk load is indexed for this purpose too, and `reindex` resets all of this state.

**Companions**
- The world keeps an index of entity ids whose `companion` prop is a string, in the state's entity order. The index follows creation, `setProp` on `companion` (set, changed, or removed), destruction, and removal of cell things, and is rebuilt on `reindex`. If a prop is set on an old entity, the entity order is still the state's order, not the order of setting.
- The per-tick behaviour step uses this index to find companions that are not on the active map's tiles, rather than enumerating all entities. Turn order is unchanged.

**Validation**
- Calling `validate` and then `commit` with the same patch, request and workspace performs one full validation. The patch's own record metadata (such as `trigger`) does not matter. The caller mutating a returned result must not affect the stored proof.
- A proof is valid only for the same library version and the same contents of: the library's rules, types, statuses, the ontology, the workspace, the regression set, the request's scenario, the replaced-rule list, and the candidate patch (excluding rule tests). Changing any of these makes the next validation run fully, and then that result is reused.
- If the only change is that rules have gained extra tests (the earlier tests are unchanged, in the same positions), only the added tests are replayed. The result (errors, warnings, ok) must equal what full validation would give, including dropping the "no tests" warning when a rule now has tests and reporting failing expectations.
- Only successful validations are kept as proofs, and the number kept is bounded.
- A proof made for a client workspace is not used for a shared (no workspace) commit. Commits after other commits, removals or revisions that changed the shared library re-validate.
- Both branches of the repeat check (exact repeat; tests added) must remain.

**Reflection**
- A live episode counts as clean if it is accepted, not a revision or escalation, has no flags, and every attempt has no errors, no fixes, no review, and a phase of design, find or create. Four clean episodes via the find route, or via the create route, produce a single reflection after the fourth. Episodes that had repairs, fixes or flags are reflected on immediately.

**Prompts**
- The design system prompt's static part, up to and including the ModSpec, stays byte-identical whatever the working notes (addenda), client or library version. The addenda follow the ModSpec, introduced by `Your own working notes:`.
- In the brief, each related rule appears once: the closest ones in full (as format examples), the rest in compact form. The compact list must not repeat the rules shown in full.
- When the design runs without tools (the router/live profile), the user turn and brief do not mention `read_skill`, `get_episode` or `search_rules`.

**Test helpers**
- Helpers that wait for an HTTP server to listen reject at once on a listen error, and remove their listeners afterwards.

## Requirements

- Game results are unchanged: the same final state hashes on existing scenarios.
- Room invalidation is per map; the upper-storey cover count is kept per map and stays correct through create, destroy, place, transform and load.
- A static cell materialising does not count as a shape change.
- The companion index is kept by the world's mutators and is in state entity order.
- Validation proofs are keyed by library version and the contents listed above, bounded in number, and store only successes. Results are copied in and out.
- Adding only tests replays only the new tests, with identical diagnostics to full validation.
- Clean live find/create episodes batch as described; flagged/repaired ones do not.
- Prompt changes as above, with the system prefix stable across addenda.
- Test helpers for listening fail on error.
- Yield sweep tests preview on the template world and build an `Engine` only for real runs.

## Interface

- `World.companionIds: Set<Id>` in `packages/engine/src/world.ts`: public, the ids of entities whose `companion` prop is a string, in state entity order.
- `briefOf(req: ModRequest, lib: RuleLibrary, onto: Ontology, tools?: boolean): string` in `packages/modder/src/brief.ts`: `tools` defaults to `true`; when `false`, the "more" line does not mention `search_rules`.
- `designUser(req, recall, brief?, added?, tools?: boolean): string` in `packages/modder/src/prompts.ts`: `tools` defaults to `true`; when `false`, the skills and similar-episodes headings do not mention `read_skill` or `get_episode`.
- `briefOf` and `relatedRules` must be importable from the modder package index (`../src/index.ts`).
