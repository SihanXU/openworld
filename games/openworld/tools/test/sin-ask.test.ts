import { describe, expect, it } from 'vitest'
import { Game, NO_EXPIRY, RuleLibrary, textOf, type Entity } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// What would weigh on one's conscience is asked first (controls.ts `run`, `strike`, `pocket`, `asksBeforeTransfer`;
// Engine.guilt): every act of the one at the keys whose own deed would bring its karma down — a theft, a pocket
// picked, a blow on someone who has not fought them, a chest's things taken — waits for a yes, and the question says
// what it would be and how far it darkens them. A no leaves the world as it was; what is no deed asks nothing.

const onto = buildOntology()
const MAP = 'meadow'

function fresh() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = undefined
  const eng = g.engine, w = eng.world, p = w.player
  eng.author(() => {
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    eng.quests.put('descent', 'done')
    eng.teleport(p, { map: MAP, x: 20, y: 15 })
  })
  eng.npcs.begin(MAP)
  // everyone sent away but those named
  const clear = (keep: string[] = []) =>
    eng.author(() => {
      for (const e of Object.values(w.state.entities)) if (e.npc && !keep.includes(e.id) && e.place.on === 'tile') w.place(e, { on: 'tile', map: 'offstage', x: 1, y: 1 })
    })
  const make = (type: string, x: number, y: number, props?: Entity['props']) => eng.author(() => w.create(type, { on: 'tile', map: MAP, x, y }, props ? { props } : {}))
  const sin = () => w.state.question?.sin
  const deeds = () => (sin()?.deeds ?? []).map((d) => textOf(d, 'en'))
  return { g, eng, w, p, clear, make, sin, deeds }
}

