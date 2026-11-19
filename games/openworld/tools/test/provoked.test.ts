// A monster struck from beyond its sight comes after whoever struck it, as far as its leash, and forgets them in a while.

import '@openworld/modules'
import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Entity } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const onto = buildOntology()
const { index, chunks } = buildFord()
const GAP = 6

function duel(kind: string, behaviour: 'melee' | 'ranged', shots: number, away = false) {
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player, map = w.posOf(p)!.map, m = w.map(map)!
  const open = (x: number, y: number) => w.passable(map, x, y) && w.entitiesAt(map, x, y).every((e) => w.isTerrain(e))
  let row: { x: number; y: number } | undefined
  for (let y = 4; y < m.height - 4 && !row; y++)
    for (let x = 4; x < m.width - GAP - 6 && !row; x++) if ([...Array(GAP + 4).keys()].every((i) => [-1, 0, 1].every((dy) => open(x + i, y + dy)))) row = { x, y }
  if (!row) throw new Error('no open ground')
  const home = { map, x: row.x + GAP, y: row.y }
  let foe!: Entity
  eng.author(() => {
    for (const e of w.entitiesOnMap(map)) if (e !== p && w.isAgent(e) && e.place.on === 'tile') w.destroy(e)
    w.place(p, { on: 'tile', map, x: row.x, y: row.y })
    eng.quests.put('descent', 'done')
    w.setFact('seen.arrival', true)
    const bow = w.create('item/weapon/ranged/bow', { on: 'inside', holder: p.id })
    w.setProp(p, 'profession', 'ranger')
    foe = w.create(`actor/creature/${kind}`, { on: 'tile', ...home }, { props: { hp: 5000, maxHp: 5000 }, ai: { behaviour, temper: 'aggressive', sight: 4, leash: GAP + 1, home } })
    eng.controls.sync()
    eng.controls.select(p.slots!.indexOf(eng.controls.key(bow)))
  })
  const hp = w.num(p, 'hp')
  let closest = Infinity
  let chased = 0
  for (let t = 0; t < 400; t++) {
    p.facing = 'right'
    if (t < shots) eng.playerAttack({ e: foe.id })
    if (away && t === shots) eng.author(() => w.place(p, { on: 'tile', ...eng.nearestFree({ map, x: row.x - 8, y: row.y })! }))
    eng.tick()
    const at = w.posOf(foe)!
    if (t < 100) chased = Math.max(chased, Math.abs(at.x - home.x) + Math.abs(at.y - home.y))
    closest = Math.min(closest, Math.abs(at.x - row.x) + Math.abs(at.y - row.y))
  }
  const at = w.posOf(foe)!
  return { closest, chased, down: w.hasStatus({ e: p.id }, 'down'), lost: hp - w.num(p, 'hp'), home: Math.abs(at.x - home.x) + Math.abs(at.y - home.y), struck: w.num(foe, 'hp') < 5000 }
}

describe('a monster struck from beyond its sight', () => {
  it('stays where it is when nobody strikes it', () => {
    expect(duel('beast/wolf', 'melee', 0)).toMatchObject({ closest: GAP, lost: 0, struck: false })
  })

  it('comes after the one who struck it and fights them', () => {
    const wolf = duel('beast/wolf', 'melee', 400)
    expect(wolf.struck).toBe(true)
    expect(wolf.closest).toBe(1)
    expect(wolf.lost).toBeGreaterThan(0)
  })

  it('a ranged one comes into its own reach and shoots back', () => {
    const imp = duel('imp/fire_imp', 'ranged', 400)
    expect(imp.closest).toBeLessThan(GAP)
    expect(imp.lost).toBeGreaterThan(0)
  })

  it('forgets one who struck it and went beyond its sight and its leash, and goes home', () => {
    const wolf = duel('beast/wolf', 'melee', 1, true)
    expect(wolf).toMatchObject({ struck: true, down: false })
    expect(wolf.chased).toBeGreaterThanOrEqual(4)
    expect(wolf.home).toBeLessThanOrEqual(4)
  })
})
