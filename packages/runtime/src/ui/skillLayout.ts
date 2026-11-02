// Pure layout for one direction of the skill tree: the start in the middle and its four branches growing out from it,
// left, right, up and down. Each branch is laid out as the tiered talent trees of action RPGs are (Diablo II's skill
// tabs, World of Warcraft's classic talent grid): a panel of its own, its hub nearest the start and its skills in rows
// outward by how deep they lie, so what one needs before a skill is always the row before it. Within a branch the columns are a tidy tree's: each leaf a column of its own, a skill
// centred over the skills that grow from it, a capstone that joins two arms between them. Branch hubs exist even
// before their skills are designed; learning starts at a branch's first skill, not at its hub.

import { onPath, type SkillDef } from '@openworld/engine'
import { game } from '../game.ts'

/** Across one column of a branch, and down one row. */
export const COL = 124
export const ROW = 140
/** How far a side branch's hub stands from the start, and a branch panel's margin. */
const HUB_OUT = 190
const PAD = 64

export interface Placed {
  x: number
  y: number
}

/** A branch's panel: its frame, behind its hub and skills. */
export interface Panel {
  x: number
  y: number
  w: number
  h: number
}

export interface TreeLayout {
  hubs: Map<string, Placed>
  nodes: Map<string, Placed>
  panels: Map<string, Panel>
  /** Which way each branch grows. */
  ways: Map<string, Way>
  /** Where each branch's trunk comes from: the start, or (a branch after another) the last skill of the one before. */
  trunks: Map<string, Placed>
}

/** How deep a skill lies in its branch: its first skills 0, the next row 1, a skill after two the row below the deeper. */
function depths(own: SkillDef[]): Map<string, number> {
  const byId = new Map(own.map((s) => [s.id, s]))
  const out = new Map<string, number>()
  const of = (s: SkillDef): number => {
    if (!out.has(s.id)) {
      const ps = (s.requires ?? []).map((id) => byId.get(id)).filter((p): p is SkillDef => !!p)
      out.set(s.id, ps.length ? Math.max(...ps.map(of)) + 1 : 0)
    }
    return out.get(s.id)!
  }
  own.forEach(of)
  return out
}

/** The columns of one branch (a tidy tree; a capstone moved between its parents where the row is free there). */
function columns(own: SkillDef[], depth: Map<string, number>): Map<string, number> {
  const ids = new Set(own.map((s) => s.id))
  const parent = (s: SkillDef) => (s.requires ?? []).find((r) => ids.has(r))
  const kids = new Map<string, SkillDef[]>()
  for (const s of own) {
    const key = parent(s) ?? ''
    kids.set(key, [...(kids.get(key) ?? []), s])
  }
  const col = new Map<string, number>()
  let next = 0
  const place = (s: SkillDef): number => {
    const cs = kids.get(s.id) ?? []
    if (!cs.length) col.set(s.id, next++)
    else {
      const placed = cs.map(place)
      col.set(s.id, (placed[0] + placed[placed.length - 1]) / 2)
    }
    return col.get(s.id)!
  }
  for (const root of kids.get('') ?? []) place(root)
  // a skill after two (a capstone): between them, unless another stands there in its row
  for (const s of own) {
    const ps = (s.requires ?? []).filter((r) => ids.has(r))
    if (ps.length < 2) continue
    const mid = ps.reduce((n, p) => n + col.get(p)!, 0) / ps.length
    const crowded = own.some((o) => o.id !== s.id && depth.get(o.id) === depth.get(s.id) && Math.abs(col.get(o.id)! - mid) < 0.95)
    if (!crowded) col.set(s.id, mid)
  }
  return col
}

/**
 * Which way a branch grows from the start: the narrow two left and right, near it; the wide two up and down, beyond
 * them. A branch may name its way; the rest take the free ways in order. A direction of more than four branches goes
 * round again, each further one beyond the one before on its side. A branch after another (`after`: the second
 * advancement after the profession's own tree, the third after it) goes on beyond it, its trunk out of its last skill.
 */
export type Way = 'left' | 'right' | 'up' | 'down'
const WAYS: Way[] = ['left', 'right', 'up', 'down']
/** The room between two branch panels on one side. */
const GAP = 40

