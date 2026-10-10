// Pure layout for one direction of the skill tree. Branch hubs exist even before their
// skills are designed; learning starts at a branch's first skill, not at its hub.

import type { SkillDef } from '@openworld/engine'
import { SKILLS, SKILL_BRANCHES, type SkillDirection } from '@openworld-game/content'

const BRANCH_RADIUS = 170
const SKILL_RADIUS = 300
const STEP = 110
const SWAY = 4

export interface Placed {
  x: number
  y: number
  angle: number
}

const polar = (radius: number, angle: number): Placed => {
  const rad = (angle * Math.PI) / 180
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad), angle }
}

export function layoutBranches(direction: SkillDirection): Map<string, Placed> {
  const branches = SKILL_BRANCHES.filter((b) => b.direction === direction)
  return new Map(branches.map((b, i) => [b.id, polar(BRANCH_RADIUS, -90 + (i * 360) / branches.length)]))
}

export function layoutSkills(skills: SkillDef[] = SKILLS, direction: SkillDirection = 'combat', profession = ''): Map<string, Placed> {
  const branches = layoutBranches(direction)
  const allowed = skills.filter((s) => !s.profession || s.profession === profession)
  const kids = new Map<string, SkillDef[]>()
  for (const s of allowed) {
    const key = `${s.branch}|${s.requires?.[0] ?? ''}`
    kids.set(key, [...(kids.get(key) ?? []), s])
  }
  const children = (s: SkillDef) => kids.get(`${s.branch}|${s.id}`) ?? []
  const leaves = (s: SkillDef): number => children(s).reduce((n, c) => n + leaves(c), 0) || 1
  const out = new Map<string, Placed>()
  const spread = (list: SkillDef[], a0: number, a1: number, depth: number) => {
    const total = list.reduce((n, s) => n + leaves(s), 0)
    let angle = a0
    for (const s of list) {
      const width = ((a1 - a0) * leaves(s)) / total
      const sway = list.length === 1 && depth > 0 ? (depth % 2 ? -SWAY : SWAY) : 0
      out.set(s.id, polar(SKILL_RADIUS + STEP * depth, angle + width / 2 + sway))
      spread(children(s), angle, angle + width, depth + 1)
      angle += width
    }
  }
  const sector = 360 / Math.max(1, branches.size)
  for (const [id, hub] of branches) {
    spread(kids.get(`${id}|`) ?? [], hub.angle - sector * 0.4, hub.angle + sector * 0.4, 0)
  }
  // A capstone joins both arms: place it beyond every prerequisite, between their angles.
  const byId = new Map(allowed.map((s) => [s.id, s]))
  const depths = new Map<string, number>()
  const depthOf = (s: SkillDef): number => {
    if (!depths.has(s.id)) depths.set(s.id, (s.requires?.length ? Math.max(...s.requires.map((id) => depthOf(byId.get(id)!))) + 1 : 0))
    return depths.get(s.id)!
  }
  for (const s of allowed.filter((s) => out.has(s.id))) {
    const parents = (s.requires ?? []).map((id) => out.get(id)!)
    const angle = parents.length > 1 ? parents.reduce((n, p) => n + p.angle, 0) / parents.length : out.get(s.id)!.angle
    out.set(s.id, polar(SKILL_RADIUS + STEP * depthOf(s), angle))
  }
  return out
}
