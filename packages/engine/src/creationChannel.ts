// Bounded elemental actions use existing strike/element reactions and actor-owned costs.
import type { Engine } from './engine.ts'
import type { Effect, Entity, PropValue, Ref } from './types.ts'
import type { WorkshopCapabilityBuild, WorkshopCapabilityContext, WorkshopCapabilityObservation, WorkshopDraft } from './creation.ts'

export const CHANNEL_ELEMENTS = ['fire', 'wind', 'water', 'earth'] as const
/**
 * The optional second element a channel family may release instead of its base one: water → ice, fire → lightning.
 * Finite data: the plan's `variantChance` (0..1) is the probability of the variant; 0 keeps the family fixed.
 */
export const CHANNEL_VARIANTS: Record<string, string> = { water: 'ice', fire: 'lightning' }
/** The act parameter that carries the one element a cast actually released (chosen by the host, read by the rules). */
export const CHANNEL_ELEMENT_PARAM = 'creationElement'
type Identity = Pick<WorkshopDraft, 'id' | 'revision'>
export const channelArmedKey = (pkg: Identity, useId: string) => `creation_${pkg.id}_r${pkg.revision}_${useId}_armed`
export const empoweredStatus = (pkg: Identity) => `creation_${pkg.id}_r${pkg.revision}_empowered`
const readyKey = (pkg: Identity, mode: boolean) => `creation_${pkg.id}_${mode ? 'empower' : 'channel'}Ready`
/** The element a cast actually released, kept on the actor for the renderer and the trial (one cast's record). */
export const releasedKey = (pkg: Identity) => `creation_${pkg.id}_released`
export function channelState(eng: Engine, pkg: Identity) {
  const w = eng.world, actor = w.player
  return { readyAt: w.num(actor, readyKey(pkg, false)), empowerReadyAt: w.num(actor, readyKey(pkg, true)), empoweredUntil: actor.statuses?.[empoweredStatus(pkg)] ?? 0 }
}
/** The variant chance of a channel use: its own `variantChance`, else 0 (a fixed family). */
export function variantChanceOf(p: Record<string, PropValue>): number {
  const v = Number(p.variantChance ?? 0)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}
/** The elements a channel use may release: its base element, and its variant when the plan allows one. */
export function channelChoices(p: Record<string, PropValue>): string[] {
  const base = String(p.element), variant = CHANNEL_VARIANTS[base]
  return variant && variantChanceOf(p) > 0 ? [base, variant] : [base]
}
/** One saved world-RNG draw picks the element of a single cast; the same value is the act's parameter and the drawn bolt. */
export function channelElement(eng: Engine, p: Record<string, PropValue>): string {
  const choices = channelChoices(p)
  if (choices.length < 2) return choices[0]
  return eng.world.rand() < variantChanceOf(p) ? choices[1] : choices[0]
}

