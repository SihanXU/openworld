// An optional, game-configured fishing fight. Candidate selection and words stay in game content;
// this module owns only the deterministic session, input edges and render projection.

import { registerModule, stackKey, type Engine, type EngineModule, type EffectRunner, type Entity, type FishingView, type GameEvent, type Ref, type Text, type World } from '@openworld/engine'

interface Session {
  actor: string
  rod: string
  source: Ref
  map: string
  actorX: number
  actorY: number
  actorZ: number
  sourceX: number
  sourceY: number
  sourceZ: number
  hp: number
  fishType: string
  extraType: string
  difficulty: number
  message: Text
  phase: FishingView['phase'] | 'settling'
  remaining: number
  fish: number
  fishDirection: number
  bar: number
  progress: number
  pressing: boolean
  pressEdge: boolean
}

const KEY = 'module:fishing.session'
const BAR_SIZE = 0.24
const engines = new WeakMap<World, Engine>()
const states = (eng: Engine): { session?: Session } => {
  let s = eng.world.ext.get(KEY) as { session?: Session } | undefined
  if (!s) eng.world.ext.set(KEY, (s = {}))
  return s
}

function activeMaps(eng: Engine): string[] {
  return eng.world.onto.data.fishing?.maps ?? []
}

function hasRoom(eng: Engine, actor: Entity, resultTypes?: string[]): boolean {
  if (actor.id !== eng.world.player.id) return false
  const used = eng.controls.carried(true)
  const extra = eng.world.onto.data.fishing?.extraType && eng.world.num(actor, 'fishExtra') > 0
  const needed = resultTypes
    ? [...new Set(resultTypes.map((type) => stackKey({ type })))].filter((key) => !used.has(key)).length
    : extra ? 2 : 1
  return eng.controls.slotCount() - used.size >= needed
}

function validSession(eng: Engine, s: Session): boolean {
  const w = eng.world
  const actor = w.get(s.actor)
  const rod = w.get(s.rod)
  const source = w.get(s.source.e)
  const p = actor && w.posOf(actor)
  const at = w.refPos(s.source)
  return !!actor && actor.id === w.player.id && !!rod && rod.place.on === 'hand' && rod.place.holder === actor.id && actor.held === rod.id &&
    !!p && p.map === s.map && p.x === s.actorX && p.y === s.actorY && (p.z ?? 0) === s.actorZ &&
    !!at && at.map === s.map && at.x === s.sourceX && at.y === s.sourceY && (at.z ?? 0) === s.sourceZ && w.hasTag(source!, 'water') &&
    Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) <= w.num(rod, 'range', 3) && w.num(actor, 'hp') >= s.hp &&
    activeMaps(eng).includes(s.map)
}

function tell(eng: Engine, actor: string, what: string, extra: Record<string, string | number | boolean> = {}): void {
  eng.queue({ kind: 'impulse/notify', host: { e: actor }, roles: { source: { e: actor } }, params: { what, ...extra }, origin: 'world' })
}

function start(eng: Engine, ev: GameEvent): void {
  const w = eng.world
  const actor = w.get(ev.host.e)
  const sourceRef = ev.roles.source
  const source = sourceRef && w.get(sourceRef.e)
  const p = actor && w.posOf(actor)
  const at = source && w.posOf(source)
  const rod = actor && w.get(actor.held)
  if (!actor || actor.id !== w.player.id || !p || !at || !source || !rod || !w.hasTag(rod, 'tool:fishing') || !w.hasTag(source, 'water') ||
    !activeMaps(eng).includes(at.map) || states(eng).session || !hasRoom(eng, actor)) return
  const s: Session = {
    actor: actor.id,
    rod: rod.id,
    source: sourceRef!,
    map: at.map,
    actorX: p.x,
    actorY: p.y,
    actorZ: p.z ?? 0,
    sourceX: at.x,
    sourceY: at.y,
    sourceZ: at.z ?? 0,
    hp: w.num(actor, 'hp'),
    fishType: typeof ev.params?.fish === 'string' ? ev.params.fish : '',
    extraType: typeof ev.params?.extraType === 'string' ? ev.params.extraType : '',
    difficulty: typeof ev.params?.difficulty === 'number' ? ev.params.difficulty : 0.5,
    message: typeof ev.params?.message === 'string' ? { en: ev.params.message, zh: String(ev.params.messageZh ?? ev.params.message) } : '',
    phase: 'waiting',
    remaining: 10 + Math.floor(w.rand() * 21),
    fish: 0.2 + w.rand() * 0.6,
    fishDirection: w.rand() < 0.5 ? -1 : 1,
    bar: 0.5,
    progress: 0.45,
    pressing: false,
    pressEdge: false,
  }
  states(eng).session = s
}

