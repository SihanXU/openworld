// The engine runs here, off the render thread: 10 ticks per second, streaming snapshots.

import {
  lookProblems,
  signatureOf,
  difficultyOf,
  Game,
  RuleLibrary,
  buildRequest,
  tickAt,
  snapshot,
  peopleViews,
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
  type Ref,
  type Resolution,
  type ResolveBody,
  type ResolveReply,
  type WorldIndex,
  type Engine,
  type PlacementPreview,
  restoreLibrary,
  CEILING,
  TICKS_PER_HOUR,
} from '@lsw/engine'
import { BASE_RULES, BOSS_LAYOUT, createBoss, COMPANION_LAYOUT, FIRSTLIGHT_LAYOUT, PLACEMENT_BY_ID, PROFESSION_BY_ID, PROLOGUE_DONE, RECIPE_BY_ID, SKILL_BY_ID, SKILLS, STORY_RULES, buildOntology, decodeChunk, decodeMap, migrateBosses, migrateCompanion, migrateFirstlight, wildChunkFor, type RawChunk } from '@lsw/content'
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
/** The left click lays what is held in the ceiling (R with a floor in hand), not on one's storey. */
let handUp = false
let panel: string | undefined
/** The people's panels open (docs/npc-sandbox.md): the talk with someone (a guard's arrest), a merchant's trade, a person's pockets. */
let talk: { who: string; arrest?: boolean } | undefined
let trade: string | undefined
let pockets: string | undefined
let paused = false
let buildAim: { id: string; tile: Tile; up?: boolean } | undefined
let lastMap = ''
let fetching = new Set<string>()
let timer: ReturnType<typeof setInterval> | undefined
let lastTickMs = 0
let lastRecordsVersion = -1
let saveEvery = 0
let lastQuest: unknown
/** The dev console's summon: a boss to set down once its map is the one the player stands on (loaded). */
let summon: { kit: string; map: string; x: number; y: number } | undefined

const ontology = buildOntology()

/** The build palette's entries that set a thing down (`put:<type>`), beside the placement recipes. */
const PUT = 'put:'

/** What the build palette would do at a cell: a placement recipe's plan, or setting a thing down. */
function buildPreview(eng: Engine, id: string, at: { map: string; x: number; y: number }, up = false): PlacementPreview {
  if (!id.startsWith(PUT)) return previewPlacement(eng, eng.world.state.player, PLACEMENT_BY_ID[id], at)
  const pv = eng.controls.previewPlace(id.slice(PUT.length), { x: at.x, y: at.y }, up)
  return { id, at, ok: pv.ok, reason: pv.reason, have: [pv.carried] }
}

// ------------------------------------------------------------------ the modder service

const MODDER_TIMEOUT_TICKS = 150 // with a modder online, an interaction waits up to 15 s; a later patch still teaches the world
const PROGRESS_MS = 1000 // how often a waiting request asks where it is
const SYNC_MS = 15_000
let modderUrl = ''
let modderSeq = 0
let syncTimer: ReturnType<typeof setInterval> | undefined
let modderOnline = false

// Prefetch: the action prompt knows an interaction is undefined before E is pressed. Pointing at
// one spot with something in hand for a second and a half starts the request, so the patch is often
// there first. Off unless the page asks (`?prefetch=1`): what it learns is committed to the shared
// library for acts the player never made, and each costs model calls (a failed one escalates).
const PREFETCH_DWELL_TICKS = 15
const PREFETCH_CAP = 12
let prefetchOn = false // the page's ?prefetch=1 turns it on (init)
let probe: { key: string; spot: string; ev: GameEvent; res: Resolution; ticks: number } | undefined
const prefetched = new Set<string>()
let prefetching = false

