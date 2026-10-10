// The AI as co-author, the format's part (docs/engine-split.md P6): a project's holes, a patch taken into the game
// (learned/), the builder's brushes, people in bulk.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, decodeRawChunk, holeKey, type RawChunk, type Rule } from '@openworld/engine'
import { compile, generateCrowd, holeScenario, holesFor, paintOrganic, paintPath, rngOf, scatter, yard, type Project } from '../src/index.ts'
import { readProject } from '../src/node.ts'

const STARTER = fileURLToPath(new URL('../../../games/starter', import.meta.url))
const here = existsSync(STARTER)
const fresh = (): Project => readProject(STARTER)

describe.skipIf(!here)('the holes', () => {
  it('finds where the world has no answer: a bare hand on the slime falls into the root of handling', () => {
    const c = compile(fresh())
    const r = holesFor(c.bundle.ontology, c.bundle.rules)
    expect(r.checked).toBeGreaterThan(50)
    const slime = r.cells.find((x) => x.verb === 'hands' && x.target === 'actor/creature/slime')
    expect(slime).toMatchObject({ rule: 'core/handle', kind: 'impulse/handle', host: 'actor/creature/slime' })
    // what is answered is no hole: a hand on Mira talks, the axe on a tree chops
    expect(r.cells.some((x) => x.verb === 'hands' && x.target === 'actor/person/villager')).toBe(false)
    expect(r.cells.some((x) => x.hand === 'item/tool/axe' && x.target === 'tile/tree')).toBe(false)
    expect(holeScenario(slime!).event).toMatchObject({ kind: 'act/hands', target: 'target' })
  })

  it('a patch taken into the game (learned/) fills its hole, ships in the bundle, and every new game begins with it', () => {
    const p = fresh()
    const rule: Rule = { id: 'slime/handle', doc: 'A slime handled wobbles.', host: { type: 'actor/creature/slime' }, on: 'impulse/handle', hole: holeKey('core/handle', []), tree: { do: [{ op: 'log', text: { en: 'It wobbles.', zh: '它晃了晃。' } }] }, source: { origin: 'patch', at: '2026-10-10T00:00:00Z' } }
    p.learned = [{ file: 'learned/slime-handle.json', data: { rules: [rule] } }]
    const c = compile(p)
    expect(c.problems).toEqual([])
    expect(c.bundle.learned?.rules.map((r) => r.id)).toEqual(['slime/handle'])
    // counted with the patches it ships with, the hole is answered
    expect(holesFor(c.bundle.ontology, c.bundle.rules, { targets: ['actor/creature/slime'] }).cells.some((x) => x.verb === 'hands')).toBe(true)
    expect(holesFor(c.bundle.ontology, c.bundle.rules, { targets: ['actor/creature/slime'], learned: c.bundle.learned }).cells.some((x) => x.verb === 'hands')).toBe(false)
    // the base rules alone still have the hole; with the learned library it is answered
    const game = Game.create(c.index, structuredClone(c.bundle.ontology), new RuleLibrary(c.bundle.rules))
    const lib = game.engine.lib
    for (const r of c.bundle.learned!.rules) lib.add(r)
    for (const ch of c.chunks) game.loadChunk(decodeRawChunk(ch, c.bundle.terrainChars))
    const res = game.engine.resolveEvent({ kind: 'impulse/handle', host: { e: 'glade.slime' }, roles: { actor: { e: 'player' } } })
    expect(res.rule?.id).toBe('slime/handle')
  })

  it('a learned rule whose place is gone is a problem', () => {
    const p = fresh()
    p.learned = [{ file: 'learned/bad.json', data: { rules: [{ id: 'x/y', host: { type: 'actor/creature/slime' }, on: 'impulse/handle', hole: holeKey('core/nothing', []), tree: { do: [] }, source: { origin: 'patch' } }] } }]
    expect(compile(p).problems.map((x) => x.code)).toContain('learned')
  })
})

describe.skipIf(!here)('the brushes', () => {
  const glade = () => structuredClone(fresh().maps.find((m) => m.data.map.id === 'glade')!.data) as RawChunk
  it('draw the same from the same seed, and keep their strokes', () => {
    const a = glade(), b = glade()
    paintPath(a, [[2, 12], [8, 13], [14, 12]], '=', 42, { width: 1, edge: '*' })
    paintPath(b, [[2, 12], [8, 13], [14, 12]], '=', 42, { width: 1, edge: '*' })
    expect(a.map.rows).toEqual(b.map.rows)
    expect(a.map.rows.join('')).not.toEqual(glade().map.rows.join(''))
    expect(a.map.strokes?.[0]).toMatchObject({ brush: 'path', seed: 42 })
    paintOrganic(a, 18, 11, 3, 2, '~', 7, { only: ['.'] })
    expect(a.map.rows.slice(9, 14).join('')).toContain('~')
    expect(rngOf(5)()).toBe(rngOf(5)())
  })

  it('scatter things by a mask, and fence a yard with a gate', () => {
    const c = glade()
    const taken = new Set(c.entities.map((e) => e.id))
    const s = scatter(c, [1, 6, 10, 8], 'item/material/stone', 0.5, 3, taken, { on: ['.'] })
    const stones = c.entities.filter((e) => e.type === 'item/material/stone' && e.id.startsWith('glade.stone') && !['glade.stone1', 'glade.stone2'].includes(e.id))
    expect(stones.length).toBe(s.params?.placed)
    for (const e of stones) expect(e.place.on === 'tile' && c.map.rows[e.place.y][e.place.x]).toBe('.')
    const before = c.entities.length
    yard(c, [14, 8, 5, 4], 'fixture/sign', taken, [[16, 11]])
    expect(c.entities.length - before).toBe(5 * 2 + 2 * 2 - 1)
    const p = fresh()
    p.maps = p.maps.map((m) => (m.data.map.id === 'glade' ? { ...m, data: c } : m))
    expect(compile(p).problems.filter((x) => x.level === 'error')).toEqual([])
  })
})

describe.skipIf(!here)('people in bulk', () => {
  it('a crowd of people with names, days over the anchors, and lines — and the game compiles with them', () => {
    const p = fresh()
    const crowd = generateCrowd({ n: 30, seed: 9, type: 'actor/person/villager', map: 'glade', anchors: ['glade:garden', 'glade:woodlot', 'glade:pond'], taken: new Set(['npc.mira']), place: (i) => ({ x: 2 + (i % 18), y: 7 + Math.floor(i / 18) }) })
    expect(new Set(crowd.map((c) => c.id)).size).toBe(30)
    expect(crowd.every((c) => c.npc!.schedule.length === 5 && c.npc!.person!.lines!.length >= 1)).toBe(true)
    expect(generateCrowd({ n: 3, seed: 9, type: 't', map: 'm', anchors: ['m:a'] }).map((c) => c.id)).toEqual(generateCrowd({ n: 3, seed: 9, type: 't', map: 'm', anchors: ['m:a'] }).map((c) => c.id))
    p.people.push(...crowd.map((c) => ({ file: join('people', `${c.id}.json`), data: c })))
    const c = compile(p)
    expect(c.problems.filter((x) => x.level === 'error')).toEqual([])
    expect(c.index.npcs).toHaveLength(31)
  })
})
