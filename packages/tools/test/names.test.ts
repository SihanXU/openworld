// What the keys say names a thing as what it is: a waypoint statue is "the Ford statue", not "the Ford".

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, textOf } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@lsw/content'
import { buildFord } from '../src/demo/world.ts'

describe('names', () => {
  it('every waypoint statue is named as a statue', () => {
    const { chunks } = buildFord()
    const statues = chunks.flatMap((c) => decodeChunk(c).entities).filter((e) => e.type === 'fixture/sacred/waypoint')
    expect(statues.length).toBeGreaterThan(5)
    for (const s of statues) {
      expect(textOf(s.name, 'en'), s.id).toMatch(/statue$/)
      expect(textOf(s.name, 'zh'), s.id).toMatch(/传送雕像$/)
    }
  })
})

describe('homes', () => {
  it('no two anchors of a map are one cell (people of one home share an anchor; two homes never do)', () => {
    const { chunks } = buildFord()
    for (const c of chunks) {
      const m = decodeChunk(c).map
      const by: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(m.anchors ?? {})) (by[`${v[0]},${v[1]}`] ??= []).push(k)
      for (const [cell, ks] of Object.entries(by)) expect(ks, `${m.id} ${cell}`).toHaveLength(1)
    }
  })
})

describe('news', () => {
  it('every topic the story raises is told by someone (a topic nobody speaks of is lost)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const dir = join(__dirname, '../src/demo')
    const files = [...readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f)), ...readdirSync(join(dir, 'quest')).map((f) => join(dir, 'quest', f))]
    const raised = new Set(files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\{ topic: '([a-z_]+)'/g)].map((m) => m[1])))
    const { index, chunks } = buildFord()
    const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    const people = Object.values(game.engine.world.state.entities).filter((e) => e.npc?.person)
    expect(people.length).toBeGreaterThan(10)
    const told = new Set(people.flatMap((e) => e.npc!.person!.lines ?? []).filter((l) => l.key.startsWith('topic:')).map((l) => l.key.slice(6)))
    expect(raised.size).toBeGreaterThan(0)
    for (const t of raised) expect(told.has(t), t).toBe(true)
  })
})
