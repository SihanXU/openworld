// The Pilgrim's Road's bugs (docs/chapter-1.md §14): a shrine never takes what must not be given away; the Rest's
// welcome and oath do not play once the knight has fallen, and its priest greets one who comes after him; the oath's
// scallop is the pilgrim's own, not the scallop Sister Ilse asks after; a save at the First Seal's stage 40 from before
// the road shows the oath; and Firstlight's chapel is Sister Ilse's, at Astra's altar.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, textOf, type Entity } from '@openworld/engine'
import { BASE_RULES, CHAPEL_SIGN, CH1, GAME, ORDER_SEAL, STORY_RULES, SWORN_SCALLOP, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const lib = () => new RuleLibrary([...BASE_RULES, ...STORY_RULES])

function fresh() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, lib())
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  const eng = game.engine
  const w = eng.world
  // down from the mountain, the rescue and the vigil behind
  eng.author(() => {
    for (const q of ['descent', 'rescue', 'vigil']) eng.quests.put(q, 'done')
    w.setFact('seen.arrival', true)
    w.setFact('seen.village_arrival', true)
  })
  return { game, eng, w, index, chunks }
}
type F = ReturnType<typeof fresh>

const ticks = (f: F, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    if (f.w.scene?.waiting === 'advance') f.eng.story.advance()
    f.eng.tick()
    if (until?.()) return true
  }
  return !!until?.()
}
const teleport = (f: F, map: string, x: number, y: number) => f.eng.author(() => f.eng.teleport(f.w.player, { map, x, y }))
const carried = (f: F, type: string) => f.eng.author(() => f.w.create(type, { on: 'inside', holder: f.w.player.id }))
const holderOf = (f: F, e: Entity) => (e.place.on === 'inside' || e.place.on === 'hand' ? e.place.holder : e.place.on)
const logs = (f: F) => f.w.fx.filter((x) => x.t === 'log').map((x) => JSON.stringify((x as { text: unknown }).text)).join('\n')

