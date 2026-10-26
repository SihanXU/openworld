import { describe, expect, it } from 'vitest'
import { RuleLibrary } from '@openworld/engine'
import { BASE_RULES, buildOntology } from '@openworld-game/content'
import { sweep } from '../../tools/src/coverage.ts'
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
      // the request is for the hole the sweep found: the act itself, or an impulse it sent
      expect(req.hole.rule).toBe(cell.hole)
      if (req.event.kind.startsWith('act/')) expect(req.event.kind).toBe(`act/${cell.verb}`)
      expect([req.event.host?.type, req.event.roles.instrument?.type]).toContain(cell.hand)
      expect(req.context.tiles).toHaveLength(7)
      // open ground around the event, but for the target's own tile
      expect(req.scenario.terrain!.flat().filter((t) => t !== 'grass').length, cell.target).toBeLessThanOrEqual(1)
    }
  })
})
