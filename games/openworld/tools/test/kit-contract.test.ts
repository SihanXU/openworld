// The one skill system's contract (docs/skills.md §4): what both kits — the minor monsters' (content kits.ts) and the
// bosses' (content bosses.ts) — hold to, so that two designers writing them never need each other's code.
import '../../client/src/register.ts'
import { describe, expect, it } from 'vitest'
import type { Effect, KitSkill, Rule } from '@openworld/engine'
import { CHAIN_MAX } from '@openworld/modules'
import { AFFLICTIONS, BASE_RULES, BOSSES, HOLDS, KITS, buildOntology } from '@openworld-game/content'

const onto = buildOntology()
const BOSS_TYPES = new Set(BOSSES.map((b) => b.type))
const kinds = Object.entries(onto.kits ?? {})
const minor = kinds.filter(([type]) => !BOSS_TYPES.has(type))
const bosses = kinds.filter(([type]) => BOSS_TYPES.has(type))

/** The branch a kind's own `act/use` rule takes for a skill: its tree's `kit` answer. */
function answerOf(type: string, id: string): { rule: Rule; tree: unknown } | undefined {
  const rule = BASE_RULES.find((r) => r.on === 'act/use' && r.host?.type === type)
  let t: any = rule?.tree
  while (t && typeof t === 'object' && 'if' in t) {
    if (t.if?.param?.key === 'kit' && t.if.param.cmp === id) return { rule: rule!, tree: t.then }
    t = t.else
  }
  return undefined
}
const effectsOf = (tree: any): Effect[] => (tree && typeof tree === 'object' && 'do' in tree ? tree.do : tree && typeof tree === 'object' && 'if' in tree ? [...effectsOf(tree.then), ...effectsOf(tree.else)] : [])
const mulOf = (e: Effect) => (e.op === 'unleash' && e.power && typeof e.power === 'object' && 'mul' in e.power ? e.power.mul ?? 1 : undefined)

describe('one skill system, two kits', () => {
  it('answers every skill of every kind with that kind\'s own rule', () => {
    for (const [type, kit] of kinds) for (const s of kit) expect(answerOf(type, s.id), `${type} ${s.id}`).toBeDefined()
  })

  it('keeps every wind-up readable: a minor monster\'s at least 0.6 s, a boss\'s 1.0 s (0.6 s for the next of a chain and for an answering skill, taken up as a minor monster\'s is)', () => {
    // a skill that marks no cell (a call, a guard: a howl, shelling up) threatens no one where they stand: no floor
    const marks = (s: KitSkill) => !(s.aim === 'self' && s.shape === 'circle' && s.radius === 0)
    for (const [type, kit] of minor) for (const s of kit) if (marks(s)) expect(s.windup, `${type} ${s.id}`).toBeGreaterThanOrEqual(6)
    for (const [type, kit] of bosses) {
      const quick = new Set([...kit.flatMap((s) => (s.then ? [s.then] : [])), ...(onto.encounters?.[type]?.reactive ?? [])])
      for (const s of kit) if (marks(s)) expect(s.windup, `${type} ${s.id}`).toBeGreaterThanOrEqual(quick.has(s.id) ? 6 : 10)
    }
  })

  it('keeps every blow within its tier: ×0.8–2.0 of a minor monster\'s attack, ×0.6–2.0 of a boss\'s', () => {
    for (const [tier, list, [lo, hi]] of [['minor', minor, [0.8, 2]], ['boss', bosses, [0.6, 2]]] as const)
      for (const [type, kit] of list) for (const s of kit) for (const e of effectsOf(answerOf(type, s.id)?.tree)) {
        const mul = mulOf(e)
        if (mul === undefined) continue
        expect(mul, `${tier} ${type} ${s.id}`).toBeGreaterThanOrEqual(lo)
        expect(mul, `${tier} ${type} ${s.id}`).toBeLessThanOrEqual(hi)
      }
  })

  it('chains only to a skill of the same kit, never round in a circle, never longer than the module lets it', () => {
    for (const [type, kit] of kinds) {
      const byId = new Map(kit.map((s) => [s.id, s]))
      for (const s of kit) {
        const seen = new Set<string>([s.id])
        let next: KitSkill | undefined = s
        while (next?.then) {
          expect(byId.has(next.then), `${type} ${next.id} → ${next.then}`).toBe(true)
          expect(seen.has(next.then), `${type}: a chain that comes round to ${next.then}`).toBe(false)
          seen.add(next.then)
          next = byId.get(next.then)
        }
        expect(seen.size - 1, `${type} ${s.id}`).toBeLessThanOrEqual(CHAIN_MAX)
      }
    }
  })

  it('leaves only what the game knows clinging to a body, and no hold follows a hold', () => {
    for (const [type, kit] of kinds) for (const s of kit) for (const e of effectsOf(answerOf(type, s.id)?.tree)) {
      if (e.op === 'unleash' && e.coat) expect(AFFLICTIONS, `${type} ${s.id}`).toContain(e.coat)
      if (e.op === 'unleash' && e.leave) expect(onto.types[e.leave], `${type} ${s.id}`).toBeDefined()
    }
    for (const s of AFFLICTIONS) expect(onto.statuses?.[s], s).toBeDefined()
    for (const s of HOLDS) {
      expect(onto.statuses![s].immobilize, s).toBe(true)
      expect(onto.statuses![s].duration ?? 0, s).toBeLessThanOrEqual(15)
      expect(onto.statuses!.steadied.wards).toContain(s)
    }
  })

  it('draws every skill\'s effect from the game\'s own', () => {
    for (const [type, kit] of kinds) for (const s of kit) if (s.fx) expect(onto.vfx, `${type} ${s.id}`).toContain(s.fx)
  })

  it('gives every boss fight phases from full health down, each naming skills of its kit, and a plate', () => {
    for (const [type, fight] of Object.entries(onto.encounters ?? {})) {
      const kit = new Set((onto.kits?.[type] ?? []).map((s) => s.id))
      expect(fight.phases[0].at, type).toBe(1)
      fight.phases.forEach((ph, i) => {
        if (i) expect(ph.at, type).toBeLessThan(fight.phases[i - 1].at)
        for (const id of [...ph.rotation, ...(ph.enter ? [ph.enter] : [])]) expect(kit.has(id), `${type} ${id}`).toBe(true)
        expect(ph.rotation.length, type).toBeGreaterThan(0)
      })
      for (const id of fight.reactive ?? []) {
        expect(kit.has(id), `${type} ${id}`).toBe(true)
        // an answering skill has the conditions it is taken up by
        expect(onto.kits![type].find((s) => s.id === id)!.range, `${type} ${id}`).toBeDefined()
      }
      expect(fight.plate.color, type).toBeGreaterThan(0)
    }
  })

  it('keeps the minor monsters\' kits Bao\'s own: the fourteen families, one or two skills each', () => {
    expect(Object.keys(KITS)).toHaveLength(14)
    for (const [type, kit] of Object.entries(KITS)) expect(kit.length, type).toBeLessThanOrEqual(2)
  })
})
