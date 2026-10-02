// The player's controls (design.md §5.2–5.3): four inputs, one verb each, so every event the
// rule library can define is reachable (completeness):
// - E, **hands**: interact with a bare hand (talk, open, read, sleep, push, shake);
// - F, **take**: take (pick up, pick a crop, take down, take from a table);
// - left click, **use**: the held thing on the target (tools, blows, eating when aimed at oneself,
//   and the player's experiments);
// - right click, **put**: the held thing onto or into the target (place, store, sow, give).
// An input points at a spot on the map. Whatever is drawn there is a layer of it, top first (a
// person, a thing on a table, the table, the canopy of a tree behind them, the ground): a press
// acts on the top one, a long press (the chooser) on any of them. Only the view knows what is
// drawn where, so it hands the stack over with the aim; without one (the keyboard, a test), the
// stack is what stands on the tile.
// Also here: the inventory's slots (row 1 is the toolbar, the selected slot is what is held),
// the magnet that pulls dropped items in, and the yes/no question asked before sleeping or
// eating (the host stops time while it is open).

import type { Engine, Resolution } from './engine.ts'
import type { Aim, Dir, Entity, GameEvent, Id, Plan, Pos, Ref, Text, Verb } from './types.ts'

/** The four inputs (design.md §5.2). */
export type Key = Plan['key']

/** Slots per row (the toolbar is row 1) and in all. */
export const ROW = 10
export const SLOT_COUNT = 10
/** Dropped items within this many tiles fly into the bag (Stardew: 128 px, two tiles). */
export const MAGNET = 2

/** Stardew's line between tools and objects: tools are used, objects are given, placed or eaten. */
const TOOL_PREFIXES = ['item/weapon/', 'item/tool/', 'item/light/', 'item/vessel/bucket/', 'item/vessel/flask/', 'item/vessel/waterskin/']
export const isTool = (type: string) => TOOL_PREFIXES.some((p) => type.startsWith(p))
const isWeapon = (type: string) => type.startsWith('item/weapon/')

/** Labels by rule (prefix) — what the HUD says a key will do. */
const LABELS: [string, Text][] = [
  ['core/talk', { en: 'Talk to {target}', zh: '和{target}说话' }],
  ['story/', { en: 'Talk to {target}', zh: '和{target}说话' }],
  ['core/give', { en: 'Give {instrument} to {target}', zh: '把{instrument}送给{target}' }],
  ['core/open-close', { en: 'Open {target}', zh: '打开{target}' }],
  ['core/locked', { en: 'Try {target}', zh: '试着打开{target}' }],
  ['core/read', { en: 'Read {target}', zh: '阅读{target}' }],
  ['core/sleep', { en: 'Sleep', zh: '睡觉' }],
  ['core/examine', { en: 'Look at {target}', zh: '查看{target}' }],
  ['core/take', { en: 'Take {target}', zh: '拿起{target}' }],
  ['core/store', { en: 'Put {instrument} in {target}', zh: '把{instrument}放进{target}' }],
  ['core/put-on-surface', { en: 'Set {instrument} on {target}', zh: '把{instrument}放在{target}上' }],
  ['core/put-down', { en: 'Place {instrument}', zh: '放下{instrument}' }],
  ['core/eat', { en: 'Eat {instrument}', zh: '吃掉{instrument}' }],
  ['core/drink', { en: 'Drink {instrument}', zh: '喝掉{instrument}' }],
  ['core/fill-water', { en: 'Fill {instrument}', zh: '装满{instrument}' }],
  ['core/douse', { en: 'Douse {target}', zh: '浇灭{target}' }],
  ['core/splash', { en: 'Splash {target}', zh: '泼向{target}' }],
  ['core/pour-oil', { en: 'Pour oil on {target}', zh: '往{target}上倒油' }],
  ['core/ignite', { en: 'Set fire to {target}', zh: '点燃{target}' }],
  ['core/light', { en: 'Light {target}', zh: '点燃{target}' }],
  ['core/snuff', { en: 'Put out {target}', zh: '熄灭{target}' }],
  ['core/cook', { en: 'Cook {instrument}', zh: '烤{instrument}' }],
  ['core/burn-in-fire', { en: 'Burn {instrument}', zh: '烧掉{instrument}' }],
  ['core/mine', { en: 'Mine {target}', zh: '开采{target}' }],
  ['core/unlock', { en: 'Unlock {target}', zh: '打开{target}的锁' }],
  ['core/till', { en: 'Till', zh: '翻土' }],
  ['core/fish', { en: 'Fish', zh: '钓鱼' }],
  ['wood/', { en: 'Chop {target}', zh: '砍{target}' }],
  ['farm/sow', { en: 'Sow {instrument}', zh: '播下{instrument}' }],
  ['farm/water', { en: 'Water {target}', zh: '给{target}浇水' }],
  ['farm/harvest', { en: 'Harvest {target}', zh: '收割{target}' }],
  ['farm/pick', { en: 'Pick {target}', zh: '采摘{target}' }],
  ['build/', { en: 'Build', zh: '搭建' }],
  ['village/hearth-look', { en: 'Look at {target}', zh: '查看{target}' }],
  ['village/', { en: 'Use {instrument} on {target}', zh: '把{instrument}用在{target}上' }],
  ['patch/', { en: 'Use {instrument} on {target}', zh: '把{instrument}用在{target}上' }],
]
const GENERIC: Record<string, Text> = {
  interact: { en: 'Use {instrument} on {target}', zh: '把{instrument}用在{target}上' },
  bare: { en: 'Touch {target}', zh: '摸摸{target}' },
  put: { en: 'Put {instrument} on {target}', zh: '把{instrument}放到{target}上' },
  take: { en: 'Take {target}', zh: '拿起{target}' },
  attack: { en: 'Strike {target} with {instrument}', zh: '用{instrument}打{target}' },
  punch: { en: 'Punch {target}', zh: '一拳打向{target}' },
  cast: { en: 'Cast {instrument}', zh: '施放{instrument}' },
}

