// Save-local AI-authored maps: validate a bounded draft, test navigation on a fork, then connect it.
import { Engine, type MapChunk } from './engine.ts'
import { RuleLibrary } from './rules.ts'
import { decodeRawChunk, type RawChunk } from './chunk.ts'
import type { Entity, Pos, Text, WorldState } from './types.ts'

export interface CreationMapDraft { id: string; revision: number; raw: RawChunk; appendFrom?: number }
export interface CreationMapRecord extends CreationMapDraft { source: Pos; entry: [number, number]; gate: [number, number]; adoptedAt: number; enabled: boolean }
export interface CreationMapTrial { ok: boolean; digest: string; entry?: [number, number]; gate?: [number, number]; checks: { id: string; ok: boolean; observed: string }[]; errors: string[] }
type MapState = WorldState & { creationMaps?: CreationMapRecord[] }
const clone = <T>(v: T): T => structuredClone(v)
const stateOf = (eng: Engine) => eng.world.state as MapState
export const creationMaps = (eng: Engine): CreationMapRecord[] => stateOf(eng).creationMaps ?? []
const mapId = (d: CreationMapDraft) => `creation.${d.id.replace(/[^a-z0-9_]/gi, '_')}.r${d.revision}`
const text = (v: unknown): v is Text => typeof v === 'string' || !!v && typeof v === 'object' && typeof (v as { en?: unknown }).en === 'string'

function appendBase(eng: Engine, d: CreationMapDraft): CreationMapRecord | undefined {
  if (d.appendFrom === undefined) return
  const latest = creationMaps(eng).filter(r => r.id === d.id).sort((a, b) => b.revision - a.revision)[0]
  if (!latest?.enabled || latest.revision !== d.appendFrom || d.revision <= latest.revision) throw new Error('The map append baseline changed. Read the active map and propose again.')
  return latest
}

/** Draft objects are additions only. The installed map owns its terrain, portals and existing object IDs. */
export function appendCreationMapObjects(eng: Engine, subject: string, objects: Entity[], revision?: number): CreationMapDraft {
  const base = creationMaps(eng).filter(r => r.enabled && (r.id === subject || r.raw.map.id === subject)).sort((a, b) => b.revision - a.revision)[0]
  if (!base) throw new Error('An object append needs an enabled workshop map')
  return { id: base.id, revision: revision ?? base.revision + 1, appendFrom: base.revision, raw: { map: clone(base.raw.map), entities: clone(objects) } }
}

