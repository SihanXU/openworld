// The player's controls (design.md §5.2–5.3): four inputs, each one meaning, so every act the rule
// library can answer is reachable (completeness):
// - E, **the hand**: what lies loose (an item; a built thing come loose, `World.isLoose`) is picked up,
//   `take`; anything else is handled, `hands` (talk, open, read, wake, sleep, pick a ripe crop) — as far as
//   the target lets a hand reach it (its `handsRange`: 0, standing on it, a bed; 1, beside it, by default);
//   what is another's is taken only once asked (a theft);
// - G, **put**: the held thing put down, in or on a thing, or handed to someone — within the world's
//   `carry` (the cells round); physics, never asked, offered only where it would change something; a built
//   thing put down lies loose: G never builds;
// - left click, **the held thing's own use** (`primary`): a tool or a weapon swung at what the pointer is on
//   (a blow, a tool's work: chop, mine, till — and a tool knocks a built thing loose); nothing held, the
//   main hand's weapon or the fist; anything else held is used on oneself (eat, drink, put on);
// - right click, **use on what is aimed at** (`secondary`): the held thing used on the target, `use` (sow,
//   feed, unlock, cook, and the experiments the world has never seen); on oneself, used on oneself; a built
//   thing in hand is set up there (it builds); nothing held, nothing.
// E and G never take oneself for their target: on one's own place they meet what is there.
// An input points at a spot on the map. Whatever is drawn there is a layer of it, top first (a
// person, a thing on a table, the table, the canopy of a tree behind them, the ground): a press
// acts on the top one, the chooser (Alt with a click, a long press of a key) on any of them. A spot is
// within reach when any input can act there; where none can, the keys act on the place in front.
// Only the view knows what is drawn where, so it hands the stack over with the aim. Each
// input makes an act (design.md §5.7) the engine itself holds to its reach, for anyone; its label
// is a dry run of the chain the act starts, marked unknown where that chain reaches an undefined
// outcome. Also here: the inventory's slots (row 1 is the toolbar, the selected slot is what is
// held), the magnet that pulls dropped items in, crafting, and the yes/no question asked before
// sleeping or eating (the host stops time while it is open).

import { isPatch, isRoot } from './rules.ts'
import { categoryOf } from './quality.ts'
import { oldStackKey, splitStacks, stackKey } from './stacks.ts'
import { parseCellId } from './cells.ts'
import type { Engine } from './engine.ts'
import { NO_EXPIRY, isBuilt, type Writer } from './world.ts'
import { FIGHT_TICKS, type Aim, type Dir, type Entity, type Id, type LessonInput, type Place, type Plan, type Pos, type PropValue, type Recipe, type Ref, type SkillDef, type Text, type Verb } from './types.ts'
import { cannotLearn, skillsOf } from './progression.ts'
import { OFFHAND, isTool, weaponOf } from './blows.ts'

/** The inputs (design.md §5.2): the acts' own (a plan's key), and the two clicks that make one of them: the left's `primary`, the right's `secondary`. */
export type Key = Plan['key'] | 'primary' | 'secondary'

/** Slots per row (the toolbar is row 1) and in all: three rows, Stardew's bag. */
export const ROW = 10
export const SLOT_COUNT = 30
/** Dropped items within this many tiles fly into the bag (Stardew: 128 px, two tiles). */
export const MAGNET = 2
/** The most the magnet pulls in one tick: a pile flies in over a few ticks, never in one long stall (each is an act of taking). */
export const MAGNET_PER_TICK = 25

const isWeapon = (type: string) => type.startsWith('item/weapon/')
const textEn = (t: Text) => (typeof t === 'string' ? t : t.en)
const textZh = (t: Text) => (typeof t === 'string' ? t : t.zh ?? t.en)

/**
 * What an input does where no rule says (the labels are the rules' own: a rule, or one of its
 * answers, says what an input ending there does — world-model.md; a patch says it too).
 */
const GENERIC: Record<string, Text> = {
  use: { en: 'Use {instrument} on {target}', zh: '把{instrument}用在{target}上' },
  self: { en: 'Use {instrument} on yourself', zh: '对自己用{instrument}' },
  selfAsk: { en: 'Use {instrument} on yourself?', zh: '对自己用{instrument}？' },
  build: { en: 'Build {instrument} here', zh: '把{instrument}建在这里' },
  putLoose: { en: 'Put {instrument} down loose', zh: '把{instrument}散放在这里' },
  stealAsk: { en: 'Steal {target}?', zh: '偷走{target}？' },
  // a blow on someone friendly is asked first, as a use on oneself is (a slip of the finger is not a blow)
  attackAsk: { en: 'Attack {target}?', zh: '攻击{target}？' },
  hands: { en: 'Interact with {target}', zh: '与{target}互动' },
  put: { en: 'Put {instrument} on {target}', zh: '把{instrument}放到{target}上' },
  take: { en: 'Take {target}', zh: '拿起{target}' },
  attack: { en: 'Strike {target} with {instrument}', zh: '用{instrument}打{target}' },
  steal: { en: 'Steal {target}', zh: '偷走{target}' },
  punch: { en: 'Punch {target}', zh: '一拳打向{target}' },
  cast: { en: 'Cast {instrument}', zh: '施放{instrument}' },
}

