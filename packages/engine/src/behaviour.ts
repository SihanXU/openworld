// Behaviour (world-model.md §6.10, D15; Elin gives every character one goal system, `AIAct`): one
// system for every actor but the one at the keys. Each actor's goals are tried in its order — its
// type's `goals`, else the world's, else this default — and the first that applies takes its turn:
// - encounter: a sin's locked telegraphs (bosses.ts);
// - danger: away from what harms one, or put it right (a burning cell left, the fire on one put out: wellbeing.ts);
// - threat: fight the nearest it is hostile to in sight, or, passive, run from it (creatures.ts);
//   a person runs from what would attack them (npc.ts), or, struck and of a fighting stance, fights back
//   until its foes are down or gone, then calms (conduct.ts);
// - social: a person afraid keeps away, one who keeps the watch stops the wanted, an owner asks back what
//   was taken (conduct.ts, docs/npc-sandbox.md);
// - follow: a companion keeps beside its leader, from map to map (companion.ts); a person who follows
//   someone walks after them (conduct.ts);
// - need: the rest of what one minds put right (out of the rain, something eaten), or one keeps out of it rather
//   than walk back in (wellbeing.ts); a hungry person buys a meal, or takes one (conduct.ts);
// - schedule: where a person's day takes them, the work there, between maps (npc.ts);
// - home: back toward where it lives (after dark, where it roams);
// - idle: a step now and then.
// Every goal acts with the acts and moves the player has; one that cannot go on reports `stuck`.
// Behaviour is the game's own logic, not the AI interface (design.md §5.4): its acts' outcomes are.

import { fight, home, idle, sceneOf, type Scene } from './creatures.ts'
import type { Engine } from './engine.ts'
import type { Goal } from './module.ts'
import type { Entity } from './types.ts'

/** The order goals are tried in when neither the type nor the world says (Elin's AIAct priorities). */
export const GOALS: string[] = ['encounter', 'danger', 'threat', 'social', 'follow', 'need', 'schedule', 'home', 'idle']

/** The kernel's goals; a module adds its own (module.ts), or another way to the same goal, tried after these. */
export const KERNEL_GOALS: Record<string, Goal> = {
  threat: {
    paced: true,
    urgent: true,
    run: (eng, e, sc) => {
      // a person who fought: while it still has a foe it fights, else it calms (and its round goes on)
      if (e.ai && e.npc && !eng.society.fightOn(e, sc)) return eng.npcs.flee(e, sc.active)
      return e.ai && !e.boss ? fight(eng, e, sc) : eng.npcs.flee(e, sc.active)
    },
  },
  // what harms one (a burning cell, a fire on one), and the rest one minds (the rain, hunger): wellbeing.ts
  danger: { paced: true, urgent: true, run: (eng, e, sc) => eng.wellbeing.turn(e, sc.active, 'danger') },
  need: { paced: true, run: (eng, e, sc) => eng.wellbeing.turn(e, sc.active, 'need') },
  follow: { paced: false, run: (eng, e) => eng.companions.follow(e) },
  schedule: { paced: true, run: (eng, e, sc) => eng.npcs.schedule(e, sc.active) },
  home: { paced: true, run: (eng, e, sc) => !e.boss && home(eng, e, sc) },
  idle: { paced: true, run: (eng, e, sc) => !e.boss && idle(eng, e, sc) },
}

export class Behaviour {
  constructor(private eng: Engine) {}

  /** The goals of a thing, in its order. */
  goalsOf(e: Entity): string[] {
    const w = this.eng.world
    return w.onto.resolve(e.type).goals ?? w.onto.data.goals ?? GOALS
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
    for (const id of this.goalsOf(e)) {
      const ways = eng.goalImpls.get(id)
      // a goal no installed module gives is passed over (the world names it, the game does without)
      if (!ways?.length) continue
      const paced = ways[0].paced
      if (paced && (!ready || scripted)) continue
      // a person's own round (not a threat, not the law) waits a moment for one who faces them (npc.ts, attended)
      if (!ways[0].urgent && paced && eng.npcs.attended(e)) return
      if (ways.some((g) => g.run(eng, e, sc))) return
    }
  }
}