function prepared(eng: Engine, d: CreationMapDraft, chars: Record<string, string>): RawChunk {
  if (!/^[a-z0-9_-]{1,64}$/i.test(d.id) || !Number.isSafeInteger(d.revision) || d.revision < 1) throw new Error('Invalid map package identity')
  const base = appendBase(eng, d), r = d.raw, m = base?.raw.map ?? r?.map
  if (!m || !text(m.name) || !Number.isSafeInteger(m.width) || !Number.isSafeInteger(m.height) || m.width < 5 || m.height < 5 || m.width > 32 || m.height > 32) throw new Error('A workshop map must be 5–32 cells on each side and have a name')
  if (!Array.isArray(m.rows) || m.rows.length !== m.height || m.rows.some(row => typeof row !== 'string' || [...row].length !== m.width || [...row].some(ch => !chars[ch]))) throw new Error('Map rows must match their dimensions and known terrain characters')
  if (!Array.isArray(r.entities) || r.entities.length + (base?.raw.entities.length ?? 0) > 64) throw new Error('A workshop map holds at most 64 things')
  if (base && !r.entities.length) throw new Error('An object append needs at least one new object')
  if (m.zone !== undefined && !['peaceful', 'combat'].includes(m.zone)) throw new Error('A region zone must be peaceful or combat')
  if (m.light !== undefined && !['outdoor', 'indoor', 'dark'].includes(m.light)) throw new Error('Unknown region lighting')
  if (m.environment !== undefined) {
    const e = m.environment
    if (!e || typeof e !== 'object' || Array.isArray(e) || Object.keys(e).some(k => !['palette', 'water', 'fireflies'].includes(k)) ||
      e.palette !== undefined && e.palette !== 'verdant' || e.water !== undefined && e.water !== 'stream' ||
      e.fireflies !== undefined && typeof e.fireflies !== 'boolean') throw new Error('Unknown region environment preset')
  }
  const id = base?.raw.map.id ?? mapId(d), seen = new Set<string>()
  const inputs = base ? r.entities : r.entities.filter(e => !(e.id === `${m.id}.return` && e.type === 'fixture/chalk/door'))
  const entities = inputs.map((e, i) => {
    if (!e || !eng.world.onto.data.types[e.type] || /^(resident|tile)\//.test(e.type)) throw new Error(`Unknown or unsupported map object ${e?.type}`)
    const p = e.place
    if (p.on !== 'tile' || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= m.width || p.y >= m.height) throw new Error('A map object must stand within its map')
    if (e.props || e.statuses || e.npc || e.held || e.contents || e.frozenBy) throw new Error('Map drafts place ordinary existing kinds; custom state belongs to a separate content package')
    if (base && p.map !== id) throw new Error('Appended objects must target the selected map')
    if (base && [base.entry, base.gate].some(([x, y]) => x === p.x && y === p.y)) throw new Error('An appended object cannot occupy an entrance or return gate')
    const eid = base ? `${id}.append${d.revision}.${i}` : `${id}.object${i}`
    if (base && (eng.world.get(eid) || base.raw.entities.some(entity => entity.id === eid))) throw new Error('An appended object ID already exists')
    if (seen.has(eid)) throw new Error('Duplicate map object')
    seen.add(eid)
    return { id: eid, type: e.type, ...(e.name && { name: e.name }), place: { on: 'tile' as const, map: id, x: p.x, y: p.y } }
  })
  if (base) return { map: clone(m), entities: [...clone(base.raw.entities), ...entities] }
  return { map: { id, name: m.name, kind: 'workshop', width: m.width, height: m.height, rows: [...m.rows], portals: [], zone: m.zone ?? 'peaceful', light: m.light ?? 'outdoor', music: m.music ?? 'field', ...(m.environment && { environment: clone(m.environment) }), ...(m.anchors && { anchors: clone(m.anchors) }) }, entities }
}

function fork(eng: Engine): Engine {
  return new Engine(clone(eng.world.state), eng.world.onto.data, RuleLibrary.fromJSON(clone(eng.lib.toJSON())))
}

function installChunk(eng: Engine, raw: RawChunk, chars: Record<string, string>): MapChunk {
  const chunk = decodeRawChunk(raw, chars)
  eng.graph[chunk.map.id] = chunk.map.portals
  eng.maps[chunk.map.id] = { name: chunk.map.name, width: chunk.map.width, height: chunk.map.height }
  eng.loadChunk(chunk)
  return chunk
}

function installAppendedObjects(eng: Engine, raw: RawChunk, base: CreationMapRecord, chars: Record<string, string>): MapChunk {
  const chunk = decodeRawChunk(raw, chars)
  const liveMap = eng.world.state.maps[chunk.map.id]
  if (!liveMap) return installChunk(eng, raw, chars)
  // Keep live terrain, connections and the sparse records of moved or removed objects.
  chunk.map = liveMap
  const additions = chunk.entities.slice(base.raw.entities.length)
  eng.author(() => { for (const entity of additions) eng.world.add({ ...entity, from: liveMap.id }) })
  eng.loadChunk(chunk)
  return chunk
}

const cellKey = (x: number, y: number) => `${x},${y}`
function reachable(eng: Engine, map: string, entry: [number, number]): Set<string> {
  const w = eng.world, visited = new Set<string>(), queue = [entry]
  if (!w.walkable(map, ...entry, w.player.id)) return visited
  while (queue.length) {
    const [x, y] = queue.shift()!
    if (visited.has(cellKey(x, y))) continue
    visited.add(cellKey(x, y))
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.walkable(map, x + dx, y + dy, w.player.id) && !visited.has(cellKey(x + dx, y + dy))) queue.push([x + dx, y + dy])
    }
  }
  return visited
}
function canReach(eng: Engine, map: string, cells: Set<string>, id: string): boolean {
  const w = eng.world, target = w.get(id)
  if (!target || target.place.on !== 'tile' || target.place.map !== map) return false
  const reach = eng.reachOf('hands', w.player, target, undefined)
  return [...cells].some(cell => {
    const [x, y] = cell.split(',').map(Number)
    const distance = w.distance({ map, x, y }, target)
    return distance !== undefined && (reach === undefined || distance <= reach)
  })
}

