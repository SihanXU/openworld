import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_DAY, type Entity } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, HAVEN, SOCIAL, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// Each person's regard for the one at the keys (docs/npc-sandbox.md §2.4) as hearts: raised by talk, gifts and their
// errands, kept (a liking fades slowly), it lowers a merchant's prices; at full, one not bound to the main story may be
// asked to come and live in the Held Ground — while it has a bed free (one by the camp, two for each residents' tent).

function game() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player, s = socialOf(eng)
  /** Stand beside a person (on their map), the talk open to them. */
  const beside = (id: string) => {
    const e = w.get(id)!
    const at = w.posOf(e)!
    eng.author(() => eng.travel(p, { map: at.map, x: at.x, y: at.y + 1 }))
    eng.controls.sync()
    return e
  }
  const fullRegard = (e: Entity) => eng.author(() => s.changeRegard(e, p.id, 1000))
  const verbs = (e: Entity) => s.verbs(e, p).map((v) => v.id)
  /** What a person said since the last look. */
  const said = (e: Entity) => w.fx.filter((x) => x.t === 'say' && x.who === e.id).map((x) => JSON.stringify((x as { text: unknown }).text)).join(' ')
  return { eng, w, p, s, beside, fullRegard, verbs, said }
}

describe('regard as hearts', () => {
  it('a liking fades slowly (a hundredth a day); a grudge heals at a tenth', () => {
    const { eng, w, p, s } = game()
    const tam = w.get('npc.tam')!
    const vigo = w.get('npc.vigo')!
    eng.author(() => (s.changeRegard(tam, p.id, 1000), s.changeRegard(vigo, p.id, -60)))
    const [up, down] = [s.regard(tam, p.id), s.regard(vigo, p.id)]
    expect(up).toBe(100)
    eng.author(() => void (w.state.tick += TICKS_PER_DAY))
    expect(s.regard(tam, p.id)).toBeGreaterThanOrEqual(98.9)
    expect(s.regard(vigo, p.id)).toBeGreaterThan(down + 5)
  })

  it('the talk panel carries the number (its hearts); a merchant in full regard asks three tenths less, and pays more', () => {
    const { eng, w, p, s, fullRegard } = game()
    const tam = w.get('npc.tam')!
    const goods = s.stock(tam)
    expect(goods.length).toBeGreaterThan(0)
    const before = s.priceToBuy(goods[0], tam, p)
    expect(s.talkView(tam, p).affection).toBe(s.regard(tam, p.id))
    fullRegard(tam)
    expect(s.talkView(tam, p).affection).toBe(100)
    expect(s.regardDiscount(tam, p.id)).toBeCloseTo(0.3)
    expect(s.priceToBuy(goods[0], tam, p)).toBeLessThan(before)
    expect(s.priceToBuy(goods[0], tam, p)).toBe(Math.max(1, Math.round(s.value(goods[0]) * 1.25 * 0.7)))
    void eng
  })
})

