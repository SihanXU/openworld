# Patch validation must prove that every chain ends, and make the repeat check exact

## What is wrong

Patch validation has two gaps in how it judges rules that make things happen again and again.

1. **Chains that never end pass validation.** A rule whose answer sets off the same event again (for example, a strike on the statue that strikes the statue again) is not refused when the patch is validated. It is only stopped at runtime by the chain budget, after it has shipped. Design A7 says every chain must end, and that should be proven before a rule ships, on the request's scene.

2. **The repeat check is a sample, not a proof.** It replays the triggering event a fixed 12 times and calls the event endless if any of the last few replays made something. This gives wrong verdicts:
   - A store that gives a finite, modest amount (a bush that can be picked twenty times) is refused, though it runs out. (A6)
   - A cycle that does return to its starting state, such as one host turning into another and back with a stick each way, is only caught by the sampled count. The refusal cannot say what the cycle is or how long its period is.

## Expected behaviour

### Every chain ends

For a patch whose triggering event has a defined resolution, validation follows that event and everything it sets off on the request's scene. This includes events that wait for later ticks. It follows them until nothing of that chain is left.

- A **loop** is an event that, through its own outcomes (parent to child, down its ancestry), sets off the same event, on the same world, again. Mere equality of two events is not a loop: two sibling events of the same kind are not one. A loop is refused, and the refusal names the round from parent to child. Example: a strike on the statue whose answer strikes the statue again is refused with the round `impulse/strike on fixture/sacred/statue → impulse/strike on fixture/sacred/statue`.
- A chain still going after **50 ticks** or **1,500 events** is refused too.
- A chain that ends passes. In particular, a chain gated by something that runs out (a counter that counts up to 3, then stops re-striking) passes.
- The refusal message has the form: `chain: the triggering event sets off events that never end: it sets off the same event on the same world again: <round>`. For a chain past the bounds, the reason reads that it sets off N events and is still going after 50 ticks. The message should also tell the designer what would fix it: something that runs out, such as a status gate, a prop, or the host used up.
- When the chain check refuses a patch, the endless-yield check does not also report on it.

### The repeat check is exact

After each replay with no time between, the check records the state of the event's participants: the host and every entity in the event's roles. The state covers type, props, statuses, tags and place. What those entities hold is left out. The order of keys must not matter when two states are compared.

- **A state that comes back closes a cycle.** If the replays in that cycle made anything, the event is endless. The refusal names the cycle, in the form "after replay B, every N replay(s) come back to where they began and make M thing(s) each time round". Examples:
  - A rule on the statue that makes a stick every time, with no change to the host: "every 1 replay(s) come back to where they began and make 1 thing".
  - Statue → altar → statue, a stick each way: "every 2 replay(s) come back to where they began and make 2 thing(s)".
- **A host that is used up**, or replays that settle into making nothing, end the check as not endless.
- **A store that keeps giving without coming back** (for example a counter ticking down or up) passes as long as its total across the replays is at most **64** things. A bigger store is refused. Examples:
  - A rule giving a stick while a counter is below 20 passes. A bush picked twenty times is no longer refused.
  - The same rule with a counter below 100 is refused, with a reason that reads "65 things from 65 replays with no time between (at most 64: a bigger store must come back over time)".
- If no state comes back within the check's replay limit and the last replays are still making things, it is refused ("still making things after N replays"). The limit is large enough that it never cuts off the 64-thing store above.
- Only events someone can repeat at will are checked (acts and what they set off: impulses, contact, bumps, being seen), as before.
- The check still runs under **every outcome of the chances** the run reaches, each starting from the same world, up to the existing assignment limit. The triggering replay, when primed, uses the same assignment. A finding under any outcome refuses.
- The refusal text for the endless yield in patch validation, and for the library audit, includes the certificate, e.g. `endless yield: the triggering event, repeated with no time between, keeps making things: <certificate>. ...`.

## Requirements

- Validating a patch whose answer re-strikes its own host with nothing that runs out is refused with a `chain:` error that names the round.
- Validating a patch whose re-strike is gated by a counter that stops it passes, with no `chain:` error.
- A twenty-stick store passes with no `endless yield` error. A hundred-stick store is refused with the 65-things-from-65-replays certificate.
- A one-replay cycle and a two-replay cycle (statue ↔ altar) are each refused with their own period and the number of things made per round.
- No false positives on the base content. Ordinary patches validate in about the same time as before.
- The loop check works from the chain ids that carry through deferral (from #42). An event deferred to a later tick keeps belonging to its chain, and the check can tell whether any event of a chain still waits.
- The check must not alter play: the observation hooks are unset in normal play, and the check leaves them unset when it finishes, even if it throws.
- The library audit reports the same certificate for a stored rule that is an endless yield.

## Interface

In `packages/engine/src/sandbox.ts`:

- `chainLoop(eng: Engine, ev: GameEvent): string | undefined` — follows the event and what it sets off on the engine's world. Returns why the chain does not end (the round for a loop, or the bound reached), or `undefined` if it ends.
- `yieldCycle(eng: Engine, ev: GameEvent): string | undefined` — the exact repeat check on one engine. Returns the certificate if endless, otherwise `undefined`.
- `whyEndless(eng: Engine, ev: GameEvent, prime?: boolean): string | undefined` — runs `yieldCycle` under every outcome of the chances reached (with `prime` replaying the triggering event once first, under the same assignment). Returns the certificate or `undefined`. Events that are not repeatable return `undefined`.
- `underEveryChance<T>(eng: Engine, run: (e: Engine) => T | undefined): T | undefined` — for each complete assignment of chance outcomes the run reaches (up to the assignment limit), runs `run` on a fresh copy of the engine with that luck, and returns the first finding.
- `endlessYield(eng: Engine, ev: GameEvent, prime?: boolean): boolean` — remains, now true exactly when `whyEndless` finds something.
- Constants: `YIELD_MOST = 64`, `CHAIN_TICKS = 50`, `CHAIN_EVENTS = 1500`. `REPEAT_TIMES` becomes 128 (the replay limit of the exact check). `REPEAT_TAIL` is no longer exported.

In `packages/engine/src/engine.ts`, on `Engine`:

- `onQueue?: (ev: GameEvent, parent: GameEvent | undefined) => void` — called when an event is queued, with the event whose outcome made it (if any). Unset in play.
- `onDispatch?: (ev: GameEvent) => void` — called when an event is dispatched. Unset in play.
- `waiting(chain: number): boolean` — whether any event of this chain still waits, in the current flush or for a later tick.

In `packages/engine/src/types.ts`:

- `GameEvent.seq?: number` — a number the termination check gives an event, kept by its copies (such as one waiting for a later tick).
