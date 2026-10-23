// The star map's data: the world as a graph, from the game's own generated files (npm run gen:world first).
//   node site/starmap/build.mjs  →  site/starmap/graph.json
// Stars: the regions, every map (a place), every person, every kind of thing, every rule, status and quest.
// Links: what the game says joins them — a person's home and household, what they like and sell; a kind's parent
// and the maps it stands on; the kinds and statuses a rule names; a room's place; a quest's people and places.
// Places stand where the continent puts them; everything else is laid out by springs and repulsion around them.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOTS, EVENTS, LINKS, OPENING } from './story.js'

const PUB = 'games/openworld/public'
const index = JSON.parse(readFileSync(join(PUB, 'world/index.json'), 'utf8'))
const bundle = JSON.parse(readFileSync(join(PUB, 'bundle.json'), 'utf8'))
const mapFiles = Object.fromEntries(readdirSync(join(PUB, 'world/maps')).map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(PUB, 'world/maps', f), 'utf8'))]))
const en = (t) => (typeof t === 'string' ? t : t?.en ?? '')

// a seeded random, so the map is the same each build
let seed = 20261021
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

const nodes = []
const at = new Map()
const add = (id, kind, label, extra = {}) => { if (at.has(id)) return at.get(id); at.set(id, nodes.length); nodes.push({ id, kind, label, ...extra }); return at.get(id) }
const edges = new Set()
const link = (a, b, kind) => { const i = at.get(a), j = at.get(b); if (i === undefined || j === undefined || i === j) return; edges.add(`${Math.min(i, j)},${Math.max(i, j)},${kind}`) }

// ------------------------------------------------------------------ stars

for (const r of index.regions) add(`region:${r.id}`, 'region', en(r.name), { color: r.color })
for (const m of index.maps) if (m.id !== 'overworld') add(`map:${m.id}`, 'place', en(m.name), { region: m.region, mapKind: m.kind, backdrop: !!m.backdrop })
// the people: the story's (the index) and everyone the continent's places hold (their own map files)
const people = [...index.npcs]
for (const [mid, f] of Object.entries(mapFiles)) for (const e of f.entities ?? []) if (e.type.startsWith('actor/person') && !people.some((p) => p.id === e.id)) people.push({ ...e, place: { ...e.place, map: e.place?.map ?? mid } })
const regionOf = new Map(index.maps.map((m) => [m.id, m.region]))
for (const p of people) add(`npc:${p.id}`, 'person', en(p.name), { region: regionOf.get(p.place?.map) })
const types = Array.isArray(bundle.ontology.types) ? bundle.ontology.types : Object.entries(bundle.ontology.types).map(([id, t]) => ({ id, ...t }))
for (const t of types) add(`type:${t.id}`, 'kind', en(t.name) || t.id.split('/').pop())
for (const r of bundle.rules) add(`rule:${r.id}`, 'rule', r.id)
const statuses = bundle.ontology.statuses
for (const s of Array.isArray(statuses) ? statuses : Object.keys(statuses).map((id) => ({ id, ...statuses[id] }))) add(`status:${s.id}`, 'status', en(s.name) || s.id)
for (const q of index.quests) add(`quest:${q.id}`, 'quest', en(q.title))

// the events of a stormy day at the Ford (story.js): stars of their own, among what they touch
for (const [k, e] of Object.entries(EVENTS)) add(`event:${k}`, 'event', e.text.split('\n').join(' '))

// ------------------------------------------------------------------ links

