// The engine runs here, off the render thread: 10 ticks per second, streaming snapshots.

import {
  signatureOf,
  difficultyOf,
  Game,
  RuleLibrary,
  buildRequest,
  tickAt,
  snapshot,
  previewPlacement,
  travelToWaypoint,
  dash,
  waypoints,
  performPlacement,
  type Dir,
  type GameEvent,
  type LibraryData,
  type ModProgress,
  type ModRequest,
  type Patch,
  type PatchLogEntry,
  type Frame,
  type Key,
  type KeyView,
  type Plan,
  type Resolution,
  type ResolveBody,
  type ResolveReply,
  type WorldIndex,
} from '@lsw/engine'
import { BASE_RULES, BOSS_LAYOUT, FIRSTLIGHT_LAYOUT, PLACEMENT_BY_ID, PROFESSION_BY_ID, RECIPE_BY_ID, SKILL_BY_ID, SKILLS, STORY_RULES, buildOntology, decodeChunk, decodeMap, migrateBosses, migrateFirstlight, wildChunkFor, type RawChunk } from '@lsw/content'
import type { Atlas, AtlasMap, FromWorker, LibraryView, RecordView, SaveSummary, Tile, ToWorker } from './protocol.ts'

const TICK_MS = 100
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m)

let base = ''
let index: WorldIndex
let game: Game | undefined
let moveDir: Dir | null = null
let walk = false
/** Space is held: the player strikes whenever the last blow's cooldown allows. */
let attacking = false
/** Where the mouse points, the open chest panel, and whether time is stopped (a menu or a dialogue is open). */
let aimTile: Tile | undefined
let panel: string | undefined
let paused = false
let buildAim: { id: string; tile: Tile } | undefined
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
const PROGRESS_MS = 1000 // how often a waiting request asks where it is
const SYNC_MS = 15_000
let modderUrl = ''
let modderSeq = 0
let syncTimer: ReturnType<typeof setInterval> | undefined
let modderOnline = false

// Prefetch: the action prompt knows an interaction is undefined before E is pressed. Facing it
// with something in hand for half a second starts the request, so the patch is often there first.
const PREFETCH_DWELL_TICKS = 5
const PREFETCH_CAP = 40 // per session: a prefetch costs a model call
let probe: { key: string; ev: GameEvent; res: Resolution; ticks: number } | undefined
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
    // a service with no model answers only from the shared library, which syncs here anyway:
    // asking it would only pause the world before the default, so the default runs at once
    if (health.model) {
      game.mods.provider = { resolve: resolveRemote }
      game.mods.timeoutTicks = MODDER_TIMEOUT_TICKS
    }
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
  const watching = watchProgress(request.id)
  try {
    const res = await fetch(`${modderUrl}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    })
    const reply = (await res.json()) as ResolveReply
    return reply.patch
  } finally {
    watching.stop()
  }
}

/**
 * While a request waits, ask the modder where it is. Once it is making things the world does not
 * have yet, the act waits for them past the time-out (the player is told), until the patch comes.
 */
function watchProgress(id: string): { stop: () => void } {
  let told = false
  const timer = setInterval(async () => {
    try {
      const p = (await (await fetch(`${modderUrl}/progress?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(2000) })).json()) as ModProgress
      if (told || !game || (p.stage !== 'create' && p.stage !== 'art')) return
      told = true
      if (game.mods.hold(id)) post({ t: 'creating', names: p.creating ?? [] })
    } catch {
      /* the reply still comes, or the request fails: either ends the wait */
    }
  }, PROGRESS_MS)
  return { stop: () => clearInterval(timer) }
}

/** The pictures of learned things not sent to the main thread yet. */
const artSent = new Set<string>()
function sendArts(): void {
  const arts = (game?.engine.lib.types ?? []).filter((t) => t.art && !artSent.has(t.id)).map((t) => ({ id: t.id, art: t.art! }))
  if (!arts.length) return
  for (const a of arts) artSent.add(a.id)
  post({ t: 'art', arts })
}

function noteProbe(hole: { ev: GameEvent; res: Resolution } | undefined): void {
  if (!hole) return void (probe = undefined)
  // one prefetch per hole and class (as the Mod port asks), not per tile or item
  const key = signatureOf(game!.engine, hole.ev, hole.res)
  probe = probe?.key === key ? { ...probe, ...hole } : { key, ...hole, ticks: 0 }
}

