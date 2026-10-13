import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_DAY, type Entity } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, STATS_LAYOUT, STORY_RULES, buildOntology, decodeChunk, migrateStats } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// Good and evil, faith, luck (content faith.ts): karma falls with one's own deeds, seen or not, and rises with
// kindness; the good warm sooner to the good, the wicked to the wicked. Faith rises with prayer (once a day at a
// place) and falls with words against the gods. Luck widens a creature's chance of leaving its trophy.

const onto = buildOntology()
const MAP = 'meadow'

function fresh() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = undefined
  const eng = g.engine, w = eng.world, p = w.player, s = socialOf(eng)
  eng.author(() => {
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    eng.quests.put('descent', 'done')
    eng.teleport(p, { map: MAP, x: 20, y: 15 })
  })
  eng.npcs.begin(MAP)
  /** Everyone else sent away: no one to see. */
  const clear = (keep: string[] = []) =>
    eng.author(() => {
      for (const e of Object.values(w.state.entities)) if (e.npc && !keep.includes(e.id) && e.place.on === 'tile') w.place(e, { on: 'tile', map: 'offstage', x: 1, y: 1 })
    })
  const make = (type: string, x: number, y: number, props?: Entity['props']) => eng.author(() => w.create(type, { on: 'tile', map: MAP, x, y }, props ? { props } : {}))
  const hands = (x: number, y: number) => {
    const plan = eng.controls.plan('hands', { x, y })
    expect(plan).toBeDefined()
    eng.controls.run(plan!)
    eng.tick()
  }
  return { g, eng, w, p, s, clear, make, hands }
}

describe('good and evil', () => {
  it('a theft no one sees still weighs on the thief: karma falls by a quarter of the deed', () => {
    const { eng, w, p, clear, make } = fresh()
    clear()
    const loaf = make('item/food/bread', 20, 14, { owner: 'npc.marta' })
    eng.act('take', p.id, { e: loaf.id }, { instrument: null, params: { into: 'contents' } })
    expect(w.get('npc.marta')!.npc?.memory?.deeds ?? []).toEqual([])
    expect(w.num(p, 'karma')).toBe(-4)
    // taking what is no one's is no deed
    const stone = make('item/material/stone', 20, 14)
    eng.act('take', p.id, { e: stone.id }, { instrument: null, params: { into: 'contents' } })
    expect(w.num(p, 'karma')).toBe(-4)
  })

  it('the good warm sooner to the good, and the wicked (Vigo, little honesty) to the wicked', () => {
    const gain = (karma: number, who: string) => {
      const { eng, w, p, s } = fresh()
      eng.author(() => w.setProp(p, 'karma', karma))
      return eng.author(() => s.changeRegard(w.get(who)!, p.id, 10))
    }
    expect(gain(60, 'npc.tam')).toBeGreaterThan(gain(0, 'npc.tam'))
    expect(gain(-60, 'npc.tam')).toBeLessThan(gain(0, 'npc.tam'))
    expect(gain(-60, 'npc.vigo')).toBeGreaterThan(gain(0, 'npc.vigo'))
    expect(gain(60, 'npc.vigo')).toBeLessThan(gain(0, 'npc.vigo'))
    // losses are what they are, whoever one is
    const { eng, w, p, s } = fresh()
    eng.author(() => w.setProp(p, 'karma', 80))
    expect(eng.author(() => s.changeRegard(w.get('npc.tam')!, p.id, -10))).toBe(-10)
  })

  it('karma and faith stay within −100..100', () => {
    const { eng, w, p, s } = fresh()
    eng.author(() => (s.moral(p, 'karma', -500), s.moral(p, 'faith', 500)))
    expect(w.num(p, 'karma')).toBe(-100)
    expect(w.num(p, 'faith')).toBe(100)
  })
})

describe('faith', () => {
  it('a prayer at an altar raises faith, once a day there', () => {
    const { eng, w, p, clear, make, hands } = fresh()
    clear()
    make('fixture/sacred/altar', 20, 14)
    hands(20, 14)
    expect(w.num(p, 'faith')).toBe(4)
    hands(20, 14)
    expect(w.num(p, 'faith')).toBe(4)
    eng.author(() => void (w.state.tick += TICKS_PER_DAY + 1))
    eng.tick()
    hands(20, 14)
    expect(w.num(p, 'faith')).toBe(8)
  })

  it('a wayside shrine is read and prayed at', () => {
    const { w, p, clear, make, hands } = fresh()
    clear()
    make('fixture/sacred/wayshrine/crown', 20, 14)
    w.fx = []
    hands(20, 14)
    expect(w.num(p, 'faith')).toBe(2)
    expect(w.fx.some((x) => x.t === 'say' && JSON.stringify(x.text).includes('CROWN'))).toBe(true)
  })

  it('told there are no gods, the devout take it ill; the teller\'s faith wavers; once a day to each', () => {
    const { eng, w, p, s } = fresh()
    const anselm = w.get('npc.anselm')!
    const at = w.posOf(anselm)!
    eng.author(() => eng.travel(p, { map: at.map, x: at.x, y: at.y + 1 }))
    eng.controls.sync()
    expect(s.verbs(anselm, p).map((v) => v.id)).toContain('unbelief')
    eng.controls.talk(anselm.id, 'unbelief')
    eng.tick()
    expect(w.num(p, 'faith')).toBe(-5)
    expect(s.regard(anselm, p.id)).toBeLessThan(0)
    expect(s.verbs(anselm, p).map((v) => v.id)).not.toContain('unbelief')
  })
})

describe('luck', () => {
  it('a creature\'s trophy comes more often to a lucky hand: chance × (1 + luck)', () => {
    const drops = (luck: number) => {
      const { eng, w, p } = fresh()
      eng.author(() => w.setProp(p, 'luck', luck))
      for (let i = 0; i < 12; i++) {
        eng.queue({ kind: 'impulse/notify', host: { e: p.id }, roles: {}, params: { what: 'defeat', xp: 0, trophy: 'item/clothing/cloak/tidecloak', trophyChance: 0.5 } })
        eng.flush()
      }
      return (p.contents ?? []).filter((id) => w.get(id)?.type === 'item/clothing/cloak/tidecloak').length
    }
    expect(drops(1)).toBe(12)
    expect(drops(0)).toBeLessThan(12)
  })
})

describe('an older save', () => {
  it('its pieces lose standing your ground, stealth and perception for defence, dodge and luck', () => {
    const { g, eng, w } = fresh()
    const odo = eng.author(() => w.create('item/armor/pauldrons', { on: 'tile', map: MAP, x: 5, y: 5 }, { props: { def: 3, holdFast: 0.25 } }))
    const ring = eng.author(() => w.create('item/valuable/ring', { on: 'tile', map: MAP, x: 5, y: 5 }, { props: { 'sub:stealth': 1, 'sub:perception': 2, 'sub:atk': 1 } }))
    eng.author(() => w.setFact(STATS_LAYOUT, false))
    eng.author(() => migrateStats(g))
    expect(odo.props).toMatchObject({ def: 6 })
    expect(odo.props?.holdFast).toBeUndefined()
    expect(ring.props).toEqual({ 'sub:atk': 1, 'sub:luck': 0.1 })
  })
})
