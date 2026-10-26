// Wiring for a world: the game's ontology and base rules (its GameDef, handed over: the modder imports
// no game), the shared library file and the self-state directory under one data directory.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { GameDef } from '@openworld/engine'
import { gameDefOf, type Bundle } from '@openworld/format'
import { compileProject } from '@openworld/format/src/node.ts'
// the engine's official modules, which a game's ontology may name (docs/engine-split.md S3)
import '@openworld/modules'
import { WorldLibrary } from '../library/library.ts'
// Node's part of the modder: a library's log in a file, the offline profile's repo agent
import '../library/library-file.ts'
import './offline.ts'
import { modelFromEnv } from '../models/model-node.ts'
import { type Model } from '../models/model.ts'
import { Modder } from '../modder/pipeline.ts'
import { SelfState } from '../agent/state.ts'
export const REPO = resolve(fileURLToPath(new URL('../../../..', import.meta.url)))

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
  return new Modder({ library, state, model, log: o.log, probes: o.game.probes, data })
}

/**
 * A game's definition, for the command lines: a bundle (its bundle.json, or the folder that holds one), a
 * project's folder (compiled: its game.json), or a module (its default export, or `GAME`).
 */
export async function loadGame(module: string): Promise<GameDef> {
  const at = resolve(REPO, module)
  const dir = existsSync(at) && statSync(at).isDirectory()
  if (at.endsWith('.json') || (dir && existsSync(join(at, 'bundle.json')))) return gameDefOf(JSON.parse(readFileSync(at.endsWith('.json') ? at : join(at, 'bundle.json'), 'utf8')) as Bundle)
  if (dir && existsSync(join(at, 'game.json'))) {
    const c = compileProject(at)
    const errors = c.problems.filter((p) => p.level === 'error')
    if (errors.length) throw new Error(`${module} does not compile: ${errors.map((p) => p.message).join('; ')}`)
    return gameDefOf(c.bundle)
  }
  const m = (await import(pathToFileURL(resolve(REPO, module)).href)) as { default?: GameDef; GAME?: GameDef }
  const game = m.default ?? m.GAME
  if (!game) throw new Error(`${module} exports no game (a default export or GAME)`)
  return game
}