export class Controls {
  /** The magnet is on in a played game (Game turns it on); sandboxes and replays leave items where rules put them. */
  magnetic = false

  constructor(private eng: Engine) {}

  private get w() {
    return this.eng.world
  }

  // ---------------------------------------------------------------- aiming

  /**
   * Where a key acts: the pointed spot when its tile is the player's own or one of their 8
   * neighbours (with what is drawn there), else the tile in front.
   */
  aim(at?: Aim): { at: Pos; stack?: Ref[] } | undefined {
    const w = this.w
    const p = w.player
    const pos = w.posOf(p)
    if (!pos) return undefined
    if (at && Math.max(Math.abs(at.x - pos.x), Math.abs(at.y - pos.y)) <= 1) return { at: { map: pos.map, x: at.x, y: at.y }, stack: at.stack }
    const front = w.front(p)
    return front && { at: front }
  }

  /** Turn the player toward a tile (the general direction). */
  face(at: Pos): void {
    const w = this.w
    const p = w.player
    const pos = w.posOf(p)
    if (!pos) return
    const dx = at.x - pos.x
    const dy = at.y - pos.y
    if (!dx && !dy) return
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    p.facing = dir
  }

  // ---------------------------------------------------------------- the layers of a tile

  /**
   * Everything drawn at a spot, top first, the ground under it last. `stack` is the view's (what
   * is drawn at the point: the things, the tiles whose growth reaches there); without it, what
   * stands on the tile, as it is drawn — people and creatures, items (the top of a pile first), fixtures.
   */
  layers(at: Pos, stack?: Ref[]): Ref[] {
    const w = this.w
    const ok = (r: Ref) => ('e' in r ? w.posOf(w.get(r.e))?.map === at.map : r.tile.map === at.map && w.inBounds(r.tile.map, r.tile.x, r.tile.y))
    const sig = (r: Ref) => ('e' in r ? r.e : `${r.tile.x},${r.tile.y}`)
    let out: Ref[]
    if (stack) out = stack.filter(ok)
    else {
      const es = w.entitiesAt(at.map, at.x, at.y)
      const of = (k: string) => es.filter((e) => w.kindOf(e) === k)
      // in the order they are drawn: people and creatures over items, items over the fixture they lie on
      out = [...of('actor'), ...of('item').reverse(), ...of('fixture')].map((e) => ({ e: e.id }))
    }
    out.push({ tile: { map: at.map, x: at.x, y: at.y } })
    const seen = new Set<string>()
    return out.filter((r) => !seen.has(sig(r)) && !!seen.add(sig(r)))
  }

  // ---------------------------------------------------------------- planning

  private dry(verb: Verb, target: Ref, instrument: Ref | undefined, strict = false): Resolution {
    const ev: GameEvent = { kind: 'interaction', verb, roles: { actor: { e: this.w.state.player }, target, instrument }, strict: strict || undefined }
    return this.eng.resolve(ev)
  }

  private firm(r: Resolution): boolean {
    return r.defined && !r.rule?.fallback
  }

  private entity(r: Ref | undefined): Entity | undefined {
    return r && 'e' in r ? this.w.get(r.e) : undefined
  }

  private isPerson(r: Ref): boolean {
    const e = this.entity(r)
    return !!e && e.type.startsWith('actor/person')
  }

