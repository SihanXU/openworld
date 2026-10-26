# Starting a new game must write its layout facts as the author, and the client must not mutate the world outside an author block

## What is wrong

When a new game is started in the client worker, two layout facts (the first-light layout and the boss layout) are set directly on the world, outside any outcome and outside any author scope. The engine's write guard rejects such writes, so the writer throws and the game stays on the title screen instead of starting.

These two facts mark the freshly created world as already being the current layout, so no migration is due. This is the world being made, so it is the author's write and must be declared as such.

Nothing currently stops other client code from making the same mistake. There is no check that client sources only change the world inside an author scope (or through the input).

There is also no convenient way to run the client alone as a preview from the launch configuration.

## Expected behaviour

- Starting a new game succeeds: the game leaves the title screen and begins. Both layout facts are set to `true` on the new world, and the write guard does not throw.
- Loading a saved game and the dev console already change the world as the author. Those paths keep working as they do now.
- A scan of the client sources (`.ts` files under `client/src`, recursively) finds no call of a world mutator or engine move that sits outside an author block.
  - World mutators covered: `setFact`, `setStatus`, `clearStatus`, `setProp`, `addTag`, `removeTag`, `setTerrain`, `place`, `add`, `create`, `destroy`, `transform`, called on a world reference (`w`, `world`, `engine.world`, `eng.world`, `game.engine.world`).
  - Engine moves covered: `teleport`, `travel`, `applyStatus`, `removeStatus`, `hurt`, called on `eng`, `engine` or `game.engine`.
  - A call inside an `author(() => { ... })` block, or on a line that itself calls `author(`, is allowed.
- The launch configuration offers a "client-only" preview entry that runs the `dev:client` npm script on port 5173.

## Requirements

- The new-game path sets both layout facts inside an author scope on the game's engine, with the same resulting facts as before.
- No world mutator or engine move listed above remains in the client sources outside an author block, so the scan reports nothing.
- Existing behaviour for loading a game and the dev console is unchanged.
- `.claude/launch.json` gains a "client-only" configuration (`npm run dev:client`, port 5173) alongside the existing ones, leaving them untouched.
- The write-scan test suite for the repository continues to pass.

## Interface

None
