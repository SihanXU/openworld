// The NPC sandbox (docs/npc-sandbox.md): the people of the demo as playable as The Elder Scrolls' — whose things
// are, deeds seen and judged, faces and descriptions, memory and regard, gossip, the watch and its bounty, arrest
// and its choices, death and bodies, talk, trade, pockets, followers, and the hungry who steal. Each played on the
// real demo world through the player's own inputs (and the people's own goals), in strict mode.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_HOUR, buildRequest, tickAt, type Engine, type Entity, type FxEvent, type Look } from '@openworld/engine'
import { bountyKey, lawId, socialOf } from '@openworld/modules'
import { BASE_RULES, STORY_RULES, SOCIAL_COIN, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const MAP = 'meadow'

interface S {
  game: Game
  eng: Engine
  fx: FxEvent[]
}

/** A fresh world, the player in Firstlight Village at one in the afternoon, the people where their day has them. */
function fresh(): S {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  // no AI: the holes' defaults
  game.mods.provider = undefined
  const eng = game.engine
  const fx: FxEvent[] = []
  const drain = eng.world.drainFx.bind(eng.world)
  eng.world.drainFx = () => {
    const out = drain()
    fx.push(...out)
    return out
  }
  eng.author(() => {
    eng.world.setFact('seen.arrival', true)
    eng.world.setFact('seen.village_arrival', true)
    eng.quests.put('descent', 'done')
    eng.teleport(eng.world.player, { map: MAP, x: 20, y: 15 })
  })
  // the hour has begun (those whose day leads here have come): the scene the tests set stays theirs
  eng.npcs.begin(MAP)
  return { game, eng, fx }
}

const W = (s: S) => s.eng.world
const P = (s: S) => W(s).player
const get = (s: S, id: string) => W(s).get(id)!
/** Every fx so far (drained and not). */
const fxOf = (s: S) => [...s.fx, ...W(s).fx]
const author = <T>(s: S, f: () => T): T => s.eng.author(f)
/** Someone set down where the test wants them, facing a way. */
function put(s: S, id: string, x: number, y: number, facing: Entity['facing'] = 'down', map = MAP): Entity {
  const e = get(s, id)
  author(s, () => {
    W(s).place(e, { on: 'tile', map, x, y })
    e.facing = facing
  })
  s.eng.settle()
  return e
}
/** Everyone else sent away (the scene is the test's: no stray seers). */
function clear(s: S, keep: string[]): void {
  author(s, () => {
    for (const e of Object.values(W(s).state.entities)) if (e.npc && !keep.includes(e.id) && e.place.on === 'tile') W(s).place(e, { on: 'tile', map: 'offstage', x: 1, y: 1 })
  })
}
const make = (s: S, type: string, place: Entity['place'], props?: Entity['props']) => author(s, () => W(s).create(type, place, props ? { props } : {}))
const coins = (s: S, holder: string, n: number) => author(s, () => { for (let i = 0; i < n; i++) W(s).create(SOCIAL_COIN, { on: 'inside', holder }) })
const purse = (s: S, id: string) => socialOf(s.eng).purse(get(s, id))
const bounty = (s: S, who = 'player') => socialOf(s.eng).bounty('firstlight', who)
const deeds = (s: S, id: string) => get(s, id).npc?.memory?.deeds ?? []
const ticks = (s: S, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    if (W(s).scene?.waiting === 'advance') s.eng.story.advance()
    s.eng.tick()
    if (until?.()) return true
  }
  return !!until?.()
}
const take = (s: S, id: string) => s.eng.act('take', P(s).id, { e: id }, { instrument: null, params: { into: 'contents' } })

