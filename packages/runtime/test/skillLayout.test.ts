// The skill tree's layout (ui/skillLayout.ts): the start in the middle, a direction's branches growing out from it, each
// in a panel of its own. However many branches a game gives a direction, no two panels lie over each other.

import { describe, expect, it } from 'vitest'
import type { SkillDef } from '@openworld/engine'
import { useGame, type ClientGame } from '../src/game.ts'
import { layoutTree, type Panel } from '../src/ui/skillLayout.ts'

/** A direction of `n` branches, each a hub's first skill and two after it. */
function gameOf(n: number): SkillDef[] {
  const branches = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, direction: 'arts', name: `B${i}`, icon: '' }))
  const skills: SkillDef[] = branches.flatMap((b) => [
    { id: `${b.id}-1`, branch: b.id, name: '1' },
    { id: `${b.id}-2`, branch: b.id, name: '2', requires: [`${b.id}-1`] },
    { id: `${b.id}-3`, branch: b.id, name: '3', requires: [`${b.id}-1`] },
  ] as SkillDef[])
  useGame({ skills: { all: skills, branches, directions: [{ id: 'arts', name: 'Arts' }], professions: [] } } as unknown as ClientGame)
  return skills
}

const overlap = (a: Panel, b: Panel) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('the skill tree\'s layout', () => {
  for (const n of [4, 6, 9])
    it(`${n} branches in a direction: every branch its panel, every skill placed, no two panels over each other`, () => {
      const skills = gameOf(n)
      const t = layoutTree(skills, 'arts')
      expect(t.panels.size).toBe(n)
      expect(t.nodes.size).toBe(skills.length)
      const panels = [...t.panels.values()]
      for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) expect(overlap(panels[i], panels[j]), `b${i} and b${j}`).toBe(false)
      // each skill inside its own branch's panel
      for (const s of skills) {
        const p = t.panels.get(s.branch!)!
        const at = t.nodes.get(s.id)!
        expect(at.x >= p.x && at.x <= p.x + p.w && at.y >= p.y && at.y <= p.y + p.h, s.id).toBe(true)
      }
    })
})