describe('asked to come and live in the Held Ground', () => {
  it('at full regard, once the Held Ground is one\'s own, one not bound to the main story may be asked; the story\'s people may not', () => {
    const { eng, w, p, fullRegard, verbs } = game()
    const tam = w.get('npc.tam')!
    const ilse = w.get('npc.ilse')!
    fullRegard(tam)
    fullRegard(ilse)
    // the Held Ground not yet one's own
    expect(verbs(tam)).not.toContain('invite')
    eng.author(() => w.setFact('sins.defeated.alberic', 1))
    expect(verbs(tam)).toContain('invite')
    expect(verbs(ilse)).not.toContain('invite')
    void p
  })

  it('one bed by the camp from the first: the first asked moves there and spends days there; the next is told there is no bed; a residents\' tent makes two more', () => {
    const { eng, w, s, beside, fullRegard, verbs } = game()
    eng.author(() => w.setFact('sins.defeated.alberic', 1))
    const [tam, vigo, cass] = ['npc.tam', 'npc.vigo', 'npc.cass'].map((id) => w.get(id)!)
    for (const e of [tam, vigo, cass]) fullRegard(e)
    expect(s.residenceBeds().map((b) => b.anchor)).toEqual(['home.camp'])
    beside(tam.id)
    eng.controls.talk(tam.id, 'invite')
    eng.tick()
    expect(w.posOf(tam)?.map).toBe(HAVEN.map)
    expect(tam.npc?.resident?.slot).toBe('home.camp')
    expect(w.prop(tam, 'resident')).toBe(HAVEN.map)
    expect(verbs(tam)).not.toContain('invite')
    // the next: no bed free — told so, staying where they are
    const home = w.posOf(vigo)!.map
    beside(vigo.id)
    w.fx = []
    eng.controls.talk(vigo.id, 'invite')
    expect(w.posOf(vigo)?.map).toBe(home)
    expect(w.fx.some((x) => x.t === 'say' && x.who === vigo.id && JSON.stringify(x.text).includes('营帐'))).toBe(true)
    // the steward raises a residents' tent: two beds more
    eng.author(() => w.setFact('haven.build.lodge1', 1))
    expect(s.residenceBeds().filter((b) => !b.who).map((b) => b.anchor)).toEqual(['home.lodge1.a', 'home.lodge1.b'])
    eng.controls.talk(vigo.id, 'invite')
    eng.tick()
    expect(vigo.npc?.resident?.slot).toBe('home.lodge1.a')
    // a resident's days are the Held Ground's, whatever their own schedule says; and they still trade there
    expect(w.posOf(vigo)?.map).toBe(HAVEN.map)
    expect(vigo.npc!.resident!.schedule.every((e) => e.map === HAVEN.map)).toBe(true)
    expect(s.stock(tam).length).toBeGreaterThan(0)
    void cass
  })

  it('full regard is a mark a liking keeps (the talk panel\'s ten hearts, 95): a day after the last gain one may still be asked, five days on too, and goes', () => {
    const { eng, w, p, s, beside, fullRegard, verbs } = game()
    eng.author(() => w.setFact('sins.defeated.alberic', 1))
    const tam = w.get('npc.tam')!
    fullRegard(tam)
    expect(SOCIAL.residence!.at).toBe(95)
    eng.author(() => void (w.state.tick += TICKS_PER_DAY))
    expect(s.regard(tam, p.id)).toBeLessThan(100)
    expect(verbs(tam)).toContain('invite')
    eng.author(() => void (w.state.tick += 4 * TICKS_PER_DAY))
    expect(s.regard(tam, p.id)).toBeGreaterThanOrEqual(95)
    expect(verbs(tam)).toContain('invite')
    beside(tam.id)
    eng.controls.talk(tam.id, 'invite')
    eng.tick()
    expect([w.posOf(tam)?.map, tam.npc?.resident?.slot]).toEqual([HAVEN.map, 'home.camp'])
    // a resident's day is the residence's (content social.ts): asleep in the bed by night, by the fire by day
    expect(tam.npc!.resident!.schedule.map((e) => [e.from, e.to, e.activity])).toEqual(SOCIAL.residence!.days.map((d) => [d.from, d.to, d.activity]))
  })

  it('the word said with no verb offered is answered as the verb asks: one the story needs and a stranger at low regard both stay, and say why', () => {
    const { eng, w, beside, fullRegard, verbs, said } = game()
    eng.author(() => w.setFact('sins.defeated.alberic', 1))
    const ilse = w.get('npc.ilse')!
    const cass = w.get('npc.cass')!
    fullRegard(ilse)
    expect(verbs(ilse)).not.toContain('invite')
    expect(verbs(cass)).not.toContain('invite')
    for (const [e, why] of [[ilse, '离不开'], [cass, '没熟']] as const) {
      const home = w.posOf(e)!.map
      beside(e.id)
      w.fx = []
      eng.controls.talk(e.id, 'invite')
      eng.tick()
      expect([e.id, w.posOf(e)?.map, e.npc?.resident, w.prop(e, 'resident')]).toEqual([e.id, home, undefined, undefined])
      expect(said(e)).toContain(why)
    }
    // nor before the Held Ground is one's own, however well they think of one
    eng.author(() => w.setFact('sins.defeated.alberic', 0))
    const tam = w.get('npc.tam')!
    fullRegard(tam)
    const home = w.posOf(tam)!.map
    beside(tam.id)
    w.fx = []
    eng.controls.talk(tam.id, 'invite')
    eng.tick()
    expect([w.posOf(tam)?.map, tam.npc?.resident]).toEqual([home, undefined])
    expect(said(tam)).toContain('自己的地方')
  })

  it('one who follows, asked to come and live there, goes and follows no longer', () => {
    const { eng, w, p, beside, fullRegard } = game()
    eng.author(() => w.setFact('sins.defeated.alberic', 1))
    const vigo = w.get('npc.vigo')!
    beside(vigo.id)
    eng.controls.talk(vigo.id, 'follow')
    expect(w.prop(vigo, 'follow')).toBe(p.id)
    fullRegard(vigo)
    eng.controls.talk(vigo.id, 'invite')
    eng.tick()
    expect([w.posOf(vigo)?.map, w.prop(vigo, 'follow'), w.prop(vigo, 'resident')]).toEqual([HAVEN.map, undefined, HAVEN.map])
  })

  it('the Held Ground holds seven at most: the camp\'s bed and two in each of three tents', () => {
    const { eng, w, s } = game()
    eng.author(() => ['lodge1', 'lodge2', 'lodge3'].forEach((l) => w.setFact(`haven.build.${l}`, 1)))
    expect(s.residenceBeds()).toHaveLength(7)
  })
})
