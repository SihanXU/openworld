# The Mod port asks about the same undefined interaction again and again

## What is wrong

When an interaction has no rule (an "undefined" interaction) and the request for it goes unanswered (the provider times out, rejects, or returns nothing), nothing records that the question was already asked. The same action then raises a fresh request, and another provider/model call, every time the player repeats it. There is no limit, and a person who dismisses a question is asked the same one on the next attempt.

Separately, the client keeps the rule library only at the next autosave. A patch that was accepted or removed is therefore not stored until then.

## Expected behaviour

Requests are keyed by the interaction's *class*: the verb, what is acted on (an entity type, the terrain of a tile, the player themself, or nothing/hand), and what is held (same kinds). Instances of the same type count as the same class.

- **One open question at a time.** While a request for a class is still open, repeating the same action raises no new request. It runs the normal fallback and logs the attempt as it does for any failed interaction. "Open" means the request is pending, or the provider's reply has not yet arrived (it may arrive after the fallback has run).
- **At most two asks per class per session.** If the first request ends unanswered (e.g. times out into fallback), the same action may raise one more request. After that second request, the class raises no more requests and the action just falls back.
- **A dismissed question stays dismissed.** If a person dismisses a request ("nothing happens"), that class is never asked about again this session.
- **A late patch still applies.** A patch submitted for an earlier request, even one that has already fallen back, is validated and accepted as before, and teaches the world (the rule enters the library, and the record becomes `patched`).
- **A class that was answered becomes a rule** and no longer reaches the port, as before.
- **The client stores the library as soon as it changes.** When the library version changes in the worker, the client receives the updated library and persists it immediately, without a "saved" message or log line. Autosave continues to work as before.

Example, using a creature the actor interacts with and no rule exists:
1. First interact: 1 record. Repeating it while open: still 1 record.
2. After the timeout the record is `fallback`. Interact again: a second record (the 2nd ask).
3. After that one times out too, interacting again creates no third record.
4. Submitting a valid patch for the second record still succeeds and makes it `patched`.
5. In a fresh session, interact once, dismiss that record, interact again: still 1 record.

## Requirements

- Requests for the same class are not raised while one is open (pending or awaiting a provider reply).
- A class raises at most two requests per `ModPort` (session).
- Dismissing a request prevents any further request for its class in that session.
- The class is derived from the verb, the target kind, and the instrument kind. Tiles are identified by terrain, entities by type, the player as target by a "self" kind, and a missing role by a "hand" kind.
- Suppressed attempts still run the fallback and log the attempt line.
- Late patches for fallen-back records are still accepted.
- Each record carries its class, and records know whether a provider reply is still outstanding. The flag is cleared when the provider resolves, returns nothing, or errors.
- The worker posts the current library to the client whenever the library version changes, and the client stores it under the same key used for saves, with no log message.
- Existing behaviour of answered interactions, validation and the save flow is unchanged.

## Interface

- `signatureOf(eng: Engine, ev: GameEvent): string` in `packages/engine/src/mod.ts` (exported). Returns the class string for an interaction, formatted `verb|target|instrument`.
- `UndefinedRecord` (in `packages/engine/src/mod.ts`) gains `signature: string` and an optional `awaiting?: boolean`.
- `FromWorker` (in `packages/client/src/protocol.ts`) gains a variant `{ t: 'library'; library: LibraryData }`.
- No other new public names. `ModPort.raise` and `ModPort.dismiss` keep their signatures.
