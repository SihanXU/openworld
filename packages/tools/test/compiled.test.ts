import { describe, expect, it } from 'vitest'
import { RuleLibrary, isDo, isHole, type Resolution } from '@lsw/engine'
import { sweep } from '../src/coverage.ts'

/** A resolution as the game uses it: whether it is defined, which rule decided, what the leaf does (its source mark aside). */
const shape = (r: Resolution) => ({
  defined: r.defined,
  rule: r.rule?.id,
  leaf: r.leaf && (isDo(r.leaf) ? { do: r.leaf.do, label: r.leaf.label, confirm: r.leaf.confirm } : isHole(r.leaf) ? { hole: r.leaf.default ?? [] } : r.leaf),
  hole: r.hole?.rule.id,
})

describe('the compiled tree (design.md §5.16)', () => {
  it('answers every act of every item form on every target, and every impulse they send, as the chain of rules does', () => {
    const orig = RuleLibrary.prototype.resolve
    let n = 0
    const diffs: string[] = []
    RuleLibrary.prototype.resolve = function (ev, roles, world) {
      const saved = world.state.rng
      const chained = this.resolveByChain(ev, roles, world)
      world.state.rng = saved
      const compiled = orig.call(this, ev, roles, world)
      n++
      const a = JSON.stringify(shape(chained))
      const b = JSON.stringify(shape(compiled))
      if (a !== b && diffs.length < 5) diffs.push(`${ev.kind} on ${roles.host?.type}: chain ${a} / compiled ${b}`)
      return compiled
    }
    try {
      sweep()
    } finally {
      RuleLibrary.prototype.resolve = orig
    }
    expect(diffs).toEqual([])
    expect(n).toBeGreaterThan(50_000)
  }, 600_000)
})