/** Probe the service; if it answers, undefined interactions go to it and the shared library syncs from it. */
async function connectModder(url: string, since = 0): Promise<void> {
  if (syncTimer) clearInterval(syncTimer)
  modderUrl = url.replace(/\/+$/, '')
  // the library restored has the log up to `since` in it already: only what came after is new
  modderSeq = since
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

function noteProbe(hole: { ev: GameEvent; res: Resolution } | undefined, spot: string): void {
  if (!hole || !prefetchOn) return void (probe = undefined)
  // one prefetch per hole and class (as the Mod port asks), not per tile or item; the wait is the
  // pointer resting on one spot, not sweeping over things of one class
  const key = signatureOf(game!.engine, hole.ev, hole.res)
  probe = probe?.key === key && probe.spot === spot ? { ...probe, ...hole } : { key, spot, ...hole, ticks: 0 }
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
      if (patch && game) game.mods.submit(undefined, patch, request.scenario)
    })
    .catch(() => undefined)
    .finally(() => (prefetching = false))
}

/** Pull the shared library's patch log; every patch still goes through this engine's validator. */
async function syncLibrary(): Promise<void> {
  if (!game || !modderUrl) return
  try {
    const log = (await (await fetch(`${modderUrl}/patches?since=${modderSeq}`, { signal: AbortSignal.timeout(5000) })).json()) as { seq: number; entries: PatchLogEntry[] }
    // a log shorter than where we were is another log (the service started anew): sync it from the start
    if (log.seq < modderSeq) {
      modderSeq = 0
      return syncLibrary()
    }
    const lib = game.engine.lib
    const before = lib.version
    for (const e of log.entries) {
      if ('remove' in e) {
        if (lib.rules.get(e.remove)?.source?.origin === 'patch') lib.remove(e.remove)
      } else game.mods.submit(undefined, e.patch, e.scenario, e.request)
    }
    if (log.seq !== modderSeq) post({ t: 'synced', url: modderUrl, seq: log.seq, changed: lib.version !== before })
    modderSeq = log.seq
    if (lib.version !== before) sendRecords()
  } catch {
    /* offline for now: the next sync catches up */
  }
}

/** Base rules are always fresh from content; patches (and their types/statuses) persist, each validated again (engine `restoreLibrary`). */
function libraryFrom(saved: LibraryData | undefined, protectedFacts: string[] = []): RuleLibrary {
  return restoreLibrary([...BASE_RULES, ...STORY_RULES], saved, ontology, protectedFacts, (id, why) => console.warn(`[library] a saved patch rule is not restored: ${id}: ${why}`))
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
  const view = (pl: Plan | undefined): KeyView | undefined => pl && { label: pl.label, unknown: pl.unknown, confirm: !!pl.confirm, x: pl.at.x, y: pl.at.y, ...(pl.sets && { sets: true }), ...(pl.steal && { steal: true }), ...(rect(pl) && { rect: rect(pl) }) }
  // standing still, one turns to the spot beside one that the pointer is on (the input's own posture):
  // a person one points at sees one face them, and waits (npc.ts, attended)
  const stand = w.posOf(w.player)
  if (!moveDir && stand && aimTile && Math.abs(aimTile.x - stand.x) + Math.abs(aimTile.y - stand.y) === 1) c.face({ ...stand, x: aimTile.x, y: aimTile.y })
  const out: NonNullable<Frame['keys']> = {}
  for (const k of ['hands', 'take', 'put', 'use'] as Key[]) {
    const pl = c.plan(k, aimTile, k === 'use' && handUp ? CEILING : 0)
    shownTarget[k] = pl?.target
    out[k] = view(pl)
  }
  const p = eng.world.player
  const here = eng.world.posOf(p)
  const self = c.plan('self')
  const aimed = aimTile && c.aim(aimTile)?.at
  const atSelf = !!aimed && !!here && aimed.x === here.x && aimed.y === here.y
  if (self && (atSelf || (p.held && !self.unknown))) out.self = view(self)
  const use = c.plan('use', aimTile)
  // an experiment with something in hand: where its chain reaches an undefined outcome
  noteProbe(use?.unknown && use.instrument && use.verb ? eng.preview(eng.actEvent(use.verb, p.id, use.target, use.instrument)).hole : undefined, use ? `${use.at.x},${use.at.y}` : '')
  return out
}

