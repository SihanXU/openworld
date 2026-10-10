// The bosses module (docs/bosses.md): encounters with locked telegraphs — a kit's approach, aim and windup
// (its goal, `encounter`), and the blow its act lands (`release`). Identity, patterns, timing and effects
// are the world's data (WorldIndex.bosses).

import { registerModule, type EngineModule } from '@openworld/engine'
import { encounter, releaseSkill } from './bosses.ts'

export * from './bosses.ts'

export const bossesModule: EngineModule = {
  id: 'bosses',
  goals: { encounter: { paced: false, run: (eng, e, sc) => encounter(eng, e, sc.active) } },
  effects: {
    release: (fx, _eff, ev) => {
      const host = fx.hostEntity(ev)
      if (host) releaseSkill(fx.eng, host, ev)
    },
  },
  spec: { primitives: { release: "release {} — the host's encounter skill lands on the cells its act telegraphed (params skill, ox, oy, ax, ay): a strike to each foe there, a push or pull and a coat as the skill says; the host heals or blinks itself" } },
}

registerModule(bossesModule)
