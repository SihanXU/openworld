// The engine runs here, off the render thread: 10 ticks per second, streaming snapshots.

import { untilUp } from './untilUp.ts'
import { portLink, serviceLink, type ModderLink } from './modderLink.ts'
import { FrameEncoder } from './frameDelta.ts'
import { TransferQueue } from './transferQueue.ts'
import { scheduleTransferTurn } from './transferScheduler.ts'
import { adoptDefinitions, artsToSend, forgetInvalid, holdForMaking, learnedRecipes, recipeOf, sharedPart, takeLogEntries, takePatch, withKept, withShipped, LogPosition, type Kept } from './learned.ts'
import { lookProblems, signatureOf, difficultyOf, Game, RuleLibrary, buildRequest, tickAt, snapshot, previewPlacement, performPlacement, type Dir, type GameEvent, type LibraryData, type ModRequest, type Patch, type Frame, type Key, type KeyView, type Plan, type Ref, type Resolution, type ResolveBody, type WorldIndex, type Engine, type PlacementPreview, type FrameView, restoreLibrary, decodeRawChunk, decodeRawMap, type RawChunk, type Text, type MapChunk, CEILING, TICKS_PER_HOUR, rollAffixes, AI_WAIT_MS, DEFAULT_QUALITY, categoryOf, qualityOf, type AiLevel, type AiQuality, type Entity, type Look } from '@openworld/engine'
import { peopleViews, travelToWaypoint, waypoints, cast, dash, fishingActive, fishingInput, setSkill, takeProfession, chooseBoon } from '@openworld/modules'
import { game as played, ontology, placementById, professionById, skillById } from './game.ts'
import { settleOpenQuestions, withOpenQuestions } from './saves.ts'
import { routeFishingWorkerInput, type StoredLibrary, type Atlas, type AtlasContinent, type AtlasMap, type FromWorker, type LibraryView, type RecordView, type SaveSummary, type Tile, type ToWorker } from './protocol.ts'

const TICK_MS = 100
/**
 * How many maps keep their things in memory (docs/continent.md §9): the player's and the last ones left; the rest are put
 * away, to come back as they were when one goes there again (its file is fetched again).
 */
const KEEP_MAPS = 8
/** What the camera shows (the page says): frames carry what lies there; and what each thing was when last sent. */
let view: FrameView | undefined
const frames = new FrameEncoder()
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m)
const transfers = new TransferQueue((err) => post({ t: 'error', message: (err as Error).stack ?? String(err) }), undefined, scheduleTransferTurn)
const crafts = new TransferQueue<'craft'>((err) => post({ t: 'error', message: (err as Error).stack ?? String(err) }), undefined, scheduleTransferTurn)
const batchBusy = () => transfers.busy || crafts.busy
let nextTransferFrame = 0

let base = ''
let index: WorldIndex
let game: Game | undefined
let moveDir: Dir | null = null
let walk = false
/** Space is held: the player strikes whenever the last blow's cooldown allows. */
let attacking = false
/** The left button is held: the act its press made, made again at the aim as a swing's pace allows (Controls.again). */
let swinging: Plan | undefined
/** Where the mouse points, the open chest panel, and whether time is stopped (a menu or a dialogue is open). */
let aimTile: Tile | undefined
/** The right click lays what is held in the ceiling (the turn key with a floor in hand), not on one's storey. */
let handUp = false
let panel: string | undefined
/** The people's panels open (docs/npc-sandbox.md): the talk with someone (a guard's arrest), a merchant's trade, a person's pockets. */
let talk: { who: string; arrest?: boolean } | undefined
let trade: string | undefined
let pockets: string | undefined
let gift: string | undefined
let paused = false
/** The world running is the title's backdrop (`backdrop`): nothing saved, nothing asked, no panels. */
let backdropOn = false
/** Which start is the latest: one begun before another finished loading gives way to it. */
let generation = 0
let buildAim: { id: string; tile: Tile; up?: boolean } | undefined
let lastMap = ''
let fetching = new Set<string>()
let timer: ReturnType<typeof setInterval> | undefined
let lastTickMs = 0
let lastRecordsVersion = -1
let saveEvery = 0
/** The dev console's summon: a boss to set down once its map is the one the player stands on (loaded). */
let summon: { kit: string; map: string; x: number; y: number } | undefined

/** A map file of the game's, read through its terrain characters. */
const chunkOf = async (id: string) => decodeRawChunk(await fetchJson<RawChunk>(`maps/${id}.json`), played().terrainChars)

/**
 * A map's chunk: a wilderness made from the world's seed and its cell (world-model.md §5.7) — from its site on the
 * overworld, which comes first when a save put it away (docs/continent.md §9) —, else its file.
 */
async function chunkFor(id: string): Promise<MapChunk> {
  const w = game!.engine.world
  let made = played().wild?.(w, id)
  if (!made && played().wild && !index.maps.some((m) => m.id === id)) {
    for (const m of index.maps.filter((x) => x.kind === 'overworld')) if (!w.state.maps[m.id]) game!.loadChunk(await chunkOf(m.id))
    made = played().wild?.(w, id)
  }
  return made ?? (await chunkOf(id))
}

/** The build palette's entries that set a thing down (`put:<type>`), beside the placement recipes. */
const PUT = 'put:'

/** What the build palette would do at a cell: a placement recipe's plan, or setting a thing down. */
function buildPreview(eng: Engine, id: string, at: { map: string; x: number; y: number }, up = false): PlacementPreview {
  if (!id.startsWith(PUT)) return previewPlacement(eng, eng.world.state.player, placementById()[id], at)
  const pv = eng.controls.previewPlace(id.slice(PUT.length), { x: at.x, y: at.y }, up)
  return { id, at, ok: pv.ok, reason: pv.reason, have: [pv.carried] }
}

// ------------------------------------------------------------------ the modder: a service, or the player's own

