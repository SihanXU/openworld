// The player's controls (design.md §5.2–5.3): five inputs, one act each, so every act the rule
// library can answer is reachable (completeness):
// - E, **hands**: a hand on the target (talk, open, read, wake, sleep) — as far as the target lets
//   a hand reach it (its `handsRange`: 0, standing on it, a bed; 1, beside it, by default);
// - F, **take** and G, **put**: take a thing, put the held thing down, in or on a thing, or hand it
//   to someone — within the world's `carry` (the cells round); they are the world's physics, never
//   asked, and offered only where they would change something;
// - left click, **use**: the held thing on the target — as far as it carries (its `range`); with
//   nothing held, the bare body: a blow (Minecraft's fist), on anything;
// - right click, **self**: the held thing used on oneself (as a left click on one's own place).
// E, F and G never take oneself for their target: on one's own place they meet what is there.
// An input points at a spot on the map. Whatever is drawn there is a layer of it, top first (a
// person, a thing on a table, the table, the canopy of a tree behind them, the ground): a press
// acts on the top one, a long press (the chooser) on any of them. A spot is within reach when any
// input can act there; where none can, the keys act on the place in front (the keyboard alone
// plays). Only the view knows what is drawn where, so it hands the stack over with the aim. Each
// input makes an act (design.md §5.7) the engine itself holds to its reach, for anyone; its label
// is a dry run of the chain the act starts, marked unknown where that chain reaches an undefined
// outcome. Also here: the inventory's slots (row 1 is the toolbar, the selected slot is what is
// held), the magnet that pulls dropped items in, crafting, and the yes/no question asked before
// sleeping or eating (the host stops time while it is open).

import { isRoot } from './rules.ts'
import { parseCellId } from './cells.ts'
import type { Engine } from './engine.ts'
import type { Writer } from './world.ts'
import type { Aim, Dir, Entity, Id, Place, Plan, Pos, PropValue, Recipe, Ref, SkillDef, Text, Verb } from './types.ts'
import { cannotLearn, skillsOf } from './progression.ts'
import { PROFESSION_LEVEL, cannotChoose, type ProfessionDef, type ProfessionRefusal } from './profession.ts'

/** The five inputs (design.md §5.2). */
export type Key = Plan['key']

/** Slots per row (the toolbar is row 1) and in all: three rows, Stardew's bag. */
export const ROW = 10
export const SLOT_COUNT = 30
/** Dropped items within this many tiles fly into the bag (Stardew: 128 px, two tiles). */
export const MAGNET = 2

/** Stardew's line between tools and objects: tools are used, objects are given, placed or eaten. */
const TOOL_PREFIXES = ['item/weapon/', 'item/tool/', 'item/light/', 'item/vessel/bucket/', 'item/vessel/flask/', 'item/vessel/waterskin/']
export const isTool = (type: string) => TOOL_PREFIXES.some((p) => type.startsWith(p))
const isWeapon = (type: string) => type.startsWith('item/weapon/')

/**
 * What an input does where no rule says (the labels are the rules' own: a rule, or one of its
 * answers, says what an input ending there does — world-model.md; a patch says it too).
 */
const GENERIC: Record<string, Text> = {
  use: { en: 'Use {instrument} on {target}', zh: '把{instrument}用在{target}上' },
  self: { en: 'Use {instrument} on yourself', zh: '对自己用{instrument}' },
  hands: { en: 'Interact with {target}', zh: '与{target}互动' },
  put: { en: 'Put {instrument} on {target}', zh: '把{instrument}放到{target}上' },
  take: { en: 'Take {target}', zh: '拿起{target}' },
  attack: { en: 'Strike {target} with {instrument}', zh: '用{instrument}打{target}' },
  punch: { en: 'Punch {target}', zh: '一拳打向{target}' },
  cast: { en: 'Cast {instrument}', zh: '施放{instrument}' },
}

export class Controls {
  /** The magnet is on in a played game (Game turns it on); sandboxes and replays leave items where rules put them. */
  magnetic = false