  private isCreature(r: Ref): boolean {
    const e = this.entity(r)
    return !!e && e.type.startsWith('actor/creature')
  }


  /** "Give {instrument} to {target}" with the names filled in. */
  private label(t: Text, target: Ref, instrument?: Ref): Text {
    const fill = (s: string, l: 'en' | 'zh') => s.replace('{target}', this.eng.nameOf(target, l)).replace('{instrument}', this.eng.nameOf(instrument, l))
    const tt = typeof t === 'string' ? { en: t, zh: t } : t
    return { en: fill(tt.en, 'en'), zh: fill(tt.zh ?? tt.en, 'zh') }
  }

  private labelFor(rule: string | undefined, fallback: Text, target: Ref, instrument?: Ref): Text {
    const hit = rule ? LABELS.find(([k]) => rule === k || rule.startsWith(k)) : undefined
    return this.label(hit?.[1] ?? fallback, target, instrument)
  }

  /**
   * One key's plan for one layer: the event it makes (the verb is the key's, the instrument the
   * held thing or none, the target the layer) and what the rule library says of it.
   */
  private planOn(key: Key, at: Pos, target: Ref): Plan | undefined {
    const p = this.w.player
    const held = p.held ? { e: p.held } : undefined
    const heldE = this.entity(held)
    if (key === 'hands') return this.make(key, at, 'interact', target, undefined, true)
    if (key === 'take') return this.make(key, at, 'take', target, held, false)
    if (key === 'put') return held ? this.make(key, at, 'put', target, held, false) : undefined
    // use: the held thing — a blow for weapons on creatures (and pure weapons on anything but
    // people); a bare fist on a creature; otherwise the held thing applied to the target
    const person = this.isPerson(target)
    if (heldE) {
      const pure = isWeapon(heldE.type) && !this.w.hasTag(heldE, 'tool:axe') && !(heldE.tags ?? []).some((g) => g.startsWith('tool:'))
      const blow = isWeapon(heldE.type) && !person && (pure || this.isCreature(target))
      if (blow) return this.attackPlan(at, target, held!, heldE)
      return this.make(key, at, 'interact', target, held, true)
    }
    if (this.isCreature(target)) return { key, at, attack: true, target, label: this.label(GENERIC.punch, target) }
    return this.make(key, at, 'interact', target, undefined, true)
  }

  private make(key: Key, at: Pos, verb: Verb, target: Ref, instrument: Ref | undefined, strict: boolean): Plan {
    const r = this.dry(verb, target, instrument, strict)
    const firm = this.firm(r)
    const generic = verb === 'interact' ? (instrument ? GENERIC.interact : GENERIC.bare) : GENERIC[verb]
    const plan: Plan = { key, at, verb, target, instrument, rule: firm ? r.rule?.id : undefined, label: this.labelFor(firm ? r.rule?.id : undefined, generic, target, instrument), strict: strict || undefined, unknown: !firm || undefined }
    if (firm && r.rule?.confirm) plan.confirm = this.label(r.rule.confirm, target, instrument)
    const e = this.entity(target)
    if (firm && e && this.w.hasTag(e, 'container') && r.rule?.id === 'core/open-close') plan.panel = e.id
    return plan
  }

  private attackPlan(at: Pos, target: Ref, held: Ref, heldE: Entity): Plan {
    const cast = heldE.type.startsWith('item/weapon/magic/')
    return { key: 'use', at, attack: true, target, instrument: held, label: this.label(cast ? GENERIC.cast : GENERIC.attack, target, held) }
  }

  /**
   * A key's plan at the aim: on the top layer, or on the one the player picked (the chooser).
   * What the rule library does not define there is an experiment, and goes to the Mod port.
   * Every layer is reachable through the chooser (design.md §5.2, completeness).
   */
  plan(key: Key, aim?: Aim, layer = 0): Plan | undefined {
    const a = this.aim(aim)
    if (!a) return undefined
    const ref = this.layers(a.at, a.stack)[layer]
    return ref ? this.planOn(key, a.at, ref) : undefined
  }

  /** The chooser's list: every layer at the aim, with what the key would do there. */
  choices(key: Key, aim?: Aim): { layer: number; name: Text; plan?: Plan }[] {
    const a = this.aim(aim)
    if (!a) return []
    return this.layers(a.at, a.stack).map((ref, layer) => ({ layer, name: this.label('{target}', ref), plan: this.planOn(key, a.at, ref) }))
  }

  // ---------------------------------------------------------------- running