describe('what would weigh on one\'s conscience is asked first', () => {
  it('a theft: asked with its toll; no leaves it where it was, yes takes it and darkens one', () => {
    const { eng, w, p, clear, make, sin, deeds } = fresh()
    clear()
    const loaf = make('item/food/bread', 20, 14, { owner: 'npc.marta' })
    eng.controls.run(eng.controls.plan('hands', { x: 20, y: 14 })!)
    expect(deeds()).toEqual(['theft'])
    expect(sin()?.toll).toBe(4)
    eng.controls.answer(false)
    expect(loaf.place).toMatchObject({ on: 'tile', x: 20, y: 14 })
    expect(w.num(p, 'karma')).toBe(0)
    eng.controls.run(eng.controls.plan('hands', { x: 20, y: 14 })!)
    eng.controls.answer(true)
    expect(loaf.place).toMatchObject({ holder: p.id })
    expect(w.num(p, 'karma')).toBe(-4)
  })

  it('what is no one\'s is taken without a word', () => {
    const { eng, w, p, clear, make } = fresh()
    clear()
    const stone = make('item/material/stone', 20, 14)
    eng.controls.run(eng.controls.plan('hands', { x: 20, y: 14 })!)
    expect(w.state.question).toBeUndefined()
    expect(stone.place).toMatchObject({ holder: p.id })
  })

  it('a blow with the blade drawn on someone who has not fought one: asked, an assault, every blow; on one who fights one, not', () => {
    const { eng, w, p, clear, sin, deeds } = fresh()
    clear(['npc.marta'])
    const marta = w.get('npc.marta')!
    eng.author(() => {
      eng.teleport(marta, { map: MAP, x: 20, y: 14 })
      p.facing = 'up'
    })
    eng.controls.toggle('drawn', true)
    const hp = w.num(marta, 'hp')
    eng.controls.strike()
    expect(deeds()).toEqual(['assault'])
    expect(sin()?.toll).toBeGreaterThan(0)
    eng.controls.answer(false)
    expect(w.num(marta, 'hp')).toBe(hp)
    expect(w.num(p, 'karma')).toBe(0)
    eng.controls.strike()
    eng.controls.answer(true)
    expect(w.num(marta, 'hp')).toBeLessThan(hp)
    expect(w.num(p, 'karma')).toBeLessThan(0)
    // she does not fight back (she flees): the next blow is an assault again, asked again
    eng.author(() => void (w.state.tick += 50))
    expect(eng.blowGuilt(p)?.deeds.map((d) => textOf(d, 'en'))).toEqual(['assault'])
    // one who fights one (a foe of theirs): a blow on them is no sin, and is not asked
    eng.author(() => (marta.ai = { ...(marta.ai ?? {}), foes: [p.id] } as typeof marta.ai))
    expect(eng.blowGuilt(p)).toBeUndefined()
  })

  it('a swing at the air in a fight (design.md §5.2) that would strike someone on its way is asked as that blow', () => {
    const { eng, w, p, clear, deeds } = fresh()
    clear(['npc.marta'])
    const marta = w.get('npc.marta')!
    // a clear line from where one stands: the cell aimed at empty, she two cells beyond it
    const at = w.posOf(p)!
    const line = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).find(([dx, dy]) => [1, 2, 3].every((i) => w.walkable(MAP, at.x + dx * i, at.y + dy * i, p.id)))!
    const [dx, dy] = line
    eng.author(() => {
      eng.teleport(marta, { map: MAP, x: at.x + dx * 3, y: at.y + dy * 3 })
      p.props!.profession = 'ranger'
      w.create('item/weapon/ranged/bow', { on: 'hand', holder: p.id })
      ;(p.combat ??= {}).fightTick = w.state.tick
    })
    eng.controls.sync()
    const plan = eng.controls.plan('primary', { x: at.x + dx, y: at.y + dy })!
    expect(plan).toMatchObject({ attack: true, whiff: true })
    const hp = w.num(marta, 'hp')
    eng.controls.run(plan)
    expect(deeds()).toEqual(['assault'])
    expect(textOf(w.state.question!.text, 'en')).toContain(textOf(marta.name, 'en'))
    eng.controls.answer(false)
    expect(w.num(marta, 'hp')).toBe(hp)
  })

  it('a pocket picked: asked from the pockets panel, made on a yes', () => {
    const { eng, w, p, clear, deeds } = fresh()
    clear(['npc.marta'])
    const marta = w.get('npc.marta')!
    eng.author(() => eng.teleport(marta, { map: MAP, x: 20, y: 14 }))
    const loaf = eng.author(() => w.create('item/food/bread', { on: 'inside', holder: marta.id }))
    eng.controls.pocket(marta.id, loaf.id, true)
    expect(deeds()).toEqual(['pickpocketing'])
    expect(loaf.place).toMatchObject({ holder: marta.id })
    eng.controls.answer(true)
    expect(loaf.place).toMatchObject({ holder: p.id })
    expect(w.num(p, 'karma')).toBeLessThan(0)
  })

  it('a chest\'s things taken from the panel: asked once for all, the tolls added', () => {
    const { eng, w, p, clear, make, sin, deeds } = fresh()
    clear()
    const chest = make('fixture/container/chest', 20, 14, { owner: 'npc.marta' })
    const loaves = eng.author(() => [0, 1, 2].map(() => w.create('item/food/bread', { on: 'inside', holder: chest.id })))
    eng.author(() => w.setStatus({ e: chest.id }, 'open', NO_EXPIRY))
    let went = false
    expect(eng.controls.asksBeforeTransfer(chest.id, 'chest', loaves[0].id, true, () => (went = true))).toBe(true)
    expect(deeds()).toEqual(['theft'])
    expect(sin()?.toll).toBe(12)
    eng.controls.answer(true)
    expect(went).toBe(true)
    // putting into it is never asked
    expect(eng.controls.asksBeforeTransfer(chest.id, 'bag', loaves[0].id, true, () => {})).toBe(false)
    expect(w.num(p, 'karma')).toBe(0)
  })
})