function land(fx: EffectRunner, ev: GameEvent): void {
  const eng = fx.eng
  const s = states(eng).session
  if (!s || s.phase !== 'settling' || ev.host.e !== s.actor) return
  states(eng).session = undefined
  if (!validSession(eng, s)) return
  const w = eng.world
  const actor = w.get(s.actor)!
  const rewards = [s.fishType, ...(s.extraType && w.num(actor, 'fishExtra') > 0 ? [s.extraType] : [])].filter(Boolean)
  if (!hasRoom(eng, actor, rewards)) {
    tell(eng, actor.id, 'fishing-full')
    return
  }
  fx.apply({ op: 'spawn', type: s.fishType, at: 'host', into: 'contents' }, ev)
  if (s.extraType) fx.apply({ op: 'spawn', type: s.extraType, at: 'host', into: 'contents', count: { prop: 'fishExtra', of: 'host' } }, ev)
  w.fx.push({ t: 'log', text: s.message || { en: 'You land the fish!', zh: '你钓上了鱼！' }, tone: 'good' })
}

function step(eng: Engine, ev: GameEvent): void {
  const s = states(eng).session
  if (!s || ev.host.e !== s.actor) return
  if (!validSession(eng, s)) {
    states(eng).session = undefined
    return
  }
  if (s.phase === 'waiting') {
    if (--s.remaining > 0) return
    if (!s.fishType) {
      states(eng).session = undefined
      const message = typeof s.message === 'string' ? s.message : s.message.en
      const messageZh = typeof s.message === 'string' ? s.message : s.message.zh ?? s.message.en
      tell(eng, s.actor, 'fishing-missed', { message, messageZh })
      return
    }
    s.phase = 'bite'
    s.remaining = 12
    tell(eng, s.actor, 'fishing-bite')
    return
  }
  if (s.phase === 'bite') {
    if (--s.remaining <= 0) {
      states(eng).session = undefined
      tell(eng, s.actor, 'fishing-escaped')
    }
    return
  }
  if (s.phase !== 'fight') return
  s.bar = Math.max(BAR_SIZE / 2, Math.min(1 - BAR_SIZE / 2, s.bar + (s.pressing ? 0.045 : -0.035)))
  if (eng.world.state.tick % 3 === 0) {
    const movement = (0.025 + eng.world.rand() * 0.045 + s.difficulty * 0.1) * s.fishDirection
    if (s.fish + movement < 0.04 || s.fish + movement > 0.96) s.fishDirection *= -1
    s.fish = Math.max(0.04, Math.min(0.96, s.fish + movement))
  }
  const inBar = Math.abs(s.fish - s.bar) <= BAR_SIZE / 2
  s.progress = Math.max(0, Math.min(1, s.progress + (inBar ? 0.035 : -0.035)))
  if (s.progress >= 1) {
    s.phase = 'settling'
    s.pressing = false
    tell(eng, s.actor, 'fishing-land')
  } else if (s.progress <= 0) {
    states(eng).session = undefined
    tell(eng, s.actor, 'fishing-escaped')
  }
}