  /** Run a plan: an attack, or the interaction (unless it must ask first). Returns the container to open, if any. */
  run(plan: Plan, confirmed = false): { panel?: Id } {
    const eng = this.eng
    const w = this.w
    const p = w.player
    if (eng.busy(p)) return {}
    this.face(plan.at)
    if (plan.confirm && !confirmed) {
      w.state.question = { text: plan.confirm, plan }
      return {}
    }
    if (plan.attack) {
      eng.playerAttack(plan.target)
      return {}
    }
    // a container left open: just show its panel
    if (plan.panel && w.hasStatus({ e: plan.panel }, 'open')) return { panel: plan.panel }
    eng.interact(plan.verb!, p.id, plan.target, { instrument: plan.instrument ?? null, strict: plan.strict })
    if (plan.panel && w.hasStatus({ e: plan.panel }, 'open')) return { panel: plan.panel }
    return {}
  }

  /** The player answers the open question. */
  answer(yes: boolean): void {
    const q = this.w.state.question
    if (!q) return
    delete this.w.state.question
    if (yes) this.run(q.plan, true)
  }

  /** The inventory's context menu: a key's event on an item in the bag (or in an open chest). */
  planOnItem(key: Key, item: Id): Plan | undefined {
    const w = this.w
    const pos = w.posOf(w.player)
    if (!pos || !w.get(item)) return undefined
    if (key === 'use' && w.player.held === item) return undefined
    return this.planOn(key, pos, { e: item })
  }

  // ---------------------------------------------------------------- inventory slots

  /** What makes items the same stack: type, name, tags, statuses. */
  key(e: Entity): string {
    return JSON.stringify([e.type, e.name ?? null, [...(e.tags ?? [])].sort(), Object.keys(e.statuses ?? {}).sort()])
  }

  /** Every item the player carries (bag and hand), by stack key. */
  private carried(): Map<string, Entity[]> {
    const w = this.w
    const p = w.player
    const by = new Map<string, Entity[]>()
    for (const id of [...(p.contents ?? []), ...(p.held ? [p.held] : [])]) {
      const e = w.get(id)
      if (!e) continue
      const k = this.key(e)
      const s = by.get(k)
      if (s) s.push(e)
      else by.set(k, [e])
    }
    return by
  }

  /**
   * Keep the slots true to what is carried: a new kind takes the first free slot (none free:
   * it drops at the player's feet), a kind that is gone frees its slot, and the hand holds one
   * of the selected slot's stack. A held item a rule changed (a bucket emptied) keeps its slot.
   */
  sync(): void {
    const w = this.w
    const p = w.player
    const slots = (p.slots ??= Array(SLOT_COUNT).fill(null))
    while (slots.length < SLOT_COUNT) slots.push(null)
    p.selected ??= 0
    const by = this.carried()
    const held = w.get(p.held)
    if (held) {
      const hk = this.key(held)
      const sel = slots[p.selected]
      if (sel !== hk) {
        const selLeft = sel ? (by.get(sel) ?? []).filter((e) => e.id !== held.id).length : 0
        if (!sel || !selLeft) {
          // the held thing changed in the hand: it keeps the selected slot
          const other = slots.indexOf(hk)
          if (other >= 0) slots[other] = null
          slots[p.selected] = hk
        } else w.place(held, { on: 'inside', holder: p.id }) // it belongs elsewhere; the hand takes the selected stack below
      }
    }
    for (let i = 0; i < slots.length; i++) if (slots[i] && !by.has(slots[i]!)) slots[i] = null
    const here = w.posOf(p)
    for (const [k, items] of by) {
      if (slots.includes(k)) continue
      const free = slots.indexOf(null)
      if (free >= 0) slots[free] = k
      else if (here) for (const e of items) w.place(e, { on: 'tile', map: here.map, x: here.x, y: here.y })
    }
    // the hand holds one of the selected stack (or nothing)
    const want = slots[p.selected]
    const inHand = w.get(p.held)
    if (inHand && (!want || this.key(inHand) !== want)) w.place(inHand, { on: 'inside', holder: p.id })
    if (want && !w.get(p.held)) {
      const next = (this.carried().get(want) ?? [])[0]
      if (next && !next.frozenBy) w.place(next, { on: 'hand', holder: p.id })
    }
  }

  /** The hand puts its item back in the bag (before the slots are rearranged or another is chosen). */
  private stow(): void {
    const w = this.w
    const p = w.player
    const h = w.get(p.held)
    if (h && !h.frozenBy) w.place(h, { on: 'inside', holder: p.id })
  }

  select(i: number): void {
    const p = this.w.player
    if (i < 0 || i >= ROW || this.eng.busy(p)) return
    this.stow()
    p.selected = i
    this.sync()
  }