/** What each key's label last named: the target a key pressed now acts on, if it still reaches it. */
const shownTarget: Partial<Record<Key, Ref>> = {}

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
  // a place off the world's layout (the tutorial's clearing) with nothing else seen yet: it is the map, alone
  const here = index.maps.find((m) => m.id === pos.map)
  if (!maps.length && here && w.state.maps[here.id]) maps.push({ id: here.id, name: here.name, at: { x: 0, y: 0 }, width: here.width, height: here.height, terrain: w.state.maps[here.id]!.terrain })
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

let lastHp = Infinity
let hurtTick = -Infinity
const DANGER_TICKS = 150
const DANGER_TILES = 8
function inDanger(): boolean {
  if (!game) return false
  const eng = game.engine
  const w = eng.world
  const p = w.player
  const at = w.posOf(p)
  if (!at || w.state.tick - hurtTick < DANGER_TICKS) return !!at
  return w.entitiesOnMap(at.map).some((e) => e.ai && e.place.on === 'tile' && Math.max(Math.abs(e.place.x - at.x), Math.abs(e.place.y - at.y)) <= DANGER_TILES && eng.hostileTo(e, p))
}

/** Save the game; `auto`: the world's own (the minute's, on arriving, as the story moves), said to no one. */
function doSave(auto = false): void {
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
    prologue: w.num(p, 'prologue', PROLOGUE_DONE),
    quest: w.num(p, 'quest'),
    difficulty,
    ...(fallen && { ended: true }),
  }
  post({ t: 'saved', save, library: game.engine.lib.toJSON(), summary, auto })
}

/** How long the world stands still for the player's own question, in real seconds: an answer, a thing being made. */
const ASK_MS = 20_000
const MAKE_MS = 120_000
let asked: { id: string; since: number } | undefined

/** The people's panels a rule opened (the talk, a trade, a person's pockets), seen before the frame drains what was shown. */
function peopleOpened(eng: Engine): void {
  for (const x of eng.world.fx) {
    if (x.t === 'talk') talk = { who: x.who, ...(x.arrest && { arrest: true }) }
    if (x.t === 'panel' && x.panel === 'trade' && x.by) (trade = x.by), (talk = undefined)
    if (x.t === 'panel' && x.panel === 'pockets' && x.by) pockets = x.by
  }
}

