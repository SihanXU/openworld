import { describe, expect, it } from 'vitest'
import { RuleLibrary } from '@lsw/engine'
import { BASE_RULES, buildOntology } from '@lsw/content'
import { sweep } from '../src/coverage.ts'
import { cellRequest, pick } from '../src/curriculum.ts'

const onto = buildOntology()
const cov = sweep(onto)
const open = cov.cells.filter((c) => c.outcome === 'undefined')

describe('the curriculum', () => {
  it('samples undefined interactions across many targets', () => {
    const cells = pick(open, 30, 7)
    expect(cells).toHaveLength(30)
    expect(new Set(cells.map((c) => c.target)).size).toBe(30)
    expect(pick(open, 30, 7)).toEqual(cells) // seeded
  })

  it('turns every kind of swept cell into the request a player would raise', () => {
    const lib = new RuleLibrary(BASE_RULES)
    const kinds = ['tile:', 'fixture/', 'person', 'creature', 'self', 'item']
    for (const kind of kinds) {
      const cell = open.find((c) => c.target.startsWith(kind) && c.hand)!
      expect(cell, kind).toBeTruthy()
      const req = cellRequest(cell, onto, lib)!
      expect(req, `${cell.verb} ${cell.hand} → ${cell.target}`).toBeTruthy()
      expect(req.event.verb).toBe(cell.verb)
      expect(req.event.instrument?.type).toBe(cell.hand)
      expect(req.context.tiles).toHaveLength(7)
      const around = req.scenario.terrain!.flatMap((row, y) => row.filter((_, x) => x !== 3 || y !== 3))
      expect(around.every((t) => t === 'grass'), cell.target).toBe(true) // open ground around the target
    }
  })
})
