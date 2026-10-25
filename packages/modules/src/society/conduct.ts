// The people's own conduct (docs/npc-sandbox.md): goals of the one goal system (behaviour.ts), beside threat,
// follow and schedule —
// - social: a guard goes after one its watch wants and stops them (an act of the hands, `say: arrest`); an
//   owner goes after one they saw take what is theirs and asks for it back (`say: demand`); one afraid keeps
//   away from who frightened them; a fight over, one calms down;
// - need: the hungry eat what they carry, buy a meal of one who sells food, or — the poor, the loose of
//   conscience, the starving — take one (an act seen and judged as anyone's);
// - follow, for people: one who follows another walks after them, keeps near, fights beside them, and comes
//   along from map to map.
// Every move is a step and every deed an act, as the player's are; what a goal sets going it does by events
// (behaviour may make them, as a day that cannot go on makes `stuck`): the answers are the people's rules.

import { DIRS, astar, type Dir, type Engine, type Entity, type Id, type Pos, type Scene } from '@openworld/engine'
import { socialOf } from './state.ts'

const NPC_STEP_TICKS = 4
/** How often a guard tries again to stop one who has not yielded (ticks). */
const ARREST_EVERY = 120
/** How long an owner waits between asking for what was taken (ticks); the `demanded` status keeps them from asking twice. */
const DEMAND_NEAR = 6
/** How far a hungry person goes for a meal (cells). */
const MEAL_REACH = 14
/** How long one who found no meal waits before looking again (ticks: an hour). */
const MEAL_AGAIN = 600
/** Below this conscience, the hungry with no coin pick a pocket for a meal. */
const POCKET_HONESTY = 0.3
/** A follower keeps within this many cells of the one it follows; farther than LOST, it comes to them at once. */
const FOLLOW_NEAR = 2
const FOLLOW_LOST = 12
/** How long a fight is over before one calms down (ticks). */
const CALM_AFTER = 60

interface Runtime {
  path?: [number, number][]
  goal?: string
  /** When each target may be stopped or asked again. */
  next?: Record<Id, number>
  /** When to look for a meal again. */
  meal?: number
  /** Since when no foe has been near. */
  quiet?: number
}

export class Conduct {
  private rt = new Map<Id, Runtime>()

  constructor(private eng: Engine) {}

  private runtime(e: Entity): Runtime {
    let r = this.rt.get(e.id)
    if (!r) this.rt.set(e.id, (r = {}))
    return r
  }

  // ---------------------------------------------------------------- moving

  /** One step toward a spot (a path around what is in the way, kept while it leads there); false when none leads. */
  private go(e: Entity, gx: number, gy: number): boolean {
    const eng = this.eng
    const w = eng.world
    if (e.place.on !== 'tile') return false
    const { map, x, y } = e.place
    const rt = this.runtime(e)
    const goal = `${map}:${gx}:${gy}`
    // a path that no longer starts beside them (they were made to step aside) is planned again
    if (rt.path?.length && Math.abs(rt.path[0][0] - x) + Math.abs(rt.path[0][1] - y) !== 1) rt.path = undefined
    if (rt.goal !== goal || !rt.path?.length) {
      const m = w.map(map)
      if (!m) return false
      rt.path = astar(m.width, m.height, (px, py) => w.passable(map, px, py) || (px === gx && py === gy), x, y, gx, gy, 3000, (ax, ay, bx, by) => w.safeStep(e, map, ax, ay, bx, by)) ?? []
      rt.goal = goal
      if (!rt.path.length) return false
    }
    const [nx, ny] = rt.path[0]
    if (nx === gx && ny === gy && w.actorAt(map, nx, ny, e.id)) return false
    const dir: Dir = nx > x ? 'right' : nx < x ? 'left' : ny > y ? 'down' : 'up'
    if (eng.step(e, dir)) rt.path.shift()
    else rt.path = undefined
    eng.setCooldown(e.id, NPC_STEP_TICKS)
    return true
  }