  /** `hand`: the writer for the input's own posture only (what is in the hand, the slots): lent by the engine, held by no one else. */
  constructor(
    private eng: Engine,
    private hand: Writer,
  ) {}

  private get w() {
    return this.eng.world
  }

  // ---------------------------------------------------------------- aiming

  /**
   * Where a key acts: the pointed spot when some input can act there (the farthest of them is how
   * far the pointer reaches); a pointer beyond that, the farthest spot toward it that one reaches;
   * the pointer on one's own picture (it stands over the tile behind), one's own place; without a
   * pointer, the place in front — the keyboard alone plays. The right click is always on oneself.
   * `pointed`: the spot is the pointer's own.
   */
  aim(at?: Aim, key?: Key): { at: Pos; stack?: Ref[]; pointed?: boolean } | undefined {
    const w = this.w
    const p = w.player
    const pos = w.posOf(p)
    if (!pos) return undefined
    if (key === 'self') return { at: pos }
    if (!at) {
      const front = w.front(p)
      return front && { at: front }
    }
    if (at.stack?.[0]?.e === p.id) return { at: pos, pointed: true }
    if (this.reachable(at)) return { at: { ...pos, x: at.x, y: at.y }, stack: at.stack, pointed: true }
    // beyond every input's reach: step back along the line to the pointer until a spot is reached
    const dx = at.x - pos.x
    const dy = at.y - pos.y
    const n = Math.max(Math.abs(dx), Math.abs(dy))
    // halves rounded away from oneself, the same on every side
    const step = (v: number) => Math.sign(v) * Math.round(Math.abs(v))
    for (let i = n - 1; i >= 1; i--) {
      const spot = { x: pos.x + step((dx * i) / n), y: pos.y + step((dy * i) / n) }
      if (this.reachable(spot)) return { at: { ...pos, ...spot } }
    }
    return { at: pos }
  }

