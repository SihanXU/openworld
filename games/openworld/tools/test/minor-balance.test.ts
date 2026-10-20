import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, type Dir, type Entity } from '@openworld/engine'
import { kitsOf } from '@openworld/modules'
import { BASE_RULES, CREATURE_ROLES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

// The minor monsters' numbers (content levels.ts, docs/creatures.md §8), held to by duels: a player with gear of the
// monster's own level (a stone axe's blow grown a quarter a level, a point of defence every two) fights one in the open,
// standing and striking, or stepping off its marks first. Ordinary movement and blows only; no health cheats.

const onto = buildOntology()
const { index, chunks } = buildFord()
const DIRS: [Dir, number, number][] = [['left', -1, 0], ['right', 1, 0], ['down', 0, 1], ['up', 0, -1]]

interface Duel { won: boolean; secs: number; lost: number; casts: number }

function duel(type: string, dodge: boolean): Duel {
  const g = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) g.loadChunk(decodeChunk(c))
  g.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = g.engine, w = eng.world, p = w.player, map = w.posOf(p)!.map, m = w.map(map)!
  const level = Number(onto.types[type].props?.level ?? 1)
  const open = (x: number, y: number) => w.passable(map, x, y) && w.entitiesAt(map, x, y).every((e) => w.isTerrain(e))
  let row: { x: number; y: number } | undefined
  for (let y = 4; y < m.height - 4 && !row; y++)
    for (let x = 4; x < m.width - 10 && !row; x++) if ([...Array(9).keys()].every((i) => [-2, -1, 0, 1, 2].every((dy) => open(x + i - 2, y + dy)))) row = { x, y }
  if (!row) throw new Error('no open ground')
  let c!: Entity
  eng.author(() => {
    for (const e of w.entitiesOnMap(map)) if (e !== p && w.isAgent(e) && e.place.on === 'tile') w.destroy(e)
    w.place(p, { on: 'tile', map, x: row!.x, y: row!.y })
    const axe = w.create('item/weapon/blade/axe', { on: 'inside', holder: p.id })
    w.setProp(p, 'atk', Math.round(6 * (1 + 0.25 * (level - 1))) - w.num(axe, 'power', 4))
    w.setProp(p, 'def', Math.floor((level - 1) / 2))
    const home = { map, x: row!.x + 3, y: row!.y }
    const ranged = Number(onto.types[type].props?.range ?? 1) > 1
    c = w.create(type, { on: 'tile', ...home }, { ai: { behaviour: ranged ? 'ranged' : 'melee', temper: 'aggressive', sight: 8, home } })
    eng.controls.sync()
    eng.controls.select(p.slots!.indexOf(eng.controls.key(axe)))
  })
  const hp0 = w.num(p, 'hp'), t0 = w.state.tick
  let casts = 0, winding = false
  for (let t = 0; t < 900 && w.get(c.id) && w.num(p, 'hp') > 0 && !p.statuses?.down; t++) {
    const at = w.posOf(p)!, ct = w.posOf(c)!
    const marks = new Set((kitsOf(eng).pending.get(c.id)?.tiles ?? []).map(([x, y]) => `${x},${y}`))
    const bad = (x: number, y: number) => dodge && marks.has(`${x},${y}`)
    const beside = (x: number, y: number) => Math.abs(x - ct.x) + Math.abs(y - ct.y) === 1
    if (bad(at.x, at.y) || !beside(at.x, at.y)) {
      // to the nearest safe cell when marked, else to a cell beside the foe
      const threatened = bad(at.x, at.y)
      const queue: { x: number; y: number; first?: Dir }[] = [{ x: at.x, y: at.y }], seen = new Set([`${at.x},${at.y}`])
      for (let i = 0; i < queue.length && i < 400; i++) {
        const cell = queue[i]
        if (cell.first && !bad(cell.x, cell.y) && (threatened || beside(cell.x, cell.y))) {
          eng.movePlayer(cell.first)
          break
        }
        for (const [d, dx, dy] of DIRS) {
          const x = cell.x + dx, y = cell.y + dy, k = `${x},${y}`
          if (seen.has(k) || !w.fits(p, map, x, y) || (!threatened && bad(x, y))) continue
          seen.add(k)
          queue.push({ x, y, first: cell.first ?? d })
        }
      }
    }
    const now = w.posOf(p)!
    if (beside(now.x, now.y) && !bad(now.x, now.y)) {
      p.facing = ct.x > now.x ? 'right' : ct.x < now.x ? 'left' : ct.y > now.y ? 'down' : 'up'
      eng.playerAttack({ e: c.id })
    }
    eng.tick()
    const w2 = kitsOf(eng).pending.has(c.id)
    if (w2 && !winding) casts++
    winding = w2
  }
  return { won: !w.get(c.id) || w.num(c, 'hp') <= 0, secs: (w.state.tick - t0) / 10, lost: hp0 - Math.max(0, w.num(p, 'hp')), casts }
}

const kinds = Object.entries(CREATURE_ROLES)
const hasKit = (type: string) => {
  for (let t = type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '') if (onto.kits?.[t]) return true
  return false
}

describe('minor monsters\' balance', () => {
  it('every kind on the curve is a kind of the game (a misspelled key would make a nameless type of its own)', () => {
    for (const type of Object.keys(CREATURE_ROLES)) expect(onto.types[type]?.name, type).toBeDefined()
  })
  it.each(kinds)('%s: a fight long enough for its skill, won with gear of its level, never free', (type, role) => {
    const stand = duel(type, false)
    if (process.env.DUEL_LOG) console.log(type, role, JSON.stringify(stand), JSON.stringify(duel(type, true)))
    expect(stand.won, 'won standing').toBe(true)
    expect(stand.lost, 'it costs something').toBeGreaterThan(0)
    // a swarm falls in a few blows; anything else lasts long enough to wind a skill up
    expect(stand.secs).toBeGreaterThanOrEqual(role === 'swarm' ? 1 : role === 'elite' ? 6 : 1.5)
    if (hasKit(type)) expect(stand.casts, 'it takes a skill up').toBeGreaterThan(0)
    // what one loses standing: a swarm or a fighter a little, a wall more, a gatekeeper a good part of one's health
    expect(stand.lost).toBeLessThanOrEqual(role === 'elite' ? 30 : role === 'brute' ? 20 : 12)
    const dodge = duel(type, true)
    expect(dodge.won, 'won dodging').toBe(true)
  })
})
