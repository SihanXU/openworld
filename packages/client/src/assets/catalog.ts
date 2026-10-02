// The asset catalogue: every sprite, tile, sound and effect the renderer takes from the Ninja
// Adventure pack (CC0, by Pixel-boy & AAA). Paths are relative to the pack root; the copy
// script (packages/tools/src/copyAssets.ts) mirrors every referenced file to
// packages/client/public/assets/na/<same path>. Rects were measured with PIL (tight bounding
// boxes of opaque pixels) and checked visually in src/assets/preview.html.
//
// Conventions used throughout:
// - SpriteDef anchors: (ax, ay) is the pixel inside the rect that sits on the bottom-centre of
//   the entity's tile. 16x16 tile-aligned sprites use (8, 16). Taller/wider sprites put the
//   trunk / base / feet at (ax, ay) and overhang upwards (and sideways, for 2-3 tile wide art).
// - UI SpriteDefs use (0, 0) (top-left) — they are screen-space pieces.

import type { ActorDef, Catalog, FxDef, PrefabDef, SpriteDef } from './types.ts'

// ---------------------------------------------------------------------------------------------
// Sheet paths
// ---------------------------------------------------------------------------------------------
const TS = 'Backgrounds/Tilesets/'
const FLOOR = TS + 'TilesetFloor.png'
const FLOORB = TS + 'TilesetFloorB.png'
const DETAIL = TS + 'TilesetFloorDetail.png'
const WATER = TS + 'TilesetWater.png'
const NATURE = TS + 'TilesetNature.png'
const HOUSE = TS + 'TilesetHouse.png'
const ELEM = TS + 'TilesetElement.png'
const DUNGEON = TS + 'TilesetDungeon.png'
const CAMP = TS + 'tileset_camp.png'
const BED = TS + 'tileset_bed.png'
const RELIEF = TS + 'TilesetRelief.png'
const HOLE = TS + 'TilesetHole.png'
const DESERT = TS + 'TilesetDesert.png'
const IFLOOR = TS + 'Interior/TilesetInteriorFloor.png'
const WALLS = TS + 'Interior/TilesetWallSimple.png'

/** Tile-aligned sprite: (c, r) in tiles, w x h tiles, anchor defaults to bottom-centre of the rect. */
function t(img: string, c: number, r: number, w = 1, h = 1, ax = w * 8, ay = h * 16): SpriteDef {
  return { img, x: c * 16, y: r * 16, w: w * 16, h: h * 16, ax, ay }
}
/** Pixel rect sprite. */
function px(img: string, x: number, y: number, w: number, h: number, ax = w / 2, ay = h): SpriteDef {
  return { img, x, y, w, h, ax, ay }
}
/** A whole small image used as an icon (anchor bottom-centre). */
function icon(img: string, w: number, h: number): SpriteDef {
  return { img, x: 0, y: 0, w, h, ax: Math.floor(w / 2), ay: h }
}
/** UI piece: whole image, anchored top-left. */
function ui(img: string, w: number, h: number, extra: Partial<SpriteDef> = {}): SpriteDef {
  return { img, x: 0, y: 0, w, h, ax: 0, ay: 0, ...extra }
}

// ---------------------------------------------------------------------------------------------
// Blob autotile layout (verified)
// ---------------------------------------------------------------------------------------------
/**
 * The 47-tile blob layout of TilesetFloor.png cols 0-10 rows 7-11, as offsets from the block's
 * top-left. Key = canonical 8-neighbour mask of "same terrain" neighbours:
 *   N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128 (a corner bit only counts when both adjacent
 *   edges are set). Derived by classifying every tile of the reference block pixel-by-pixel
 *   (47 distinct masks, one tile each). NOTE the layout is the 10x4 block + 5 tiles in the 5th
 *   row (cols 4-8) + TWO extra tiles in column 10, rows 2-3 (masks 117 and 213) — so a block
 *   is 11 tiles wide. (0,4)-(3,4) of a block are plain-ground variants, not part of the blob.
 */
export const BLOB47: Record<number, [number, number]> = {
  0: [3, 3], 1: [3, 2], 4: [0, 3], 5: [4, 3], 7: [0, 2], 16: [3, 0], 17: [3, 1], 20: [4, 0], 21: [4, 4],
  23: [4, 1], 28: [0, 0], 29: [4, 2], 31: [0, 1], 64: [2, 3], 65: [7, 3], 68: [1, 3], 69: [8, 3], 71: [6, 3],
  80: [7, 0], 81: [7, 4], 84: [8, 0], 85: [8, 4], 87: [9, 3], 92: [6, 0], 93: [9, 2], 95: [6, 4], 112: [2, 0],
  113: [7, 2], 116: [5, 0], 117: [10, 2], 119: [9, 1], 124: [1, 0], 125: [8, 2], 127: [6, 2], 193: [2, 2],
  197: [5, 3], 199: [1, 2], 209: [7, 1], 213: [10, 3], 215: [8, 1], 221: [9, 0], 223: [6, 1], 241: [2, 1],
  245: [5, 4], 247: [5, 1], 253: [5, 2], 255: [1, 1],
}

// ---------------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------------
/**
 * Verified character sheet layout (Actor/Character/<Name>/SpriteSheet.png, 64x112, 16x16 cells;
 * checked cell-by-cell against each folder's SeparateAnim/*.png):
 *   columns: 0 = facing down (towards viewer), 1 = up (back), 2 = left, 3 = right
 *   rows 0-3: walk cycle (row 0 doubles as the idle frame; Idle.png == row 0)
 *   row 4: attack (one frame per direction)      row 5: jump (one frame per direction)
 *   row 6: col 0 dead, col 1 item-raise (both arms up), col 2 special1, col 3 special2
 * Child and OldWoman only have a 64x32 sheet (rows 0-1 = 2-frame walk).
 * Monster sheets (Actor/Monster/*, 64x64) use the same columns with rows 0-3 = walk frames.
 */
const CHAR_NAMES = [
  'Boy', 'CamouflageGreen', 'CamouflageRed', 'CaveLion', 'CaveLion2', 'Cavegirl', 'Cavegirl2', 'Caveman', 'Caveman2',
  'Child', 'DemonGreen', 'DemonRed', 'EggBoy', 'EggGirl', 'Eskimo', 'FighterRed', 'FighterWhite', 'Flam',
  'GladiatorBlue', 'GoldStatue', 'GreenPig', 'Hunter', 'Inspector', 'Knight', 'KnightGold', 'Lion', 'LionBoy',
  'LionOrange', 'LionYellow', 'ManGreen', 'MaskFrog', 'MaskGoldRacoon', 'MaskRacoon', 'Master', 'Monk', 'Monk2',
  'Monkey', 'MonkeyBoxerBlue', 'MonkeyBoxerRed', 'NinjaBlue', 'NinjaBlue2', 'NinjaBomb', 'NinjaDark', 'NinjaEskimo',
  'NinjaFire', 'NinjaGray', 'NinjaGreen', 'NinjaLeaf', 'NinjaMageBlack', 'NinjaMageOrange', 'NinjaMasked', 'NinjaRed',
  'NinjaRed2', 'NinjaThunder', 'NinjaWater', 'NinjaYellow', 'Noble', 'OldMan', 'OldMan2', 'OldMan3', 'OldWoman', 'Pig',
  'Princess', 'RedGladiator', 'RedNinja3', 'RobotCamouflage', 'RobotGreen', 'RobotGrey', 'Samurai', 'SamuraiBlue',
  'SamuraiRed', 'Shaman', 'ShamanLion', 'Skeleton', 'SkeletonDemon', 'SorcererBlack', 'SorcererOrange', 'Spirit',
  'Statue', 'Sultan', 'Sultan2', 'Tengu', 'Tengu2', 'Vampire', 'Village6', 'Villager', 'Villager2', 'Villager3',
  'Villager4', 'Villager5', 'Villager6', 'Woman',
]
function charDef(name: string): ActorDef {
  const short = name === 'Child' || name === 'OldWoman'
  return {
    dir: 'Actor/Character/' + name,
    sheet: name === 'SamuraiRed' ? 'redsamurai.png' : 'SpriteSheet.png',
    faceset: name === 'ManGreen' ? 'Faceset1.png' : 'Faceset.png',
    cols: 4,
    rows: short ? 2 : 7,
  }
}
const characters: Record<string, ActorDef> = Object.fromEntries(CHAR_NAMES.map((n) => [n, charDef(n)]))

