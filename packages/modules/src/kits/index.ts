// The kits module (docs/creatures.md): the creatures' own skills — a kind's kit (`Ontology.kits`) taken up by its
// behaviour (the `kit` goal: it stands, marks the cells and winds up), and the act the wind-up ends in, which the
// creature's own rule answers with `unleash`. How a skill is aimed and timed is the kit's data; what lands is the rule's.

import { registerModule, type EngineModule } from '@openworld/engine'
import { Kits, kitGoal, unleash, TELEGRAPH_RED } from './kits.ts'

export * from './kits.ts'

export const kitsModule: EngineModule = {
  id: 'kits',
  goals: { kit: { paced: false, urgent: true, run: (eng, e, sc) => kitGoal(eng, e, sc.active) } },
  effects: { unleash },
  spec: {
    primitives: {
      unleash:
        "unleash {power?, element?, edge?, coat?, push?, heal?} — the host's kit skill (the act's param kit) lands: the host gets there as the skill says (a leap onto the aimed cell, a dash to the first foe or the first thing in its way: a dash into a wall stuns the dasher, a spring back after the blow), and each foe on the cells the act marked (params ox, oy, ax, ay) is struck by power with element and edge, coated with coat (a status it answers for itself) and pushed push cells away; the host mends heal for each foe it hit",
    },
    rules: ["A creature's kit skill is its act/use with the param kit (the skill's id): its own rule answers it, usually with unleash; any other use is its plain blow."],
  },
  install(eng) {
    const kits = new Kits(eng)
    eng.world.ext.set('kits', kits)
    // the HUD's marks: the cells each creature on the map is winding up on
    eng.hooks.frame.push((f) => {
      const w = eng.world, now = w.state.tick
      const marks = [...kits.pending].flatMap(([who, p]) => {
        const e = w.get(who)
        if (!e || e.place.on !== 'tile' || e.place.map !== f.map) return []
        return [{ who, tiles: p.tiles, progress: Math.min(1, (now - p.start) / Math.max(1, p.releaseAt - p.start)), color: p.skill.color ?? TELEGRAPH_RED }]
      })
      if (marks.length) f.telegraphs = marks
    })
  },
}

registerModule(kitsModule)


