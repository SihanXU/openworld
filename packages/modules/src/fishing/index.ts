// An optional, game-configured fishing fight. Candidate selection and words stay in game content;
// this module owns only the deterministic session, input edges and render projection.

import { registerModule, stackKey, type Engine, type EngineModule, type EffectRunner, type Entity, type FishingView, type GameEvent, type ItemInfo, type Ref, type Text, type World } from '@openworld/engine'

type FishMotion = 'cruise' | 'pause' | 'burst'

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
  fishTarget: number
  fishVelocity: number
  fishDirection: number
  fishMotion: FishMotion
  fishMotionTicks: number
  bar: number
  progress: number
  pressing: boolean
  pressEdge: boolean
}

const KEY = 'module:fishing.session'
const FISH_MIN = 0.04
const FISH_MAX = 0.96
const NORMAL_BAR_SIZE = 0.4
const RARE_BAR_SIZE = 0.34
const PROGRESS_GAIN = 0.035
const PROGRESS_LOSS = 0.028
const engines = new WeakMap<World, Engine>()
const states = (eng: Engine): { session?: Session } => {
  let s = eng.world.ext.get(KEY) as { session?: Session } | undefined
  if (!s) eng.world.ext.set(KEY, (s = {}))
  return s
}

function activeMaps(eng: Engine): string[] {
  return eng.world.onto.data.fishing?.maps ?? []
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function barSize(s: Session): number {
  return s.difficulty >= 0.7 ? RARE_BAR_SIZE : NORMAL_BAR_SIZE
}

function nextFishMotion(eng: Engine, s: Session): void {
  const rare = s.difficulty >= 0.7
  const choice = eng.world.rand()
  if (choice < 0.2) {
    s.fishMotion = 'pause'
    s.fishMotionTicks = 2 + Math.floor(eng.world.rand() * 3)
    return
  }
  const burstChance = rare ? 0.42 : 0.24
  s.fishMotion = choice < 0.2 + burstChance ? 'burst' : 'cruise'
  s.fishMotionTicks = s.fishMotion === 'burst'
    ? 3 + Math.floor(eng.world.rand() * 3)
    : 8 + Math.floor(eng.world.rand() * 7)
  const reverse = eng.world.rand() < (rare ? 0.36 : 0.44)
  if (reverse) s.fishDirection *= -1
  const distance = 0.18 + eng.world.rand() * 0.34
  s.fishTarget = clamp(s.fish + s.fishDirection * distance, FISH_MIN + 0.02, FISH_MAX - 0.02)
}

/** Advance the catch on engine ticks only; frame reads never change this state. */
function advanceFish(eng: Engine, s: Session): void {
  if (s.fishMotionTicks <= 0) nextFishMotion(eng, s)
  s.fishMotionTicks -= 1

  if (s.fish > 0.88 && s.fishVelocity > 0 && s.fishTarget > s.fish) {
    s.fishDirection = -1
    s.fishTarget = clamp(s.fish - 0.18, FISH_MIN + 0.02, FISH_MAX - 0.02)
    s.fishMotion = 'pause'
    s.fishMotionTicks = Math.max(2, s.fishMotionTicks)
  } else if (s.fish < 0.12 && s.fishVelocity < 0 && s.fishTarget < s.fish) {
    s.fishDirection = 1
    s.fishTarget = clamp(s.fish + 0.18, FISH_MIN + 0.02, FISH_MAX - 0.02)
    s.fishMotion = 'pause'
    s.fishMotionTicks = Math.max(2, s.fishMotionTicks)
  }

  const targetDelta = s.fishTarget - s.fish
  const direction = Math.sign(targetDelta) || s.fishDirection
  s.fishDirection = direction
  const rare = s.difficulty >= 0.7
  const cruiseSpeed = 0.022 + clamp(s.difficulty, 0, 1) * 0.012
  const modeSpeed = s.fishMotion === 'burst' ? cruiseSpeed * (rare ? 1.8 : 1.65) : cruiseSpeed
  const targetBrake = clamp(Math.abs(targetDelta) / 0.16, 0.12, 1)
  const edgeDistance = direction > 0 ? FISH_MAX - s.fish : s.fish - FISH_MIN
  const edgeBrake = clamp(edgeDistance / 0.2, 0.15, 1)
  const desiredVelocity = s.fishMotion === 'pause' ? 0 : direction * modeSpeed * Math.min(targetBrake, edgeBrake)
  const acceleration = 0.0045 + clamp(s.difficulty, 0, 1) * 0.0015
  s.fishVelocity += clamp(desiredVelocity - s.fishVelocity, -acceleration, acceleration)
  s.fish = clamp(s.fish + s.fishVelocity, FISH_MIN, FISH_MAX)
  if ((s.fish === FISH_MIN && s.fishVelocity < 0) || (s.fish === FISH_MAX && s.fishVelocity > 0)) s.fishVelocity = 0
}

function projectedFish(eng: Engine, type: string): ItemInfo | undefined {
  if (!type) return undefined
  const def = eng.world.onto.resolve(type)
  return {
    id: 'fishing-catch-preview',
    type,
    sprite: def.sprite ?? type,
    name: def.name ?? type.slice(type.lastIndexOf('/') + 1),
    tags: [...(def.tags ?? [])],
    statuses: [],
    props: { ...(def.props ?? {}) },
  }
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
  const difficulty = clamp(typeof ev.params?.difficulty === 'number' ? ev.params.difficulty : 0.5, 0, 1)
  const fish = 0.2 + w.rand() * 0.6
  const fishDirection = w.rand() < 0.5 ? -1 : 1
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
    difficulty,
    message: typeof ev.params?.message === 'string' ? { en: ev.params.message, zh: String(ev.params.messageZh ?? ev.params.message) } : '',
    phase: 'waiting',
    remaining: 10 + Math.floor(w.rand() * 21),
    fish,
    fishTarget: clamp(fish + fishDirection * (0.24 + w.rand() * 0.3), FISH_MIN + 0.02, FISH_MAX - 0.02),
    fishVelocity: 0,
    fishDirection,
    fishMotion: 'cruise',
    fishMotionTicks: 10 + Math.floor(w.rand() * 6),
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
    s.remaining = 20
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
  const zoneSize = barSize(s)
  s.bar = clamp(s.bar + (s.pressing ? 0.045 : -0.035), zoneSize / 2, 1 - zoneSize / 2)
  advanceFish(eng, s)
  const inBar = Math.abs(s.fish - s.bar) <= zoneSize / 2
  s.progress = clamp(s.progress + (inBar ? PROGRESS_GAIN : -PROGRESS_LOSS), 0, 1)
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
    barSize: barSize(s),
    progress: s.progress,
    remaining: s.phase === 'fight' ? 0 : Math.max(0, s.remaining / 10),
    bait: eng.world.get(s.rod) ? eng.world.num(eng.world.get(s.rod)!, 'bait') : 0,
    ...(s.phase === 'fight' ? { fishItem: projectedFish(eng, s.fishType) } : {}),
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
      'fishing/start': 'fishing/start {} — begin a game-configured line session from the actor notification, keeping the candidate fish hidden until the fight begins',
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