describe('whose things are (docs/npc-sandbox.md §2.1)', () => {
  it('a thing is its own owner\'s, else what holds it, else the region it lies in; taken by another, it stays theirs', () => {
    const s = fresh()
    clear(s, [])
    const so = socialOf(s.eng)
    const marta = get(s, 'npc.marta')
    // what a person carries is theirs; a household's doorstep makes what lies on it the household's
    const loaf = make(s, 'item/food/bread', { on: 'inside', holder: marta.id })
    expect(so.ownerOf(loaf)).toBe('npc.marta')
    const step = make(s, 'item/food/bread', { on: 'tile', map: MAP, x: 9, y: 9 })
    expect(so.ownerOf(step)).toBe('household:cook')
    expect(so.relation(so.ownerOf(step), get(s, 'npc.mia'))).toBe('ours')
    // the F label says so
    put(s, 'player', 9, 10, 'up')
    const plan = s.eng.controls.plan('take', { x: 9, y: 9 })
    expect(plan?.steal).toBe(true)
    expect(plan?.label).toEqual({ en: 'Steal Bread', zh: '偷走面包' })
    // taken by the traveller, it is still the household's (stolen: held by one who does not own it)
    take(s, step.id)
    expect(step.place).toMatchObject({ holder: 'player' })
    expect(W(s).prop(step, 'owner')).toBe('household:cook')
    expect(so.isAnothers(step, P(s))).toBe(true)
  })
})

describe('deeds seen, remembered, told to the watch (§2.2–2.7)', () => {
  it('a theft in the open: the owner cries out and asks it back, a guard who sees it charges the bounty at once', () => {
    const s = fresh()
    clear(s, ['npc.marta', 'npc.holt'])
    put(s, 'player', 20, 15, 'up')
    put(s, 'npc.marta', 21, 15, 'left')
    put(s, 'npc.holt', 22, 16, 'left')
    const loaf = make(s, 'item/food/bread', { on: 'tile', map: MAP, x: 20, y: 14 }, { owner: 'npc.marta' })
    take(s, loaf.id)
    // Marta: a theft against her, by the traveller (close, in daylight: she knows the face now)
    const m = deeds(s, 'npc.marta')
    expect(m.map((d) => [d.deed, d.by, d.against])).toEqual([['theft', 'player', 'npc.marta']])
    expect(socialOf(s.eng).regard(get(s, 'npc.marta'), 'player')).toBeLessThan(0)
    expect(W(s).hasStatus({ e: 'npc.marta' }, 'reporting')).toBe(true)
    // Holt keeps the watch: told at once, the bounty is half the loaf's worth (at least five)
    expect(bounty(s)).toBe(5)
    expect(deeds(s, 'npc.holt')[0]).toMatchObject({ deed: 'theft', by: 'player', reported: true })
    // the same deed reported again by Marta does not charge it twice
    ticks(s, 400)
    expect(bounty(s)).toBe(5)
  })

  it('sneaking behind someone, a hand in their pocket goes unseen: the thing taken is still theirs', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'up')
    put(s, 'player', 20, 15, 'up')
    s.eng.controls.toggle('sneaking', true)
    const bread = get(s, 'npc.cass').contents!.map((id) => W(s).get(id)!).find((e) => e.type === 'item/food/bread')!
    // F on her while sneaking opens her pockets
    const plan = s.eng.controls.plan('take', { x: 20, y: 14 })
    expect(plan?.rule).toBe('people/pockets')
    s.eng.controls.run(plan!)
    expect(fxOf(s).some((f) => f.t === 'panel' && f.panel === 'pockets' && f.by === 'npc.cass')).toBe(true)
    s.eng.controls.pocket('npc.cass', bread.id, true)
    expect(bread.place).toMatchObject({ holder: 'player' })
    expect(W(s).prop(bread, 'owner')).toBe('npc.cass')
    expect(deeds(s, 'npc.cass')).toEqual([])
  })

  it('a face under a hood is not known: the stranger is remembered by the look, and known again when seen close', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    // the traveller in a hood (worn: what is seen)
    const hood = make(s, 'item/clothing/hood', { on: 'inside', holder: 'player' })
    s.eng.controls.wear(hood.id, true)
    expect(W(s).hasTag(P(s), 'look:hooded')).toBe(true)
    put(s, 'npc.cass', 20, 10, 'down')
    put(s, 'player', 20, 13, 'up')
    const cup = make(s, 'item/vessel/cup', { on: 'tile', map: MAP, x: 20, y: 12 }, { owner: 'household:wood' })
    take(s, cup.id)
    const [d] = deeds(s, 'npc.cass')
    expect(d.deed).toBe('theft')
    expect(d.by).toBeUndefined()
    expect(d.words).toMatch(/hood/)
    // later, the hooded one comes close: she knows them
    put(s, 'player', 20, 11, 'up')
    ticks(s, 12)
    expect(deeds(s, 'npc.cass')[0].by).toBe('player')
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass' && JSON.stringify(f.text).includes('It was you'))).toBe(true)
  })

  it('what is seen is told: a witness tells the next person it meets, who remembers it second-hand', () => {
    const s = fresh()
    clear(s, ['npc.cass', 'npc.marta'])
    put(s, 'npc.cass', 20, 13, 'down')
    put(s, 'npc.marta', 30, 25, 'down')
    put(s, 'player', 20, 15, 'up')
    const cup = make(s, 'item/vessel/cup', { on: 'tile', map: MAP, x: 20, y: 14 }, { owner: 'npc.joss' })
    take(s, cup.id)
    expect(deeds(s, 'npc.cass')).toHaveLength(1)
    put(s, 'npc.marta', 21, 13, 'left')
    // rounds of gossip (every gossipEvery ticks; at each, two who meet talk now and then)
    for (let i = 0; i < 30 && !deeds(s, 'npc.marta').length; i++) {
      put(s, 'npc.cass', 20, 13, 'down')
      put(s, 'npc.marta', 21, 13, 'left')
      author(s, () => (W(s).state.tick = Math.ceil((W(s).state.tick + 1) / 150) * 150 - 1))
      ticks(s, 1)
    }
    const heard = deeds(s, 'npc.marta')[0]
    expect(heard).toMatchObject({ deed: 'theft', by: 'player', firsthand: false })
    expect(socialOf(s.eng).regard(get(s, 'npc.marta'), 'player')).toBeLessThan(0)
    // told once: she is not told it again
    expect(deeds(s, 'npc.cass')[0].told).toEqual(['npc.marta'])
  })
})

