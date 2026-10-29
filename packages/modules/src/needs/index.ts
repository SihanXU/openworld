// The needs module: hunger (Minecraft's food bar). Its clocks and what they do are the game's data (the `hunger`
// and `vitals` periods, their rules); the module brings their paces (hunger.ts), the `feed` primitive, the
// HUD's bar and the word for one woken by hunger.

import { registerModule, type EngineModule } from '@openworld/engine'

export * from './hunger.ts'

export const needsModule: EngineModule = {
  id: 'needs',
  effects: {
    feed: (fx, eff, ev) => {
      const eng = fx.eng
      const w = eng.world
      const host = fx.hostEntity(ev)
      // Hearty Meals (the skill): food fills half as much again
      const max = host ? w.num(host, 'maxHunger') : 0
      if (!host || max <= 0) return
      eng.setProp(host, 'hunger', Math.max(0, Math.min(max, Math.round(w.num(host, 'hunger', max) + fx.amount(ev, eff.amount) * (w.hasTag(host, 'skill:hearty-meals') ? 1.5 : 1)))), ev)
      return
    },
  },
  // food read as one's wellbeing reads it (wellbeing.ts): it fills the hunger the `hungry` threshold is drawn on
  reads: { feed: (eff) => ({ props: { hunger: typeof eff.amount === 'number' ? eff.amount : 1 } }) },
  spec: { primitives: { feed: 'feed {amount} — the host\'s hunger rises by amount, up to its maxHunger' } },
  install(eng) {
    const w = eng.world
    eng.hooks.frame.push((f) => {
      const p = w.player
      f.player.hunger = w.num(p, 'hunger', w.num(p, 'maxHunger'))
      f.player.maxHunger = w.num(p, 'maxHunger')
    })
    eng.hooks.woke.push((e) => (w.num(e, 'hunger', 1) <= 0 ? { en: 'Hunger wakes you.', zh: '你被饿醒了。' } : undefined))
  },
}

registerModule(needsModule)