function loop(): void {
  if (!game) return
  const t0 = performance.now()
  const eng = game.engine
  // the player's act waits for the world to learn its outcome: the world pauses with it (nothing
  // walks up to a player who cannot move), for so long, then the hole's default runs and it goes on
  const asking = game.mods.asking
  if (asking && asked?.id !== asking.id) asked = { id: asking.id, since: t0 }
  if (!asking) asked = undefined
  else if (t0 - asked!.since > (asking.deadline === Number.POSITIVE_INFINITY ? MAKE_MS : ASK_MS)) game.mods.fallback(asking.id)
  peopleOpened(eng)
  // time stops while a menu, a dialogue or a yes/no question is open (Stardew, single player)
  const stopped = paused || !!eng.world.state.question || !!panel || !!game.mods.asking || !!talk || !!trade || !!pockets
  if (!stopped) {
    if (moveDir) eng.movePlayer(moveDir, walk)
    if (attacking) eng.controls.strike()
    eng.tick()
  }
  if (game.neededMaps().length) void ensureMaps()
  const w = eng.world
  if (summon && w.posOf(w.player)?.map === summon.map && w.state.maps[summon.map]) {
    const s = summon
    summon = undefined
    // the campaign's knight as Chapter 1 sets him (tools quest/chapter1.ts), on the nearest open tile of his field
    // clear of any boss still standing there (their bodies are large)
    const bosses = w.entitiesOnMap(s.map).filter((e) => e.boss && w.num(e, 'hp') > 0).map((e) => w.posOf(e)!)
    const clear = (x: number, y: number) => w.walkable(s.map, x, y) && bosses.every((b) => Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) >= 4)
    const at = [[0, 0], [0, -4], [-5, 0], [0, 4], [5, 0], [-5, -4], [-5, 4]].map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy })).find((p) => clear(p.x, p.y)) ?? { x: s.x, y: s.y }
    eng.author(() => {
      const knight = createBoss(s.kit, { map: s.map, ...at }, `${s.map}.${s.kit}.${w.state.tick}`)
      if (s.kit === 'alberic') knight.props = { hp: 300, maxHp: 300, def: 1, atk: 5, skillScale: 0.4 }
      w.add(knight)
    })
    w.fx.push({ t: 'log', text: { en: 'The White Knight stands in his field again.', zh: '白骑士再次站在了他的田野上。' }, tone: 'warn' })
  }
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
  // (what the tick itself opened: a guard stopping the one at the keys)
  peopleOpened(eng)
  const frame = snapshot(eng, { panel })
  if (panel && !frame.container) panel = undefined // closed by the world (it burned, a rule shut it)
  // the people's panels: closed when the one they are with is gone (dead, away)
  Object.assign(frame, peopleViews(eng, { talk, trade, pockets }))
  if (talk && !frame.talk) talk = undefined
  if (trade && !frame.trade) trade = undefined
  if (pockets && !frame.pockets) pockets = undefined
  // no labels while the player cannot act (working out an act, down, in a scene)
  frame.keys = stopped || eng.busy(w.player) ? undefined : keyViews()
  maybePrefetch()
  lastTickMs = performance.now() - t0
  // the codex: what the player carries and who and what is near (the reader's record, beside the state)
  if (w.state.tick % 5 === 0) game.codex.record(w)
  const learning = asking && asked ? { seconds: Math.floor((t0 - asked.since) / 1000), limit: (asking.deadline === Number.POSITIVE_INFINITY ? MAKE_MS : ASK_MS) / 1000 } : undefined
  post({ t: 'frame', frame, perf: { tickMs: lastTickMs, entities: Object.keys(w.state.entities).length, loaded: w.state.loadedMaps.length }, codex: game.codex.version, learning })
  if (buildAim) post({ t: 'placement', preview: buildPreview(eng, buildAim.id, { map: frame.map, x: buildAim.tile.x, y: buildAim.tile.y }, buildAim.up) })
  if (eng.lib.version !== lastRecordsVersion || frame.fx.some((f) => f.t === 'undefined' || f.t === 'patched')) {
    if (eng.lib.version !== lastRecordsVersion) (post({ t: 'library', library: eng.lib.toJSON() }), sendArts())
    lastRecordsVersion = eng.lib.version
    sendRecords()
  }
  // the minute's save (and the one on arriving, or as the story moves) waits while one is in danger:
  // hurt a moment ago, or with something hostile near, the save loaded after a fall would be the
  // fight one lost (loaded, one would fall again)
  const hp = w.num(w.player, 'hp')
  if (hp < lastHp) hurtTick = w.state.tick
  lastHp = hp
  if (++saveEvery >= 600 && !inDanger()) {
    saveEvery = 0
    doSave(true)
  }
}

