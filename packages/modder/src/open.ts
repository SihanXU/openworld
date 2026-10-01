// Wiring for this world: the content's ontology and base rules, the shared library file and
// the self-state directory under one data directory.

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { WorldLibrary } from './library.ts'
import { modelFromEnv, type Model } from './model.ts'
import { Modder } from './pipeline.ts'
import { SelfState } from './state.ts'

export const REPO = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

// Local secrets (the model key) live in <repo>/.env, which is not committed. Variables already
// set in the environment win.
if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))

export interface OpenOptions {
  /** Holds library.jsonl and modder-state/ (default: $LSW_DATA or <repo>/var). */
  data?: string
  /** Default: from the environment (model.ts modelFromEnv); null forces none. */
  model?: Model | null
  log?: (line: string) => void
}

export function openModder(o: OpenOptions = {}): Modder {
  const data = o.data ?? process.env.LSW_DATA ?? join(REPO, 'var')
  const library = new WorldLibrary(buildOntology(), [...BASE_RULES, ...STORY_RULES], join(data, 'library.jsonl'))
  const state = SelfState.open(join(data, 'modder-state'))
  const model = o.model === null ? undefined : (o.model ?? modelFromEnv())
  return new Modder({ library, state, model, log: o.log })
}
