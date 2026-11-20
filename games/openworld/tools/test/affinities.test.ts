import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, CREATURE_ROLES, ELEMENTS, IMMUNE, STORY_RULES, TAG_AFFINITY, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// What the minor monsters make of the elements (content affinities.ts, docs/creatures.md §15): a blow carrying an element
// meets the one struck's resistance to it, so a weakness takes more and an immunity nothing, and the frame says which;
// every minor kind's affinities come from its element and its nature, and none is weak or immune to everything; an
// element's reaction on a body is held by the same resistance, never twice.

const onto = buildOntology()
const C = 'actor/creature'
const res = (kind: string, e: string) => Number(onto.types[kind].props?.[`res${e[0].toUpperCase()}${e.slice(1)}`] ?? 0)

function strike(kind: string, element?: string) {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player, at = w.posOf(p)!
  let foe!: Entity
  eng.author(() => (foe = w.create(kind, { on: 'tile', map: at.map, x: at.x, y: at.y + 1 }, { props: { hp: 200, maxHp: 200, def: 0 } })))
  w.fx.length = 0
  eng.queue({ kind: 'impulse/strike', host: { e: foe.id }, roles: { actor: { e: p.id } }, params: { power: 20, edge: 'blunt', ...(element && { element }) }, cause: p.id, origin: 'player' })
  eng.tick()
  const hit = w.fx.find((f) => f.t === 'damage' && f.who === foe.id && (f.amount > 0 || f.affinity === 'immune'))
  return { lost: 200 - w.num(foe, 'hp'), hit: hit?.t === 'damage' ? hit : undefined }
}

describe('elemental affinities', () => {
  it('a weakness takes half again, a resistance less, an immunity nothing; the frame says which', () => {
    const plain = strike(`${C}/beast/wolf`)
    const burnt = strike(`${C}/beast/wolf`, 'fire')
    expect(burnt.lost).toBe(Math.round(plain.lost * 1.5))
    expect(burnt.hit?.affinity).toBe('weak')
    expect(plain.hit?.affinity).toBeUndefined()
    const chilled = strike(`${C}/beast/wolf`, 'ice')
    expect(chilled.lost).toBeLessThan(plain.lost)
    expect(chilled.hit?.affinity).toBe('resisted')
    const shocked = strike(`${C}/wisp/storm_wisp`, 'lightning')
    expect(shocked.lost).toBe(0)
    expect(shocked.hit?.affinity).toBe('immune')
  })

  it('the keys reach it: a fire wand cast at a wolf finds its weakness, at a fire slime nothing', () => {
    const cast = (kind: string) => {
      const { index, chunks } = buildFord()
      const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
      for (const c of chunks) g.loadChunk(decodeChunk(c))
      g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
      const eng = g.engine, w = eng.world, p = w.player, at = w.posOf(p)!
      let foe!: Entity
      eng.author(() => {
        w.create('item/weapon/magic/wand', { on: 'hand', holder: p.id }, { props: { element: 'fire' } })
        foe = w.create(kind, { on: 'tile', map: at.map, x: at.x, y: at.y + 2 }, { props: { hp: 200, maxHp: 200 } })
        p.facing = 'down'
      })
      w.fx.length = 0
      eng.controls.strike()
      const seen: unknown[] = []
      for (let i = 0; i < 20; i++) {
        eng.tick()
        seen.push(...w.fx.filter((f) => f.t === 'damage' && f.who === foe.id))
        w.fx.length = 0
      }
      return seen as { affinity?: string; amount: number }[]
    }
    expect(cast(`${C}/beast/wolf`).some((f) => f.affinity === 'weak' && f.amount > 0)).toBe(true)
    expect(cast(`${C}/slime/fire_slime`).some((f) => f.affinity === 'immune')).toBe(true)
  })

  it('a reaction is weighed once: water on a fire slime, lightning on a golem, each by its resistance alone', () => {
    const plain = strike(`${C}/slime/green_slime`).lost
    expect(strike(`${C}/slime/fire_slime`, 'water').lost).toBe(Math.round(plain * 1.5) * 2)
    expect(strike(`${C}/golem/stone_golem`, 'lightning').lost).toBe(Math.round(plain * 0.5) * 2)
  })

  it('every minor kind is immune to its own element and to no more than two, weak to at most two, and some to none', () => {
    const elements = ELEMENTS
    for (const kind of Object.keys(CREATURE_ROLES)) {
      const own = onto.types[kind].props?.element
      if (typeof own === 'string') expect(res(kind, own), kind).toBe(IMMUNE)
      expect(elements.filter((e) => res(kind, e) >= IMMUNE).length, kind).toBeLessThanOrEqual(2)
      expect(elements.filter((e) => res(kind, e) < 0).length, kind).toBeLessThanOrEqual(2)
    }
    for (const e of elements) expect(Object.keys(CREATURE_ROLES).some((k) => res(k, e) < 0), `someone is weak to ${e}`).toBe(true)
    expect(Object.keys(CREATURE_ROLES).filter((k) => elements.every((e) => !res(k, e)))).toContain(`${C}/slime/green_slime`)
    const worn = (k: string) => k.split('/').flatMap((_, i, parts) => onto.types[parts.slice(0, i + 1).join('/')]?.tags ?? [])
    for (const tag of Object.keys(TAG_AFFINITY)) expect(Object.keys(CREATURE_ROLES).some((k) => worn(k).includes(tag)), tag).toBe(true)
  })
})
