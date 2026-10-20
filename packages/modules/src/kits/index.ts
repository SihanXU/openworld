// The kits module (docs/skills.md): every monster's skills, one system. A kind's kit (`Ontology.kits`) holds how each
// skill is aimed and timed; what lands is the caster's own rule (`act/use` with the param `kit`), answered with
// `unleash`. Two behaviours take the skills up: a minor monster's (the `kit` goal: when a skill's conditions hold) and a
// boss fight's director (the `encounter` goal, for a type with an `Ontology.encounters` entry: a rotation in each
// phase, an opening skill as a phase begins, answering skills between).

import { registerModule, type EngineModule } from '@openworld/engine'
import { Kits } from './cast.ts'
import { encounter, kitFrame } from './encounter.ts'
import { kitGoal } from './kit.ts'
import { tacticsGoal } from './tactics.ts'
import { unleash } from './unleash.ts'

export * from './cast.ts'
export * from './encounter.ts'
export * from './kit.ts'
export * from './pattern.ts'
export * from './tactics.ts'
export * from './unleash.ts'

export const kitsModule: EngineModule = {
  id: 'kits',
  // the bosses' skills were a module of their own until they became the kits' (docs/skills.md)
  formerly: ['bosses'],
  goals: {
    encounter: { paced: false, run: (eng, e, sc) => encounter(eng, e, sc.active) },
    kit: { paced: false, urgent: true, run: (eng, e, sc) => kitGoal(eng, e, sc.active) },
    // how a minor monster moves in a fight (tactics.ts): keeping away, fleeing hurt, flanking with its pack
    rout: { paced: true, urgent: true, run: (eng, e, sc) => tacticsGoal(eng, e, sc, 'rout') },
    tactics: { paced: true, urgent: true, run: (eng, e, sc) => tacticsGoal(eng, e, sc, 'place') },
  },
  effects: { unleash },
  spec: {
    primitives: {
      unleash:
        "unleash {power?, element?, edge?, coat?, push?, pull?, heal?, leave?, leaveStatus?} — the host's kit skill (the act's param kit) lands: the host gets there as the skill says (a leap onto the aimed cell, a dash to the first foe or the first thing in its way: a dash into a wall stuns the dasher, a blink beside the aimed cell, a spring back after the blow), and each foe on the cells the act marked (params ox, oy, ax, ay) is struck by power with element and edge, coated with coat (a status it answers for itself), pushed push cells away or pulled pull cells toward where the skill was wound up; the host mends heal for each foe it hit; a leave thing (a type) is made on each marked cell no body stands on, holding leaveStatus (a status) from the start",
    },
    rules: ["A creature's or a boss's kit skill is its act/use with the param kit (the skill's id): its own rule answers it, usually with unleash; any other use is its plain blow."],
  },
  install(eng) {
    eng.world.ext.set('kits', new Kits(eng))
    // the HUD's marks (the cells each caster on the map winds up on) and each boss's plate and pose
    eng.hooks.frame.push((f) => kitFrame(eng, f))
  },
  upgrade(eng) {
    // an older save's boss memory (the bosses module's: a kit by id, its skills by index, a wind-up) becomes the director's;
    // the phases it came to are opened (their openings were the old kit's, or there were none)
    for (const e of Object.values(eng.world.state.entities)) {
      const b = e.boss as (typeof e.boss & { kit?: unknown; nextSkill?: unknown; pending?: unknown }) | undefined
      if (b && (b.kit !== undefined || b.nextSkill !== undefined || b.pending !== undefined)) {
        const phase = typeof b.phase === 'number' ? b.phase : 1
        e.boss = { phase, opened: phase, action: 'idle' }
      }
    }
  },
}

registerModule(kitsModule)
