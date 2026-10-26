// The Ford's six kinds of hole, each reached through the game's own path (an undefined use, a blow on what
// cannot break, a hand on what does not say, a rope used on a creature, a person stuck, content broken): the
// live smoke test plays them with a model (games/openworld/ai/src/live.ts `fordLive`), and the game's probes are the requests they raise
// (probes.ts → content/src/probes.json, for the modder's detection of what a model carries).

import { TICKS_PER_HOUR, tickAt, type Engine, type Entity, type Game, type Key } from '@openworld/engine'
import { AT, STAND } from './demo/world.ts'

export interface Ford {
  game: Game
  eng: Engine
}
export const W = (f: Ford) => f.eng.world

/** The Ford as the scenarios expect it: past the arrival, the first step of the quest, bread in the bag. */
export function ready(f: Ford): Ford {
  const w = W(f)
  f.eng.author(() => {
    w.setFact('seen.arrival', true)
    w.player.props!.quest = 1
    w.create('item/food/bread', { on: 'inside', holder: 'player' })
    f.eng.controls.sync()
  })
  return f
}
export const ofType = (f: Ford, type: string) => Object.values(W(f).state.entities).find((e) => e.type === type)!
const stand = (f: Ford, x: number, y: number, facing: Entity['facing'] = 'up') => f.eng.author(() => (W(f).place(W(f).player, { on: 'tile', map: 'ford', x, y }), (W(f).player.facing = facing)))
function hold(f: Ford, e: Entity): void {
  f.eng.author(() => W(f).place(e, { on: 'inside', holder: 'player' }))
  f.eng.controls.sync()
  f.eng.controls.select(W(f).player.slots!.indexOf(f.eng.controls.key(e)))
}
const run = (f: Ford, key: Key, x: number, y: number, layer?: number) => {
  const plan = f.eng.controls.plan(key, { x, y }, layer)
  if (!plan) throw new Error(`no plan for ${key} at ${x},${y}`)
  f.eng.controls.run(plan, true)
  return plan
}
export const ticks = (f: Ford, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    if (W(f).scene?.waiting === 'advance') f.eng.story.advance()
    f.eng.tick()
    if (until?.()) return true
  }
  return false
}

export const SCENARIOS: { name: string; act: (f: Ford) => void }[] = [
  {
    name: 'bread used on the winch (act/use)',
    act: (f) => {
      hold(f, ofType(f, 'item/food/bread'))
      stand(f, ...STAND.winch)
      run(f, 'use', ...AT.winch)
    },
  },
  {
    name: 'the axe on the chopping stump (strike)',
    act: (f) => {
      const stump = ofType(f, 'fixture/nature/stump')
      const { x, y } = stump.place as { x: number; y: number }
      hold(f, ofType(f, 'item/weapon/blade/axe'))
      stand(f, x - 1, y, 'right')
      f.eng.controls.run(f.eng.controls.plan('use', { x, y, stack: [{ e: stump.id }] })!, true)
    },
  },
  {
    name: 'a bare hand on the raft (handle)',
    act: (f) => {
      stand(f, ...STAND.raft, 'right')
      run(f, 'hands', ...AT.raft)
    },
  },
  {
    name: 'a rope used on a fire slime (use)',
    act: (f) => {
      const slime = W(f).get('ford.fire_slime')!
      stand(f, ...STAND.road, 'right')
      f.eng.author(() => W(f).place(slime, { on: 'tile', map: 'ford', x: STAND.road[0] + 1, y: STAND.road[1] }))
      hold(f, ofType(f, 'item/tool/rope'))
      run(f, 'use', STAND.road[0] + 1, STAND.road[1])
    },
  },
  {
    name: 'Hesper cannot tend her soaked fire (stuck)',
    act: (f) => {
      W(f).state.tick = tickAt(2, 17.8)
      const fire = W(f).get('ford.campfire')!
      f.eng.author(() => {
        W(f).clearStatus({ e: fire.id }, 'lit')
        W(f).setStatus({ e: fire.id }, 'wet', W(f).state.tick + 4000)
      })
      stand(f, ...AT.spawn)
      ticks(f, TICKS_PER_HOUR, () => f.game.mods.records.length > 0)
    },
  },
  {
    name: 'the rope burns (broken)',
    act: (f) => {
      const rope = ofType(f, 'item/tool/rope')
      f.eng.author(() => W(f).place(rope, { on: 'tile', map: 'ford', x: STAND.road[0], y: STAND.road[1] }))
      f.eng.queue({ kind: 'impulse/element', host: { e: rope.id }, roles: {}, params: { element: 'fire', power: 2 }, origin: 'world' })
      ticks(f, 300, () => f.game.mods.records.length > 0)
    },
  },
]

