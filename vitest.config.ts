import { defineConfig } from 'vitest/config'
// whole-world tests (a day of ticks, battles, the coverage sweep) take seconds; under a parallel run, more
export default defineConfig({ test: { include: ['packages/*/test/**/*.test.ts'], testTimeout: 30_000 } })
