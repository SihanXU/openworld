# Fast mode should be a `--fast` flag on the claude-code backend, not a backend of its own

## What is wrong

Fast mode is currently selected by a separate backend value, `claude-code-fast`, alongside `openrouter`, `claude-code` and `none`. Fast mode is not a different backend; it is an option of the `claude-code` backend. Having it as a backend value muddles the list of backends. In addition, `LSW_CLAUDE_FAST=1` is silently ignored when the chosen backend isn't `claude-code`, so a user who asks for fast mode with, say, OpenRouter gets no fast mode and no warning.

## Expected behaviour

- The valid backends are exactly `openrouter`, `claude-code` and `none`. `claude-code-fast` is no longer a backend; choosing it is an "unknown backend" error like any other unrecognised value.
- Fast mode is requested with `LSW_CLAUDE_FAST=1`, or with a `--fast` command-line flag that sets it. It works on both entry points:
  - `npm run dev -- --backend claude-code --fast`
  - `npm run modder -- serve --fast` (with `--backend claude-code` or `LSW_MODEL_BACKEND=claude-code`)
- Model selection from the environment:
  - `LSW_MODEL_BACKEND=claude-code` → the model is named `claude-code:claude-opus-5-5@low`.
  - `LSW_MODEL_BACKEND=claude-code` with `LSW_CLAUDE_FAST=1` → `claude-code:claude-opus-5-5@low+fast`.
  - `LSW_CLAUDE_FAST=1` with any backend other than `claude-code` (including the default, `openrouter`, even with a key and model set; and `none`) → an error whose message says fast mode applies to the claude-code backend only.
  - `LSW_MODEL_BACKEND=none` without fast → no model (undefined), as before.
  - OpenRouter with key and model set and no fast flag → works as before.
  - An unrecognised backend, e.g. `nope` → an error containing "unknown backend".
- The `npm run dev` interactive backend prompt no longer offers a `claude-code-fast` choice. `--fast` is passed on to the modder it starts.
- Help/usage comments and docs that mention `claude-code-fast` are updated to describe `--fast` instead.

## Requirements

- `claude-code-fast` is removed as a backend value everywhere, including the dev prompt and docs.
- `LSW_CLAUDE_FAST=1` selects fast mode for `claude-code` only; with any other valid backend it throws an error mentioning "claude-code backend only".
- An unknown backend still throws an error matching "unknown backend", and the unknown-backend check takes place before the fast check.
- `LSW_MODEL_SCRIPT` still takes precedence over everything else, as before.
- `--fast` is recognised by the modder CLI (removed from its positional arguments so it doesn't disturb command parsing) and by `npm run dev`, which forwards it to the modder it spawns.
- The existing model naming (`+fast` suffix) is unchanged.

## Interface

None
