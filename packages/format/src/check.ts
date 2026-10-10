// What the compiler checks (docs/engine-split.md §5): what buildFord() checked for the Ford, for any project.
// References (types, maps, anchors, holders, aliases), sizes, portals, the rules (the patch validator's checks
// that hold for base rules too; the root total; no ties) — each a Problem the editor's validation panel shows.

import { EVENT_KINDS, RuleLibrary, registeredModule, compareSpec, hostsOverlap, isRoot, kindCovers, leaves, specOf, validatePatch, type Cond, type Entity, type Ontology, type RawChunk, type Rule, type Selector, type Tree, type WorldIndex } from '@openworld/engine'
import type { Problem, Project } from './project.ts'

interface Made {
  ontology: Ontology
  rules: Rule[]
  chunks: RawChunk[]
  npcs: Entity[]
  index: WorldIndex
}

/** What the validator says of base rules that only a learned rule must be (design.md §5.16): a base rule is none of it. */
const PLACEMENT = /host must be exactly|hole required|exact event kind|never inherits|no leaf answers|no default of its own|a quest is the content/

export function checkProject(p: Project, made: Made): Problem[] {
  const out: Problem[] = []
  const err = (code: string, message: string, file?: string, at?: string) => out.push({ level: 'error', code, message, ...(file && { file }), ...(at && { at }) })
  const warn = (code: string, message: string, file?: string, at?: string) => out.push({ level: 'warning', code, message, ...(file && { file }), ...(at && { at }) })
  const { ontology: onto, chunks, npcs } = made
  const fileOf = new Map(p.maps.map((f) => [f.data.map.id, f.file]))
  const mapOf = new Map(chunks.map((c) => [c.map.id, c.map]))
  const terrainOf = (map: string, x: number, y: number) => onto.terrains[p.game.terrainChars[mapOf.get(map)?.rows[y]?.[x] ?? ''] ?? '']
  const inBounds = (map: string, x: number, y: number) => { const m = mapOf.get(map); return !!m && x >= 0 && y >= 0 && x < m.width && y < m.height }
  const knownType = (t: string) => !!onto.types[t] || (t.startsWith('tile/') && !!onto.terrains[t.slice(5)])
  /** The nearest kind a type without a definition of its own is (the ontology resolves it by its prefixes). */
  const kindOf = (t: string): string | undefined => { for (let k = t; k.includes('/'); ) { k = k.slice(0, k.lastIndexOf('/')); if (onto.types[k]) return k } return undefined }
  /** A thing's type: known, or of a known kind (a warning: it is only that kind), or unknown (an error). */
  const typed = (what: string, t: string, file?: string, at?: string) => {
    if (knownType(t)) return
    const k = kindOf(t)
    if (k) warn('reference', `${what} is of the type "${t}", which has no definition of its own: it is a ${k}`, file, at)
    else err('reference', `${what} is of an unknown type "${t}"`, file, at)
  }

  // ---------------------------------------------------------------- the game
  for (const [c, t] of Object.entries(p.game.terrainChars)) if (!onto.terrains[t]) err('reference', `the character "${c}" stands for "${t}", which is no terrain`, 'game.json', 'terrainChars')
  for (const m of p.game.modules ?? []) if (!/^[a-z][a-z0-9-]*$/.test(m)) err('module', `"${m}" is not a module's name`, 'game.json', 'modules')
  const starts = { start: p.game.start, ...Object.fromEntries(Object.entries(p.game.starts ?? {}).map(([k, s]) => [`starts.${k}`, s.at])) }
  for (const [k, s] of Object.entries(starts)) if (!inBounds(s.map, s.x, s.y)) err('reference', `${k} (${s.map} ${s.x},${s.y}) is on no map`, 'game.json', k)
  if (!knownType(p.game.player.type)) err('reference', `the player is of an unknown type "${p.game.player.type}"`, 'game.json', 'player')

  // ---------------------------------------------------------------- the ontology
  for (const t of Object.keys(onto.types)) {
    const parent = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : undefined
    if (parent && !onto.types[parent]) warn('ontology', `the type "${t}" has no parent "${parent}" (its kind inherits nothing from it)`)
  }
  for (const [id, t] of Object.entries(onto.terrains)) if (t.stage?.into && !knownType(t.stage.into)) err('reference', `the terrain "${id}" grows into an unknown "${t.stage.into}"`)
  for (const [id, t] of Object.entries(onto.types)) if (t.stage?.into && !knownType(t.stage.into)) err('reference', `the type "${id}" grows into an unknown "${t.stage.into}"`)

  // ---------------------------------------------------------------- the maps
  const ids = new Map<string, string>()
  const own = (id: string, where: string) => {
    if (ids.has(id)) err('duplicate', `the id "${id}" is used twice (${ids.get(id)} and ${where})`, where)
    else ids.set(id, where)
  }
  own(p.game.player.id, 'game.json')
  for (const c of p.game.companions ?? []) own(c.id, 'game.json')
  const holders = new Set([...chunks.flatMap((c) => c.entities.map((e) => e.id)), ...npcs.map((n) => n.id), ...npcs.flatMap((n) => ((n as { _items?: Entity[] })._items ?? []).map((e) => e.id)), p.game.player.id, ...(p.game.companions ?? []).map((c) => c.id)])
  for (const c of chunks) {
    const m = c.map
    const file = fileOf.get(m.id)
    if (m.rows.length !== m.height) err('size', `${m.id} is ${m.height} high but has ${m.rows.length} rows`, file)
    m.rows.forEach((row, y) => {
      if (row.length !== m.width) err('size', `${m.id}: row ${y} is ${row.length} wide, not ${m.width}`, file, `rows[${y}]`)
      for (const [x, ch] of [...row].entries()) if (!(ch in p.game.terrainChars)) { err('reference', `${m.id}: "${ch}" at ${x},${y} stands for no terrain`, file, `rows[${y}]`); break }
    })
    if (m.heights && (m.heights.length !== m.height || m.heights.some((r) => r.length !== m.width || /[^0-9]/.test(r)))) err('size', `${m.id}: its heights are not one digit a cell, ${m.width} × ${m.height}`, file, 'heights')
    for (const [i, pt] of m.portals.entries()) {
      if (!inBounds(m.id, pt.x, pt.y)) err('portal', `${m.id}: portal ${i} at ${pt.x},${pt.y} is off the map`, file, `portals[${i}]`)
      if (!mapOf.has(pt.to)) err('portal', `${m.id}: portal ${i} leads to "${pt.to}", which is no map`, file, `portals[${i}]`)
      else if (!inBounds(pt.to, pt.tx, pt.ty)) err('portal', `${m.id}: portal ${i} lands at ${pt.tx},${pt.ty}, off ${pt.to}`, file, `portals[${i}]`)
      else if (terrainOf(pt.to, pt.tx, pt.ty)?.solid) warn('portal', `${m.id}: portal ${i} lands on solid ground in ${pt.to} (${pt.tx},${pt.ty})`, file, `portals[${i}]`)
    }
    for (const [name, [x, y]] of Object.entries(m.anchors ?? {})) {
      if (!inBounds(m.id, x, y)) err('anchor', `${m.id}: the anchor "${name}" (${x},${y}) is off the map`, file, `anchors.${name}`)
      else if (terrainOf(m.id, x, y)?.solid) err('anchor', `${m.id}: the anchor "${name}" (${x},${y}) is on solid ground`, file, `anchors.${name}`)
    }
    for (const [name, [x, y, w, h]] of Object.entries(m.regions ?? {})) if (!inBounds(m.id, x, y) || !inBounds(m.id, x + w - 1, y + h - 1)) warn('region', `${m.id}: the area "${name}" reaches off the map`, file, `regions.${name}`)
    for (const e of c.entities) {
      own(e.id, file ?? m.id)
      typed(e.id, e.type, file, e.id)
      const pl = e.place
      if (pl.on === 'tile') {
        if (pl.map !== m.id) err('place', `${e.id} is on ${pl.map}, but in the file of ${m.id}`, file, e.id)
        else if (!inBounds(m.id, pl.x, pl.y)) err('place', `${e.id} at ${pl.x},${pl.y} is off the map`, file, e.id)
      } else if ((pl.on === 'inside' || pl.on === 'hand') && !holders.has(pl.holder)) err('reference', `${e.id} is in "${pl.holder}", which is nothing`, file, e.id)
    }
  }

  // ---------------------------------------------------------------- the people
  const peopleFile = new Map(p.people.map((f) => [f.data.id, f.file]))
  const things = new Set([...holders, ...p.quests.map((q) => q.data.id)])
  for (const n of npcs) {
    const file = peopleFile.get(n.id)
    own(n.id, file ?? n.id)
    for (const it of (n as { _items?: Entity[] })._items ?? []) {
      own(it.id, file ?? n.id)
      typed(it.id, it.type, file, it.id)
    }
    typed(n.id, n.type, file)
    if (n.place.on === 'tile' && !inBounds(n.place.map, n.place.x, n.place.y)) err('place', `${n.id} at ${n.place.map} ${n.place.x},${n.place.y} is on no map`, file)
    for (const [i, s] of (n.npc?.schedule ?? []).entries()) {
      if (s.map && !inBounds(s.map, s.x, s.y)) err('reference', `${n.id}: schedule ${i} (${s.map} ${s.x},${s.y}) is on no map`, file, `npc.schedule[${i}]`)
      if (s.uses && !things.has(s.uses)) err('reference', `${n.id}: schedule ${i} uses "${s.uses}", which is nothing`, file, `npc.schedule[${i}]`)
      if (s.from < 0 || s.from > 24 || s.to < 0 || s.to > 24) err('schedule', `${n.id}: schedule ${i} runs ${s.from}–${s.to}, outside the day's 0–24`, file, `npc.schedule[${i}]`)
    }
  }

  // ---------------------------------------------------------------- the quests and the story
  const questIds = new Set<string>()
  for (const f of p.quests) {
    const q = f.data
    if (questIds.has(q.id)) err('duplicate', `two quests are "${q.id}"`, f.file)
    questIds.add(q.id)
    const aliases = new Set(['player', ...Object.keys(q.aliases ?? {})])
    for (const [k, a] of Object.entries(q.aliases ?? {})) if ('id' in a && a.id && !things.has(a.id)) err('reference', `${q.id}: the alias "${k}" is "${a.id}", which is nothing`, f.file, `aliases.${k}`)
    for (const o of q.objectives ?? []) for (const t of [o.target ?? []].flat()) if (!aliases.has(t)) err('reference', `${q.id}: the objective "${o.id}" points at "${t}", which is no alias`, f.file, `objectives.${o.id}`)
    if (!q.stages?.length) err('quest', `${q.id} has no stages`, f.file)
    const start = q.start as { offer?: string }
    if (start.offer && !aliases.has(start.offer)) err('reference', `${q.id} is offered by "${start.offer}", which is no alias`, f.file, 'start')
  }
  const stepIds = new Set<string>()
  for (const f of p.story)
    for (const s of f.data.steps ?? []) {
      if (stepIds.has(s.id)) err('duplicate', `two steps are "${s.id}"`, f.file)
      stepIds.add(s.id)
    }

  // ---------------------------------------------------------------- the rules
  // (a module the game names must be loaded where it is checked: its primitives are part of what a rule may use)
  const missing = (p.game.modules ?? []).filter((m) => !registeredModule(m))
  for (const m of missing) err('module', `the module "${m}" is not loaded here: import its package (the engine's official ones: @openworld/modules)`, 'game.json', 'modules')
  if (missing.length) return out
  out.push(...ruleProblems(made.rules, onto, new Set(p.rules.flatMap((f) => f.data.map((r) => r.id)))))
  const seen = new Map<string, string>()
  for (const f of p.rules)
    for (const r of f.data) {
      if (seen.has(r.id)) err('duplicate', `two rules are "${r.id}" (${seen.get(r.id)} and ${f.file})`, f.file, r.id)
      seen.set(r.id, f.file)
    }
  return out
}

