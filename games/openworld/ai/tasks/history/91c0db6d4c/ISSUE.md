# Modder: stop calling the model while the backend is out, skip auditing narration-only patches, and make claude-code tool steps cacheable

## What is wrong

An audit of a long modder session found three kinds of waste.

1. **Calls still go out while the backend is out.** The pause after a quota or sign-in error only covers live episodes. Repo episodes never check the error and still get reflected on. Jobs queued before the backend went out (escalations, reviews, audits, revisions, reflections) call the model anyway when their turn comes. A blocking audit that could not run because the backend was out lets the patch ship unaudited.
2. **Audits of rules that cannot change anything.** A large share of audits ran on patches whose rules only narrate (`log`, `say`, `vfx`, `emote`). They cost calls and can find nothing. Also, `changesNothing` ignores the default effects of a hole leaf, so a rule whose only effects sit in a hole's default is judged wrongly.
3. **The claude-code backend caches only the system prompt.** For a call with tools (one step of a conversation), the whole transcript is flattened into one text block, with the instructions tail appended after it. The end of that block changes every step, so nothing past the system prompt can be read from the prompt cache. Long agent loops resend tens of thousands of tokens at full price each step.

## Expected behaviour

### Backend out

- Every model call the modder makes (designs, audits, reviews, reflections, the repo agent and its reflection) goes through one guard.
  - While the backend is out, the guard makes no call. It fails with an error whose message starts `model unavailable: ` followed by what the backend said.
  - When a call fails with an error that says the backend is out (the existing quota/sign-in/throttle detection), the guard starts the pause and logs it. The error is rethrown.
- While the pause lasts:
  - Queued background jobs are dropped when their turn comes. Each one is logged as skipped, with the reason, and its model is not called.
  - An escalation or revision that was waiting for its turn returns outcome `unavailable` with a `model unavailable: …` diagnostic, and makes no call.
  - A new request returns `unavailable` as before.
  - A repo episode that failed because of the backend is not reflected on. The failure still starts the pause, so the next request is `unavailable`.
  - A blocking audit that could not run because the backend is out must not ship the patch unaudited. This applies to live episodes and repo episodes. The episode fails and the patch is not committed.
  - An audit that fails for any other reason keeps the old behaviour: it finds nothing, the failure is logged, and the patch ships.
- Example: the first request succeeds, and its reflection then hits a quota error. A second request fails (not on the backend) and queues an escalation and a reflection. Once the backend is out, neither the escalation nor the reflection makes a call. Only the two episodes are recorded, and the next request is `unavailable`.
- Example: a repo episode whose first call fails with a quota error ends `failed` after exactly one call. No reflection is journaled, no further call goes out, and the next request is `unavailable`.

### Narration-only patches are not audited

- A patch whose artifacts are all rules that only narrate (per `changesNothing`) gets no audit call. This applies to both the blocking audit (before shipping) and the after-shipping audit, for live and repo episodes.
- For the after-shipping case, the journal still gets an `audit` entry. It has the episode id, the rule ids, `skipped: 'narrates only'`, empty `confirmed` and `unconfirmed` lists, and usage of zero calls, input, output and cost.
- A patch that contains any other kind of artifact, or any rule that changes something (for example `addStatus` plus a `log`), is audited as before.
- `changesNothing` also looks at a hole leaf's default effects. A rule counts as changing nothing only if every `do` leaf's effects and every hole's default effects are narration. A hole with no default adds nothing.
- The `ford-live` auditor report prints a skipped entry as `skipped (narrates only)` instead of "nothing confirmed".

### claude-code: cacheable steps

- A call with tools (a conversation step) goes to `claude` with `--input-format stream-json`, `--output-format stream-json` and `--verbose`. The other flags, including `--no-session-persistence` and the system prompt file, are unchanged.
- The input is a single stream-json line (newline-terminated): one `user` message whose content is an array of text blocks.
  - The first block is `[instructions]\n` followed by the tool protocol.
  - After it comes one block per transcript turn, in the same `[role]…` form as the plain-text transcript. Blocks are never merged.
  - The next step's message is therefore the previous step's blocks plus the newly appended turns, so a prefix cache can match at block boundaries.
- The answer is read from the `result` line of the output stream. A stream with no result line is an error. A failed session (an error result such as "Failed to authenticate") is still an error, in stream mode too.
- A call without tools (the live design, reviews, reflections) is unchanged: plain text on stdin, `--output-format json`, no `--input-format`, and "Reply with one JSON object and nothing else." last when `json` is requested.
- The system prompt is passed identically on every step of a conversation.

## Requirements

- Every model call the modder makes goes through the guard, including the calls of the repo agent, its reflection, audits, reviews, batch reflections and designs.
- While the backend is out, no model call goes out. This holds for queued jobs, waiting escalations and revisions, and reflection.
- A backend-caused failure of a repo episode is not reflected on.
- A blocking audit that fails because the backend is out does not ship or commit the patch. Other audit failures still behave as before.
- Narration-only patches are never sent to the auditor, blocking or not. The after-shipping case journals the skipped entry described above.
- A patch with any non-narrating rule is still audited.
- `changesNothing` counts hole defaults.
- `ford-live` prints skipped audits as described.
- Tool-call steps use the stream-json format described above, with the block structure and the append-only property between steps.
- Calls without tools keep exactly their current invocation and stdin.
- Existing behaviour not mentioned here is unchanged.

## Interface

None