/** 4-direction monster sheet (64x64: cols = down/up/left/right, rows = 4 walk frames). */
function mon(folder: string, sheet = 'SpriteSheet.png', tint?: number): ActorDef {
  return { dir: 'Actor/Monster/' + folder, sheet, faceset: 'Faceset.png', cols: 4, rows: 4, ...(tint !== undefined ? { tint } : {}) }
}
/** A character-layout sheet used as a creature (cols = directions, rows 0-3 walk, 4-6 extras). */
function charCreature(name: string, tint?: number): ActorDef {
  return { ...charDef(name), ...(tint !== undefined ? { tint } : {}) }
}

// Slimes: Slime4 = green, Slime3 = blue, Slime = pale grey-blue, Slime2 = olive with one eye.
// Fire and lightning have no native colour: they reuse the paler sheets with a tint. Phaser's
// default tint is multiplicative (it only darkens), so these tints are deliberately bright; a
// renderer that wants punchier colours can use tintFill/additive at partial strength instead.
const SLIME_GREEN = mon('Slime4', 'Slime4.png')
const SLIME_FIRE = mon('Slime', 'Slime.png', 0xff9a6a)
const SLIME_ICE = mon('Slime', 'Slime.png', 0xd8f2ff)
const SLIME_LIGHTNING = mon('Slime2', 'Slime2.png', 0xfff27a)
const SLIME_WATER = mon('Slime3', 'Slime3.png')

// ---------------------------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------------------------
function fx(img: string, fw: number, fh: number, frames: number, fps: number, extra: Partial<FxDef> = {}): FxDef {
  return { img: 'FX/' + img, fw, fh, frames, fps, ...extra }
}

// ---------------------------------------------------------------------------------------------
// Prefab helper
// ---------------------------------------------------------------------------------------------
function pf(img: string, c: number, r: number, grid: string[], terrain?: string): PrefabDef {
  return { img, x: c * 16, y: r * 16, tw: grid[0].length, th: grid.length, grid, ...(terrain ? { terrain } : {}) }
}

const SND = 'Audio/Sounds/'
const MUS = 'Audio/Musics/'