const mapIds = new Set(index.maps.map((m) => m.id))
// a place's region; a room's place (the longest dotted prefix that is a map)
for (const m of index.maps) {
  if (m.id === 'overworld') continue
  link(`map:${m.id}`, `region:${m.region}`, 'in')
  const parts = m.id.split('.')
  for (let k = parts.length - 1; k > 0; k--) { const p = parts.slice(0, k).join('.'); if (mapIds.has(p)) { link(`map:${m.id}`, `map:${p}`, 'in'); break } }
  for (const portal of m.portals ?? []) if (mapIds.has(portal.to) && portal.to !== 'overworld') link(`map:${m.id}`, `map:${portal.to}`, 'door')
}
// people: where they live, who they live with, what they like and keep
const households = new Map()
for (const p of people) {
  const id = `npc:${p.id}`
  if (p.place?.map) link(id, `map:${p.place.map}`, 'home')
  const h = p.props?.household
  if (h) { if (!households.has(h)) households.set(h, []); households.get(h).push(id) }
  if (p.props?.favourite) link(id, `type:${p.props.favourite}`, 'likes')
  for (const s of String(p.props?.stock ?? '').split('|').filter(Boolean)) link(id, `type:${s.split('*')[0]}`, 'sells')
}
for (const members of households.values()) for (let k = 1; k < members.length; k++) link(members[0], members[k], 'household')
// kinds: their parent kind; the maps they stand on most
const typeIds = new Set(types.map((t) => t.id))
for (const t of types) {
  const parts = t.id.split('/')
  for (let k = parts.length - 1; k > 0; k--) { const p = parts.slice(0, k).join('/'); if (typeIds.has(p)) { link(`type:${t.id}`, `type:${p}`, 'is'); break } }
}
const where = new Map()
for (const [mid, f] of Object.entries(mapFiles)) {
  if (mid === 'overworld') continue
  for (const e of f.entities ?? []) {
    if (!typeIds.has(e.type)) continue
    const k = `${e.type}|${mid}`
    where.set(k, (where.get(k) ?? 0) + 1)
  }
}
const byType = new Map()
for (const [k, n] of where) { const [t, m] = k.split('|'); if (!byType.has(t)) byType.set(t, []); byType.get(t).push([m, n]) }
for (const [t, ms] of byType) for (const [m] of ms.sort((a, b) => b[1] - a[1]).slice(0, 2)) link(`type:${t}`, `map:${m}`, 'stands')
// rules: their host, and every kind and status their tree names
const statusIds = new Set(nodes.filter((n) => n.kind === 'status').map((n) => n.id.slice(7)))
const names = (o, out = new Set()) => { if (typeof o === 'string') out.add(o); else if (o && typeof o === 'object') for (const v of Object.values(o)) names(v, out); return out }
for (const r of bundle.rules) {
  const id = `rule:${r.id}`
  if (r.host?.type) link(id, `type:${r.host.type}`, 'host')
  for (const s of names(r.tree)) {
    if (typeIds.has(s)) link(id, `type:${s}`, 'names')
    if (statusIds.has(s)) link(id, `status:${s}`, 'names')
  }
  // a rule of a family (core/…, people/…) beside its kin
  const fam = r.id.split('/')[0]
  const first = bundle.rules.find((x) => x.id.split('/')[0] === fam)
  if (first && first.id !== r.id) link(id, `rule:${first.id}`, 'family')
}
// events: what they are about, what they led to, and the rule that set the first ones off
for (const [k, e] of Object.entries(EVENTS)) for (const t of e.touch) link(`event:${k}`, t, 'about')
for (const [a, b] of LINKS) link(ROOTS[a] ? ROOTS[a].touch[0] : `event:${a}`, `event:${b}`, 'leads')
// quests: the people and places they name
const npcIds = new Set(people.map((p) => p.id))
for (const q of index.quests) for (const s of names(q)) { if (npcIds.has(s)) link(`quest:${q.id}`, `npc:${s}`, 'names'); if (mapIds.has(s)) link(`quest:${q.id}`, `map:${s}`, 'names') }

// ------------------------------------------------------------------ where the stars stand

