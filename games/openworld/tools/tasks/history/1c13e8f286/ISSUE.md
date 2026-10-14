# A signed-out backend should count as unavailable, like a spent quota

## What is wrong

When the model backend is not signed in (for example claude-code with an expired sign-in, "Failed to authenticate: OAuth session expired"), the modder treats each request's error as an ordinary failure. Every request fails at once, and each one still runs an offline escalation and a reflection (a lesson-learning step) that call the backend again. This wastes calls and records lessons from a failure that has nothing to do with the request.

The modder already has a "backend is down" behaviour for quota and throttling errors (session limit, usage limit, rate limit, 429, overloaded, and similar). After such an error it does not escalate, does not reflect, and makes no model calls for a pause of about five minutes. A request made meanwhile gets the outcome `unavailable`. Sign-in errors are not recognised as this condition.

## Expected behaviour

Errors that say the backend cannot answer because it is not signed in or not authorised are treated exactly like the existing quota/throttling errors.

- A model call that fails with an error such as `claude-code: Failed to authenticate: OAuth session expired and could not be refreshed`:
  - The request that hit it ends with outcome `failed`.
  - No escalation follows, and no reflection is run. Nothing is journaled as `reflect` or `lesson.add`.
  - The pause starts. A later request (for example for a different asset) gets outcome `unavailable` and makes no model call.
  - Work still queued when the pause begins makes no further model calls.
- Other sign-in style messages count too: OAuth errors, "unauthorized"/"unauthorised", HTTP 401 and 403, an invalid API key, "not logged in", and "authenticate"/"authentication" wording. Matching is case-insensitive.
- Existing quota/throttling behaviour is unchanged. Errors unrelated to the backend being down (for example a malformed model reply) are still ordinary failures that can be escalated and reflected on.

## Requirements

- Sign-in/authorisation errors are classified as "backend down" by the same mechanism and with the same pause length as quota errors.
- After such an error, within the pause window, no model calls are made: no escalation, no reflection, no further queued work, and new requests return `unavailable`.
- No lessons are recorded from such a failure.
- Quota and rate-limit errors behave as before.
- Ordinary errors that do not mention sign-in or quota terms are not mistaken for backend-down.

## Interface

None
