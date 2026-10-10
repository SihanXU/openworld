// Behaviour (world-model.md §6.10, D15; Elin gives every character one goal system, `AIAct`): one
// system for every actor but the one at the keys. Each actor's goals are tried in its order — its
// type's `goals`, else the world's, else this default — and the first that applies takes its turn:
// - encounter: a sin's locked telegraphs (bosses.ts);
// - threat: fight the nearest it is hostile to in sight, or, passive, run from it (creatures.ts);
//   a person runs from what would attack them (npc.ts), or, struck and of a fighting stance, fights back
//   until its foes are down or gone, then calms (conduct.ts);
// - social: a person afraid keeps away, one who keeps the watch stops the wanted, an owner asks back what
//   was taken (conduct.ts, docs/npc-sandbox.md);
// - follow: a companion keeps beside its leader, from map to map (companion.ts); a person who follows
//   someone walks after them (conduct.ts);
// - need: a hungry person eats, buys a meal, or takes one (conduct.ts);
// - schedule: where a person's day takes them, the work there, between maps (npc.ts);
// - home: back toward where it lives (after dark, where it roams);
// - idle: a step now and then.
// Every goal acts with the acts and moves the player has; one that cannot go on reports `stuck`.
// Behaviour is the game's own logic, not the AI interface (design.md §5.4): its acts' outcomes are.

import { encounter } from './bosses.ts'
import { fight, home, idle, sceneOf, type Scene } from './creatures.ts'
import type { Engine } from './engine.ts'
import type { Entity } from './types.ts'

export type GoalId = 'encounter' | 'threat' | 'social' | 'follow' | 'need' | 'schedule' | 'home' | 'idle'

/** The order goals are tried in when neither the type nor the world says (Elin's AIAct priorities). */
export const GOALS: GoalId[] = ['encounter', 'threat', 'social', 'follow', 'need', 'schedule', 'home', 'idle']

/** Goals that wait for the actor's own pace (its step's cooldown) and for it to be free; the others keep theirs. */
const PACED = new Set<GoalId>(['threat', 'social', 'need', 'schedule', 'home', 'idle'])

export class Behaviour {
  constructor(private eng: Engine) {}

  /** The goals of a thing, in its order. */
  goalsOf(e: Entity): GoalId[] {
    const w = this.eng.world
    return (w.onto.resolve(e.type).goals ?? w.onto.data.goals ?? GOALS) as GoalId[]
  }

  /** One tick of everyone's behaviour on the active map (and of companions wherever their leader went). */
  tick(active: string): void {
    const eng = this.eng
    const w = eng.world
    eng.npcs.begin(active)
    const sc = sceneOf(eng, active)
    const movers = w.entitiesOnMap(active).filter((e) => e.place.on === 'tile' && e.id !== w.state.player && (e.npc || e.ai || e.boss || e.props?.companion !== undefined))
    for (const id of w.companionIds) {
      const e = w.state.entities[id]
      if (typeof e.props?.companion === 'string' && !(e.place.on === 'tile' && e.place.map === active)) movers.push(e)
    }
    for (const e of movers) this.turn(e, sc)
  }

  /** The first of its goals that applies takes the actor's turn. */
  private turn(e: Entity, sc: Scene): void {
    const eng = this.eng
    const w = eng.world
    const ready = eng.ready(e.id) && !eng.busy(e)
    // during a scene the people on stage are the script's
    const scripted = !!w.scene && !!e.npc
    for (const g of this.goalsOf(e)) {
      if (PACED.has(g) && (!ready || scripted)) continue
      // a person's own round (not a threat, not the law) waits a moment for one who faces them (npc.ts, attended)
      if (g !== 'threat' && g !== 'social' && PACED.has(g) && eng.npcs.attended(e)) return
      if (this.run(g, e, sc)) return
    }
  }

  private run(g: GoalId, e: Entity, sc: Scene): boolean {
    const eng = this.eng
    switch (g) {
      case 'encounter':
        return encounter(eng, e, sc.active)
      case 'threat':
        // a person who fought: while it still has a foe it fights, else it calms (and its round goes on)
        if (e.ai && e.npc && !eng.conduct.fightOn(e, sc)) return eng.npcs.flee(e, sc.active)
        return e.ai && !e.boss ? fight(eng, e, sc) : eng.npcs.flee(e, sc.active)
      case 'social':
        return eng.conduct.social(e, sc)
      case 'follow':
        return eng.companions.follow(e) || eng.conduct.follow(e, sc)
      case 'need':
        return eng.conduct.need(e, sc)
      case 'schedule':
        return eng.npcs.schedule(e, sc.active)
      case 'home':
        return !e.boss && home(eng, e, sc)
      case 'idle':
        return !e.boss && idle(eng, e, sc)
    }
  }
}