describe('the watch: arrest and its choices (§2.7)', () => {
  function wanted(s: S, n: number): void {
    author(s, () => W(s).setProp(get(s, lawId('firstlight')), bountyKey('player'), n))
  }

  it('a guard who knows the wanted goes to them and stops them; paid, the bounty is cleared and what was taken goes back', () => {
    const s = fresh()
    clear(s, ['npc.holt', 'npc.marta'])
    put(s, 'npc.holt', 20, 19, 'up')
    put(s, 'npc.marta', 10, 10, 'down')
    put(s, 'player', 20, 14, 'down')
    author(s, () => socialOf(s.eng).meet(get(s, 'npc.holt'), 'player'))
    const loaf = make(s, 'item/food/bread', { on: 'inside', holder: 'player' }, { owner: 'npc.marta' })
    coins(s, 'player', 20)
    wanted(s, 12)
    expect(ticks(s, 300, () => fxOf(s).some((f) => f.t === 'talk' && f.arrest && f.who === 'npc.holt'))).toBe(true)
    // the talk the guard opens: the watch's choices only
    const view = socialOf(s.eng).talkView(get(s, 'npc.holt'), P(s), true)
    expect(view.verbs.map((v) => v.id)).toEqual(['pay', 'jail', 'persuade', 'bribe', 'resist'])
    s.eng.controls.talk('npc.holt', 'pay')
    expect(bounty(s)).toBe(0)
    expect(purse(s, 'player')).toBe(8)
    expect(purse(s, 'npc.holt')).toBe(25 + 12)
    expect(loaf.place).toEqual({ on: 'inside', holder: 'npc.marta' })
  })

  it('too poor to pay, the cells: time passes, the bounty is cleared', () => {
    const s = fresh()
    clear(s, ['npc.holt'])
    put(s, 'npc.holt', 20, 16, 'up')
    put(s, 'player', 20, 15, 'down')
    wanted(s, 40)
    const t0 = W(s).state.tick
    s.eng.controls.talk('npc.holt', 'pay')
    ticks(s, 1)
    expect(bounty(s)).toBe(0)
    // behind the watch house, the cells; the hours pass an hour a tick (the clock shows them)
    const [cx, cy] = W(s).map(MAP)!.anchors!.cells
    expect(W(s).posOf(P(s))).toMatchObject({ map: MAP, x: cx, y: cy })
    ticks(s, 4)
    expect(W(s).state.tick - t0).toBeGreaterThanOrEqual(2 * TICKS_PER_HOUR)
  })

  it('bribed: the bounty and half again, and what was taken is kept; murder is never bought off', () => {
    const s = fresh()
    clear(s, ['npc.holt'])
    put(s, 'npc.holt', 20, 16, 'up')
    put(s, 'player', 20, 15, 'down')
    const ring = make(s, 'item/valuable/ring', { on: 'inside', holder: 'player' }, { owner: 'npc.edda' })
    coins(s, 'player', 30)
    wanted(s, 10)
    s.eng.controls.talk('npc.holt', 'bribe')
    expect(bounty(s)).toBe(0)
    expect(purse(s, 'player')).toBe(15)
    expect(ring.place).toMatchObject({ holder: 'player' })
    wanted(s, 1000)
    expect(socialOf(s.eng).talkView(get(s, 'npc.holt'), P(s), true).verbs.map((v) => v.id)).toEqual(['jail', 'resist'])
  })

  it('resisting, the guard fights and calls the watch', () => {
    const s = fresh()
    clear(s, ['npc.holt', 'npc.fennick'])
    put(s, 'npc.holt', 20, 16, 'up')
    put(s, 'npc.fennick', 23, 16, 'left')
    put(s, 'player', 20, 15, 'down')
    wanted(s, 10)
    s.eng.controls.talk('npc.holt', 'resist')
    expect(get(s, 'npc.holt').ai?.foes).toContain('player')
    expect(get(s, 'npc.fennick').ai?.foes).toContain('player')
    expect(W(s).hasStatus({ e: 'npc.holt' }, 'drawn')).toBe(true)
  })

  it('anyone may be wanted: the hungry drifter with no coin takes a meal, is seen, and the watch takes him to the cells', () => {
    const s = fresh()
    clear(s, ['npc.vigo', 'npc.holt', 'npc.marta'])
    put(s, 'npc.vigo', 20, 15, 'up')
    put(s, 'npc.holt', 22, 15, 'left')
    put(s, 'npc.marta', 18, 15, 'right')
    put(s, 'player', 30, 25, 'up')
    // hungry (he came in on an empty stomach); a loaf of Marta's on the ground by him
    author(s, () => W(s).setStatus({ e: 'npc.vigo' }, 'hungry', -1))
    const loaf = make(s, 'item/food/bread', { on: 'tile', map: MAP, x: 20, y: 14 }, { owner: 'npc.marta' })
    expect(ticks(s, 200, () => deeds(s, 'npc.holt').some((d) => d.by === 'npc.vigo'))).toBe(true)
    expect(bounty(s, 'npc.vigo')).toBeGreaterThan(0)
    // the watch stops him: no coin, the cells
    expect(ticks(s, 600, () => W(s).hasStatus({ e: 'npc.vigo' }, 'jailed'))).toBe(true)
    expect(bounty(s, 'npc.vigo')).toBe(0)
    expect(W(s).posOf(get(s, 'npc.vigo'))).toMatchObject({ map: MAP })
    void loaf
  })
})