/**
 * A base library's problems: the patch validator's checks that hold for base rules too (known kinds, impulses,
 * primitives, statuses, types, vfx; effects write only their host), the root total, and no ties. `own`: the
 * project's own rules (the library's are not its to fix); none: every rule.
 */
export function ruleProblems(rules: Rule[], onto: Ontology, own?: Set<string>): Problem[] {
  const out: Problem[] = []
  const mine = (id: string) => !own || own.has(id)
  for (const r of rules) {
    if (!mine(r.id)) continue
    const res = validatePatch({ artifacts: [{ kind: 'rule', rule: r }] }, { ontology: onto, library: new RuleLibrary() })
    for (const e of res.errors) if (!PLACEMENT.test(e)) out.push({ level: 'error', code: 'rule', at: r.id, message: e })
  }
  const roots = rules.filter(isRoot)
  for (const r of roots) if (leaves(r.tree).includes('inherit')) out.push({ level: 'error', code: 'rule', at: r.id, message: `${r.id} is a root and inherits: a root has nothing to inherit from` })
  for (const kind of EVENT_KINDS) if (!roots.some((r) => kindCovers(r.on, kind))) out.push({ level: 'error', code: 'rule', message: `no root rule answers ${kind}: resolution must be total` })
  for (const t of ties(rules, onto)) if (mine(t[0]) || mine(t[1])) out.push({ level: 'error', code: 'tie', at: t[0], message: `${t[0]} and ${t[1]} are equally specific and could both answer one event (design.md §5.6)` })
  return out
}

