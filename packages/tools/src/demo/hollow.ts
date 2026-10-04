// South of the forest, before the bridge chapter (docs/quests.md): Thornwood Hollow, a thorny
// dell full of small things to fight, and under it the Old Barrow, where the storm-lost foragers
// of Firstlight Village are held by the dead. Both are combat zones; the barrow is dark.

import type { AiData, AppearDef } from '@lsw/engine'
import { MapBuilder, rng } from './builder.ts'
import { L, GROUND_YIELD, appears, lay } from './kit.ts'

/** The forest's new southern gap (columns), the hollow's way in from it, and the hollow's way down to the barrow. */
export const HOLLOW = { forestSouth: [12, 13, 14], north: [12, 13, 14], south: [26, 27, 28] } as const
export const BARROW = { w: 30, h: 24, north: [13, 14, 15] } as const

/** Where things are (the quest test reads these). */
export const HAT = {
  ring: [31, 9],
  warden: [15, 17],
  lina: [6, 19],
  oskar: [24, 19],
} as const satisfies Record<string, readonly [number, number]>

const HUNT = (sight = 5): Omit<AiData, 'home'> => ({ behaviour: 'melee', temper: 'aggressive', sight, leash: 7 })
const hunters = (type: string, max: number, every: number, on: string[]): AppearDef => appears(type, on, max, every, { ai: HUNT() })

// =================================================================== Thornwood Hollow

export function buildHollow(): MapBuilder {
  const m = new MapBuilder('hollow', L('Thornwood Hollow', '荆棘谷'), 'wild', 40, 30, 'grass', 'field', 'outdoor', 'frostfang')
  const gap = (xs: readonly number[], x: number) => xs.includes(x)
  // thick woods and thorn bushes round the dell, open north (the forest) and south (the barrow's mouth)
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if ((y < 4 && gap(HOLLOW.north, x)) || (y >= m.h - 4 && gap(HOLLOW.south, x))) continue
      const edge = Math.min(x, y, m.w - 1 - x, m.h - 1 - y)
      if (edge < 2 || (edge < 4 && rng.chance(0.5))) m.set(x, y, rng.chance(0.35) ? 'bush' : rng.chance(0.4) ? 'pine' : 'tree')
    }
  // thorn thickets inside, dry grass where the sun gets in, a muddy bottom
  for (const [cx, cy, rx, ry] of [[9, 12, 3, 2], [30, 14, 3.4, 2.2], [19, 21, 2.6, 1.8]] as const) m.organic(cx, cy, rx, ry, 'bush', { only: (t) => t === 'grass', rough: 0.35 })
  m.organic(22, 9, 5, 3, 'drygrass', { only: (t) => t === 'grass', rough: 0.3 })
  m.organic(14, 24, 3, 1.8, 'mud', { only: (t) => t === 'grass' })
  m.path([[13, 0], [14, 6], [20, 10], [25, 16], [27, 22], [27, 29]], 'path', 1, { edge: 'dirt', edgeP: 0.25 })
  // the barrow's mouth at the bottom: standing stones either side
  for (const [x, y] of [[25, 26], [29, 26]] as const) m.set(x, y, 'rock')
  // a child's ring, lost where the thorns are thickest (Mia's errand)
  m.item({ form: 'item/valuable/ring', material: 'silver', name: L("Mia's Ring", '米娅的戒指'), tags: ['keepsake'] }, ...HAT.ring).id = 'quest.mia.ring'
  // what lives here: slimes in the open, spiders in the thorns, wolves on the far side
  for (const [x, y] of [[18, 7], [24, 12], [11, 18]] as const) m.creature('slime/green_slime', x, y, HUNT(4))
  for (const [x, y] of [[8, 9], [31, 11], [21, 19]] as const) m.creature('spider', x, y, HUNT(4))
  for (const [x, y] of [[33, 20], [6, 22]] as const) m.creature('beast/wolf', x, y, HUNT(5))
  lay(m, 'item/material/stick', 2, [15, 3, 8, 5])
  m.appear = [
    ...GROUND_YIELD,
    hunters('actor/creature/slime/green_slime', 3, 900, ['grass', 'drygrass']),
    hunters('actor/creature/spider', 3, 1200, ['grass', 'drygrass']),
  ]
  return m
}

// =================================================================== the Old Barrow

export function buildBarrow(): MapBuilder {
  const m = new MapBuilder('barrow', L('The Old Barrow', '古墓'), 'dungeon', BARROW.w, BARROW.h, 'cave_wall', 'cave', 'dark', 'frostfang')
  const open = (t: string) => t === 'cave_wall'
  // the stair down from the hollow (north), a long hall, the warden's chamber, two side cells
  m.path([[14, 0], [14, 6], [15, 11], [15, 16]], 'floor_stone', 3)
  m.organic(15, 17, 5, 2.6, 'floor_stone', { only: open, rough: 0.15 })
  m.path([[15, 16], [9, 18], [6, 19]], 'floor_stone', 2)
  m.path([[15, 16], [21, 18], [24, 19]], 'floor_stone', 2)
  for (const [cx, cy] of [[6, 20], [24, 20]] as const) m.organic(cx, cy, 2.2, 1.6, 'floor_stone', { only: open })
  for (const [x, y] of [[13, 3], [16, 9], [12, 15], [18, 15]] as const) m.fixture('fixture/light/brazier', x, y, { statuses: { lit: -1 } })
  // the dead that keep the barrow, and the warden in its chamber
  for (const [x, y] of [[14, 5], [16, 12]] as const) m.creature('undead/skeleton', x, y, HUNT(4))
  m.creature('beast/bat', 9, 18, HUNT(5))
  m.creature('undead/warden', ...HAT.warden, { id: 'barrow.warden', ...HUNT(5), leash: 5 })
  m.anchor('cell.lina', ...HAT.lina)
  m.anchor('cell.oskar', ...HAT.oskar)
  m.appear = [hunters('actor/creature/undead/skeleton', 2, 2400, ['floor_stone'])]
  return m
}
