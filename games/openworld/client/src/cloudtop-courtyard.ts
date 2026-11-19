// Authored dressing for the eastern Cloudtop lookout, around the existing signal tower.
import type { Catalog, PrefabDef, SpriteDef } from '@openworld/runtime/src/assets/types.ts'

const IMAGE = 'lsw/Buildings/cloudtop-courtyard.png'
const TILE = 64
export const COURTYARD_SCALE = 16 / TILE

const frames = {
  roundLarge: [0, 0, 3, 3], pineLarge: [192, 0, 3, 4], branchTall: [384, 0, 3, 3],
  roundMedium: [576, 0, 3, 2], crownMedium: [768, 0, 3, 2], pineMedium: [0, 256, 3, 3],
  roundSmall: [192, 256, 3, 1], pineSmall: [384, 256, 3, 2], snowShrub: [576, 256, 3, 1],
  berryMound: [768, 256, 3, 1], berryBranch: [0, 448, 3, 2], snowTwig: [192, 448, 1, 1],
  snowBloom: [576, 320, 3, 2], snowClump: [256, 448, 1, 1], tallBerry: [320, 448, 3, 2], straw: [512, 448, 1, 1],
  snowGrass: [576, 448, 1, 1], stoneSmall: [640, 448, 1, 1], stoneMedium: [704, 448, 1, 1],
  stoneLarge: [768, 448, 3, 1], snowPatch: [0, 576, 1, 1], bench: [64, 576, 3, 2],
  barrel: [256, 576, 1, 2], firewood: [320, 576, 3, 2], lamp: [512, 576, 3, 3],
  supplies: [0, 768, 3, 3], wallFoot: [192, 768, 3, 1],
  rubble: [384, 768, 3, 2], boulder: [576, 768, 3, 2], boulderCluster: [768, 768, 3, 2],
  ropeWest: [0, 960, 3, 2], ropeEast: [192, 960, 3, 2],
} as const

type Frame = keyof typeof frames

function sprite(name: Frame): SpriteDef {
  const [x, y, tw, th] = frames[name]
  return { img: IMAGE, x, y, w: tw * TILE, h: th * TILE, ax: tw * TILE / 2, ay: th * TILE }
}

export const COURTYARD_BENCH = { id: 'summit~4', x: 31, y: 17, sprite: sprite('bench') }
export const COURTYARD_TOWER = { x: 29, y: 11 }
export const COURTYARD_LAMP = { x: 33, y: 16 }
export const COURTYARD_SUPPLIES = { x: 34, y: 17 }

// The round teal silhouettes are the native snow-rock art. Keep the sprite
// choice independent of the cell's terrain, which still determines collision.
const NATURE = 'Backgrounds/Tilesets/TilesetNature.png'
type TerrainLook = NonNullable<Catalog['terrainObjectLooks']>[string][string]
const native = (x: number, y: number, size: number, ay = size): SpriteDef =>
  ({ img: NATURE, x, y, w: size, h: size, ax: size / 2, ay })

const edgeLooks = {
  roundSnow: native(32, 192, 32, 31),
  roundTeal: native(0, 192, 32, 31),
  snowPine: native(128, 0, 32),
  snowFir: native(160, 0, 32),
  snowStones: native(144, 192, 16),
  slateStones: native(96, 192, 16),
} as const

type EdgeLook = keyof typeof edgeLooks | 'snowShrub' | 'boulderCluster' | 'stoneSmall'
type LookGroup = [EdgeLook, ...[number, number, TerrainLook["terrain"]][]]

const west: LookGroup[] = [
  ['roundSnow', [0, 9, 'rock'], [2, 14, 'rock'], [0, 19, 'rock']],
  ['roundTeal', [0, 12, 'pine'], [1, 16, 'pine']],
  ['snowPine', [3, 8, 'pine'], [0, 11, 'rock'], [2, 13, 'rock'], [4, 20, 'pine']],
  ['snowStones', [1, 10, 'rock'], [1, 14, 'rock'], [0, 17, 'rock'], [2, 17, 'rock'], [0, 18, 'rock']],
  ['snowShrub', [0, 13, 'rock'], [3, 16, 'rock'], [6, 20, 'rock']],
]

const east: LookGroup[] = [
  ['roundSnow', [37, 7, 'rock'], [39, 9, 'rock'], [38, 12, 'rock'], [39, 15, 'pine'], [39, 18, 'rock'], [38, 20, 'rock']],
  ['roundTeal', [38, 8, 'rock'], [39, 12, 'rock'], [38, 15, 'rock'], [39, 17, 'rock'], [39, 20, 'rock']],
  ['snowPine', [39, 6, 'pine'], [38, 10, 'rock'], [39, 13, 'rock'], [37, 16, 'rock'], [38, 19, 'rock']],
  ['snowFir', [39, 8, 'rock'], [39, 11, 'pine'], [39, 14, 'rock'], [39, 19, 'rock']],
  ['snowStones', [37, 8, 'rock'], [38, 9, 'rock'], [39, 10, 'rock'], [36, 12, 'rock'], [37, 13, 'rock'], [38, 14, 'rock'], [36, 16, 'rock'], [37, 18, 'rock'], [36, 20, 'rock']],
  ['slateStones', [37, 6, 'rock'], [38, 7, 'rock'], [36, 11, 'rock'], [37, 11, 'rock'], [36, 13, 'rock'], [36, 15, 'rock'], [37, 15, 'rock'],
    [39, 16, 'rock'], [36, 17, 'rock'], [38, 17, 'rock'], [36, 18, 'rock'], [36, 19, 'rock']],
  ['snowStones', [38, 6, 'rock'], [39, 7, 'rock'], [38, 11, 'rock'], [37, 12, 'rock'], [37, 14, 'rock'], [37, 17, 'rock']],
  ['stoneSmall', [36, 14, 'rock']],
  ['roundSnow', [38, 13, 'pine']],
  ['snowPine', [38, 16, 'pine']],
]