const MODDER_TIMEOUT_TICKS = 150 // with a modder online, an interaction waits up to 15 s; a later patch still teaches the world
const PROGRESS_MS = 1000 // how often a waiting request asks where it is
const SYNC_MS = 15_000
/** How soon a service not up yet is asked again (twice as long after each failure, up to a minute). */
const RETRY_MS = 5_000
/** The modder asked: a service at its address, or the player's own in a worker of the page (modderLink.ts, docs/byok.md). */
let link: ModderLink | undefined
/** How far the shared log is synced, and the log it counts in (the service names it). */
const synced = new LogPosition()
let syncTimer: ReturnType<typeof setInterval> | undefined
/** The probes of a service not up yet (connectModder). */
let connecting: { stop: () => void } | undefined
let modderOnline = false

// Prefetch: the action prompt knows an interaction is undefined before E is pressed. Pointing at
// one spot with something in hand for a while starts the request, so the patch is often there first.
// The AI setting's `prefetch` says how soon and how many (off by default: what it learns is committed
// to the shared library for acts the player never made, and each costs model calls); the page's
// `?prefetch=1` asks for at least medium.
const PREFETCH: Record<Exclude<AiLevel, 'off'>, { dwell: number; cap: number }> = {
  low: { dwell: 30, cap: 4 },
  medium: { dwell: 15, cap: 12 },
  high: { dwell: 10, cap: 30 },
}
let prefetchAsked = false // the page's ?prefetch=1 (init)
/** The player's AI setting (the engine's quality.ts): the main thread's stored one, sent at init and on every change. */
let quality: AiQuality = { ...DEFAULT_QUALITY }
const prefetchLevel = (): Exclude<AiLevel, 'off'> | undefined => (quality.prefetch !== 'off' ? quality.prefetch : prefetchAsked ? 'medium' : undefined)
let probe: { key: string; spot: string; ev: GameEvent; res: Resolution; ticks: number } | undefined
const prefetched = new Set<string>()
let prefetching = false

/** Probe the modder; if it answers, undefined interactions go to it and the shared library syncs from it. */
async function connectModder(to: ModderLink | undefined, since?: number, stored?: StoredLibrary): Promise<void> {
  if (syncTimer) clearInterval(syncTimer)
  connecting?.stop()
  link = to
  // the library restored has the log up to `since` in it already: only what came after is new (in the same log)
  synced.begin(link?.where ?? '', since, stored)
  if (game) {
    // whatever answered before answers no more until this one says it can
    game.mods.provider = undefined
    game.mods.adopt = undefined
    game.engine.onFault = undefined
  }
  if (!link || !game) return post({ t: 'modder', online: false })
  // a service not up yet (started after the page, or starting again) is asked again until it answers
  connecting = untilUp(probeModder, RETRY_MS, 60_000)
}

/** One probe of the service: true once it answers (or there is no game to connect any more). `live`: false once a newer connection called it off. */
async function probeModder(live: () => boolean): Promise<boolean> {
  try {
    const health = await link!.health()
    if (!game || !live()) return true
    // a service with no model answers only from the shared library, which syncs here anyway:
    // asking it would only pause the world before the default, so the default runs at once
    if (health.model) {
      game.mods.provider = { resolve: resolveRemote }
      // an answer to our own question wins over a learned definition kept here, as a synced one does
      game.mods.adopt = adoptAnswer
      // a learned rule set aside here is reported: the service counts, and past its bound retires the rule for everyone
      const to = link!
      game.engine.onFault = (rule, reason) => to.fault(rule.id, reason)
      game.mods.timeoutTicks = MODDER_TIMEOUT_TICKS
    }
    modderOnline = true
    post({ t: 'modder', online: true, url: link!.where, model: health.model })
    await syncLibrary()
    if (live()) syncTimer = setInterval(() => void syncLibrary(), SYNC_MS)
    return true
  } catch {
    if (!live()) return true
    modderOnline = false
    post({ t: 'modder', online: false, url: link?.where })
    return !game
  }
}

/** Would a hole reached now be asked: a modder with a model is up. Else the label promises nothing (no "?"): the default comes. */
function asks(): boolean {
  return modderOnline && !!game?.mods.provider
}

async function resolveRemote(request: ModRequest): Promise<Patch | null> {
  const lib = game!.engine.lib
  const body: ResolveBody = {
    request,
    workspace: { patches: { rules: lib.patches(), types: lib.types, statuses: lib.statuses } },
  }
  const watching = watchProgress(request.id)
  try {
    const reply = await link!.resolve(body)
    return reply.patch
  } finally {
    watching.stop()
  }
}

/**
 * While a request waits, ask the modder where it is. Once it is making things the world does not
 * have yet, the player's own act waits for them past the time-out (the player is told), until the patch comes.
 */
function watchProgress(id: string): { stop: () => void } {
  let told = false
  const timer = setInterval(async () => {
    try {
      const p = await link!.progress(id)
      if (told || !game || (p.stage !== 'create' && p.stage !== 'art')) return
      told = true
      // (the player's own act only: a question of the world's keeps its time-out)
      if (holdForMaking(game.mods, id)) post({ t: 'creating', names: p.creating ?? [] })
    } catch {
      /* the reply still comes, or the request fails: either ends the wait */
    }
  }, PROGRESS_MS)
  return { stop: () => clearInterval(timer) }
}

/** What only the save loaded keeps (learned kinds its things are of that the shared library forgot): never written back to it. */
let kept: Kept = { types: new Set(), statuses: new Set() }

/** Take a learned definition an answer brings anew, and make what it brings shared; both undone should the answer be refused. */
const adoptAnswer = (patch: Patch): { restore: () => void; done: () => void } => adoptDefinitions(game!.engine, kept, patch)

/** The recipes of learned things (derived from their makeup when a patch brings a type with a station), sent when they change. */
let recipesSent = ''
function sendRecipes(): void {
  if (!game) return
  const recipes = learnedRecipes(game.engine)
  // (what each makes and needs: a definition taken again may change them under the same id)
  const sig = JSON.stringify(recipes.map((r) => [r.id, r.needs, r.count, r.station, r.name]))
  if (sig === recipesSent) return
  recipesSent = sig
  post({ t: 'recipes', recipes })
}

/** The pictures of learned things not sent to the main thread yet. */
const artSent = new Map<string, string>()
function sendArts(): void {
  const arts = artsToSend(game?.engine.lib.types ?? [], artSent)
  if (arts.length) post({ t: 'art', arts })
}

