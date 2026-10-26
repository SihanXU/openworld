// The live evaluations' modder (ford-live, eval-affordance, eval-objects) and the answers it gives a port.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { patchRules, type Engine, type ModPort, type Patch, type Rule } from '@openworld/engine'
import { GAME } from '@openworld-game/content'
import { openModder, type Harness, type Modder, type Model, type WorldEpisode } from '@openworld/ai'
import { sleep } from './cli.ts'

/** A modder in the live profile on a fresh library and self-state (`prefix` in the temp dir): review, reflection and escalation off. */
export function liveModder(model: Model, prefix: string, label: string, more: Partial<Harness> = {}): Modder {
  const modder = openModder({ game: GAME, data: mkdtempSync(join(tmpdir(), prefix)), model })
  const { state } = modder.opts
  const h = state.harness()
  state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, ...more }, label)
  return modder
}

/** The modder answers what the port asks, live (the port waits for the model, not the clock): its patches and episodes as they come. */
export function answering(port: ModPort, modder: Modder): { patches: Patch[]; episodes: string[] } {
  const patches: Patch[] = []
  const episodes: string[] = []
  port.timeoutTicks = 1e9
  port.provider = {
    resolve: async (req) => {
      const reply = await modder.resolve({ request: req }, 'live')
      if (reply.episode) episodes.push(reply.episode)
      if (reply.patch) patches.push(reply.patch)
      return reply.patch
    },
  }
  return { patches, episodes }
}

/** Follow the act: each answer is replayed, and what it sends on may be the next hole; up to `max` holes or five minutes, then `settle` ticks. */
export async function follow(eng: Engine, port: ModPort, t0: number, max: number, settle: number): Promise<void> {
  while (Date.now() - t0 < 300_000) {
    eng.tick()
    if (!port.records.some((r) => r.status === 'pending' || r.awaiting)) break
    if (port.records.length > max) break
    await sleep(200)
  }
  for (let i = 0; i < settle; i++) eng.tick()
}

export const rulesOf = (patches: Patch[]): Rule[] => patches.flatMap(patchRules)

/** The episodes of these ids that the modder's self-state holds. */
export const episodesOf = (modder: Modder, ids: string[]): WorldEpisode[] =>
  ids.map((id) => modder.opts.state.episode(id) as WorldEpisode | undefined).filter((e): e is WorldEpisode => !!e)