/** Ask the modder ahead of time; its patch goes through this engine's validator like any other. */
function maybePrefetch(): void {
  if (!probe || !modderUrl || !modderOnline || !game || !game.mods.provider || prefetching || prefetched.size >= PREFETCH_CAP) return
  if (++probe.ticks < PREFETCH_DWELL_TICKS || prefetched.has(probe.key)) return
  prefetched.add(probe.key)
  prefetching = true
  const eng = game.engine
  const request = buildRequest(eng, probe.ev, probe.res, `pre-${eng.world.state.tick.toString(36)}`)
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
      // a wilderness is made here, from the world's seed and its cell (world-model.md §5.7); the rest is fetched
      const made = wildChunkFor(game.engine.world, id)
      const chunk = made ?? decodeChunk(await fetchJson<RawChunk>(`maps/${id}.json`))
      if (game.engine.world.state.loadedMaps.includes(id)) game.loadMapData(chunk.map)
      game.loadChunk(chunk)
    } catch (err) {
      post({ t: 'error', message: `could not load map ${id}: ${(err as Error).message}` })
    } finally {
      fetching.delete(id)
    }
  }
}

/**
 * What the inputs that reach the aimed spot would do now (the labels over the target): E, F, G and the
 * left click there; the right click (on oneself) when something is held and it is something to do
 * there, or the player points at themself. An experiment with something in hand starts a prefetch.
 */
function keyViews(): Frame['keys'] {
  const eng = game!.engine
  const c = eng.controls
  const w = eng.world
  // a target whose base covers more than its cell is outlined whole (a place of the overworld: its block)
  const rect = (pl: Plan): KeyView['rect'] => {
    const t = w.get(pl.target.e)
    if (!t || t.place.on !== 'tile') return undefined
    const [fw, fd] = w.onto.resolve(t.type).footprint
    if (fw <= 1 && fd <= 1) return undefined
    return [t.place.x - Math.floor((fw - 1) / 2), t.place.y - fd + 1, fw, fd]
  }
  const view = (pl: Plan | undefined): KeyView | undefined => pl && { label: pl.label, unknown: pl.unknown, confirm: !!pl.confirm, x: pl.at.x, y: pl.at.y, ...(rect(pl) && { rect: rect(pl) }) }
  const out: NonNullable<Frame['keys']> = {}
  for (const k of ['hands', 'take', 'put', 'use'] as Key[]) out[k] = view(c.plan(k, aimTile))
  const p = eng.world.player
  const here = eng.world.posOf(p)
  const self = c.plan('self')
  const atSelf = !!aimTile && !!here && aimTile.x === here.x && aimTile.y === here.y
  if (self && (atSelf || (p.held && !self.unknown))) out.self = view(self)
  const use = c.plan('use', aimTile)
  // an experiment with something in hand: where its chain reaches an undefined outcome
  noteProbe(use?.unknown && use.instrument && use.verb ? eng.preview(eng.actEvent(use.verb, p.id, use.target, use.instrument)).hole : undefined)
  return out
}

/** Terrain of maps no longer in memory (the world map draws every visited one), fetched once. */
const terrainCache = new Map<string, string[]>()

async function atlas(): Promise<Atlas | undefined> {
  if (!game) return undefined
  const w = game.engine.world
  const maps: AtlasMap[] = []
  for (const m of index.maps) {
    // the maps the player has been on: their own record
    if (!m.at || w.prop(w.player, `visited.${m.id}`) === undefined) continue
    let terrain = w.state.maps[m.id]?.terrain ?? terrainCache.get(m.id)
    if (!terrain) {
      try {
        terrain = decodeMap((await fetchJson<RawChunk>(`maps/${m.id}.json`)).map).terrain
        terrainCache.set(m.id, terrain)
      } catch {
        continue
      }
    }
    maps.push({ id: m.id, name: m.name, at: m.at, width: m.width, height: m.height, terrain })
  }
  const named = new Map((index.waypoints ?? []).map((x) => [x.id, x.name]))
  const stones = waypoints(game.engine).map(({ e, attuned }) => ({ id: e.id, map: (e.place as { map: string }).map, x: (e.place as { x: number }).x, y: (e.place as { y: number }).y, name: named.get(e.id) ?? e.name ?? { en: 'Waypoint', zh: '传送雕像' }, attuned }))
  const pos = w.posOf(w.player)!
  return { maps, waypoints: stones, here: { map: pos.map, x: pos.x, y: pos.y } }
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
  const w = game.engine.world
  const p = w.player
  // one lying fallen is not saved (a save to load is from before the fall) — but a hardcore game's end is
  const fallen = w.hasStatus({ e: p.id }, 'down')
  const difficulty = difficultyOf(game.engine)
  if (fallen && difficulty !== 'hardcore') return
  const save = game.save()
  const cal = w.calendar()
  const here = w.posOf(p)?.map
  const summary: SaveSummary = {
    map: index.maps.find((m) => m.id === here)?.name ?? here ?? '',
    day: cal.day,
    hour: Math.floor(cal.hour),
    minute: cal.minute,
    level: Math.max(1, w.num(p, 'level', 1)),
    prologue: w.num(p, 'prologue', 10),
    quest: w.num(p, 'quest'),
    difficulty,
    ...(fallen && { ended: true }),
  }
  post({ t: 'saved', save, library: game.engine.lib.toJSON(), summary })
}

