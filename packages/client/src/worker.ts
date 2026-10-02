// The engine runs here, off the render thread: 10 ticks per second, streaming snapshots.

import {
  Game,
  RuleLibrary,
  buildRequest,
  tickAt,
  snapshot,
  type Dir,
  type GameEvent,
  type LibraryData,
  type ModRequest,
  type Patch,
  type PatchLogEntry,
  type Prompt,
  type Ref,
  type ResolveBody,
  type ResolveReply,
  type WorldIndex,
} from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk, decodeMap, type RawChunk } from '@lsw/content'
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
let lastQuest: unknown

const ontology = buildOntology()

// ------------------------------------------------------------------ the modder service

const MODDER_TIMEOUT_TICKS = 150 // with a modder online, an interaction waits up to 15 s; a later patch still teaches the world
const SYNC_MS = 15_000
let modderUrl = ''
let modderSeq = 0
let syncTimer: ReturnType<typeof setInterval> | undefined
let modderOnline = false

// Prefetch: the action prompt knows an interaction is undefined before E is pressed. Facing it
// with something in hand for half a second starts the request, so the patch is often there first.
const PREFETCH_DWELL_TICKS = 5
const PREFETCH_CAP = 40 // per session: a prefetch costs a model call
let probe: { key: string; ev: GameEvent; ticks: number } | undefined
const prefetched = new Set<string>()
let prefetching = false

/** Probe the service; if it answers, undefined interactions go to it and the shared library syncs from it. */
async function connectModder(url: string): Promise<void> {
  if (syncTimer) clearInterval(syncTimer)
  modderUrl = url.replace(/\/+$/, '')
  modderSeq = 0
  if (!modderUrl || !game) return
  try {
    const health = (await (await fetch(`${modderUrl}/health`, { signal: AbortSignal.timeout(2500) })).json()) as { model?: string | null }
    if (!game) return
    game.mods.provider = { resolve: resolveRemote }
    game.mods.timeoutTicks = MODDER_TIMEOUT_TICKS
    modderOnline = true
    post({ t: 'modder', online: true, url: modderUrl, model: health.model })
    await syncLibrary()
    syncTimer = setInterval(() => void syncLibrary(), SYNC_MS)
  } catch {
    modderOnline = false
    post({ t: 'modder', online: false, url: modderUrl })
  }
}

