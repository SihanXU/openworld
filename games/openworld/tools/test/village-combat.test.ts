import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, tickAt } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { socialOf } from '@openworld/modules'
import { buildFord } from '../src/demo/world.ts'

function village(victim: string | null = 'npc.fennick') {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const chunk of chunks) game.loadChunk(decodeChunk(chunk))
  const eng = game.engine, w = eng.world, p = w.player
  eng.author(() => {
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    w.state.tick = tickAt(1, 12)
    w.place(p, { on: 'tile', map: 'meadow', x: 20, y: 15 })
    w.setProp(p, 'hp', 10000)
    w.setProp(p, 'maxHp', 10000)
    // The square's brazier otherwise makes the combat AI avoid the player's test tile.
    for (const key of [...w.statusful]) {
      const ref = w.keyRef(key), pos = w.refPos(ref)
      if (pos?.map === 'meadow' && Math.abs(pos.x - 20) <= 3 && Math.abs(pos.y - 15) <= 3) {
        w.clearStatus(ref, 'lit')
        w.clearStatus(ref, 'burning')
      }
    }
    for (let i = 0; i < 100; i++) w.create('item/misc/thornmark', { on: 'inside', holder: p.id })
    for (const e of Object.values(w.state.entities)) {
      if (e.npc && e.place.on === 'tile') w.place(e, { on: 'tile', map: 'offstage', x: 1, y: 1 })
    }
    for (const [id, x, y] of [['npc.fennick', 20, 14], ['npc.holt', 22, 15], ['npc.bram', 21, 14]] as const) {
      const npc = w.get(id)!
      w.place(npc, { on: 'tile', map: 'meadow', x, y })
      npc.facing = 'down'
    }
    if (victim === 'npc.holt') w.place(p, { on: 'tile', map: 'meadow', x: 21, y: 15 })
  })
  eng.npcs.begin('meadow')
  if (victim) {
    eng.controls.toggle('drawn', true)
    eng.act('use', p.id, { e: victim }, { instrument: null, params: { attack: true } })
  }
  return { eng, w, p }
}

describe('the village after an assault', () => {
  it.each(['npc.fennick', 'npc.holt'])('after assaulting %s, Holt stops a player who puts the weapon away', (victim) => {
    const { eng, w } = village(victim)
    expect(socialOf(eng).bounty('firstlight', w.player.id)).toBeGreaterThan(0)
    eng.controls.toggle('drawn', false)
    let arrested = false
    for (let i = 0; i < 240 && !arrested; i++) {
      eng.tick()
      arrested = w.fx.some((fx) => fx.t === 'talk' && fx.who === 'npc.holt' && fx.arrest)
    }
    expect(arrested).toBe(true)
    const choices = socialOf(eng).talkView(w.get('npc.holt')!, w.player, true).verbs.map((v) => v.id)
    expect(choices).toEqual(expect.arrayContaining(['pay', 'jail', 'resist']))
  })

  it('Holt continues fighting a player who keeps the weapon drawn', () => {
    const { eng, w } = village()
    let arrested = false
    for (let i = 0; i < 120; i++) {
      eng.tick()
      arrested ||= w.fx.some((fx) => fx.t === 'talk' && fx.who === 'npc.holt' && fx.arrest)
    }
    expect(arrested).toBe(false)
    expect(eng.hostileTo(w.get('npc.holt')!, w.player)).toBe(true)
  })

  it('choosing to resist arrest starts a fight even before drawing a weapon', () => {
    const { eng, w } = village()
    eng.controls.toggle('drawn', false)
    let arrested = false
    for (let i = 0; i < 240 && !arrested; i++) {
      eng.tick()
      arrested = w.fx.some((fx) => fx.t === 'talk' && fx.who === 'npc.holt' && fx.arrest)
    }
    expect(arrested).toBe(true)
    let struck = false
    const dispatch = eng.dispatch.bind(eng)
    eng.dispatch = (ev) => {
      if (ev.kind === 'impulse/strike' && ev.host.e === w.player.id && ev.roles.actor?.e === 'npc.holt') struck = true
      return dispatch(ev)
    }
    eng.controls.talk('npc.holt', 'resist')
    for (let i = 0; i < 120 && !struck; i++) eng.tick()
    expect(struck).toBe(true)
  })

  it.each(['pay', 'jail'])('%s clears the assault bounty after the guard stops the player', (choice) => {
    const { eng, w } = village()
    eng.controls.toggle('drawn', false)
    let arrested = false
    for (let i = 0; i < 240 && !arrested; i++) {
      eng.tick()
      arrested = w.fx.some((fx) => fx.t === 'talk' && fx.who === 'npc.holt' && fx.arrest)
    }
    expect(arrested).toBe(true)
    eng.controls.talk('npc.holt', choice)
    expect(socialOf(eng).bounty('firstlight', w.player.id)).toBe(0)
    if (choice === 'jail') expect(w.hasStatus({ e: w.player.id }, 'jailed')).toBe(true)
    expect(eng.hostileTo(w.get('npc.holt')!, w.player)).toBe(false)
  })

  it('a cry for help makes Bram hostile to the attacker and never to Fennick', () => {
    const { eng, w, p } = village()
    expect(w.get('npc.bram')!.ai?.foes).toContain(p.id)
    expect(w.get('npc.bram')!.ai?.foes).not.toContain('npc.fennick')
    const friendlyBlows: unknown[] = []
    const dispatch = eng.dispatch.bind(eng)
    eng.dispatch = (ev) => {
      if (ev.kind === 'impulse/strike' && ev.roles.actor?.e === 'npc.bram' && ev.host.e === 'npc.fennick') friendlyBlows.push(ev)
      return dispatch(ev)
    }
    for (let i = 0; i < 120; i++) eng.tick()
    expect(friendlyBlows).toHaveLength(0)
    expect(w.get('npc.bram')!.ai?.foes).not.toContain('npc.fennick')
    expect(socialOf(eng).bounty('firstlight', 'npc.fennick')).toBe(0)
    expect(socialOf(eng).bounty('firstlight', 'npc.holt')).toBe(0)
    expect(socialOf(eng).bounty('firstlight', 'npc.bram')).toBe(0)
    expect(socialOf(eng).bounty('firstlight', p.id)).toBeGreaterThan(0)
  })

  it('an unprovoked NPC assault is still charged to its attacker', () => {
    const { eng, w } = village(null)
    eng.act('use', 'npc.bram', { e: 'npc.fennick' }, { instrument: null, params: { attack: true } })
    expect(socialOf(eng).bounty('firstlight', 'npc.bram')).toBe(40)
    expect(socialOf(eng).bounty('firstlight', w.player.id)).toBe(0)
  })
})