/** The chooser's layer for the ceiling over the spot (docs/building.md §5): never a default. */
export const CEILING = -1
const CEILING_NAME: Text = { en: 'The ceiling', zh: '天花板' }
const LAY_CEILING: Text = { en: 'Lay the ceiling', zh: '铺天花板' }
/** Why a thing cannot be set down there (World.settleWhy), as the palette says it. */
const REFUSAL: Record<'taken' | 'floored' | 'ground' | 'stairs' | 'unheld', Text> = {
  taken: { en: 'Something is there already.', zh: '这里已经有东西了。' },
  floored: { en: 'There is a floor there already.', zh: '这里已经有地板了。' },
  ground: { en: 'A floor cannot be laid on this ground.', zh: '这种地面上铺不了地板。' },
  stairs: { en: 'Stairs keep the storey over them open.', zh: '楼梯上方要留空。' },
  unheld: { en: 'Nothing would hold it up.', zh: '没有东西托得住它。' },
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
   * pointer, the place in front — the keyboard alone plays. Use on oneself (`self`) is always on oneself.
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
    return (['hands', 'take', 'put', 'use'] as const).some((k) => this.planAt(k, here, at.stack))
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
  /** The ground: a cell's terrain, or a floor laid there (what a hand on it only touches). */
  ground(r: Ref): boolean {
    const e = this.w.get(r.e)
    return e ? this.w.isTerrain(e) || this.w.spacesOf(e).includes('floor') : !!parseCellId(r.e)
  }

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
    // and what lies on a thing comes before the thing, however small it is drawn: the pointer on a cart
    // beside the wand laid on it meets the wand (the cart is next, as the ground is under the stone)
    const under = new Set(bodies.length || loose.length ? [...ground, ...structures].map((e) => e.id) : [])
    let out: Ref[] = stack ? [...stack.filter((r) => !own(r) && !under.has(r.e)).map(cellOf).filter(ok), ...standing] : standing
    // a bird overhead is the last thing the keys meet (it is drawn on top, but rarely what is meant)
    const aloft = (r: Ref) => 'e' in r && !!w.get(r.e) && w.hasTag(w.get(r.e)!, 'airborne')
    out = [...out.filter((r) => !aloft(r)), ...out.filter(aloft)]
    out.push(...made.map((e) => ({ e: e.id })))
    // above the ground, a cell with no floor laid is open air: what one sets a floor in (docs/building.md)
    if (!made.length && storey > 0 && w.get(w.cellRef(at.map, at.x, at.y, storey).e)) out.push(w.cellRef(at.map, at.x, at.y, storey))
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
    // a label is said to the one at the keys: aimed at them, it is "yourself" ("Bandage yourself")
    const whom = (l: 'en' | 'zh') => ('e' in target && target.e === me.e ? (l === 'zh' ? '自己' : 'yourself') : this.eng.nameOf(target, l))
    const fill = (s: string, l: 'en' | 'zh') => s.replace('{target}', whom(l)).replace('{instrument}', this.eng.nameOf(instrument, l)).replace('{actor}', this.eng.nameOf(me, l))
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

  /** The layers an input meets at a spot: oneself is never one (one's own place is what is there); the open air only F and G meet. */
  private targets(at: Pos, stack?: Ref[], key?: Plan['key']): Ref[] {
    const me = this.w.state.player
    // the open air only F and G meet, and the left click with a built thing in hand (it builds there)
    const air = key === 'put' || key === 'take' || (key === 'use' && this.buildsInHand())
    const layered = this.layers(at, stack).filter((r) => r.e !== me && (air || !this.w.isAir(this.w.get(r.e))))
    // the hands (E) meet whoever is there first: a person or a creature before what is drawn over them, then a companion
    // (an actor whose `companion` prop names a leader, companion.ts) — a bird overhead is the last layer (layers()), but
    // one reaches for the fairy to speak to her, not for the grass under her — then the rest in their layers' order.
    // The other keys keep the layers' order (F takes what lies there, the left click strikes what is drawn on top).
    let all = layered
    if (key === 'hands') {
      const friend = (r: Ref) => typeof this.w.get(r.e)?.props?.companion === 'string'
      const person = (r: Ref) => { const e = this.w.get(r.e); return !!e && this.w.isAgent(e) && !friend(r) && !this.w.hasTag(e, 'airborne') }
      all = [...layered.filter(person), ...layered.filter(friend), ...layered.filter((r) => !friend(r) && !person(r))]
    }
    // what another cell draws over the point but stands beyond the key's reach (a farther tree's
    // crown over the tree beside one) is not what the key meets: the next layer is. What stands on
    // the spot itself stays, reached or not (a bed pointed at from beside it is not its floor).
    if (!key || key === 'self') return all
    const held = this.bare ? undefined : this.w.player.held
    const elsewhere = (r: Ref) => { const p = this.w.refPos(r); return !!p && (p.x !== at.x || p.y !== at.y) }
    return all.filter((r) => !elsewhere(r) || this.reaches(key, r, key === 'use' && held ? { e: held } : undefined))
  }

  /** The spot aimed at itself, on one's own storey (no step back toward oneself). */
  private spot(aim?: { x: number; y: number }): Pos | undefined {
    const pos = this.w.posOf(this.w.player)
    return aim && pos ? { ...pos, x: aim.x, y: aim.y } : undefined
  }

  /** The ceiling over a spot: the floor of the storey above, laid or open air (docs/building.md §3). */
  private ceilingOf(at: Pos): Ref {
    const z = (at.z ?? this.w.posOf(this.w.player)?.z ?? 0) + 1
    return this.w.cellRef(at.map, at.x, at.y, z)
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
  private planOn(key: Plan['key'], at: Pos, target: Ref, chosen = false): Plan | undefined {
    const w = this.w
    const p = w.player
    // the thing in hand — or the one the build palette sets down from the bag; none for the left click's blow (`bare`)
    const held = this.bare ? undefined : this.using ? { e: this.using } : p.held ? { e: p.held } : undefined
    const heldE = this.entity(held)
    // the hand (E) on what lies loose picks it up, and on someone, sneaking, takes hold of them (their pockets, as
    // Skyrim's sneak and activate); on anything else it handles it
    if (key === 'hands') {
      const sneaking = this.talksTo(target) && w.hasStatus({ e: p.id }, 'sneaking')
      if (this.isLoose(target) || sneaking) return this.planOn('take', at, target, chosen)
      return this.reaches('hands', target) ? this.make(key, at, 'hands', target, undefined) : undefined
    }
    if (key === 'take' || key === 'put') {
      if (key === 'put' && !held) return undefined
      if (!this.reaches(key, target, held)) return undefined
      // what the rules say is checked against where the thing would rest (docs/building.md R2–R5): set
      // on a cell or a built thing, it rests on that storey or nowhere; a floor something rests on stays
      const t = this.entity(target)
      const there = t && w.posOf(t)
      if (key === 'put' && heldE && t && there && (w.isTerrain(t) || w.hasTag(t, 'structure')) && w.settleWhy(heldE, there.map, there.x, there.y, there.z ?? 0)) return undefined
      if (key === 'take' && t && w.bears(t)) return undefined
      const plan = this.make(key, at, key, target, key === 'put' ? held : undefined)
      // a built thing put down on a cell lies loose (it is not built so): the label says which
      if (key === 'put' && plan.sets && heldE && isBuilt(heldE.type) && w.isPortable(heldE)) plan.label = this.label(GENERIC.putLoose, target, held)
      return plan.changes ? plan : undefined
    }
    // use (and self: use on oneself): the held thing — a blow for weapons on creatures (and pure
    // weapons on anything but people); with nothing held, a blow on anything: with the weapon kept in
    // the main hand, else the bare body. A blow on oneself only when chosen (the chooser): a press never
    // strikes the one at the keys (a click on one's own place with nothing to use there does nothing).
    const pressedOnSelf = target.e === p.id && !chosen
    const main = heldE ? undefined : weaponOf(w, p)
    const reach = this.eng.reachOf('use', p, this.entity(target), heldE ?? main) ?? 1
    const here = w.posOf(p)
    const there = w.posOf(this.entity(target))
    // a blow from afar flies along a row or a column (a bolt, an arrow)
    const aligned = !here || !there || here.x === there.x || here.y === there.y
    if (!this.reaches('use', target, held ?? (main && { e: main.id }))) return undefined
    if (heldE) {
      const pure = isWeapon(heldE.type) && !w.hasTag(heldE, 'tool:axe') && !(heldE.tags ?? []).some((g) => g.startsWith('tool:'))
      // a person is struck by the right click only with the blade drawn (X: the blow is meant, docs/npc-sandbox.md);
      // the left click's swing is a blow on them either way (someone friendly is asked first: make)
      const drawn = w.hasStatus({ e: p.id }, 'drawn')
      const blow = isWeapon(heldE.type) && (this.isPerson(target) ? drawn || this.swinging : pure || this.isCreature(target))
      if (blow && (pressedOnSelf || (reach > 1 && !aligned))) return undefined
      const plan = this.make(key, at, 'use', target, held, blow, blow ? (heldE.type.startsWith('item/weapon/magic/') ? GENERIC.cast : GENERIC.attack) : undefined)
      // a built thing set up is checked against where it would rest, as G's put is (docs/building.md R2–R5): set up
      // on a cell or a built thing, it stands on that storey or nowhere; where nothing would change, it is not offered
      if (plan.sets) {
        const t = this.entity(target)
        const there = t && w.posOf(t)
        if (!plan.changes || (t && there && (w.isTerrain(t) || w.hasTag(t, 'structure')) && w.settleWhy(heldE, there.map, there.x, there.y, there.z ?? 0))) return undefined
        // (laid in the ceiling, the floor's own label says so)
        if ((there?.z ?? 0) <= (w.posOf(p)?.z ?? 0)) plan.label = this.label(GENERIC.build, target, held)
      }
      // a weapon that is not one's to fight with (another profession's): its blow is refused, and the label says so
      const why = blow ? this.eng.combat.refuses(p, heldE, 'aim') : undefined
      if (why) (plan.label = why), delete plan.confirm
      return plan
    }
    if (pressedOnSelf || (reach > 1 && !aligned)) return undefined
    const plan = main ? this.make(key, at, 'use', target, { e: main.id }, true, main.type.startsWith('item/weapon/magic/') ? GENERIC.cast : GENERIC.attack) : this.make(key, at, 'use', target, undefined, true, GENERIC.punch)
    // a press with nothing in hand on the bare ground the world has never seen struck (a fist on grass)
    // makes nothing: a click in passing asks nothing (the chooser still strikes it, design.md §5.2)
    if (!chosen && plan.unknown && this.ground(target)) return undefined
    const why = main && this.eng.combat.refuses(p, main, 'aim')
    if (why) (plan.label = why), delete plan.confirm
    return plan
  }


  /** The rule that answers: the deepest one of the chain that belongs to a host (the receiver's answer, not the root that passed it on). */
  private telling(rules: string[]): string | undefined {
    return [...rules].reverse().find((id) => { const r = this.eng.lib.rules.get(id); return r && !isRoot(r) }) ?? rules[0]
  }

  private make(key: Plan['key'], at: Pos, verb: Verb, target: Ref, instrument: Ref | undefined, attack = false, fallback?: Text): Plan {
    const r = this.dry(verb, target, instrument, attack ? { attack: true } : {})
    const generic = fallback ?? (key === 'self' ? GENERIC.self : GENERIC[verb] ?? GENERIC.use)
    const plan: Plan = { key, at, verb, target, instrument, rule: this.telling(r.rules), label: this.labelFor(r.labels, generic, target, instrument), unknown: r.unknown || undefined, changes: r.changes || r.unknown || undefined }
    if (attack) plan.attack = true
    // a learned answer in the chain: it filled a hole the base rules leave (only an undefined leaf consults one)
    if (r.rules.some((id) => { const x = this.eng.lib.rules.get(id); return !!x && isPatch(x) })) plan.learned = true
    // undefined, and the AI setting turns this kind of work off: the leaf's default comes, no one is asked (mod.ts)
    if (r.unknown && r.hole && this.eng.quality[categoryOf(this.w, { ...r.hole.ev, origin: 'player' })] === 'off') plan.quiet = true
    // what answers is a cell taking what is held: it is set down there
    if (!r.unknown && plan.rule && this.eng.lib.rules.get(plan.rule)?.on === 'impulse/receive') plan.sets = true
    if (r.confirm && !r.unknown) plan.confirm = this.label(r.confirm, target, instrument)
    // a blow, a use or a gift on someone friendly is asked first (a use or a gift in the words of its label: "Give the apple to
    // Hesper?", "Slip the apple into her pocket?"); a blow with the blade drawn (X) is meant, and never asks
    if (!plan.confirm && (verb === 'use' || verb === 'put') && this.friendly(target) && !(attack && this.w.hasStatus({ e: this.w.state.player }, 'drawn')))
      plan.confirm = attack ? this.label(GENERIC.attackAsk, target) : { en: `${textEn(plan.label)}?`, zh: `${textZh(plan.label)}？` }
    const e = this.entity(target)
    if (e && this.w.hasTag(e, 'container') && (r.rules.includes('core/open-close') || this.w.hasTag(e, 'remains'))) plan.panel = e.id
    // taking what is another's (docs/npc-sandbox.md §2.1): the label says it is a theft
    // taking what is another's (docs/npc-sandbox.md §2.1): the label says it is a theft, and it is asked first
    if (verb === 'take' && e && !this.w.isAgent(e) && !r.unknown && this.eng.society.isAnothers(e, this.w.player)) {
      plan.steal = true
      plan.label = this.label(GENERIC.steal, target)
      plan.confirm = this.label(GENERIC.stealAsk, target)
    }
    return plan
  }

  /** A thing lying loose on its cell (World.isLoose): what the hand picks up rather than handles. */
  private isLoose(r: Ref): boolean {
    const e = this.entity(r)
    return !!e && e.place.on === 'tile' && this.w.isLoose(e)
  }

  /**
   * A key's plan on a spot: on the layer chosen, or on the top one for a press (`layer` undefined); a left
   * click on one's own place is on oneself.
   */
  private planAt(key: Plan['key'], at: Pos, stack: Ref[] | undefined, layer?: number): Plan | undefined {
    const w = this.w
    const me = w.player
    const pos = w.posOf(me)
    const chosen = layer !== undefined
    // a built thing in hand used on one's own place is set up there, where it would stand with one (a bed under one)
    if (key === 'use' && pos && at.x === pos.x && at.y === pos.y && this.buildsInHand()) {
      const set = this.planOn('use', pos, this.w.cellRef(pos.map, pos.x, pos.y, pos.z ?? 0), chosen)
      if (set?.sets) return set
    }
    if (key === 'self' || (key === 'use' && pos && at.x === pos.x && at.y === pos.y)) return pos ? this.planOn(key === 'use' ? 'self' : key, pos, { e: me.id }, chosen) : undefined
    const list = this.targets(at, stack, key)
    const top = layer ?? 0
    const ref = list[top]
    // a built thing in hand pressed on what lies loose there is set up in that cell (a loose thing takes no room)
    if (key === 'use' && !chosen && ref && this.buildsInHand() && this.isLoose(ref)) {
      const set = this.planOn('use', at, w.cellRef(at.map, at.x, at.y, at.z ?? 0), chosen)
      if (set?.sets) return set
    }
    const plan = ref ? this.planOn(key, at, ref, chosen) : undefined
    // a flyer over the spot the key has nothing to do with is not in the way: the key goes on to
    // what is under it (G sets the wall down where the fairy hovers; E still talks to the fairy)
    const e = ref && this.w.get(ref.e)
    if (plan || top !== 0 || !e || !this.w.hasTag(e, 'airborne')) return plan
    for (const r of list.slice(1)) {
      const under = this.planOn(key, at, r, chosen)
      if (under) return under
    }
    return undefined
  }

  /**
   * A key's plan at the aim: a press on the top layer (`layer` undefined), or the layer the player chose
   * (the chooser). What the rule library does not define there is an experiment: its outcome is the AI's
   * to say. Every layer is reachable through the chooser (design.md §5.2, completeness); a press passes
   * over what only a choice makes (a blow on oneself, a fist on the bare ground the world has never seen struck).
   */
  plan(key: Key, aim?: Aim, layer?: number): Plan | undefined {
    // the right click: the held thing used on what is aimed at (nothing held, nothing)
    if (key === 'secondary') return this.w.player.held ? this.plan('use', aim, layer) : undefined
    // the left click: a press swings (or uses an object on oneself); a layer chosen is the swing's on that layer
    if (key === 'primary') return layer === undefined ? this.primary(aim) : this.swings() ? this.plan('use', aim, layer) : undefined
    const a = this.aim(aim, key)
    if (!a) return undefined
    // the ceiling, chosen (never a default): a floor laid in it, or a tool knocking it loose — the one drawn
    // at the point (the view's `over`), else over the spot aimed at itself (what is on one's own storey there
    // does not matter; the act's reach is the engine's)
    if (layer === CEILING) {
      const at = this.spot(aim && (aim.over ?? aim)) ?? a.at
      if (key !== 'use') return undefined
      if (this.buildsInHand()) return this.planOn(key, at, this.ceilingOf(at), true)
      // a tool knocks loose a ceiling laid there (never the open air), where it can come loose (nothing rests on it)
      const laid = this.w.get(this.ceilingOf(at).e)
      const knock = this.toolInHand() && laid && !this.w.isAir(laid) && !this.w.bears(laid) ? this.planOn(key, at, { e: laid.id }, true) : undefined
      return knock?.changes ? knock : undefined
    }
    const p = this.planAt(key, a.at, a.stack, layer)
    // E with no spot pointed at (or the pointer beyond reach): the spot in front or toward the
    // pointer — unless what is there has no answer of its own, or is only the ground touched, and
    // what one stands on has one that does something (the bed one lies on, a place of the
    // overworld; never the ground's "touched" itself)
    if (key === 'hands' && !layer && !a.pointed && (!p || p.unknown || (!p.changes && this.ground(p.target)))) {
      const pos = this.w.posOf(this.w.player)
      const own = pos && this.planAt(key, pos, undefined)
      // what one stands on answers even when its answer changes nothing (a place the story has not opened
      // says why), where in front there is only the ground
      if (own && !own.unknown && (own.changes || ((!p || this.ground(p.target)) && !this.ground(own.target)))) return own
    }
    return p
  }

  /**
   * The plan for a key pressed while its label named `shown`: one who walked off the spot since (a
   * person on their round, a creature) stays the target while the key still reaches them. What the
   * label said is what happens; a bread offered to the merchant is not set down where he stood.
   * A press of the bare hand that only touches the ground (E in front of nothing) does nothing: it
   * would say so at every step. The tip leaves it unsaid as well (ui/cursor.ts); the chooser still touches it.
   */
  planFor(key: Key, aim: Aim | undefined, layer?: number, shown?: Ref): Plan | undefined {
    const made = this.plan(key, aim, layer)
    const p = layer === undefined && made?.key === 'hands' && !made.unknown && !made.changes && this.ground(made.target) ? undefined : made
    if (!shown || !('e' in shown) || (p && 'e' in p.target && p.target.e === shown.e)) return p
    const e = this.w.get(shown.e)
    const at = e && this.w.isAgent(e) && e.id !== this.w.state.player ? this.w.posOf(e) : undefined
    if (!at) return p
    if (key === 'secondary') return (this.w.player.held && this.planOn('use', at, shown)) || p
    if (key === 'primary') {
      const q = this.primary({ x: at.x, y: at.y, stack: [shown] })
      return q && 'e' in q.target && q.target.e === shown.e ? q : p
    }
    return this.planOn(key, at, shown) || p
  }

  /** The chooser's list: every layer at the aim the key reaches, with what it would do there. */
  choices(key: Key, aim?: Aim): { layer: number; name: Text; plan?: Plan }[] {
    // the clicks choose as the use they make: the right one with anything held, the left one where it swings
    if (key === 'secondary') return this.w.player.held ? this.choices('use', aim) : []
    if (key === 'primary') return this.swings() ? this.choices('use', aim) : []
    const a = this.aim(aim, key)
    if (!a) return []
    const me = this.w.state.player
    const pos = this.w.posOf(this.w.player)
    const own = !!pos && a.at.x === pos.x && a.at.y === pos.y
    const named = (ref: Ref, layer: number, plan: Plan | undefined) => ({ layer, name: this.label('{target}', ref), plan })
    // use on one's own place is use on oneself (planAt): the one layer there, the blow too when nothing is held
    const list = key === 'self' || (key === 'use' && own) ? [named({ e: me }, 0, this.planAt(key, a.at, a.stack, 0))] : this.targets(a.at, a.stack, key).map((ref, layer) => named(ref, layer, this.planOn(key, a.at, ref, true)))
    // last, the ceiling over the spot: a floor laid in it, or knocked loose with a tool (docs/building.md §5)
    if (key === 'use' && (this.buildsInHand() || this.toolInHand())) list.push({ layer: CEILING, name: CEILING_NAME, plan: this.plan(key, aim, CEILING) })
    return list.filter((c) => c.plan)
  }

  // ---------------------------------------------------------------- the left click

  /** Planning the left click's blow with nothing in hand: the main hand's weapon, else the fist, strikes. */
  private bare = false
  /** Planning the left click's swing: a weapon swung at a person is a blow, drawn or not. */
  private swinging = false

  /** A tool or a weapon in hand (`isTool`, Stardew's line). */
  private toolInHand(): boolean {
    const held = this.w.get(this.w.player.held)
    return !!held && isTool(held.type)
  }

  /** The left click swings: a tool or a weapon in hand, or nothing (the main hand's weapon, the fist); an object is used on oneself instead. */
  private swings(): boolean {
    return !this.w.player.held || this.toolInHand()
  }

  /**
   * The left click (design.md §5.2): the held thing's own use. A tool or a weapon is swung at what the pointer
   * is on — a blow, a tool's work (chop, mine, till; a tool knocks a built thing loose) —; with nothing held,
   * the main hand's weapon or the fist strikes; anything else held is used on oneself, wherever one points (eat,
   * drink, put on), asked first where the world has never seen it (a stone used on oneself is an experiment,
   * not a slip of the finger). A swing lands on what is struck, top first — someone first (with nothing in
   * hand anyone, else someone one talks to: never the ground under them), never a loose thing lying there then —,
   * never on oneself; on someone friendly it is asked first unless the blade is drawn (X: the blow is meant,
   * docs/npc-sandbox.md; make). A tool swung where the world
   * has never seen it is an experiment, as any use is (a pickaxe at the grass asks the world); only the bare fist
   * on bare ground the world has never seen struck makes nothing (planOn). No chooser: Alt chooses.
   */
  private primary(aim?: Aim): Plan | undefined {
    const w = this.w
    const pos = w.posOf(w.player)
    const held = w.get(w.player.held)
    if (!pos) return undefined
    if (held && !isTool(held.type)) {
      const s = this.planOn('self', pos, { e: w.state.player })
      if (s?.unknown && !s.confirm) s.confirm = this.label(GENERIC.selfAsk, s.target, s.instrument)
      return s
    }
    const a = this.aim(aim, 'primary')
    if (!a || (a.at.x === pos.x && a.at.y === pos.y)) return undefined
    this.bare = !held
    this.swinging = true
    try {
      const struck = this.targets(a.at, a.stack, 'use').filter((r) => {
        const e = w.get(r.e)
        // the fist strikes bodies and what stands; a tool works on anything, a loose log split as a tree felled
        return !e || w.isAgent(e) || !!held || !w.isPortable(e)
      })
      // someone first: with nothing in hand any body, else someone one talks to (the fairy over the grass, not the grass)
      const bodies = struck.filter((r) => { const e = w.get(r.e); return !!e && w.isAgent(e) && (!held || this.talksTo(r)) })
      for (const r of [...bodies, ...struck.filter((r) => !bodies.includes(r))]) {
        const plan = this.planOn('use', a.at, r)
        if (plan) return plan
      }
      return undefined
    } finally {
      this.bare = false
      this.swinging = false
    }
  }

  /**
   * The left click's plan made at the pace of a swing: a blow at the attack's (Engine.playerAttack), a
   * tool's work at the same beat — so the button held works on as a held Space strikes. A use on oneself
   * is made at once.
   */
  swing(plan: Plan): { panel?: Id } {
    const p = this.w.player
    if (plan.attack || plan.key === 'self') return this.run(plan)
    if (!this.eng.ready('atk:' + p.id)) return {}
    const out = this.run(plan)
    this.eng.setCooldown('atk:' + p.id, this.eng.combat.delay(p, 5, 'attack'))
    return out
  }

  /**
   * The left click held: the swing it began again at the aim, as the swing's pace allows — a blow wherever
   * the aim meets one, or the same work (the rule that answered: one tree after another, a row of soil
   * tilled) — and only what the world knows and what changes something: holding the button never asks the
   * world anything, never asks first, and never undoes what it did (a bucket filled is not poured back).
   * A use on oneself is made once a press (one apple, not the bag's).
   */
  again(first: Plan, aim?: Aim): void {
    if (first.key === 'self') return
    const plan = this.plan('primary', aim)
    if (!plan || plan.key === 'self' || plan.unknown || plan.confirm || !plan.changes || !!plan.attack !== !!first.attack) return
    if (!plan.attack && plan.rule !== first.rule) return
    this.swing(plan)
  }

  /** May the keys make this act now? A lesson's gate asked without a refusal shown. */
  private permits(key: Plan['key']): boolean {
    const allow = this.eng.story.lesson()?.def.allow
    return !allow || allow.includes(key)
  }

  /**
   * Someone friendly to the one at the keys: someone to have a word with whom neither would attack now
   * (Engine.hostileTo: their foes, their factions and temper) and neither has struck in the last moments (a
   * villager who only runs from the blow is still in a fight with one) — data any actor carries.
   */
  private friendly(r: Ref): boolean {
    const e = this.entity(r)
    const me = this.w.player
    const tick = this.w.state.tick
    const struck = (a: Entity, by: Entity) => a.combat?.lastHurtBy === by.id && tick - (a.combat.lastHurtTick ?? -Infinity) < FIGHT_TICKS
    return !!e && this.talksTo(r) && !this.eng.hostileTo(e, me) && !this.eng.hostileTo(me, e) && !struck(e, me) && !struck(me, e)
  }

  /** Someone to have a word with: a person, or a companion (one whose `companion` prop names a leader, companion.ts). */
  talksTo(r: Ref): boolean {
    const e = this.entity(r)
    return !!e && e.id !== this.w.state.player && this.w.isAgent(e) && (this.isPerson(r) || typeof e.props?.companion === 'string')
  }

  // ---------------------------------------------------------------- running

  /** Answering a question: its plan passed the lesson's gate when it was asked. */
  private answering = false
  /** When a refusal was last shown (the key shakes once, not every tick a key is held). */
  private refused = -Infinity

  /**
   * May the keys do this now (docs/prologue.md, the drills)? A lesson at hand that names what works
   * lets nothing else; making and setting down only what it names (`only`), and that only where it
   * names (`cells`). A refusal is shown (the key shakes, the companion repeats the lesson). It is the
   * keys' own concern: which actor they move is never asked.
   */
  allows(input: LessonInput, what?: { type?: string; at?: { x: number; y: number } }): boolean {
    const l = this.eng.story.lesson()?.def
    if (!l?.allow) return true
    let ok = l.allow.includes(input)
    const named = !!what?.type && !!l.only?.includes(what.type)
    if (ok && l.only && what?.type && (input === 'craft' || input === 'build' || input === 'put' || input === 'use')) ok = named
    if (ok && named && l.cells && what?.at) ok = l.cells.some(([x, y]) => x === what.at!.x && y === what.at!.y)
    if (!ok && this.w.state.tick - this.refused >= 5) {
      this.refused = this.w.state.tick
      this.w.fx.push({ t: 'lesson', blocked: input })
    }
    return ok
  }

  /** The attack key: a blow in the facing direction (the engine's cooldown paces a held key). */
  strike(): void {
    if (this.eng.busy(this.w.player) || !this.allows('use')) return
    this.eng.playerAttack()
  }

  /** Run a plan: a blow, or the act (unless it must ask first). Returns the container to open, if any. */
  run(plan: Plan, confirmed = false, facing?: Dir): { panel?: Id } {
    const eng = this.eng
    const w = this.w
    const p = w.player
    // a lesson at hand: only what it teaches (setting a thing down, only that thing, only where it says)
    if (!this.answering && !this.allows(plan.key, plan.key === 'put' || plan.sets ? { type: this.entity(plan.instrument)?.type, at: plan.at } : undefined)) return {}
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
    // what was asked was let through the lesson's gate when it was asked
    this.answering = true
    try {
      if (yes) this.run(q.plan, true)
    } finally {
      this.answering = false
    }
  }

  /** The inventory's context menu: a key's act on an item in the bag (or in an open chest). */
  planOnItem(key: Plan['key'], item: Id): Plan | undefined {
    const w = this.w
    const pos = w.posOf(w.player)
    if (!pos || !w.get(item)) return undefined
    if (key === 'use' && w.player.held === item) return undefined
    return this.planOn(key, pos, { e: item }, true)
  }

  /** Use one specifically chosen carried item on the exact thing still held (a game's explicit inventory chooser). */
  useItemOnHeldItem(instrument: Id, target: Id): boolean {
    const w = this.w
    const p = w.player
    if (instrument === target || this.eng.busy(p) || !this.permits('use')) return false
    const carried = new Set([...(p.contents ?? []), ...(p.held ? [p.held] : [])])
    const tool = w.get(instrument)
    const onto = w.get(target)
    if (!tool || !onto || p.held !== target || !carried.has(instrument) || !carried.has(target) || tool.frozenBy || onto.frozenBy || !this.allows('use', { type: tool.type })) return false
    this.eng.act('use', p.id, { e: target }, { instrument: { e: instrument } })
    this.sync()
    return true
  }

  // ---------------------------------------------------------------- inventory slots

  /** What makes items the same stack (stacks.ts: a piece is one alone; a chest counts its slots by the same). */
  key(e: Entity): string {
    return stackKey(e)
  }

  /** What the player wears (its `wear:` props), whether or not it works for them now: it is on them, not in the bag. */
  wornIds(): Set<string> {
    const p = this.w.player
    return new Set(Object.entries(p.props ?? {}).flatMap(([k, id]) => (k.startsWith('wear:') && typeof id === 'string' ? [id] : [])))
  }

  /**
   * Every item the player carries (bag and hand), by stack key. `bag`: only what takes a bag slot — what is worn is on
   * the body (the equipment's own slots), not in the bag (nor in the hand: syncSlots lets go of it).
   */
  carried(bag = false): Map<string, Entity[]> {
    const w = this.w
    const p = w.player
    const worn = bag ? this.wornIds() : undefined
    const by = new Map<string, Entity[]>()
    for (const id of [...(p.contents ?? []), ...(p.held ? [p.held] : [])]) {
      const e = w.get(id)
      if (!e || worn?.has(id)) continue
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
   * `spare` (the magnet's): the selected slot only when no other is free, so what flies in mid-fight
   * never lands in an empty hand (a take, F's, lands in the hand itself: it is meant).
   */
  sync(spare = false): void {
    this.hand(() => this.syncSlots(spare))
    this.eng.settle()
    this.bagSig = this.bagNow()
  }

  private bagSig = ''
  private bagNow(): string {
    const p = this.w.state.player ? this.w.get(this.w.state.player) : undefined
    return p ? `${(p.contents ?? []).join(',')}|${p.held ?? ''}` : ''
  }

  /** What reached the bag without an input (a scene's gift, a reward, a trade someone else began) takes its slot (each tick). */
  keep(): void {
    const now = this.bagNow()
    if (now && now !== this.bagSig) this.sync()
  }

  private syncSlots(spare: boolean): void {
    const w = this.w
    const p = w.player
    const slots = (p.slots ??= Array(this.slotCount()).fill(null))
    while (slots.length < this.slotCount()) slots.push(null)
    p.selected ??= 0
    // what is worn is on the body: the hand lets go of it, and it takes no bag slot
    if (p.held && this.wornIds().has(p.held)) this.posture(w.get(p.held)!, { on: 'inside', holder: p.id })
    const by = this.carried(true)
    // a slot of an older save holds the key every piece of a kind once shared (all its axes one stack): the first
    // piece it now means takes that slot back, the others the free ones below
    for (let i = 0; i < slots.length; i++) {
      const k = slots[i]
      if (!k || by.has(k)) continue
      const heir = [...by.keys()].find((n) => !slots.includes(n) && oldStackKey(by.get(n)![0]!) === k)
      if (heir) slots[i] = heir
    }
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
      const other = spare ? slots.findIndex((s, i) => s === null && i !== p.selected) : -1
      const free = other >= 0 ? other : slots.indexOf(null)
      if (free >= 0) slots[free] = k
      else if (here) for (const e of items) this.posture(e, { on: 'tile', ...here })
    }
    // the hand holds one of the selected stack (or nothing)
    const want = slots[p.selected]
    const inHand = w.get(p.held)
    if (inHand && (!want || this.key(inHand) !== want)) this.posture(inHand, { on: 'inside', holder: p.id })
    if (want && !w.get(p.held)) {
      const next = (this.carried(true).get(want) ?? [])[0]
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
    if (i < 0 || i >= ROW || this.eng.busy(p) || !this.allows('select')) return
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
    const items = this.carried(true).get(k) ?? []
    // put on the cell: on what is on top of it there
    const onto = w.cellTop(to.map, to.x, to.y, to.z)
    if (!onto) return
    for (const e of all ? items : items.slice(0, 1)) if (!e.frozenBy) this.eng.act('put', p.id, { e: onto.id }, { instrument: { e: e.id } })
    this.sync()
  }

  /** The chest panel: move one or all of a stack between the bag and an open container — acts of taking and putting. */
  transfer(container: Id, from: 'chest' | 'bag', item: Id, all: boolean): void {
    for (const _ of this.transferSteps(container, from, item, all)) { /* synchronous callers finish the same acts */ }
  }

  /** The same transfer, yielding between acts so a host can keep its interface responsive. Closing the
   * iterator synchronizes the hand and leaves every unprocessed item at its current place. */
  *transferSteps(container: Id, from: 'chest' | 'bag', item: Id, all: boolean): Generator<{ done: number; total: number }, void> {
    const w = this.w
    const eng = this.eng
    const p = w.player
    const box = w.get(container)
    const it = w.get(item)
    if (!box || !it || !w.hasStatus({ e: box.id }, 'open')) return
    const k = this.key(it)
    const pool = from === 'chest' ? (box.contents ?? []).map((id) => w.get(id)!).filter((e) => e && this.key(e) === k) : this.carried(true).get(k) ?? []
    const chunks = from === 'chest' ? splitStacks(pool) : [pool]
    // A panel may still name the representative just moved; the remaining first slot is then its kind.
    const slot = chunks.find((s) => s.some((e) => e.id === item)) ?? chunks[0] ?? []
    const one = slot.find((e) => e.id === item) ?? slot[0]
    const items = all ? slot : one ? [one] : []
    if (!items.length) return
    try {
      yield { done: 0, total: items.length }
      for (const [i, e] of items.entries()) {
        if (!w.hasStatus({ e: box.id }, 'open') || box.place.on === 'none' || eng.busy(p)) return
        // Another input or a rule may have moved this item while the host yielded.
        const place = e.place
        if ((place.on === 'inside' || place.on === 'hand') && place.holder === (from === 'chest' ? box.id : p.id)) {
          if (from === 'chest') eng.act('take', p.id, { e: e.id }, { instrument: null })
          else eng.act('put', p.id, { e: box.id }, { instrument: { e: e.id } })
        }
        yield { done: i + 1, total: items.length }
      }
    } finally {
      this.sync()
    }
  }

  /**
   * A panel's offering (a game's panel that takes what one carries into a thing: a stock, a store): up to `count` of a
   * carried kind put into the thing, one act each, as the chest panel puts things into a chest; what it will not take
   * stays carried.
   */
  offer(target: Id, item: Id, count: number): void {
    const w = this.w
    const p = w.player
    const it = w.get(item)
    if (!it || !w.get(target) || this.eng.busy(p)) return
    const pool = this.carried(true).get(this.key(it)) ?? []
    for (const e of pool.slice(0, Math.max(0, count))) this.eng.act('put', p.id, { e: target }, { instrument: { e: e.id } })
    this.sync()
  }

  /**
   * What is worn (the inventory's equipment): put a carried thing on oneself — an act, as using it on
   * oneself is (`use/wear` → `body/wear`: a helmet on the head, a shield on the arm) — or take it off
   * (offered again, it comes off); with no item, what is worn in the off hand. `putOn`: from the bag, where a
   * thing already worn never comes off (each ring is a slot of its own: the second is put on from its own).
   */
  wear(item?: Id, putOn = false): void {
    const w = this.w
    const p = w.player
    const id = item ?? w.prop(p, OFFHAND)
    if (this.eng.busy(p) || typeof id !== 'string' || !w.get(id)) return
    if (putOn && w.worn(p).some((e) => e.id === id)) return
    this.eng.act('use', p.id, { e: p.id }, { instrument: { e: id } })
    this.sync()
  }

  /** The bag's slots: three rows, and one more for each `bagRows` (the skill). */
  slotCount(): number {
    return SLOT_COUNT + ROW * Math.max(0, this.w.num(this.w.player, 'bagRows'))
  }

  // ---------------------------------------------------------------- the people (docs/npc-sandbox.md)

  /** V and X: walk soft, or draw one's weapon (the input's own posture: a status the one at the keys keeps). */
  toggle(what: 'sneaking' | 'drawn', on?: boolean): boolean {
    const w = this.w
    const p = w.player
    if (this.eng.busy(p) || !w.onto.status(what)) return false
    const now = on ?? !w.hasStatus({ e: p.id }, what)
    this.hand(() => (now ? w.setStatus({ e: p.id }, what, NO_EXPIRY) : w.clearStatus({ e: p.id }, what)))
    return now
  }

  /** A verb of the talk panel said to a person: an act of the hands with something to say (and its choice). */
  talk(who: Id, verb: string, choice?: string): void {
    const p = this.w.player
    if (this.eng.busy(p) && !this.w.hasStatus({ e: p.id }, 'jailed')) return
    // a quest's verb (docs/quests.md §2.4): `quest:<ref>:<topic>` — an offer taken on or turned down, a topic told
    const q = /^quest:(.+):([^:]+)$/.exec(verb)
    const params: Record<string, PropValue> = q ? { say: 'quest', quest: q[1], topic: q[2] } : { say: verb, ...(choice && { choice }) }
    this.eng.act('hands', p.id, { e: who }, { instrument: null, params })
    this.sync()
  }

  /** The notice board (or anyone): a radiant offer on it taken on — the board is spoken to with it (docs/quests.md §3). */
  board(who: Id, ref: string): void {
    this.talk(who, `quest:${ref}:accept`)
  }

  /** The journal: the quest the player follows (its markers, the tracker, the companion's word) — the input's own choice. */
  track(id: Id | undefined): void {
    const w = this.w
    this.hand(() => w.setProp(w.player, 'track', id))
  }

  /** The trade panel: ask a merchant for one of its goods (it sells it, the buyer pays), or offer it a thing (it buys it). */
  trade(who: Id, item: Id, buy: boolean): void {
    const p = this.w.player
    if (this.eng.busy(p)) return
    if (buy) this.eng.act('hands', p.id, { e: who }, { instrument: null, params: { say: 'buy', item } })
    else {
      this.stow()
      this.eng.act('hands', p.id, { e: who }, { instrument: { e: item }, params: { say: 'sell' } })
    }
    this.sync()
  }

  /** The gift panel (docs/npc-sandbox.md §2.15): a thing from one's bag handed to a person (an act of putting: the person answers it as `people/accept`). */
  gift(who: Id, item: Id): void {
    const p = this.w.player
    if (this.eng.busy(p)) return
    const it = this.w.get(item)
    // (one's own, in the bag or in hand: a stack's next piece is in hand once its first is given)
    if (!it || (it.place.on !== 'inside' && it.place.on !== 'hand') || it.place.holder !== p.id) return
    this.stow()
    this.eng.act('put', p.id, { e: who }, { instrument: { e: item } })
    this.sync()
  }

  /** The pockets panel: take a thing from a person's pockets, or slip one into them (acts of taking and putting, seen or not). */
  pocket(who: Id, item: Id, take: boolean): void {
    const p = this.w.player
    if (this.eng.busy(p)) return
    if (take) this.eng.act('take', p.id, { e: item }, { instrument: null, params: { into: 'contents' } })
    else {
      this.stow()
      this.eng.act('put', p.id, { e: who }, { instrument: { e: item } })
    }
    this.sync()
  }

  // ---------------------------------------------------------------- the skill tree

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
    // what a module does with it (an active skill goes in the skill bar)
    for (const h of this.eng.hooks.learned) h(def)
    this.sync()
    return true
  }

  // ---------------------------------------------------------------- crafting

  /** How many of a type the player carries (bag and hand). */
  count(type: string): number {
    // (straight through what is carried: no stack keys to make, the whole bag's, for one type)
    const p = this.w.player
    let n = 0
    for (const id of [...(p.contents ?? []), ...(p.held ? [p.held] : [])]) {
      const e = this.w.get(id)
      if (e && e.type === type && !e.frozenBy) n++
    }
    return n
  }

  canCraft(r: Recipe): boolean {
    const p = this.w.player
    const carried = [p.held, ...(p.contents ?? [])].map((id) => this.w.get(id)).filter((e): e is Entity => !!e && !e.frozenBy)
    if (r.skill && !this.w.hasTag(p, `skill:${r.skill}`)) return false
    if (r.unlockedBy && (!this.w.story || this.w.num(this.w.story, r.unlockedBy.fact, 0) < (r.unlockedBy.level ?? 1))) return false
    return r.needs.every((n) => this.count(n.type) >= n.count) && (r.tools ?? []).every((tag) => carried.some((e) => this.w.hasTag(e, tag)))
  }

  /**
   * The crafting panel: an act of crafting (the recipe's needs are used up, what it makes goes into the bag). A station's
   * recipe names the station it is made at (`at`: the one whose panel is open), which the outcome holds within reach.
   */
  craft(r: Recipe, at?: Id): boolean {
    // the crafting panel (C): a lesson at hand may let it make only what it teaches
    return this.allows('craft', { type: r.make.type }) && this.makeOne(r, at)
  }

  /** Make it from what is carried (the panel's, and the palette's when none is carried). */
  private makeOne(r: Recipe, at?: Id): boolean {
    const p = this.w.player
    if (this.eng.busy(p) || !this.canCraft(r)) return false
    this.stow()
    this.eng.recipes.set(r.id, r)
    this.eng.act('craft', p.id, { e: p.id }, { instrument: null, params: { recipe: r.id, ...(at && { at }) } })
    if (!this.crafting) this.sync()
    return true
  }

  /** Making one after another (craftAll): the bag's slots are set once, after the last. */
  private crafting = false

  // ---------------------------------------------------------------- setting built things down (the build palette)

  /** A carried thing the build palette sets down instead of what is in hand (only while it plans). */
  private using?: Id

  /** What one sets down in a cell as part of a place: a built thing or a fixture (a wall, a door, a bed, a workbench). */
  static placeable(type: string): boolean {
    return isBuilt(type)
  }

  /** What is in hand (or what the build palette sets up) is set up by the right click (it builds): it meets the open air and the ceiling, as G does. */
  private buildsInHand(): boolean {
    if (this.bare) return false
    const held = this.w.get(this.using ?? this.w.player.held)
    return !!held && Controls.placeable(held.type)
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

  /** This thing set up at the aim (or in the ceiling over it), as the right click sets up what is held: the use it would be. */
  private planSet(thing: Id, aim: Aim, up = false): Plan | undefined {
    const at = this.spot(aim)
    if (!at) return undefined
    this.using = thing
    try {
      return this.planOn('use', at, up ? this.ceilingOf(at) : this.w.cellRef(at.map, at.x, at.y, at.z ?? 0), true)
    } finally {
      this.using = undefined
    }
  }

  /**
   * The build palette's preview of setting a type up at the aim — on one's own storey, or (`up`) in
   * the ceiling over it: one carried is set up (the right click's own act); with none, one is made from what is
   * carried first, if it can be. Never asked: putting is physics. Why not, when it cannot (docs/building.md).
   */
  previewPlace(type: string, aim: Aim, up = false): { ok: boolean; reason: Text; carried: number } {
    const carried = this.count(type)
    const thing = this.carriedOf(type)
    const w = this.w
    const pos = w.posOf(w.player)
    const why = (): Text => {
      const probe = thing ?? ({ id: '~place', type, place: { on: 'none' } } as Entity)
      const reach = w.onto.data.params?.carry ?? 1
      if (!pos || Math.max(Math.abs(aim.x - pos.x), Math.abs(aim.y - pos.y)) > reach) return { en: 'Out of reach.', zh: '够不着。' }
      const r = w.settleWhy(probe, pos.map, aim.x, aim.y, (pos.z ?? 0) + (up ? 1 : 0))
      return r ? REFUSAL[w.spacesOf(probe).includes('floor') && r === 'taken' ? 'floored' : r] : { en: 'It cannot go there.', zh: '这里放不下。' }
    }
    if (thing) {
      // the palette sets it down where it is aimed, or not at all (a pointer beyond reach is not moved nearer)
      const plan = this.planSet(thing.id, aim, up)
      return plan && plan.sets && plan.at.x === aim.x && plan.at.y === aim.y ? { ok: true, reason: up ? LAY_CEILING : plan.label, carried } : { ok: false, reason: why(), carried }
    }
    const r = this.recipeFor(type)
    if (!r) return { ok: false, reason: { en: 'You carry none.', zh: '身上没有。' }, carried }
    if (!this.canCraft(r)) return { ok: false, reason: { en: 'You carry none, nor what makes one.', zh: '身上没有，材料也不够做一个。' }, carried }
    // what one made would go where any thing set down goes: within reach, on one's storey (or in its
    // ceiling) with room for it and something to hold it — asked of the world with a thing not in it
    const reach = w.onto.data.params?.carry ?? 1
    const probe = { id: '~place', type, place: { on: 'none' } } as Entity
    const near = !!pos && Math.max(Math.abs(aim.x - pos.x), Math.abs(aim.y - pos.y)) <= reach && !(aim.x === pos.x && aim.y === pos.y && w.onto.resolve(type).solid)
    const open = !!pos && w.settleZ(probe, pos.map, aim.x, aim.y, (pos.z ?? 0) + (up ? 1 : 0)) !== undefined
    return near && open ? { ok: true, reason: up ? LAY_CEILING : { en: 'Made from what you carry, then set down', zh: '用身上的材料现做一个，再放下' }, carried } : { ok: false, reason: why(), carried }
  }

  /** Set a type down at the aim — or (`up`) in the ceiling over it (the build palette): one carried, or one made from what is carried first; facing a way (stairs go up it). */
  place(type: string, aim: Aim, facing?: Dir, up = false): boolean {
    if (this.eng.busy(this.w.player) || !this.previewPlace(type, aim, up).ok || !this.allows('build', { type, at: aim })) return false
    if (!this.carriedOf(type)) {
      const r = this.recipeFor(type)
      // made on the spot to be set down: the palette's own (a lesson that lets it set one down lets it make one)
      if (!r || !this.makeOne(r)) return false
    }
    const thing = this.carriedOf(type)
    const plan = thing && this.planSet(thing.id, aim, up)
    if (!plan || !plan.sets || plan.at.x !== aim.x || plan.at.y !== aim.y) return false
    this.run(plan, false, facing)
    return true
  }

  /** Make it again and again while what it needs is carried (the crafting panel's "all"): how many times. */
  craftAll(r: Recipe, most = 99, at?: Id): number {
    let n = 0
    this.crafting = true
    try {
      while (n < most && this.craft(r, at)) n++
    } finally {
      this.crafting = false
      if (n) this.sync()
    }
    return n
  }

  // ---------------------------------------------------------------- the magnet

  /** Dropped items within MAGNET tiles fly into the bag while there is room: an act of taking each, quietly. */
  magnet(): void {
    const w = this.w
    const p = w.player
    const here = w.posOf(p)
    if (!this.magnetic || !here || this.eng.busy(p)) return
    const by = this.carried(true)
    let free = (p.slots ?? []).filter((s) => !s).length
    let took = false
    let left = MAGNET_PER_TICK
    // a longer reach (the skill) adds `magnet` tiles
    const reach = MAGNET + w.num(p, 'magnet')
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        for (const e of w.entitiesAt(here.map, here.x + dx, here.y + dy, here.z)) {
          if (left <= 0) break
          if (!e.dropped || e.frozenBy || !w.isPortable(e) || this.eng.society.isAnothers(e, p)) continue
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
          left--
        }
    // what flies in leaves an empty hand empty: the fist is still there mid-fight
    if (took) this.sync(true)
  }
}