function noteProbe(hole: { ev: GameEvent; res: Resolution } | undefined, spot: string): void {
  if (!hole || !prefetchLevel()) return void (probe = undefined)
  // one prefetch per hole and class (as the Mod port asks), not per tile or item; the wait is the
  // pointer resting on one spot, not sweeping over things of one class
  const key = signatureOf(game!.engine, hole.ev, hole.res)
  probe = probe?.key === key && probe.spot === spot ? { ...probe, ...hole } : { key, spot, ...hole, ticks: 0 }
}

/** Ask the modder ahead of time; its patch goes through this engine's validator like any other. */
function maybePrefetch(): void {
  const level = prefetchLevel()
  if (!level || !probe || !link || !modderOnline || !game || !game.mods.provider || prefetching || prefetched.size >= PREFETCH[level].cap) return
  // (nor for a kind of work the setting turns off)
  if (++probe.ticks < PREFETCH[level].dwell || prefetched.has(probe.key) || game.engine.quality[categoryOf(game.engine.world, probe.ev)] === 'off') return
  prefetched.add(probe.key)
  prefetching = true
  const eng = game.engine
  const request = buildRequest(eng, probe.ev, probe.res, `pre-${eng.world.state.tick.toString(36)}`)
  resolveRemote(request)
    .then((patch) => {
      if (patch && game) {
        // as any answer: a learned definition it brings anew replaces the one kept here
        const mods = game.mods
        takePatch(game.engine, kept, patch, (p) => mods.submit(undefined, p, request.scenario))
      }
    })
    .catch(() => undefined)
    .finally(() => (prefetching = false))
}

/** Pull the shared library's patch log; every patch still goes through this engine's validator. */
async function syncLibrary(): Promise<void> {
  if (!game || !link) return
  try {
    const log = await link.patches(synced.seq)
    // (a reply this client cannot read at all is as no reply: the next sync asks again)
    if (typeof log?.seq !== 'number' || !Array.isArray(log.entries)) throw new Error('not a patch log')
    // another log than the one we were in (the service started anew: it names another, or it is shorter than where we were): sync it from the start
    if (synced.restarts(log)) return syncLibrary()
    const lib = game.engine.lib
    const before = lib.version
    // each entry on its own: one this client cannot read or take is passed over, and the position moves past it
    takeLogEntries(game.engine, game.mods, kept, log.entries)
    if (log.seq !== synced.seq) post({ t: 'synced', url: link.where, seq: log.seq, changed: lib.version !== before })
    // a log named anew: the library is stored again, with it
    if (synced.advance(log)) post({ t: 'library', library: storedLibrary(), statuses: lib.statuses })
    if (lib.version !== before) sendRecords()
  } catch {
    /* offline for now: the next sync catches up */
  }
}

/** Base rules are always fresh from content; patches (and their types/statuses) persist, each validated again (engine `restoreLibrary`). */
function libraryFrom(saved: LibraryData | undefined, protectedFacts: string[] = []): RuleLibrary {
  // the patches the game ships with first (GameDef.learned), the saved and the synced ones over them; a shipped kind wins over its stored copy
  return restoreLibrary(played().rules, withShipped(played().learned, saved), ontology(), protectedFacts, (id, why) => console.warn(`[library] a saved patch rule is not restored: ${id}: ${why}`))
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
      game.loadChunk(await chunkFor(id))
      // the maps far behind are put away (their files can be fetched again)
      game.trim()
    } catch (err) {
      post({ t: 'error', message: `could not load map ${id}: ${(err as Error).message}` })
    } finally {
      fetching.delete(id)
    }
  }
}

/**
 * What each input would do now, foreseeable (design.md §5.2; the page's tip says it): E and G at the aim (or in
 * front), the left click (the held thing's own use) and the right click (its use on what is aimed at). An
 * experiment with something in hand starts a prefetch.
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
  // the act's own view: the '?' only where someone will be asked (the AI setting may leave it to the leaf's default)
  const view = (pl: Plan | undefined): KeyView | undefined =>
    pl && { label: pl.label, unknown: (pl.unknown && !pl.quiet && asks()) || undefined, confirm: !!pl.confirm, x: pl.at.x, y: pl.at.y, ...(!pl.changes && { idle: true }), ...(pl.sets && { sets: true }), ...(pl.steal && { steal: true }), ...(c.ground(pl.target) && { ground: true }), ...(c.talksTo(pl.target) && { person: true }), ...(rect(pl) && { rect: rect(pl) }) }
  // standing still, one turns to the spot beside one that the pointer is on (the input's own posture):
  // a person one points at sees one face them, and waits (npc.ts, attended)
  const stand = w.posOf(w.player)
  if (!moveDir && stand && aimTile && Math.abs(aimTile.x - stand.x) + Math.abs(aimTile.y - stand.y) === 1) c.face({ ...stand, x: aimTile.x, y: aimTile.y })
  const out: NonNullable<Frame['keys']> = {}
  // E and G (a press: no layer chosen), the left click and the right click (a floor in hand: in the ceiling, as chosen)
  for (const k of ['hands', 'put', 'primary', 'secondary'] as const) {
    const pl = c.plan(k, aimTile, k === 'secondary' && handUp ? CEILING : undefined)
    shownTarget[k] = pl?.target
    const v = view(pl)
    out[k] = v && pl!.key !== k ? { ...v, act: pl!.key } : v
  }
  const p = eng.world.player
  const use = c.plan('secondary', aimTile)
  // an experiment with something in hand: where its chain reaches an undefined outcome
  noteProbe(use?.unknown && use.instrument && use.verb ? eng.preview(eng.actEvent(use.verb, p.id, use.target, use.instrument)).hole : undefined, use ? `${use.at.x},${use.at.y}` : '')
  return out
}

/** Time stops while a menu, a dialogue or a yes/no question is open (Stardew, single player). */
const timeStopped = (g: Game) => (paused && !backdropOn) || batchBusy() || !!g.engine.world.state.question || !!panel || !!g.mods.asking || !!talk || !!trade || !!pockets || !!gift

function cancelFishing(g: Game | undefined): void {
  if (g && fishingActive(g.engine)) {
    fishingInput(g.engine, 'cancel')
    attacking = false
  }
}