export function buildChannel(ctx: WorkshopCapabilityContext): WorkshopCapabilityBuild {
  const pkg = { id: ctx.packageId, revision: ctx.revision }, mode = ctx.use.capability === 'empower', p = ctx.params
  const notify: Effect = { op: 'emit', impulse: 'notify', to: 'actor', params: { ...ctx.signal, creationReadyUntil: { param: 'creationReadyUntil' } } }
  const actorEffects: Effect[] = [{ op: 'addProp', key: 'hunger', delta: -Number(p.cost), min: 0 }, { op: 'setProp', key: readyKey(pkg, mode), value: { param: 'creationReadyUntil' } }]
  const status = { id: empoweredStatus(pkg), name: { en: 'Elemental convergence', zh: '四象汇流' }, props: { atk: 2, def: 1 }, overlay: 'spark' }
  // Empower keeps its existing behaviour: a finite mode whose channel releases all four base families (no variants).
  if (mode) return { effects: [notify], actorEffects: [...actorEffects, { op: 'addStatus', status: status.id, duration: Number(p.duration) }, { op: 'vfx', fx: 'burst:arcane:1' }, { op: 'log', text: { en: 'The four elements converge. Channeling now releases all four; the power is temporary.', zh: '四象汇流，接下来的御术同时释放四种元素；力量会随时间消退。' } }], statuses: [status] }
  const strike = (element: string | { param: string }): Effect[] => [
    { op: 'emit', impulse: 'strike', to: 'target', params: { power: { param: 'creationPower' }, element, edge: 'magic' } },
    ...(element === 'earth' ? [{ op: 'emit', impulse: 'coat', to: 'target', params: ctx.signal } as Effect] : []),
  ]
  // Exactly one strike per cast: the native actor strike rule already emits the element that lands.
  // The element is the host's single saved draw, passed as the act's bounded parameter (never a plan string).
  const chosen = { param: CHANNEL_ELEMENT_PARAM }
  const effects: Effect[] = [
    notify,
    { op: 'emit', impulse: 'strike', to: 'target', params: { power: { param: 'creationPower' }, element: chosen, edge: 'magic' } },
    ...(String(p.element) === 'earth' ? [{ op: 'emit', impulse: 'coat', to: 'target', params: ctx.signal } as Effect] : []),
  ]
  return {
    effects, actorEffects,
    empowered: { status: status.id, effects: [notify, ...CHANNEL_ELEMENTS.flatMap(strike)] }, statuses: [status],
    receiver: { host: { type: 'actor' }, effects: [{ op: 'addStatus', status: 'stunned', duration: 6 }, { op: 'vfx', fx: 'impact:earth' }] },
  }
}

/** Nothing is spent or armed until the source, target, resource and saved clock all pass. */
export function runChannel(eng: Engine, pkg: Identity, useId: string, capability: string, p: Record<string, PropValue>, item: Entity, target: Ref, signal: Record<string, PropValue>): boolean {
  const w = eng.world, actor = w.player, mode = capability === 'empower', state = channelState(eng, pkg)
  const magic = /^item\/weapon\/magic(?:\/|$)/.test(item.type)
  if (magic ? actor.held !== item.id : !w.worn(actor).some(e => e.id === item.id)) return false
  if (w.num(actor, 'hunger') < Number(p.cost) || (mode ? state.empowerReadyAt : state.readyAt) > w.state.tick || mode && state.empoweredUntil > w.state.tick) return false
  const at = w.posOf(actor), to = w.refPos(target), victim = w.get(target.e)
  if (!at || !to || at.map !== to.map || (at.z ?? 0) !== (to.z ?? 0)) return false
  if (!mode && (!victim || victim.frozenBy || victim.id === actor.id || eng.isProtected(victim) || eng.spares(actor, victim) || !eng.ready(`atk:${actor.id}`) || eng.combat.refuses(actor, item, 'fight') || !eng.lineOfSight(at.map, at, to) || at.x !== to.x && at.y !== to.y)) return false
  const hp = victim ? w.num(victim, 'hp') : 0, key = channelArmedKey(pkg, useId), mark = eng.traced
  const hadProps = !!item.props, previous = item.props?.[key]
  let strike: ReturnType<Engine['combat']['strike']> | undefined
  let element: string | undefined
  eng.author(() => w.setProp(item, key, true))
  let ran = false
  try {
    // The probe resolves the compiled rule without drawing: a refused cast leaves the saved RNG untouched.
    const probe = eng.actEvent('use', actor.id, target, { e: item.id }, { ...signal, ...(!mode && { attack: true }) })
    if (eng.resolveEvent(probe).rule?.id !== `creation/${pkg.id}/r${pkg.revision}/${useId}/use`) return false
    // One saved draw, after every refusal check: the element the damage, the status and the drawn bolt all share.
    // An empowered cast releases all four base elements, so it takes no draw (and no variant) at all.
    const rngBefore = w.state.rng
    element = !mode && state.empoweredUntil <= w.state.tick ? channelElement(eng, p) : undefined
    strike = !mode && victim ? eng.combat.strike(actor, victim, Number(p.power) + w.stat(actor, 'atk', 1), Number(p.range), item, true) : undefined
    ran = eng.act('use', actor.id, target, { instrument: { e: item.id }, ...(mode ? {} : { reach: Number(p.range) }), params: { ...signal, creationReadyUntil: w.state.tick + Number(p.cooldown), ...(strike && { attack: true, creationPower: strike.power }), ...(element && { [CHANNEL_ELEMENT_PARAM]: element }) } }).defined
    if (!ran) w.state.rng = rngBefore
  } finally { if (w.get(item.id)) eng.author(() => { w.setProp(item, key, previous); if (!hadProps && !Object.keys(item.props ?? {}).length) delete item.props }) }
  if (!ran || eng.traced === mark || w.num(actor, readyKey(pkg, mode)) <= w.state.tick) return false
  if (strike) {
    eng.combat.struck(actor, victim, strike, hp, Number(p.range), true)
    eng.setCooldown(`atk:${actor.id}`, Math.max(Number(p.cooldown), eng.combat.delay(actor, 5, 'attack')))
    eng.controls.face(to)
    const elements = state.empoweredUntil > w.state.tick ? CHANNEL_ELEMENTS : [element!]
    // The released element is recorded once, from the same draw the strike used: the renderer draws that one.
    eng.author(() => w.setProp(actor, releasedKey(pkg), elements.join(',')))
    for (const element of elements) w.fx.push({ t: 'vfx', fx: `bolt:${element}:${actor.facing}:${Math.abs(to.x - at.x) + Math.abs(to.y - at.y)}`, map: at.map, x: at.x, y: at.y, who: actor.id })
  }
  eng.controls.sync()
  return true
}

