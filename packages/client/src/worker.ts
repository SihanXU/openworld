// The engine runs here, off the render thread: 10 ticks per second, streaming snapshots.

import { Game, RuleLibrary, snapshot, type Dir, type LibraryData, type WorldIndex } from '@lsw/engine'
import { BASE_RULES, buildOntology, decodeChunk, decodeMap, type RawChunk } from '@lsw/content'
import type { FromWorker, LibraryView, RecordView, ToWorker } from './protocol.ts'

const TICK_MS = 100
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m)

let base = ''
let index: WorldIndex
let game: Game | undefined
let moveDir: Dir | null = null
let lastMap = ''
let fetching = new Set<string>()
let timer: ReturnType<typeof setInterval> | undefined
let lastTickMs = 0
let lastRecordsVersion = -1
let saveEvery = 0

const ontology = buildOntology()

/** Base rules are always fresh from content; patches (and their types/statuses) persist. */
function libraryFrom(saved?: LibraryData): RuleLibrary {
  const lib = new RuleLibrary(BASE_RULES)
  if (!saved) return lib
  for (const t of saved.types ?? []) lib.addType(t, 'restored')
  for (const s of saved.statuses ?? []) lib.addStatus(s, 'restored')
  for (const r of saved.rules ?? []) if (r.source?.origin === 'patch' && !lib.rules.has(r.id)) lib.add(r, r.source.at ?? 'restored')
  lib.log = [...(saved.log ?? [])]
  lib.version = Math.max(lib.version, saved.version ?? 0)
  return lib
}

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(base + path)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return (await r.json()) as T
}

async function ensureMaps(): Promise<void> {
  if (!game) return
  for (const id of game.neededMaps()) {
    if (fetching.has(id)) continue
    fetching.add(id)
    post({ t: 'loading', what: id })
    try {
      const raw = await fetchJson<RawChunk>(`maps/${id}.json`)
      if (game.engine.world.state.loadedMaps.includes(id)) game.loadMapData(decodeMap(raw.map))
      game.loadChunk(decodeChunk(raw))
    } catch (err) {
      post({ t: 'error', message: `could not load map ${id}: ${(err as Error).message}` })
    } finally {
      fetching.delete(id)
    }
  }
}

function libraryView(): LibraryView {
  const lib = game!.engine.lib
  const counts: Record<string, number> = {}
  for (const r of lib.rules.values()) counts[r.on] = (counts[r.on] ?? 0) + 1
  const patches = lib.patches()
  return { version: lib.version, base: lib.rules.size - patches.length, patches, counts }
}

function sendRecords(): void {
  if (!game) return
  const records: RecordView[] = game.mods.records.map((r) => ({
    id: r.id,
    tick: r.tick,
    status: r.status,
    summary: r.request.summary,
    request: r.request,
    diagnostics: r.diagnostics,
    rules: r.rules,
    patch: r.patch,
  }))
  post({ t: 'records', records, library: libraryView() })
}

function doSave(): void {
  if (!game) return
  const save = game.save()
  post({ t: 'saved', save, library: game.engine.lib.toJSON() })
}

function loop(): void {
  if (!game) return
  const t0 = performance.now()
  const eng = game.engine
  if (moveDir) eng.movePlayer(moveDir)
  eng.tick()
  if (game.neededMaps().length) void ensureMaps()
  const w = eng.world
  const pos = w.posOf(w.player)
  if (!pos || !w.state.maps[pos.map]) return
  if (pos.map !== lastMap) {
    lastMap = pos.map
    post({ t: 'map', map: w.state.maps[pos.map] })
  }
  const frame = snapshot(eng)
  lastTickMs = performance.now() - t0
  post({ t: 'frame', frame, perf: { tickMs: lastTickMs, entities: Object.keys(w.state.entities).length, loaded: w.state.loadedMaps.length } })
  if (eng.lib.version !== lastRecordsVersion || frame.fx.some((f) => f.t === 'undefined' || f.t === 'patched')) {
    lastRecordsVersion = eng.lib.version
    sendRecords()
  }
  if (++saveEvery >= 600) {
    saveEvery = 0
    doSave()
  }
}

async function start(init: Extract<ToWorker, { t: 'init' }>, fresh = false): Promise<void> {
  base = init.base
  index = await fetchJson<WorldIndex>('index.json')
  const lib = libraryFrom(init.library ?? init.save?.library)
  const compatible = init.save?.world === index.version
  if (init.save && !fresh && compatible) {
    game = Game.load(init.save, index, ontology, lib)
    // re-fetch base terrain for the map we are standing on
    const here = game.engine.world.posOf(game.engine.world.player)?.map
    if (here) {
      const raw = await fetchJson<RawChunk>(`maps/${here}.json`)
      game.loadMapData(decodeMap(raw.map))
    }
    for (const id of game.engine.world.state.loadedMaps) if (id !== here) delete game.engine.world.state.maps[id]
  } else {
    game = Game.create(index, ontology, lib)
  }
  game.worldVersion = index.version
  game.mods.onChange = () => sendRecords()
  lastMap = ''
  await ensureMaps()
  post({ t: 'ready', stats: index.stats, name: index.name, resumed: !!init.save && !fresh && compatible })
  sendRecords()
  if (timer) clearInterval(timer)
  timer = setInterval(loop, TICK_MS)
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const m = ev.data
  try {
    switch (m.t) {
      case 'init':
        await start(m)
        break
      case 'newGame': {
        const library = game?.engine.lib.toJSON()
        await start({ t: 'init', base, library }, true)
        break
      }
      case 'move':
        moveDir = m.dir
        if (m.dir) game?.engine.movePlayer(m.dir) // a quick tap still moves one tile
        break
      case 'act':
        game?.engine.playerVerb(m.verb, m.self, m.item)
        break
      case 'attack':
        game?.engine.playerAttack()
        break
      case 'hold':
        if (game) game.engine.hold(game.engine.world.state.player, m.item)
        break
      case 'patch': {
        if (!game) break
        const result = game.mods.submit(m.id, m.patch)
        post({ t: 'validation', id: m.id, result })
        sendRecords()
        break
      }
      case 'dismiss':
        game?.mods.dismiss(m.id)
        sendRecords()
        break
      case 'removeRule':
        if (game?.engine.lib.rules.get(m.id)?.source?.origin === 'patch') game.engine.lib.remove(m.id)
        sendRecords()
        break
      case 'spec':
        if (game) post({ t: 'spec', spec: game.mods.spec() })
        break
      case 'save':
        doSave()
        break
      case 'debug': {
        if (!game) break
        const eng = game.engine
        const w = eng.world
        if (m.op === 'teleport') eng.travel(w.player, { map: m.map ?? w.posOf(w.player)!.map, x: m.x, y: m.y })
        if (m.op === 'give') w.create(m.type, { on: 'inside', holder: w.state.player }, m.tags ? { tags: m.tags } : {})
        if (m.op === 'hour') w.state.tick = Math.round((((m.hour - 8 + 24) % 24) * 600))
        break
      }
    }
  } catch (err) {
    post({ t: 'error', message: (err as Error).stack ?? String(err) })
  }
}
