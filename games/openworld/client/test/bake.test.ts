// The Ford baked (docs/engine-split.md P3): OpenWorld written as a project in the format compiles, by the same
// compiler as any game, into the very world its builders make — through its files on disk as well.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compile } from '@openworld/format'
import { readProject } from '@openworld/format/src/node.ts'
import { GAME } from '@openworld-game/content'
import { buildFord } from '../../tools/src/demo/world.ts'
import { bake, fordProject } from '../scripts/bake.ts'

describe('the Ford baked into the format', () => {
  const ford = buildFord()
  const project = fordProject()
  const made = compile(project)

  it('compiles with no error, and the compiler finds what it finds in any game', () => {
    expect(made.problems.filter((p) => p.level === 'error')).toEqual([])
  })

  it('is the same world: every map with its ids, every person, quest, step and invariant', () => {
    expect(made.chunks).toEqual(ford.chunks)
    expect(made.index.npcs).toEqual(ford.index.npcs)
    expect(made.index.maps).toEqual(ford.index.maps)
    for (const k of ['quests', 'steps', 'invariants', 'weather', 'player', 'companions', 'start', 'starts', 'begin', 'startHour', 'seed', 'version', 'bosses', 'codex', 'waypoints'] as const) expect(made.index[k], k).toEqual(ford.index[k])
    expect(new Set(made.index.protectedFacts)).toEqual(new Set(ford.index.protectedFacts))
    // (the Ford counts what its builders placed; the compiler counts the overworld's map too)
    expect({ ...made.index.stats, maps: made.index.stats.maps - 1 }).toEqual(ford.index.stats)
  })

  it('is the same game: its ontology and its rules', () => {
    expect(made.bundle.ontology).toEqual(GAME.ontology())
    expect(made.bundle.rules.map((r) => r.id)).toEqual(GAME.rules.map((r) => r.id))
  })

  it('reads back from its files as it was written', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ford-'))
    try {
      bake(dir)
      const back = compile(readProject(dir))
      expect(back.chunks).toEqual(made.chunks)
      expect(back.index).toEqual(made.index)
      expect(back.bundle).toEqual(made.bundle)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
