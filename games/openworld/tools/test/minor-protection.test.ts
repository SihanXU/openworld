import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Engine } from '@openworld/engine'
import { socialOf } from '@openworld/modules'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const MAP = 'meadow'
const onto = buildOntology()

function fresh() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const chunk of chunks) game.loadChunk(decodeChunk(chunk))
  game.mods.provider = undefined
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
    eng.quests.put('descent', 'done')
    eng.teleport(w.player, { map: MAP, x: 20, y: 15 })
  })
  eng.npcs.begin(MAP)
  return { eng, w }
}

function position(s: ReturnType<typeof fresh>, id: string) {
  const target = s.w.get(id)!
  s.eng.author(() => {
    for (const e of Object.values(s.w.state.entities)) {
      if (e.npc && e.id !== id && e.place.on === 'tile') s.w.place(e, { on: 'tile', map: 'offstage', x: 1, y: 1 })
    }
    s.w.place(target, { on: 'tile', map: MAP, x: 20, y: 14 })
    target.facing = 'down'
    s.eng.teleport(s.w.player, { map: MAP, x: 20, y: 15 })
  })
  return target
}

const purse = (eng: Engine, id: string) => socialOf(eng).purse(eng.world.get(id)!)
const handle = (eng: Engine, id: string, say: string) => [...eng.trace].reverse().find((entry) =>
  entry.ev.kind === 'impulse/handle' && 'e' in entry.ev.host && entry.ev.host.e === id && entry.ev.params?.say === say,
)

describe('minor social protection', () => {
  it('recognizes Mia and age-only legacy villagers without hiding ordinary conversation or quests', () => {
    const { eng, w } = fresh()
    const mia = position({ eng, w }, 'npc.mia')
    expect(mia.type).toBe('actor/person/villager')
    expect(w.num(mia, 'age')).toBe(9)

    // Simulate an older save whose people record has age but no derived minor tag.
    eng.author(() => w.removeTag(mia, 'minor'))
    const verbs = socialOf(eng).verbs(mia, w.player).map((verb) => verb.id)
    expect(verbs).not.toContain('rob')
    expect(verbs).not.toContain('steal')
    expect(verbs).not.toContain('unbelief')
    expect(verbs).toEqual(expect.arrayContaining(['ask', 'chat', 'gift', 'quest:ring:accept']))

    const ageOnly = w.get('npc.cass')!
    eng.author(() => {
      w.setProp(ageOnly, 'age', 17)
      w.removeTag(ageOnly, 'minor')
    })
    const legacyVerbs = socialOf(eng).verbs(ageOnly, w.player).map((verb) => verb.id)
    expect(legacyVerbs).not.toContain('rob')
    expect(legacyVerbs).not.toContain('steal')
    expect(legacyVerbs).not.toContain('unbelief')
  })

  it('answers forced legacy exploitation and intimidation words for an age-17 NPC without effects or a hole', () => {
    const { eng, w } = fresh()
    const target = position({ eng, w }, 'npc.cass')
    eng.author(() => {
      w.setProp(target, 'age', 17)
      w.removeTag(target, 'minor')
      w.setProp(w.player, 'level', 100)
      w.setProp(w.player, 'stealth', 200)
    })
    const so = socialOf(eng)
    const before = {
      victimCoins: purse(eng, target.id),
      playerCoins: purse(eng, 'player'),
      victimHp: w.num(target, 'hp'),
      playerHp: w.num(w.player, 'hp'),
      regard: so.regard(target, 'player'),
      faith: w.num(w.player, 'faith'),
    }

    for (const verb of ['rob', 'steal', 'unbelief', 'intimidate']) {
      eng.controls.talk(target.id, verb)
      expect(handle(eng, target.id, verb)?.defined, `${verb} must have an explicit rule answer`).toBe(true)
    }

    expect(purse(eng, target.id)).toBe(before.victimCoins)
    expect(purse(eng, 'player')).toBe(before.playerCoins)
    expect(w.num(target, 'hp')).toBe(before.victimHp)
    expect(w.num(w.player, 'hp')).toBe(before.playerHp)
    expect(so.regard(target, 'player')).toBe(before.regard)
    expect(so.fears(target, 'player')).toBe(false)
    expect(w.num(w.player, 'faith')).toBe(before.faith)
    expect(w.hasStatus({ e: target.id }, 'robbed')).toBe(false)
    expect(w.hasStatus({ e: target.id }, 'pilfered')).toBe(false)
    expect(w.hasStatus({ e: target.id }, 'doubted')).toBe(false)
  })

  it('protects an explicitly minor person with no age while preserving trade and Mia’s quest', () => {
    const { eng, w } = fresh()
    const cass = position({ eng, w }, 'npc.cass')
    eng.author(() => {
      w.setProp(cass, 'age', undefined)
      w.addTag(cass, 'minor')
    })
    const verbs = socialOf(eng).verbs(cass, w.player).map((verb) => verb.id)
    expect(verbs).not.toContain('rob')
    expect(verbs).not.toContain('steal')
    expect(verbs).not.toContain('unbelief')
    eng.controls.talk(cass.id, 'intimidate')
    expect(handle(eng, cass.id, 'intimidate')?.defined).toBe(true)

    const mia = position({ eng, w }, 'npc.mia')
    eng.author(() => w.removeTag(mia, 'minor'))
    eng.controls.talk(mia.id, 'ask')
    eng.controls.talk(mia.id, 'chat')
    eng.controls.talk(mia.id, 'gift')
    expect(w.fx.some((event) => event.t === 'panel' && event.panel === 'gift' && event.by === mia.id)).toBe(true)
    expect(w.fx.some((event) => event.t === 'say' && event.who === mia.id)).toBe(true)
    eng.controls.talk(mia.id, 'quest:ring:accept')
    eng.tick()
    expect(eng.quests.stateOf(w.get('quest.ring')!)).toBe('active')

    const merchant = position({ eng, w }, 'npc.tobin')
    eng.author(() => w.setProp(merchant, 'age', 17))
    expect(socialOf(eng).verbs(merchant, w.player).map((verb) => verb.id)).toContain('trade')
    eng.controls.talk(merchant.id, 'trade')
    expect(w.fx.some((event) => event.t === 'panel' && event.panel === 'trade' && event.by === merchant.id)).toBe(true)
  })

  it('keeps an NPC aged exactly eighteen on the adult robbery, theft, and unbelief paths', () => {
    const { eng, w } = fresh()
    const target = position({ eng, w }, 'npc.cass')
    eng.author(() => {
      w.setProp(target, 'age', 18)
      w.removeTag(target, 'minor')
      w.setProp(w.player, 'level', 100)
      w.setProp(w.player, 'stealth', 200)
    })
    const verbs = socialOf(eng).verbs(target, w.player).map((verb) => verb.id)
    expect(verbs).toEqual(expect.arrayContaining(['rob', 'steal', 'unbelief']))

    eng.controls.talk(target.id, 'rob')
    eng.controls.talk(target.id, 'steal')
    eng.controls.talk(target.id, 'unbelief')
    expect(w.hasStatus({ e: target.id }, 'robbed')).toBe(true)
    expect(w.hasStatus({ e: target.id }, 'pilfered')).toBe(true)
    expect(w.hasStatus({ e: target.id }, 'doubted')).toBe(true)
    expect(purse(eng, 'player')).toBeGreaterThan(0)
    expect(w.num(w.player, 'faith')).toBeLessThan(0)
  })
})
