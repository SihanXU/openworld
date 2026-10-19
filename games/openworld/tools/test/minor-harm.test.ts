import { describe, expect, it } from 'vitest'
import { Engine, Game, RuleLibrary, type Entity, type Ontology, type QuestDef } from '@openworld/engine'
import { BASE_RULES, SOCIAL_COIN, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { socialOf } from '@openworld/modules'
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

function position(eng: ReturnType<typeof fresh>['eng'], id: string): Entity {
  const w = eng.world
  const target = w.get(id)!
  eng.author(() => {
    for (const e of Object.values(w.state.entities)) {
      if (e.npc && e.id !== id && e.place.on === 'tile') w.place(e, { on: 'tile', map: 'offstage', x: 1, y: 1 })
    }
    w.place(target, { on: 'tile', map: MAP, x: 20, y: 14 })
    target.facing = 'down'
    eng.teleport(w.player, { map: MAP, x: 20, y: 15 })
  })
  return target
}

function pocketItem(eng: ReturnType<typeof fresh>['eng'], id: string, holder: Entity, type: string): Entity {
  const w = eng.world
  if (!w.onto.hasType(type)) w.onto.addType({ id: type, tags: ['portable'] })
  return eng.author(() => w.create(type, { on: 'inside', holder: holder.id }, { id }))
}

describe('minor harm protection', () => {
  it('blocks direct damage, HP reductions and harmful statuses while allowing a helpful status', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const hp = w.num(child, 'hp')

    eng.damage(child, 99, undefined, true)
    eng.author(() => eng.setProp(child, 'hp', 1))
    eng.author(() => eng.applyStatus({ e: child.id }, 'bleeding', 40, w.player.id))
    eng.author(() => eng.applyStatus({ e: child.id }, 'stunned', 20, w.player.id))
    eng.author(() => eng.applyStatus({ e: child.id }, 'out_cold', 20, w.player.id))
    eng.author(() => eng.applyStatus({ e: child.id }, 'jailed', 20, w.player.id))

    expect(w.num(child, 'hp')).toBe(hp)
    expect(w.hasStatus({ e: child.id }, 'bleeding')).toBe(false)
    expect(w.hasStatus({ e: child.id }, 'stunned')).toBe(false)
    expect(w.hasStatus({ e: child.id }, 'out_cold')).toBe(false)
    expect(w.hasStatus({ e: child.id }, 'jailed')).toBe(false)
    eng.author(() => eng.applyStatus({ e: child.id }, 'soaking', 20))
    expect(w.hasStatus({ e: child.id }, 'soaking')).toBe(true)
  })

  it('does not resolve a combat attack against a child, while an adult still takes damage', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    eng.author(() => w.setProp(w.player, 'atk', 100))
    const hp = w.num(child, 'hp')

    expect(eng.attack(w.player, { e: child.id })).toBe(true)
    expect(w.num(child, 'hp')).toBe(hp)

    const adult = position(eng, 'npc.cass')
    eng.author(() => {
      w.setProp(adult, 'age', 18)
      w.removeTag(adult, 'minor')
    })
    const adultHp = w.num(adult, 'hp')
    expect(eng.attack(w.player, { e: adult.id })).toBe(true)
    expect(w.num(adult, 'hp')).toBeLessThan(adultHp)
  })

  it('keeps an out-of-bounds empty swing defined and refuses a ranged strike before its effects', () => {
    const { eng, w } = fresh()
    const player = w.player
    eng.author(() => {
      w.place(player, { on: 'tile', map: MAP, x: 0, y: 0 })
      player.facing = 'left'
    })
    expect(() => eng.attack(player)).not.toThrow()

    const child = position(eng, 'npc.mia')
    eng.author(() => {
      w.setProp(player, 'atk', 100)
      w.setProp(player, 'range', 6)
      player.facing = 'up'
    })
    const hp = w.num(child, 'hp')
    const pos = w.posOf(child)
    const vfx = w.fx.length
    expect(eng.attack(player, { e: child.id })).toBe(true)
    expect(w.num(child, 'hp')).toBe(hp)
    expect(w.posOf(child)).toEqual(pos)
    expect(w.fx.slice(vfx).some((fx) => fx.t === 'vfx' && (fx.fx.startsWith('swing:') || fx.fx.startsWith('bolt:')))).toBe(false)
    expect(socialOf(eng).fears(child, player.id)).toBe(false)
    expect(w.fx.slice(vfx).some((fx) => fx.t === 'say' && fx.who === player.id)).toBe(true)
  })

  it('blocks forced pocket, nested take and direct taken events from a child, but allows self-take and dropped things', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const direct = pocketItem(eng, 'test.child.purse', child, 'item/test/purse')
    const bag = pocketItem(eng, 'test.child.bag', child, 'item/test/bag')
    const nested = pocketItem(eng, 'test.child.nested', bag, 'item/test/token')
    const inHand = pocketItem(eng, 'test.child.hand-item', child, 'item/test/hand-item')

    eng.controls.pocket(child.id, direct.id, true)
    expect(direct.place).toEqual({ on: 'inside', holder: child.id })

    eng.act('take', child.id, { e: inHand.id }, { instrument: null, params: { quiet: true } })
    expect(inHand.place).toEqual({ on: 'hand', holder: child.id })

    const dropped = eng.author(() => w.create('item/test/dropped', { on: 'tile', map: MAP, x: 20, y: 15 }))
    eng.act('take', w.player.id, { e: dropped.id }, { instrument: null, params: { into: 'contents' } })
    expect(dropped.place).toEqual({ on: 'inside', holder: w.player.id })
    eng.act('take', w.player.id, { e: nested.id }, { instrument: null, params: { into: 'contents' } })
    expect(nested.place).toEqual({ on: 'inside', holder: bag.id })
    eng.offer({
      kind: 'impulse/taken',
      host: { e: direct.id },
      roles: { actor: { e: w.player.id }, other: { e: w.player.id } },
      params: { into: 'contents', quiet: true },
      cause: w.player.id,
      origin: 'player',
    })
    expect(direct.place).toEqual({ on: 'inside', holder: child.id })
  })

  it('follows a valid carried-container chain to its protected owner', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const bagType = 'item/test/deep-container'
    if (!w.onto.hasType(bagType)) w.onto.addType({ id: bagType, tags: ['portable', 'container'], props: { capacity: 64 } })
    let holder = child
    let leaf!: Entity
    eng.author(() => {
      for (let depth = 0; depth < 32; depth++) {
        holder = w.create(bagType, { on: 'inside', holder: holder.id }, { id: `test.child.deep-bag-${depth}` })
      }
      leaf = w.create('item/test/deep-loot', { on: 'inside', holder: holder.id }, { id: 'test.child.deep-loot', tags: ['portable'] })
    })
    const originalHolder = holder.id

    eng.offer({
      kind: 'impulse/taken',
      host: { e: leaf.id },
      roles: { actor: { e: w.player.id }, other: { e: w.player.id } },
      params: { into: 'contents', quiet: true },
      cause: w.player.id,
      origin: 'player',
    })

    expect(leaf.place).toEqual({ on: 'inside', holder: originalHolder })
  })

  it('allows completed voluntary quest hand-ins without creating an ordinary-take bypass', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const keepsake = pocketItem(eng, 'test.child.quest-keepsake', child, 'item/test/quest-keepsake')
    const extra = pocketItem(eng, 'test.child.extra-keepsake', child, 'item/test/extra-keepsake')
    const def: QuestDef = {
      id: 'minor-handoff-test',
      kind: 'side',
      title: { en: 'A Hand-off', zh: '交接' },
      summary: { en: 'A test hand-off.', zh: '测试交接。' },
      aliases: { child: { id: child.id }, keepsake: { id: keepsake.id } },
      stages: [{ n: 10, take: [{ match: 'keepsake', count: 1, from: 'child', to: 'player' }], complete: true }],
      start: { manual: true },
    }
    eng.quests.load([...eng.quests.defs, def])
    eng.author(() => eng.quests.start(def, {
      kind: 'act/use', host: { e: w.player.id }, roles: { actor: { e: w.player.id } }, params: {}, cause: w.player.id, origin: 'player',
    }, { taker: w.player.id }))

    const quest = w.get('quest.minor-handoff-test')!
    expect(eng.quests.stateOf(quest)).toBe('done')
    expect(keepsake.place).toEqual({ on: 'inside', holder: w.player.id })
    const handoff = [...eng.trace].reverse().find(({ ev }) => ev.kind === 'impulse/taken' && 'e' in ev.host && ev.host.e === keepsake.id)?.ev
    expect(handoff?.roles).toMatchObject({ actor: { e: child.id }, other: { e: w.player.id } })
    expect(handoff?.roles?.source).toBeUndefined()

    const fake = eng.author(() => w.add({ id: 'quest.fake-source', type: 'resident/quest', place: { on: 'resident' }, props: { quest: 'unregistered', state: 'active', stage: 10 } }))
    for (const source of [quest.id, fake.id, child.id]) {
      eng.offer({
        kind: 'impulse/taken',
        host: { e: extra.id },
        roles: { actor: { e: w.player.id }, other: { e: w.player.id }, source: { e: source } },
        params: { into: 'contents', quiet: true },
        cause: w.player.id,
        origin: 'player',
      })
      expect(extra.place).toEqual({ on: 'inside', holder: child.id })
    }

    const adult = position(eng, 'npc.cass')
    eng.author(() => { w.setProp(adult, 'age', 18); w.removeTag(adult, 'minor') })
    const adultItem = pocketItem(eng, 'test.adult.quest-item', adult, 'item/test/quest-item')
    const adultDef: QuestDef = {
      ...def,
      id: 'adult-handoff-test',
      aliases: { adult: { id: adult.id }, keepsake: { id: adultItem.id } },
      stages: [{ n: 10, take: [{ match: 'keepsake', count: 1, from: 'adult', to: 'player' }], complete: true }],
    }
    eng.quests.load([...eng.quests.defs, adultDef])
    eng.author(() => eng.quests.start(adultDef, {
      kind: 'act/use', host: { e: w.player.id }, roles: { actor: { e: w.player.id } }, params: {}, cause: w.player.id, origin: 'player',
    }, { taker: w.player.id }))
    const adultHandoff = [...eng.trace].reverse().find(({ ev }) => ev.kind === 'impulse/taken' && 'e' in ev.host && ev.host.e === adultItem.id)?.ev
    expect(adultItem.place).toEqual({ on: 'inside', holder: w.player.id })
    expect(adultHandoff?.roles).toMatchObject({ actor: { e: w.player.id }, other: { e: w.player.id } })
    expect(adultHandoff?.roles?.source).toBeUndefined()
  })

  it('allows an actual gift to a child and an actual purchase from an age-17 merchant', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const gift = pocketItem(eng, 'test.player.child-gift', w.player, 'item/food/bread')
    eng.controls.gift(child.id, gift.id)
    expect(gift.place).toEqual({ on: 'inside', holder: child.id })

    const merchant = position(eng, 'npc.marta')
    eng.author(() => {
      w.setProp(merchant, 'age', 17)
      w.removeTag(merchant, 'minor')
      for (let i = 0; i < 100; i++) w.create(SOCIAL_COIN, { on: 'inside', holder: w.player.id })
    })
    eng.controls.talk(merchant.id, 'trade')
    const item = socialOf(eng).stock(merchant).find((e) => e.type === 'item/food/bread')!
    expect(item).toBeDefined()
    const social = socialOf(eng)
    const playerPurse = social.purse(w.player)
    const merchantPurse = social.purse(merchant)
    const price = social.priceToBuy(item, merchant, w.player)
    expect(price).toBeGreaterThan(0)
    eng.controls.trade(merchant.id, item.id, true)
    expect(item.place).toEqual({ on: 'inside', holder: w.player.id })
    expect(social.purse(w.player)).toBe(playerPurse - price)
    expect(social.purse(merchant)).toBe(merchantPurse + price)
  })

  it('does not let direct social outcomes beat, rob, frighten, kill or jail a protected person', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const item = pocketItem(eng, 'test.child.social-item', child, 'item/test/social-item')
    const coin = pocketItem(eng, 'test.child.social-coin', child, SOCIAL_COIN)
    const hp = w.num(child, 'hp')
    const childEv = {
      kind: 'impulse/notify' as const,
      host: { e: child.id },
      roles: { actor: { e: w.player.id } },
      params: { map: 'meadow', x: 20, y: 14, hours: 1 },
      cause: w.player.id,
      origin: 'player' as const,
    }
    const person = position(eng, 'npc.cass')
    eng.author(() => {
      w.setProp(person, 'age', 17)
      w.removeTag(person, 'minor')
      w.setProp(person, 'fights', true)
      person.ai = undefined
    })
    expect(w.hasTag(person, 'essential')).toBe(false)
    expect(eng.isProtected(person)).toBe(true)
    const personEv = { ...childEv, host: { e: person.id } }

    eng.author(() => {
      eng.effects.apply({ op: 'beaten', left: 1 }, childEv)
      eng.effects.apply({ op: 'plunder', coins: 1, items: 1 }, childEv)
      eng.effects.apply({ op: 'foe' }, personEv)
    })
    expect(person.ai?.foes ?? []).not.toContain(w.player.id)

    eng.author(() => eng.effects.apply({ op: 'destroy' }, personEv))
    expect(w.get(person.id)).toBeDefined()
    expect(w.get(person.id)?.npc).toBeDefined()
    eng.author(() => eng.effects.apply({ op: 'breakdown' }, personEv))
    expect(w.get(person.id)).toBeDefined()
    expect(w.get(person.id)?.npc).toBeDefined()
    eng.author(() => eng.effects.apply({ op: 'die' }, personEv))
    expect(w.get(person.id)).toBeDefined()
    expect(w.get(person.id)?.npc).toBeDefined()
    eng.author(() => eng.effects.apply({ op: 'jail' }, personEv))
    socialOf(eng).frighten(child, w.player.id)
    socialOf(eng).frighten(person, w.player.id)

    expect(w.num(child, 'hp')).toBe(hp)
    expect(item.place).toEqual({ on: 'inside', holder: child.id })
    expect(coin.place).toEqual({ on: 'inside', holder: child.id })
    expect(w.hasStatus({ e: child.id }, 'jailed')).toBe(false)
    expect(socialOf(eng).fears(child, w.player.id)).toBe(false)
    expect(w.get(person.id)?.npc).toBeDefined()
    expect(w.hasStatus({ e: person.id }, 'jailed')).toBe(false)
    expect(socialOf(eng).fears(person, w.player.id)).toBe(false)

    const adult = position(eng, 'npc.cass')
    eng.author(() => { w.setProp(adult, 'age', 18); w.removeTag(adult, 'minor') })
    socialOf(eng).frighten(adult, w.player.id)
    expect(socialOf(eng).fears(adult, w.player.id)).toBe(true)
  })

  it('blocks an elemental event and an old bleeding save across ticks, and ignores protected targets in a real monster kit act', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.mia')
    const hp = w.num(child, 'hp')
    eng.queue({ kind: 'impulse/element', host: { e: child.id }, roles: {}, params: { element: 'fire', power: 100 }, origin: 'world' })
    expect(w.num(child, 'hp')).toBe(hp)
    expect(w.hasStatus({ e: child.id }, 'burning')).toBe(false)

    eng.author(() => w.setStatus({ e: child.id }, 'bleeding', w.state.tick + 11, w.player.id))
    for (let i = 0; i < 11; i++) eng.tick()
    expect(w.num(child, 'hp')).toBe(hp)

    const adult = eng.author(() => {
      const e = w.get('npc.cass')!
      w.setProp(e, 'age', 18)
      w.removeTag(e, 'minor')
      w.place(e, { on: 'tile', map: MAP, x: 18, y: 16 })
      return e
    })
    const attacker = eng.author(() => w.create('actor/creature/golem', { on: 'tile', map: MAP, x: 18, y: 14 }, {
      props: { atk: 10, hp: 1, maxHp: 100 }, ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, home: { map: MAP, x: 18, y: 14 }, foes: [child.id, adult.id] },
    }))
    const childPos = w.posOf(child)
    const childHurtBy = child.combat?.lastHurtBy
    const adultHp = w.num(adult, 'hp')
    expect(eng.hostileTo(attacker, child)).toBe(true)
    const traceMark = eng.trace.length
    eng.act('use', attacker.id, { e: child.id }, {
      instrument: null,
      reach: 6,
      params: { kit: 'slam', ox: 18, oy: 14, ax: 20, ay: 14 },
    })
    expect(eng.trace.slice(traceMark).some(({ ev, rule }) => ev.kind === 'act/use' && 'e' in ev.host && ev.host.e === attacker.id && rule === 'kit/golem')).toBe(true)
    expect(w.num(child, 'hp')).toBe(hp)
    expect(w.posOf(child)).toEqual(childPos)
    expect(child.combat?.lastHurtBy).toBe(childHurtBy)
    expect(socialOf(eng).fears(child, attacker.id)).toBe(false)
    expect(w.num(adult, 'hp')).toBeLessThan(adultHp)
    expect(w.posOf(adult)).toMatchObject({ x: 18, y: 17 })
    expect(['bleeding', 'stunned', 'burning', 'poisoned'].some((status) => w.hasStatus({ e: child.id }, status))).toBe(false)
  })

  it('uses a data selector for another game and leaves unconfigured engines unchanged', () => {
    const { eng, w } = fresh()
    const child = position(eng, 'npc.cass')
    eng.author(() => {
      w.addTag(child, 'policy-mark')
      w.setProp(child, 'age', undefined)
      w.removeTag(child, 'minor')
    })
    const policy = {
      ...onto,
      protection: {
        subjects: [{ tags: ['policy-mark'] }],
        statuses: ['bleeding'],
        refusal: { en: 'Protected.', zh: '受保护。' },
      },
    } as Ontology
    const marked = new Engine(structuredClone(w.state), policy, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const markedVictim = marked.world.get(child.id)!
    const hp = marked.world.num(markedVictim, 'hp')
    marked.damage(markedVictim, 99, undefined, true)
    marked.author(() => marked.applyStatus({ e: child.id }, 'bleeding', 40))
    expect(marked.world.num(markedVictim, 'hp')).toBe(hp)
    expect(marked.world.hasStatus({ e: child.id }, 'bleeding')).toBe(false)

    const unconfigured = new Engine(structuredClone(w.state), { ...onto, protection: undefined } as Ontology, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
    const ordinary = unconfigured.world.get(child.id)!
    unconfigured.author(() => {
      unconfigured.world.setProp(ordinary, 'age', 9)
      unconfigured.world.addTag(ordinary, 'minor')
    })
    const ordinaryHp = unconfigured.world.num(ordinary, 'hp')
    unconfigured.queue({ kind: 'impulse/strike', host: { e: child.id }, roles: { actor: { e: unconfigured.world.player.id } }, params: { power: 1, edge: 'blunt' }, origin: 'world' })
    expect(unconfigured.world.num(ordinary, 'hp')).toBeLessThan(ordinaryHp)
    const afterStrikeHp = unconfigured.world.num(ordinary, 'hp')
    unconfigured.damage(ordinary, 1, undefined, true)
    expect(unconfigured.world.num(ordinary, 'hp')).toBeLessThan(afterStrikeHp)
  })

  it('uses maxHp as current health when a protected custom person has no hp prop yet', () => {
    const { eng, w } = fresh()
    const personBase = w.onto.data.types['actor/person']!
    const personProps = { ...(personBase.props ?? {}) }
    delete personProps.hp
    w.onto.addType({ ...personBase, props: personProps })
    w.onto.addType({ id: 'actor/person/test-no-current-hp' })
    const person = eng.author(() => w.create('actor/person/test-no-current-hp', { on: 'tile', map: MAP, x: 19, y: 14 }, {
      id: 'test.protected.no-current-hp',
      props: { age: 17, maxHp: 20 },
    }))
    expect(w.prop(person, 'hp')).toBeUndefined()
    expect(eng.isProtected(person)).toBe(true)

    eng.author(() => eng.setProp(person, 'hp', 1))

    expect(w.prop(person, 'hp')).toBeUndefined()
    expect(w.num(person, 'hp', w.num(person, 'maxHp'))).toBe(20)
  })
})