  /** Mouse wheel: the next (or previous) occupied toolbar slot. */
  cycle(dir: 1 | -1): void {
    const p = this.w.player
    const slots = p.slots ?? []
    let i = p.selected ?? 0
    for (let n = 0; n < ROW; n++) {
      i = (i + dir + ROW) % ROW
      if (slots[i]) break
    }
    this.select(i)
  }

  /** Tab: the next row of the bag becomes the toolbar. */
  nextRow(): void {
    const p = this.w.player
    const slots = p.slots ?? []
    this.stow()
    p.slots = [...slots.slice(ROW), ...slots.slice(0, ROW)]
    this.sync()
  }

  /** Move or swap two slots (the inventory menu). */
  swap(a: number, b: number): void {
    const slots = this.w.player.slots
    if (!slots || a === b || a < 0 || b < 0 || a >= SLOT_COUNT || b >= SLOT_COUNT) return
    this.stow()
    ;[slots[a], slots[b]] = [slots[b], slots[a]]
    this.sync()
  }

  /** The organize button: tools first, then everything else, each by type; empty slots last. */
  organize(): void {
    const p = this.w.player
    const slots = p.slots ?? []
    const typeOf = (k: string) => (JSON.parse(k) as [string])[0]
    const keys = slots.filter((k): k is string => !!k).sort((a, b) => Number(!isTool(typeOf(a))) - Number(!isTool(typeOf(b))) || typeOf(a).localeCompare(typeOf(b)))
    const held = p.selected !== undefined ? slots[p.selected] : null
    this.stow()
    p.slots = [...keys, ...Array(SLOT_COUNT - keys.length).fill(null)]
    if (held) p.selected = Math.min(ROW - 1, p.slots.indexOf(held)) === p.slots.indexOf(held) ? p.slots.indexOf(held) : p.selected
    this.sync()
  }

  /** Drop a slot's stack (or one of it) in front of the player, or at their feet when that is blocked (the menu's Drop). */
  drop(i: number, all = true): void {
    const w = this.w
    const p = w.player
    const k = p.slots?.[i]
    const here = w.posOf(p)
    if (!k || !here) return
    const front = w.front(p)
    const to = front && w.inBounds(front.map, front.x, front.y) && w.passable(front.map, front.x, front.y) ? front : here
    const items = this.carried().get(k) ?? []
    for (const e of all ? items : items.slice(0, 1)) if (!e.frozenBy) w.place(e, { on: 'tile', map: to.map, x: to.x, y: to.y })
    this.sync()
  }

  /** The chest panel: move one or all of a stack between the bag and an open container (through the rules). */
  transfer(container: Id, from: 'chest' | 'bag', item: Id, all: boolean): void {
    const w = this.w
    const eng = this.eng
    const p = w.player
    const box = w.get(container)
    const it = w.get(item)
    if (!box || !it || !w.hasStatus({ e: box.id }, 'open')) return
    const k = this.key(it)
    const pool = from === 'chest' ? (box.contents ?? []).map((id) => w.get(id)!).filter((e) => e && this.key(e) === k) : this.carried().get(k) ?? []
    for (const e of all ? pool : pool.slice(0, 1)) {
      if (from === 'chest') eng.interact('take', p.id, { e: e.id }, { instrument: null })
      else eng.interact('put', p.id, { e: box.id }, { instrument: { e: e.id } })
    }
    this.sync()
  }

  // ---------------------------------------------------------------- the magnet

  /** Dropped items within MAGNET tiles fly into the bag while there is room. */
  magnet(): void {
    const w = this.w
    const p = w.player
    const here = w.posOf(p)
    if (!this.magnetic || !here || this.eng.busy(p)) return
    const by = this.carried()
    let free = (p.slots ?? []).filter((s) => !s).length
    for (let dy = -MAGNET; dy <= MAGNET; dy++)
      for (let dx = -MAGNET; dx <= MAGNET; dx++)
        for (const e of w.entitiesAt(here.map, here.x + dx, here.y + dy)) {
          if (!e.dropped || e.frozenBy || w.kindOf(e) !== 'item') continue
          const k = this.key(e)
          if (!by.has(k)) {
            if (free <= 0) continue
            free--
            by.set(k, [e])
          }
          delete e.dropped
          const r = w.onto.resolve(e.type)
          w.fx.push({ t: 'pickup', item: e.id, sprite: r.sprite ?? e.type, name: e.name ?? r.name ?? { en: e.type }, map: here.map, x: here.x + dx, y: here.y + dy })
          w.place(e, { on: 'inside', holder: p.id })
        }
    this.sync()
  }
}