/**
 * Ties (design.md §5.6): two rules on the same kind, equally specific, whose hosts overlap and whose trees could
 * both answer one event. A tree answers in regions: the conjunction of the conditions on the way to each leaf
 * that is not `inherit`. Two regions exclude each other when they need different values of one param, or roles
 * that no one thing could fill (conditions that are not plain conjunctions are taken as possibly true).
 */
export function ties(rules: Rule[], onto: Ontology): [string, string][] {
  type Atom = Cond
  const regions = (t: Tree, acc: Atom[] = []): Atom[][] => {
    if (t === 'inherit') return []
    if (!('if' in t)) return [acc]
    const atoms = (c: Cond): Atom[] => ('all' in c ? c.all.flatMap(atoms) : [c])
    return [...regions(t.then, [...acc, ...atoms(t.if)]), ...regions(t.else ?? 'inherit', acc)]
  }
  const sels = (as: Atom[]) => {
    const by = new Map<string, Selector[]>()
    const add = (role: string, s: Selector) => by.set(role, [...(by.get(role) ?? []), s])
    for (const a of as) {
      if ('is' in a) add(a.is.role, a.is.sel)
      if ('has' in a) add(a.has.role, { ...(a.has.tag && { tags: [a.has.tag] }), ...(a.has.status && { status: [a.has.status] }) })
    }
    return by
  }
  const params = (as: Atom[]) => new Map(as.flatMap((a) => ('param' in a && typeof a.param.cmp !== 'object' ? [[a.param.key, a.param.cmp] as const] : [])))
  const nones = (as: Atom[]) => new Set(as.flatMap((a) => ('none' in a ? [a.none] : [])))
  const compatible = (x: Atom[], y: Atom[]) => {
    const [px, py] = [params(x), params(y)]
    for (const [k, v] of px) if (py.has(k) && py.get(k) !== v) return false
    const [sx, sy] = [sels(x), sels(y)]
    const [nx, ny] = [nones(x), nones(y)]
    for (const r of nx) if (sy.has(r)) return false
    for (const r of ny) if (sx.has(r)) return false
    for (const [r, a] of sx) for (const s of a) for (const t of sy.get(r) ?? []) if (!hostsOverlap(s, t, onto)) return false
    return true
  }
  const out: [string, string][] = []
  for (const [i, a] of rules.entries())
    for (const b of rules.slice(i + 1)) {
      if (a.on !== b.on || compareSpec(specOf(a), specOf(b)) !== 0 || !hostsOverlap(a.host ?? {}, b.host ?? {}, onto)) continue
      if (regions(a.tree).some((x) => regions(b.tree).some((y) => compatible(x, y)))) out.push([a.id, b.id])
    }
  return out
}
