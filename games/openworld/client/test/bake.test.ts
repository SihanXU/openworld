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

/**
 * What the baked game says, set beside what the builders made: a text the builders left in English alone that the
 * table translates (the same words translated elsewhere: a table's translation is said wherever its source is) is
 * taken as the builders' — the one difference the tables make (docs/engine-split.md §19).
 */
function asBuilt(got: unknown, want: unknown): unknown {
  if (typeof want === 'string' && got && typeof got === 'object' && !Array.isArray(got) && (got as { en?: unknown }).en === want) return want
  if (Array.isArray(got) && Array.isArray(want)) return got.map((g, i) => asBuilt(g, want[i]))
  if (got && want && typeof got === 'object' && typeof want === 'object' && !Array.isArray(got)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(got)) if (!(k.startsWith('text_') && !(k in (want as object)))) out[k] = asBuilt(v, (want as Record<string, unknown>)[k])
    return out
  }
  return got
}

describe('the Ford baked into the format', () => {
  const ford = buildFord()
  const project = fordProject()
  const made = compile(project)
  const same = (got: unknown, want: unknown, what?: string) => expect(asBuilt(got, want), what).toEqual(want)

  it('compiles with no error, and the compiler finds what it finds in any game', () => {
    expect(made.problems.filter((p) => p.level === 'error')).toEqual([])
  })

  it('is the same world: every map with its ids, every person, quest, step and invariant', () => {
    same(made.chunks, ford.chunks)
    same(made.index.npcs, ford.index.npcs)
    same(made.index.maps, ford.index.maps)
    for (const k of ['quests', 'steps', 'invariants', 'weather', 'player', 'companions', 'start', 'starts', 'begin', 'startHour', 'seed', 'version', 'codex', 'waypoints'] as const) same(made.index[k], ford.index[k], k)
    expect(new Set(made.index.protectedFacts)).toEqual(new Set(ford.index.protectedFacts))
    // (the Ford counts what its builders placed; the compiler counts the overworld's map too)
    expect({ ...made.index.stats, maps: made.index.stats.maps - 1 }).toEqual(ford.index.stats)
  })

  it('is the same game: its ontology and its rules', () => {
    same(made.bundle.ontology, GAME.ontology())
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