  /** One step away from someone (the step that leaves them farthest). */
  private away(e: Entity, from: Pos): boolean {
    const eng = this.eng
    const w = eng.world
    if (e.place.on !== 'tile') return false
    const { map, x, y } = e.place
    let best: Dir | undefined
    let far = Math.abs(x - from.x) + Math.abs(y - from.y)
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      const [dx, dy] = DIRS[d]
      if (!w.walkable(map, x + dx, y + dy, e.id, true)) continue
      const s = Math.abs(x + dx - from.x) + Math.abs(y + dy - from.y)
      if (s > far) (far = s), (best = d)
    }
    if (best) eng.step(e, best)
    eng.setCooldown(e.id, NPC_STEP_TICKS - 1)
    return true
  }

  /** Face a spot beside one. */
  private face(e: Entity, at: Pos): void {
    if (e.place.on !== 'tile') return
    const dx = at.x - e.place.x
    const dy = at.y - e.place.y
    if (dx || dy) e.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  }

  private dist(a: Entity, b: Entity): number {
    if (a.place.on !== 'tile' || b.place.on !== 'tile' || a.place.map !== b.place.map) return Infinity
    return Math.max(Math.abs(a.place.x - b.place.x), Math.abs(a.place.y - b.place.y))
  }

  /** Can one see another from where one stands (sight, line of sight)? */
  private sees(e: Entity, o: Entity): boolean {
    const eng = this.eng
    if (e.place.on !== 'tile' || o.place.on !== 'tile' || e.place.map !== o.place.map) return false
    return this.dist(e, o) <= eng.sightOf(e, e.place) && eng.lineOfSight(e.place.map, e.place, o.place)
  }

  // ---------------------------------------------------------------- threat: a fight over

  /**
   * One who fought (a person given a fighting behaviour when struck, combat.ts's foe): its foes that are down,
   * gone, off the map or (to one who keeps the watch) no longer resisting are let go; with none left a while,
   * it is told to calm down (its own rule answers). True while it still has a fight.
   */
  fightOn(e: Entity, sc: Scene): boolean {
    const eng = this.eng
    const w = eng.world
    const ai = e.ai
    if (!e.npc || !ai) return true
    const t = w.state.tick
    const keepsWatch = typeof w.prop(e, 'watch') === 'string'
    const live = (ai.foes ?? []).filter((id) => {
      const f = w.get(id)
      if (!f || f.place.on !== 'tile' || f.place.map !== sc.active || w.hasStatus({ e: id }, 'down')) return false
      // one who keeps the watch lets go one who has put the blade away and stopped fighting: it stops them instead
      if (keepsWatch && !w.hasStatus({ e: id }, 'drawn') && t - (f.combat?.lastAttackTick ?? -Infinity) > 50) return false
      return true
    })
    const rt = this.runtime(e)
    if (live.length) {
      rt.quiet = undefined
      return true
    }
    rt.quiet ??= t
    if (keepsWatch || t - rt.quiet >= CALM_AFTER) {
      rt.quiet = undefined
      eng.queue({ kind: 'impulse/notify', host: { e: e.id }, roles: {}, params: { what: 'calm' }, origin: 'world' })
    }
    return false
  }

  // ---------------------------------------------------------------- social

  /** The social goal: fear, the law, a debt (docs/npc-sandbox.md §2.6–2.7). */
  social(e: Entity, sc: Scene): boolean {
    if (!e.npc || e.place.on !== 'tile' || e.ai) return false
    // A guard who has stopped fighting resumes the arrest before a witness's fear takes it away.
    return this.pursue(e, sc) || this.afraid(e, sc) || this.confront(e, sc)
  }

  /** One afraid of someone near keeps away from them. */
  private afraid(e: Entity, sc: Scene): boolean {
    const w = this.eng.world
    const afraid = e.npc?.memory?.afraid
    if (!afraid) return false
    for (const o of sc.actors) {
      if (o.id === e.id || !socialOf(this.eng).fears(e, o) || this.dist(e, o) > 5 || w.hasStatus({ e: o.id }, 'down')) continue
      return this.away(e, o.place as Pos)
    }
    return false
  }

  /** One who keeps the watch here goes after the wanted it knows (or sees close) and stops them. */
  private pursue(e: Entity, sc: Scene): boolean {
    const eng = this.eng
    const w = eng.world
    const law = socialOf(eng).lawAt(sc.active)
    if (!law || w.prop(e, 'watch') !== law.id || eng.asleep(e)) return false
    let target: Entity | undefined
    let near = Infinity
    for (const o of sc.actors) {
      if (o.id === e.id || socialOf(eng).bounty(law.id, o.id) <= 0) continue
      const d = this.dist(e, o)
      if (d >= near || !this.sees(e, o) || !(socialOf(eng).knows(e, o.id) || d <= 3)) continue
      target = o
      near = d
    }
    if (!target || target.place.on !== 'tile') return false
    const rt = this.runtime(e)
    if (near <= 1) {
      this.face(e, target.place)
      if ((rt.next?.[target.id] ?? -1) <= w.state.tick) {
        ;(rt.next ??= {})[target.id] = w.state.tick + ARREST_EVERY
        eng.act('hands', e.id, { e: target.id }, { instrument: null, params: { say: 'arrest' } })
      }
      eng.setCooldown(e.id, NPC_STEP_TICKS)
      return true
    }
    return this.go(e, target.place.x, target.place.y) || true
  }

  /** One who saw another take what is theirs, and has not asked yet, goes to them and asks for it back. */
  private confront(e: Entity, sc: Scene): boolean {
    const eng = this.eng
    const w = eng.world
    if (w.hasStatus({ e: e.id }, 'demanded') || eng.asleep(e)) return false
    for (const o of sc.actors) {
      if (o.id === e.id || w.hasStatus({ e: o.id }, 'down') || this.dist(e, o) > DEMAND_NEAR || !this.sees(e, o)) continue
      const g = socialOf(eng).grudge(e, o.id)
      const def = g && w.onto.data.deeds?.find((d) => d.id === g.deed)
      // a thing taken from them or theirs (not a blow: violence is fled, not argued with; not a friend's: theirs to ask)
      const theirs = !!g && ['me', 'ours'].includes(socialOf(eng).victim(g.against, e))
      if (!g || !def || def.violent || !g.thing || !theirs || w.state.tick - g.tick > 2 * 600) continue
      if (this.dist(e, o) <= 1 && o.place.on === 'tile') {
        this.face(e, o.place)
        eng.act('hands', e.id, { e: o.id }, { instrument: null, params: { say: 'demand', item: g.thing } })
        eng.setCooldown(e.id, NPC_STEP_TICKS * 3)
        return true
      }
      return (o.place.on === 'tile' && this.go(e, o.place.x, o.place.y)) || true
    }
    return false
  }

  // ---------------------------------------------------------------- need

  /** The need goal: one hungry eats, buys a meal, or takes one (docs/npc-sandbox.md §2.11). */
  need(e: Entity, sc: Scene): boolean {
    const eng = this.eng
    const w = eng.world
    if (!e.npc || e.place.on !== 'tile' || e.ai || !w.hasStatus({ e: e.id }, 'hungry') || eng.asleep(e)) return false
    const rt = this.runtime(e)
    if ((rt.meal ?? -1) > w.state.tick) return false
    const edible = (x: Entity | undefined) => !!x && !e.residentWork?.cargoIds.includes(x.id) && w.hasTag(x, 'edible') && !x.frozenBy
    // what they carry: eaten
    const food = [...(e.held ? [e.held] : []), ...(e.contents ?? [])].map((id) => w.get(id)).find(edible)
    if (food) {
      eng.act('use', e.id, { e: e.id }, { instrument: { e: food.id } })
      eng.setCooldown(e.id, 20)
      return true
    }
    // coin for a meal: the nearest who sells food they can pay for
    const purse = socialOf(eng).purse(e)
    let seller: { who: Entity; item: Entity } | undefined
    let near = Infinity
    if (purse > 0)
      for (const o of sc.actors) {
        if (o.id === e.id || !w.hasTag(o, 'merchant') || eng.asleep(o)) continue
        const d = this.dist(e, o)
        if (d > MEAL_REACH || d >= near) continue
        const item = socialOf(eng).stock(o).find((x) => edible(x) && socialOf(eng).priceToBuy(x, o, e) <= purse)
        if (item) (seller = { who: o, item }), (near = d)
      }
    if (seller && seller.who.place.on === 'tile') {
      if (near <= 1) {
        this.face(e, seller.who.place)
        eng.act('hands', e.id, { e: seller.who.id }, { instrument: null, params: { say: 'buy', item: seller.item.id } })
        eng.setCooldown(e.id, 20)
        return true
      }
      return this.go(e, seller.who.place.x, seller.who.place.y) || this.giveUp(rt, e)
    }
    // none to buy with: the loose of conscience, or the starving, take one lying about or put away
    const honest = w.num(e, 'honesty', 1)
    const starving = w.num(e, 'hunger', 1) <= 0
    if (honest >= 0.5 && !starving) return this.giveUp(rt, e)
    const at = e.place
    let take: Entity | undefined
    near = Infinity
    for (let dy = -MEAL_REACH; dy <= MEAL_REACH; dy++)
      for (let dx = -MEAL_REACH; dx <= MEAL_REACH; dx++) {
        if (!w.inBounds(at.map, at.x + dx, at.y + dy)) continue
        for (const o of w.entitiesAt(at.map, at.x + dx, at.y + dy)) {
          const d = Math.max(Math.abs(dx), Math.abs(dy))
          if (d >= near) continue
          // on the ground, or in a container; the least honest, from a pocket too (one who keeps the watch's
          // excepted, and the one whose back is turned the likelier: a hand in a pocket is felt, social.ts)
          const pocket = honest < POCKET_HONESTY && w.isAgent(o) && o.npc && o.id !== e.id && !w.hasTag(o, 'watchman')
          const pick = edible(o) && w.isPortable(o) ? o : !w.isAgent(o) || pocket ? (o.contents ?? []).map((id) => w.get(id)).find(edible) : undefined
          if (pick) (take = pick), (near = d)
        }
      }
    if (!take) return this.giveUp(rt, e)
    const tp = w.posOf(take)!
    if (near <= 1) {
      this.face(e, tp)
      eng.act('take', e.id, { e: take.id }, { instrument: null, params: { into: 'contents' } })
      eng.setCooldown(e.id, 20)
      return true
    }
    return this.go(e, tp.x, tp.y) || this.giveUp(rt, e)
  }

  private giveUp(rt: Runtime, e: Entity): boolean {
    rt.meal = this.eng.world.state.tick + MEAL_AGAIN
    // hungry with no coin and nothing found: news for the quests (a favour: bring them something to eat)
    if (socialOf(this.eng).purse(e) === 0) this.eng.quests.news({ kind: 'hungry', target: e.id })
    return false
  }

  // ---------------------------------------------------------------- follow (people)

  /**
   * Follow, for a person (its `follow` prop names whom): told to wait, it stays; else it keeps near them,
   * strikes what attacks them (if it fights), and comes to them at once when far behind.
   */
  follow(e: Entity, sc: Scene): boolean {
    const eng = this.eng
    const w = eng.world
    const id = w.prop(e, 'follow')
    if (!e.npc || typeof id !== 'string' || e.place.on !== 'tile') return false
    const lead = w.get(id)
    if (!lead || lead.place.on !== 'tile') return false
    if (w.prop(e, 'waiting') === true) return true
    if (!eng.ready(e.id) || eng.busy(e)) return true
    const d = this.dist(e, lead)
    if (d > FOLLOW_LOST) {
      const at = eng.nearestFree(lead.place, e)
      if (at) eng.relocate(e, at)
      eng.setCooldown(e.id, NPC_STEP_TICKS)
      return true
    }
    // what is after the one it follows, it strikes (one who fights), or keeps clear of
    if (w.prop(e, 'fights') === true) {
      const foe = sc.actors.find((o) => o.id !== e.id && o.ai && eng.hostileTo(o, lead) && this.dist(o, lead) <= 4)
      if (foe && foe.place.on === 'tile') {
        if (this.dist(e, foe) <= 1) {
          this.face(e, foe.place)
          if (eng.ready('atk:' + e.id)) {
            eng.attack(e, { e: foe.id })
            eng.setCooldown('atk:' + e.id, 14)
          }
          eng.setCooldown(e.id, NPC_STEP_TICKS)
          return true
        }
        return this.go(e, foe.place.x, foe.place.y) || true
      }
    }
    if (d <= FOLLOW_NEAR) return true
    return this.go(e, lead.place.x, lead.place.y) || true
  }

  /** The one at the keys came to a map: those who follow them (and are not told to wait) come too, beside them. */
  bringFollowers(map: string): void {
    const eng = this.eng
    const w = eng.world
    const p = w.player
    const at = w.posOf(p)
    if (!at || at.map !== map) return
    for (const e of w.withProp('follow', p.id)) {
      if (!e.npc || e.props?.waiting === true || e.place.on !== 'tile' || e.place.map === map) continue
      const free = eng.nearestFree(at, e)
      if (free) eng.relocate(e, free)
    }
  }
}
