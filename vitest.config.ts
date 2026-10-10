import { defineConfig } from 'vitest/config'
// whole-world tests (a day of ticks, battles, the coverage sweep) take seconds; under a parallel run, more
export default defineConfig({
  test: {
    testTimeout: 30_000,
    projects: [
      { extends: true, test: { name: 'packages', include: ['packages/*/test/**/*.test.ts'] } },
      // a game's tests run with the game handed to the runtime first, as its pages do (docs/engine-split.md)
      { extends: true, test: { name: 'openworld', include: ['games/openworld/*/test/**/*.test.ts'], setupFiles: ['games/openworld/client/src/register.ts'] } },
    ],
  },
})