async function resolveRemote(request: ModRequest): Promise<Patch | null> {
  const lib = game!.engine.lib
  const body: ResolveBody = {
    request,
    workspace: { patches: { rules: lib.patches(), types: lib.types, statuses: lib.statuses }, regression: game!.mods.regression },
  }
  const res = await fetch(`${modderUrl}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  })
  const reply = (await res.json()) as ResolveReply
  return reply.patch
}

function noteProbe(ev: GameEvent | undefined): void {
  if (!ev) return void (probe = undefined)
  const t = ev.roles.target!
  const key = `${'e' in t ? t.e : `${t.tile.map}:${t.tile.x},${t.tile.y}`}|${(ev.roles.instrument as { e: string }).e}`
  probe = probe?.key === key ? { ...probe, ev } : { key, ev, ticks: 0 }
}

/** Ask the modder ahead of time; its patch goes through this engine's validator like any other. */
function maybePrefetch(): void {
  if (!probe || !modderUrl || !modderOnline || !game || prefetching || prefetched.size >= PREFETCH_CAP) return
  if (++probe.ticks < PREFETCH_DWELL_TICKS || prefetched.has(probe.key)) return
  prefetched.add(probe.key)
  prefetching = true
  const eng = game.engine
  const request = buildRequest(eng, probe.ev, `pre-${eng.world.state.tick.toString(36)}`)
  resolveRemote(request)
    .then((patch) => {
      if (patch && game) game.mods.submit(undefined, patch)
    })
    .catch(() => undefined)
    .finally(() => (prefetching = false))
}

/** Pull the shared library's patch log; every patch still goes through this engine's validator. */
async function syncLibrary(): Promise<void> {
  if (!game || !modderUrl) return
  try {
    const log = (await (await fetch(`${modderUrl}/patches?since=${modderSeq}`, { signal: AbortSignal.timeout(5000) })).json()) as { seq: number; entries: PatchLogEntry[] }
    const lib = game.engine.lib
    const before = lib.version
    for (const e of log.entries) {
      if ('remove' in e) {
        if (lib.rules.get(e.remove)?.source?.origin === 'patch') lib.remove(e.remove)
      } else game.mods.submit(undefined, e.patch)
    }
    modderSeq = log.seq
    if (lib.version !== before) sendRecords()
  } catch {
    /* offline for now: the next sync catches up */
  }
}

/** Base rules are always fresh from content; patches (and their types/statuses) persist. */
function libraryFrom(saved?: LibraryData): RuleLibrary {
  const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])
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

/** Preview what E and F would do on the tile in front of the player (dry run, no effects). */
function prompt(): Prompt | undefined {
  const eng = game!.engine
  const w = eng.world
  const p = w.player
  const f = w.front(p)
  if (!f || !w.inBounds(f.map, f.x, f.y)) return undefined
  const target: Ref = eng.targetAt(f, 'interact')
  const name = (r: Ref) => ({ en: eng.nameOf(r, 'en'), zh: eng.nameOf(r, 'zh') })
  const isTile = 'tile' in target
  const terrain = isTile ? w.terrainAt(f.map, f.x, f.y) : ''
  const boring = isTile && !w.tileState(f.map, f.x, f.y)?.statuses && ['grass', 'path', 'dirt', 'cobble', 'floor_wood', 'floor_stone', 'carpet', 'cave_floor', 'flowers', 'wall', 'void'].includes(terrain)
  const instrument: Ref | undefined = p.held ? { e: p.held } : undefined
  const ev: GameEvent = { kind: 'interaction', verb: 'interact', roles: { actor: { e: p.id }, target, instrument } }
  const r = eng.resolve(ev)
  noteProbe(r.defined || !instrument || boring ? undefined : ev) // bare floor is not worth a model call
  let take: Prompt['take']
  const takeTarget = eng.targetAt(f, 'take')
  const here = w.posOf(p)!
  const under = w.entitiesAt(here.map, here.x, here.y).filter((e) => w.kindOf(e) === 'item')
  const takeRef: Ref | undefined = 'e' in takeTarget && w.kindOf(w.get(takeTarget.e)!) === 'item' ? takeTarget : under.length ? { e: under[under.length - 1].id } : undefined
  if (takeRef) {
    const tr = eng.resolve({ kind: 'interaction', verb: 'take', roles: { actor: { e: p.id }, target: takeRef, instrument } })
    take = { defined: tr.defined, rule: tr.rule?.id, item: name(takeRef) }
  }
  if (boring && !take) return undefined
  if (boring) r.defined = true // using a thing on bare floor isn't worth a prompt
  return {
    target: name(target),
    targetKind: isTile ? 'tile' : w.kindOf(w.get((target as { e: string }).e)!),
    holding: instrument ? name(instrument) : undefined,
    interact: { defined: r.defined, rule: r.rule?.id },
    take,
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
    const first = !lastMap
    lastMap = pos.map
    post({ t: 'map', map: w.state.maps[pos.map] })
    if (!first) saveEvery = 599 // save right after arriving somewhere new
  }
  // save as soon as the story moves on
  const quest = w.player.props?.quest
  if (quest !== lastQuest) {
    if (lastQuest !== undefined) saveEvery = 599
    lastQuest = quest
  }
  const frame = snapshot(eng)
  frame.prompt = prompt()
  maybePrefetch()
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
  void connectModder(init.modder ?? modderUrl)
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
      case 'advance':
        game?.engine.scenes.advance()
        break
      case 'readMail':
        game?.engine.readMail(m.id)
        break
      case 'debug': {
        if (!game) break
        const eng = game.engine
        const w = eng.world
        if (m.op === 'teleport') eng.travel(w.player, { map: m.map ?? w.posOf(w.player)!.map, x: m.x, y: m.y })
        if (m.op === 'give') w.create(m.type, { on: 'inside', holder: w.state.player }, m.tags ? { tags: m.tags } : {})
        if (m.op === 'hour') w.state.tick = tickAt(w.calendar().day, m.hour)
        break
      }
    }
  } catch (err) {
    post({ t: 'error', message: (err as Error).stack ?? String(err) })
  }
}