  /** Can any input act on the spot (on its top, as a press would)? Oneself's own place always can. */
  reachable(at: Aim): boolean {
    const w = this.w
    const pos = w.posOf(w.player)
    if (!pos) return false
    if (at.x === pos.x && at.y === pos.y) return true
    const here: Pos = { ...pos, x: at.x, y: at.y }
    return (['hands', 'take', 'put', 'use'] as Key[]).some((k) => this.planAt(k, here, at.stack, 0))
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
   * What stands on the tile always comes before its ground: a pointer on the tile but beside a small
   * sprite (a stone) still meets the stone, not the bare ground.
   */
  layers(at: Pos, stack?: Ref[]): Ref[] {
    const w = this.w
    // only the storey aimed at (the one the player stands on): what is above or below is out of the
    // inputs' reach (its ground is the floor laid there; the cells' own make-up is the ground storey's)
    const storey = at.z ?? w.posOf(w.player)?.z ?? 0
    const ok = (r: Ref) => { const p = w.refPos(r); return p?.map === at.map && (p.z ?? 0) === storey }
    // a cell drawn at the point (a tree's canopy) is named by any of its ids: it is what makes it up on top
    const cellOf = (r: Ref): Ref => {
      const c = !w.get(r.e) && parseCellId(r.e)
      return c ? w.cellRef(c.map, c.x, c.y, c.z) : r
    }
    const sig = (r: Ref) => r.e
    // what stands there, and what bigger stands beside it and covers it with its base (a tent, a place on the overworld)
    const es = [...w.entitiesAt(at.map, at.x, at.y, storey), ...w.coveringAt(at.map, at.x, at.y, storey)]
    // what makes up the cell on this storey: its terrain, or a floor laid there
    const cell = (e: Entity) => w.isTerrain(e) || w.spacesOf(e).includes('floor')
    // in the order they are drawn: bodies over what can be carried, that over what it lies on
    const built = (e: Entity) => w.hasTag(e, 'structure') && !cell(e)
    const bodies = es.filter((e) => w.isAgent(e))
    const loose = es.filter((e) => !w.isAgent(e) && w.isPortable(e) && !built(e) && !cell(e)).reverse()
    // what stands there, then what is built there (a wall, a door, stairs), then what makes up the
    // cell, top first: a floor laid there, what fills it, roots in it, the ground
    const ground = es.filter((e) => !w.isAgent(e) && !w.isPortable(e) && !cell(e) && !built(e))
    const structures = es.filter(built)
    const made = es.filter(cell).sort((a, b) => w.cellRank(b) - w.cellRank(a))
    const standing: Ref[] = [...bodies, ...loose, ...ground, ...structures].map((e) => ({ e: e.id }))
    // the view's cells of this very tile are its make-up, under what stands on it (they come last, below)
    const own = (r: Ref) => { const e = w.get(r.e); const c = parseCellId(r.e) ?? (e && cell(e) ? w.posOf(e) : undefined); return !!c && c.map === at.map && c.x === at.x && c.y === at.y && (c.z ?? 0) === storey }
    let out: Ref[] = stack ? [...stack.filter((r) => !own(r)).map(cellOf).filter(ok), ...standing] : standing
    // a bird overhead is the last thing the keys meet (it is drawn on top, but rarely what is meant)
    const aloft = (r: Ref) => 'e' in r && !!w.get(r.e) && w.hasTag(w.get(r.e)!, 'airborne')
    out = [...out.filter((r) => !aloft(r)), ...out.filter(aloft)]
    out.push(...made.map((e) => ({ e: e.id })))
    const seen = new Set<string>()
    return out.filter((r) => !seen.has(sig(r)) && !!seen.add(sig(r)))
  }

  // ---------------------------------------------------------------- planning

  /** A dry run of the act this input would make: its outcome and the chain it starts. */
  private dry(verb: Verb, target: Ref, instrument: Ref | undefined, params: Record<string, PropValue> = {}) {
    return this.eng.preview(this.eng.actEvent(verb, this.w.state.player, target, instrument, params))
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
    const me = { e: this.w.state.player }
    const fill = (s: string, l: 'en' | 'zh') => s.replace('{target}', this.eng.nameOf(target, l)).replace('{instrument}', this.eng.nameOf(instrument, l)).replace('{actor}', this.eng.nameOf(me, l))
    const tt = typeof t === 'string' ? { en: t, zh: t } : t
    return { en: fill(tt.en, 'en'), zh: fill(tt.zh ?? tt.en, 'zh') }
  }

  /** The label of the most telling answer of the chain that says one (the receiver's, before the act's own); else the input's default. */
  private labelFor(labels: { text: Text; rule: string }[], fallback: Text, target: Ref, instrument?: Ref): Text {
    // the hosts' answers first (deepest first), then the roots that passed the act on
    const root = (id: string) => { const r = this.eng.lib.rules.get(id); return !r || isRoot(r) }
    for (const l of [...labels.filter((x) => !root(x.rule)).reverse(), ...labels.filter((x) => root(x.rule)).reverse()])
      // a label that names what is held does not fit an act with nothing held (E, F)
      if (instrument || !JSON.stringify(l.text).includes('{instrument}')) return this.label(l.text, target, instrument)
    return this.label(fallback, target, instrument)
  }

  /** The layers an input meets at a spot: oneself is never one (one's own place is what is there). */
  private targets(at: Pos, stack?: Ref[]): Ref[] {
    const me = this.w.state.player
    return this.layers(at, stack).filter((r) => r.e !== me)
  }

  /** Is the target within the reach of the act (the engine holds every act to it, for anyone)? */
  private reaches(verb: Verb, target: Ref, instrument?: Ref): boolean {
    return this.eng.inReach(verb, this.w.player, target, instrument)
  }

  /**
   * One key's plan for one layer: the act it makes (the verb is the key's, the instrument the
   * held thing or none, the target the layer) and what the chain it starts would come to; none
   * where the act does not reach, or where taking and putting would change nothing.
   */
  private planOn(key: Key, at: Pos, target: Ref): Plan | undefined {
    const w = this.w
    const p = w.player
    // the thing in hand — or the one the build palette sets down from the bag
    const held = this.using ? { e: this.using } : p.held ? { e: p.held } : undefined
    const heldE = this.entity(held)
    if (key === 'hands') return this.reaches('hands', target) ? this.make(key, at, 'hands', target, undefined) : undefined
    if (key === 'take' || key === 'put') {
      if (key === 'put' && !held) return undefined
      if (!this.reaches(key, target, held)) return undefined
      const plan = this.make(key, at, key, target, key === 'put' ? held : undefined)
      return plan.changes ? plan : undefined
    }
    // use (and self: use on oneself): the held thing — a blow for weapons on creatures (and pure
    // weapons on anything but people); with nothing held, the bare body: a blow on anything
    const reach = this.eng.reachOf('use', p, this.entity(target), heldE) ?? 1
    const here = w.posOf(p)
    const there = w.posOf(this.entity(target))
    // a blow from afar flies along a row or a column (a bolt, an arrow)
    const aligned = !here || !there || here.x === there.x || here.y === there.y
    if (!this.reaches('use', target, held)) return undefined
    if (heldE) {
      const pure = isWeapon(heldE.type) && !w.hasTag(heldE, 'tool:axe') && !(heldE.tags ?? []).some((g) => g.startsWith('tool:'))
      const blow = isWeapon(heldE.type) && !this.isPerson(target) && (pure || this.isCreature(target))
      if (blow && reach > 1 && !aligned) return undefined
      return this.make(key, at, 'use', target, held, blow, blow ? (heldE.type.startsWith('item/weapon/magic/') ? GENERIC.cast : GENERIC.attack) : undefined)
    }
    if (reach > 1 && !aligned) return undefined
    return this.make(key, at, 'use', target, undefined, true, GENERIC.punch)
  }

  /** The rule that answers: the deepest one of the chain that belongs to a host (the receiver's answer, not the root that passed it on). */
  private telling(rules: string[]): string | undefined {
    return [...rules].reverse().find((id) => { const r = this.eng.lib.rules.get(id); return r && !isRoot(r) }) ?? rules[0]
  }

  private make(key: Key, at: Pos, verb: Verb, target: Ref, instrument: Ref | undefined, attack = false, fallback?: Text): Plan {
    const r = this.dry(verb, target, instrument, attack ? { attack: true } : {})
    const generic = fallback ?? (key === 'self' ? GENERIC.self : GENERIC[verb] ?? GENERIC.use)
    const plan: Plan = { key, at, verb, target, instrument, rule: this.telling(r.rules), label: this.labelFor(r.labels, generic, target, instrument), unknown: r.unknown || undefined, changes: r.changes || r.unknown || undefined }
    if (attack) plan.attack = true
    if (r.confirm && !r.unknown) plan.confirm = this.label(r.confirm, target, instrument)
    const e = this.entity(target)
    if (e && this.w.hasTag(e, 'container') && r.rules.includes('core/open-close')) plan.panel = e.id
    return plan
  }

  /** A key's plan on a spot: on the layer given (a left click on one's own place is on oneself). */
  private planAt(key: Key, at: Pos, stack: Ref[] | undefined, layer: number): Plan | undefined {
    const w = this.w
    const me = w.player
    const pos = w.posOf(me)
    if (key === 'self' || (key === 'use' && pos && at.x === pos.x && at.y === pos.y)) return pos ? this.planOn(key === 'use' ? 'self' : key, pos, { e: me.id }) : undefined
    const ref = this.targets(at, stack)[layer]
    return ref ? this.planOn(key, at, ref) : undefined
  }

  /**
   * A key's plan at the aim: on the top layer, or on the one the player picked (the chooser).
   * What the rule library does not define there is an experiment: its outcome is the AI's to say.
   * Every layer is reachable through the chooser (design.md §5.2, completeness).
   */
  plan(key: Key, aim?: Aim, layer = 0): Plan | undefined {
    const a = this.aim(aim, key)
    if (!a) return undefined
    const p = this.planAt(key, a.at, a.stack, layer)
    // E with no spot pointed at (or the pointer beyond reach): the spot in front or toward the
    // pointer — unless what is there has no answer of its own and what one stands on has one (the
    // bed one lies on, a place of the overworld)
    if (key === 'hands' && layer === 0 && !a.pointed && (!p || p.unknown)) {
      const pos = this.w.posOf(this.w.player)
      const own = pos && this.planAt(key, pos, undefined, 0)
      if (own && !own.unknown) return own
    }
    return p
  }

  /** The chooser's list: every layer at the aim the key reaches, with what it would do there. */
  choices(key: Key, aim?: Aim): { layer: number; name: Text; plan?: Plan }[] {
    const a = this.aim(aim, key)
    if (!a) return []
    if (key === 'self') return [{ layer: 0, name: this.label('{target}', { e: this.w.state.player }), plan: this.planAt(key, a.at, a.stack, 0) }]
    return this.targets(a.at, a.stack)
      .map((ref, layer) => ({ layer, name: this.label('{target}', ref), plan: this.planOn(key, a.at, ref) }))
      .filter((c) => c.plan)
  }

  // ---------------------------------------------------------------- running

  /** The attack key: a blow in the facing direction (the engine's cooldown paces a held key). */
  strike(): void {
    if (this.eng.busy(this.w.player)) return
    this.eng.playerAttack()
  }

  /** Run a plan: a blow, or the act (unless it must ask first). Returns the container to open, if any. */
  run(plan: Plan, confirmed = false, facing?: Dir): { panel?: Id } {
    const eng = this.eng
    const w = this.w
    const p = w.player
    if (eng.busy(p)) return {}
    this.face(plan.at)
    // the build palette's turn (R): one faces that way setting it down (stairs go up that way)
    if (facing) p.facing = facing
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
    eng.act(plan.verb!, p.id, plan.target, { instrument: plan.instrument ?? null })
    this.sync()
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

  /** The inventory's context menu: a key's act on an item in the bag (or in an open chest). */
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
    this.hand(() => this.syncSlots())
    this.eng.settle()
  }

  private syncSlots(): void {
    const w = this.w
    const p = w.player
    const slots = (p.slots ??= Array(this.slotCount()).fill(null))
    while (slots.length < this.slotCount()) slots.push(null)
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
        } else this.posture(held, { on: 'inside', holder: p.id }) // it belongs elsewhere; the hand takes the selected stack below
      }
    }
    for (let i = 0; i < slots.length; i++) if (slots[i] && !by.has(slots[i]!)) slots[i] = null
    const here = w.posOf(p)
    for (const [k, items] of by) {
      if (slots.includes(k)) continue
      const free = slots.indexOf(null)
      if (free >= 0) slots[free] = k
      else if (here) for (const e of items) this.posture(e, { on: 'tile', ...here })
    }
    // the hand holds one of the selected stack (or nothing)
    const want = slots[p.selected]
    const inHand = w.get(p.held)
    if (inHand && (!want || this.key(inHand) !== want)) this.posture(inHand, { on: 'inside', holder: p.id })
    if (want && !w.get(p.held)) {
      const next = (this.carried().get(want) ?? [])[0]
      if (next && !next.frozenBy) this.posture(next, { on: 'hand', holder: p.id })
    }
  }

  /** The actor's own posture: a thing between its hand and its bag (its relation changes; settle follows). */
  private posture(e: Entity, to: Place): void {
    this.eng.touch({ e: e.id })
    this.w.place(e, to)
    this.eng.touch({ e: e.id })
  }

  /** The hand puts its item back in the bag (before the slots are rearranged or another is chosen). */
  private stow(): void {
    const w = this.w
    const p = w.player
    const h = w.get(p.held)
    if (h && !h.frozenBy) this.hand(() => this.posture(h, { on: 'inside', holder: p.id }))
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

  /** Tab: the next row of the bag becomes the toolbar (Shift+Tab: the last row). The selected column stays. */
  nextRow(dir: 1 | -1 = 1): void {
    const p = this.w.player
    const slots = p.slots ?? []
    if (this.eng.busy(p)) return
    this.stow()
    const n = dir === 1 ? ROW : slots.length - ROW
    p.slots = [...slots.slice(n), ...slots.slice(0, n)]
    this.sync()
  }

  /** Shift+click in the menu: a stack moves between the toolbar and the rest of the bag, to the first free slot there. */
  quickMove(i: number): void {
    const slots = this.w.player.slots
    if (!slots?.[i]) return
    const [from, to] = i < ROW ? [ROW, slots.length] : [0, ROW]
    for (let j = from; j < to; j++) if (!slots[j]) return this.swap(i, j)
  }

  /** Move or swap two slots (the inventory menu). */
  swap(a: number, b: number): void {
    const slots = this.w.player.slots
    if (!slots || a === b || a < 0 || b < 0 || a >= slots.length || b >= slots.length) return
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
    p.slots = [...keys, ...Array(this.slotCount() - keys.length).fill(null)]
    if (held) p.selected = Math.min(ROW - 1, p.slots.indexOf(held)) === p.slots.indexOf(held) ? p.slots.indexOf(held) : p.selected
    this.sync()
  }

  /** Drop a slot's stack (or one of it) in front of the player, or at their feet when that is blocked (the menu's Drop): an act of putting each. */
  drop(i: number, all = true): void {
    const w = this.w
    const p = w.player
    const k = p.slots?.[i]
    const here = w.posOf(p)
    if (!k || !here) return
    const front = w.front(p)
    const to = front && w.inBounds(front.map, front.x, front.y) && !w.blocked(front.map, front.x, front.y, undefined, front.z) ? front : here
    const items = this.carried().get(k) ?? []
    // put on the cell: on what is on top of it there
    const onto = w.cellTop(to.map, to.x, to.y, to.z)
    if (!onto) return
    for (const e of all ? items : items.slice(0, 1)) if (!e.frozenBy) this.eng.act('put', p.id, { e: onto.id }, { instrument: { e: e.id } })
    this.sync()
  }

  /** The chest panel: move one or all of a stack between the bag and an open container — acts of taking and putting. */
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
      if (from === 'chest') eng.act('take', p.id, { e: e.id }, { instrument: null })
      else eng.act('put', p.id, { e: box.id }, { instrument: { e: e.id } })
    }
    this.sync()
  }

  /** The bag's slots: three rows, and one more for each `bagRows` (the skill). */
  slotCount(): number {
    return SLOT_COUNT + ROW * Math.max(0, this.w.num(this.w.player, 'bagRows'))
  }

  // ---------------------------------------------------------------- the skill tree

  /**
   * Take up a profession at a trainer (level 5, a trainer within reach): an act of learning it.
   * Changing gives back the profession branch's points. Returns why not, or undefined when done.
   */
  takeProfession(def: ProfessionDef | undefined, skills: SkillDef[]): ProfessionRefusal | undefined {
    const w = this.w
    const p = w.player
    const why = cannotChoose(w, p, def)
    const n = (t: Text) => (typeof t === 'string' ? { en: t, zh: t } : { en: t.en, zh: t.zh ?? t.en })
    if (why === 'level') w.fx.push({ t: 'log', text: { en: `Come back at level ${PROFESSION_LEVEL}.`, zh: `等你到 ${PROFESSION_LEVEL} 级再来。` }, tone: 'warn' })
    if (why === 'trainer') w.fx.push({ t: 'log', text: { en: 'Only a trainer can set you on a profession.', zh: '只有职业导师能为你选定职业。' }, tone: 'warn' })
    if (why || !def || this.eng.busy(p)) return why
    const had = w.prop(p, 'profession')
    const points = w.num(p, 'skillPoints')
    for (const s of skills) this.eng.skills.set(s.id, s)
    this.eng.professions.set(def.id, def)
    this.eng.act('learn', p.id, { e: p.id }, { instrument: null, params: { profession: def.id } })
    if (w.prop(p, 'profession') !== def.id) return 'unknown'
    const back = w.num(p, 'skillPoints') - points
    const name = n(def.name)
    w.fx.push({ t: 'log', text: { en: `You are now a${/^[aeiou]/i.test(name.en) ? 'n' : ''} ${name.en}.${back ? ` ${back} skill points given back.` : ''}`, zh: `你成为了${name.zh}。${back ? `返还了 ${back} 技能点。` : ''}` }, tone: 'good' })
    if (had) w.fx.push({ t: 'log', text: { en: 'Your old profession\'s skills are unlearned: spend the points again in the skill tree (K).', zh: '原职业的技能已重置：在技能树（K）里重新加点吧。' } })
    this.sync()
    return undefined
  }

  /** Spend skill points on a skill: an act of learning it. */
  learn(def: SkillDef): boolean {
    const w = this.w
    const p = w.player
    // what the panel offers is what can be learned now (as the crafting panel offers what can be made)
    if (this.eng.busy(p) || cannotLearn(p, def, w.prop(p, 'profession'))) return false
    this.eng.skills.set(def.id, def)
    this.eng.act('learn', p.id, { e: p.id }, { instrument: null, params: { skill: def.id } })
    if (!skillsOf(p).includes(def.id)) return false
    const n = typeof def.name === 'string' ? { en: def.name } : def.name
    w.fx.push({ t: 'log', text: { en: `Learned ${n.en}.`, zh: `学会了${n.zh ?? n.en}。` }, tone: 'good' })
    this.sync()
    return true
  }

  // ---------------------------------------------------------------- crafting

  /** How many of a type the player carries (bag and hand). */
  count(type: string): number {
    let n = 0
    for (const items of this.carried().values()) for (const e of items) if (e.type === type && !e.frozenBy) n++
    return n
  }

  canCraft(r: Recipe): boolean {
    const p = this.w.player
    const carried = [p.held, ...(p.contents ?? [])].map((id) => this.w.get(id)).filter((e): e is Entity => !!e && !e.frozenBy)
    return r.needs.every((n) => this.count(n.type) >= n.count) && (r.tools ?? []).every((tag) => carried.some((e) => this.w.hasTag(e, tag)))
  }

  /** The crafting panel: an act of crafting (the recipe's needs are used up, what it makes goes into the bag). */
  craft(r: Recipe): boolean {
    const p = this.w.player
    if (this.eng.busy(p) || !this.canCraft(r)) return false
    this.stow()
    this.eng.recipes.set(r.id, r)
    this.eng.act('craft', p.id, { e: p.id }, { instrument: null, params: { recipe: r.id } })
    this.sync()
    return true
  }

  // ---------------------------------------------------------------- setting built things down (the build palette)

  /** A carried thing the build palette sets down instead of what is in hand (only while it plans). */
  private using?: Id

  /** What one sets down in a cell as part of a place: a built thing or a fixture (a wall, a door, a bed, a workbench). */
  static placeable(type: string): boolean {
    return type.startsWith('structure/') || type.startsWith('fixture/')
  }

  /** A carried thing of a type (the hand's last, so what is held stays in hand while there are others). */
  private carriedOf(type: string): Entity | undefined {
    const p = this.w.player
    const all = [...(p.contents ?? []), ...(p.held ? [p.held] : [])].map((id) => this.w.get(id)).filter((e): e is Entity => !!e && e.type === type && !e.frozenBy)
    return all[0]
  }

  /** The recipe that makes a type (by hand or at a station), if any. */
  private recipeFor(type: string): Recipe | undefined {
    return [...this.eng.recipes.values()].find((r) => r.make.type === type)
  }

  /** G with this thing held, at the aim: the put it would be. */
  private planPut(thing: Id, aim: Aim): Plan | undefined {
    this.using = thing
    try {
      return this.plan('put', aim)
    } finally {
      this.using = undefined
    }
  }

  /**
   * The build palette's preview of setting a type down at the aim: one carried is set down (G's own
   * act); with none, one is made from what is carried first, if it can be. Never asked: putting is physics.
   */
  previewPlace(type: string, aim: Aim): { ok: boolean; reason: Text; carried: number } {
    const carried = this.count(type)
    const thing = this.carriedOf(type)
    if (thing) {
      // the palette sets it down where it is aimed, or not at all (a pointer beyond reach is not moved nearer)
      const plan = this.planPut(thing.id, aim)
      return plan && plan.at.x === aim.x && plan.at.y === aim.y ? { ok: true, reason: plan.label, carried } : { ok: false, reason: { en: 'It cannot go there.', zh: '这里放不下。' }, carried }
    }
    const r = this.recipeFor(type)
    if (!r) return { ok: false, reason: { en: 'You carry none.', zh: '身上没有。' }, carried }
    if (!this.canCraft(r)) return { ok: false, reason: { en: 'You carry none, nor what makes one.', zh: '身上没有，材料也不够做一个。' }, carried }
    // what one made would go where any thing set down goes: within reach, and to a storey there with
    // room for it and something to hold it (a wall on a wall, a floor over walls) — asked of the
    // world with a thing that is not in it
    const w = this.w
    const pos = w.posOf(w.player)
    const reach = w.onto.data.params?.carry ?? 1
    const probe = { id: '~place', type, place: { on: 'none' } } as Entity
    const near = !!pos && Math.max(Math.abs(aim.x - pos.x), Math.abs(aim.y - pos.y)) <= reach && !(aim.x === pos.x && aim.y === pos.y && w.onto.resolve(type).solid)
    const open = !!pos && w.inBounds(pos.map, aim.x, aim.y) && w.settleZ(probe, pos.map, aim.x, aim.y, pos.z ?? 0) !== undefined
    return near && open ? { ok: true, reason: { en: 'Made from what you carry, then set down', zh: '用身上的材料现做一个，再放下' }, carried } : { ok: false, reason: { en: 'It cannot go there.', zh: '这里放不下。' }, carried }
  }

  /** Set a type down at the aim (the build palette): one carried, or one made from what is carried first; facing a way (stairs go up it). */
  place(type: string, aim: Aim, facing?: Dir): boolean {
    if (this.eng.busy(this.w.player) || !this.previewPlace(type, aim).ok) return false
    if (!this.carriedOf(type)) {
      const r = this.recipeFor(type)
      if (!r || !this.craft(r)) return false
    }
    const thing = this.carriedOf(type)
    const plan = thing && this.planPut(thing.id, aim)
    if (!plan || plan.at.x !== aim.x || plan.at.y !== aim.y) return false
    this.run(plan, false, facing)
    return true
  }

  /** Make it again and again while what it needs is carried (the crafting panel's "all"): how many times. */
  craftAll(r: Recipe, most = 99): number {
    let n = 0
    while (n < most && this.craft(r)) n++
    return n
  }

  // ---------------------------------------------------------------- the magnet

  /** Dropped items within MAGNET tiles fly into the bag while there is room: an act of taking each, quietly. */
  magnet(): void {
    const w = this.w
    const p = w.player
    const here = w.posOf(p)
    if (!this.magnetic || !here || this.eng.busy(p)) return
    const by = this.carried()
    let free = (p.slots ?? []).filter((s) => !s).length
    let took = false
    // a longer reach (the skill) adds `magnet` tiles
    const reach = MAGNET + w.num(p, 'magnet')
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        for (const e of w.entitiesAt(here.map, here.x + dx, here.y + dy, here.z)) {
          if (!e.dropped || e.frozenBy || !w.isPortable(e)) continue
          const k = this.key(e)
          if (!by.has(k)) {
            if (free <= 0) continue
            free--
            by.set(k, [e])
          }
          const r = w.onto.resolve(e.type)
          w.fx.push({ t: 'pickup', item: e.id, sprite: r.sprite ?? e.type, name: e.name ?? r.name ?? { en: e.type }, map: here.map, x: here.x + dx, y: here.y + dy })
          this.eng.act('take', p.id, { e: e.id }, { instrument: null, params: { quiet: true, into: 'contents' }, reach })
          took = true
        }
    if (took) this.sync()
  }
}
