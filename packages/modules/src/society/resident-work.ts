// Explicit, saved residence work orders. Physical items stay real entities; the order stores only their ids.

import { astar, hoursAt, itemInfo, matchSelector, slotsOf, stackKey, type Engine, type Entity, type GameEvent, type Id, type Pos, type Ref, type ResidentWorkOrder, type ResidenceWorkDef, type Roles, type Scene, type Text, type View, type World } from '@openworld/engine'
import type { EffectRunner } from '@openworld/engine'
import { socialOf } from './state.ts'

const EXT = 'society.residentWork'
const HARVEST_TAG = 'resident-work-harvest'
const TICK_STEP = 4
const ROUTE_RETRIES = 4
const ROUTE_RETRY_TICKS = 24
const MAX_COMMAND = 8192
const MAX_CELLS = 128

const L = (en: string, zh: string): Text => ({ en, zh })

interface Route {
  key: string
  path?: [number, number][]
  failures: number
  retryAt: number
}

interface TakePermit {
  actor: Id
  target: Id
  controller: Id
  tick: number
}

interface FeedPermit {
  actor: Id
  feed: Id
  target: Id
  controller: Id
  warehouse: Id
  map: string
  activeMap: string
  tick: number
}

interface ClaimPermit {
  actor: Id
  animal: Id
  controller: Id
  map: string
  token: number
  tick: number
}

interface InternalPermit {
  actor: Id
  action: string
  token: number
  tick: number
  params: Record<string, string | number>
}

interface Runtime {
  routes: Map<Id, Route>
  permits: TakePermit[]
  feedPermits: FeedPermit[]
  claims: ClaimPermit[]
  internal: InternalPermit[]
  nextToken: number
}

type WorkCommand =
  | { v: 1; op: 'claim'; animal: string }
  | { v: 1; op: 'assign'; kind: 'harvest'; worker: string; warehouse: string; cells: { x: number; y: number }[] }
  | { v: 1; op: 'assign'; kind: 'feed'; worker: string; warehouse: string; animalIds: string[] }
  | { v: 1; op: 'pause' | 'resume' | 'revoke' | 'drop'; worker: string }

function runtime(eng: Engine): Runtime {
  let rt = eng.world.ext.get(EXT) as Runtime | undefined
  if (!rt) eng.world.ext.set(EXT, (rt = { routes: new Map(), permits: [], feedPermits: [], claims: [], internal: [], nextToken: 1 }))
  rt.claims ??= []
  rt.claims = rt.claims.filter((permit) => permit.tick === eng.world.state.tick)
  return rt
}

function residence(eng: Engine) {
  return eng.world.onto.data.social?.residence
}

function workDef(eng: Engine): ResidenceWorkDef | undefined {
  return residence(eng)?.work
}

