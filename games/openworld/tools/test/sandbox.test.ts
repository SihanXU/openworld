// The NPC sandbox (docs/npc-sandbox.md): the people of the demo as playable as The Elder Scrolls' — whose things
// are, deeds seen and judged, faces and descriptions, memory and regard, gossip, the watch and its bounty, arrest
// and its choices, death and bodies, talk, trade, pockets, followers, and the hungry who steal. Each played on the
// real demo world through the player's own inputs (and the people's own goals), in strict mode.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, TICKS_PER_HOUR, buildRequest, tickAt, type Engine, type Entity, type FxEvent, type Look } from '@openworld/engine'
import { bountyKey, giftView, lawId, socialOf } from '@openworld/modules'
import { BASE_RULES, STORY_RULES, SOCIAL_COIN, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const MAP = 'meadow'
/** Marta's house: her household's home (village.ts). */
const HOME = 'meadow.cook'

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
    // what a person carries is theirs; a household's house makes what lies in it the household's (Marta's kitchen floor)
    const loaf = make(s, 'item/food/bread', { on: 'inside', holder: marta.id })
    expect(so.ownerOf(loaf)).toBe('npc.marta')
    const step = make(s, 'item/food/bread', { on: 'tile', map: HOME, x: 8, y: 7 })
    expect(so.ownerOf(step)).toBe('household:cook')
    expect(so.relation(so.ownerOf(step), get(s, 'npc.mia'))).toBe('ours')
    // the F label says so
    put(s, 'player', 8, 8, 'up', HOME)
    const plan = s.eng.controls.plan('take', { x: 8, y: 7 })
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
      // (only the two of them in the square: the hours pass, and the others' days would bring them back to it)
      clear(s, ['npc.cass', 'npc.marta'])
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
    expect(verbs).toEqual(expect.arrayContaining(['ask', 'follow', 'rob', 'steal', 'unbelief']))
    expect(verbs).not.toContain('persuade')
    expect(verbs).not.toContain('intimidate')
    // (everyone sells something that fits who they are: the weaver her cloth)
    expect(verbs).toContain('trade')
    s.eng.controls.talk('npc.cass', 'ask')
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass')).toBe(true)
  })

  it('trade is a merchant\'s: one who keeps none (a person record need not trade — the demo\'s all do) is not asked to, and asked anyway has nothing to sell', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    const cass = put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    expect(socialOf(s.eng).verbs(cass, P(s)).map((v) => v.id)).toContain('trade')
    author(s, () => W(s).removeTag(cass, 'merchant'))
    expect(socialOf(s.eng).verbs(cass, P(s)).map((v) => v.id)).not.toContain('trade')
    s.eng.controls.talk('npc.cass', 'trade')
    expect(fxOf(s).some((f) => f.t === 'panel')).toBe(false)
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass' && JSON.stringify(f.text).includes('没什么可卖'))).toBe(true)
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

  it('the hungry keep their food: a hungry seller offers no meal, so the loaf is eaten, not sold round and round', () => {
    const s = fresh()
    clear(s, ['npc.joss', 'npc.cass'])
    put(s, 'npc.joss', 20, 14, 'down')
    put(s, 'npc.cass', 20, 15, 'up')
    put(s, 'player', 30, 25, 'up')
    // both hungry, both with coin; only Cass has a loaf
    author(s, () => {
      for (const id of ['npc.joss', 'npc.cass']) {
        for (const x of [...(get(s, id).contents ?? [])].map((i) => W(s).get(i)!)) if (W(s).hasTag(x, 'edible')) W(s).destroy(x)
        W(s).setStatus({ e: id }, 'hungry', -1)
      }
    })
    coins(s, 'npc.joss', 20)
    const loaf = make(s, 'item/food/bread', { on: 'inside', holder: 'npc.cass' }, { owner: 'npc.cass' })
    expect(socialOf(s.eng).stock(get(s, 'npc.cass')).some((e) => e.id === loaf.id)).toBe(false)
    let buys = 0
    const dispatch = s.eng.dispatch.bind(s.eng)
    s.eng.dispatch = (ev) => ((ev.kind === 'act/hands' && ev.params?.say === 'buy' && buys++), dispatch(ev))
    // she eats it; he is offered none, so it never changes hands
    expect(ticks(s, 300, () => !W(s).get(loaf.id))).toBe(true)
    expect(buys).toBe(0)
    // fed, she sells again
    author(s, () => W(s).clearStatus({ e: 'npc.cass' }, 'hungry'))
    const more = make(s, 'item/food/bread', { on: 'inside', holder: 'npc.cass' }, { owner: 'npc.cass' })
    expect(socialOf(s.eng).stock(get(s, 'npc.cass')).some((e) => e.id === more.id)).toBe(true)
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

  it('a robbery: overwhelmed (twice her might), she hands over half her coin and her two dearest things, fears the robber and thinks far less of them; not today again', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const so = socialOf(s.eng)
    const cass = get(s, 'npc.cass')
    const coin0 = purse(s, 'npc.cass')
    const held0 = (cass.contents ?? []).length
    const r0 = so.regard(cass, 'player')
    // a strong traveller (might: level, attack and weapon, defence, body) against a villager
    author(s, () => W(s).setProp(P(s), 'level', 6))
    expect(so.might(P(s))).toBeGreaterThanOrEqual(so.might(cass) * 2)
    s.eng.controls.talk('npc.cass', 'rob')
    expect(purse(s, 'npc.cass')).toBe(coin0 - Math.ceil(coin0 / 2))
    expect(purse(s, 'player')).toBe(Math.ceil(coin0 / 2))
    // two things beside the coin, hers no more
    expect((cass.contents ?? []).length).toBe(held0 - Math.ceil(coin0 / 2) - 2)
    const loot = (P(s).contents ?? []).map((id) => get(s, id)).filter((e) => !so.isCoin(e))
    expect(loot.length).toBe(2)
    for (const it of loot) expect(W(s).prop(it, 'owner')).toBe('player')
    expect(so.fears(cass, 'player')).toBe(true)
    expect(so.regard(cass, 'player')).toBeLessThanOrEqual(r0 - 40)
    expect(W(s).hasStatus({ e: 'npc.cass' }, 'robbed')).toBe(true)
    expect(so.verbs(cass, P(s)).map((v) => v.id)).not.toContain('rob')
    // the traveller is whole
    expect(W(s).num(P(s), 'hp')).toBe(W(s).num(P(s), 'maxHp'))
  })

  it('a robbery that fails: the robber is beaten down to one point of health, and thought far less of', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const so = socialOf(s.eng)
    const cass = get(s, 'npc.cass')
    const coin0 = purse(s, 'npc.cass')
    const r0 = so.regard(cass, 'player')
    expect(so.might(P(s))).toBeLessThan(so.might(cass) * 2)
    s.eng.controls.talk('npc.cass', 'rob')
    expect(W(s).num(P(s), 'hp')).toBe(1)
    expect(purse(s, 'npc.cass')).toBe(coin0)
    expect(purse(s, 'player')).toBe(0)
    expect(so.regard(cass, 'player')).toBeLessThanOrEqual(r0 - 60)
    expect(fxOf(s).some((f) => f.t === 'log' && typeof f.text === 'object' && f.text.en === 'You are beaten.')).toBe(true)
    // nobody dies of a lesson: the traveller stands
    expect(W(s).hasStatus({ e: 'player' }, 'down')).toBe(false)
  })

  it('a hand in the pocket: a nimble thief takes a third of the coin and the dearest thing unnoticed; a clumsy one is beaten to half their health', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const so = socialOf(s.eng)
    const cass = get(s, 'npc.cass')
    const coin0 = purse(s, 'npc.cass')
    const r0 = so.regard(cass, 'player')
    // nimble (stealth, dodge, haste, levels): the roll all but sure
    author(s, () => W(s).setProp(P(s), 'stealth', 200))
    s.eng.controls.talk('npc.cass', 'steal')
    expect(purse(s, 'player')).toBe(Math.ceil(coin0 * 0.34))
    expect((P(s).contents ?? []).map((id) => get(s, id)).filter((e) => !so.isCoin(e)).length).toBe(1)
    // she noticed nothing: no word, no grudge
    expect(so.regard(cass, 'player')).toBe(r0)
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass')).toBe(false)
    expect(W(s).hasStatus({ e: 'npc.cass' }, 'pilfered')).toBe(true)
    expect(so.verbs(cass, P(s)).map((v) => v.id)).not.toContain('steal')
    // the next day, against one who sees everything: caught, beaten to half, and thought far less of
    author(s, () => {
      W(s).clearStatus({ e: 'npc.cass' }, 'pilfered')
      W(s).setProp(P(s), 'stealth', 0)
      W(s).setProp(cass, 'perception', 200)
    })
    const hp0 = W(s).num(P(s), 'hp')
    s.eng.controls.talk('npc.cass', 'steal')
    expect(W(s).num(P(s), 'hp')).toBe(Math.floor(hp0 / 2))
    expect(so.regard(cass, 'player')).toBeLessThanOrEqual(r0 - 40)
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass')).toBe(true)
  })

  it('a chat: three things or more to say, one of them what they like best — said once, then known to the gift panel', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const so = socialOf(s.eng)
    const cass = get(s, 'npc.cass')
    const fav = so.favourite(cass)!
    expect(W(s).onto.hasType(fav)).toBe(true)
    expect(so.verbs(cass, P(s)).map((v) => v.id)).toEqual(expect.arrayContaining(['chat', 'gift']))
    // the gift panel before: a riddle
    expect(so.toldFavourite(cass, 'player')).toBe(false)
    expect(giftView(s.eng, cass)).toMatchObject({ who: 'npc.cass', told: false })
    expect(giftView(s.eng, cass).favourite).toBeUndefined()
    const said = new Set<string>()
    for (let i = 0; i < 40; i++) {
      s.eng.controls.talk('npc.cass', 'chat')
      const last = fxOf(s).filter((f): f is Extract<FxEvent, { t: 'say' }> => f.t === 'say' && f.who === 'npc.cass').pop()!
      said.add(typeof last.text === 'string' ? last.text : last.text.en)
    }
    expect(said.size).toBeGreaterThanOrEqual(3)
    // what she likes best was among them, by name, and she remembers having said it
    const name = W(s).onto.resolve(fav).name
    const favName = typeof name === 'string' ? name : name!.en
    expect([...said].some((t) => t.includes(favName))).toBe(true)
    expect(so.toldFavourite(cass, 'player')).toBe(true)
    // the gift panel after: her favourite named, drawn by its kind
    const view = giftView(s.eng, cass)
    expect(view.told).toBe(true)
    expect(view.favourite).toMatchObject({ type: fav })
  })

  it('a gift from the panel: the thing they like best delights them (+30, once a day), the rest by its worth; the bag is shown the warmest first', () => {
    const s = fresh()
    clear(s, ['npc.cass'])
    put(s, 'npc.cass', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const so = socialOf(s.eng)
    const cass = get(s, 'npc.cass')
    const fav = so.favourite(cass)!
    author(s, () => cass.npc!.memory = { ...(cass.npc!.memory ?? {}), toldFavourite: ['player'] })
    const a = make(s, fav, { on: 'inside', holder: 'player' })
    const b = make(s, fav, { on: 'inside', holder: 'player' })
    const stick = make(s, 'item/material/stick', { on: 'inside', holder: 'player' })
    const view = giftView(s.eng, cass)
    expect(view.items[0]).toMatchObject({ warmth: 4, favourite: true, count: 2 })
    expect(view.items.find((i) => i.id === stick.id)!.warmth).toBeLessThan(4)
    const r0 = so.regard(cass, 'player')
    s.eng.controls.gift('npc.cass', a.id)
    expect(a.place).toEqual({ on: 'inside', holder: 'npc.cass' })
    expect(W(s).hasStatus({ e: 'npc.cass' }, 'cheered')).toBe(true)
    const r1 = so.regard(cass, 'player')
    // +30 (harder as regard rises: at least the plain gift's worth and well over it)
    expect(r1 - r0).toBeGreaterThanOrEqual(20)
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.cass')).toBe(true)
    expect(giftView(s.eng, cass).cheered).toBe(true)
    // the second today: as any gift of its worth
    s.eng.controls.gift('npc.cass', b.id)
    expect(b.place).toEqual({ on: 'inside', holder: 'npc.cass' })
    expect(so.regard(cass, 'player') - r1).toBeLessThan(10)
    // a stick: a trifle, taken as any gift
    s.eng.controls.gift('npc.cass', stick.id)
    expect(stick.place).toEqual({ on: 'inside', holder: 'npc.cass' })
    expect(so.regard(cass, 'player')).toBeGreaterThan(r1)
  })

  it('every person has a favourite of a kind the world holds and at least two chat lines of their own (three things to say with it)', () => {
    const { index } = buildFord()
    const people = index.npcs.filter((n) => n.npc?.person)
    expect(people.length).toBeGreaterThan(30)
    const w = W(fresh())
    for (const n of people) {
      const fav = n.props?.favourite
      expect(typeof fav === 'string' && w.onto.hasType(fav), `${n.id}: favourite ${String(fav)}`).toBe(true)
      expect((n.npc!.person!.lines ?? []).filter((l) => l.key === 'chat').length, `${n.id}: chat lines`).toBeGreaterThanOrEqual(2)
    }
  })

  it('a child (under eighteen: the minor tag) is never robbed, stolen from or preached unbelief', () => {
    const s = fresh()
    clear(s, ['npc.mia'])
    put(s, 'npc.mia', 20, 14, 'down')
    put(s, 'player', 20, 15, 'up')
    const so = socialOf(s.eng)
    const mia = get(s, 'npc.mia')
    expect(W(s).num(mia, 'age')).toBeLessThan(18)
    expect(W(s).hasTag(mia, 'minor')).toBe(true)
    const verbs = so.verbs(mia, P(s)).map((v) => v.id)
    expect(verbs).not.toContain('rob')
    expect(verbs).not.toContain('steal')
    expect(verbs).not.toContain('unbelief')
    // said anyway (no verb offered): nothing comes of it
    const coin0 = purse(s, 'npc.mia')
    author(s, () => W(s).setProp(P(s), 'level', 12))
    s.eng.controls.talk('npc.mia', 'rob')
    expect(purse(s, 'npc.mia')).toBe(coin0)
    expect(W(s).num(P(s), 'hp')).toBe(W(s).num(P(s), 'maxHp'))
    // a grown villager carries no such tag
    expect(W(s).hasTag(get(s, 'npc.cass'), 'minor')).toBe(false)
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
  it('in a household\'s house at night, one awake there warns you off, then calls the watch', () => {
    const s = fresh()
    clear(s, ['npc.marta'])
    // Marta's kitchen (her household's house); she is up until ten, by her hearth's light (she sees who it is)
    author(s, () => (W(s).state.tick = tickAt(1, 21)))
    put(s, 'npc.marta', 3, 8, 'up', HOME)
    put(s, 'player', 3, 7, 'down', HOME)
    ticks(s, 12)
    expect(fxOf(s).some((f) => f.t === 'say' && f.who === 'npc.marta' && JSON.stringify(f.text).includes('at this hour'))).toBe(true)
    // she stays at her door (the test keeps her there), the stranger stays on it
    for (let i = 0; i < 30 && !bounty(s); i++) {
      put(s, 'npc.marta', 3, 8, 'up', HOME)
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