export function verifyChannel(o: WorkshopCapabilityObservation): string[] {
  const errors: string[] = [], mode = o.use.capability === 'empower'
  const cost = Number(o.use.params?.cost ?? (mode ? 10 : 2))
  if (Number(o.before.actorHunger) - Number(o.after.actorHunger) !== cost) errors.push('The actor did not pay the exact stamina/fullness cost')
  if (mode) {
    if (Number(o.after.empoweredUntil) <= Number(o.after.tick) || Number(o.after.empowerReadyAt) < Number(o.after.empoweredUntil) || Number(o.after.defense) !== Number(o.before.defense) + 1) errors.push('The finite elemental mode, defence or recovery clock did not take effect')
    return errors
  }
  if (o.after.targetExists && Number(o.after.hp) >= Number(o.before.hp)) errors.push('The elemental strike did not damage its target')
  if (Number(o.after.readyAt) <= Number(o.after.tick)) errors.push('The saved shared cooldown did not start')
  if (Number(o.before.empoweredUntil) > Number(o.before.tick)) {
    if (CHANNEL_ELEMENTS.some(element => !o.trace.some(t => t.kind === 'impulse/element' && t.element === element))) errors.push('The empowered channel did not execute all four elements')
    return errors
  }
  const base = String(o.use.params?.element ?? 'fire'), statuses = o.after.statuses as string[]
  const released = typeof o.after.released === 'string' && o.after.released ? o.after.released.split(',') : []
  const variant = CHANNEL_VARIANTS[base]
  // The actual branch is accepted: the base element, or its variant when the plan allows one.
  if (released.length !== 1 || (released[0] !== base && !(variant && released[0] === variant))) errors.push(`The ${base} channel released an element its plan does not allow`)
  const struck = o.trace.filter(t => t.kind === 'impulse/element').map(t => t.element)
  if (struck.length !== 1 || struck[0] !== released[0]) errors.push('The released element and the element that reached the target disagree')
  // The consequence is the native reaction of the element that actually arrived, read from the target's own statuses.
  const consequence = (e: string) => e === 'fire' ? statuses.includes('burning')
    : e === 'water' ? statuses.includes('wet') && !statuses.includes('burning')
    : e === 'ice' ? statuses.includes('frozen')
    : e === 'lightning' ? statuses.includes('electrified')
    : e === 'earth' ? statuses.includes('stunned')
    : e === 'wind' ? JSON.stringify(o.before.targetPos) !== JSON.stringify(o.after.targetPos)
    : false
  if (!released.length || !consequence(released[0])) errors.push(`The ${released.join('/') || base} consequence did not occur`)
  return errors
}