/** Validate all references and physically reach every placed object's cell or an adjacent cell. */
export function trialCreationMap(eng: Engine, d: CreationMapDraft, chars: Record<string, string>): CreationMapTrial {
  const checks: CreationMapTrial['checks'] = [], errors: string[] = []
  try {
    const raw = prepared(eng, d, chars), base = appendBase(eng, d)
    const trial = fork(eng)
    const chunk = base ? installAppendedObjects(trial, raw, base, chars) : installChunk(trial, raw, chars)
    const w = trial.world, m = chunk.map
    const open: [number, number][] = []
    for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) if (w.walkable(m.id, x, y, w.player.id)) open.push([x, y])
    if (open.length < 2) throw new Error('The region needs walkable entry and return cells')
    const entry = base?.entry ?? open[0], visited = reachable(trial, m.id, entry)
    if (!visited.size) throw new Error('The existing entry is blocked')
    const gate = base?.gate ?? open.find(([x, y]) => cellKey(x, y) !== cellKey(...entry) && visited.has(cellKey(x, y)))
    if (!gate || !visited.has(cellKey(...gate))) throw new Error('The return gate is not reachable')
    // A bridge promises a playable crossing, including the walkable bank beyond it.
    const bridges = m.terrain.flatMap((terrain, i) => terrain === 'bridge' ? [[i % m.width, Math.floor(i / m.width)] as [number, number]] : [])
    if (bridges.length) {
      const connected = open.filter(([x, y]) => visited.has(cellKey(x, y))).length
      if (connected < open.length || bridges.some(([x, y]) => !visited.has(cellKey(x, y)))) errors.push('A bridge region leaves a walkable bank disconnected')
      checks.push({ id: 'bridge', ok: connected === open.length && bridges.every(([x, y]) => visited.has(cellKey(x, y))), observed: connected + '/' + open.length + ' interior walkable cells connected across the bridge region' })
    }
    for (const e of raw.entities.slice(base?.raw.entities.length ?? 0)) {
      if (!canReach(trial, m.id, visited, e.id)) errors.push(`${e.type} cannot be reached from the entry`)
    }
    const lost = base ? w.entitiesOnMap(m.id).filter(e => !canReach(trial, m.id, visited, e.id)) : []
    const lostPortals = base ? [...m.portals, ...creationMaps(eng).filter(r => r.enabled && r.source.map === m.id).map(r => r.source)]
      .filter(p => !visited.has(cellKey(p.x, p.y))) : []
    if (base && (lost.length || lostPortals.length)) {
      const before = fork(eng)
      if (!before.world.state.maps[m.id]) installChunk(before, base.raw, chars)
      const oldReachable = reachable(before, m.id, base.entry)
      for (const e of lost) if (canReach(before, m.id, oldReachable, e.id)) errors.push(`The append cuts off existing object ${e.id}`)
      for (const p of lostPortals) if (oldReachable.has(cellKey(p.x, p.y))) errors.push(`The append cuts off an existing portal at ${p.x},${p.y}`)
    }
    checks.push({ id: 'shape', ok: true, observed: `${m.width}×${m.height}; ${raw.entities.length} known objects` }, { id: 'navigation', ok: !errors.length, observed: `${visited.size} connected walkable cells; entry and return connected` })
    return { ok: !errors.length, digest: JSON.stringify(raw), entry, gate, checks, errors }
  } catch (err) { errors.push((err as Error).message) }
  return { ok: false, digest: '', checks, errors }
}