/** What the keys would do now, as a frame says it: nothing while time stands or the player cannot act. */
const keysNow = (g: Game): Frame['keys'] => (timeStopped(g) || g.engine.busy(g.engine.world.player) ? undefined : keyViews())

/** What each key's label last named: the target a key pressed now acts on, if it still reaches it. */
const shownTarget: Partial<Record<Key, Ref>> = {}

/**
 * The dresser's work (docs/looks.md §5, content dresser.ts): the player's look becomes the one made in her panel, their own
 * from then on, for the price the world's params name — coin and things carried, each taken from the bag; short of any,
 * nothing changes and the log says so.
 */
function restyle(eng: Engine, look: Look): void {
  const w = eng.world
  const p = w.player
  const table = ontology().looks
  if (!table || typeof p.look !== 'object') return
  const wrong = lookProblems(look, table)
  if (wrong.length) return void w.fx.push({ t: 'log', text: { en: 'That look is not one the world knows.', zh: '这个样子世界不认得。' }, tone: 'warn' })
  const price = ontology().params?.restyle
  const needs = [...(price?.coin ? [{ type: played().items.coin, count: price.coin }] : []), ...(price?.needs ?? [])]
  const carried = (p.contents ?? []).map((id) => w.get(id)).filter((e): e is Entity => !!e && !e.frozenBy)
  const short = needs.find((n) => carried.filter((e) => e.type === n.type).length < n.count)
  if (short) {
    const name = ontology().types[short.type]?.name
    const en = typeof name === 'string' ? name : (name?.en ?? short.type)
    const zh = typeof name === 'string' ? name : (name?.zh ?? en)
    return void w.fx.push({ t: 'log', text: { en: `The dresser wants ${short.count} ${en} for that.`, zh: `改样子要 ${short.count} 个${zh}。` }, tone: 'warn' })
  }
  eng.author(() => {
    for (const n of needs) for (const e of carried.filter((e) => e.type === n.type).slice(0, n.count)) w.destroy(e)
    w.setLook(p, { ...structuredClone(look), own: true })
  })
  w.fx.push({ t: 'vfx', fx: 'sparkle', at: { map: w.posOf(p)!.map, x: w.posOf(p)!.x, y: w.posOf(p)!.y } } as never)
  w.fx.push({ t: 'log', text: { en: 'You look yourself over: that is you now.', zh: '你打量了一下自己：这就是现在的你了。' } })
}

/** Terrain of maps no longer in memory (the world map draws every visited one), fetched once. */
const terrainCache = new Map<string, string[]>()

/** The overworld's chunk as the world map reads it (its grounds and its sites never move), fetched once. */
let continentChunk: { id: string; terrain: string[]; width: number; height: number; sites: { id: string; type: string; x: number; y: number; name?: Text; props: Record<string, unknown> }[] } | undefined

/** The continent for the world map: the overworld's grounds, regions and places, and where one is on it. */
async function continent(): Promise<{ continent: AtlasContinent; cells: Record<string, { x: number; y: number }> } | undefined> {
  const w = game!.engine.world
  const meta = index.maps.find((m) => m.kind === 'overworld')
  if (!meta) return undefined
  if (!continentChunk) {
    try {
      const raw = await fetchJson<RawChunk>(`maps/${meta.id}.json`)
      const terrain = decodeRawMap(raw.map, played().terrainChars).terrain
      const sites = raw.entities.filter((e) => e.type.startsWith('site') && e.place.on === 'tile').map((e) => ({ id: e.id, type: e.type, x: (e.place as { x: number }).x, y: (e.place as { y: number }).y, name: e.name, props: (e.props ?? {}) as Record<string, unknown> }))
      continentChunk = { id: meta.id, terrain, width: raw.map.width, height: raw.map.height, sites }
    } catch {
      return undefined
    }
  }
  const c = continentChunk
  const regions = index.regions ?? []
  const regionIndex = new Map(regions.map((r, i) => [r.id, i]))
  const regionOf = new Array<number>(c.width * c.height).fill(-1)
  const cellOfMap = new Map<string, { x: number; y: number }>()
  const places: AtlasContinent['places'] = []
  for (const s of c.sites) {
    const r = typeof s.props.region === 'string' ? regionIndex.get(s.props.region) : undefined
    if (r !== undefined) regionOf[s.y * c.width + s.x] = r
    if (typeof s.props.map === 'string') cellOfMap.set(s.props.map, { x: s.x, y: s.y })
    if (!s.type.startsWith('site/place') || typeof s.props.map !== 'string') continue
    const opens = typeof s.props.opensWhen === 'string' ? s.props.opensWhen : undefined
    places.push({
      x: s.x,
      y: s.y,
      name: s.name ?? { en: s.props.map, zh: s.props.map },
      kind: s.type.split('/').pop()!,
      map: s.props.map,
      ...(opens && !w.fact(opens) && { sealed: true }),
      ...(s.props.backdrop === true && { backdrop: true }),
      ...(w.prop(w.player, `visited.${s.props.map}`) !== undefined && { visited: true }),
      // a region's chief place, or a town of the played land
      ...((s.props.capital === true || (s.props.backdrop !== true && s.type.endsWith('/town'))) && { capital: true }),
    })
  }
  // where a map lies: its own site's cell, or (a room, a cave's depths) the cell of the map it is reached from
  const graph = new Map(index.maps.map((m) => [m.id, m.portals.map((p) => p.to)]))
  const cellOf = (id: string): { x: number; y: number } | undefined => {
    const seen = new Set([id])
    let frontier = [id]
    for (let hop = 0; hop < 4 && frontier.length; hop++) {
      for (const m of frontier) {
        const at = cellOfMap.get(m)
        if (at) return at
      }
      frontier = frontier.flatMap((m) => graph.get(m) ?? []).filter((m) => !seen.has(m) && (seen.add(m), true))
    }
    return undefined
  }
  const pos = w.posOf(w.player)!
  const cell = pos.map === c.id ? { x: pos.x, y: pos.y } : cellOf(pos.map)
  const cells: Record<string, { x: number; y: number }> = {}
  for (const m of index.maps) {
    const at = cellOf(m.id)
    if (at) cells[m.id] = at
  }
  return { continent: { width: c.width, height: c.height, terrain: c.terrain, regionOf, regions, places, ...(cell && { cell }) }, cells }
}

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
        terrain = decodeRawMap((await fetchJson<RawChunk>(`maps/${m.id}.json`)).map, played().terrainChars).terrain
        terrainCache.set(m.id, terrain)
      } catch {
        continue
      }
    }
    maps.push({ id: m.id, name: m.name, at: m.at, width: m.width, height: m.height, terrain })
  }
  const targets = game.engine.quests.targets().map((x) => ({ map: x.map, x: x.x, y: x.y, text: x.text }))
  const named = new Map((index.waypoints ?? []).map((x) => [x.id, x.name]))
  const stones = waypoints(game.engine).map(({ e, attuned }) => ({ id: e.id, map: (e.place as { map: string }).map, x: (e.place as { x: number }).x, y: (e.place as { y: number }).y, name: named.get(e.id) ?? e.name ?? { en: 'Waypoint', zh: '传送雕像' }, attuned }))
  const pos = w.posOf(w.player)!
  // a place off the world's layout (the tutorial's clearing) with nothing else seen yet: it is the map, alone
  const here = index.maps.find((m) => m.id === pos.map)
  if (!maps.length && here && w.state.maps[here.id]) maps.push({ id: here.id, name: here.name, at: { x: 0, y: 0 }, width: here.width, height: here.height, terrain: w.state.maps[here.id]!.terrain })
  const world = await continent()
  return { targets, maps, waypoints: stones, here: { map: pos.map, x: pos.x, y: pos.y }, ...(world && { continent: world.continent, cells: world.cells }) }
}

