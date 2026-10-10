// Wiring for a world: the game's ontology and base rules (its GameDef, handed over: the modder imports
// no game), the shared library file and the self-state directory under one data directory.

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { GameDef } from '@openworld/engine'
// the engine's official modules, which a game's ontology may name (docs/engine-split.md S3)
import '@openworld/modules'
import { WorldLibrary } from './library.ts'
import { modelFromEnv, type Model } from '@openworld/agent'
import { Modder } from './pipeline.ts'
import { SelfState } from '@openworld/agent'

export const REPO = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

// Local secrets (the model key) live in <repo>/.env, which is not committed. Variables already
// set in the environment win.
if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))

export interface OpenOptions {
  /** The game whose world this modder patches. */
  game: GameDef
  /** Holds library.jsonl and modder-state/ (default: $LSW_DATA or <repo>/var). */
  data?: string
  /** Default: from the environment (model.ts modelFromEnv); null forces none. */
  model?: Model | null
  log?: (line: string) => void
}

export function openModder(o: OpenOptions): Modder {
  const data = o.data ?? process.env.LSW_DATA ?? join(REPO, 'var')
  const library = new WorldLibrary(o.game.ontology(), o.game.rules, join(data, 'library.jsonl'))
  const state = SelfState.open(join(data, 'modder-state'))
  const model = o.model === null ? undefined : (o.model ?? modelFromEnv())
  return new Modder({ library, state, model, log: o.log })
}

/** A game's definition from its module (a path: its default export, or `GAME`), for the command lines. */
export async function loadGame(module: string): Promise<GameDef> {
  const m = (await import(pathToFileURL(resolve(REPO, module)).href)) as { default?: GameDef; GAME?: GameDef }
  const game = m.default ?? m.GAME
  if (!game) throw new Error(`${module} exports no game (a default export or GAME)`)
  return game
}