export const CATALOG: Catalog = {
  // -------------------------------------------------------------------------------------------
  // Blobs. Every block below was checked two ways: (1) rendering a random island through
  // BLOB47 and looking at it, (2) per-tile neighbour classification. All listed blocks match.
  // "outside" = what the non-terrain part of edge tiles shows; the renderer should draw that
  // terrain (or anything, for transparent/self-bordered blocks) under / next to the blob.
  // -------------------------------------------------------------------------------------------
  blobs: {
    // Dirt road on the yellow-green grass. Outside: grass (TilesetFloor row 12).
    path: { img: FLOOR, col: 0, row: 7 },
    // Water with a brown bank + white foam, on the same yellow-green grass. Outside: grass.
    water: { img: WATER, col: 0, row: 6 },
    // Same block as water (the pack has no darker water on grass). Outside: grass.
    deepwater: { img: WATER, col: 0, row: 6 },
    // Darker furrowed soil. Outside: the DARK green grass of TilesetFloor (11,12) — on the
    // yellow-green grass this shows as a thin darker-green hedge ring around the field.
    farmland: { img: FLOOR, col: 11, row: 7 },
    // Warm sandstone cobbles (town square). Self-bordered: the block draws its own darker rim
    // inside each edge tile and has no outside pixels, so any neighbour works.
    cobble: { img: IFLOOR, col: 0, row: 12 },
    // Tan parquet with a carved border. Self-bordered (room floor; no outside pixels).
    floor_wood: { img: IFLOOR, col: 11, row: 0 },
    // Grey-green stone slabs with a carved border. Self-bordered (room floor).
    floor_stone: { img: IFLOOR, col: 11, row: 6 },
    // Orange-red patterned rug with a bordered edge. Self-bordered: sits on the room floor.
    carpet: { img: IFLOOR, col: 0, row: 6 },
    // Dark rounded stones. Self-bordered (no outside pixels).
    cave_floor: { img: IFLOOR, col: 11, row: 12 },
    // White snow drifts. Outside: TRANSPARENT — whatever the renderer draws under the tile
    // (grass, dirt…) shows around the drift edges.
    snow: { img: FLOORB, col: 0, row: 0 },
    // Wooden deck / jetty (front edge with posts on the south side). Outside: TRANSPARENT — draw
    // the water (or ground) under it. Plain plank tiles are also listed in `plain.bridge`.
    bridge: { img: WATER, col: 0, row: 12 },
  },

  // -------------------------------------------------------------------------------------------
  // Plain ground tiles (variants picked per position). Opaque 16x16 unless noted.
  // -------------------------------------------------------------------------------------------
  plain: {
    // The yellow-green grass that is the "outside" of path/water: col 0 plain, 1-4 with tufts.
    grass: [[FLOOR, 0, 12], [FLOOR, 0, 12], [FLOOR, 1, 12], [FLOOR, 2, 12], [FLOOR, 3, 12], [FLOOR, 4, 12]],
    drygrass: [[FLOOR, 0, 12], [FLOOR, 2, 12], [FLOOR, 3, 12]],
    flowers: [[FLOOR, 0, 12], [FLOOR, 4, 12]],
    // Ground under terrain objects.
    tree: [[FLOOR, 0, 12], [FLOOR, 1, 12]],
    pine: [[FLOOR, 0, 12], [FLOOR, 1, 12]],
    bush: [[FLOOR, 0, 12]],
    rock: [[FLOOR, 0, 12]],
    stump: [[FLOOR, 0, 12]],
    charred_tree: [[FLOOR, 12, 15], [FLOOR, 11, 18]],
    // Light brown earth (plain + tufts) — TilesetFloor (11..15, 19).
    dirt: [[FLOOR, 11, 19], [FLOOR, 11, 19], [FLOOR, 12, 19], [FLOOR, 13, 19], [FLOOR, 14, 19], [FLOOR, 15, 19]],
    // Light sand (full tile + stick / pebble variants) from the sand group.
    sand: [[FLOOR, 1, 1], [FLOOR, 1, 1], [FLOOR, 0, 4], [FLOOR, 1, 4]],
    // White snow (+ stick / pebble variants) from the snow group.
    snow: [[FLOOR, 1, 15], [FLOOR, 1, 15], [FLOOR, 0, 18], [FLOOR, 1, 18]],
    // Glassy ice sheet.
    ice: [[FLOORB, 0, 5], [FLOOR, 1, 22]],
    // Burnt ground: the dark grey-brown soil of the (11,14) group (+ twig / pebble).
    ash: [[FLOOR, 12, 15], [FLOOR, 11, 18], [FLOOR, 12, 18]],
    // Dark rounded stones (centre tile of the cave_floor block).
    gravel: [[IFLOOR, 12, 13]],
    // Brown wet soil (centre of the farmland block + stick / pebble).
    mud: [[FLOOR, 12, 8], [FLOOR, 11, 11], [FLOOR, 12, 11]],
    // No lava in the pack: flat orange from the (11,21) group — animate/tint it in the renderer.
    lava: [[FLOOR, 12, 22]],
    // Wooden planks (centre of the dock block).
    bridge: [[WATER, 1, 13]],
    // Stairs / door have transparent rounded corners: draw the room floor under them first.
    stairs_down: [[ELEM, 6, 11]],
    stairs_up: [[ELEM, 6, 12]],
    door: [[ELEM, 8, 13]],
    // Near-black hole interior.
    void: [[HOLE, 1, 1]],
    // Solid-looking fallbacks (the pointed tops have a few transparent pixels).
    wall: [[HOUSE, 11, 9], [HOUSE, 12, 9]],
    woodwall: [[HOUSE, 11, 5], [HOUSE, 12, 5]],
    roof: [[HOUSE, 13, 1], [HOUSE, 14, 1]],
    cave_wall: [[RELIEF, 5, 1], [RELIEF, 9, 1], [RELIEF, 10, 1]],
  },

  // -------------------------------------------------------------------------------------------
  // Decals (transparent 16x16 details scattered on plain ground).
  // -------------------------------------------------------------------------------------------
  decals: {
    grass: [
      t(DETAIL, 0, 2), t(DETAIL, 1, 2), t(DETAIL, 2, 2), t(DETAIL, 3, 2), t(DETAIL, 4, 2), t(DETAIL, 5, 2),
      t(DETAIL, 6, 2), t(DETAIL, 7, 2), t(DETAIL, 2, 0), t(DETAIL, 3, 0), t(DETAIL, 1, 0), t(DETAIL, 6, 0),
      t(NATURE, 15, 18), t(NATURE, 16, 18),
    ],
    // Indoor specks / pebbles (the pack has no dedicated indoor decals).
    floor: [t(DETAIL, 3, 0), t(DETAIL, 15, 0), t(DETAIL, 0, 1)],
    snow: [t(DETAIL, 0, 3), t(DETAIL, 1, 3), t(DETAIL, 2, 3), t(DETAIL, 3, 3), t(DETAIL, 4, 3), t(DETAIL, 6, 3), t(DETAIL, 10, 0)],
    sand: [t(DETAIL, 9, 0), t(DETAIL, 15, 0), t(NATURE, 17, 18), t(NATURE, 18, 18)],
    dirt: [t(DETAIL, 5, 0), t(DETAIL, 7, 0), t(DETAIL, 15, 0), t(NATURE, 15, 18)],
    ash: [t(NATURE, 8, 13), t(NATURE, 9, 13), t(DETAIL, 5, 0), t(DETAIL, 8, 0)],
    leaves: [t(DETAIL, 0, 0), t(DETAIL, 1, 0), t(NATURE, 12, 11), t(NATURE, 13, 12)],
  },

  // -------------------------------------------------------------------------------------------
  // Decor: the detail layer the map author places by hand or by mask (purely visual).
  // -------------------------------------------------------------------------------------------
  decor: {
    // lying on the ground
    pebbles: { sprites: [t(NATURE, 15, 18), t(NATURE, 16, 18), t(NATURE, 17, 18), t(DETAIL, 9, 0)] },
    twigs: { sprites: [t(DETAIL, 5, 0), t(DETAIL, 6, 0), t(DETAIL, 7, 0), t(DETAIL, 8, 0)] },
    leaves: { sprites: [t(DETAIL, 0, 0), t(DETAIL, 1, 0), t(NATURE, 12, 11), t(NATURE, 13, 12)] },
    petals: { sprites: [t(DETAIL, 2, 0), t(DETAIL, 3, 0)] },
    flowers: { sprites: [t(DETAIL, 5, 2), t(NATURE, 6, 11), t(NATURE, 3, 11), t(DETAIL, 2, 0)] },
    sunflowers: { sorted: true, sprites: [t(NATURE, 0, 11), t(NATURE, 1, 11)] },
    tufts: { sprites: [t(NATURE, 4, 10), t(NATURE, 5, 10), t(NATURE, 7, 10), t(NATURE, 8, 10), t(NATURE, 10, 10), t(DETAIL, 0, 2), t(DETAIL, 3, 2)] },
    ferns: { sprites: [t(NATURE, 4, 11), t(NATURE, 5, 11), t(NATURE, 8, 11), t(NATURE, 9, 11)] },
    clover: { sprites: [t(DETAIL, 7, 2), t(DETAIL, 6, 2), t(NATURE, 2, 11)] },
    puddle: { sprites: [t(DETAIL, 0, 1)] },
    shells: { sprites: [t(DETAIL, 11, 0), t(DETAIL, 15, 0)] },
    // standing (y-sorted)
    rocks: { sorted: true, sprites: [t(NATURE, 17, 17), t(NATURE, 18, 17), t(NATURE, 19, 17), t(NATURE, 18, 13), t(NATURE, 19, 13)] },
    stump: { sorted: true, sprites: [t(NATURE, 12, 13), t(NATURE, 13, 13), t(NATURE, 14, 18)] },
    log: { sorted: true, sprites: [t(CAMP, 0, 0, 2, 1), t(CAMP, 2, 0, 2, 1)] },
    log_v: { sorted: true, sprites: [t(NATURE, 12, 14, 1, 2), t(NATURE, 13, 14, 1, 2)] },
    logs: { sorted: true, sprites: [t(CAMP, 0, 1, 1, 2), t(CAMP, 3, 1, 1, 2)] },
    planks: { sorted: true, sprites: [t(ELEM, 10, 2), t(ELEM, 9, 2)] },
    baskets: { sorted: true, sprites: [t(HOUSE, 16, 13), t(HOUSE, 17, 13), t(HOUSE, 18, 13)] },
    produce: { sorted: true, sprites: [t(HOUSE, 19, 14), t(HOUSE, 20, 14)] },
    bucket: { sorted: true, sprites: [t(ELEM, 4, 0), t(ELEM, 5, 0)] },
    sack: { sorted: true, sprites: [t(ELEM, 0, 5, 1, 2), t(CAMP, 4, 5)] },
    jar: { sorted: true, sprites: [t(ELEM, 2, 9), t(ELEM, 1, 0)] },
    potted: { sorted: true, sprites: [t(ELEM, 0, 7, 1, 2)] },
    sheaf: { sorted: true, sprites: [t(ELEM, 12, 4, 1, 2)] },
    tools: { sorted: true, sprites: [t(HOUSE, 14, 18, 1, 2)] },
    workbench: { sorted: true, sprites: [t(HOUSE, 29, 8, 2, 1)] },
    rope: { sprites: [t(CAMP, 10, 7, 2, 2)] },
    tub: { sorted: true, sprites: [t(CAMP, 7, 3), t(CAMP, 7, 4)] },
    lantern_post: { sorted: true, sprites: [t(CAMP, 6, 5, 1, 2), t(CAMP, 7, 5, 1, 2)] },
    // an orchard's fruit trees: one kind, planted in rows (2x2, trunk on the tile)
    fruit_tree: { sorted: true, sprites: [t(NATURE, 16, 0, 2, 2, 16, 31), t(NATURE, 18, 0, 2, 2, 16, 31)] },
  },

  // -------------------------------------------------------------------------------------------
  // Terrain objects (one per tile; overhang upwards). All from TilesetNature unless noted.
  // -------------------------------------------------------------------------------------------
  terrainObjects: {
    tree: [
      px(NATURE, 0, 0, 32, 32, 16, 31), // round green, 2x2
      px(NATURE, 256, 0, 32, 32, 16, 32), // round green
      px(NATURE, 288, 0, 32, 32, 16, 32), // round green, yellow base
      px(NATURE, 96, 0, 32, 32, 15, 32), // bushy tree with roots
      px(NATURE, 96, 128, 32, 32, 15, 32), // small round tree on a trunk
      px(NATURE, 48, 288, 48, 48, 24, 48), // big 3x3 green
      px(NATURE, 144, 288, 48, 48, 24, 48), // big 3x3 autumn
      px(NATURE, 224, 0, 32, 32, 16, 31), // cherry blossom 2x2
      px(NATURE, 0, 288, 48, 48, 24, 48), // big 3x3 cherry blossom
    ],
    pine: [
      px(NATURE, 32, 0, 32, 32, 16, 31),
      px(NATURE, 128, 0, 32, 32, 16, 32), // lightly snowed
      px(NATURE, 160, 0, 32, 32, 16, 32), // snowed
    ],
    bush: [t(NATURE, 1, 10), t(NATURE, 2, 10), t(NATURE, 6, 10), t(NATURE, 10, 10), t(NATURE, 10, 8), t(NATURE, 8, 11), t(NATURE, 4, 11), t(NATURE, 5, 11)],
    rock: [
      t(NATURE, 15, 9), t(NATURE, 18, 9), t(NATURE, 7, 12), t(NATURE, 8, 12), t(NATURE, 4, 13),
      px(NATURE, 208, 128, 32, 32, 16, 31), // big brown rock
      px(NATURE, 256, 128, 32, 32, 16, 31), // big grey rock
    ],
    stump: [t(NATURE, 4, 8), t(NATURE, 14, 18), t(NATURE, 12, 13), px(NATURE, 0, 128, 32, 32, 16, 29), px(NATURE, 32, 128, 32, 32, 16, 29)],
    // Bare dead trees (the pack has no burnt trees; these read as charred).
    charred_tree: [px(NATURE, 64, 0, 32, 32, 16, 31), t(NATURE, 4, 9)],
    // Tall grass tufts. The pack's tufts are green: tint them golden (e.g. 0xe0c060) for dry
    // grass. The last one (orange straw bush, TilesetNature (9,8)) is already golden — no tint.
    drygrass: [t(NATURE, 3, 10), t(NATURE, 4, 10), t(NATURE, 5, 10), t(NATURE, 7, 10), t(NATURE, 9, 10), t(DETAIL, 3, 2), t(NATURE, 9, 8)],
    flowers: [t(NATURE, 0, 11), t(NATURE, 1, 11), t(NATURE, 3, 11), t(NATURE, 6, 11), t(NATURE, 2, 11), t(DETAIL, 5, 2), t(DETAIL, 2, 0)],
    // Grey dead-grass tufts for burnt ground.
    ash: [t(NATURE, 8, 13), t(NATURE, 9, 13)],
  },

  // -------------------------------------------------------------------------------------------
  // Prefabs. Grids: '#' solid, '.' drawn & walkable, 'D' door (the tile you walk into), ' ' empty.
  // -------------------------------------------------------------------------------------------
  prefabs: {
    // Four 4x3 cottages (roof rows 0-1, wall row 2, door = the dark arch at column 1).
    house_orange: pf(HOUSE, 0, 0, ['####', '####', '#D##']),
    house_plaster: pf(HOUSE, 4, 0, ['####', '####', '#D##']),
    house_thatch: pf(HOUSE, 8, 0, ['####', '####', '#D##']),
    house_red: pf(HOUSE, 12, 0, ['####', '####', '#D##']),
    // Wooden house seen corner-on, door centre.
    house_wood: pf(HOUSE, 26, 0, ['###', '###', '#D#']),
    // Front-gabled wooden cabin (3x3), door centre.
    cabin: pf(HOUSE, 19, 19, ['###', '###', '#D#']),
    // Shop with a hanging sign on the roof; door centre.
    shop: pf(HOUSE, 16, 0, ['###', '###', '#D#']),
    // General store: tall right wing (sign, round window) + low left wing with the door.
    store: pf(HOUSE, 29, 0, ['  ##', '####', '####', '#D##']),
    // Tea house with lanterns (4x3): lattice door at col 1 is closed; the open doorway is col 2.
    teahouse: pf(HOUSE, 19, 0, ['####', '####', '##D#']),
    // Inn: big two-storey A-frame (4x5), door at col 1 of the bottom row.
    inn: pf(HOUSE, 25, 14, ['####', '####', '####', '####', '#D##']),
    // Thatched longhouse: thatch roof piece (rows 7-11) stacked on the ground-floor piece (12-13).
    longhouse: pf(HOUSE, 25, 7, [' ## ', '####', '####', '####', '####', '####', '#D##']),
    // Smithy: orange canvas forge hut, door centre.
    smithy: pf(HOUSE, 0, 7, ['###', '###', '#D#']),
    // Straw hut (3 wide x 2 tall), door centre.
    hut_straw: pf(HOUSE, 3, 8, ['###', '#D#']),
    // Stone temple with sun emblem, door centre.
    temple: pf(HOUSE, 23, 0, ['###', '###', '#D#']),
    // Shrine: seated statue holding a glowing orb (2x2, not enterable).
    shrine: pf(HOUSE, 3, 15, ['##', '##']),
    shrine_stone: pf(HOUSE, 3, 19, ['##', '##']),
    statue_bear: pf(HOUSE, 1, 15, ['..', '##', '##']),
    statue_frog: pf(HOUSE, 3, 17, ['##', '##']),
    // Pottery kiln / furnace building (3x4, the opening is a fire mouth, not a door).
    kiln: pf(HOUSE, 29, 4, ['###', '###', '###', '###']),
    igloo: pf(HOUSE, 0, 11, ['###', '###', '#D#']),
    // Narrower igloo drawn off-centre in its 3 tiles (x 7..41 of 48); door in the middle column.
    igloo_small: pf(HOUSE, 3, 11, ['###', '###', '#D#']),
    igloo_brick: pf(HOUSE, 6, 11, ['###', '###', '#D#']),
    // Camp tents (tileset_camp): plain, patched, torn. Door = the dark opening, centre.
    tent: pf(CAMP, 4, 0, ['###', '###', '#D#']),
    tent_patched: pf(CAMP, 7, 0, ['###', '###', '#D#']),
    tent_torn: pf(CAMP, 10, 0, ['###', '###', '#D#']),
    // Torii gate: beam overhead (walkable), pillars on the bottom row at cols 0 and 2.
    gate: pf(HOUSE, 0, 5, ['...', '#.#']),
    // Stone arch / portal ring: legs on cols 0 and 2.
    arch: pf(HOUSE, 29, 20, ['...', '#.#', '#.#']),
    // Fences / walls (1x1 pieces, stamp repeatedly). _h pieces join left-right, _v top-bottom.
    fence_h: pf(HOUSE, 11, 5, ['#'], 'woodwall'), // pointed palisade
    fence_v: pf(HOUSE, 11, 4, ['#'], 'woodwall'),
    rail_h: pf(HOUSE, 11, 7, ['#'], 'woodwall'), // low rail fence
    rail_v: pf(HOUSE, 11, 6, ['#'], 'woodwall'),
    stonewall_h: pf(HOUSE, 11, 9, ['#']),
    stonewall_v: pf(HOUSE, 11, 8, ['#']),
    // Bridges run north-south (planks across, rails on the east/west sides). 4 wide x 3 long.
    bridge_ns: pf(HOUSE, 9, 15, ['....', '....', '....'], 'bridge'),
    bridge_stone_ns: pf(HOUSE, 9, 19, ['....', '....', '....'], 'bridge'),
    // Wooden dock platform (3x3 corner of the TilesetWater deck block; transparent outside).
    dock: pf(WATER, 0, 12, ['...', '...', '...'], 'bridge'),
    // Cliffs (TilesetRelief): plateau with a cliff face on its bottom row, and a sheer rock face.
    cliff: pf(RELIEF, 1, 0, ['###', '###', '###'], 'cave_wall'),
    cliff_sand: pf(RELIEF, 1, 5, ['###', '###', '###'], 'cave_wall'),
    cliff_wall: pf(RELIEF, 4, 0, ['###', '###', '###'], 'cave_wall'),
    cliff_wall_sand: pf(RELIEF, 4, 5, ['###', '###', '###'], 'cave_wall'),
    // Desert lion-head wall fountain (2x3) and a square water basin (2x2).
    fountain_lion: pf(DESERT, 0, 6, ['##', '##', '##']),
    pool: pf(DESERT, 8, 7, ['##', '##'], 'water'),
  },

  // -------------------------------------------------------------------------------------------
  // Room frames (TilesetWallSimple.png, 10x11 tiles). Each frame is 5x5 tiles:
  //   corners (0,0) (4,0) (0,4) (4,4); edges: top (1..3,0), bottom (1..3,4), left (0,1..3),
  //   right (4,1..3). The edge pieces have a decorative break between tiles 1 and 2, so
  //   repeating 1,2,3,1,2,3… tiles seamlessly (3 -> 1 joins cleanly). The wall band is ~12px
  //   thick on the outer side of each ring tile; the rest of each ring tile is the dark void
  //   (#141b1b) outside the room. The inner 3x3 is transparent EXCEPT a round decoration at
  //   (2..3, 1..2) — do not draw the inner tiles.
  // -------------------------------------------------------------------------------------------
  rooms: {
    plaster: { img: WALLS, col: 0, row: 0, size: 5 },
    wood: { img: WALLS, col: 5, row: 0, size: 5 },
    stone: { img: WALLS, col: 0, row: 6, size: 5 },
    moss: { img: WALLS, col: 5, row: 6, size: 5 },
  },

  // -------------------------------------------------------------------------------------------
  // Fixtures. base = normal state; open / lit only where the pack draws that state.
  // -------------------------------------------------------------------------------------------
  fixtures: {
    'fixture:fixture': { base: t(DUNGEON, 2, 1), open: t(DUNGEON, 3, 1) },
    'fixture:container': { base: px('Items/Treasure/BigTreasureChest.png', 0, 0, 16, 14), open: px('Items/Treasure/BigTreasureChest.png', 16, 0, 16, 14) },
    'fixture:chest': { base: px('Items/Treasure/BigTreasureChest.png', 0, 0, 16, 14), open: px('Items/Treasure/BigTreasureChest.png', 16, 0, 16, 14) },
    'fixture:barrel': { base: t(HOUSE, 16, 15), open: t(HOUSE, 17, 15) },
    'fixture:crate': { base: t(DUNGEON, 2, 1), open: t(DUNGEON, 3, 1) },
    'fixture:pot': { base: t(ELEM, 2, 9) },
    'fixture:wardrobe': { base: t(ELEM, 2, 7, 1, 2) },
    'fixture:shelf': { base: t(ELEM, 4, 7, 1, 2) },
    'fixture:bookshelf': { base: t(ELEM, 3, 7, 1, 2) },
    'fixture:sack': { base: t(ELEM, 1, 1) },
    'fixture:furniture': { base: t(ELEM, 5, 7) },
    'fixture:table': { base: t(ELEM, 5, 7) },
    'fixture:chair': { base: t(ELEM, 0, 9) },
    'fixture:bed': { base: t(BED, 5, 3, 1, 2) },
    'fixture:bench': { base: t(CAMP, 3, 7) },
    'fixture:counter': { base: t(ELEM, 14, 0) },
    'fixture:stall': { base: t(ELEM, 7, 1, 1, 2) },
    'fixture:light': { base: px(ELEM, 96, 48, 16, 32, 8, 29) },
    'fixture:campfire': { base: px(CAMP, 192, 80, 32, 32, 16, 24) },
    'fixture:brazier': { base: t(HOUSE, 32, 11), lit: t(HOUSE, 31, 11) },
    'fixture:lamppost': { base: px(ELEM, 96, 48, 16, 32, 8, 29) },
    // The only candle in the pack is already burning.
    'fixture:candles': { base: t(CAMP, 13, 7) },
    'fixture:fireplace': { base: px(HOUSE, 464, 176, 32, 32, 16, 30) },
    'fixture:water': { base: t(ELEM, 6, 2) },
    'fixture:well': { base: t(ELEM, 6, 2) },
    'fixture:fountain': { base: px(DESERT, 128, 112, 32, 32, 16, 28) },
    'fixture:trough': { base: t(ELEM, 6, 10) },
    'fixture:sign': { base: t(ELEM, 0, 2) },
    'fixture:noticeboard': { base: t(ELEM, 1, 2) },
    'fixture:craft': { base: t(HOUSE, 29, 15) },
    'fixture:anvil': { base: t(HOUSE, 29, 15) },
    'fixture:forge': { base: px(HOUSE, 496, 192, 32, 48, 16, 46) },
    'fixture:cauldron': { base: t(HOUSE, 32, 10), lit: t(HOUSE, 31, 10) },
    // No loom in the pack: a wooden frame with a strung rope (TilesetElement (11..13, 2..3)).
    'fixture:loom': { base: px(ELEM, 176, 32, 48, 32, 24, 29) },
    'fixture:sacred': { base: t(HOUSE, 7, 15, 1, 2) },
    'fixture:altar': { base: px(HOUSE, 48, 240, 32, 32, 16, 32) },
    'fixture:statue': { base: t(HOUSE, 7, 15, 1, 2) },
    'fixture:gravestone': { base: t(ELEM, 4, 2) },
    'fixture:seal_stone': { base: t(DUNGEON, 3, 2), lit: t(DUNGEON, 5, 2) },
    'fixture:nature': { base: t(NATURE, 18, 9) },
    'fixture:boulder': { base: t(NATURE, 18, 9) },
    'fixture:haystack': { base: px(ELEM, 192, 64, 16, 32, 8, 31) },
    'fixture:logpile': { base: px(HOUSE, 496, 256, 32, 16, 16, 16) },
    // No static mushroom art: first frame of the (red-capped) Mushroom monster.
    'fixture:mushroom_ring': { base: t('Actor/Monster/Mushroom/mushroom.png', 0, 0) },
    'fixture:beehive': { base: t(ELEM, 12, 0) },
    'fixture:fence': { base: t(HOUSE, 11, 7) },
    'fixture:dummy': { base: t(ELEM, 15, 0) },
    // Crops (farming). The pack has no crop sheet: sprouts are ground details, young plants are
    // small nature tufts/bushes, ripe wheat is the camp tileset's golden sheaf, ripe berries the
    // fruiting bush, the oak sapling the bare twig tree.
    'fixture:crop': { base: t(CAMP, 13, 1) },
    'fixture:wheat': { base: t(CAMP, 13, 0) },
    'fixture:wheat_sprout': { base: t(DETAIL, 1, 2) },
    'fixture:wheat_young': { base: t(CAMP, 13, 1) },
    'fixture:wheat_ripe': { base: t(CAMP, 13, 0) },
    'fixture:herb': { base: t(NATURE, 5, 11) },
    'fixture:herb_sprout': { base: t(DETAIL, 2, 2) },
    'fixture:herb_young': { base: t(NATURE, 8, 10) },
    'fixture:herb_ripe': { base: t(NATURE, 5, 11) },
    'fixture:berry': { base: t(NATURE, 4, 14) },
    'fixture:berry_sprout': { base: t(DETAIL, 0, 2) },
    'fixture:berry_young': { base: t(NATURE, 1, 10) },
    'fixture:berry_ripe': { base: t(NATURE, 4, 14) },
    'fixture:oak': { base: t(NATURE, 5, 9) },
    'fixture:oak_sapling': { base: t(NATURE, 5, 9) },
    // Building: a timber rack for the frame, a stake, a sign post and a ring of stones.
    'fixture:build': { base: px(CAMP, 128, 48, 32, 32, 16, 30) },
    'fixture:frame': { base: px(CAMP, 128, 48, 32, 32, 16, 30) },
    'fixture:stakes': { base: t(CAMP, 0, 5, 1, 2) },
    'fixture:post': { base: t(CAMP, 6, 5, 1, 2) },
    'fixture:ring': { base: px(CAMP, 160, 48, 32, 32, 16, 28) },
    // The Great Hearth: a wide ring of stones around old ash; lit, the embers glow.
    'fixture:hearth': { base: t(CAMP, 12, 5, 2, 2, 16, 24), lit: t(CAMP, 12, 3, 2, 2, 16, 24) },
    'fixture:scarecrow': { base: t(ELEM, 15, 0) },
    'fixture:washing_line': { base: t(ELEM, 11, 2, 5, 1, 40, 16) },
    'fixture:cart': { base: t(ELEM, 0, 3, 2, 2, 16, 30) },
    'fixture:flower_cart': { base: t(ELEM, 2, 3, 2, 2, 16, 30) },
    'fixture:workbench': { base: t(HOUSE, 29, 8, 2, 1, 16, 16) },
  },

  // -------------------------------------------------------------------------------------------
  // Item icons.
  // -------------------------------------------------------------------------------------------
  items: {
    'item:acorn': icon('Items/Food/Nut.png', 15, 15),
    'item:sword': icon('Items/Weapons/Sword2/Sprite.png', 6, 15),
    'item:dagger': icon('Items/Projectile/Kunai.png', 16, 16),
    'item:axe': icon('Items/Tool/Axe.png', 16, 16),
    'item:club': icon('Items/Weapons/Club/Sprite.png', 8, 14),
    'item:mace': icon('Items/Weapons/Hammer/Sprite.png', 9, 16),
    'item:hammer': icon('Items/Tool/Hammer.png', 16, 16),
    'item:spear': icon('Items/Weapons/Lance2/Sprite.png', 7, 21),
    'item:bow': icon('Items/Weapons/Bow/Sprite.png', 15, 7),
    'item:wand': icon('Items/Weapons/MagicWand/SpriteInHand.png', 5, 10),
    'item:staff': icon('Items/Weapons/MagicWand/Sprite.png', 5, 18),
    // Armour pieces only exist as 24x24 skill icons (with their coloured badge background).
    'item:helmet': icon('Ui/Skill Icon/Items & Weapon/Helmet.png', 24, 24),
    'item:shield': icon('Ui/Skill Icon/Items & Weapon/Guard.png', 24, 24),
    'item:armor': icon('Ui/Skill Icon/Items & Weapon/Armor.png', 24, 24),
    'item:boots': icon('Ui/Skill Icon/Items & Weapon/Boot.png', 24, 24),
    // Red cloth hanging on the clothes line (TilesetElement (15,3)).
    'item:cloak': t(ELEM, 15, 3),
    // Conical straw (kasa) hat shape, TilesetHouse (29,17).
    'item:hat': t(HOUSE, 29, 17),
    'item:gloves': icon('Items/Action/Interact.png', 16, 16),
    'item:pickaxe': icon('Items/Tool/Pickaxe.png', 16, 16),
    'item:shovel': icon('Items/Tool/Shovel.png', 16, 16),
    'item:hoe': icon('Items/Tool/Hoe.png', 16, 16),
    'item:sickle': icon('Items/Tool/Sickle.png', 16, 16),
    'item:rod': icon('Items/Weapons/Fishing Rod/Sprite.png', 10, 14),
    'item:rope': t(CAMP, 11, 8),
    'item:flint': icon('Items/Resource/BarIron.png', 16, 15),
    'item:broom': icon('Items/Weapons/Fork/Sprite.png', 7, 16),
    'item:key': icon('Items/Treasure/SilverKey.png', 12, 8),
    // No torch art: a single flame (first frame of FX/Particle/Fire.png).
    'item:torch': px('FX/Particle/Fire.png', 0, 0, 8, 12),
    'item:candle': t(CAMP, 13, 7),
    'item:lantern': t(HOUSE, 30, 17),
    'item:bucket': t(ELEM, 4, 0),
    'item:bucket_water': t(ELEM, 5, 0),
    'item:bucket_oil': t(ELEM, 4, 1),
    'item:flask': icon('Items/Potion/EmptyPot.png', 9, 11),
    'item:flask_water': icon('Items/Potion/WaterPot.png', 9, 11),
    'item:flask_oil': icon('Items/Potion/MilkPot.png', 9, 11),
    'item:waterskin': icon('Items/Object/Gourd.png', 14, 14),
    'item:cup': icon('Items/Treasure/SilverCup.png', 9, 11),
    'item:plate': t(ELEM, 5, 9),
    'item:pot': t(CAMP, 6, 4),
    'item:bread': t(ELEM, 8, 2),
    'item:apple': t(ELEM, 9, 10),
    'item:cheese': icon('Items/Food/Sushi2.png', 16, 16),
    'item:fish': icon('Items/Food/Fish.png', 16, 16),
    'item:fish_cooked': icon('Items/Food/Yakitori.png', 16, 16),
    'item:meat': icon('Items/Food/Beaf.png', 16, 16),
    'item:meat_cooked': icon('Items/Food/Meat.png', 15, 15),
    'item:mushroom': t('Actor/Monster/Mushroom/mushroom.png', 0, 0),
    'item:berries': t(DETAIL, 4, 0),
    'item:egg': icon('Items/Food/Nut.png', 15, 15),
    'item:pie': t(HOUSE, 14, 17),
    'item:honey': icon('Items/Food/Honey.png', 16, 16),
    'item:wine': t(CAMP, 12, 7),
    'item:ale': icon('Items/Resource/Water.png', 14, 14),
    'item:potion_red': icon('Items/Potion/LifePot.png', 9, 11),
    'item:potion_green': t(HOUSE, 21, 14),
    'item:potion_orange': t(HOUSE, 21, 15),
    'item:potion_purple': t(HOUSE, 21, 13),
    'item:log': t(CAMP, 8, 8),
    'item:plank': t(HOUSE, 31, 17),
    'item:stick': icon('Items/Resource/Branch.png', 16, 16),
    'item:stone': icon('Items/Resource/Rock.png', 16, 16),
    'item:coal': t(NATURE, 7, 12),
    'item:ore': t(NATURE, 6, 14),
    'item:ore_gold': t(NATURE, 4, 14),
    'item:herb': icon('Items/Resource/Grass.png', 16, 16),
    'item:herb_red': t(DETAIL, 5, 2),
    'item:mushroom_blue': t('Actor/Monster/Mushroom2/mushroom2.png', 0, 0),
    'item:feather': icon('Items/Resource/feather.png', 16, 16),
    'item:bone': t(DETAIL, 14, 0),
    'item:cloth': icon('Items/Scroll/Scroll.png', 14, 14),
    'item:leather': icon('Items/Object/Bag.png', 16, 16),
    'item:wool': t(NATURE, 10, 12),
    'item:wax': icon('Items/Food/SeedLargeWhite.png', 14, 13),
    'item:salt': t(NATURE, 10, 13),
    'item:ash': t(NATURE, 11, 12),
    'item:seed': icon('Items/Food/Seed1.png', 8, 8),
    'item:wheat': t(ELEM, 12, 4),
    'item:gem': icon('Items/Resource/GemRed.png', 15, 15),
    'item:coins': icon('Items/Object/MoneyBag.png', 14, 15),
    'item:ring': icon('Ui/Skill Icon/Items & Weapon/Ring.png', 24, 24),
    'item:amulet': icon('Ui/Skill Icon/Items & Weapon/Amulet.png', 24, 24),
    'item:goblet': icon('Items/Treasure/GoldCup.png', 9, 11),
    'item:crown': icon('Items/Resource/GemYellow.png', 14, 14),
    'item:shard': icon('Items/Resource/GemPurple.png', 16, 16),
    'item:book': icon('Items/Object/Book.png', 16, 16),
    'item:scroll': icon('Items/Scroll/ScrollEmpty.png', 16, 16),
    'item:letter': icon('Items/Other/Letter.png', 12, 9),
    'item:map': t(HOUSE, 15, 18),
    // Dome on a handle (TilesetHouse (29,16)) — reads as a hand bell.
    'item:bell': t(HOUSE, 29, 16),
    'item:flute': icon('Items/Object/PanFlute.png', 16, 16),
    'item:lute': t(HOUSE, 15, 15),
    'item:dice': icon('Items/Object/Dice 6.png', 16, 16),
    'item:doll': t(HOUSE, 30, 15),
    'item:mirror': t(ELEM, 8, 10),
    'item:skull': t(DETAIL, 13, 0),
    'item:quill': icon('Items/Resource/feather.png', 16, 16),
    'item:ink': t(ELEM, 2, 0),
    'item:soap': icon('Items/Resource/BarSilver.png', 16, 15),
    'item:firework': icon('Items/Projectile/Dynamite.png', 16, 16),
    'item:bomb': icon('Items/Projectile/Bomb.png', 12, 13),
    'item:snowball': t(NATURE, 5, 12),
  },

  characters,

  roles: {
    player: ['NinjaGreen', 'NinjaBlue', 'NinjaRed', 'NinjaYellow'],
    person: ['Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'Woman'],
    elder: ['OldMan', 'OldMan2', 'OldMan3', 'Master'],
    villager: ['Villager', 'Villager2', 'Villager3', 'Villager4', 'Villager5', 'Woman'],
    farmer: ['CamouflageGreen', 'CamouflageRed', 'Villager3', 'Boy'],
    merchant: ['Inspector', 'Sultan', 'Sultan2', 'Villager4'],
    guard: ['Knight', 'KnightGold', 'SamuraiBlue', 'GladiatorBlue'],
    smith: ['Caveman', 'Caveman2', 'Monk2', 'FighterWhite'],
    innkeeper: ['Woman', 'OldWoman', 'Villager5', 'Villager2'],
    priest: ['Monk', 'Master', 'Shaman', 'OldMan3'],
    scholar: ['OldMan2', 'Inspector', 'SorcererOrange'],
    noble: ['Noble', 'Princess', 'Sultan', 'Sultan2', 'KnightGold'],
    child: ['Child', 'Boy', 'EggBoy', 'EggGirl'],
    fisher: ['Eskimo', 'Villager3', 'Boy', 'NinjaWater'],
    hunter: ['Hunter', 'CaveLion', 'Cavegirl', 'LionBoy'],
    miner: ['Caveman', 'Caveman2', 'NinjaBomb', 'RobotGrey'],
    bard: ['Monkey', 'EggGirl', 'Villager4', 'Tengu2'],
    beggar: ['OldMan', 'Pig', 'GreenPig', 'Cavegirl2'],
    soldier: ['Samurai', 'SamuraiRed', 'SamuraiBlue', 'Knight', 'FighterRed'],
    mage: ['SorcererBlack', 'SorcererOrange', 'NinjaMageBlack', 'NinjaMageOrange', 'Shaman'],
    herbalist: ['ShamanLion', 'Cavegirl', 'Villager6', 'OldWoman'],
    sailor: ['Villager2', 'Boy', 'NinjaBlue2', 'Eskimo'],
    traveler: ['Hunter', 'Monk2', 'Tengu', 'FighterWhite', 'Village6'],
  },

  creatures: {
    'creature:slime': SLIME_GREEN,
    'creature:slime:none': SLIME_GREEN,
    'creature:slime:fire': SLIME_FIRE,
    'creature:slime:ice': SLIME_ICE,
    'creature:slime:lightning': SLIME_LIGHTNING,
    'creature:slime:water': SLIME_WATER,
    // aliases by type leaf
    'creature:slime:green_slime': SLIME_GREEN,
    'creature:slime:fire_slime': SLIME_FIRE,
    'creature:slime:frost_slime': SLIME_ICE,
    'creature:slime:spark_slime': SLIME_LIGHTNING,
    'creature:slime:water_slime': SLIME_WATER,
    // Grey horned beast for the wolf; frost wolf = same sheet tinted icy.
    'creature:wolf': mon('Beast2', 'Beast2.png'),
    'creature:wolf:frost_wolf': mon('Beast2', 'Beast2.png', 0xb8dcff),
    'creature:wolf:ice': mon('Beast2', 'Beast2.png', 0xb8dcff),
    // Red-brown tusked "Bear" monster (4 directions). Animal/WildBoar exists but is a 2-frame
    // side-view strip (34x16) without directions.
    'creature:boar': mon('Bear'),
    'creature:bat': mon('BlueBat'),
    'creature:skeleton': charCreature('Skeleton'),
    'creature:ghost': mon('Spirit'),
    'creature:golem': charCreature('Statue'),
    'creature:golem:stone_golem': charCreature('Statue'),
    'creature:golem:earth': charCreature('Statue'),
    'creature:golem:ice_golem': charCreature('Statue', 0xb0dcff),
    'creature:golem:ice': charCreature('Statue', 0xb0dcff),
    'creature:imp': charCreature('DemonRed'),
    'creature:imp:fire_imp': charCreature('DemonRed'),
    'creature:wisp': mon('Flam2'),
    'creature:wisp:storm_wisp': mon('Flam2', 'SpriteSheet.png', 0xfff6a0),
    'creature:crab': mon('Mollusc', 'Mollusc.png'),
    // Boss sheets are single-row strips: cols = animation frames (62x52 each), no directions.
    'boss:slime': { dir: 'Actor/Boss/GiantSlime', sheet: 'Idle.png', faceset: 'Faceset.png', cols: 5, rows: 1 },
  },

  fx: {
    steam: fx('Magic/Spirit/SpriteSheet.png', 32, 32, 5, 10),
    splash: fx('Elemental/Water/SpriteSheet.png', 44, 33, 10, 16),
    fire_burst: fx('Elemental/Flam/SpriteSheet.png', 25, 30, 8, 14, { add: true }),
    sparks: fx('Elemental/Thunder/SpriteSheet.png', 20, 28, 8, 16, { add: true }),
    frost: fx('Elemental/Ice/SpriteSheet.png', 32, 32, 10, 14),
    smoke: fx('Smoke/Smoke/SpriteSheet.png', 32, 32, 6, 10),
    poof: fx('Magic/Circle/SpriteSheetWhite.png', 32, 32, 4, 14),
    heal: fx('Magic/Boost/SpriteSheet.png', 53, 35, 8, 12, { add: true }),
    hit: fx('Magic/Circle/SpriteSheetSpark.png', 32, 32, 6, 18),
    explosion: fx('Elemental/Explosion/SpriteSheet.png', 40, 40, 9, 14),
    // frames 0-3 only: the later frames of this sheet are a green slash line.
    leaves: fx('Elemental/Plant/SpriteSheetB.png', 30, 26, 4, 10),
    dust: fx('Smoke/SmokeCircular/SpriteSheet.png', 30, 14, 8, 14),
    sparkle: fx('Magic/Spark/SpriteSheet.png', 27, 35, 10, 14, { add: true }),
    gust: fx('Elemental/Plant/SpriteSheet.png', 30, 28, 8, 14),
    shatter: fx('Elemental/Ice/SpriteSheetB.png', 32, 32, 9, 16),
    slash: fx('Attack/SlashCurved/SpriteSheet.png', 32, 32, 4, 18),
    'bolt:fire': fx('Projectile/Fireball.png', 16, 16, 4, 12, { add: true }),
    'bolt:ice': fx('Projectile/IceSpike.png', 18, 10, 8, 12),
    'bolt:lightning': fx('Elemental/Thunder/SpriteSheet.png', 20, 28, 8, 16, { add: true }),
    'bolt:water': fx('Projectile/EnergyBall.png', 16, 16, 4, 10),
    'bolt:wind': fx('Magic/Spirit/SpriteSheetBlue.png', 32, 32, 5, 12),
    'bolt:earth': fx('Projectile/SpriteSheetRock.png', 16, 16, 4, 10),
    'bolt:none': fx('Projectile/ShurikenMagic.png', 16, 16, 2, 12),
    // Status overlays (loop). Particle/Fire has 12 shrinking flames; the first 5 loop as a flicker.
    'ovl:burning': fx('Particle/Fire.png', 8, 12, 5, 10, { add: true, scale: 1.5 }),
    'ovl:wet': fx('Particle/Rain.png', 8, 8, 3, 6),
    'ovl:frozen': fx('Elemental/Ice/SpriteSheetFlake.png', 32, 32, 9, 8),
    'ovl:electrified': fx('Particle/Spark.png', 10, 8, 7, 14, { add: true }),
    'ovl:oiled': fx('Magic/Aura/SpriteSheet.png', 25, 24, 5, 8),
    'ovl:lit': fx('Particle/Fire.png', 8, 12, 4, 10, { add: true }),
  },

  ui: {
    dialog: ui('Ui/Dialog/DialogBox.png', 300, 58),
    dialogFace: ui('Ui/Dialog/DialogBoxFaceset.png', 300, 58),
    dialogSimple: ui('Ui/Dialog/DialogueBoxSimple.png', 316, 60),
    facesetBox: ui('Ui/Dialog/FacesetBox.png', 48, 48),
    choice: ui('Ui/Dialog/ChoiceBox.png', 64, 20),
    // 4-frame 'speech bubble' typing indicator (20x16 each).
    info: ui('Ui/Dialog/DialogInfo.png', 20, 16, { frames: 4, step: 20, fps: 6 }),
    yes: ui('Ui/Dialog/YesButton.png', 26, 16),
    no: ui('Ui/Dialog/NoButton.png', 26, 16),
    arrow: ui('Ui/Arrow.png', 13, 13),
    // Theme Wood 16x16 nine-slice panels + inventory cell.
    panel: ui('Ui/Theme/Theme Wood/nine_path_panel.png', 16, 16),
    panel2: ui('Ui/Theme/Theme Wood/nine_path_panel_2.png', 16, 16),
    panel3: ui('Ui/Theme/Theme Wood/nine_path_panel_3.png', 16, 16),
    panelInterior: ui('Ui/Theme/Theme Wood/nine_path_panel_interior.png', 16, 16),
    panelBg: ui('Ui/Theme/Theme Wood/nine_path_bg.png', 16, 16),
    focus: ui('Ui/Theme/Theme Wood/nine_path_focus.png', 8, 8),
    cell: ui('Ui/Theme/Theme Wood/inventory_cell.png', 16, 16),
    // Heart receptacle: 5 frames of 16x16, frame 0 empty -> frame 4 full.
    heart: ui('Ui/Receptacle/Heart.png', 16, 16, { frames: 5, step: 16 }),
    iconHeart: ui('Ui/Receptacle/IconHeart.png', 14, 12),
    lifebarUnder: ui('Ui/Receptacle/LifeBarMiniUnder.png', 18, 4),
    lifebarProgress: ui('Ui/Receptacle/LifeBarMiniProgress.png', 18, 4),
    // Emote face bubbles emote1..emote30 (14x13), added below as ui['emote<N>'].
  },

  music: {
    title: MUS + '1 - Adventure Begin.ogg',
    village: MUS + '4 - Village.ogg',
    village_night: MUS + '9 - Quiet.ogg',
    field: MUS + '35 - Adventure.ogg',
    forest: MUS + '11 - Clearing.ogg',
    interior: MUS + '5 - Peaceful.ogg',
    cave: MUS + '2 - The Cave.ogg',
    battle: MUS + '17 - Fight.ogg',
    shop: MUS + '20 - Good Time.ogg',
    temple: MUS + '12 - Temple.ogg',
    dungeon: MUS + '21 - Dungeon.ogg',
    dark_forest: MUS + '37 - Dark Forest.ogg',
  },

  sfx: {
    step: SND + 'Elemental/Grass.wav',
    take: SND + 'Bonus/Bonus2.wav',
    put: SND + 'Menu/Move5.wav',
    interact: SND + 'Menu/Accept4.wav',
    talk: SND + 'Voice/Voice4.wav',
    hit: SND + 'Hit & Impact/Hit1.wav',
    hurt: SND + 'Hit & Impact/Impact.wav',
    attack: SND + 'Whoosh & Slash/Slash.wav',
    cast: SND + 'Magic & Skill/Magic1.wav',
    fire: SND + 'Elemental/Fire.wav',
    water: SND + 'Elemental/Water1.wav',
    ice: SND + 'Magic & Skill/Magic4.wav',
    thunder: SND + 'Elemental/Explosion4.wav',
    wind: SND + 'Whoosh & Slash/Whoosh2.wav',
    explosion: SND + 'Elemental/Explosion.wav',
    open: SND + 'Menu/Accept3.wav',
    close: SND + 'Menu/Cancel2.wav',
    door: SND + 'Jump & Bounce/Bounce4.wav',
    eat: SND + 'Bonus/PowerUp1.wav',
    heal: SND + 'Magic & Skill/Heal.wav',
    coin: SND + 'Bonus/Coin.wav',
    undefined: SND + 'Magic & Skill/Strange.wav',
    patched: 'Audio/Jingles/Success1.wav',
    error: SND + 'Menu/Cancel.wav',
    death: 'Audio/Jingles/GameOver2.wav',
  },
}

for (let i = 1; i <= 30; i++) CATALOG.ui['emote' + i] = ui(`Ui/Emote/emote${i}.png`, 14, 13)
// Named emotes (verified visually): '!' , '?', heart, '...' thinking.
Object.assign(CATALOG.ui, {
  emoteExclaim: CATALOG.ui.emote21,
  emoteQuestion: CATALOG.ui.emote23,
  emoteHeart: CATALOG.ui.emote27,
  emoteDots: CATALOG.ui.emote20,
})
