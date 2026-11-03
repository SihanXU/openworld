// What a second seat sees (packages/engine/src/observe.ts, docs/agent-players.md §3.2): the things in sight, the cells a
// wind-up will strike and what the keys would do in front, as a person at that seat would read them.

import { describe, expect, it } from 'vitest'
import { Game, RuleLibrary, describe as describeSeat, observe, type Entity } from '@openworld/engine'
import { kitsOf } from '@openworld/modules'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { buildFord } from '../src/demo/world.ts'

const MAP = 'pasture'
const OPEN_ROW = [0, 1, 2, 3, 4, 5, 6, 7]

function arena() {
  const { index, chunks } = buildFord()
  const game = Game.create(index, buildOntology(), new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  game.mods.provider = { resolve: () => new Promise<null>(() => {}) }
  const eng = game.engine
  const w = eng.world
  const map = w.map(MAP)!
  const open = (x: number, y: number) => w.passable(MAP, x, y) && w.heightAt(MAP, x, y) === 0 && w.entitiesAt(MAP, x, y).every((e) => w.isTerrain(e))
  let row: { x: number; y: number } | undefined
  for (let y = 3; y < map.height - 3 && !row; y++)
    for (let x = 2; x < map.width - 9 && !row; x++) if (OPEN_ROW.every((i) => [-1, 0, 1].every((dy) => open(x + i, y + dy)))) row = { x, y }
  if (!row) throw new Error('no open row')
  const at = row
  const mate = eng.author(() => {
    for (const e of w.entitiesOnMap(MAP)) if (e !== w.player && w.isAgent(e) && e.place.on === 'tile') w.destroy(e)
    w.place(w.player, { on: 'tile', map: MAP, x: at.x, y: at.y })
    w.player.facing = 'right'
    const body = w.create('actor/person/player', { on: 'tile', map: MAP, x: at.x, y: at.y + 1 }, { props: { hp: 40, maxHp: 40 } })
    body.facing = 'right'
    return body
  })
  eng.sit(mate.id)
  const spawn = (type: string, dx: number): Entity =>
    eng.author(() => w.create(type, { on: 'tile', map: MAP, x: at.x + dx, y: at.y }, { ai: { behaviour: 'melee', temper: 'aggressive', sight: 8, home: { map: MAP, x: at.x + dx, y: at.y } } }))
  return { eng, w, mate, at, spawn }
}

describe('a seat\'s observation', () => {
  it('is its own actor\'s view: itself at the grid\'s middle, the others by offset, plain data', () => {
    const { eng, w, mate, at } = arena()
    const o = observe(eng, mate.id)!
    expect(o.me).toMatchObject({ id: mate.id, x: at.x, y: at.y + 1, hp: 40 })
    expect(o.grid.rows).toHaveLength(17)
    expect(o.grid.rows[8][8]).toBe('@')
    expect(o.things.find((t) => t.id === w.state.player)).toMatchObject({ kind: 'person', dx: 0, dy: -1 })
    expect(o.grid.rows[7][8]).toBe('o')
    expect(JSON.parse(JSON.stringify(o))).toEqual(o)
    expect(describeSeat(o)).toContain('Map (@ you')
  })

  it('warns of a wind-up in sight: a skeleton\'s bone marks cells and the grid shows them', () => {
    const { eng, mate, spawn } = arena()
    const skeleton = spawn('actor/creature/undead/skeleton', 4)
    for (let i = 0; i < 60 && !kitsOf(eng).pending.has(skeleton.id); i++) eng.tick()
    const o = observe(eng, mate.id)!
    expect(o.warnings.find((a) => a.from === skeleton.id)?.tiles.length).toBeGreaterThan(0)
    expect(o.grid.rows.join('')).toContain('!')
    expect(o.things.find((t) => t.id === skeleton.id)).toMatchObject({ kind: 'creature', hostile: true })
    expect(describeSeat(o)).toMatch(/wind-up|DANGER/)
  })

  it('says what the keys would do on the cell in front', () => {
    const { eng, w, mate, at } = arena()
    const log = eng.author(() => w.create('item/material/log', { on: 'tile', map: MAP, x: at.x + 1, y: at.y + 1 }))
    const o = observe(eng, mate.id)!
    expect(o.keys.hands).toMatchObject({ target: log.id, dx: 1, dy: 0 })
    expect(o.keys.hands!.label.length).toBeGreaterThan(0)
  })
})
