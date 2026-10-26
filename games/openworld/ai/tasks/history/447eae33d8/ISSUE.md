# Unattended agents must run commands only in an isolated environment, and get no shell without one

## What is wrong

An offline revision of a world task ran shell commands directly in the real repository: it read engine source and wrote a debug script at the repository root. Today an agent working unattended (curriculum, escalations, revisions, the outer loop) is given the `run` tool and its own hooks in a local environment, so anything it executes can reach the whole machine. Other leaks exist too:

- World tasks run their tests through a `validate.mjs` in the workspace, which the agent can edit.
- File-writing tools follow symbolic links, so a link inside the workspace (such as one to the host's `node_modules` or tool caches) can carry a write outside it.
- A task's container or temp workspace is released by whichever source instance cleans it up. A replay cleaned up through a different source instance leaked a container.

## What is wanted

Commands the agent runs, and hooks it wrote for itself, must execute only where they cannot reach past the workspace (a container). Where there is no container, an unattended agent gets no shell and runs no hooks of its own. A person who starts a task by hand may still allow local commands.

## Expected behaviour

**Isolation flag on environments.**
- Every `Env` reports whether it is isolated. A Docker environment is isolated; a local one is not.

**Tools and hooks in the agent loop.**
- With a non-isolated env and no explicit permission, the agent's tool set has no `run`. `run_tests` is still offered when a test command exists.
- With the permission given to the tool factory (a "local run" flag), `run` is offered even on a non-isolated env.
- With an isolated env, `run` is always offered.
- On a non-isolated env without the local-run permission, start and presubmit hooks the agent wrote do not run: no hook output reaches the agent's introduction, and the episode's tool list has no `run`. The task can still be worked and accepted using file tools and tests.
- Tasks started by hand set the permission: the `task` CLI command, an SWE run on a local env, and the engine-task command. Unattended sources never set it.

**Writes through links.**
- Writing or editing a file whose path resolves, through a symlink or junction in the workspace, to somewhere outside the workspace fails with an error mentioning "outside the workspace". Nothing is written outside.
- Ordinary writes inside the workspace, including to new nested paths, still work.
- The engine-task workspace no longer links the host's tool caches (`.vite`, `.vite-temp`, `.cache` under `node_modules`).

**World tasks.**
- `materializeWorld` becomes asynchronous. It accepts an optional isolation choice (`'docker'` or `'none'`); by default it picks docker if a Docker daemon answers, else none. `LSW_ISOLATION=docker|none` overrides the default.
- The returned repo's `dispose` is asynchronous: it stops the env (container) and removes the workspace.
- In docker mode the task's env is a container from the `lsw-sandbox` image with:
  - the workspace mounted read-write at `/work`;
  - the engine's `packages`, `node_modules`, `package.json` and `tsconfig.base.json` mounted read-only under `/repo`;
  - no `.env`, no `var/`, no network;
  - limits of 1 GB memory, 1 CPU, 256 processes;
  - the host user's uid:gid, so files written in the workspace belong to the host user.
- The task's test command runs the validator from the engine's own code (not `validate.mjs`). It must not mention `validate.mjs`. Run in the env, it yields the usual validator output (e.g. `FAILED: 0 artifact(s)` / `PASSED: 1 artifact`). The generated `validate.mjs` in the workspace still works when run by hand on the host in `none` mode.
- The modder's offline revision, whose agent tries a `run` command that writes into the real repository, must leave nothing in the repository: with a container the command can't reach it; without one there is no shell.

**Engine tasks.**
- `engineTask` becomes asynchronous and accepts options `{ isolation?, localRun? }`. It resolves to `undefined` when isolation is `none` and `localRun` is not set. With docker, it runs in a container (workspace and the host's `node_modules` mounted at the same paths, read-only for `node_modules`, no network, host user, limits).
- With `isolation: 'none'` and `localRun: true`, it returns a task whose env is not isolated and whose `localRun` is `true`.
- The returned `dispose` is asynchronous and releases both the container and the workspace. If starting the container fails, the workspace is cleaned up before the error propagates.
- The curriculum skips its periodic engine task, with a message, when no engine task can be made.
- `engineSource` (unattended) yields no task when no container is available.
- The `npm run engine-task` entry runs by hand: it requests a local run, warns when no container is present, and awaits disposal.

**Task-owned release.**
- A task may carry its own `dispose`. The task sources for world replays and engine replays attach it and their `cleanup` simply calls it, so cleanup works through any source instance. No per-source bookkeeping map remains.

**Sandbox image.**
- A Dockerfile at `packages/agent/sandbox/Dockerfile` (node, git, ripgrep). The image `lsw-sandbox` (or `LSW_SANDBOX_IMAGE`) is built on first use if missing; a named custom image that is missing is an error.

## Requirements

- `Env` has a readonly `isolated: boolean`; `LocalEnv` is `false`, `DockerEnv` is `true`.
- `AgentTask` gains optional `localRun` and `dispose`.
- `agentTools` accepts a `localRun` option in its hooks and omits `run` when the env is not isolated and the option is unset.
- `runAgent` skips agent-written hooks when the env is not isolated and the task has no `localRun`, and passes `localRun` to the tools.
- `DockerEnv.start` accepts extra mounts (read-only unless marked writable), a user, and resource limits, in addition to existing options.
- Writes via `write_file` and the edit tool are confined to the workspace by real path; reads keep their existing behaviour.
- Docker availability is determined once per process.
- The `task` CLI and SWE runs set `localRun` as described (SWE: only when its env is not isolated).
- The full suite passes without leaving any container or temp workspace behind. Docker-dependent checks apply only where a daemon answers.

## Interface

In `packages/agent/src/env.ts`:
- `Env.isolated: boolean` (readonly)
- `LocalEnv.isolated = false`; `DockerEnv.isolated = true`
- `DockerEnv.start(o)` options additionally: `mounts?: { host: string; container: string; writable?: boolean }[]`, `user?: string`, `limits?: { memory?: string; cpus?: string; pids?: number }`
- `dockerAvailable(docker?: string): Promise<boolean>`
- `type Isolation = 'docker' | 'none'`
- `chooseIsolation(): Promise<Isolation>`
- `sandboxImage(docker?: string): Promise<string>`
- `hostUser(): string | undefined`
- `SANDBOX_LIMITS: { memory: string; cpus: string; pids: number }`

In `packages/agent/src/loop.ts`:
- `AgentTask.localRun?: boolean`
- `AgentTask.dispose?: () => Promise<void>`

In `packages/agent/src/tools.ts`:
- `ToolHooks.localRun?: boolean`
- `insideForWrite(root: string, p: string): string`

In `packages/modder/src/repo.ts`:
- `materializeWorld(o: { …existing fields; isolation?: Isolation }): Promise<WorldRepo>`
- `WorldRepo.dispose(): Promise<void>`
- `worldIsolation` (same as `chooseIsolation`)

In `packages/tools/src/engine-tasks.ts`:
- `engineTask(def: EngineTaskDef, o?: { isolation?: Isolation; localRun?: boolean }): Promise<{ task: AgentTask; dispose: () => Promise<void> } | undefined>`

Exports: `dockerAvailable`, `chooseIsolation`, `sandboxImage`, `hostUser`, `SANDBOX_LIMITS`, `Isolation` must be reachable from `@lsw/agent`, and `dockerAvailable` from the modder package's index, as the tests import them from there.

Files:
- `packages/agent/sandbox/Dockerfile`