const U = 100 // world units per cell of the world map
const pinned = new Set()
const ov = mapFiles.overworld
for (const e of ov.entities) {
  const m = e.props?.map
  if (!e.type.startsWith('site') || !m || !at.has(`map:${m}`)) continue
  const n = nodes[at.get(`map:${m}`)]
  if (n.x !== undefined) continue
  n.x = e.place.x * U + (rand() - 0.5) * 30
  n.y = e.place.y * U + (rand() - 0.5) * 30
  pinned.add(at.get(`map:${m}`))
}
// the events start among the people and places they are about (never pinned: the layout spaces them as it spaces
// everyone, so they sit in the world as any other star does)
{
  const ford = nodes[at.get('map:ford')]
  for (const [k, e] of Object.entries(EVENTS)) {
    const near = e.touch.map((t) => nodes[at.get(t)]).filter((n) => n && (n.kind === 'person' || n.kind === 'place') && n.x !== undefined)
    const base = near.length ? near : [ford]
    const n = nodes[at.get(`event:${k}`)]
    n.x = base.reduce((sum, m) => sum + m.x, 0) / base.length + (rand() - 0.5) * 60
    n.y = base.reduce((sum, m) => sum + m.y, 0) / base.length + (rand() - 0.5) * 60
  }
}
const N = nodes.length
const E = [...edges].map((s) => s.split(',')).map(([a, b, k]) => [Number(a), Number(b), k])
const adj = Array.from({ length: N }, () => [])
for (const [a, b] of E) (adj[a].push(b), adj[b].push(a))
// regions at the middle of their places
for (const n of nodes) if (n.kind === 'region') {
  const ps = adj[at.get(n.id)].map((j) => nodes[j]).filter((m) => m.x !== undefined)
  if (ps.length) { n.x = ps.reduce((s, m) => s + m.x, 0) / ps.length; n.y = ps.reduce((s, m) => s + m.y, 0) / ps.length; pinned.add(at.get(n.id)) }
}
// the rest start beside a placed neighbour (breadth first from what is placed), else in the middle
const cx = 32 * U, cy = 24 * U
const queue = nodes.map((n, i) => (n.x !== undefined ? i : -1)).filter((i) => i >= 0)
for (let q = 0; q < queue.length; q++) for (const j of adj[queue[q]]) {
  const n = nodes[j]
  if (n.x !== undefined) continue
  const p = nodes[queue[q]], r = 40 + rand() * 80, a = rand() * Math.PI * 2
  n.x = p.x + Math.cos(a) * r
  n.y = p.y + Math.sin(a) * r
  queue.push(j)
}
for (const n of nodes) if (n.x === undefined) { n.x = cx + (rand() - 0.5) * 800; n.y = cy + (rand() - 0.5) * 800 }