describe('violence, death and bodies (§2.8)', () => {
  it('struck, one who fights fights back; one who flees is afraid', () => {
    const s = fresh()
    clear(s, ['npc.bram'])
    put(s, 'npc.bram', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    s.eng.controls.run(s.eng.controls.plan('use', { x: 20, y: 14 })!, true)
    expect(get(s, 'npc.bram').ai?.foes).toContain('player')
    put(s, 'npc.bram', 5, 25)
    // the fist rests a moment between blows
    ticks(s, 20)
    put(s, 'npc.bram', 5, 25)
    put(s, 'npc.cass', 20, 14, 'down', MAP)
    put(s, 'player', 20, 15, 'up')
    s.eng.controls.run(s.eng.controls.plan('use', { x: 20, y: 14 })!, true)
    expect(socialOf(s.eng).fears(get(s, 'npc.cass'), 'player')).toBe(true)
    expect(deeds(s, 'npc.cass')[0]).toMatchObject({ deed: 'assault', by: 'player' })
  })

  it('a weapon on a person is the AI\'s to say unless it is drawn; drawn, it is a blow', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const sword = make(s, 'item/weapon/blunt/club', { on: 'inside', holder: 'player' })
    s.eng.controls.sync()
    s.eng.controls.select(P(s).slots!.indexOf(s.eng.controls.key(sword)))
    expect(s.eng.controls.plan('use', { x: 20, y: 14 })?.unknown).toBe(true)
    s.eng.controls.toggle('drawn', true)
    const plan = s.eng.controls.plan('use', { x: 20, y: 14 })!
    expect(plan.attack).toBe(true)
  })

  it('killed, a villager the story does not need becomes their body: a container of what they carried, their household\'s; the watch will not forgive it', () => {
    const s = fresh()
    clear(s, ['npc.cass', 'npc.holt'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'npc.holt', 23, 15, 'left')
    put(s, 'player', 20, 15, 'up')
    // Holt knows the traveller's face (they have met)
    author(s, () => socialOf(s.eng).meet(get(s, 'npc.holt'), 'player'))
    expect(W(s).hasTag(get(s, 'npc.cass'), 'essential')).toBe(false)
    author(s, () => W(s).setProp(get(s, 'npc.cass'), 'hp', 1))
    s.eng.controls.run(s.eng.controls.plan('use', { x: 20, y: 14 })!, true)
    const body = get(s, 'npc.cass')
    expect(body.type).toBe('fixture/remains/body')
    expect(body.npc).toBeUndefined()
    expect(W(s).prop(body, 'owner')).toBe('household:wood')
    expect(W(s).hasStatus({ e: body.id }, 'open')).toBe(true)
    expect(body.contents?.length).toBeGreaterThan(0)
    expect(deeds(s, 'npc.holt')[0]).toMatchObject({ deed: 'murder', by: 'player' })
    expect(bounty(s)).toBe(1000)
    expect(get(s, 'npc.holt').ai?.foes).toContain('player')
    // looting the body is taking what is another's
    const thing = W(s).get(body.contents![0])!
    expect(socialOf(s.eng).isAnothers(thing, P(s))).toBe(true)
    // a hand on it searches it: its things in their panel
    const search = s.eng.controls.plan('hands', { x: 20, y: 14 })!
    expect(search.label).toEqual({ en: "Search Cass's body", zh: '翻找卡丝的遗体' })
    expect(search.panel).toBe(body.id)
  })
})

describe('talk, regard, trade, followers (§2.4, §2.9, §2.10)', () => {
  it('spoken to, a person warms once a day and opens the talk; asked, they tell the news', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const r0 = socialOf(s.eng).regard(get(s, 'npc.cass'), 'player')
    s.eng.controls.run(s.eng.controls.plan('hands', { x: 20, y: 14 })!)
    expect(fxOf(s).some((f) => f.t === 'talk' && f.who === 'npc.cass')).toBe(true)
    const r1 = socialOf(s.eng).regard(get(s, 'npc.cass'), 'player')
    expect(r1).toBeGreaterThan(r0)
    s.eng.controls.run(s.eng.controls.plan('hands', { x: 20, y: 14 })!)
    expect(socialOf(s.eng).regard(get(s, 'npc.cass'), 'player')).toBe(r1)
    expect(socialOf(s.eng).knows(get(s, 'npc.cass'), 'player')).toBe(true)
    const verbs = socialOf(s.eng).verbs(get(s, 'npc.cass'), P(s)).map((v) => v.id)
    expect(verbs).toEqual(expect.arrayContaining(['ask', 'follow', 'persuade', 'intimidate']))
    // (everyone sells something that fits who they are: the weaver her cloth)
    expect(verbs).toContain('trade')
    s.eng.controls.talk('npc.cass', 'ask')
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass')).toBe(true)
  })

  it('a gift raises regard by its worth; what was taken given back is forgiven', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const cup = make(s, 'item/vessel/cup', { on: 'tile', map: MAP, x: 21, y: 15 }, { owner: 'npc.cass' })
    take(s, cup.id)
    expect(socialOf(s.eng).grudge(get(s, 'npc.cass'), 'player')).toBeDefined()
    const before = socialOf(s.eng).regard(get(s, 'npc.cass'), 'player')
    s.eng.act('put', 'player', { e: 'npc.cass' }, { instrument: { e: cup.id } })
    expect(cup.place).toEqual({ on: 'inside', holder: 'npc.cass' })
    expect(socialOf(s.eng).grudge(get(s, 'npc.cass'), 'player')).toBeUndefined()
    expect(socialOf(s.eng).regard(get(s, 'npc.cass'), 'player')).toBeGreaterThan(before)
  })

  it('a merchant sells at its price (worth, markup, regard) and buys what is yours; a fence takes what is not', () => {
    const s = fresh()
    clear(s, ['npc.marta', 'npc.tobin'])
    put(s, 'npc.marta', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    coins(s, 'player', 20)
    s.eng.controls.talk('npc.marta', 'trade')
    expect(fxOf(s).some((f) => f.t === 'panel' && f.panel === 'trade' && f.by === 'npc.marta')).toBe(true)
    const bread = socialOf(s.eng).stock(get(s, 'npc.marta')).find((e) => e.type === 'item/food/bread')!
    const price = socialOf(s.eng).priceToBuy(bread, get(s, 'npc.marta'), P(s))
    // a loaf is worth 6; the merchant's quarter on it
    expect(price).toBe(8)
    const before = purse(s, 'npc.marta')
    s.eng.controls.trade('npc.marta', bread.id, true)
    expect(bread.place).toEqual({ on: 'inside', holder: 'player' })
    expect(W(s).prop(bread, 'owner')).toBe('player')
    expect(purse(s, 'player')).toBe(20 - price)
    expect(purse(s, 'npc.marta')).toBe(before + price)
    // a stolen thing: Marta will not buy it, Tobin (a fence) will, for less
    const ring = make(s, 'item/valuable/ring', { on: 'inside', holder: 'player' }, { owner: 'npc.edda' })
    s.eng.controls.trade('npc.marta', ring.id, false)
    expect(ring.place).toEqual({ on: 'inside', holder: 'player' })
    put(s, 'npc.tobin', 20, 14, 'down')
    put(s, 'npc.marta', 5, 25)
    const fence = socialOf(s.eng).priceToSell(ring, P(s), get(s, 'npc.tobin'))
    const p0 = purse(s, 'player')
    s.eng.controls.trade('npc.tobin', ring.id, false)
    expect(ring.place).toEqual({ on: 'inside', holder: 'npc.tobin' })
    expect(W(s).prop(ring, 'owner')).toBe('npc.tobin')
    expect(purse(s, 'player')).toBe(p0 + fence)
  })

  it('asked to come along, one who does not know you well declines; a hireling follows, waits when told, and comes from map to map', () => {
    const s = fresh()
    clear(s, ['npc.cass', 'npc.vigo'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    s.eng.controls.talk('npc.cass', 'follow')
    expect(W(s).prop(get(s, 'npc.cass'), 'follow')).toBeUndefined()
    put(s, 'npc.vigo', 21, 15, 'left')
    s.eng.controls.talk('npc.vigo', 'follow')
    expect(W(s).prop(get(s, 'npc.vigo'), 'follow')).toBe('player')
    // the player walks off to the grassland: he comes too
    author(s, () => s.eng.travel(P(s), { map: 'pasture', x: 20, y: 3 }))
    ticks(s, 5)
    expect(W(s).posOf(get(s, 'npc.vigo'))?.map).toBe('pasture')
    put(s, 'player', W(s).posOf(get(s, 'npc.vigo'))!.x, W(s).posOf(get(s, 'npc.vigo'))!.y + 1, 'up', 'pasture')
    s.eng.controls.talk('npc.vigo', 'dismiss')
    expect(W(s).prop(get(s, 'npc.vigo'), 'follow')).toBeUndefined()
  })

  it('intimidated, a witness lets it go (and will not tell the watch)', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const cup = make(s, 'item/vessel/cup', { on: 'tile', map: MAP, x: 21, y: 15 }, { owner: 'npc.joss' })
    take(s, cup.id)
    expect(deeds(s, 'npc.cass')[0].by).toBe('player')
    // a strong traveller with a blade out cows her (the roll: levels, arms)
    author(s, () => W(s).setProp(P(s), 'level', 12))
    s.eng.controls.toggle('drawn', true)
    s.eng.controls.talk('npc.cass', 'intimidate')
    expect(socialOf(s.eng).fears(get(s, 'npc.cass'), 'player')).toBe(true)
    expect(deeds(s, 'npc.cass')[0].settled).toBe(true)
    ticks(s, 400)
    expect(bounty(s)).toBe(0)
  })

  it('the modder sees a person: their role, ties, what they think of the one who acted and what they know of them', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const ev = s.eng.actEvent('hands', 'player', { e: 'npc.cass' }, undefined, { say: 'sing' })
    const req = buildRequest(s.eng, { ...ev, kind: 'impulse/handle', host: { e: 'npc.cass' } }, { defined: false }, 'r1')
    expect(req.event.host?.person).toMatchObject({ role: 'villager', household: 'wood', regard: 0 })
    expect(req.event.host?.person?.ties).toMatchObject({ Gus: 'husband' })
  })
})