function loop(): void {
  if (!game) return
  const t0 = performance.now()
  const eng = game.engine
  // time stops while a menu, a dialogue or a yes/no question is open (Stardew, single player)
  const stopped = paused || !!eng.world.state.question || !!panel
  if (!stopped) {
    if (moveDir) eng.movePlayer(moveDir, walk)
    if (attacking) eng.controls.strike()
    eng.tick()
  }
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
  const frame = snapshot(eng, { panel })
  if (panel && !frame.container) panel = undefined // closed by the world (it burned, a rule shut it)
  // no labels while the player cannot act (working out an act, down, in a scene)
  frame.keys = stopped || eng.busy(w.player) ? undefined : keyViews()
  maybePrefetch()
  lastTickMs = performance.now() - t0
  post({ t: 'frame', frame, perf: { tickMs: lastTickMs, entities: Object.keys(w.state.entities).length, loaded: w.state.loadedMaps.length } })
  if (buildAim && PLACEMENT_BY_ID[buildAim.id]) post({ t: 'placement', preview: previewPlacement(eng, w.state.player, PLACEMENT_BY_ID[buildAim.id], { map: frame.map, x: buildAim.tile.x, y: buildAim.tile.y }) })
  if (eng.lib.version !== lastRecordsVersion || frame.fx.some((f) => f.t === 'undefined' || f.t === 'patched')) {
    if (eng.lib.version !== lastRecordsVersion) (post({ t: 'library', library: eng.lib.toJSON() }), sendArts())
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
    if (!game.engine.world.fact(FIRSTLIGHT_LAYOUT)) {
      const [ford, village] = await Promise.all(['ford', 'meadow'].map((id) => fetchJson<RawChunk>(`maps/${id}.json`)))
      const g = game
      // an older save brought up to the world as it is now: the author's, on loading
      g.engine.author(() => migrateFirstlight(g, index, decodeChunk(ford), decodeChunk(village)))
    }
    if (!game.engine.world.fact(BOSS_LAYOUT)) {
      const road = game.engine.world.state.loadedMaps.includes('eastroad') ? decodeChunk(await fetchJson<RawChunk>('maps/eastroad.json')) : undefined
      const g = game
      g.engine.author(() => migrateBosses(g, road))
    }
    // re-fetch base terrain for the map we are standing on
    const here = game.engine.world.posOf(game.engine.world.player)?.map
    if (here) {
      const made = wildChunkFor(game.engine.world, here)
      game.loadMapData(made?.map ?? decodeMap((await fetchJson<RawChunk>(`maps/${here}.json`)).map))
    }
    for (const id of game.engine.world.state.loadedMaps) if (id !== here) delete game.engine.world.state.maps[id]
  } else {
    game = Game.create(index, ontology, lib, init.start)
    // a new game is already the world as it is now: no migration is due (the author's, on creating it)
    const w = game.engine.world
    game.engine.author(() => (w.setFact(FIRSTLIGHT_LAYOUT, true), w.setFact(BOSS_LAYOUT, true), w.setFact('game.difficulty', init.difficulty ?? 'normal')))
  }
  game.worldVersion = index.version
  game.mods.onChange = () => sendRecords()
  lastMap = ''
  await ensureMaps()
  post({ t: 'ready', stats: index.stats, name: index.name, resumed: !!init.save && !fresh && compatible })
  artSent.clear()
  sendArts()
  sendRecords()
  void connectModder(init.modder ?? modderUrl)
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    try {
      loop()
    } catch (err) {
      post({ t: 'error', message: (err as Error).stack ?? String(err) })
    }
  }, TICK_MS)
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
      case 'dash':
        if (game && !paused && !panel && !game.engine.world.state.question) dash(game.engine, game.engine.world.player)
        break
      case 'attack':
        attacking = m.on
        // the first blow lands on the press, not on the next tick
        if (m.on && !paused && !panel && !game?.engine.world.state.question) game?.engine.controls.strike()
        break
      case 'move':
        moveDir = m.dir
        walk = !!m.walk
        if (m.dir && !paused && !panel && !game?.engine.world.state.question) game?.engine.movePlayer(m.dir, walk) // a quick tap still moves one tile
        break
      case 'key': {
        if (!game || paused || panel || game.engine.world.state.question) break
        const c = game.engine.controls
        const plan = c.plan(m.key, m.tile, m.layer)
        if (!plan) break
        const out = c.run(plan)
        if (out.panel) panel = out.panel
        break
      }
      case 'buildAim':
        buildAim = m.id && m.tile && PLACEMENT_BY_ID[m.id] ? { id: m.id, tile: m.tile } : undefined
        break
      case 'build': {
        if (!game || paused || panel || game.engine.world.state.question || !PLACEMENT_BY_ID[m.id]) break
        const eng = game.engine
        const at = eng.world.posOf(eng.world.player)
        if (!at) break
        const result = performPlacement(eng, eng.world.state.player, PLACEMENT_BY_ID[m.id], { map: at.map, x: m.tile.x, y: m.tile.y })
        if (!result.ok) eng.world.fx.push({ t: 'log', text: result.reason, tone: 'warn' })
        post({ t: 'placement', preview: result })
        break
      }
      case 'keyOnItem': {
        if (!game || game.engine.world.state.question) break
        const plan = game.engine.controls.planOnItem(m.key, m.item)
        if (plan) game.engine.controls.run(plan)
        break
      }
      case 'choices': {
        if (!game) break
        const list = game.engine.controls.choices(m.key, m.tile).map((ch) => ({ layer: ch.layer, name: ch.name, label: ch.plan?.label, unknown: ch.plan?.unknown }))
        post({ t: 'choices', key: m.key, tile: m.tile, list })
        break
      }
      case 'aim':
        aimTile = m.tile
        break
      case 'answer':
        game?.engine.controls.answer(m.yes)
        break
      case 'select':
        game?.engine.controls.select(m.slot)
        break
      case 'cycle':
        game?.engine.controls.cycle(m.dir)
        break
      case 'row':
        game?.engine.controls.nextRow(m.dir)
        break
      case 'swap':
        game?.engine.controls.swap(m.a, m.b)
        break
      case 'quickMove':
        game?.engine.controls.quickMove(m.slot)
        break
      case 'drop':
        game?.engine.controls.drop(m.slot, m.all)
        break
      case 'organize':
        game?.engine.controls.organize()
        break
      case 'craft': {
        const r = RECIPE_BY_ID[m.id]
        if (r) game?.engine.controls.craft(r)
        break
      }
      case 'atlas': {
        const a = await atlas()
        if (a) post({ t: 'atlas', atlas: a })
        break
      }
      case 'travel':
        if (game && travelToWaypoint(game.engine, m.waypoint)) void ensureMaps()
        break
      case 'profession':
        game?.engine.controls.takeProfession(PROFESSION_BY_ID[m.id], SKILLS)
        break
      case 'learn': {
        const s = SKILL_BY_ID[m.id]
        if (s) game?.engine.controls.learn(s)
        break
      }
      case 'transfer':
        if (game && panel) game.engine.controls.transfer(panel, m.from, m.item, m.all)
        break
      case 'closePanel': {
        if (game && panel && game.engine.world.hasStatus({ e: panel }, 'open')) game.engine.interact('interact', game.engine.world.state.player, { e: panel }, { instrument: null })
        panel = undefined
        break
      }
      case 'pause':
        paused = m.on
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
      case 'respawn':
        game?.engine.respawn(m.home)
        break
      case 'advance':
        game?.engine.story.advance()
        break
      case 'debug': {
        if (!game) break
        const eng = game.engine
        const w = eng.world
        if (m.op === 'teleport') eng.author(() => eng.travel(w.player, { map: m.map ?? w.posOf(w.player)!.map, x: m.x, y: m.y }))
        // into the bag, and onto a slot of it (the bag shows its slots)
        if (m.op === 'give') eng.author(() => (w.create(m.type, { on: 'inside', holder: w.state.player }, m.tags ? { tags: m.tags } : {}), eng.controls.sync()))
        if (m.op === 'hour') w.state.tick = tickAt(w.calendar().day, m.hour)
        if (m.op === 'hurt') eng.author(() => eng.hurt(w.player, m.amount, undefined, true))
        break
      }
    }
  } catch (err) {
    post({ t: 'error', message: (err as Error).stack ?? String(err) })
  }
}