/** The shared library as the browser stores it: without what only this save keeps, stamped with the log it is synced to. */
const storedLibrary = (): StoredLibrary => synced.stamp(sharedPart(game!.engine.lib.toJSON(), kept))

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
  if (!game || backdropOn) return
  const w = game.engine.world
  const p = w.player
  // one lying fallen is not saved (a save to load is from before the fall) — but a hardcore game's end is
  const fallen = w.hasStatus({ e: p.id }, 'down')
  const difficulty = difficultyOf(game.engine)
  if (fallen && difficulty !== 'hardcore') return
  // (a question open now is not saved: loaded, its hole's default runs, as after a time-out)
  const save = withOpenQuestions(game.save(), game.mods)
  const cal = w.calendar()
  const here = w.posOf(p)?.map
  const summary: SaveSummary = {
    map: index.maps.find((m) => m.id === here)?.name ?? here ?? '',
    day: cal.day,
    hour: Math.floor(cal.hour),
    minute: cal.minute,
    level: Math.max(1, w.num(p, 'level', 1)),
    ...(() => {
      const s = game.engine.quests.summary()
      return { ...(s.title && { quest: s.title }), ...(s.objective && { objective: s.objective }) }
    })(),
    difficulty,
    ...(fallen && { ended: true }),
  }
  post({ t: 'saved', save, library: storedLibrary(), summary, auto })
}

/** How long the world stands still for the player's own question, in real seconds: an answer (the same at every AI setting), a thing being made. */
const ASK_MS = AI_WAIT_MS
const MAKE_MS = 120_000
let asked: { id: string; since: number } | undefined

