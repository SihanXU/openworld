// The rule bench (rulebench.ts): its frozen holes are kinds of task that recur, each hole a place of its own; every
// arm works them in one order; the report pairs the arms hole by hole.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RuleLibrary } from '@openworld/engine'
import { GAME } from '@openworld-game/content'
import { skillNodeOf } from '@openworld/ai'
import { cellRequest } from '../src/curriculum.ts'
import { mcnemar, nodeOfCell, report, streamOf, type Bench, type Row } from '../src/rulebench.ts'

const bench = JSON.parse(readFileSync(fileURLToPath(new URL('../bench/rulebench.json', import.meta.url)), 'utf8')) as Bench

describe('the rule bench', () => {
  it('holds 20 kinds of task of 10 holes each, every hole a place of its own and of its node', () => {
    expect(bench.nodes).toHaveLength(20)
    expect(bench.nodes.every((n) => n.cells.length === 10)).toBe(true)
    const places = bench.nodes.flatMap((n) => n.cells.map((c) => c.open))
    // no two share a type|kind|hole: none is answered by another's patch
    expect(new Set(places).size).toBe(200)
    for (const n of bench.nodes) for (const c of n.cells) expect(nodeOfCell(c)).toBe(n.node)
    // no host class fills the bench (at most two nodes each)
    const hosts = bench.nodes.map((n) => n.node.split('|')[2])
    expect(Math.max(...hosts.map((h) => hosts.filter((x) => x === h).length))).toBeLessThanOrEqual(2)
  })

  it('groups the holes as the reflection does: each hole asked is of its node (request.ts skillNodeOf)', { timeout: 120_000 }, () => {
    const onto = GAME.ontology()
    const lib = new RuleLibrary(GAME.rules)
    const asked = bench.nodes.flatMap((n) => n.cells.map((c) => ({ n: n.node, req: cellRequest(c, onto, lib) })))
    // (a hole a later base rule answers is left out of a run, rulebench.ts; most of the bench must still be holes)
    const holes = asked.filter((a) => a.req)
    expect(holes.length).toBeGreaterThan(asked.length * 0.9)
    const off = holes.filter(({ n, req }) => skillNodeOf(req!) !== n)
    expect(off.map(({ n, req }) => `${n} ≠ ${skillNodeOf(req!)}`)).toEqual([])
  })

  it('works the first of every kind, then the second …; a rep is the same holes in another order', () => {
    const one = streamOf(bench, 1)
    expect(one).toHaveLength(200)
    expect(one.slice(0, 20).every((s) => s.occurrence === 1)).toBe(true)
    expect(one.slice(180).every((s) => s.occurrence === 10)).toBe(true)
    expect(streamOf(bench, 1)).toEqual(one)
    const two = streamOf(bench, 2)
    expect(two.map((s) => s.node)).not.toEqual(one.map((s) => s.node))
    expect(new Set(two.map((s) => s.cell.open))).toEqual(new Set(one.map((s) => s.cell.open)))
  })

  it('pairs the arms hole by hole (McNemar exact) and reports by the hole\'s place among its kind', () => {
    expect(mcnemar(4, 0)).toBeCloseTo(0.125)
    expect(mcnemar(3, 1)).toBeCloseTo(0.625)
    expect(mcnemar(0, 0)).toBe(1)
    const row = (arm: string, cell: string, occurrence: number, firstValid: boolean, input: number): Row => ({ arm, rep: 1, step: 0, node: 'n', occurrence, cell, outcome: 'accepted', firstValid, attempts: firstValid ? 1 : 2, calls: firstValid ? 1 : 2, input, output: 100, ms: 1000, reflect: { calls: 1, input: 500, output: 50 }, lessons: 0, skills: 0 })
    const text = report([row('on', 'a', 1, true, 1000), row('off', 'a', 1, false, 2000), row('on', 'b', 2, true, 900), row('off', 'b', 2, true, 1000)])
    expect(text).toContain('- on: n 2 · accepted 100% · first answer held 100%')
    expect(text).toContain('- off: n 2 · accepted 100% · first answer held 50%')
    expect(text).toContain('the first answer held in one arm only: on 1, off 0 (McNemar exact p = 1.000)')
    // (the arms in order: off, then on)
    expect(text).toMatch(/\| 1 \| 0% · 2\.1k · 1\.0 \| 100% · 1\.1k · 1\.0 \|/)
  })
})
