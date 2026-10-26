# Add a Claude Code (`claude -p`) model backend, selectable at start

## What is wanted

The modder can reach a model only through an OpenAI-compatible endpoint (OpenRouter), which needs an API key. We want a second backend that reaches Claude through Claude Code's print mode (`claude -p`), signed in as the user, with no API key.

The backend must be selectable through configuration. `modelFromEnv` should choose the backend from `LSW_MODEL_BACKEND`. `npm run dev` should ask for the backend in a terminal or accept `--backend`. `npm run modder -- serve --backend …` should accept the same flag.

## Expected behaviour

**The model class.** A new model, `ClaudeCodeModel`, implements the existing `Model` interface. Each `chat` call runs one fresh `claude -p` session and returns a `ModelReply`.
- The session uses the configured model and effort. Effort defaults to `low` and is fixed per call; the harness's `reasoning` option is ignored.
- The session has no tools of its own, loads no project or user settings, MCP servers or skills, and does not persist. It runs outside the repository.
- The conversation transcript goes to the session on stdin. Output is read as `claude -p`'s JSON result.
- The design stage's tools are offered through a text protocol, because the session's own tools are off. The model replies with one JSON object of tool calls, and the reply carries them as `toolCalls`. A tool call has a name and args, and gets a generated id.
- If the reply is not a tool-call object, it is the final answer in `content`, with an empty `toolCalls`.
- Earlier assistant tool calls and tool results in the messages are rendered into the transcript so that the model sees them on the next turn.
- With `json: true` and no tools, the call instructs the model to reply with one JSON object and nothing else.
- Fast mode can be requested. The reply's `provider` says when it was not granted.
- `usage` is filled from the result: input counts plain input plus cache reads plus cache creation, plus output, cost, and reasoning tokens when reported.
- `provider` is `claude-code` normally.
- The model's `name` identifies backend, model, effort and fast mode.
- The `retries` and `deadlineMs` options are honoured. A session that does not answer in time is an error.

**Prompt caching.** Calls in an episode should share one cached prefix.
- The system prompt is passed exactly as the pipeline built it, byte for byte, whatever the call asks for (tools, JSON, or neither).
- It is passed through a file, not an argument, because it outgrows argument size limits as content grows. Prompts of hundreds of KB must work.
- Anything that varies per call (the tool protocol, the "reply with JSON" instruction) goes after the transcript, never into the system prompt.
- Temporary files are cleaned up.

**Failures reject.** The modder then falls back as with any provider.
- A result flagged as an error rejects, and the message includes the reported text, e.g. "Failed to authenticate".
- A session that exits before reading its input (signed out, bad flag) rejects with an error that includes the exit code. It must not surface as an unhandled EPIPE that ends the process. This must hold even with a multi-megabyte transcript.
- A spawn failure also rejects.

**Backend selection through `modelFromEnv`.** `LSW_MODEL_SCRIPT` still takes precedence. Otherwise `LSW_MODEL_BACKEND` selects:
- `openrouter` (the default when unset): unchanged behaviour.
- `claude-code`: a `ClaudeCodeModel` with model `LSW_CLAUDE_MODEL` (default `claude-opus-5-5`), effort `LSW_CLAUDE_EFFORT` (default `low`), and executable `LSW_CLAUDE_BIN` (default `claude` on the PATH). Its name is `claude-code:claude-opus-5-5@low`.
- `claude-code-fast`: the same with fast mode on (`LSW_CLAUDE_FAST=1` also enables it). Its name is `claude-code:claude-opus-5-5@low+fast`.
- `none`: returns `undefined`, even if an OpenRouter key and model are set.
- Any other value throws an error whose message contains "unknown backend".

**CLI and dev.**
- The modder CLI accepts `--backend <name>` and sets the backend from it.
- `npm run dev` takes `--backend`, or `LSW_MODEL_BACKEND` from the environment or `.env`. Otherwise, in a terminal, it lists the backends and asks which one to use, defaulting to OpenRouter. Outside a terminal it uses OpenRouter. An unknown name is an error. The chosen backend is passed to the modder process it starts.

## Requirements

- `ClaudeCodeModel` and its config type are exported from the agent package's index, alongside the existing models.
- `chat` returns the model's result text as `content` when there are no tool calls, and the parsed calls otherwise.
- The system prompt reaches the session intact, via file, for every kind of call. Tool protocol and JSON instructions never alter it.
- A tool-less run passes an empty tool set to the session, so the session reports no tools.
- Error results and early-exiting sessions reject with the messages above, and never crash the process.
- Defaults: model `claude-opus-5-5`, effort `low`, timeout 180 s when neither `deadlineMs` nor `timeoutMs` is given.
- `openrouter` behaviour, including the case where no key or model is set (returns `undefined`), is unchanged.
- Existing scripted and OpenRouter models keep working.

## Interface

In `packages/agent/src/model.ts`, exported from the agent package index:

- `interface ClaudeCodeConfig`
  - `model: string`
  - `effort?: string` — `low | medium | high | xhigh | max`, default `low`
  - `fast?: boolean`
  - `bin?: string` — the `claude` executable, default `claude`
  - `timeoutMs?: number`
- `class ClaudeCodeModel implements Model`
  - `constructor(cfg: ClaudeCodeConfig)`
  - `readonly name: string` — `claude-code:<model>@<effort>` with `+fast` appended when fast
  - `chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ModelReply>`
- `modelFromEnv(env?)` — existing function, now honouring `LSW_MODEL_BACKEND`, `LSW_CLAUDE_MODEL`, `LSW_CLAUDE_EFFORT`, `LSW_CLAUDE_BIN` and `LSW_CLAUDE_FAST`.

Command-line flag: `--backend <openrouter | claude-code | claude-code-fast | none>` on `npm run dev` and on the modder CLI.
