// The toolchain at the world's scale (docs/continent.md §14): what building the world makes and how long the tools
// take over it — the files the game fetches (the index at the start, a map when it is entered), the project compiled
// whole (what the editor, the bake and `npm run game -- check` do) and a map compiled alone (what the editor does after
// a stroke). `npm run scale` prints them beside the engine's; the scale checks hold them to their bounds.

import { compile, compileMap } from '@openworld/format'
import { fordProject } from '../../../client/scripts/bake.ts'
import { buildFord } from './world.ts'

export interface ToolchainNumbers {
  /** Maps the world's files hold. */
  files: number
  /** JSON characters: the index (fetched at the start), every map file together, the largest. */
  indexChars: number
  worldChars: number
  largestMapChars: number
  /** Milliseconds: the project compiled whole, one map compiled alone. */
  compileMs: number
  compileMapMs: number
}

const time = (f: () => void, n = 1): number => {
  const t0 = performance.now()
  for (let i = 0; i < n; i++) f()
  return (performance.now() - t0) / n
}

export function toolchainRun(): ToolchainNumbers {
  const w = buildFord()
  const sizes = [...w.chunks, ...w.backdrop].map((c) => JSON.stringify(c).length)
  const project = fordProject()
  compile(project)
  const compileMs = time(() => compile(project), 2)
  const compileMapMs = time(() => compileMap(project, 'maps/meadow.json'), 10)
  return {
    files: sizes.length,
    indexChars: JSON.stringify(w.index).length,
    worldChars: sizes.reduce((a, b) => a + b, 0),
    largestMapChars: Math.max(...sizes),
    compileMs,
    compileMapMs,
  }
}
