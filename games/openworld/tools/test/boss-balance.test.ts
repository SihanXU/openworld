import { describe, expect, it } from 'vitest'
import { type Dir, type Game } from '@openworld/engine'
import { BOSSES, BOSS_ARENA, SKILL_PROFESSIONS } from '@openworld-game/content'
import { challengeOutcome, createBossChallenge } from '@openworld/runtime/src/boss-challenge.ts'
import { buildFord } from '../src/demo/world.ts'

const { index, chunks } = buildFord()
const raw = chunks.find((c) => c.map.id === BOSS_ARENA.map)!
const directions: [Dir, number, number][] = [['left', -1, 0], ['right', 1, 0], ['down', 0, 1], ['up', 0, -1]]

/** A deterministic test pilot: ordinary movement/attacks only, no damage or health cheats. */
function pilot(game: Game, dodge: boolean): void {
  const eng = game.engine, w = eng.world, p = w.player, boss = w.get(BOSS_ARENA.id)!
  const at = w.posOf(p)!, body = w.occupiedCells(boss)
  const warning = new Set((boss.boss?.pending?.tiles ?? []).map(([x, y]) => `${x},${y}`))
  const danger = (x: number, y: number) => dodge && warning.has(`${x},${y}`)
  const adjacent = (x: number, y: number) => body.some(([bx, by]) => Math.abs(x - bx) + Math.abs(y - by) === 1)
  const threatened = danger(at.x, at.y)
  // BFS to the nearest safe cell when threatened, otherwise a safe melee position.
  if (threatened || !adjacent(at.x, at.y)) {
    const queue: { x: number; y: number; first?: Dir }[] = [{ x: at.x, y: at.y }], seen = new Set([`${at.x},${at.y}`])
    for (let i = 0; i < queue.length && i < 1000; i++) {
      const cell = queue[i]
      if (cell.first && !danger(cell.x, cell.y) && (threatened || adjacent(cell.x, cell.y))) { eng.movePlayer(cell.first); break }
      for (const [dir, dx, dy] of directions) {
        const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`
        if (seen.has(key) || !w.fits(p, at.map, x, y) || (!threatened && danger(x, y))) continue
        seen.add(key); queue.push({ x, y, first: cell.first ?? dir })
      }
    }
  }
  // a player faces the body before striking it (a turn, not a step)
  const now = w.posOf(p)!
  const cell = body.find(([bx, by]) => Math.abs(now.x - bx) + Math.abs(now.y - by) === 1)
  if (cell) p.facing = cell[0] > now.x ? 'right' : cell[0] < now.x ? 'left' : cell[1] > now.y ? 'down' : 'up'
  eng.playerAttack({ e: boss.id })
  eng.tick()
}

describe('boss challenge balance', () => {
  it.each(BOSSES.flatMap((b) => SKILL_PROFESSIONS.map((p) => [b.id, p.id] as const)))('%s punishes %s for ignoring every warning', (boss, profession) => {
    const game = createBossChallenge(index, raw, profession, boss)
    for (let tick = 0; tick < 1800 && !challengeOutcome(game); tick++) pilot(game, false)
    expect(challengeOutcome(game)).toBe('defeat')
    expect(game.engine.world.num(game.engine.world.get(BOSS_ARENA.id)!, 'hp')).toBeGreaterThan(0)
  })

  it.each(BOSSES.map((b) => b.id))('lets a warrior defeat %s through actual dodging and counterattacks', (boss) => {
    const game = createBossChallenge(index, raw, 'warrior', boss)
    const start = game.engine.world.state.tick
    for (let tick = 0; tick < 2400 && !challengeOutcome(game); tick++) pilot(game, true)
    expect(challengeOutcome(game)).toBe('victory')
    expect(game.engine.world.state.tick - start).toBeGreaterThan(300)
  })
})