function input(eng: Engine, ev: GameEvent): void {
  const state = states(eng)
  const s = state.session
  if (!s || ev.host.e !== s.actor) return
  const action = ev.params?.action
  if (action === 'cancel') {
    state.session = undefined
    return
  }
  if (action !== 'press' || !s.pressEdge) return
  s.pressEdge = false
  if (s.phase === 'bite') {
    s.phase = 'fight'
    s.remaining = 0
  }
}

function tick(eng: Engine): void {
  const s = states(eng).session
  if (s) tell(eng, s.actor, 'fishing-step')
}

function view(eng: Engine): FishingView | undefined {
  const s = states(eng).session
  if (!s || s.phase === 'settling') return undefined
  return {
    phase: s.phase,
    fish: s.fish,
    bar: s.bar,
    barSize: BAR_SIZE,
    progress: s.progress,
    remaining: s.phase === 'fight' ? 0 : Math.max(0, s.remaining / 10),
    bait: eng.world.get(s.rod) ? eng.world.num(eng.world.get(s.rod)!, 'bait') : 0,
  }
}

export function fishingActive(eng: Engine): boolean {
  return !!states(eng).session
}

export function fishingInput(eng: Engine, action: 'press' | 'release' | 'cancel'): boolean {
  const state = states(eng)
  const s = state.session
  if (!s) return false
  if (action === 'cancel') {
    s.pressing = false
    tell(eng, s.actor, 'fishing-input', { action })
    return true
  }
  if (action === 'release') {
    s.pressing = false
    return true
  }
  if (s.pressing) return true
  s.pressing = true
  s.pressEdge = true
  tell(eng, s.actor, 'fishing-input', { action })
  return true
}

export const fishingModule: EngineModule = {
  id: 'fishing',
  effects: {
    'fishing/start': (_fx, _eff, ev) => start(_fx.eng, ev),
    'fishing/step': (_fx, _eff, ev) => step(_fx.eng, ev),
    'fishing/input': (_fx, _eff, ev) => input(_fx.eng, ev),
    'fishing/land': (fx, _eff, ev) => land(fx, ev),
  },
  conds: {
    fishingMap: (_c, _roles, w, ev) => {
      const p = ev && w.refPos(ev.host)
      return !!p && (w.onto.data.fishing?.maps ?? []).includes(p.map)
    },
    fishingBusy: (_c, _roles, w) => !!(w.ext.get(KEY) as { session?: Session } | undefined)?.session,
    fishingRoom: (_c, roles, w) => {
      const actor = roles.actor && 'e' in roles.actor.ref ? w.get(roles.actor.ref.e) : undefined
      const eng = engines.get(w)
      return !!actor && !!eng && hasRoom(eng, actor)
    },
  },
  spec: {
    primitives: {
      'fishing/start': 'fishing/start {} — begin a game-configured line session from the actor notification, keeping the candidate fish hidden until it is landed',
      'fishing/step': 'fishing/step {} — advance the session by one deterministic engine tick within the player actor\'s outcome',
      'fishing/input': 'fishing/input {} — handle an input edge within the player actor\'s outcome; only a fresh press edge during a bite starts the fight',
      'fishing/land': 'fishing/land {} — atomically grant the session catch once, from the actor notification that ends a successful fight',
    },
    conditions: ['fishingMap role:host — the host lies on a map enabled by Ontology.fishing.maps', 'fishingBusy — the player already has a fishing session', 'fishingRoom role:actor — the player has enough free bag slots for the largest possible catch'],
    rules: ['A fishing session exists only at maps named in the game ontology. The engine owns its timing and result; a client can submit only press/release/cancel input edges.'],
  },
  install(eng) {
    engines.set(eng.world, eng)
    eng.hooks.tick.push({ phase: 'status', run: () => tick(eng) })
    eng.hooks.frame.push((f) => { f.fishing = view(eng) })
  },
}

registerModule(fishingModule)