/** The people's panels a rule opened (the talk, a trade, a person's pockets), seen before the frame drains what was shown. */
function peopleOpened(eng: Engine): void {
  for (const x of eng.world.fx) {
    if (x.t === 'talk') talk = { who: x.who, ...(x.arrest && { arrest: true }) }
    if (x.t === 'panel' && x.panel === 'trade' && x.by) (trade = x.by), (talk = undefined)
    if (x.t === 'panel' && x.panel === 'pockets' && x.by) pockets = x.by
    if (x.t === 'panel' && x.panel === 'gift' && x.by) (gift = x.by), (talk = undefined)
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
  if (backdropOn) panel = talk = trade = pockets = gift = undefined
  else peopleOpened(eng)
  // A paused world's full snapshot can itself cost more than a tick on large saves. Reserve
  // most worker time for the transfer; ordinary messages and closing the panel still run.
  if (batchBusy() && t0 < nextTransferFrame) return
  const stopped = timeStopped(game)
  if (!stopped) {
    if (moveDir) eng.movePlayer(moveDir, walk)
    if (fishingActive(eng)) (attacking = false), (swinging = undefined)
    else {
      if (attacking) eng.controls.strike()
      // the left button held: its act again at the aim, as a swing's pace allows
      if (swinging) eng.controls.again(swinging, aimTile)
    }
    eng.tick()
  }
  if (game.neededMaps().length) void ensureMaps()
  const w = eng.world
  const summonOf = played().summon
  if (summon && summonOf && w.posOf(w.player)?.map === summon.map && w.state.maps[summon.map]) {
    const s = summon
    summon = undefined
    // the game's body for the kit, on the nearest open tile of its field clear of any boss still standing there
    // (their bodies are large)
    const bosses = w.entitiesOnMap(s.map).filter((e) => e.boss && w.num(e, 'hp') > 0).map((e) => w.posOf(e)!)
    const clear = (x: number, y: number) => w.walkable(s.map, x, y) && bosses.every((b) => Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) >= 4)
    const at = [[0, 0], [0, -4], [-5, 0], [0, 4], [5, 0], [-5, -4], [-5, 4]].map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy })).find((p) => clear(p.x, p.y)) ?? { x: s.x, y: s.y }
    const made = summonOf(s.kit, { map: s.map, ...at }, `${s.map}.${s.kit}.${w.state.tick}`)
    eng.author(() => w.add(made.body))
    if (made.say) w.fx.push({ t: 'log', text: made.say, tone: 'warn' })
  }
  const pos = w.posOf(w.player)
  if (!pos || !w.state.maps[pos.map]) return
  if (pos.map !== lastMap) {
    const first = !lastMap
    lastMap = pos.map
    const map = w.state.maps[pos.map]
    const look = index.regions?.find((r) => r.id === map.region)?.look
    post({ t: 'map', map, ...(look && { look }) })
    if (!first) saveEvery = 599 // save right after arriving somewhere new
  }
  // save as soon as the story moves on (a quest reached a stage)
  if (w.fx.some((x) => x.t === 'quest')) saveEvery = 599
  // (what the tick itself opened: a guard stopping the one at the keys)
  if (!backdropOn) peopleOpened(eng)
  // Batches pause ticks, but their progress frames still need new bag kinds and the hand.
  if (batchBusy()) eng.controls.keep()
  const frame = snapshot(eng, { panel, view })
  // the world behind the title shows its places and their people: the traveller and the companions are not drawn
  if (backdropOn) frame.entities = frame.entities.filter((e) => e.id !== w.state.player && !w.companionIds.has(e.id))
  if (panel && !frame.container) panel = undefined // closed by the world (it burned, a rule shut it)
  // the people's panels: closed when the one they are with is gone (dead, away)
  if (eng.modules.some((m) => m.id === 'society')) Object.assign(frame, peopleViews(eng, { talk, trade, pockets, gift }))
  if (talk && !frame.talk) talk = undefined
  if (trade && !frame.trade) trade = undefined
  if (pockets && !frame.pockets) pockets = undefined
  if (gift && !frame.gift) gift = undefined
  // nothing while the player cannot act (working out an act, down, in a scene)
  frame.keys = backdropOn ? undefined : keysNow(game)
  if (!backdropOn) maybePrefetch()
  lastTickMs = performance.now() - t0
  nextTransferFrame = batchBusy() ? performance.now() + Math.max(TICK_MS, lastTickMs * 3) : 0
  // the codex: what the player carries and who and what is near (the reader's record, beside the state)
  if (w.state.tick % 5 === 0) game.codex.record(w)
  const learning = asking && asked ? { seconds: Math.floor((t0 - asked.since) / 1000), limit: (asking.deadline === Number.POSITIVE_INFINITY ? MAKE_MS : ASK_MS) / 1000 } : undefined
  const sent = frames.encode(frame)
  post({ t: 'frame', frame: sent.frame, ...(sent.gone && { gone: sent.gone }), perf: { tickMs: lastTickMs, entities: Object.keys(w.state.entities).length, loaded: w.state.loadedMaps.length }, codex: game.codex.version, learning, transfer: transfers.progress, crafting: crafts.progress })
  if (buildAim) post({ t: 'placement', preview: buildPreview(eng, buildAim.id, { map: frame.map, x: buildAim.tile.x, y: buildAim.tile.y }, buildAim.up) })
  if (eng.lib.version !== lastRecordsVersion || frame.fx.some((f) => f.t === 'undefined' || f.t === 'patched')) {
    if (eng.lib.version !== lastRecordsVersion) (post({ t: 'library', library: storedLibrary(), statuses: eng.lib.statuses }), sendArts(), sendRecipes())
    lastRecordsVersion = eng.lib.version
    sendRecords()
  }
  // the minute's save (and the one on arriving, or as the story moves) waits while one is in danger:
  // hurt a moment ago, or with something hostile near, the save loaded after a fall would be the
  // fight one lost (loaded, one would fall again)
  const hp = w.num(w.player, 'hp')
  if (hp < lastHp) hurtTick = w.state.tick
  lastHp = hp
  if (!backdropOn && ++saveEvery >= 600 && !inDanger()) {
    saveEvery = 0
    doSave(true)
  }
}

/**
 * The world behind the title: the game's world at a place and an hour with no story to take the stage (the trailer's
 * stage does the same), the modder never asked. The traveller stands there unharmed for the world to run round them,
 * but is not drawn (loop). Its frames are only drawn.
 */
async function backdrop(m: Extract<ToWorker, { t: 'backdrop' }>): Promise<void> {
  const mine = ++generation
  // the world before stops at once: nothing of it is sent while the next is made
  if (timer) clearInterval(timer)
  timer = undefined
  transfers.cancel()
  crafts.cancel()
  nextTransferFrame = 0
  panel = talk = trade = pockets = gift = undefined
  base = m.base
  const idx = await fetchJson<WorldIndex>('index.json')
  if (mine !== generation) return
  index = idx
  connecting?.stop()
  if (syncTimer) clearInterval(syncTimer)
  const quiet = { ...index, steps: [], quests: [], invariants: [] }
  const g = Game.create(quiet, ontology(), libraryFrom(m.library, index.protectedFacts), { at: m.at, ...(m.hour !== undefined && { hour: m.hour }) })
  const w = g.engine.world
  g.engine.author(() => w.setProp(w.player, 'invulnerable', true))
  g.worldVersion = index.version
  g.keepMaps = KEEP_MAPS
  g.engine.quality = quality
  for (const s of played().skills.all) g.engine.skills.set(s.id, s)
  game = g
  backdropOn = true
  paused = false
  frames.reset()
  view = undefined
  lastMap = ''
  lastRecordsVersion = g.engine.lib.version
  await ensureMaps()
  if (mine !== generation) return
  artSent.clear()
  sendArts()
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    try {
      loop()
    } catch (err) {
      post({ t: 'error', message: (err as Error).stack ?? String(err) })
    }
  }, TICK_MS)
}