const towerGlade: LookGroup[] = [
  ['roundSnow', [34, 6, 'pine'], [29, 7, 'pine']],
  ['roundTeal', [32, 6, 'pine'], [34, 8, 'pine']],
  ['snowPine', [28, 7, 'pine'], [34, 9, 'pine']],
  ['snowFir', [32, 7, 'pine'], [33, 8, 'pine']],
  ['snowStones', [31, 6, 'pine'], [33, 6, 'pine'], [29, 8, 'pine'], [31, 8, 'pine'], [30, 9, 'pine'], [32, 9, 'pine'], [31, 10, 'pine'], [33, 10, 'pine'], [32, 11, 'pine']],
  ['boulderCluster', [23, 9, 'rock'], [26, 15, 'rock'], [27, 19, 'rock']],
  ['stoneSmall', [22, 8, 'rock'], [26, 14, 'rock'], [27, 14, 'rock'], [27, 15, 'rock']],
  ['slateStones', [23, 7, 'rock'], [21, 8, 'rock'], [24, 9, 'rock']],
]

const north: LookGroup[] = [
  ['roundSnow', [1, 1, 'pine'], [12, 0, 'pine'], [23, 1, 'rock'], [34, 2, 'rock']],
  ['roundTeal', [4, 3, 'pine'], [30, 1, 'rock']],
  ['snowPine', [2, 2, 'pine'], [33, 0, 'rock']],
  ['snowStones', [9, 1, 'pine'], [28, 0, 'rock'], [38, 2, 'rock']],
  ['snowShrub', [5, 0, 'pine'], [39, 3, 'pine']],
]

const south: LookGroup[] = [
  ['roundSnow', [37, 21, 'rock'], [4, 29, 'rock'], [11, 29, 'rock'], [25, 29, 'pine'], [35, 29, 'pine']],
  ['roundTeal', [26, 21, 'rock'], [39, 21, 'rock'], [1, 28, 'pine'], [15, 29, 'rock'], [29, 29, 'rock'], [38, 28, 'rock']],
  ['snowPine', [23, 21, 'rock'], [33, 21, 'rock'], [7, 29, 'pine'], [23, 29, 'pine'], [32, 29, 'pine']],
  ['snowStones', [21, 19, 'rock'], [22, 21, 'rock'], [25, 21, 'rock'], [29, 21, 'rock'], [31, 21, 'rock'], [34, 21, 'rock'], [6, 29, 'pine'], [14, 29, 'pine'], [27, 29, 'pine'], [37, 29, 'pine']],
  ['slateStones', [21, 21, 'rock'], [24, 21, 'rock'], [27, 21, 'rock'], [30, 21, 'rock'], [32, 21, 'rock'], [36, 21, 'rock'], [38, 21, 'rock']],
  ['snowShrub', [28, 21, 'rock'], [35, 21, 'rock'], [3, 28, 'rock'], [9, 29, 'pine'], [17, 29, 'pine'], [30, 29, 'pine'], [34, 28, 'pine']],
]

function edgeTerrainLooks(groups: LookGroup[]): Record<string, TerrainLook> {
  const looks: Record<string, TerrainLook> = {}
  for (const [art, ...cells] of groups) {
    const imported = art === 'snowShrub' || art === 'boulderCluster' || art === 'stoneSmall'
    const picture = imported ? sprite(art) : edgeLooks[art]
    for (const [x, y, terrain] of cells) {
      looks[`${x},${y}`] = { terrain, sprite: picture, ...(imported && { scale: COURTYARD_SCALE }) }
    }
  }
  return looks
}

export const COURTYARD_TERRAIN_LOOKS = edgeTerrainLooks([
  ...west, ...east, ...north, ...south, ...towerGlade,
])

// Keep the tower approach and the gap between the two ropes open.
const dressing: [Frame, number, number, boolean?][] = [
  ['wallFoot', COURTYARD_TOWER.x - 1, COURTYARD_TOWER.y + 2],
  ['stoneMedium', COURTYARD_TOWER.x, COURTYARD_TOWER.y + 2, true],
  ['straw', COURTYARD_TOWER.x - 1, COURTYARD_TOWER.y + 3, true], ['snowBloom', 27, 15],

  ['berryBranch', 25, 12], ['straw', 24, 14, true], ['snowShrub', 28, 16],
  ['berryBranch', 28, 17], ['berryMound', 27, 18], ['snowGrass', 35, 16, true],

  ['supplies', COURTYARD_SUPPLIES.x, COURTYARD_SUPPLIES.y],
  ['barrel', 33, 17], ['lamp', COURTYARD_LAMP.x, COURTYARD_LAMP.y], ['firewood', 29, 17],
  ['ropeWest', 29, 18], ['ropeEast', 33, 18], ['snowGrass', 35, 18, true],
]

export const COURTYARD_PREFABS: Record<string, PrefabDef> = Object.fromEntries(dressing.map(([name, , , ground]) => {
  const [x, y, tw, th] = frames[name]
  return [`cloudtop_yard_${name}`, { img: IMAGE, x, y, tw, th, pixelsPerTile: TILE, base: th - 1, grid: Array(th).fill(' '.repeat(tw)), ...(ground && { ground }) }]
}))

export const COURTYARD_STAMPS = dressing.map(([name, x, y]) => {
  const [, , tw, th] = frames[name]
  return { key: `cloudtop_yard_${name}`, x: x - Math.floor(tw / 2), y: y - th + 1 }
})
