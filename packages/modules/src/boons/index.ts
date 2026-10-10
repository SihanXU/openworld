// The boons module (docs/chapter-1.md §6): the powers a companion carries for its leader, given by the story and
// changed beside an attuned waypoint (it needs the waypoints module). What a carried boon gives the leader is its
// status's `lead:<stat>` props, which the kernel's `World.stat` reads.

import { registerModule, type Engine, type EngineModule, type Text } from '@openworld/engine'
import { BOON_PREFIX, activeBoon, boonsOf, companionsOf, leaderOf, nearAttunedWaypoint } from './boons.ts'

export * from './boons.ts'

/**
 * Choose the boon the companion carries (the waypoint's panel): an act of the hands on the
 * companion, which answers it (`companion/talk` → `boon`), only beside an attuned waypoint.
 */
export function chooseBoon(eng: Engine, id: string): boolean {
  const w = eng.world
  const p = w.player
  const bird = companionsOf(w, p)[0]
  if (!bird || eng.busy(p)) return false
  if (!nearAttunedWaypoint(w, p)) {
    w.fx.push({ t: 'log', text: { en: 'A power can be changed only beside a woken waypoint statue.', zh: '只有在唤醒过的传送雕像旁才能切换力量。' }, tone: 'warn' })
    return false
  }
  eng.act('hands', p.id, { e: bird.id }, { instrument: null, params: { boon: id } })
  return true
}

export const boonsModule: EngineModule = {
  id: 'boons',
  needs: ['waypoints'],
  effects: {
    boon: (fx, _eff, ev) => {
      const eng = fx.eng
      const w = eng.world
      const host = fx.hostEntity(ev)
      // a companion's boon (boons.ts): given by the story (param unlock), or chosen (param boon)
      // while its leader stands beside an attuned waypoint; it carries one at a time
      if (!host) return
      const give = ev.params?.unlock
      const pick = ev.params?.boon
      const carry = (id: string) => {
        for (const s of Object.keys(host.statuses ?? {})) if (s.startsWith(BOON_PREFIX) && s !== BOON_PREFIX + id) eng.removeStatus({ e: host.id }, s)
        if (!w.hasStatus({ e: host.id }, BOON_PREFIX + id)) eng.applyStatus({ e: host.id }, BOON_PREFIX + id)
      }
      const name = (id: string) => w.onto.status(BOON_PREFIX + id)?.name
      const said = (t: Text | undefined, l: 'en' | 'zh') => (typeof t === 'string' ? t : t ? (l === 'zh' ? t.zh ?? t.en : t.en) : '')
      if (typeof give === 'string' && give) {
        const had = boonsOf(w, host)
        if (had.includes(give)) return
        eng.setProp(host, 'boons', [...had, give].join(','), ev)
        if (!activeBoon(host)) carry(give)
        w.fx.push({ t: 'log', text: { en: `${eng.nameOf({ e: host.id }, 'en')} takes up a new power: ${said(name(give), 'en')}.`, zh: `${eng.nameOf({ e: host.id }, 'zh')}获得了新的力量：${said(name(give), 'zh')}。` }, tone: 'good' })
        return
      }
      if (typeof pick !== 'string' || !boonsOf(w, host).includes(pick) || activeBoon(host) === pick) return
      const leader = leaderOf(w, host)
      if (!leader || !nearAttunedWaypoint(w, leader)) {
        w.fx.push({ t: 'log', text: { en: 'A power can be changed only beside a woken waypoint statue.', zh: '只有在唤醒过的传送雕像旁才能切换力量。' }, tone: 'warn' })
        return
      }
      carry(pick)
      w.fx.push({ t: 'log', text: { en: `${eng.nameOf({ e: host.id }, 'en')} now carries ${said(name(pick), 'en')}.`, zh: `${eng.nameOf({ e: host.id }, 'zh')}现在携带着${said(name(pick), 'zh')}。` }, tone: 'good' })
      return
    },
  },
  spec: { primitives: { boon: 'boon — the host (a companion) is given a boon (param unlock: its id; carried at once if it carries none) or carries another it has (param boon), the latter only while its leader stands beside an attuned waypoint; a boon is its status boon_<id>, whose lead:<stat> props add to the leader\'s stats' } },
  install(eng) {
    const w = eng.world
    // the HUD's boons: those the companion following the player has, the one it carries, a waypoint near
    eng.hooks.frame.push((f) => {
      const p = w.player
      const bird = companionsOf(w, p)[0]
      f.player.boons = bird && { unlocked: boonsOf(w, bird), active: activeBoon(bird), atWaypoint: nearAttunedWaypoint(w, p) }
    })
  },
}

registerModule(boonsModule)