async function start(init: Extract<ToWorker, { t: 'init' }>, fresh = false): Promise<void> {
  const mine = ++generation
  backdropOn = false
  if (timer) clearInterval(timer)
  timer = undefined
  transfers.cancel()
  crafts.cancel()
  nextTransferFrame = 0
  panel = undefined
  base = init.base
  if (init.prefetch !== undefined) prefetchAsked = init.prefetch
  if (init.quality) quality = qualityOf(init.quality)
  index = await fetchJson<WorldIndex>('index.json')
  if (mine !== generation) return
  const compatible = init.save?.world === index.version
  // the shared library, with what the save loaded keeps of its own though another game's sync forgot it
  const taken = withKept(init.library, init.save && !fresh && compatible ? init.save : undefined)
  kept = { types: new Set(taken.kept.types), statuses: new Set(taken.kept.statuses) }
  const lib = libraryFrom(taken.library ?? init.save?.library, index.protectedFacts)
  if (init.save && !fresh && compatible) {
    game = Game.load(init.save, index, ontology(), lib, played().upgradeSave)
    // an older save brought up to the world as it is now: the game's own upgrades, the author's, on loading
    await played().upgrade?.(game, { index, chunk: chunkOf })
    // re-fetch the map we are standing on: its data, and its things as its file has them (the save kept what differs)
    const here = game.engine.world.posOf(game.engine.world.player)?.map
    if (here) game.loadChunk(await chunkFor(here))
    for (const id of game.engine.world.state.loadedMaps) if (id !== here) delete game.engine.world.state.maps[id]
    // the questions open when it was saved are answered by no one: their defaults run, as after a time-out
    settleOpenQuestions(game.engine, init.save)
  } else {
    game = Game.create(index, ontology(), lib, init.at ? { at: init.at } : init.start)
    // a new game is already the world as it is now: no upgrade is due (the game's, the author's, on creating it)
    const w = game.engine.world
    played().fresh?.(game)
    game.engine.author(() => w.setFact('game.difficulty', init.difficulty ?? 'normal'))
    // the traveller the player made (docs/looks.md): a look the world's table knows, else the world's own
    const looks = ontology().looks
    if (init.look && looks && !lookProblems(init.look, looks).length) game.engine.author(() => (w.player.look = structuredClone(init.look)))
    // the editor's "play from this scene": the step begun before any other can take control
    if (init.scene && !game.engine.story.start(init.scene)) post({ t: 'error', message: `the story has no step ${init.scene} to begin` })
  }
  game.worldVersion = index.version
  game.keepMaps = KEEP_MAPS
  frames.reset()
  view = undefined
  // the player's AI setting: which tier each kind of event is asked at, and takes learned answers from
  game.engine.quality = quality
  // what was learned past the checks of its time (an older client's copy) and nothing here needs is forgotten
  for (const id of forgetInvalid(game.engine, kept.types)) console.info(`[library] forgotten on loading (no longer valid): ${id}`)
  // a night's sleep (a long step) passes a game hour a tick: the screen keeps up, and one lies asleep all the while
  game.engine.fastForwardChunk = TICKS_PER_HOUR
  // every skill the tree has, so a skill set in the bar can be cast from a loaded game (actives.ts)
  for (const s of played().skills.all) game.engine.skills.set(s.id, s)
  game.mods.onChange = () => sendRecords()
  lastMap = ''
  // a game begun or loaded tells the main thread its library, whatever the last one's version was
  lastRecordsVersion = -1
  await ensureMaps()
  if (mine !== generation) return
  post({ t: 'ready', stats: index.stats, name: index.name, resumed: !!init.save && !fresh && compatible })
  artSent.clear()
  sendArts()
  // a new game: whatever the main thread was told before, it is told again
  recipesSent = '\0'
  sendRecipes()
  sendRecords()
  // a modder named anew (the player's own, over a port of its own; a service's address), or the one asked before
  const to = init.modderPort ? portLink(init.modderPort) : init.modder !== undefined ? (init.modder ? serviceLink(init.modder) : undefined) : link
  void connectModder(to, init.library ? init.librarySeq : 0, init.library)
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
      case 'backdrop':
        await backdrop(m)
        break
      case 'newGame': {
        const library = game && storedLibrary()
        await start({ t: 'init', base, library }, true)
        break
      }
      case 'dash':
        if (game && !paused && !panel && !game.engine.world.state.question) dash(game.engine, game.engine.world.player)
        break
      case 'attack':
        {
          const route = routeFishingWorkerInput(!!game && fishingActive(game.engine), m)
          if (route.kind === 'fishing') {
            attacking = false
            if (route.action !== 'press' || (game && !timeStopped(game))) game && fishingInput(game.engine, route.action)
            break
          }
          attacking = m.on
          // the first blow lands on the press, not on the next tick
          if (m.on && !paused && !panel && !game?.engine.world.state.question) game?.engine.controls.strike()
        }
        break
      case 'fishing':
        if (!game) break
        if (m.action === 'press' && timeStopped(game)) break
        if (m.action === 'cancel') attacking = false
        fishingInput(game.engine, m.action)
        break
      case 'move':
        moveDir = m.dir
        walk = !!m.walk
        if (m.dir && game && !timeStopped(game)) cancelFishing(game)
        if (m.dir && !paused && !panel && !game?.engine.world.state.question) game?.engine.movePlayer(m.dir, walk) // a quick tap still moves one tile
        break
      case 'primary': {
        if (!m.on) {
          swinging = undefined
          break
        }
        if (!game || routeFishingWorkerInput(fishingActive(game.engine), { t: 'key', key: 'primary' }).kind === 'ignore') break
        if (paused || panel || game.engine.world.state.question) break
        const c = game.engine.controls
        // the target the left click's label named (one who walked a step off since stays it)
        const plan = c.planFor('primary', m.tile, undefined, shownTarget.primary)
        swinging = plan
        if (!plan) break
        const out = c.swing(plan)
        if (out.panel) panel = out.panel
        break
      }
      case 'key': {
        if (!game) break
        if (routeFishingWorkerInput(fishingActive(game.engine), m).kind === 'ignore') break
        if (paused || panel || game.engine.world.state.question) break
        const c = game.engine.controls
        // the target the key's label named (one who walked a step off since stays it); a layer chosen is that layer
        const plan = c.planFor(m.key, m.tile, m.layer, m.layer !== undefined ? undefined : shownTarget[m.key])
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
        buildAim = m.id && m.tile && (placementById()[m.id] || m.id.startsWith(PUT)) ? { id: m.id, tile: m.tile, up: m.up } : undefined
        break
      case 'build': {
        if (!game || paused || panel || game.engine.world.state.question || !(placementById()[m.id] || m.id.startsWith(PUT))) break
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
        const result = performPlacement(eng, eng.world.state.player, placementById()[m.id], to, m.facing)
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
      case 'useItemOnHeldItem':
        if (game && !game.engine.world.state.question) game.engine.controls.useItemOnHeldItem(m.instrument, m.target)
        break
      case 'choices': {
        if (!game) break
        const list = game.engine.controls.choices(m.key, m.tile).map((ch) => ({ layer: ch.layer, name: ch.name, label: ch.plan?.label, unknown: (ch.plan?.unknown && !ch.plan.quiet && asks()) || undefined }))
        post({ t: 'choices', key: m.key, tile: m.tile, list })
        break
      }
      case 'handUp':
        handUp = m.up
        break
      case 'view':
        view = { map: m.map, x: m.x, y: m.y, w: m.w, h: m.h }
        break
      case 'aim':
        aimTile = m.tile
        // what the keys would do there, at once: the pointer's mark follows the hand, not the tick (always
        // answered, with the aim's number: the page waits for it before it acts on what the keys would do)
        post({ t: 'keys', keys: game ? keysNow(game) : undefined, n: m.n })
        break
      case 'answer':
        // a key or a button held when the question came is not taken for a second press after it (it would ask again)
        attacking = false
        swinging = undefined
        game?.engine.controls.answer(m.yes)
        break
      case 'select':
        cancelFishing(game)
        game?.engine.controls.select(m.slot)
        break
      case 'cycle':
        cancelFishing(game)
        game?.engine.controls.cycle(m.dir)
        break
      case 'row':
        game?.engine.controls.nextRow(m.dir)
        break
      case 'swap':
        game?.engine.controls.swap(m.a, m.b)
        break
      case 'moveSlot':
        post({ t: 'slotMove', request: m.request, moved: game?.engine.controls.moveSlot(m.from, m.to, m.item, m.count, m.sourceCount) ?? false })
        break
      case 'quickMove':
        game?.engine.controls.quickMove(m.slot)
        break
      case 'drop':
        cancelFishing(game)
        game?.engine.controls.drop(m.slot, m.all, m.item !== undefined && m.count !== undefined && m.sourceCount !== undefined ? { item: m.item, count: m.count, sourceCount: m.sourceCount } : undefined)
        break
      case 'organize':
        game?.engine.controls.organize()
        break
      case 'wear':
        game?.engine.controls.wear(m.item, m.putOn)
        break
      case 'craft': {
        if (!game || batchBusy()) break
        // the game's recipes, and those of things the world learned (the engine derives them from a patch's type)
        const r = recipeOf(game.engine, m.id)
        if (!r) break
        if (m.all) {
          const owner = game
          nextTransferFrame = 0
          crafts.enqueue(owner.engine.controls.craftSteps(r, undefined, m.at), 'craft',
            () => game === owner && !owner.engine.world.state.question && !owner.mods.asking)
        } else game.engine.controls.craft(r, m.at)
        break
      }
      case 'cancelCraft':
        crafts.cancel()
        break
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
        if (game) chooseBoon(game.engine, m.id)
        break
      case 'speak':
        game?.engine.controls.talk(m.who, m.verb, m.choice)
        break
      case 'offer':
        game?.engine.controls.offer(m.target, m.item, m.count)
        break
      case 'profession':
        if (game) takeProfession(game.engine, professionById()[m.id], played().skills.all)
        break
      case 'restyle':
        if (game) restyle(game.engine, m.look)
        break
      case 'learn': {
        const s = skillById()[m.id]
        if (s) game?.engine.controls.learn(s)
        break
      }
      case 'cast':
        if (game && !paused && !panel && !game.engine.world.state.question) cast(game.engine, m.slot)
        break
      case 'setSkill':
        if (game) setSkill(game.engine, m.slot, m.id)
        break
      case 'transfer':
        if (game && panel && !crafts.busy) {
          const owner = game, container = panel
          const go = () => {
            if (game !== owner || panel !== container) return
            if (!transfers.busy) nextTransferFrame = 0
            transfers.enqueue(owner.engine.controls.transferSteps(container, m.from, m.item, m.all), m.from,
              () => game === owner && panel === container && !owner.engine.world.state.question && !owner.mods.asking)
          }
          // taking what is another's is asked first (a theft: it would weigh on one's conscience)
          if (!owner.engine.controls.asksBeforeTransfer(container, m.from, m.item, m.all, go)) go()
        }
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
      case 'track':
        game?.engine.controls.track(m.id)
        break
      case 'board':
        game?.engine.controls.board(m.who, m.ref)
        break
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
      case 'gift':
        if (game && gift) game.engine.controls.gift(gift, m.item)
        break
      case 'closeGift':
        gift = undefined
        break
      case 'closePanel': {
        transfers.cancel()
        if (game && panel && game.engine.world.hasStatus({ e: panel }, 'open')) game.engine.interact('interact', game.engine.world.state.player, { e: panel }, { instrument: null })
        panel = undefined
        break
      }
      case 'pause':
        paused = m.on
        if (!m.on) crafts.cancel()
        break
      case 'modder':
        // the player chose another modder (their own model in the settings, or none): asked from now on
        void connectModder(m.port ? portLink(m.port) : m.url ? serviceLink(m.url) : undefined)
        break
      case 'quality':
        // a change of setting holds from the next event: its tier asks, and takes the answers it reaches
        quality = qualityOf(m.quality)
        if (game) game.engine.quality = quality
        break
      case 'patch': {
        if (!game) break
        const mods = game.mods
        const result = takePatch(game.engine, kept, m.patch, (p) => mods.submit(m.id, p))
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
        // a type the world has: an unknown id would make a nameless thing that is saved with the game
        if (m.op === 'give' && !w.onto.hasType(m.type)) w.fx.push({ t: 'log', text: { en: `No such type: ${m.type}.`, zh: `没有这个类型：${m.type}。` }, tone: 'bad' })
        else if (m.op === 'give') {
          // gear rolls its extras as it is made anywhere (engine affixes.ts)
          const slot = w.onto.resolve(m.type).props.slot
          eng.author(() => (w.create(m.type, { on: 'inside', holder: w.state.player }, { ...(m.tags && { tags: m.tags }), ...(typeof slot === 'string' && { props: rollAffixes(w.onto.data, slot, () => w.rand()) }) }), eng.controls.sync()))
        }
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
        // development: a step played now, or a scene written in the console (lsw.send({ t: 'debug', op: 'scene', script: [{ picture: 'own/cg/x.webp' }, { say: 'player', text: '…' }] }))
        if (m.op === 'scene') {
          if (m.script) eng.story.defs.set('dev.scene', { id: 'dev.scene', manual: true, script: m.script })
          if (!eng.story.start(m.script ? 'dev.scene' : m.id ?? '')) w.fx.push({ t: 'log', text: { en: 'No such step, or a scene is playing.', zh: '没有这个剧情步骤，或者正有场景在播放。' }, tone: 'bad' })
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
