# The Claude Code backend cannot start on Windows (ENOENT)

## What is wrong

`runClaude`, the function behind the Claude Code model backend, spawns the `claude` command directly. On Windows a process can only be started directly from an `.exe`, which breaks two cases:

- `npm i -g` installs Claude Code as `claude.cmd`, which cannot be spawned directly.
- A script with a node shebang (the tests' stand-in for `claude`) cannot be spawned directly either.

Both fail with ENOENT, so on Windows the backend cannot start, either in the tests or for real. Several tests in the Claude Code backend suite fail there.

## Expected behaviour

The command is resolved per platform before it is spawned.

- **Not Windows:** the command and arguments are used exactly as given, with no shell.
- **Windows, a path to a node-shebang script** (first line `#!` mentioning `node`): it runs under the current node executable (`process.execPath`), with the script path as the first argument followed by the original arguments, and no shell.
- **Windows, a path to an `.exe`:** it runs as given, with no shell.
- **Windows, a bare name (no path separator):** it is looked up in each directory on `PATH`, trying `.exe` first, then `.cmd`, then `.bat`, then the bare name. The first match that is a file is used.
  - `.exe` runs directly.
  - `.cmd`/`.bat` runs through cmd.exe (shell mode). The command path and every argument are wrapped in double quotes, with any embedded `"` doubled, so that an argument containing a space reaches the script as one argument.
  - A bare-name match with no extension runs under node only if it is a node-shebang script.
- **Windows, a name or path with a separator:** it is tried as given, then with `.exe` and `.cmd` appended, and the first existing file is used under the same rules.
- **Windows, nothing found:** the command is returned unchanged, with no shell, so the spawn fails with the usual error.
- `runClaude` uses this resolution, and the spawned child does not pop up a console window on Windows.
- The prompt still goes through stdin. Only flags, model ids and temp-file paths are passed as arguments, which is why simple quoting is enough.

Example (Windows): `lswprobe.cmd` is in a directory on `PATH` and echoes its first two arguments. Resolving `lswprobe` with args `['--model', 'C:\\tmp dir\\sys.txt']` gives a result with `shell: true`. Running that result through a shell prints `["--model"] ["C:\\tmp dir\\sys.txt"]`, so the argument with a space arrives whole.

## Requirements

- The command resolver exists, is exported from the agent package's index, and returns the file, args and shell flag to spawn with.
- Behaviour is unchanged on non-Windows platforms.
- On Windows, a node-shebang script given by path runs under this node.
- On Windows, a bare command name resolves on `PATH` as `.exe`, then `.cmd`.
- A `.cmd` is started through the shell with all arguments quoted, and an argument containing a space is passed as a single argument.
- An unresolvable command is returned as given.
- A session that exits before reading its input is still reported as an error (exit code in the message), not a crash (EPIPE). That check must work on Windows, using a node-script stand-in rather than a shell script.

## Interface

- `commandFor(bin: string, args: string[]): { file: string; args: string[]; shell: boolean }`
  - Lives in `packages/agent/src/model.ts`.
  - Exported from the agent package entry point (`packages/agent/src/index.ts`), so it can be imported from `../src/index.ts`.