function sourceLink(eng: Engine, record: CreationMapRecord): void {
  const revisions = creationMaps(eng).filter(r => r.id === record.id && r.enabled)
  if (record.revision < Math.max(record.revision, ...revisions.map(r => r.revision))) return
  for (const m of Object.values(eng.world.state.maps)) {
    m.portals = m.portals.filter(p => !revisions.some(r => r.source.map === m.id && r.source.x === p.x && r.source.y === p.y && r.raw.map.id === p.to))
    eng.graph[m.id] = m.portals
  }
  const from = eng.world.state.maps[record.source.map]
  if (!from) return
  const to = { map: record.raw.map.id, x: record.entry[0], y: record.entry[1] }
  if (!from.portals.some(p => p.to === to.map)) from.portals = [...from.portals, { x: record.source.x, y: record.source.y, to: to.map, tx: to.x, ty: to.y, label: record.raw.map.name }]
  eng.graph[from.id] = from.portals
}

/** Adoption always repeats the isolated checks; only exact tested data may enter the save. */
export function adoptCreationMap(eng: Engine, d: CreationMapDraft, report: CreationMapTrial, chars: Record<string, string>): CreationMapRecord {
  const raw = prepared(eng, d, chars)
  if (!report.ok || report.digest !== JSON.stringify(raw)) throw new Error('Test this map revision before adopting it')
  const previous = creationMaps(eng).filter(p => p.id === d.id)
  if (d.revision <= Math.max(0, ...previous.map(p => p.revision))) throw new Error('This map revision is stale')
  const base = appendBase(eng, d)
  if (!base && creationMaps(eng).length >= 32) throw new Error('This save has reached its workshop map budget')
  const fresh = trialCreationMap(eng, d, chars)
  if (!fresh.ok) throw new Error(fresh.errors.join('; '))
  if (base) {
    if (eng.world.state.maps[raw.map.id]) installAppendedObjects(eng, raw, base, chars)
    const record = { ...base, revision: d.revision, raw, adoptedAt: eng.world.state.tick }
    stateOf(eng).creationMaps = creationMaps(eng).map(p => p === base ? record : p)
    return record
  }
  const here = eng.world.posOf(eng.world.player)
  if (!here) throw new Error('Stand in the world before connecting a new region')
  let source = previous.sort((a, b) => b.revision - a.revision)[0]?.source ?? here
  const occupied = (p: Pos) => eng.world.state.maps[p.map]?.portals.some(g => g.x === p.x && g.y === p.y && !previous.some(r => r.raw.map.id === g.to))
  if (occupied(source)) {
    const candidates: Pos[] = []
    for (let radius = 1; radius <= 4; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (Math.abs(dx) === radius || Math.abs(dy) === radius) candidates.push({ map: here.map, x: here.x + dx, y: here.y + dy })
    const free = candidates.find(p => eng.world.walkable(p.map, p.x, p.y, eng.world.player.id) && !occupied(p))
    if (!free) throw new Error('There is no free place nearby for this region entrance')
    source = free
  }
  raw.map.anchors = { ...raw.map.anchors, entry: fresh.entry!, return: fresh.gate! }
  raw.map.portals = [{ x: fresh.gate![0], y: fresh.gate![1], to: source.map, tx: source.x, ty: source.y, label: { en: 'Return to the workshop', zh: '返回工坊' } }]
  const marker = 'fixture/chalk/door'
  if (eng.world.onto.data.types[marker]) raw.entities.push({ id: `${raw.map.id}.return`, type: marker, name: { en: 'Return gate', zh: '返回的粉笔门' }, place: { on: 'tile', map: raw.map.id, x: fresh.gate![0], y: fresh.gate![1] } })
  const record: CreationMapRecord = { id: d.id, revision: d.revision, raw, source: clone(source), entry: fresh.entry!, gate: fresh.gate!, adoptedAt: eng.world.state.tick, enabled: true }
  installChunk(eng, raw, chars)
  if (eng.world.onto.data.types[marker]) eng.author(() => {
    const id = `creation.${d.id}.entrance`, old = eng.world.get(id)
    const place = { on: 'tile' as const, map: source.map, x: source.x, y: source.y }
    if (old) eng.world.place(old, place)
    else eng.world.add({ id, type: marker, name: raw.map.name, place })
  })
  stateOf(eng).creationMaps = [...creationMaps(eng), record]
  sourceLink(eng, record)
  return record
}

/** Static authored maps are restored from their save-local package before ordinary map fetching. */
export function creationMapChunk(eng: Engine, id: string, chars: Record<string, string>): MapChunk | undefined {
  const r = creationMaps(eng).find(p => p.enabled && p.raw.map.id === id)
  return r ? decodeRawChunk(r.raw, chars) : undefined
}

/** Reattach save-local entrances whenever an ordinary source chunk is fetched after a reload or trim. */
export function withCreationConnections(eng: Engine, chunk: MapChunk): MapChunk {
  const records = creationMaps(eng).filter(r => r.enabled)
  const relevant = records.filter(r => r.source.map === chunk.map.id)
  if (!relevant.length) return chunk
  const map = clone(chunk.map)
  map.portals = map.portals.filter(p => !relevant.some(r => r.source.x === p.x && r.source.y === p.y && p.to === r.raw.map.id))
  for (const r of relevant) if (r.revision === Math.max(...records.filter(v => v.id === r.id).map(v => v.revision))) map.portals.push({ x: r.source.x, y: r.source.y, to: r.raw.map.id, tx: r.entry[0], ty: r.entry[1], label: r.raw.map.name })
  return { ...chunk, map }
}

export function restoreCreationMaps(eng: Engine, chars: Record<string, string>): string[] {
  const issues: string[] = []
  for (const record of creationMaps(eng)) {
    if (!record.enabled) continue
    try {
      const chunk = decodeRawChunk(record.raw, chars)
      eng.graph[chunk.map.id] = chunk.map.portals
      eng.maps[chunk.map.id] = { name: chunk.map.name, width: chunk.map.width, height: chunk.map.height }
      if (eng.world.state.loadedMaps.includes(chunk.map.id)) { eng.world.state.maps[chunk.map.id] = chunk.map; eng.mapArrived(chunk.map.id) }
      sourceLink(eng, record)
    } catch (err) { issues.push(`${record.id}: ${(err as Error).message}`) }
  }
  return issues
}

/** Unplug entrances only after the player and other local regions no longer depend on this region. */
export function disableCreationMap(eng: Engine, id: string): void {
  const records = creationMaps(eng).filter(r => r.id === id && r.enabled)
  if (!records.length) throw new Error('No enabled region has this identity')
  const ids = new Set(records.map(r => r.raw.map.id))
  if (ids.has(eng.activeMap)) throw new Error('Return from this region before disabling it')
  if (creationMaps(eng).some(r => r.enabled && r.id !== id && ids.has(r.source.map))) throw new Error('Another created region has its entrance here')
  for (const r of records) r.enabled = false
  for (const map of Object.values(eng.world.state.maps)) {
    map.portals = map.portals.filter(p => !records.some(r => r.source.map === map.id && r.source.x === p.x && r.source.y === p.y && p.to === r.raw.map.id))
    eng.graph[map.id] = map.portals
  }
  for (const [map, portals] of Object.entries(eng.graph)) eng.graph[map] = portals.filter(p => !ids.has(p.to))
  const marker = eng.world.get(`creation.${id}.entrance`)
  if (marker) eng.author(() => eng.world.destroy(marker))
}
