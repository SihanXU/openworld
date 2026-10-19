import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, CREATURE_DROPS, ECTO, GEL, RECIPES, STORY_RULES, VENOM, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// What the minor monsters leave (content drops.ts, docs/creatures.md §7): every hostile kind is made of something, so a
// felling leaves it lying still; the three things only monsters give each have a use; the antidote clears poison.

const onto = buildOntology()
const hostile = Object.keys(onto.types).filter((t) => t.startsWith('actor/creature/') && !t.startsWith('actor/creature/animal') && !t.startsWith('actor/creature/sin')
  && t !== 'actor/creature/dragon' && Object.keys(onto.types).every((u) => !u.startsWith(t + '/')))

function ford() {
  const { index, chunks } = buildFord()
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  return g
}

describe('creature drops', () => {
  it('every hostile kind of minor monster is made of something the world knows', () => {
    const resolve = (t: string) => {
      for (let x = t; x; x = x.includes('/') ? x.slice(0, x.lastIndexOf('/')) : '') if (onto.types[x]?.makeup?.length) return onto.types[x].makeup!
      return []
    }
    for (const t of hostile) {
      const makeup = resolve(t)
      expect(makeup.length, t).toBeGreaterThan(0)
      for (const m of makeup) expect(onto.types[m.type], `${t}: ${m.type}`).toBeDefined()
    }
    for (const t of Object.keys(CREATURE_DROPS)) expect(onto.types[t], t).toBeDefined()
  })

  it('a felled monster leaves its makeup at the recovery rate, lying still', () => {
    const g = ford(), eng = g.engine, w = eng.world, p = w.player
    const at = w.posOf(p)!
    let s!: Entity
    eng.author(() => (s = w.create('actor/creature/undead/skeleton', { on: 'tile', map: at.map, x: at.x, y: at.y + 1 }, { props: { hp: 1 } })))
    eng.queue({ kind: 'impulse/strike', host: { e: s.id }, roles: { actor: { e: p.id } }, params: { power: 5 }, cause: p.id, origin: 'player' })
    for (let i = 0; i < 3; i++) eng.tick()
    expect(w.get(s.id)).toBeUndefined()
    const bones = w.entitiesAt(at.map, at.x, at.y + 1).filter((e) => e.type === 'item/material/bone')
    expect(bones).toHaveLength(2)
    expect(bones.every((b) => !b.dropped)).toBe(true)
  })

  it('what only monsters give has a use: the venom sac makes the antidote, and all three sell at the stall', () => {
    expect(RECIPES.some((r) => r.make.type === 'item/potion/antidote' && r.needs.some((n) => n.type === VENOM))).toBe(true)
    for (const t of [GEL, VENOM, ECTO]) expect(RECIPES.some((r) => r.group === 'sell' && r.needs.some((n) => n.type === t)), t).toBe(true)
  })

  it('the antidote drunk clears poison and mends a little', () => {
    const g = ford(), eng = g.engine, w = eng.world, p = w.player
    eng.author(() => {
      eng.applyStatus({ e: p.id }, 'poisoned')
      w.setProp(p, 'hp', 20)
    })
    const flask = eng.author(() => w.create('item/potion/antidote', { on: 'inside', holder: p.id }))
    eng.act('use', p.id, { e: p.id }, { instrument: { e: flask.id } })
    eng.tick()
    expect(p.statuses?.poisoned).toBeUndefined()
    expect(w.num(p, 'hp')).toBeGreaterThanOrEqual(24)
    expect(w.get(flask.id)).toBeUndefined()
  })
})