/** One direction of the tree laid out: the start in the middle, its four branches growing out from it like a cross. */
export function layoutTree(skills: SkillDef[] = game().skills.all, direction: string = 'combat', profession = '', path = ''): TreeLayout {
  const branches = game().skills.branches.filter((b) => b.direction === direction)
  // (a path's skills only for one on it: docs/advancement.md)
  const allowed = skills.filter((s) => (!s.profession || s.profession === profession) && onPath(s, path))
  const named = new Set(branches.map((b) => b.way))
  const free = WAYS.filter((w) => !named.has(w))
  let k = 0
  const wayOf = (b: (typeof branches)[number]): Way => {
    const before = b.after && per.find((p) => p.b.id === b.after)
    return before ? before.way : b.way ?? free[k++] ?? WAYS[(k - 1) % 4]
  }
  const per: { b: (typeof branches)[number]; own: SkillDef[]; depth: Map<string, number>; col: Map<string, number>; min: number; span: number; rows: number; way: Way }[] = []
  for (const b of branches) {
    const own = allowed.filter((s) => s.branch === b.id)
    const depth = depths(own)
    const col = columns(own, depth)
    const cols = [...col.values()]
    const min = cols.length ? Math.min(...cols) : 0
    const span = cols.length ? Math.max(...cols) - min : 0
    const rows = own.length ? Math.max(...depth.values()) + 1 : 0
    per.push({ b, own, depth, col, min, span, rows, way: wayOf(b) })
  }
  // how far out a branch's hub stands: left and right near the start; up and down past the side branches' panels
  const half = (p: (typeof per)[number]) => (Math.max(1, p.span) * COL) / 2 + PAD
  const side = Math.max(0, ...per.filter((p) => p.way === 'left' || p.way === 'right').map(half))
  const out = (way: Way) => (way === 'left' || way === 'right' ? HUB_OUT : Math.max(HUB_OUT, side + 90))
  const hubs = new Map<string, Placed>()
  const nodes = new Map<string, Placed>()
  const panels = new Map<string, Panel>()
  const ways = new Map<string, Way>()
  const trunks = new Map<string, Placed>()
  // how far out each side's panels already reach (a fifth branch and after stand beyond the one before them)
  const reached = new Map<Way, number>()
  for (const p of per) {
    // in the branch's own frame: `across` along its rows, `along` out from the start; then turned its way
    const turn = (across: number, along: number): Placed =>
      p.way === 'up' ? { x: across, y: -along } : p.way === 'down' ? { x: across, y: along } : p.way === 'left' ? { x: -along, y: across } : { x: along, y: across }
    const d = Math.max(out(p.way), (reached.get(p.way) ?? -Infinity) + GAP + 62)
    reached.set(p.way, d + ROW * Math.max(1, p.rows) + 70)
    const across = (c: number) => (c - p.min - p.span / 2) * COL
    for (const s of p.own) nodes.set(s.id, turn(across(p.col.get(s.id)!), d + ROW * (p.depth.get(s.id)! + 1)))
    // the hub straight behind its first skills (their middle), so the line into the branch runs straight
    const roots = p.own.filter((s) => p.depth.get(s.id) === 0).map((s) => across(p.col.get(s.id)!))
    hubs.set(p.b.id, turn(roots.length ? (Math.min(...roots) + Math.max(...roots)) / 2 : 0, d))
    // its panel: from just before the hub to past the last row, as wide as its columns
    const a = turn(-half(p), d - 62)
    const b2 = turn(half(p), d + ROW * Math.max(1, p.rows) + 70)
    panels.set(p.b.id, { x: Math.min(a.x, b2.x), y: Math.min(a.y, b2.y), w: Math.abs(a.x - b2.x), h: Math.abs(a.y - b2.y) })
    ways.set(p.b.id, p.way)
    // its trunk: from the start; after another branch, from that one's last row (the skill nearest in line), or its hub
    const before = p.b.after ? per.find((q) => q.b.id === p.b.after) : undefined
    const hub = hubs.get(p.b.id)!
    const last = before?.own.filter((s) => before.depth.get(s.id) === before.rows - 1).map((s) => nodes.get(s.id)!)
    const gap = (q: Placed) => (p.way === 'up' || p.way === 'down' ? Math.abs(q.x - hub.x) : Math.abs(q.y - hub.y))
    trunks.set(p.b.id, before ? (last?.length ? last.reduce((m, q) => (gap(q) < gap(m) ? q : m)) : hubs.get(before.b.id)!) : { x: 0, y: 0 })
  }
  return { hubs, nodes, panels, ways, trunks }
}

export function layoutBranches(direction: string, skills: SkillDef[] = game().skills.all, profession = ''): Map<string, Placed> {
  return layoutTree(skills, direction, profession).hubs
}

export function layoutSkills(skills: SkillDef[] = game().skills.all, direction: string = 'combat', profession = ''): Map<string, Placed> {
  return layoutTree(skills, direction, profession).nodes
}