function sourceId(ref: Ref | undefined): Id | undefined {
  return ref && 'e' in ref ? ref.e : undefined
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

function exactKeys(x: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(x).every((key) => allowed.includes(key))
}

function parseCommand(raw: unknown): WorkCommand | undefined {
  if (typeof raw !== 'string' || raw.length > MAX_COMMAND) return undefined
  let value: unknown
  try { value = JSON.parse(raw) } catch { return undefined }
  if (!isRecord(value) || value.v !== 1 || typeof value.op !== 'string') return undefined
  if (value.op === 'claim') {
    if (!exactKeys(value, ['v', 'op', 'animal']) || typeof value.animal !== 'string' || !value.animal || value.animal.length > 128) return undefined
    return { v: 1, op: 'claim', animal: value.animal }
  }
  if (typeof value.worker !== 'string' || !value.worker || value.worker.length > 128) return undefined
  if (value.op === 'assign') {
    if (typeof value.warehouse !== 'string' || !value.warehouse || value.warehouse.length > 128) return undefined
    const kind = value.kind ?? 'harvest'
    if (kind === 'feed') {
      if (!exactKeys(value, ['v', 'op', 'kind', 'worker', 'warehouse', 'animalIds']) || !Array.isArray(value.animalIds) || value.animalIds.length < 1 || value.animalIds.length > MAX_CELLS) return undefined
      const animalIds = value.animalIds
      if (animalIds.some((id) => typeof id !== 'string' || !id || id.length > 128) || new Set(animalIds).size !== animalIds.length) return undefined
      return { v: 1, op: 'assign', kind, worker: value.worker, warehouse: value.warehouse, animalIds: animalIds as string[] }
    }
    if (kind !== 'harvest' || !exactKeys(value, Object.hasOwn(value, 'kind') ? ['v', 'op', 'kind', 'worker', 'warehouse', 'cells'] : ['v', 'op', 'worker', 'warehouse', 'cells']) || !Array.isArray(value.cells) || value.cells.length < 1 || value.cells.length > MAX_CELLS) return undefined
    const cells: { x: number; y: number }[] = []
    const seen = new Set<string>()
    for (const item of value.cells) {
      if (!isRecord(item) || !exactKeys(item, ['x', 'y']) || !Number.isSafeInteger(item.x) || !Number.isSafeInteger(item.y)) return undefined
      const x = item.x as number, y = item.y as number, key = `${x},${y}`
      if (seen.has(key)) return undefined
      seen.add(key)
      cells.push({ x, y })
    }
    return { v: 1, op: 'assign', kind, worker: value.worker, warehouse: value.warehouse, cells }
  }
  if (['pause', 'resume', 'revoke', 'drop'].includes(value.op) && exactKeys(value, ['v', 'op', 'worker']))
    return { v: 1, op: value.op as Extract<WorkCommand, { op: 'pause' | 'resume' | 'revoke' | 'drop' }>['op'], worker: value.worker }
  return undefined
}

function configController(eng: Engine, manager: Entity): boolean {
  const sel = workDef(eng)?.controller
  const view = eng.world.view({ e: manager.id })
  return !!sel && !!view && matchSelector(sel, view)
}

function claimableAnimal(eng: Engine, animal: Entity, player: Entity, view?: View): boolean {
  const w = eng.world
  const home = residence(eng)
  const selector = workDef(eng)?.livestock
  const pos = w.posOf(animal)
  const animalView = view ?? w.view({ e: animal.id })
  return !!home && !!selector && animal.place.on === 'tile' && animal.place.map === home.map && pos?.map === home.map &&
    w.isAgent(animal) && w.num(animal, 'hp', 0) > 0 && !animal.frozenBy && !!animalView && matchSelector(selector, animalView) &&
    eng.society.relation(eng.society.ownerOf(animal), player) === 'nobody'
}

function commandAuthority(eng: Engine, ev: GameEvent, manager: Entity | undefined): boolean {
  const w = eng.world
  const player = ev.roles.actor && w.get(ev.roles.actor.e)
  const source = ev.roles.source && w.get(ev.roles.source.e)
  const home = residence(eng)
  const pp = w.posOf(player), mp = w.posOf(manager)
  return !!home && !!manager && !!player && player.id === w.state.player && source?.id === manager.id &&
    configController(eng, manager) && !!pp && !!mp && pp.map === home.map && mp.map === home.map &&
    Math.max(Math.abs(pp.x - mp.x), Math.abs(pp.y - mp.y)) <= 1
}

function orderAuthority(eng: Engine, ev: GameEvent, manager: Entity | undefined): boolean {
  const w = eng.world
  const player = ev.roles.actor && w.get(ev.roles.actor.e)
  const source = ev.roles.source && w.get(ev.roles.source.e)
  const home = residence(eng)
  const pp = w.posOf(player), mp = w.posOf(manager)
  return !!home && !!manager && !!player && player.id === w.state.player && source?.id === player.id &&
    configController(eng, manager) && !!pp && !!mp && pp.map === home.map && mp.map === home.map &&
    Math.max(Math.abs(pp.x - mp.x), Math.abs(pp.y - mp.y)) <= 1
}

function eligibleReason(eng: Engine, e: Entity): Text | undefined {
  const w = eng.world
  const home = residence(eng)
  if (!home || !e.npc || e.npc.resident?.map !== home.map || e.place.on !== 'tile' || w.posOf(e)?.map !== home.map)
    return L('Not an active resident of this ground.', '不是当前领地的实际居民。')
  const bed = socialOf(eng).residenceBeds().find((b) => b.anchor === e.npc!.resident!.slot && b.who === e.id)
  if (!bed) return L('The resident no longer has an open bed here.', '居民已没有此处开放的床位。')
  const age = w.prop(e, 'age')
  if (typeof age !== 'number' || !Number.isFinite(age)) return L('Age is unknown; work orders require an adult aged 18 or older.', '年龄不明；岗位只委任年满 18 岁的居民。')
  if (age < 18) return L('Residents under 18 cannot take work orders.', '未满 18 岁的居民不能接领地岗位。')
  if (eng.isProtected(e)) return L('This resident is protected from work orders.', '该居民受保护，不能委任岗位。')
  if (w.hasTag(e, 'storybound') || w.hasTag(e, 'bound')) return L('This person is bound to another duty.', '此人仍受另一项职责约束。')
  if (w.prop(e, 'follow') !== undefined) return L('A follower cannot take a residence work order.', '跟随者不能接领地岗位。')
  if (!w.isAgent(e) || !!e.ai?.foes?.length || w.hasStatus({ e: e.id }, 'down') || w.hasStatus({ e: e.id }, 'out_cold') || w.num(e, 'hp', 1) <= 0)
    return L('This person cannot work now.', '此人目前无法工作。')
  return undefined
}

function isWorkerEligible(eng: Engine, e: Entity): boolean {
  return !eligibleReason(eng, e)
}

export function residentWorkEligibility(eng: Engine, e: Entity): { eligible: boolean; reason?: Text } {
  const reason = eligibleReason(eng, e)
  return { eligible: !reason, ...(reason && { reason }) }
}

function cropAt(eng: Engine, map: string, x: number, y: number, ripe = false): Entity | undefined {
  const w = eng.world
  const def = workDef(eng)
  const selector = ripe ? def?.ripe : def?.crop
  if (!selector) return undefined
  return w.placedAt(map, x, y).find((e) => e.place.on === 'tile' && e.place.map === map && e.place.x === x && e.place.y === y && !!w.view({ e: e.id }) && matchSelector(selector, w.view({ e: e.id })!))
}

function cellsValid(eng: Engine, cells: { x: number; y: number }[], requireCrop: boolean, previouslyAuthorized: { x: number; y: number }[] = []): boolean {
  const w = eng.world
  const home = residence(eng)
  const map = home && w.map(home.map)
  const old = new Set(previouslyAuthorized.map(({ x, y }) => `${x},${y}`))
  return !!map && cells.length > 0 && cells.length <= MAX_CELLS && cells.every(({ x, y }) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height && (!requireCrop || !!cropAt(eng, home!.map, x, y) || old.has(`${x},${y}`)))
}

function warehouse(eng: Engine, id: string): Entity | undefined {
  const w = eng.world
  const home = residence(eng)
  const def = workDef(eng)
  const box = w.get(id)
  const p = w.posOf(box)
  const view = box && w.view({ e: box.id })
  const cap = box && w.num(box, 'capacity', Number.NaN)
  if (!box || !p || !home || !def?.warehouse || !view || !matchSelector(def.warehouse, view) || box.place.on !== 'tile' || p.map !== home.map || typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) return undefined
  const relation = eng.society.relation(eng.society.ownerOf(box), w.player)
  if (relation === 'another') return undefined
  return box
}

function warehouseUsable(eng: Engine, box: Entity | undefined): box is Entity {
  return !!box && !box.frozenBy && !eng.world.hasTag(box, 'locked') && !eng.world.hasStatus({ e: box.id }, 'locked')
}

function directOrNestedIn(w: Engine['world'], id: Id, holder: Id): boolean {
  let e = w.get(id)
  const seen = new Set<Id>()
  while (e && (e.place.on === 'inside' || e.place.on === 'hand') && !seen.has(e.id)) {
    seen.add(e.id)
    if (e.place.holder === holder) return true
    e = w.get(e.place.holder)
  }
  return false
}

function workCargo(eng: Engine, worker: Entity): Entity[] {
  const w = eng.world
  return (worker.residentWork?.cargoIds ?? []).map((id) => w.get(id)).filter((e): e is Entity => !!e && directOrNestedIn(w, e.id, worker.id))
}

/** Counts real slots, warehouse contents, and cargo still in every order assigned to this same warehouse. */
function projectedSlots(eng: Engine, box: Entity, extra: { type: string; count: number }[] = []): number {
  const w = eng.world
  const keys: string[] = []
  for (const id of box.contents ?? []) {
    const item = w.get(id)
    if (item?.place.on === 'inside' && item.place.holder === box.id) keys.push(stackKey(item))
  }
  for (const employee of w.withProp('residentWorkMap', box.place.on === 'tile' ? box.place.map : '')) {
    const order = employee.residentWork
    if (!order || order.warehouse !== box.id) continue
    for (const item of workCargo(eng, employee)) if (!directOrNestedIn(w, item.id, box.id)) keys.push(stackKey(item))
  }
  for (const output of extra) for (let i = 0; i < output.count; i++) keys.push(stackKey({ type: output.type }))
  return slotsOf(keys)
}

function captureIds(e: Entity): Set<Id> {
  return new Set([...(e.held ? [e.held] : []), ...(e.contents ?? [])])
}

function itemsInCell(eng: Engine, map: string, x: number, y: number): Set<Id> {
  return new Set(eng.world.placedAt(map, x, y).filter((e) => e.place.on === 'tile').map((e) => e.id))
}

function queueWorker(eng: Engine, worker: Entity, what: string, params: Record<string, string | number> = {}): void {
  const eventParams: Record<string, string | number> = { what, ...params }
  if (what === 'resident-work-internal') {
    const rt = runtime(eng)
    const token = rt.nextToken++
    eventParams.residentWorkToken = token
    rt.internal.push({ actor: worker.id, action: String(params.action ?? ''), token, tick: eng.world.state.tick, params })
  }
  eng.queue({
    kind: 'impulse/notify', host: { e: worker.id },
    roles: { source: { e: worker.id }, actor: { e: worker.id } },
    params: eventParams, cause: worker.id, origin: 'world',
  })
}

function queueManager(eng: Engine, manager: Entity, player: Entity, raw: string): void {
  const command = parseCommand(raw)
  const worker = command && 'worker' in command ? eng.world.get(command.worker) : undefined
  if (!worker) return
  eng.queue({
    kind: 'impulse/notify', host: { e: worker.id },
    roles: { source: { e: manager.id }, actor: { e: player.id } },
    params: { what: 'resident-work-command', command: raw }, cause: player.id, origin: 'player',
  })
}

function queueClaim(eng: Engine, manager: Entity, player: Entity, animal: Entity): void {
  const rt = runtime(eng)
  const token = rt.nextToken++
  const map = residence(eng)?.map
  if (!map) return
  rt.claims.push({ actor: player.id, animal: animal.id, controller: manager.id, map, token, tick: eng.world.state.tick })
  eng.queue({
    kind: 'impulse/notify', host: { e: animal.id },
    roles: { source: { e: manager.id }, actor: { e: player.id } },
    params: { what: 'resident-work-claim', residentWorkClaimToken: token }, cause: player.id, origin: 'player',
  })
}

function logToPlayer(eng: Engine, text: Text): void {
  eng.world.fx.push({ t: 'log', text })
}

type ValidAssignment =
  | { kind: 'harvest'; worker: Entity; box: Entity; cells: { x: number; y: number }[] }
  | { kind: 'feed'; worker: Entity; box: Entity; animalIds: Id[] }

function validateAssignment(eng: Engine, manager: Entity, player: Entity, command: Extract<WorkCommand, { op: 'assign' }>): ValidAssignment | undefined {
  const worker = eng.world.get(command.worker)
  const box = typeof command.warehouse === 'string' ? warehouse(eng, command.warehouse) : undefined
  if (!worker || !warehouseUsable(eng, box) || !isWorkerEligible(eng, worker)) return undefined
  const pp = eng.world.posOf(player), wp = eng.world.posOf(worker)
  if (!pp || !wp || pp.map !== residence(eng)?.map || wp.map !== residence(eng)?.map || worker.place.on !== 'tile') return undefined
  if (command.kind === 'harvest') {
    const existing = worker.residentWork
    const retainableCells = existing?.kind === 'harvest' && existing.controller === manager.id && existing.map === residence(eng)?.map ? existing.cells : []
    if (!cellsValid(eng, command.cells, true, retainableCells)) return undefined
    return { kind: 'harvest', worker, box, cells: command.cells }
  }
  const def = workDef(eng)
  if (!def?.livestock || !def.unfed || !def.feed) return undefined
  const animals = command.animalIds.map((id) => eng.world.get(id))
  if (animals.some((animal) => {
    const p = animal && eng.world.posOf(animal)
    const view = animal && eng.world.view({ e: animal.id })
    const owner = animal && eng.society.relation(eng.society.ownerOf(animal), player)
    return !animal || animal.place.on !== 'tile' || p?.map !== residence(eng)?.map || !view || !matchSelector(def.livestock!, view) || (owner !== 'mine' && owner !== 'ours')
  })) return undefined
  return { kind: 'feed', worker, box, animalIds: [...command.animalIds] }
}

function clearOrder(host: Entity, fx: EffectRunner): void {
  const w = fx.eng.world
  host.residentWork = undefined
  w.setProp(host, 'residentWorkMap', undefined)
  runtime(fx.eng).routes.delete(host.id)
}

function updateOrder(host: Entity, w: Engine['world'], next: ResidentWorkOrder): void {
  host.residentWork = next
  w.setProp(host, 'residentWorkMap', next.map)
}

function localizedReason(reason: string): Text {
  const reasons: Record<string, Text> = {
    paused: L('Paused by the player.', '已由玩家暂停。'),
    'warehouse-missing': L('The selected warehouse is missing or unavailable.', '指定仓库已消失或不可用。'),
    'warehouse-locked': L('The selected warehouse is locked or frozen.', '指定仓库已上锁或暂不可用。'),
    'warehouse-closed': L('The worker could not open the warehouse.', '居民无法打开仓库。'),
    'worker-ineligible': L('This resident is no longer eligible; task cargo remains recoverable.', '该居民目前不符合岗位条件；岗位物资仍可取回。'),
    'warehouse-full': L('The selected warehouse has no room for this harvest.', '指定仓库已满，暂不能采收。'),
    'no-target': L('No authorized crop is ripe yet.', '授权田块中还没有成熟作物。'),
    'no-animal': L('No authorized, owned animal needs feed right now.', '当前没有已授权且仍需喂养的自有牲畜。'),
    'feed-unavailable': L('No eligible feed is available in the selected warehouse.', '指定仓库中没有可用饲料。'),
    'feed-return': L('The pending animal is no longer eligible; the same feed is being returned to its warehouse.', '指定牲畜已不可喂养；原饲料正在送回指定仓库。'),
    'feed-use-failed': L('The exact pending feed was not consumed; it remains tracked for recovery.', '指定饲料未能被消耗；仍已登记，可恢复取回。'),
    'work-kind-change': L('Return or drop the in-flight task item before changing work type or warehouse.', '更换岗位类型或仓库前，请先把在途物资送回或放下取回。'),
    'feed-target-change': L('Return the in-flight feed before removing its pending animal from this order.', '取消当前待喂牲畜授权前，请先将这份在途饲料送回仓库。'),
    'route-blocked': L('The route is blocked; clear a path or choose another field.', '道路受阻；请清出通路或改选田块。'),
    'harvest-failed': L('Harvest output differed from the expected hand-pick result. Check task cargo and the authorized plot before resuming.', '手工采收结果与预期不同；请检查在途物资和授权田块后再继续。'),
    'recovery': L('The order was revoked. Task cargo is ready to be put down for recovery.', '岗位已撤销，可放下任务物资供取回。'),
    'recovery-away': L('The worker is away from the residence. Task cargo can only be put down when the worker is back on this ground.', '居民已离开领地；须待其回到此处后才能放下岗位物资。'),
  }
  return reasons[reason] ?? L(reason, reason)
}

function setReason(eng: Engine, worker: Entity, reason?: string): void {
  const prior = worker.residentWork?.blockedReason
  const next = reason ? localizedReason(reason) : undefined
  const sameText = prior === next || (!!prior && !!next && typeof prior !== 'string' && typeof next !== 'string' && prior.en === next.en && prior.zh === next.zh)
  if (!worker.residentWork || sameText) return
  queueWorker(eng, worker, 'resident-work-internal', { action: 'reason', reason: reason ?? '' })
}

function descendantsForCargo(eng: Engine, host: Entity): Entity[] {
  const w = eng.world
  return (host.residentWork?.cargoIds ?? []).map((id) => w.get(id)).filter((item): item is Entity => !!item && directOrNestedIn(w, item.id, host.id))
}

/** Work primitive handler. Every persistent entity write is made in the host's own outcome. */
export function residentWorkEffect(fx: EffectRunner, eff: any, ev: GameEvent): void {
  const eng = fx.eng
  const w = eng.world
  const host = fx.hostEntity(ev)
  if (!host) return

  if (eff.op === 'residentWork/order') {
    const raw = ev.params?.choice
    const command = parseCommand(raw)
    const player = ev.roles.actor && w.get(ev.roles.actor.e)
    if (!command || !player || player.id !== w.state.player || !orderAuthority(eng, ev, host)) return
    if (command.op === 'claim') {
      if (ev.origin !== 'player' || ev.cause !== player.id) return
      const animal = w.get(command.animal)
      if (!animal || !claimableAnimal(eng, animal, player)) {
        logToPlayer(eng, L('That animal is no longer eligible to claim.', '这只牲畜目前不能认领。'))
        return
      }
      queueClaim(eng, host, player, animal)
      return
    }
    if (command.op === 'assign' && !validateAssignment(eng, host, player, command)) {
      logToPlayer(eng, L('That resident, field, or warehouse cannot be assigned now.', '该居民、田块或仓库目前不能用于此岗位。'))
      return
    }
    queueManager(eng, host, player, raw as string)
    return
  }

  if (eff.op !== 'residentWork/update') return
  const what = ev.params?.what
  if (what === 'resident-work-command') {
    const manager = sourceId(ev.roles.source) && w.get(sourceId(ev.roles.source)!)
    const command = parseCommand(ev.params?.command)
    const player = ev.roles.actor && w.get(ev.roles.actor.e)
    if (!command || !('worker' in command) || command.worker !== host.id || !player || player.id !== w.state.player || !manager || !commandAuthority(eng, ev, manager)) return
    const home = residence(eng)
    if (!home || !workDef(eng)) return
    const existing = host.residentWork
    if (command.op === 'assign') {
      const selected = validateAssignment(eng, manager, player, command)
      if (!selected) return
      if (selected.kind === 'harvest' && (!workDef(eng)?.yieldTypeProp || !workDef(eng)?.seedTypeProp || !workDef(eng)?.pickBonusProp)) return
      if (existing && ['revoked', 'recovery'].includes(existing.status)) {
        logToPlayer(eng, L('Recover the revoked order’s cargo before assigning another job.', '请先取回已撤销岗位的物资，再委派新岗位。'))
        return
      }
      const carried = descendantsForCargo(eng, host).map((item) => item.id)
      if (existing && carried.length && (existing.kind !== selected.kind || existing.warehouse !== selected.box.id)) {
        logToPlayer(eng, localizedReason('work-kind-change'))
        return
      }
      if (selected.kind === 'feed' && existing?.kind === 'feed' && existing.pendingAnimalId && carried.length && !selected.animalIds.includes(existing.pendingAnimalId)) {
        logToPlayer(eng, localizedReason('feed-target-change'))
        return
      }
      const cargoIds = existing?.kind === selected.kind ? [...(existing.cargoIds ?? [])] : []
      if (selected.kind === 'harvest') updateOrder(host, w, {
        kind: 'harvest', controller: manager.id, map: home.map, warehouse: selected.box.id,
        cells: selected.cells.map(({ x, y }) => ({ x, y })), status: 'working', cargoIds,
      })
      else updateOrder(host, w, {
        kind: 'feed', controller: manager.id, map: home.map, warehouse: selected.box.id,
        animalIds: [...selected.animalIds], pendingAnimalId: existing?.kind === 'feed' ? existing.pendingAnimalId : undefined,
        status: 'working', cargoIds,
      })
      runtime(eng).routes.delete(host.id)
      return
    }
    if (!existing || existing.controller !== manager.id || existing.map !== home.map || !host.residentWork) return
    if (command.op === 'pause') {
      updateOrder(host, w, { ...existing, status: 'paused', blockedReason: localizedReason('paused') })
      runtime(eng).routes.delete(host.id)
      return
    }
    if (command.op === 'resume') {
      const assignmentStillValid = existing.kind === 'harvest'
        ? !!workDef(eng)?.yieldTypeProp && !!workDef(eng)?.seedTypeProp && !!workDef(eng)?.pickBonusProp && cellsValid(eng, existing.cells, false)
        // Saved feed authorizations remain editable/recoverable even when a selected animal died or left the map.
        // runFeed revalidates each one before use and returns any in-flight item to this same warehouse.
        : !!workDef(eng)?.livestock && !!workDef(eng)?.unfed && !!workDef(eng)?.feed && existing.animalIds.length > 0 &&
          existing.animalIds.every((id) => typeof id === 'string' && !!id) && new Set(existing.animalIds).size === existing.animalIds.length
      if (!isWorkerEligible(eng, host) || !warehouseUsable(eng, warehouse(eng, existing.warehouse)) || !assignmentStillValid) {
        logToPlayer(eng, L('This worker or warehouse is no longer eligible; task cargo remains recoverable.', '居民或仓库目前不符合条件；岗位物资仍可取回。'))
        return
      }
      updateOrder(host, w, { ...existing, status: 'working', blockedReason: undefined })
      runtime(eng).routes.delete(host.id)
      return
    }
    if (command.op === 'revoke') {
      const carried = existing.cargoIds.filter((id) => {
        const item = w.get(id)
        return !!item && directOrNestedIn(w, item.id, host.id)
      })
      const retired = existing.cargoIds.length - carried.length
      if (carried.length) updateOrder(host, w, { ...existing, cargoIds: carried, status: 'recovery', blockedReason: localizedReason('recovery') })
      else clearOrder(host, fx)
      if (retired) logToPlayer(eng, L(`${retired} task item(s) are no longer in the resident’s custody and will not be moved.`, `${retired} 件岗位物资已不在居民保管中，不会被远程搬动。`))
      runtime(eng).routes.delete(host.id)
      return
    }
    if (command.op === 'drop') {
      const at = w.posOf(host)
      const pp = w.posOf(player)
      if (!existing.cargoIds.length) return
      if (!pp || pp.map !== home.map) {
        logToPlayer(eng, L('Return to the residence before recovering task cargo.', '请先回到领地，再取回岗位物资。'))
        return
      }
      if (!at || at.map !== home.map || host.place.on !== 'tile') {
        logToPlayer(eng, localizedReason('recovery-away'))
        return
      }
      let alreadyDropped = 0
      let noLongerHeld = 0
      for (const id of existing.cargoIds) {
        const item = w.get(id)
        if (!item || item.place.on === 'none') { noLongerHeld++; continue }
        if (item.place.on === 'tile' && item.place.map === at.map && item.place.x === at.x && item.place.y === at.y) { alreadyDropped++; continue }
        if (!directOrNestedIn(w, item.id, host.id)) { noLongerHeld++; continue }
        w.place(item, { on: 'tile', map: at.map, x: at.x, y: at.y, ...(at.z !== undefined && { z: at.z }) })
      }
      clearOrder(host, fx)
      runtime(eng).routes.delete(host.id)
      const now = w.posOf(host)
      if (now && existing.cargoIds.length - noLongerHeld - alreadyDropped > 0)
        logToPlayer(eng, L(`Task cargo was put down at ${now.map} (${now.x}, ${now.y}).`, `岗位物资已放在 ${now.map}（${now.x}, ${now.y}）。`))
      if (noLongerHeld) logToPlayer(eng, L(`${noLongerHeld} task item(s) were no longer in the resident’s custody and were left where they are.`, `${noLongerHeld} 件岗位物资已不在居民保管中，留在原处。`))
      return
    }
    return
  }

  if (what === 'resident-work-claim') {
    const token = ev.params?.residentWorkClaimToken
    const rt = runtime(eng)
    const permitIndex = rt.claims.findIndex((permit) => permit.animal === host.id && permit.token === token && permit.tick === w.state.tick)
    if (permitIndex < 0) return
    const [permit] = rt.claims.splice(permitIndex, 1)
    const manager = sourceId(ev.roles.source) && w.get(sourceId(ev.roles.source)!)
    const player = ev.roles.actor && w.get(ev.roles.actor.e)
    const home = residence(eng)
    if (!permit || !manager || !player || player.id !== w.state.player || permit.actor !== player.id || permit.controller !== manager.id ||
      ev.origin !== 'player' || ev.cause !== player.id || !home || permit.map !== home.map || !commandAuthority(eng, ev, manager) ||
      !claimableAnimal(eng, host, player)) return
    w.setProp(host, 'owner', player.id)
    logToPlayer(eng, L('This animal now belongs to you.', '这只牲畜现在归你所有。'))
    return
  }

  if (what !== 'resident-work-internal' || sourceId(ev.roles.source) !== host.id || sourceId(ev.roles.actor) !== host.id) return
  const action = ev.params?.action
  const token = ev.params?.residentWorkToken
  const rt = runtime(eng)
  const permitIndex = rt.internal.findIndex((permit) => permit.actor === host.id && permit.action === action && permit.token === token && permit.tick === w.state.tick && Object.entries(permit.params).every(([key, value]) => ev.params?.[key] === value))
  if (permitIndex < 0) return
  rt.internal.splice(permitIndex, 1)
  const order = host.residentWork
  if (!order) return
  if (action === 'reason') {
    const code = typeof ev.params?.reason === 'string' ? ev.params.reason : ''
    host.residentWork = { ...order, ...(code === 'harvest-failed' && { status: 'paused' }), blockedReason: code ? localizedReason(code) : undefined }
    return
  }
  if (action === 'prepare') {
    const cropId = typeof ev.params?.crop === 'string' ? ev.params.crop : ''
    const crop = w.get(cropId)
    const p = crop && w.posOf(crop)
    if (order.kind !== 'harvest' || order.status !== 'working' || !crop || !p || p.map !== order.map || !order.cells.some((c) => c.x === p.x && c.y === p.y) || !isWorkerEligible(eng, host)) return
    w.addTag(host, HARVEST_TAG)
    return
  }
  if (action === 'finish') {
    w.removeTag(host, HARVEST_TAG)
    return
  }
  if (action === 'prepareFeed') {
    const feedId = typeof ev.params?.feed === 'string' ? ev.params.feed : ''
    const animalId = typeof ev.params?.animal === 'string' ? ev.params.animal : ''
    const box = order.kind === 'feed' ? warehouse(eng, order.warehouse) : undefined
    const feed = w.get(feedId)
    const player = w.player
    const def = workDef(eng)
    const view = feed && w.view({ e: feed.id })
    if (order.kind !== 'feed' || order.status !== 'working' || order.cargoIds.length || !box || !warehouseUsable(eng, box) || !feed || feed.place.on !== 'inside' || feed.place.holder !== box.id || feed.frozenBy || !def?.feed || !view || !matchSelector(def.feed, view) || eng.society.relation(eng.society.ownerOf(feed), player) === 'another' || !authorizedAnimal(eng, order, animalId, true)) return
    updateOrder(host, w, { ...order, pendingAnimalId: animalId, blockedReason: undefined })
    return
  }
  if (action === 'recordFeed') {
    const feedId = typeof ev.params?.feed === 'string' ? ev.params.feed : ''
    const animalId = typeof ev.params?.animal === 'string' ? ev.params.animal : ''
    const feed = w.get(feedId)
    const def = workDef(eng)
    const view = feed && w.view({ e: feed.id })
    if (order.kind !== 'feed' || order.status !== 'working' || order.pendingAnimalId !== animalId || !feed || !directOrNestedIn(w, feed.id, host.id) || !def?.feed || !view || !matchSelector(def.feed, view) || order.cargoIds.some((id) => id !== feedId)) return
    const player = w.player
    w.setProp(feed, 'owner', player.id)
    updateOrder(host, w, { ...order, cargoIds: [feed.id], blockedReason: undefined })
    return
  }
  if (action === 'consumeFeed') {
    const feedId = typeof ev.params?.feed === 'string' ? ev.params.feed : ''
    const animalId = typeof ev.params?.animal === 'string' ? ev.params.animal : ''
    if (order.kind !== 'feed' || order.pendingAnimalId !== animalId || !order.cargoIds.includes(feedId)) return
    updateOrder(host, w, { ...order, cargoIds: order.cargoIds.filter((id) => id !== feedId), pendingAnimalId: undefined, blockedReason: undefined })
    return
  }
  if (action === 'clearFeedTarget') {
    const animalId = typeof ev.params?.animal === 'string' ? ev.params.animal : ''
    if (order.kind === 'feed' && order.pendingAnimalId === animalId && !order.cargoIds.some((id) => {
      const item = w.get(id)
      return !!item && directOrNestedIn(w, item.id, host.id)
    })) updateOrder(host, w, { ...order, pendingAnimalId: undefined })
    return
  }
  if (action === 'record') {
    let ids: unknown
    try { ids = JSON.parse(String(ev.params?.cargo ?? '')) } catch { return }
    if (!Array.isArray(ids) || ids.length > 128 || ids.some((id) => typeof id !== 'string')) return
    const added: Id[] = []
    for (const id of ids as string[]) {
      const item = w.get(id)
      if (!item || !directOrNestedIn(w, item.id, host.id)) continue
      if (!added.includes(id) && !order.cargoIds.includes(id)) added.push(id)
    }
    if (!added.length) return
    updateOrder(host, w, { ...order, cargoIds: [...order.cargoIds, ...added], blockedReason: undefined })
    // The worker's writer reaches only its own carried items. Record task ownership here so the cargo
    // remains the player's property after storage or recovery, without a cross-host item write.
    for (const id of added) {
      const item = w.get(id)
      if (item && directOrNestedIn(w, item.id, host.id)) w.setProp(item, 'owner', w.state.player)
    }
    return
  }
  if (action === 'deposit') {
    const boxId = typeof ev.params?.warehouse === 'string' ? ev.params.warehouse : ''
    const box = warehouse(eng, boxId)
    const workerPos = w.posOf(host), boxPos = box && w.posOf(box)
    if (!box || !warehouseUsable(eng, box) || boxId !== order.warehouse || !workerPos || !boxPos || workerPos.map !== order.map || boxPos.map !== order.map ||
      Math.max(Math.abs(workerPos.x - boxPos.x), Math.abs(workerPos.y - boxPos.y)) > 1 || !w.hasStatus({ e: box.id }, 'open') ||
      projectedSlots(eng, box) > w.num(box, 'capacity', 0)) {
      host.residentWork = { ...order, blockedReason: localizedReason(box ? 'warehouse-full' : 'warehouse-missing') }
      return
    }
    const cargo = descendantsForCargo(eng, host)
    if (cargo.length !== order.cargoIds.length) {
      host.residentWork = { ...order, blockedReason: L('Some task cargo is no longer in the resident’s custody.', '部分岗位物资已不在居民保管中。') }
      return
    }
    for (const item of cargo) w.place(item, { on: 'inside', holder: box.id })
    host.residentWork = { ...order, cargoIds: [], ...(order.kind === 'feed' && { pendingAnimalId: undefined }), blockedReason: undefined }
    w.setProp(host, 'residentWorkMap', order.map)
    return
  }
}

function reserve(eng: Engine, actor: Entity, target: Entity, run: () => void): void {
  const list = runtime(eng).permits
  const order = actor.residentWork
  if (!order) return
  list.push({ actor: actor.id, target: target.id, controller: order.controller, tick: eng.world.state.tick })
  try { run() } finally { list.splice(list.findIndex((p) => p.actor === actor.id && p.target === target.id && p.tick === eng.world.state.tick), 1) }
}

/** A witnessed theft is suppressed only during the synchronous, prevalidated take of this exact job target. */
export function authorizedResidentWorkTake(eng: Engine, ev: GameEvent): boolean {
  if (ev.params?.act !== 'take') return false
  const actorId = sourceId(ev.roles.actor)
  const actor = actorId ? eng.world.get(actorId) : undefined
  const target = sourceId(ev.roles.target)
  if (!actor?.residentWork || !target) return false
  return runtime(eng).permits.some((permit) => permit.actor === actor.id && permit.target === target && permit.controller === actor.residentWork!.controller && permit.tick === eng.world.state.tick)
}

/** A Stockman's area-feed exception exists only during the resident order's exact, prevalidated act/use. */
export function residentWorkFeedCondition(_c: unknown, roles: Roles, world: World, ev?: GameEvent): boolean {
  if (!ev || ev.kind !== 'act/use') return false
  const actor = ev.roles.actor?.e
  const feed = ev.roles.instrument?.e
  const target = ev.roles.target?.e
  const host = 'e' in ev.host ? ev.host.e : undefined
  if (!actor || !feed || !target || feed !== host || roles.actor?.ref.e !== actor) return false
  const rt = world.ext.get(EXT) as Runtime | undefined
  const permit = rt?.feedPermits.find((p) => p.actor === actor && p.feed === feed && p.target === target && p.tick === world.state.tick)
  if (!permit) return false
  const worker = world.get(actor)
  const item = world.get(feed)
  const animal = world.get(target)
  const player = world.get(world.state.player)
  const order = worker?.residentWork
  const home = world.onto.data.social?.residence
  const def = home?.work
  const itemView = item && world.view({ e: item.id })
  const animalView = animal && world.view({ e: animal.id })
  const playerPos = world.posOf(player)
  const workerPos = world.posOf(worker)
  const animalPos = world.posOf(animal)
  const hour = hoursAt(world.state.tick) % 24
  return !!worker && !!item && !!animal && !!playerPos && !!workerPos && !!animalPos && !!home && !!def?.feed && !!def.livestock && !!def.unfed &&
    order?.kind === 'feed' && order.status === 'working' && order.controller === permit.controller && order.warehouse === permit.warehouse &&
    order.map === permit.map && order.map === home.map && permit.activeMap === permit.map && playerPos.map === permit.map &&
    workerPos.map === permit.map && animalPos.map === permit.map && hour >= 7 && hour < 21 &&
    order.pendingAnimalId === target && order.animalIds.includes(target) && order.cargoIds.includes(feed) &&
    !!itemView && matchSelector(def.feed, itemView) && directOrNestedIn(world, feed, actor) &&
    !!animalView && matchSelector(def.livestock, animalView) && matchSelector(def.unfed, animalView)
}

function expectedOutput(eng: Engine, worker: Entity, crop: Entity): { yieldType: string; seedType: string; yieldCount: number; seedCount: number } | undefined {
  const def = workDef(eng)
  if (!def?.yieldTypeProp || !def.seedTypeProp || !def.pickBonusProp) return undefined
  const yieldType = eng.world.prop(crop, def.yieldTypeProp)
  const seedType = eng.world.prop(crop, def.seedTypeProp)
  if (typeof yieldType !== 'string' || typeof seedType !== 'string' || !eng.world.onto.hasType(yieldType) || !eng.world.onto.hasType(seedType)) return undefined
  const base = def.yieldBase ?? 1
  // The original PICK rule reads the actor's raw pick prop (not equipment or status-derived stats).
  const bonus = eng.world.num(worker, def.pickBonusProp)
  const yieldCount = Math.max(0, Math.floor(base + bonus))
  const seedCount = def.seedCount ?? 1
  if (!Number.isFinite(yieldCount) || !Number.isSafeInteger(seedCount) || seedCount < 0 || yieldCount + seedCount > (eng.world.onto.data.params?.spawnMax ?? 64)) return undefined
  return { yieldType, seedType, yieldCount, seedCount }
}

function availableCapacity(eng: Engine, worker: Entity, box: Entity, crop: Entity): boolean {
  const output = expectedOutput(eng, worker, crop)
  if (!output) return false
  const planned = projectedSlots(eng, box, [
    { type: output.yieldType, count: output.yieldCount },
    { type: output.seedType, count: output.seedCount },
  ])
  return planned <= eng.world.num(box, 'capacity', 0)
}

function routeKey(target: string, pos: Pos, z: number): string {
  return `${target}|${pos.map}:${pos.x}:${pos.y}:${z}`
}

function routeAdjacent(eng: Engine, e: Entity, target: Pos, targetId: string): boolean {
  const w = eng.world
  const at = w.posOf(e)
  if (!at || e.place.on !== 'tile') return true
  if (Math.max(Math.abs(at.x - target.x), Math.abs(at.y - target.y)) <= 1) return true
  const map = w.map(at.map)
  if (!map) return true
  const key = routeKey(targetId, target, at.z ?? 0)
  const rt = runtime(eng)
  let route = rt.routes.get(e.id)
  if (route?.key !== key) route = undefined
  if (route?.path?.length) {
    const [nx, ny] = route.path[0]
    if (Math.abs(nx - at.x) + Math.abs(ny - at.y) !== 1) {
      route.path = undefined
      route.retryAt = w.state.tick
      rt.routes.set(e.id, route)
      return routeAdjacent(eng, e, target, targetId)
    }
    const dir = nx > at.x ? 'right' : nx < at.x ? 'left' : ny > at.y ? 'down' : 'up'
    if (eng.step(e, dir)) {
      setReason(eng, e)
      route.path.shift()
      route.failures = 0
    } else {
      route.path = undefined
      route.failures++
      route.retryAt = w.state.tick + ROUTE_RETRY_TICKS
    }
    eng.setCooldown(e.id, TICK_STEP)
    if (route.failures >= ROUTE_RETRIES) {
      setReason(eng, e, 'route-blocked')
    }
    rt.routes.set(e.id, route)
    return true
  }
  if (route && w.state.tick < route.retryAt) return true
  const candidates = ([[target.x + 1, target.y], [target.x - 1, target.y], [target.x, target.y + 1], [target.x, target.y - 1]] as [number, number][])
    .filter(([x, y]) => w.inBounds(at.map, x, y) && w.walkable(at.map, x, y, e.id, false, at.z ?? 0))
    .sort((a, b) => Math.max(Math.abs(a[0] - at.x), Math.abs(a[1] - at.y)) - Math.max(Math.abs(b[0] - at.x), Math.abs(b[1] - at.y)))
  let path: [number, number][] | undefined
  for (const [tx, ty] of candidates) {
    if (tx === at.x && ty === at.y) return true
    path = astar(map.width, map.height,
      (x, y) => w.walkable(at.map, x, y, e.id, false, at.z ?? 0),
      at.x, at.y, tx, ty, Math.min(6000, map.width * map.height + 1),
      (ax, ay, bx, by) => w.safeStep(e, at.map, ax, ay, bx, by),
    )
    if (path) break
  }
  if (!path) {
    const failures = (route?.failures ?? 0) + 1
    const next: Route = { key, failures, retryAt: w.state.tick + ROUTE_RETRY_TICKS }
    rt.routes.set(e.id, next)
    if (failures >= ROUTE_RETRIES) setReason(eng, e, 'route-blocked')
    return true
  }
  setReason(eng, e)
  route = { key, path, failures: route?.failures ?? 0, retryAt: w.state.tick + ROUTE_RETRY_TICKS }
  rt.routes.set(e.id, route)
  return routeAdjacent(eng, e, target, targetId)
}

function workWarehouse(eng: Engine, worker: Entity, order: ResidentWorkOrder): Entity | undefined {
  const box = warehouse(eng, order.warehouse)
  if (!box) {
    setReason(eng, worker, 'warehouse-missing')
    return undefined
  }
  if (!warehouseUsable(eng, box)) {
    setReason(eng, worker, 'warehouse-locked')
    return undefined
  }
  return box
}

function openWarehouse(eng: Engine, worker: Entity, box: Entity): boolean {
  const w = eng.world
  if (w.hasStatus({ e: box.id }, 'open')) return true
  if (!warehouseUsable(eng, box)) return false
  const p = w.posOf(worker), b = w.posOf(box)
  if (!p || !b) return false
  if (Math.max(Math.abs(p.x - b.x), Math.abs(p.y - b.y)) > 1) {
    routeAdjacent(eng, worker, b, `warehouse:${box.id}`)
    return false
  }
  eng.act('hands', worker.id, { e: box.id }, { instrument: null })
  eng.setCooldown(worker.id, TICK_STEP)
  return w.hasStatus({ e: box.id }, 'open')
}

function deposit(eng: Engine, worker: Entity, order: ResidentWorkOrder, box: Entity): void {
  const w = eng.world
  const p = w.posOf(worker), b = w.posOf(box)
  if (!p || !b) return
  if (Math.max(Math.abs(p.x - b.x), Math.abs(p.y - b.y)) > 1) {
    routeAdjacent(eng, worker, b, `warehouse:${box.id}`)
    return
  }
  if (!w.hasStatus({ e: box.id }, 'open')) {
    if (!openWarehouse(eng, worker, box)) setReason(eng, worker, 'warehouse-closed')
    return
  }
  if (projectedSlots(eng, box) > w.num(box, 'capacity', 0)) {
    setReason(eng, worker, 'warehouse-full')
    return
  }
  queueWorker(eng, worker, 'resident-work-internal', { action: 'deposit', warehouse: box.id })
  if (worker.residentWork?.cargoIds.length === 0) setReason(eng, worker)
  else setReason(eng, worker, 'warehouse-full')
  eng.setCooldown(worker.id, TICK_STEP * 2)
  void order
}

function authorizedRipe(eng: Engine, order: Extract<ResidentWorkOrder, { kind: 'harvest' }>): Entity[] {
  const crops: Entity[] = []
  for (const cell of order.cells) {
    const crop = cropAt(eng, order.map, cell.x, cell.y, true)
    if (crop && !crops.some((x) => x.id === crop.id)) crops.push(crop)
  }
  return crops.sort((a, b) => {
    const pa = eng.world.posOf(a)!, pb = eng.world.posOf(b)!
    return pa.y - pb.y || pa.x - pb.x || a.id.localeCompare(b.id)
  })
}

function authorizedAnimal(eng: Engine, order: ResidentWorkOrder, id: Id, needsFeed: boolean): Entity | undefined {
  if (order.kind !== 'feed' || !order.animalIds.includes(id)) return undefined
  const w = eng.world
  const animal = w.get(id)
  const at = animal && w.posOf(animal)
  const view = animal && w.view({ e: animal.id })
  const def = workDef(eng)
  const relation = animal && eng.society.relation(eng.society.ownerOf(animal), w.player)
  if (!animal || animal.place.on !== 'tile' || !at || at.map !== order.map || !view || !def?.livestock || !matchSelector(def.livestock, view) ||
    (needsFeed && (!def.unfed || !matchSelector(def.unfed, view))) || (relation !== 'mine' && relation !== 'ours')) return undefined
  return animal
}

function eligibleAnimals(eng: Engine, order: Extract<ResidentWorkOrder, { kind: 'feed' }>): Entity[] {
  return order.animalIds.map((id) => authorizedAnimal(eng, order, id, true)).filter((e): e is Entity => !!e)
}

function chooseAnimal(eng: Engine, worker: Entity, animals: Entity[]): Entity | undefined {
  const p = eng.world.posOf(worker)
  if (!p) return undefined
  return [...animals].sort((a, b) => {
    const pa = eng.world.posOf(a)!, pb = eng.world.posOf(b)!
    return Math.max(Math.abs(pa.x - p.x), Math.abs(pa.y - p.y)) - Math.max(Math.abs(pb.x - p.x), Math.abs(pb.y - p.y)) || a.id.localeCompare(b.id)
  })[0]
}

function feedInWarehouse(eng: Engine, box: Entity): Entity[] {
  const w = eng.world
  const selector = workDef(eng)?.feed
  if (!selector) return []
  return (box.contents ?? []).map((id) => w.get(id)).filter((item): item is Entity => {
    if (!item || item.place.on !== 'inside' || item.place.holder !== box.id || item.frozenBy) return false
    const view = w.view({ e: item.id })
    return !!view && matchSelector(selector, view) && eng.society.relation(eng.society.ownerOf(item), w.player) !== 'another'
  }).sort((a, b) => a.id.localeCompare(b.id))
}

function pickFeed(eng: Engine, worker: Entity, order: Extract<ResidentWorkOrder, { kind: 'feed' }>, box: Entity, animal: Entity): boolean {
  const feed = feedInWarehouse(eng, box)[0]
  if (!feed) {
    setReason(eng, worker, 'feed-unavailable')
    return false
  }
  queueWorker(eng, worker, 'resident-work-internal', { action: 'prepareFeed', feed: feed.id, animal: animal.id })
  if (worker.residentWork?.kind !== 'feed' || worker.residentWork.pendingAnimalId !== animal.id) return false
  reserve(eng, worker, feed, () => eng.act('take', worker.id, { e: feed.id }, { instrument: null, params: { into: 'contents' } }))
  if (directOrNestedIn(eng.world, feed.id, worker.id)) {
    queueWorker(eng, worker, 'resident-work-internal', { action: 'recordFeed', feed: feed.id, animal: animal.id })
    if (worker.residentWork?.kind === 'feed' && worker.residentWork.cargoIds.includes(feed.id)) {
      setReason(eng, worker)
      eng.setCooldown(worker.id, TICK_STEP * 2)
      return true
    }
  }
  queueWorker(eng, worker, 'resident-work-internal', { action: 'clearFeedTarget', animal: animal.id })
  setReason(eng, worker, 'feed-use-failed')
  return false
}

function deliverFeed(eng: Engine, worker: Entity, order: Extract<ResidentWorkOrder, { kind: 'feed' }>, box: Entity, animal: Entity, feed: Entity): boolean {
  const w = eng.world
  const animalPos = w.posOf(animal)
  const view = feed && w.view({ e: feed.id })
  const def = workDef(eng)
  if (!animalPos || !view || !def?.feed || !matchSelector(def.feed, view) || !directOrNestedIn(w, feed.id, worker.id)) {
    setReason(eng, worker, 'feed-use-failed')
    return false
  }
  const at = w.posOf(worker)
  if (!at || Math.max(Math.abs(at.x - animalPos.x), Math.abs(at.y - animalPos.y)) > 1) {
    routeAdjacent(eng, worker, animalPos, `animal:${animal.id}`)
    return true
  }
  if (!eng.ready(worker.id) || eng.busy(worker)) return true
  const permit: FeedPermit = { actor: worker.id, feed: feed.id, target: animal.id, controller: order.controller, warehouse: box.id, map: order.map, activeMap: eng.activeMap, tick: w.state.tick }
  runtime(eng).feedPermits.push(permit)
  try {
    eng.act('use', worker.id, { e: animal.id }, { instrument: { e: feed.id } })
  } finally {
    const permits = runtime(eng).feedPermits
    const index = permits.indexOf(permit)
    if (index >= 0) permits.splice(index, 1)
  }
  const used = (!w.get(feed.id) || w.get(feed.id)?.place.on === 'none') && w.hasStatus({ e: animal.id }, 'fed')
  if (used) queueWorker(eng, worker, 'resident-work-internal', { action: 'consumeFeed', feed: feed.id, animal: animal.id })
  else if (w.hasStatus({ e: animal.id }, 'fed')) {
    setReason(eng, worker, 'feed-return')
    deposit(eng, worker, worker.residentWork as Extract<ResidentWorkOrder, { kind: 'feed' }>, box)
  } else setReason(eng, worker, 'feed-use-failed')
  eng.setCooldown(worker.id, TICK_STEP * 2)
  return true
}

function runFeed(eng: Engine, worker: Entity, order: Extract<ResidentWorkOrder, { kind: 'feed' }>, box: Entity): boolean {
  const w = eng.world
  const cargo = workCargo(eng, worker)
  if (order.cargoIds.length) {
    if (cargo.length !== 1 || order.cargoIds.length !== 1) {
      setReason(eng, worker, 'feed-use-failed')
      return false
    }
    const feed = cargo[0]!
    const animal = order.pendingAnimalId ? authorizedAnimal(eng, order, order.pendingAnimalId, true) : undefined
    if (!animal) {
      setReason(eng, worker, 'feed-return')
      deposit(eng, worker, order, box)
      return true
    }
    return deliverFeed(eng, worker, order, box, animal, feed)
  }
  const animal = chooseAnimal(eng, worker, eligibleAnimals(eng, order))
  if (!animal) {
    setReason(eng, worker, 'no-animal')
    return false
  }
  const at = w.posOf(worker)!, bp = w.posOf(box)!
  if (Math.max(Math.abs(at.x - bp.x), Math.abs(at.y - bp.y)) > 1) {
    routeAdjacent(eng, worker, bp, `warehouse:${box.id}`)
    return true
  }
  if (!openWarehouse(eng, worker, box)) {
    setReason(eng, worker, 'warehouse-closed')
    return false
  }
  return pickFeed(eng, worker, order, box, animal)
}

function pick(eng: Engine, worker: Entity, order: ResidentWorkOrder, box: Entity, crop: Entity): boolean {
  const w = eng.world
  const p = w.posOf(worker), c = w.posOf(crop)
  const expected = expectedOutput(eng, worker, crop)
  if (!p || !c || !expected || !availableCapacity(eng, worker, box, crop)) {
    setReason(eng, worker, expected ? 'warehouse-full' : 'harvest-failed')
    return false
  }
  const beforeBag = captureIds(worker)
  const beforeCell = itemsInCell(eng, c.map, c.x, c.y)
  queueWorker(eng, worker, 'resident-work-internal', { action: 'prepare', crop: crop.id })
  if (!worker.tags?.includes(HARVEST_TAG)) {
    setReason(eng, worker, 'harvest-failed')
    return false
  }
  try {
    reserve(eng, worker, crop, () => eng.act('hands', worker.id, { e: crop.id }, { instrument: null }))
  } finally {
    queueWorker(eng, worker, 'resident-work-internal', { action: 'finish' })
  }
  const afterPickBag = captureIds(worker)
  const produce = [...afterPickBag].filter((id) => !beforeBag.has(id) && w.get(id)?.place.on !== 'none')
  const expectedProduce = produce.filter((id) => w.get(id)?.type === expected.yieldType)
  const newSeeds = [...itemsInCell(eng, c.map, c.x, c.y)].filter((id) => !beforeCell.has(id) && w.get(id)?.type === expected.seedType)
  for (const id of newSeeds) reserve(eng, worker, w.get(id)!, () => eng.act('take', worker.id, { e: id }, { instrument: null, params: { into: 'contents' } }))
  const afterBag = captureIds(worker)
  const cargo = [...afterBag].filter((id) => !beforeBag.has(id) && w.get(id)?.place.on !== 'none')
  const expectedSeeds = cargo.filter((id) => w.get(id)?.type === expected.seedType)
  // Record every actual new item before checking the prediction. If a content rule changed or an action
  // was interrupted, the real yield remains owned and recoverable instead of becoming untracked cargo.
  if (cargo.length) queueWorker(eng, worker, 'resident-work-internal', { action: 'record', cargo: JSON.stringify(cargo) })
  if (expectedProduce.length !== expected.yieldCount || expectedSeeds.length !== newSeeds.length || cargo.length !== expected.yieldCount + expected.seedCount || newSeeds.length !== expected.seedCount) {
    setReason(eng, worker, 'harvest-failed')
    return false
  }
  if (worker.residentWork?.cargoIds.length) setReason(eng, worker)
  eng.setCooldown(worker.id, TICK_STEP * 2)
  return true
}

function chooseCrop(eng: Engine, worker: Entity, crops: Entity[]): Entity | undefined {
  const p = eng.world.posOf(worker)
  if (!p) return undefined
  return [...crops].sort((a, b) => {
    const pa = eng.world.posOf(a)!, pb = eng.world.posOf(b)!
    return Math.max(Math.abs(pa.x - p.x), Math.abs(pa.y - p.y)) - Math.max(Math.abs(pb.x - p.x), Math.abs(pb.y - p.y)) || a.id.localeCompare(b.id)
  })[0]
}

function runWork(eng: Engine, worker: Entity, _scene: Scene): boolean {
  const w = eng.world
  const order = worker.residentWork
  const home = residence(eng)
  if (!order || order.status !== 'working' || !home || order.map !== home.map) return false
  const playerPos = w.posOf(w.player), at = w.posOf(worker)
  if (!playerPos || playerPos.map !== order.map || !at || at.map !== order.map || worker.place.on !== 'tile') return false
  if (eligibleReason(eng, worker)) {
    setReason(eng, worker, 'worker-ineligible')
    return false
  }
  if (eng.asleep(worker) || hoursAt(w.state.tick) % 24 < 7 || hoursAt(w.state.tick) % 24 >= 21) return false
  const box = workWarehouse(eng, worker, order)
  if (!box) return false

  if (order.kind === 'feed') return runFeed(eng, worker, order, box)

  if (order.cargoIds.length) {
    deposit(eng, worker, order, box)
    return true
  }
  const crops = authorizedRipe(eng, order)
  const crop = chooseCrop(eng, worker, crops)
  if (!crop) {
    setReason(eng, worker, 'no-target')
    return false
  }
  const pos = w.posOf(crop)
  if (!pos || !cropAt(eng, order.map, pos.x, pos.y, true) || !order.cells.some((c) => c.x === pos.x && c.y === pos.y)) return false
  if (!availableCapacity(eng, worker, box, crop)) {
    setReason(eng, worker, 'warehouse-full')
    return false
  }
  if (Math.max(Math.abs(at.x - pos.x), Math.abs(at.y - pos.y)) > 1) {
    routeAdjacent(eng, worker, pos, `crop:${crop.id}`)
    return true
  }
  setReason(eng, worker)
  if (!eng.ready(worker.id) || eng.busy(worker)) return true
  const ok = pick(eng, worker, order, box, crop)
  if (!ok) return true
  return true
}

export const residentWorkGoal = {
  paced: true,
  run: (eng: Engine, e: Entity, sc: Scene) => runWork(eng, e, sc),
}

/** Authored on each worker/retained body by resident-work/update. */
export function resetResidentWorkRuntime(eng: Engine): void {
  eng.world.ext.delete(EXT)
  for (const e of Object.values(eng.world.state.entities)) if (e.tags?.includes(HARVEST_TAG)) eng.world.removeTag(e, HARVEST_TAG)
}

export function residentWorkView(eng: Engine, def: ResidenceWorkDef): { targets: { id: Id; x: number; y: number; name: Text; ripe: boolean }[]; animals: NonNullable<import('@openworld/engine').ResidenceWorkView['livestock']>['animals'] } {
  const w = eng.world
  const map = residence(eng)?.map
  if (!map) return { targets: [], animals: [] }
  const onGround = w.entitiesOnMap(map).filter((e) => e.place.on === 'tile').map((entity) => ({ entity, view: w.view({ e: entity.id }) }))
  const targets = onGround
    .filter(({ view }) => !!def.crop && !!view && matchSelector(def.crop, view))
    .sort((a, b) => (a.entity.place.on === 'tile' && b.entity.place.on === 'tile' ? a.entity.place.y - b.entity.place.y || a.entity.place.x - b.entity.place.x : a.entity.id.localeCompare(b.entity.id)))
    .map(({ entity, view }) => ({
      id: entity.id,
      x: entity.place.on === 'tile' ? entity.place.x : 0,
      y: entity.place.on === 'tile' ? entity.place.y : 0,
      name: entity.name ?? w.onto.resolve(entity.type).name ?? entity.type,
      ripe: !!def.ripe && !!view && matchSelector(def.ripe, view),
    }))
  const animals = onGround.flatMap(({ entity, view }) => {
    if (entity.place.on !== 'tile' || !def.livestock || !view || !matchSelector(def.livestock, view)) return []
    const owner = eng.society.relation(eng.society.ownerOf(entity), w.player)
    return [{
      id: entity.id,
      name: entity.name ?? w.onto.resolve(entity.type).name ?? entity.type,
      type: entity.type,
      x: entity.place.x,
      y: entity.place.y,
      fed: w.hasStatus({ e: entity.id }, 'fed'),
      owner,
      selectable: (owner === 'mine' || owner === 'ours') && !!def.unfed && !!def.feed,
      claimable: owner === 'nobody' && claimableAnimal(eng, entity, w.player, view),
    }]
  }).sort((a, b) => a.id.localeCompare(b.id))
  return { targets, animals }
}

export function residentWorkOrderView(eng: Engine, e: Entity): NonNullable<import('@openworld/engine').ResidenceResidentView['order']> | undefined {
  const order = e.residentWork
  if (!order) return undefined
  let blockedReason = order.blockedReason
  if (order.status === 'working') {
    const home = residence(eng)
    const playerMap = eng.world.posOf(eng.world.player)?.map
    const workerMap = eng.world.posOf(e)?.map
    const hour = hoursAt(eng.world.state.tick) % 24
    if (!home || eng.activeMap !== order.map || playerMap !== order.map || workerMap !== order.map) blockedReason = order.cargoIds.length
      ? L('Work pauses while you or the resident is away. Task cargo stays with the resident and can only be recovered when they are back on this ground.', '你或居民离开领地期间岗位暂停。物资仍由居民携带，须待其回到此处后才能取回。')
      : L('Work pauses while you are away from the residence.', '离开领地期间岗位暂停。')
    else if (hour < 7 || hour >= 21 || eng.asleep(e)) blockedReason = L('The resident is resting; work resumes during the day.', '居民正在休息，白天会继续工作。')
    else if (eligibleReason(eng, e)) blockedReason = eligibleReason(eng, e)
    else if (!warehouse(eng, order.warehouse)) blockedReason = L('The selected warehouse is missing or unavailable.', '指定仓库已消失或不可用。')
    else if (!warehouseUsable(eng, warehouse(eng, order.warehouse))) blockedReason = localizedReason('warehouse-locked')
  }
  return {
    kind: order.kind,
    status: order.status,
    warehouse: order.warehouse,
    cells: order.kind === 'harvest' ? order.cells.map((c) => ({ ...c })) : [],
    animalIds: order.kind === 'feed' ? [...order.animalIds] : [],
    ...(order.kind === 'feed' && order.pendingAnimalId && { pendingAnimalId: order.pendingAnimalId }),
    cargo: order.cargoIds.flatMap((id) => {
      const item = wItemInfo(eng, id)
      return item ? [item] : []
    }),
    ...(blockedReason && { blockedReason }),
  }
}

function wItemInfo(eng: Engine, id: Id) {
  return itemInfo(eng, id)
}