// springs along the links, a Barnes–Hut repulsion between all, the abstract (kinds, rules, statuses) drawn a
// little toward the middle: the continent's places hold the shape, the people gather round their homes
const X = new Float64Array(N), Y = new Float64Array(N)
nodes.forEach((n, i) => ((X[i] = n.x), (Y[i] = n.y)))
const LEN = { about: 45, leads: 60, home: 34, household: 14, in: 60, door: 50, stands: 90, is: 70, names: 90, host: 70, likes: 120, sells: 120, family: 60 }
// how hard each link pulls: a person stays by their home, whatever they like or sell far off in the middle
const PULL = { about: 0.5, leads: 0.15, home: 1, household: 1, in: 0.8, door: 0.6, stands: 0.2, is: 0.8, names: 0.45, host: 0.6, likes: 0.04, sells: 0.04, family: 0.5 }
const abstract = (k) => k === 'kind' || k === 'rule' || k === 'status'
function quad(idx, x0, y0, s) {
  if (idx.length === 0) return null
  let m = 0, mx = 0, my = 0
  for (const i of idx) (mx += X[i]), (my += Y[i]), m++
  const q = { m, x: mx / m, y: my / m, s, kids: null, i: idx.length === 1 ? idx[0] : -1 }
  if (idx.length > 1 && s > 2) {
    const h = s / 2, parts = [[], [], [], []]
    for (const i of idx) parts[(X[i] >= x0 + h ? 1 : 0) + (Y[i] >= y0 + h ? 2 : 0)].push(i)
    q.kids = parts.map((p, k) => quad(p, x0 + (k & 1 ? h : 0), y0 + (k & 2 ? h : 0), h))
  }
  return q
}
const all = Array.from({ length: N }, (_, i) => i)
for (let it = 0; it < 220; it++) {
  const alpha = 1 - it / 220
  const FX = new Float64Array(N), FY = new Float64Array(N)
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (let i = 0; i < N; i++) (minx = Math.min(minx, X[i])), (miny = Math.min(miny, Y[i])), (maxx = Math.max(maxx, X[i])), (maxy = Math.max(maxy, Y[i]))
  const root = quad(all, minx, miny, Math.max(maxx - minx, maxy - miny) + 1)
  const K = 1400
  for (let i = 0; i < N; i++) {
    const stack = [root]
    while (stack.length) {
      const q = stack.pop()
      if (!q || q.i === i) continue
      const dx = X[i] - q.x, dy = Y[i] - q.y, d2 = dx * dx + dy * dy + 25
      if (q.kids && (q.s * q.s) / d2 > 0.64) { stack.push(...q.kids); continue }
      const f = (K * q.m) / d2
      FX[i] += dx * f / Math.sqrt(d2)
      FY[i] += dy * f / Math.sqrt(d2)
    }
  }
  for (const [a, b, k] of E) {
    const dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.hypot(dx, dy) + 0.01
    // an event is held only lightly by the rules and kinds it names (they sit in the middle, far off)
    const pull = k === 'about' && (abstract(nodes[a].kind) || abstract(nodes[b].kind)) ? 0.02 : PULL[k] ?? 0.5
    const f = 0.06 * pull * (d - (LEN[k] ?? 60))
    const ux = (dx / d) * f, uy = (dy / d) * f
    FX[a] += ux; FY[a] += uy; FX[b] -= ux; FY[b] -= uy
  }
  for (let i = 0; i < N; i++) {
    if (pinned.has(i)) continue
    if (abstract(nodes[i].kind)) (FX[i] += (cx - X[i]) * 0.004), (FY[i] += (cy - Y[i]) * 0.004)
    const s = Math.hypot(FX[i], FY[i]), cap = 40 * alpha + 2
    const k = s > cap ? cap / s : 1
    X[i] += FX[i] * k
    Y[i] += FY[i] * k
  }
  if (it % 40 === 0) process.stdout.write(`  layout ${it}/220\n`)
}

// ------------------------------------------------------------------ out

const KINDS = ['region', 'place', 'person', 'kind', 'rule', 'status', 'quest', 'event']
const LINK_KINDS = ['in', 'door', 'home', 'household', 'likes', 'sells', 'is', 'stands', 'host', 'names', 'family', 'about', 'leads']
const regions = index.regions.map((r) => r.id)
const out = {
  kinds: KINDS,
  regions: index.regions.map((r) => ({ id: r.id, name: en(r.name), color: r.color })),
  // [id, kind, label, x, y, region]
  nodes: nodes.map((n, i) => [n.id, KINDS.indexOf(n.kind), n.label, Math.round(X[i]), Math.round(Y[i]), n.region ? regions.indexOf(n.region) : -1]),
  linkKinds: LINK_KINDS,
  // [a, b, kind]
  edges: E.map(([a, b, k]) => [a, b, LINK_KINDS.indexOf(k)]),
  counts: Object.fromEntries(KINDS.map((k) => [k, nodes.filter((n) => n.kind === k).length])),
}
writeFileSync('site/starmap/graph.json', JSON.stringify(out))
console.log(`${N} stars, ${E.length} links →  site/starmap/graph.json`, out.counts)