async function start(init: Extract<ToWorker, { t: 'init' }>, fresh = false): Promise<void> {
  base = init.base
  if (init.prefetch !== undefined) prefetchOn = init.prefetch
  index = await fetchJson<WorldIndex>('index.json')
  const lib = libraryFrom(init.library ?? init.save?.library, index.protectedFacts)
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
      const g = game
      // the removed boss kits' bodies go (the author's, on loading)
      g.engine.author(() => migrateBosses(g))
    }
    if (!game.engine.world.fact(COMPANION_LAYOUT)) {
      const g = game
      // the bird became a fairy (the author's, on loading)
      g.engine.author(() => migrateCompanion(g))
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
    game.engine.author(() => (w.setFact(FIRSTLIGHT_LAYOUT, true), w.setFact(BOSS_LAYOUT, true), w.setFact(COMPANION_LAYOUT, true), w.setFact('game.difficulty', init.difficulty ?? 'normal')))
    // the traveller the player made (docs/looks.md): a look the world's table knows, else the world's own
    if (init.look && ontology.looks && !lookProblems(init.look, ontology.looks).length) game.engine.author(() => (w.player.look = structuredClone(init.look)))
  }
  game.worldVersion = index.version
  // a night's sleep (a long step) passes a game hour a tick: the screen keeps up, and one lies asleep all the while
  game.engine.fastForwardChunk = TICKS_PER_HOUR
  // every skill the tree has, so a skill set in the bar can be cast from a loaded game (actives.ts)
  for (const s of SKILLS) game.engine.skills.set(s.id, s)
  game.mods.onChange = () => sendRecords()
  lastMap = ''
  await ensureMaps()
  post({ t: 'ready', stats: index.stats, name: index.name, resumed: !!init.save && !fresh && compatible })
  artSent.clear()
  sendArts()
  sendRecords()
  void connectModder(init.modder ?? modderUrl, init.library ? init.librarySeq : 0)
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
        // the target the key's label named (one who walked a step off since stays it)
        const plan = c.planFor(m.key, m.tile, m.layer, m.layer ? undefined : shownTarget[m.key])
        // dragged over a cell, the left button only sets things down (never an experiment on what it passes)
        if (!plan || (m.drag && !plan.sets)) break
        const out = c.run(plan)
        if (out.panel) panel = out.panel
        break
      }
      case 'ui':
        if (game) game.engine.story.ui(m.what)
        break
      case 'lessonSkip':
        if (game) game.engine.story.skipLesson()
        break
      case 'buildAim':
        buildAim = m.id && m.tile && (PLACEMENT_BY_ID[m.id] || m.id.startsWith(PUT)) ? { id: m.id, tile: m.tile, up: m.up } : undefined
        break
      case 'build': {
        if (!game || paused || panel || game.engine.world.state.question || !(PLACEMENT_BY_ID[m.id] || m.id.startsWith(PUT))) break
        const eng = game.engine
        const at = eng.world.posOf(eng.world.player)
        if (!at) break
        const to = { map: at.map, x: m.tile.x, y: m.tile.y }
        // a thing set down (one carried, or made from what is carried first): G's own act
        if (m.id.startsWith(PUT)) {
          const before = buildPreview(eng, m.id, to, m.up)
          if (!eng.controls.place(m.id.slice(PUT.length), m.tile, m.facing, m.up)) eng.world.fx.push({ t: 'log', text: before.reason, tone: 'warn' })
          post({ t: 'placement', preview: buildPreview(eng, m.id, to, m.up) })
          break
        }
        // a lesson at hand may let the palette set down only what it teaches (docs/prologue.md, the drills)
        if (!eng.controls.allows('build', { type: m.id, at: m.tile })) break
        const result = performPlacement(eng, eng.world.state.player, PLACEMENT_BY_ID[m.id], to, m.facing)
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
      case 'handUp':
        handUp = m.up
        break
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
      case 'wear':
        game?.engine.controls.wear(m.item, m.putOn)
        break
      case 'craft': {
        const r = RECIPE_BY_ID[m.id]
        if (r) m.all ? game?.engine.controls.craftAll(r) : game?.engine.controls.craft(r)
        break
      }
      case 'atlas': {
        const a = await atlas()
        if (a) post({ t: 'atlas', atlas: a })
        break
      }
      case 'codex':
        if (game && index) post({ t: 'codex', codex: game.codex.view(game.engine.world, index) })
        break
      case 'travel':
        if (game && travelToWaypoint(game.engine, m.waypoint)) void ensureMaps()
        break
      case 'boon':
        game?.engine.controls.chooseBoon(m.id)
        break
      case 'profession':
        game?.engine.controls.takeProfession(PROFESSION_BY_ID[m.id], SKILLS)
        break
      case 'learn': {
        const s = SKILL_BY_ID[m.id]
        if (s) game?.engine.controls.learn(s)
        break
      }
      case 'cast':
        if (game && !paused && !panel && !game.engine.world.state.question) game.engine.controls.cast(m.slot)
        break
      case 'setSkill':
        game?.engine.controls.setSkill(m.slot, m.id)
        break
      case 'transfer':
        if (game && panel) game.engine.controls.transfer(panel, m.from, m.item, m.all)
        break
      case 'toggle':
        game?.engine.controls.toggle(m.what)
        break
      case 'talk': {
        if (!game || !talk) break
        const with_ = talk
        // a guard's choices end the arrest; goodbye ends the talk
        if (with_.arrest || m.verb === 'bye') talk = undefined
        if (m.verb !== 'bye') game.engine.controls.talk(with_.who, m.verb, m.choice)
        break
      }
      case 'closeTalk':
        // walking away from a guard who stopped one is resisting
        if (game && talk?.arrest) game.engine.controls.talk(talk.who, 'resist')
        talk = undefined
        break
      case 'trade':
        if (game && trade) game.engine.controls.trade(trade, m.item, m.buy)
        break
      case 'closeTrade':
        trade = undefined
        break
      case 'pocket':
        if (game && pockets) game.engine.controls.pocket(pockets, m.item, m.take)
        break
      case 'closePockets':
        pockets = undefined
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
      case 'skipLearning': {
        // the player will not wait: the act's default now, the question answered later if it comes
        const a = game?.mods.asking
        if (a) game!.mods.fallback(a.id, true)
        break
      }
      case 'debug': {
        if (!game) break
        const eng = game.engine
        const w = eng.world
        if (m.op === 'teleport') eng.author(() => eng.travel(w.player, { map: m.map ?? w.posOf(w.player)!.map, x: m.x, y: m.y }))
        // into the bag, and onto a slot of it (the bag shows its slots)
        if (m.op === 'give') eng.author(() => (w.create(m.type, { on: 'inside', holder: w.state.player }, m.tags ? { tags: m.tags } : {}), eng.controls.sync()))
        // the hour only goes forward (the next time it comes round): cooldowns and timers are ticks, and a clock
        // put back left them in the future (one could not move, nor strike, until it caught up)
        if (m.op === 'hour') {
          const today = tickAt(w.calendar().day, m.hour)
          w.state.tick = today >= w.state.tick ? today : tickAt(w.calendar().day + 1, m.hour)
        }
        if (m.op === 'hurt') eng.author(() => eng.hurt(w.player, m.amount, undefined, true))
        // a boss again (the dev's hand): to its map first; it is set down once that map is loaded (`loop`)
        if (m.op === 'summon') {
          summon = { kit: m.kit, map: m.map, x: m.x, y: m.y }
          if (w.posOf(w.player)?.map !== m.map) eng.author(() => eng.travel(w.player, { map: m.map, x: m.from[0], y: m.from[1] }))
        }
        // development: the player takes no harm (toggled), and is made whole
        if (m.op === 'god') eng.author(() => {
          const on = m.on ?? w.prop(w.player, 'invulnerable') !== true
          w.setProp(w.player, 'invulnerable', on || undefined)
          if (on) w.setProp(w.player, 'hp', w.num(w.player, 'maxHp', 1))
          w.fx.push({ t: 'log', text: on ? { en: 'Invulnerable (dev).', zh: '无敌已开启（开发）。' } : { en: 'Invulnerable off.', zh: '无敌已关闭。' }, tone: 'good' })
        })
        break
      }
    }
  } catch (err) {
    post({ t: 'error', message: (err as Error).stack ?? String(err) })
  }
}