describe('the night and the law of places (§2.6)', () => {
  it('on a household\'s doorstep at night, one awake there warns you off, then calls the watch', () => {
    const s = fresh()
    clear(s, ['npc.marta'])
    // Marta's doorstep (her household's); she is up until ten, by a fire's light (she sees who it is)
    author(s, () => (W(s).state.tick = tickAt(1, 21)))
    make(s, 'fixture/light/campfire', { on: 'tile', map: MAP, x: 11, y: 10 })
    author(s, () => W(s).setStatus({ e: W(s).entitiesAt(MAP, 11, 10).find((e) => e.type === 'fixture/light/campfire')!.id }, 'lit', -1))
    put(s, 'npc.marta', 9, 10, 'up')
    put(s, 'player', 9, 9, 'down')
    ticks(s, 12)
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.marta' && JSON.stringify(f.text).includes('at this hour'))).toBe(true)
    // she stays at her door (the test keeps her there), the stranger stays on it
    for (let i = 0; i < 30 && !bounty(s); i++) {
      put(s, 'npc.marta', 9, 10, 'up')
      ticks(s, 10)
    }
    expect(deeds(s, 'npc.marta').filter((d) => d.deed === 'trespass' && d.by === 'player')).toHaveLength(1)
    expect(bounty(s)).toBe(5)
  })
})