/** Lay a thing on a shrine (G: the put act, the shrine receiving it), from the open tile beside it. */
function lay(f: F, shrine: string, item: Entity): void {
  // (a scene that took control plays out first: the Order's seal in hand has one)
  ticks(f, 900, () => !f.w.scene)
  const at = f.w.posOf(f.w.get(shrine)!)!
  const side = ([[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']] as const).find(([dx, dy]) => f.w.walkable(at.map, at.x + dx, at.y + dy))!
  teleport(f, at.map, at.x + side[0], at.y + side[1])
  f.w.player.facing = side[2]
  f.w.fx = []
  expect(f.eng.act('put', f.w.player.id, { e: shrine }, { instrument: { e: item.id } }).defined).toBe(true)
  ticks(f, 2)
}

describe('the wayside shrines', () => {
  it('never take a relic or what matters most: the Crown of Thorns on the Shrine of the Crown, the Order\'s seal on the Shrine of the Nails', () => {
    const f = fresh()
    const kept = (shrine: string, type: string) => {
      const it = carried(f, type)
      lay(f, shrine, it)
      expect([type, f.w.hasStatus({ e: shrine }, 'lit'), !!f.w.get(it.id) && holderOf(f, f.w.get(it.id)!)]).toEqual([type, false, f.w.player.id])
      expect(logs(f)).toContain('不是能献出去的东西')
    }
    kept('way.shrine.crown', 'item/relic/crown_of_thorns')
    kept('way.shrine.nails', ORDER_SEAL)
    expect(f.w.fact('ch1.shrines.crown') ?? 0).toBe(0)
    expect(f.w.fact('ch1.shrines.nails') ?? 0).toBe(0)
    // what each asks still lights it, and is taken
    const hat = carried(f, 'item/clothing/hat')
    lay(f, 'way.shrine.crown', hat)
    expect([f.w.hasStatus({ e: 'way.shrine.crown' }, 'lit'), !!f.w.get(hat.id)]).toEqual([true, false])
    const nail = carried(f, 'item/material/iron_ingot')
    lay(f, 'way.shrine.nails', nail)
    expect([f.w.hasStatus({ e: 'way.shrine.nails' }, 'lit'), !!f.w.get(nail.id)]).toEqual([true, false])
  })
})

describe("the Pilgrims' Rest after the knight", () => {
  it('neither the welcome nor the oath plays once the White Knight has fallen; the priest greets one who comes from him, and speaks of the road, not of kneeling to him', () => {
    const f = fresh()
    f.eng.author(() => {
      f.eng.quests.put('first_seal', 40)
      for (const k of [CH1.flameStolen, CH1.letter, 'ford.crossed', CH1.knight]) f.w.setFact(k, 1)
    })
    ticks(f, 3)
    teleport(f, 'waystation', 6, 13)
    expect(ticks(f, 600, () => !!f.w.fact('seen.rest_after') && !f.w.scene)).toBe(true)
    expect(f.w.fact('seen.rest_arrival') ?? 0).toBeFalsy()
    expect(f.w.fact('ch1.rest') ?? 0).toBe(0)
    // the altar of the five wounds: no oath to the living knight
    teleport(f, 'waystation.chapel', 8, 4)
    ticks(f, 300)
    expect(f.w.fact('seen.pilgrim_oath') ?? 0).toBeFalsy()
    expect(f.w.fact('ch1.oath') ?? 0).toBe(0)
    // his first word (E): nothing of kneeling, nothing of a Seal-bearer still on the road
    const caius = f.w.get('npc.caius')!
    const at = f.w.posOf(caius)!
    teleport(f, at.map, at.x, at.y + 1)
    f.w.player.facing = 'up'
    f.w.fx = []
    f.eng.interact('interact', 'player', { e: caius.id }, { instrument: null })
    const said = f.w.fx.find((x) => x.t === 'say' && x.who === caius.id) as { text: { en: string; zh: string } } | undefined
    expect(said).toBeTruthy()
    expect(said!.text.en).not.toMatch(/kneel|Seal-bearer will/i)
    expect(said!.text.zh).not.toContain('跪')
  })

  it('before the knight, the welcome and the oath play as ever', () => {
    const f = fresh()
    f.eng.author(() => {
      f.eng.quests.put('first_seal', 40)
      for (const k of [CH1.flameStolen, CH1.letter, 'ford.crossed']) f.w.setFact(k, 1)
    })
    ticks(f, 3)
    teleport(f, 'waystation', 6, 13)
    expect(ticks(f, 600, () => f.w.fact('ch1.rest') === 1 && !f.w.scene)).toBe(true)
    expect(f.w.fact('seen.rest_after') ?? 0).toBeFalsy()
    teleport(f, 'waystation.chapel', 8, 4)
    expect(ticks(f, 900, () => f.w.fact('ch1.oath') === 1 && !f.w.scene)).toBe(true)
  })
})

describe("the Rest's chapel", () => {
  it('its litany on the bookstand is read with a hand (E), as any written thing; the skill books are Firstlight\'s chapel\'s', () => {
    const f = fresh()
    const litany = Object.values(f.w.state.entities).find((e) => e.type === 'fixture/furniture/bookstand' && e.place.on === 'tile' && e.place.map === 'waystation.chapel')!
    const at = f.w.posOf(litany)!
    teleport(f, at.map, at.x, at.y + 1)
    f.w.player.facing = 'up'
    // what E says it will do there: read it
    expect(textOf(f.eng.controls.plan('hands', { x: at.x, y: at.y })?.label)).toBe('Read The Litany of the Five')
    f.w.fx = []
    f.eng.act('hands', 'player', { e: litany.id }, { instrument: null })
    ticks(f, 2)
    expect(f.w.fx.some((x) => x.t === 'panel')).toBe(false)
    expect(JSON.stringify(f.w.fx.filter((x) => x.t === 'say'))).toContain('极夜便不会归来')
    // the chapel's stand in Firstlight still opens its shelves
    const books = f.w.posOf(f.w.get('church.books')!)!
    teleport(f, books.map, books.x, books.y + 1)
    f.w.player.facing = 'up'
    expect(textOf(f.eng.controls.plan('hands', { x: books.x, y: books.y })?.label)).toMatch(/^Trade at /)
    f.w.fx = []
    f.eng.act('hands', 'player', { e: 'church.books' }, { instrument: null })
    ticks(f, 2)
    expect(f.w.fx.some((x) => x.t === 'panel' && x.panel === 'shop:books')).toBe(true)
  })
})

describe("the oath's scallop", () => {
  it("is the pilgrim's own (sworn): taking it does not count as finding the scallop of the pilgrim before (The Pilgrim Before)", () => {
    const f = fresh()
    f.eng.author(() => {
      f.eng.quests.put('scallop', 10)
      f.eng.quests.put('first_seal', 40)
      for (const k of [CH1.flameStolen, CH1.letter, 'ford.crossed']) f.w.setFact(k, 1)
    })
    ticks(f, 3)
    expect(f.eng.quests.stage('scallop')).toBe(10)
    f.eng.author(() => f.w.setFact('ch1.oath', 1))
    ticks(f, 5)
    expect(f.eng.quests.stage('first_seal')).toBe(50)
    const mine = [f.w.player.held, ...(f.w.player.contents ?? [])].map((id) => f.w.get(id)).filter((e) => e?.type.startsWith('item/valuable/scallop'))
    expect(mine.map((e) => e!.type)).toEqual([SWORN_SCALLOP])
    expect(f.eng.quests.stage('scallop')).toBe(10)
    // his scallop, taken (F) at the forest camp, still is what Ilse asks after
    const his = Object.values(f.w.state.entities).find((e) => e.type === 'item/valuable/scallop')!
    const at = f.w.posOf(his)!
    ticks(f, 900, () => !f.w.scene)
    teleport(f, at.map, at.x, at.y + 1)
    f.w.player.facing = 'up'
    ticks(f, 900, () => !f.w.scene)
    const plan = f.eng.controls.plan('take', { x: at.x, y: at.y })!
    f.eng.controls.run(plan, true)
    ticks(f, 3)
    expect(f.eng.quests.stage('scallop')).toBe(20)
  })
})

describe('an older save at the First Seal across the river', () => {
  it('shows the oath at the Rest (stage 40 showed the knight before the road came between), and the oath moves it on', () => {
    const f = fresh()
    f.eng.author(() => {
      f.eng.quests.put('first_seal', 40)
      for (const k of [CH1.flameStolen, CH1.letter, 'ford.crossed']) f.w.setFact(k, 1)
    })
    ticks(f, 3)
    // as the stage was before 2026-10-12: the knight shown, no oath
    const old = structuredClone(f.game.save())
    const q = old.state.entities['quest.first_seal']
    expect(q.props?.stage).toBe(40)
    delete q.props!['obj.oath']
    q.props!['obj.knight'] = 'shown'
    const loaded = Game.load(old, f.index, onto, lib(), GAME.upgradeSave)
    for (const c of f.chunks) loaded.loadChunk(decodeChunk(c))
    const lw = loaded.engine.world
    const lq = lw.get('quest.first_seal')!
    expect(lw.prop(lq, 'obj.oath')).toBe('shown')
    expect(lw.prop(lq, 'obj.knight')).toBeUndefined()
    expect(loaded.engine.quests.journal().find((j) => j.quest === 'first_seal')!.objectives.filter((o) => o.state === 'open').map((o) => o.id)).toEqual(['oath'])
    loaded.engine.author(() => lw.setFact('ch1.oath', 1))
    for (let i = 0; i < 5; i++) loaded.engine.tick()
    expect(loaded.engine.quests.stage('first_seal')).toBe(50)
  })
})

describe("Firstlight's chapel", () => {
  it("is Sister Ilse's, behind Astra's altar on the square: Brother Anselm keeps its bookstand; the First Dawn's is the chapel on Dawn Hill", () => {
    const f = fresh()
    const door = f.w.map('meadow')!.portals.find((p) => p.to === 'meadow.church')!
    const altar = f.w.posOf(f.w.get('village.astra')!)!
    expect([door.x, door.y + 2]).toEqual([altar.x, altar.y])
    expect(f.w.map('meadow.church')!.name).toEqual({ en: 'Firstlight Chapel', zh: '初原村礼拜堂' })
    expect(f.w.posOf(f.w.get('church.books')!)!.map).toBe('meadow.church')
    expect(f.w.map('chapel')!.name).toEqual({ en: 'Chapel of the First Dawn', zh: '初晓礼拜堂' })
    const sign = f.w.get(CHAPEL_SIGN.id)!
    expect(f.w.posOf(sign)).toMatchObject({ map: 'meadow', x: CHAPEL_SIGN.at[0], y: CHAPEL_SIGN.at[1] })
  })

  it('an older save keeps its sign where the church stood: on loading it stands by the chapel and says whose it is', () => {
    const f = fresh()
    const old = structuredClone(f.game.save())
    const sign = old.state.entities[CHAPEL_SIGN.id]
    sign.place = { on: 'tile', map: 'meadow', x: CHAPEL_SIGN.was[0], y: CHAPEL_SIGN.was[1] }
    sign.props = { ...sign.props, text: 'CHURCH OF THE FIRST DAWN — skill books at the stand inside, from Brother Anselm.', text_zh: '初晓教堂——里面的书架上有技能书，找安塞姆修士。' }
    const loaded = Game.load(old, f.index, onto, lib(), GAME.upgradeSave)
    const s = loaded.engine.world.get(CHAPEL_SIGN.id)!
    expect(s.place).toMatchObject({ on: 'tile', map: 'meadow', x: CHAPEL_SIGN.at[0], y: CHAPEL_SIGN.at[1] })
    expect(s.props?.text_zh).toBe(CHAPEL_SIGN.text_zh)
  })
})
