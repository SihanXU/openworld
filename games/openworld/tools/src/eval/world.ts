// The world the evaluation runs on, built once from the game's own builders (as gen:world builds it).
import { buildFord } from '../demo/world.ts'

const built = buildFord()
export const WORLD_INDEX = built.index as typeof built.index & { protectedFacts?: string[] }
export const WORLD_CHUNKS = built.chunks