describe('the people\'s looks are what is remembered (§2.3)', () => {
  it('two looks alike enough are taken for one', () => {
    const s = fresh()
    const a = P(s).look as Look
    expect(socialOf(s.eng).likeness(a, a)).toBe(1)
    // another outfit is another look; a hood drawn up, too
    expect(socialOf(s.eng).likeness(a, { ...a, parts: { ...a.parts, outfit: 'outfit.cloak' } })).toBeLessThan(0.8)
    expect(socialOf(s.eng).likeness(a, { ...a, parts: { ...a.parts, hat: 'hat.hood' } })).toBeLessThan(0.8)
  })
})

describe('people make way, and keep it for one who faces them', () => {
  it('one holding still for the player keeps their place against another on their way (no two pushing each other out of it in turn)', () => {
    const s = fresh()
    clear(s, ['npc.cass', 'npc.gus'])
    // the player at the well, facing Cass below: she holds her round for them
    put(s, 'player', 20, 14, 'down')
    put(s, 'npc.cass', 20, 15, 'up')
    put(s, 'npc.gus', 19, 15, 'right')
    ticks(s, 2)
    expect(s.eng.npcs.holding(get(s, 'npc.cass'))).toBe(true)
    // Gus pushes on into her as long as it takes a swap: she keeps her place
    for (let i = 0; i < 10; i++) {
      put(s, 'npc.gus', 19, 15, 'right')
      s.eng.step(get(s, 'npc.gus'), 'right')
      ticks(s, 1)
    }
    expect(W(s).posOf(get(s, 'npc.cass'))).toMatchObject({ x: 20, y: 15 })
    // the player still swaps with her (pushing on into a person is the player's way past)
    put(s, 'player', 20, 14, 'down')
    let swapped = false
    for (let i = 0; i < 12 && !swapped; i++) {
      s.eng.step(P(s), 'down')
      ticks(s, 1)
      swapped = W(s).posOf(P(s))?.y === 15
    }
    expect(swapped).toBe(true)
  })
})
