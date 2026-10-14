# Review fixes: saves taken mid-request, ties within a patch, a shared log that stands alone, and other engine/modder robustness gaps

## What is wrong

A review of the engine and the modder found several defects.

1. **A save taken while the modder was working freezes the player for good.** The participants' `frozenBy` marker is saved, but the request that would release them is not. After loading, nothing answers that request, so the player can never move again.
2. **Ties inside one patch pass validation.** The validator's tie check compares a patch's rules only against the library. Two rules in the same patch that tie (same kind, same specificity, an event both could answer) are accepted, and the first silently wins.
3. **The shared log can accept a patch that only one client can load.** A commit is validated against the committing client's workspace (its own local statuses, types or rules). Other clients then reject the patch when they sync, because they lack what it leans on.
4. **The `transform` effect leaves the tile index stale.** It sets the entity's type directly. When a thing changes to a type with a larger footprint (e.g. a slime becoming a sin boss), the cells of the new footprint are not indexed, and the thing can be walked through.
5. **A question that got no reply at all is given up for the session at once.** If the service is restarting or the connection drops, the hole is marked failed immediately and never asked again.
6. **The modder runs a full model episode that cannot succeed when the service's own base rules already answer the request.** This happens when the client is older than the service. It should say so without any model call.
7. **A request's "recent lines" context is almost always empty.** It is read from the frame's output buffer, which the snapshot drains every frame.

## Expected behaviour

- **Loading a save:** after `Game.load`, no entity has `frozenBy`, and `engine.busy(player)` is false. This holds for a save taken while a request was outstanding. The held are let go, as after a time-out.
- **Validation of a patch with two tying rules:** it fails with an error of the form `rule "patch/a" ties with "patch/b" …`. The check covers rules against the library and rules against the other rules of the same patch. Each pair is reported once, not twice.
- **Committing to the shared log:**
  - A commit is judged against the shared library alone, never a client's workspace.
  - If a draft uses a status that only the client's workspace defines, the commit fails. The diagnostics (including "unknown status") go back to the design as a repair.
  - A repaired patch that carries the missing status as an artifact commits. Afterwards the shared library contains that status.
  - Non-commit validation with a workspace still works as before, so such a draft validates `ok` when checked with the workspace.
- **Transform:** after a `transform` effect changes a thing to a type with a larger footprint, every cell it now occupies lists it among the entities at that cell. The write is guarded like the other world writes.
- **No reply:**
  - A question whose provider rejects (no reply) is asked again on later occurrences of the same event, up to 3 asks in total. After that it is given up for the session.
  - While it is unanswered, the participants are not left frozen.
  - A real "no answer" (the service replied, but with nothing) still gives up at once.
  - A successful patch clears the count.
- **Version skew:** when the request is already answered in the service's shared library by a rule that is not a patch rule (i.e. a base rule the client lacks), the modder returns `{ patch: null, outcome: 'failed' }` with a diagnostic naming that rule. It makes no design or model call. Requests answered by a patch rule still resolve through the existing covering path.
- **Recent lines:** a request built after the frame's output has been drained still carries the last lines logged or said, up to 6, oldest first. Lines still in the current frame's buffer are included after them, and the combined list is capped at the last 6. Each line is plain text in the request's language handling as before.

## Requirements

- `Game.load` clears `frozenBy` on every entity in the loaded state.
- Patch validation's tie check compares each rule of the patch with the library's patch rules and with the other rules of the same patch.
- `WorldLibrary.commit` no longer takes a workspace. It validates against the shared library only. All the modder's commit call sites are updated, and a failed commit's diagnostics still land on the episode's last attempt so the repair round uses them.
- `World.transform` is guarded like other writes, and re-indexes the cells before and after the type change. The `transform` effect uses it, and the entity's `name` is still cleared as before.
- The Mod port counts no-reply failures per question signature. It gives up after 3 and not before. A successful patch resets the count. A reply of "no answer" is not counted as a no-reply failure.
- The world keeps the last 6 lines logged or said beyond the frame drain. The snapshot drains the output buffer through the world so those lines are retained.
- The modder checks for a base-rule answer before asking any model, and before the "no model available" outcome.
- Existing behaviour is unchanged otherwise.

## Interface

- `World.recent: Text[]`, in `packages/engine/src/world.ts`. The last lines logged or said, kept past the drain.
- `World.drainFx(): FxEvent[]`, in `packages/engine/src/world.ts`. Returns the output buffer and empties it. It appends the buffer's log and say texts to `recent`, keeping only the last `RECENT_LINES`.
- `RECENT_LINES: number` (value 6), exported from `packages/engine/src/world.ts`.
- `WorldLibrary.answeredByBase(req: ModRequest): string | undefined`, in `packages/modder/src/library.ts`. Returns the id of the non-patch rule that answers the request in the shared library, otherwise `undefined`.
- `WorldLibrary.commit(patch, req?, now?, replaces?)`, in `packages/modder/src/library.ts`. The `ws` parameter is removed. This changes an existing signature.
