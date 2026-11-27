// The asset catalogue: every sprite, tile, sound and effect the renderer takes from the Ninja
// Adventure pack (CC0, by Pixel-boy & AAA). Paths are relative to the pack root; the copy
// script (games/openworld/tools/src/copyAssets.ts) mirrors every referenced file to
// games/openworld/public/assets/na/<same path>. Rects were measured with PIL (tight bounding
// boxes of opaque pixels) and checked visually in preview.html.
//
// Conventions used throughout:
// - SpriteDef anchors: (ax, ay) is the pixel inside the rect that sits on the bottom-centre of
//   the entity's tile. 16x16 tile-aligned sprites use (8, 16). Taller/wider sprites put the
//   trunk / base / feet at (ax, ay) and overhang upwards (and sideways, for 2-3 tile wide art).
// - UI SpriteDefs use (0, 0) (top-left) — they are screen-space pieces.

import { LSW_FLOOR, LSW_STAIRS, LSW_WALL, type ActorDef, type Catalog, type FxDef, type PrefabDef, type SpriteDef } from '@openworld/runtime/src/assets/types.ts'
import { SIN_ACTORS, SIN_FX } from '@openworld/runtime/src/assets/bosses.ts'
import { SLATE, type ReliefPalette } from '@openworld/runtime/src/assets/relief.ts'
import FACES from './faces.json'
import { COURTYARD_BENCH, COURTYARD_PREFABS, COURTYARD_SCALE, COURTYARD_TERRAIN_LOOKS } from './cloudtop-courtyard.ts'
import BUILDINGS_JSON from './buildings.json'
import FERRY_CAMP_JSON from './ferry-camp.json'
import FORD_CROSSING_JSON from './ford-crossing.json'
import GENERIC_PROPS_JSON from './generic-props.json'
import INTERIOR_FURNITURE_JSON from './interior-furniture.json'
import CONTAINERS_JSON from './containers.json'
import FIRSTLIGHT_CHAPEL_JSON from './firstlight-chapel.json'
import FIRST_DAWN_JSON from './first-dawn-chapel.json'
import REST_CHAPEL_JSON from './rest-chapel.json'
import SCOURGE_CHAPEL_JSON from './scourge-chapel.json'
import SCOURGE_UNDERCROFT_JSON from './scourge-undercroft.json'
import FAIRWEIGHT_CHAPEL_JSON from './fairweight-chapel.json'
import WHITEVEIL_CHURCH_JSON from './whiteveil-church.json'
import HOLY_NAVE_JSON from './holyhall-nave.json'
import SUNWELL_NAVE_JSON from './sunwell-nave.json'
import NAILGATE_CHAPEL_JSON from './nailgate-chapel.json'
import FIRSTLIGHT_GRAVES_JSON from './firstlight-graves.json'
import LIGHTS_JSON from './lights.json'
import OUTDOOR_JSON from './outdoor.json'
import LOUDNESS from './loudness.json'
import { CROP_FIXTURES, CROP_ITEMS, FLOWER_FIXTURES, FLOWER_ITEMS } from './crops.ts'
import { FORD_CAMP, SET_PIECES, WATCH_SHELTER } from '@openworld-game/content'

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
const RELIEF_DETAIL = TS + 'TilesetReliefDetail.png'
const HOLE = TS + 'TilesetHole.png'
const DESERT = TS + 'TilesetDesert.png'
const IFLOOR = TS + 'Interior/TilesetInteriorFloor.png'
const WALLS = TS + 'Interior/TilesetWallSimple.png'
// the showcase's floors and grounds (tools/src/art/floors.ts)
const FLOORS = 'lsw/Tiles/Floors.png'
// the world map's own inked tiles and marks (tools/src/art/worldmap.ts)
const WM_TILES = 'lsw/WorldMap/tiles.png'
const WM_MARKS = 'lsw/WorldMap/marks.png'
const WM_GROUNDS = 'lsw/WorldMap/grounds.png'
const WM_MARK = ['woods', 'woods2', 'mountains', 'mountains2', 'hills', 'hills2', 'village', 'town', 'ford', 'farm', 'mill', 'woods-place', 'hollow', 'barrow', 'mine', 'lair', 'pass', 'summit', 'shrine', 'camp', 'waystone', 'none', 'deadwood', 'deadwood2', 'reeds', 'mesa', 'mesa2', 'fort', 'ruin', 'graveyard', 'cathedral', 'city', 'tower', 'battlefield', 'cave', 'seat', 'bridge', 'snowpines', 'snowpines2', 'watermill',
  'woods3', 'woods4', 'canopy', 'canopy2', 'canopy3', 'canopy4', 'mountains3', 'mountains4', 'peaks', 'peaks2', 'peaks3', 'peaks4', 'hills3', 'hills4', 'deadwood3', 'reeds2', 'reeds3', 'mesa3', 'snowpines3']
/** A mark of the world map (16x20, its foot on the cell's bottom). */
const wm = (key: string): SpriteDef => px(WM_MARKS, WM_MARK.indexOf(key) * 16, 0, 16, 20)
// the project's own pixel art for what one builds

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
/**
 * A piece of the ferrykeeper's camp at Vesper Ford (tools/src/art/ferry-camp.py → ferry-camp.json): where it is on the
 * camp's sheet, and where on it the foot of the cell it stands on is (a group's piece stands off its middle, where the
 * group's picture has it).
 */
function ferryCamp(piece: string): SpriteDef {
  const p = (FERRY_CAMP_JSON as unknown as { img: string; pieces: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }).pieces[piece]
  if (!p) throw new Error(`no piece ${piece} of the ferry camp`)
  return px(FERRY_CAMP_JSON.img, p.x, p.y, p.w, p.h, p.ax, p.ay)
}
/**
 * A piece of the crossing at Vesper Ford (tools/src/art/ford-crossing.py → ford-crossing.json): the art packs' own
 * pieces at four pixels to the game's one (drawn at `FORD_CROSSING_SCALE`), where on the sheet it is and where on it the
 * foot of the cell it is drawn on is.
 */
function fordCrossing(piece: string): SpriteDef {
  const p = (FORD_CROSSING_JSON as unknown as { pieces: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }).pieces[piece]
  if (!p) throw new Error(`no piece ${piece} of the ford's crossing`)
  return px(FORD_CROSSING_JSON.img, p.x, p.y, p.w, p.h, p.ax, p.ay)
}
const FORD_CROSSING_SCALE = FORD_CROSSING_JSON.scale
/** The dead tree at the Ford felled: its cell a stump (world.ts AT.deadTree). */
const FELLED = { '28,10': 'stump' }
/**
 * The footbridge at the Ford by its gap (world.ts FOOTBRIDGE: x 31–33 of row 22): whole once all three are laid; else
 * its two torn ends, and in each cell of the gap a stump of a pile while it is water, a new plank once one is laid.
 */
const FORD_FOOTBRIDGE: NonNullable<Catalog['terrainObjectLooks']>[string] = (() => {
  const look = (terrain: string, piece?: string, when?: Record<string, string>) => ({ terrain, ...(piece && { sprite: fordCrossing(piece), scale: FORD_CROSSING_SCALE }), ...(when && { when }) })
  const whole = { '31,22': 'bridge', '32,22': 'bridge', '33,22': 'bridge' }
  return {
    // the dead tree at the narrows felled (content ford.ts ford/chop-dead-tree): its stump, its trunk across the river
    '28,10': look('stump', 'stump'),
    '29,10': look('bridge', 'trunk', FELLED),
    '26,16': look('bridge', 'pier_w'),
    '34,16': look('bridge', 'pier_e'),
    '28,22': [look('bridge', 'bridge', whole), look('bridge', 'end_w')],
    '34,22': [look('bridge', undefined, whole), look('bridge', 'end_e')],
    ...Object.fromEntries([31, 32, 33].map((x) => [`${x},22`, [look('water', `pile_${x}`), look('bridge', undefined, whole), look('bridge', `plank_${x}`)]])),
  }
})()
/**
 * One of the things the whole game has many of (tools/src/art/generic-props.py → generic-props.json): the notice board,
 * the stone cross, the benches, the art pack's own at four pixels to the game's one (drawn at `GENERIC_PROPS_SCALE`).
 */
function genericProp(piece: string): SpriteDef {
  const p = (GENERIC_PROPS_JSON as unknown as { pieces: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }).pieces[piece]
  if (!p) throw new Error(`no piece ${piece} of the generic props`)
  return px(GENERIC_PROPS_JSON.img, p.x, p.y, p.w, p.h, p.ax, p.ay)
}
const GENERIC_PROPS_SCALE = GENERIC_PROPS_JSON.scale
/**
 * The containers and goods (tools/src/art/containers.py → containers.json): the art pack's own at four pixels to the
 * game's one (drawn at `CONTAINERS_SCALE`).
 */
function container(piece: string): SpriteDef {
  const p = (CONTAINERS_JSON as unknown as { pieces: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }).pieces[piece]
  if (!p) throw new Error(`no piece ${piece} of the containers`)
  return px(CONTAINERS_JSON.img, p.x, p.y, p.w, p.h, p.ax, p.ay)
}
const CONTAINERS_SCALE = CONTAINERS_JSON.scale
/** A piece of one of the art packs cut by tools/src/art/*.py (`{img, scale, pieces}`), drawn at its `scale`. */
function packPiece(pack: { img: string }, piece: string): SpriteDef {
  const p = (pack as unknown as { pieces: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }).pieces[piece]
  if (!p) throw new Error(`no piece ${piece} in ${pack.img}`)
  return px(pack.img, p.x, p.y, p.w, p.h, p.ax, p.ay)
}
const furniture = (piece: string) => packPiece(INTERIOR_FURNITURE_JSON, piece)
const light = (piece: string) => packPiece(LIGHTS_JSON, piece)
/** Firstlight's chapel's own things (tools/src/art/firstlight-chapel.py), at the pack's scale. */
const chapel = (piece: string) => ({ sprite: packPiece(FIRSTLIGHT_CHAPEL_JSON, piece), scale: FIRSTLIGHT_CHAPEL_JSON.scale })
/** A grave of Firstlight's churchyard in one of its two designs (tools/src/art/firstlight-graves.py), at the pack's scale. */
const grave = (design: string) => ({ sprite: packPiece(FIRSTLIGHT_GRAVES_JSON, design), scale: FIRSTLIGHT_GRAVES_JSON.scale })
/** A thing of the outdoors in its two makes (tools/src/art/outdoor.py), each thing one of them, at the pack's scale. */
const outdoor = (key: string) => ({ base: packPiece(OUTDOOR_JSON, `${key}_1`), variants: [1, 2].map((i) => packPiece(OUTDOOR_JSON, `${key}_${i}`)), scale: OUTDOOR_JSON.scale })
/**
 * The furniture of the rooms in two makes, plain and rich, and the tavern's tables and seats (tools/src/art/
 * interior-furniture.py → interior-furniture.json): the art pack's own at four pixels to the game's one; which a room
 * has is its map's theme, by the rules the script writes beside them (by what the room is, else the place it is a room
 * of, else picked by the map). A table and its seats are sets, one to a room; a seat faces the table beside it (its
 * picture turned west, `left`). The pot's beside them (containers.py), and the lights' (lights.py), lit and cold.
 */
const INTERIOR_THEMES: NonNullable<Catalog['fixtureThemes']> = (() => {
  const j = INTERIOR_FURNITURE_JSON as unknown as { scale: number; rules: { match: string; theme: string }[]; pieces: Record<string, unknown> }
  const scale = j.scale
  const looks: NonNullable<Catalog['fixtureThemes']>['looks'] = {}
  for (const k of ['bed', 'long_table', 'counter', 'shelf', 'bookshelf', 'workbench', 'fireplace', 'plant'])
    looks[`fixture:${k}`] = Object.fromEntries(['plain', 'rich'].map((t) => [t, { sprite: furniture(`${k}_${t}`), ...(j.pieces[`${k}_${t}_lit`] ? { lit: furniture(`${k}_${t}_lit`) } : {}), scale }]))
  // a table and its seats, a set to a room (`_2` a theme's second); a seat with a picture turned west faces the table
  const seat = (n: string) => ({ sprite: furniture(n), ...(j.pieces[`${n}_left`] ? { left: furniture(`${n}_left`) } : {}), scale })
  const sets = (t: string) => [t, `${t}_2`]
  looks['fixture:table'] = Object.fromEntries(['plain', 'rich', 'tavern'].map((t) => [t, sets(`table_${t}`).map((n) => ({ sprite: furniture(n), scale }))]))
  looks['fixture:chair'] = Object.fromEntries(['plain', 'rich', 'tavern'].map((t) => [t, sets(`chair_${t}`).map((n) => seat(j.pieces[n] ? n : `chair_${t}`))]))
  // the pot, plain or painted (tools/src/art/containers.py)
  looks['fixture:pot'] = { plain: { sprite: container('pot_plain'), scale: CONTAINERS_SCALE }, rich: { sprite: container('pot_rich'), scale: CONTAINERS_SCALE } }
  // the lights, cold and lit (tools/src/art/lights.py): the candlestick of a rich room one of its two candelabra
  for (const k of ['brazier', 'lamppost', 'lantern'])
    looks[`fixture:${k}`] = Object.fromEntries(['plain', 'rich'].map((t) => [t, { sprite: light(`${k}_${t}`), lit: light(`${k}_${t}_lit`), scale: LIGHTS_JSON.scale }]))
  const candles = (n: string) => ({ sprite: light(n), lit: light(`${n}_lit`), scale: LIGHTS_JSON.scale })
  looks['fixture:candles'] = { plain: candles('candles_plain'), rich: [candles('candles_rich'), candles('candelabrum')] }
  // Firstlight's chapel, as the user drew it (tools/src/art/firstlight-chapel.py): its pews, its candles either side of
  // the altar, cold and lit, the sister's desk and stool, the brother's night table with its lantern; its beds, its
  // bookstand and its plants the plain room's
  looks['fixture:pew'] = { chapel: chapel('pew') }
  looks['fixture:candles'].chapel = { ...chapel('candles_cold'), lit: chapel('candles').sprite }
  looks['fixture:table'].chapel = chapel('desk')
  looks['fixture:chair'].chapel = chapel('stool')
  looks['fixture:drawers'] = { chapel: chapel('nightstand') }
  // the poorest rooms of the world, by what the story says of them (Fairweight's poorhouse, its hovels and the miller's
  // house, the Holy City's poor quarter): the patched cot or the worn one (tools/src/art/nailgate-chapel.py), a room's
  // beds all of one; the rest of them the plain room's
  const cot = (piece: string) => ({ sprite: packPiece(NAILGATE_CHAPEL_JSON, piece), scale: NAILGATE_CHAPEL_JSON.scale })
  looks['fixture:bed'].poor = [cot('poor_cot_patched'), cot('poor_cot_worn')]
  // the tavern's rest is the plain room's, and so is the chapel's and the poor room's
  for (const byTheme of Object.values(looks)) if (byTheme.plain) (byTheme.tavern ??= byTheme.plain), (byTheme.chapel ??= byTheme.plain), (byTheme.poor ??= byTheme.plain)
  // the Scourging House's Chapel of the Pillar, as the user drew it (tools/src/art/scourge-chapel.py): its gilt
  // candlesticks, lit, its pews with the Order's cloth, the vestry chest a cupboard, Firstlight's bookshelf, the
  // register open on the copyist's desk
  const scourge = (piece: string) => ({ sprite: packPiece(SCOURGE_CHAPEL_JSON, piece), scale: SCOURGE_CHAPEL_JSON.scale })
  looks['fixture:candelabrum'] = { scourge: { ...scourge('candle'), lit: scourge('candle').sprite } }
  looks['fixture:pew'].scourge = scourge('pew')
  looks['fixture:chest'] = { scourge: scourge('cupboard') }
  looks['fixture:bookshelf'].scourge = scourge('bookshelf')
  looks['fixture:desk'] = { scourge: scourge('desk') }
  // the Scourging House's undercroft, as the user drew it (tools/src/art/scourge-undercroft.py): the bare stone altar, the
  // grey brother's bones in his cloak, the tombstone of the scourge, the amphora, the Rest's candelabra, lit; the
  // channels' cells drawn by the floor's picture
  const undercroft = (piece: string) => ({ sprite: packPiece(SCOURGE_UNDERCROFT_JSON, piece), scale: SCOURGE_UNDERCROFT_JSON.scale })
  looks['fixture:altar'] = { undercroft: undercroft('altar') }
  looks['fixture:bones'] = { undercroft: undercroft('bones') }
  looks['fixture:tomb'] = { undercroft: undercroft('tomb') }
  looks['fixture:pot'].undercroft = undercroft('amphora')
  looks['fixture:candles'].undercroft = { ...undercroft('candelabrum'), lit: undercroft('candelabrum').sprite }
  looks['fixture:red_channel'] = { undercroft: undercroft('nothing') }
  // Fairweight's Chapel of the Measure, as the user drew it (tools/src/art/fairweight-chapel.py): Firstlight's pews, the
  // Rest's candelabra, lit; in the almoner's room the shelf, the sacks and the table with the basket of bread
  const fairweight = (piece: string) => ({ sprite: packPiece(FAIRWEIGHT_CHAPEL_JSON, piece), scale: FAIRWEIGHT_CHAPEL_JSON.scale })
  looks['fixture:pew'].fairweight = chapel('pew')
  looks['fixture:candles'].fairweight = { ...fairweight('candelabrum'), lit: fairweight('candelabrum').sprite }
  looks['fixture:shelf'].fairweight = fairweight('shelf')
  looks['fixture:sack'] = { fairweight: fairweight('sacks') }
  looks['fixture:long_table'].fairweight = fairweight('table')
  // the Church of Whiteveil (tools/src/art/whiteveil-church.py): the Chapel of the Pillar's pews, as the user asked; the
  // rest of its things drawn where they stand (placedSprites)
  looks['fixture:pew'].whiteveil = scourge('pew')
  // Sunwell Abbey's nave: the Most Holy Hall's things where they fit (tools/src/art/holyhall-nave.py) — its candelabra,
  // saints, crosses, fonts; its rail, stalls and chapels' altars drawn by their ids (placedSprites)
  const holy = (piece: string) => ({ sprite: packPiece(HOLY_NAVE_JSON, piece), scale: HOLY_NAVE_JSON.scale })
  looks['fixture:candelabrum'].sunwell = { ...holy('candelabrum_tall'), lit: holy('candelabrum_tall').sprite }
  for (const [key, piece] of [['saint', 'statue_c'], ['standing_cross', 'cross_c'], ['font', 'font']] as const) (looks[`fixture:${key}`] ??= {}).sunwell = holy(piece)
  // and its own (tools/src/art/sunwell-nave.py, the user's sheets of 2026-11-26): the organ, the high altar with its
  // tabernacle and the pews (the Most Holy Hall's, larger), the lectern, the pulpit, the lilies in their urns; the
  // reliquary by nothing (the altar's tabernacle its picture)
  for (const [key, piece] of [['organ', 'organ'], ['high_altar', 'high_altar'], ['pew', 'pew'], ['lectern', 'lectern'], ['pulpit', 'pulpit'], ['plant', 'lilies'], ['reliquary', 'nothing']] as const)
    (looks[`fixture:${key}`] ??= {}).sunwell = { sprite: packPiece(SUNWELL_NAVE_JSON, piece), scale: SUNWELL_NAVE_JSON.scale }
  return {
    rules: [{ match: '^meadow\\.church$', theme: 'chapel' }, { match: '^scourgehouse\\.hall$', theme: 'scourge' }, { match: '^scourgehouse\\.undercroft$', theme: 'undercroft' }, { match: '^fairweight\\.chapel$', theme: 'fairweight' }, { match: '^whiteveil\\.church$', theme: 'whiteveil' }, { match: '^holy\\.sunwell-abbey\\.nave$', theme: 'sunwell' }, { match: '^fairweight\\.(poorhouse|miller|home-\\d+)$', theme: 'poor' }, { match: '^holy\\.quarter-5\\.home-\\d+$', theme: 'poor' }, ...j.rules],
    looks,
  }
})()
/** UI piece: whole image, anchored top-left. */
function ui(img: string, w: number, h: number, extra: Partial<SpriteDef> = {}): SpriteDef {
  return { img, x: 0, y: 0, w, h, ax: 0, ay: 0, ...extra }
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
// Alberic's human form, the steward of the Held Ground (tools/src/art/alberic-human.swift: the pack's Master, recoloured)
for (const id of ['whale', 'gpt', 'claude']) characters[`skin.${id}`] = { dir: `lsw/Characters/Skins/${id}`, sheet: 'SpriteSheet.png', cols: 4, rows: 4, anchorY: 62, scale: 0.55 }
characters['skin.muse'] = characters['skin.whale']
characters.AlbericHuman = { dir: 'lsw/Characters/Alberic', sheet: 'SpriteSheet.png', faceset: 'Faceset.png', cols: 4, rows: 7 }

/** 4-direction monster sheet (64x64: cols = down/up/left/right, rows = 4 walk frames). */
function mon(folder: string, sheet = 'SpriteSheet.png', tint?: number): ActorDef {
  return { dir: 'Actor/Monster/' + folder, sheet, faceset: 'Faceset.png', cols: 4, rows: 4, ...(tint !== undefined ? { tint } : {}) }
}
/** One of the project's own creature sheets (tools/src/art/creatures.ts, recolours.ts): the pack's monster layout, 4 directions x 4 steps. */
function own(name: string, tone?: number, face = false): ActorDef {
  return { dir: 'lsw/Creature/' + name, sheet: 'SpriteSheet.png', ...(face && { faceset: 'Faceset.png' }), cols: 4, rows: 4, ...(tone !== undefined && { tone }) }
}
/** One of the project's recoloured character sheets used as a creature (tools/src/art/recolours.ts): the character layout, with its face. */
function ownChar(name: string, tone: number): ActorDef {
  return { dir: 'lsw/Creature/' + name, sheet: 'SpriteSheet.png', faceset: 'Faceset.png', cols: 4, rows: 7, tone }
}
/** A character-layout sheet used as a creature (cols = directions, rows 0-3 walk, 4-6 extras). */
function charCreature(name: string, tint?: number): ActorDef {
  return { ...charDef(name), ...(tint !== undefined ? { tint } : {}) }
}

// Slimes: the pack's green (Slime4) and blue (Slime3); fire, frost and spark are the pack's paler sheets recoloured,
// each with its own mark (tools/src/art/recolours.ts).
const SLIME_GREEN = mon('Slime4', 'Slime4.png')
const FROST_WOLF = own('FrostWolf', 0x8fc4ec, true)
const SLIME_FIRE = own('FireSlime', 0xf07a2c, true)
const SLIME_ICE = own('FrostSlime', 0xbfe6f8, true)
const SLIME_LIGHTNING = own('SparkSlime', 0xf2d230, true)
const SPORECAP = own('Sporecap', 0xd8f070)
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

/**
 * The project's own buildings (tools/src/art/arch, docs/showcase.md §3), drawn in the oblique view and cut into strips:
 * each building's footprint, its doors, and a strip for each row of it — its picture as tall as what is seen of the
 * row, standing on the row's cells and drawn at the row's depth, so whoever stands beside the building is drawn before
 * what is north of them and behind what is south. A map lays a building with `MapBuilder.building`.
 */
const generatedBuildings: Record<string, { img: string; w: number; d: number; doors: [number, number][]; ground?: boolean; terrain?: string; pixelsPerTile?: number; shadow?: { x: number; y: number; tw: number; th: number; dx: number; dy: number }; cover?: string[]; slices: { row: number; col: number; tw: number; th: number; x: number; y: number; grid: string[] }[] }> = (BUILDINGS_JSON as unknown as { buildings: never }).buildings

const CLOUDTOP_ART_TILE = 64

/** The imported signs overhang their single solid tile on both sides. */
function cloudtopBuilding(key: string, image: string, slices?: (typeof generatedBuildings)[string]['slices']): (typeof generatedBuildings)[string] {
  const base = generatedBuildings[key]
  return {
    ...base,
    img: `lsw/Buildings/${image}.png`,
    pixelsPerTile: CLOUDTOP_ART_TILE,
    slices: slices ?? base.slices,
    ...(base.shadow && { shadow: { ...base.shadow, x: 3 * CLOUDTOP_ART_TILE } }),
  }
}

function cloudtopWaymark(key: string, image: string): (typeof generatedBuildings)[string] {
  return cloudtopBuilding(key, image, [{ row: 0, col: -1, tw: 3, th: 3, x: 0, y: 0, grid: ['   ', '   ', ' # '] }])
}

const signalTower = generatedBuildings.snow_ruin_tower

export const BUILDINGS: typeof generatedBuildings = {
  ...generatedBuildings,
  ct_shelter_waymark: cloudtopWaymark('ct_shelter_waymark', 'cloudtop-sign-se'),
  ct_waymark_1: cloudtopWaymark('ct_waymark_1', 'cloudtop-sign-sw'),
  ct_waymark_0: cloudtopWaymark('ct_waymark_0', 'cloudtop-sign-gate'),
  snow_ruin_arch: cloudtopBuilding('snow_ruin_arch', 'cloudtop-arch'),
  // Firstlight's chapel's walls with what hangs on them, at 64 pixels a tile (tools/src/art/firstlight-chapel.py): the
  // strips as the walls were drawn, each with its pictures
  flchurch_shell: { ...generatedBuildings.flchurch_shell, ...FIRSTLIGHT_CHAPEL_JSON.walls },
  // the Chapel of the First Dawn's broken walls with their ivy and banner, at 64 pixels a tile (tools/src/art/first-dawn-chapel.py)
  dhchapel_shell: { ...generatedBuildings.dhchapel_shell, ...FIRST_DAWN_JSON.walls },
  // the Rest's chapel of the Five's walls with their windows, banners and the five wounds (tools/src/art/rest-chapel.py)
  wschapel_shell: { ...generatedBuildings.wschapel_shell, ...REST_CHAPEL_JSON.walls },
  // the Scourging House's Chapel of the Pillar's walls with their windows, banners and the retable of the Post
  // (tools/src/art/scourge-chapel.py)
  scchapel_shell: { ...generatedBuildings.scchapel_shell, ...SCOURGE_CHAPEL_JSON.walls },
  // the Scourging House's undercroft's walls with their niches, torches and the Order's banner
  // (tools/src/art/scourge-undercroft.py)
  scundercroft_shell: { ...generatedBuildings.scundercroft_shell, ...SCOURGE_UNDERCROFT_JSON.walls },
  // Fairweight's Chapel of the Measure's walls with their windows, banners, niches and the bread's tablet
  // (tools/src/art/fairweight-chapel.py)
  fwchapel_shell: { ...generatedBuildings.fwchapel_shell, ...FAIRWEIGHT_CHAPEL_JSON.walls },
  // Nailgate's Chapel of the Nail's walls with their banners, lamps and shelves (tools/src/art/nailgate-chapel.py)
  ngchapel_shell: { ...generatedBuildings.ngchapel_shell, ...NAILGATE_CHAPEL_JSON.walls },
  // the Church of Whiteveil's walls with their windows, drapes and banners of the lance (tools/src/art/whiteveil-church.py)
  wvchurch_shell: { ...generatedBuildings.wvchurch_shell, ...WHITEVEIL_CHURCH_JSON.walls },
  // the Most Holy Hall's nave's walls with the apse's great window, its lancets and arcade (tools/src/art/holyhall-nave.py)
  holynave_shell: { ...generatedBuildings.holynave_shell, ...HOLY_NAVE_JSON.walls },
  // Sunwell Abbey's nave's walls with the great window, the lancets and the roses (tools/src/art/sunwell-nave.py)
  nave_shell: { ...generatedBuildings.nave_shell, ...SUNWELL_NAVE_JSON.walls },
  // and its crossing's piers between the choir and the arms, in the same dressed stone
  nave_pier: { ...generatedBuildings.nave_pier, ...SUNWELL_NAVE_JSON.wallPier },
  snow_ruin_tower: {
    ...signalTower,
    img: 'lsw/Buildings/cloudtop-signal-tower.png',
    pixelsPerTile: CLOUDTOP_ART_TILE,
    ...(signalTower.shadow && { shadow: { ...signalTower.shadow, x: 5 * CLOUDTOP_ART_TILE } }),
    // Keep the rear rows solid while the whole tower draws at the front row's depth.
    slices: [
      { row: 0, col: 0, tw: 3, th: 1, x: 0, y: 640, grid: ['###'] },
      { row: 1, col: 0, tw: 3, th: 1, x: 0, y: 640, grid: ['###'] },
      { row: 2, col: -1, tw: 5, th: 10, x: 0, y: 0, grid: [...Array<string>(9).fill('     '), ' ### '] },
    ],
  },
}

/** The showcase's furniture pictures (the props' sheet), as the fixtures' sprites: `fixture:<name>`; a tomb's two looks. */
function propFixtures(): Catalog['fixtures'] {
  const props = (BUILDINGS_JSON as unknown as { props: Record<string, { img: string; x: number; y: number; w: number; h: number; ax: number; ay: number }> }).props ?? {}
  const sp = (k: string) => props[k] && px(props[k].img, props[k].x, props[k].y, props[k].w, props[k].h, props[k].ax, props[k].ay)
  const out: Catalog['fixtures'] = {}
  for (const k of Object.keys(props)) if (k !== 'tomb_gilt') out[`fixture:${k}`] = { base: sp(k)! }
  if (props.tomb && props.tomb_gilt) out['fixture:tomb'].variants = [sp('tomb')!, sp('tomb_gilt')!]
  return out
}

function buildingPrefabs(): Record<string, PrefabDef> {
  const out: Record<string, PrefabDef> = {}
  for (const [name, b] of Object.entries(BUILDINGS))
    for (const s of b.slices) {
      const p: PrefabDef = { img: b.img, x: s.x, y: s.y, tw: s.tw, th: s.th, grid: s.grid, base: s.th - 1, part: { of: name, dx: s.col, dy: s.row - (s.th - 1) } }
      // a row one walks under (an arcade, a gateway): its strip in front of whoever is there
      if (s.grid[s.th - 1].includes('.')) p.front = true
      // a building laid as ground (a bridge's deck, a quay's steps): under whoever stands on it
      if (b.ground) p.ground = true
      if (b.pixelsPerTile) p.pixelsPerTile = b.pixelsPerTile
      if (b.terrain) p.terrain = b.terrain
      out[`${name}@${s.row}`] = p
    }
  // its shadow, laid as ground (under all that stands), no cell of it changed
  for (const [name, b] of Object.entries(BUILDINGS))
    if (b.shadow) out[`${name}@shadow`] = { img: b.img, x: b.shadow.x, y: b.shadow.y, tw: b.shadow.tw, th: b.shadow.th, grid: Array(b.shadow.th).fill(' '.repeat(b.shadow.tw)), ground: true, ...(b.pixelsPerTile && { pixelsPerTile: b.pixelsPerTile }) }
  return out
}

/**
 * The joining pieces of the house sheet's three fences (the low rail, the pointed palisade, the stone wall), each laid
 * out alike from column 8 of its two rows: the corners, the ends, the straight runs, the T-joints and the cross. A
 * fence cell is stamped as `<kind>_<piece>`, the piece chosen by which of its four sides another cell of the same
 * fence touches (the map builder's `joinFences`): N, E, S, W.
 */
export const FENCE_PIECES: Record<string, [number, number]> = {
  es: [0, 0], ws: [1, 0], e: [2, 0], v: [3, 0], nes: [4, 0], wes: [5, 0], s: [6, 0],
  ne: [0, 1], nw: [1, 1], w: [2, 1], h: [3, 1], new: [4, 1], nsw: [5, 1], x: [6, 1],
}
/** Each fence's rows in the house sheet and the terrain its cells are (what blocks). */
export const FENCES: Record<string, { row: number; terrain?: string }> = { fence: { row: 4, terrain: 'woodwall' }, rail: { row: 6, terrain: 'woodwall' }, stonewall: { row: 8 } }

function fencePieces(): Record<string, PrefabDef> {
  const out: Record<string, PrefabDef> = {}
  for (const [kind, f] of Object.entries(FENCES)) for (const [piece, [c, r]] of Object.entries(FENCE_PIECES)) out[`${kind}_${piece}`] = pf(HOUSE, 8 + c, f.row + r, ['#'], f.terrain)
  return out
}

/** The grounds drawn on the yellow-green grass (and what stands on it): where a block on grass shows its edge. */
const ON_GRASS = ['grass', 'flowers', 'drygrass', 'tree', 'pine', 'bush', 'thornhedge', 'rock', 'stump', 'spring']

const SND = 'Audio/Sounds/'
const MUS = 'Audio/Musics/'
/** A piece of the pack's music by its name. */
const M = (name: string) => `${MUS}${name}.ogg`

/** The Holy City's built ground (docs/showcase.md §3.5): its terraces, quays and walls in the pale warm limestone of its
 * buildings (tools/src/art/arch/materials.ts `s`), not the hills' slate. */
const LIMESTONE: ReliefPalette = { ...SLATE, outline: 0x3a3027, deep: 0x5b4e42, dark: 0x83725d, mid: 0xae9c7e, light: 0xd3c3a2, lit: 0xebdfc4 }
/** The Scarred March's red sandstone, banded, its canyons' walls (docs/showcase.md §4b). */
const SANDSTONE: ReliefPalette = { ...SLATE, outline: 0x2c1410, deep: 0x5a2a1e, dark: 0x82402c, mid: 0xb0603f, light: 0xd48a5f, lit: 0xf0b88a, grass: 0x9a8a48, grassShade: 0x6a5a30 }
/** The White Altar Heights' chalk cliffs: bleached, a cold blue in their shade. */
const CHALK: ReliefPalette = { ...SLATE, outline: 0x3b4352, deep: 0x7a8496, dark: 0xa3acbb, mid: 0xc9d0da, light: 0xe6eaef, lit: 0xfbfcfd }
/** The Vale of Scales' dry earth banks, straw-pale. */
const LOESS: ReliefPalette = { ...SLATE, outline: 0x3a2f1c, deep: 0x6b5a3a, dark: 0x8f7a52, mid: 0xb39d6e, light: 0xcfbd8c, lit: 0xe7dbb0, grass: 0xb0a45a, grassShade: 0x7c7238 }
/** The Pale Fens' peat banks: dark, wet, green-grey. */
const PEAT: ReliefPalette = { ...SLATE, outline: 0x131714, deep: 0x262d28, dark: 0x37403a, mid: 0x4b564d, light: 0x637062, lit: 0x7f8c7c, grass: 0x5f7350, grassShade: 0x3b4a34 }

export const CATALOG: Catalog = {
  furniturePoses: {
    'foot.hut~5': { pose: 'sit', x: -5, y: -8, facing: 'right' },
    [COURTYARD_BENCH.id]: { pose: 'sit', x: -4, y: -9 },
    'fixture:bed': { pose: 'lie', x: 0, y: -21, reveal: 0.48, scale: 0.8, facing: 'down' },
    // a pew faces the altar: one sits on it facing north, drawn behind its back, only the head and shoulders over it
    'fixture:pew': { pose: 'sit', x: 0, y: -10, facing: 'up', behind: true },
    [WATCH_SHELTER.chair.id]: { pose: 'sit', x: -8, y: -8 },
  },
  placedSprites: {
    'foot.hut~4': { map: 'foot.hut', x: 6, y: 11, sprite: px('lsw/Fixtures/HunterInterior.png', 0, 0, 32, 48, 16, 37) },
    'foot.hut~5': { map: 'foot.hut', x: 5, y: 11, sprite: px('lsw/Fixtures/HunterInterior.png', 32, 0, 32, 48, 20, 37) },
    'foot~il': { map: 'foot', x: 9, y: 18, sprite: px('lsw/Fixtures/HunterYard.png', 160, 32, 32, 32, 9, 26) },
    'foot~2': { map: 'foot', x: 9, y: 15, sprite: px('lsw/Fixtures/HunterYard.png', 160, 0, 48, 32, 16, 31) },
    'foot~3': { map: 'foot', x: 8, y: 18, sprite: px('lsw/Fixtures/HunterYard.png', 80, 0, 48, 48, 24, 45) },
    'foot~4': { map: 'foot', x: 4, y: 18, sprite: px('lsw/Fixtures/HunterYard.png', 32, 0, 48, 48, 12, 46) },
    'foot~7': { map: 'foot', x: 18, y: 22, sprite: px('lsw/Fixtures/FootWayside.png', 64, 32, 32, 32, 15, 30) },
    'foot~1': { map: 'foot', x: 20, y: 12, sprite: px('lsw/Fixtures/FootShrine.png', 0, 0, 32, 64, 16, 60) },
    'ch1.drawing.stone': { map: 'foot', x: 22, y: 13, sprite: px('lsw/Fixtures/FootShrine.png', 32, 32, 32, 32, 16, 28) },
    [COURTYARD_BENCH.id]: { map: 'summit', ...COURTYARD_BENCH, scale: COURTYARD_SCALE },
    [WATCH_SHELTER.cloak.hook]: {
      map: WATCH_SHELTER.map, x: WATCH_SHELTER.cloak.x, y: WATCH_SHELTER.cloak.y,
      sprite: px('lsw/Fixtures/WatchShelter.png', 64, 0, 32, 24, 16, 44),
      filled: px('lsw/Fixtures/WatchShelter.png', 0, 0, 32, 24, 16, 44),
    },
    // the watchman's chair and the table his log lies open on, the shelter's own (the barrel the containers' pack's)
    [WATCH_SHELTER.chair.id]: { map: WATCH_SHELTER.map, x: WATCH_SHELTER.chair.x, y: WATCH_SHELTER.chair.y, sprite: px('lsw/Fixtures/WatchShelter.png', 96, 0, 32, 24, 24, 23) },
    [WATCH_SHELTER.log.id]: { map: WATCH_SHELTER.map, x: WATCH_SHELTER.log.x, y: WATCH_SHELTER.log.y, sprite: px('lsw/Fixtures/WatchShelter.png', 32, 0, 32, 24, 19, 23) },
    // the ferrykeeper's camp at the Ford, each thing drawn with its piece of the camp pack (content ford.ts FORD_CAMP,
    // named as its piece is; the lantern by the pond with the lantern post's); the fire is drawn cold, and the game's
    // flame burns over it while it is lit; the old axe is drawn in the block while it lies there
    ...((): Catalog['placedSprites'] => {
      const { map, ...things } = FORD_CAMP
      return Object.fromEntries(Object.entries(things).map(([name, t]) => [t.id, { map, x: t.x, y: t.y, sprite: ferryCamp(name === 'pondLantern' ? 'lantern' : name), ...(name === 'axe' && { scale: 1 }) }]))
    })(),
    // the crossing's (tools/src/art/ford-crossing.py): the winch, its line strung to the far post once it is spliced
    // (snapped, the pack's winch with its frayed ends), the far post, the boat
    'ford.winch': { map: 'ford', x: 25, y: 15, sprite: fordCrossing('line'), statuses: { broken: fordCrossing('winch') }, scale: FORD_CROSSING_SCALE },
    'ford.winch.far': { map: 'ford', x: 36, y: 15, sprite: fordCrossing('post'), scale: FORD_CROSSING_SCALE },
    'ford.raft': { map: 'ford', x: 28, y: 16, sprite: fordCrossing('boat'), scale: FORD_CROSSING_SCALE },
    'ford.dead_tree': { map: 'ford', x: 28, y: 10, sprite: fordCrossing('dead_tree'), scale: FORD_CROSSING_SCALE },
    // Nailgate's Chapel of the Nail (tools/src/art/nailgate-chapel.py): every thing of it drawn where it stands, by its id
    ...((): Catalog['placedSprites'] => {
      const piece = (name: string) => packPiece(NAILGATE_CHAPEL_JSON, name)
      const at = (id: string, x: number, y: number, name: string, lit = false) => [id, { map: 'nailgate.chapel', x, y, sprite: piece(name), ...(lit && { statuses: { lit: piece(name) } }), scale: NAILGATE_CHAPEL_JSON.scale }] as const
      return Object.fromEntries([
        at('nailgate.altar', 8, 8, 'altar'),
        at('nailgate.candles.w', 7, 8, 'candelabrum', true),
        at('nailgate.candles.e', 11, 8, 'candelabrum', true),
        at('nailgate.chronicle', 4, 9, 'chronicle'),
        at('nailgate.tables', 13, 10, 'tables'),
        at('nailgate.forge', 3, 10, 'forge', true),
        at('nailgate.anvil', 5, 11, 'anvil'),
        at('nailgate.nails', 14, 8, 'nails'),
        at('nailgate.lampchest', 14, 12, 'lampchest'),
        at('nailgate.cot.sexton', 2, 14, 'cot_patched'),
        at('nailgate.cot.traveller', 15, 14, 'cot_worn'),
      ])
    })(),
    // the Church of Whiteveil (tools/src/art/whiteveil-church.py): every thing of it drawn where it stands, by its id
    ...((): Catalog['placedSprites'] => {
      const piece = (name: string) => packPiece(WHITEVEIL_CHURCH_JSON, name)
      const at = (id: string, x: number, y: number, name: string, lit = false) => [id, { map: 'whiteveil.church', x, y, sprite: piece(name), ...(lit && { statuses: { lit: piece(name) } }), scale: WHITEVEIL_CHURCH_JSON.scale }] as const
      return Object.fromEntries([
        at('whiteveil.altar', 14, 11, 'altar'),
        at('whiteveil.candles.w', 11, 11, 'candelabrum_w', true),
        at('whiteveil.candles.e', 18, 11, 'candelabrum_e', true),
        at('whiteveil.statue.w', 9, 14, 'statue'),
        at('whiteveil.statue.e', 20, 14, 'statue'),
        at('whiteveil.lilies.1', 8, 14, 'lilies_w'),
        at('whiteveil.lilies.2', 10, 14, 'lilies_e'),
        at('whiteveil.lilies.3', 19, 14, 'lilies_w'),
        at('whiteveil.lilies.4', 21, 14, 'lilies_e'),
        at('whiteveil.lilies.5', 4, 17, 'lilies_back'),
        at('whiteveil.lilies.6', 25, 18, 'lilies_w'),
        at('whiteveil.lilies.7', 27, 18, 'lilies_e'),
        at('whiteveil.chest', 4, 18, 'chest'),
        at('whiteveil.candles.chapel', 2, 18, 'candles', true),
      ])
    })(),
    // the Most Holy Hall's nave (tools/src/art/holyhall-nave.py; finale.ts): its things drawn where they stand, by their ids
    ...((): Catalog['placedSprites'] => {
      const piece = (name: string) => packPiece(HOLY_NAVE_JSON, name)
      const at = (id: string, x: number, y: number, name: string, lit = false) => [id, { map: 'holyhall.nave', x, y, sprite: piece(name), ...(lit && { statuses: { lit: piece(name) } }), scale: HOLY_NAVE_JSON.scale }] as const
      return Object.fromEntries([
        at('holyhall.nave.altar', 17, 19, 'altar'),
        at('holyhall.nave.candelabrum.w', 13, 19, 'candelabrum_w', true),
        at('holyhall.nave.candelabrum.e', 21, 19, 'candelabrum_e', true),
        at('holyhall.nave.cross.w', 13, 18, 'cross_w'),
        at('holyhall.nave.cross.e', 21, 18, 'cross_e'),
        at('holyhall.nave.statue.w', 11, 19, 'statue_w'),
        at('holyhall.nave.statue.e', 23, 19, 'statue_e'),
        at('holyhall.nave.candles.w', 14, 12, 'candles_w', true),
        at('holyhall.nave.candles.e', 20, 12, 'candles_e', true),
        // the rail's two runs, each one picture on its third cell from the gap; its other cells drawn by nothing
        ...[0, 1, 2, 3, 4, 5].flatMap((i) => [
          at(`holyhall.nave.rail.w.${i}`, 15 - i, 21, i === 3 ? 'rail_w' : 'nothing'),
          at(`holyhall.nave.rail.e.${i}`, 19 + i, 21, i === 3 ? 'rail_e' : 'nothing'),
        ]),
        at('holyhall.nave.stalls.w1', 11, 25, 'stalls_w'),
        at('holyhall.nave.stalls.w2', 11, 28, 'stalls_w'),
        at('holyhall.nave.stalls.e1', 22, 25, 'stalls_chair'),
        at('holyhall.nave.stalls.e2', 22, 28, 'stalls_e'),
        ...[35, 41, 48, 53].flatMap((y, i) => [at(`holyhall.nave.candelabrum.aisle.w${i}`, 7, y, 'candelabrum_aisle_w', true), at(`holyhall.nave.candelabrum.aisle.e${i}`, 27, y, 'candelabrum_aisle_e', true)]),
        // the pews, a row of them either side of the runner
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [at(`holyhall.nave.pew.w${i}`, 13, 39 + 2 * i, 'pew'), at(`holyhall.nave.pew.e${i}`, 21, 39 + 2 * i, 'pew')]),
        at('holyhall.nave.font.w', 13, 58, 'font'),
        at('holyhall.nave.font.e', 21, 58, 'font'),
        // the west arm, the vestry: its table; the Curia's pieces in its box, stand, wardrobe, rack and chest (sets/fin.ts)
        at('holyhall.nave.table', 5, 27, 'table'),
        at('holyhall.nave.vestry.box', 3, 28, 'box'),
        at('holyhall.nave.vestry.stand', 2, 27, 'stand'),
        at('holyhall.nave.vestry.wardrobe', 3, 25, 'wardrobe'),
        at('holyhall.nave.vestry.rack', 6, 25, 'rack'),
        at('holyhall.nave.vestry.chest', 6, 28, 'chest'),
        // the east arm: the side altar, its lilies, its kneeler
        at('holyhall.nave.altar.side', 30, 25, 'side_altar'),
        at('holyhall.nave.lilies.w', 27, 25, 'lilies_w'),
        at('holyhall.nave.lilies.e', 32, 25, 'lilies_e'),
        at('holyhall.nave.kneeler.side', 30, 27, 'kneeler'),
        // the chapels' altars in their niches and their kneelers; the Second's reliquaries in the lower two
        ...([['w1', 5, 35, 'swords'], ['w2', 5, 45, 'monstrance'], ['e1', 29, 35, 'lily'], ['e2', 29, 45, 'virgin']] as const).flatMap(([id, x, y, k]) => [
          at(`holyhall.nave.chapel.${id}`, x, y, `chapel_${k}`),
          at(`holyhall.nave.kneeler.${id}`, x, y + 1, `kneel_${k}`),
        ]),
        at('holyhall.nave.reliquary.w', 4, 47, 'reliquary'),
        at('holyhall.nave.reliquary.e', 30, 47, 'reliquary'),
      ])
    })(),
    // Sunwell Abbey's nave (catalog.ts its theme `sunwell`): its rail's runs, its tombs, the candelabra down the nave, the
    // larger ones (tools/src/art/sunwell-nave.py); its stalls and its chapels' altars and kneelers (the Most Holy Hall's,
    // the saint in her niche, as the user asked)
    ...((): Catalog['placedSprites'] => {
      const N = 'holy.sunwell-abbey.nave'
      const piece = (name: string) => packPiece(HOLY_NAVE_JSON, name)
      const at = (id: string, x: number, y: number, name: string) => [`${N}.${id}`, { map: N, x, y, sprite: piece(name), scale: HOLY_NAVE_JSON.scale }] as const
      const own = (id: string, x: number, y: number, name: string) => [`${N}.${id}`, { map: N, x, y, sprite: packPiece(SUNWELL_NAVE_JSON, name), scale: SUNWELL_NAVE_JSON.scale }] as const
      return Object.fromEntries([
        ...[9, 10, 11, 12, 13, 14].map((x) => own(`rail.${x}`, x, 23, x === 11 ? 'rail_w' : 'nothing')),
        ...[20, 21, 22, 23, 24, 25].map((x) => own(`rail.${x}`, x, 23, x === 23 ? 'rail_e' : 'nothing')),
        at('stalls.w', 11, 22, 'stalls_w'),
        at('stalls.e', 22, 22, 'stalls_chair'),
        ...([['w1', 5, 39], ['w2', 5, 48], ['e1', 29, 39], ['e2', 29, 48]] as const).flatMap(([id, x, y]) => [at(`chapel.${id}`, x, y, 'chapel_virgin'), at(`kneeler.${id}`, x, y + 1, 'kneel_virgin')]),
        ...([['w', 5], ['e', 29]] as const).flatMap(([side, cx]) => [1, 2, 3].map((i) => own(`tomb.${side}${i}`, cx + (i - 2) * 2, 30, 'tomb'))),
        ...([['w', 8], ['e', 26]] as const).flatMap(([side, x]) => [37, 46, 55].map((y, i) => own(`candelabrum.aisle.${side}${i}`, x, y, 'candelabrum'))),
      ])
    })(),
    // Fairweight's Chapel of the Measure (tools/src/art/fairweight-chapel.py): the altar of the Measure
    'fairweight.altar': { map: 'fairweight.chapel', x: 7, y: 9, sprite: packPiece(FAIRWEIGHT_CHAPEL_JSON, 'altar'), scale: FAIRWEIGHT_CHAPEL_JSON.scale },
    // the Scourging House's Chapel of the Pillar (tools/src/art/scourge-chapel.py): the altar of the Post
    'scourgehouse.altar': { map: 'scourgehouse.hall', x: 14, y: 12, sprite: packPiece(SCOURGE_CHAPEL_JSON, 'altar'), scale: SCOURGE_CHAPEL_JSON.scale },
    // the Rest's chapel of the Five (tools/src/art/rest-chapel.py): the altar of the five wounds, the candelabra lit
    ...((): Catalog['placedSprites'] => {
      const rest = (piece: string) => packPiece(REST_CHAPEL_JSON, piece)
      const lit = { sprite: rest('candelabrum'), statuses: { lit: rest('candelabrum') }, scale: REST_CHAPEL_JSON.scale }
      return {
        'waystation.altar': { map: 'waystation.chapel', x: 7, y: 9, sprite: rest('altar'), scale: REST_CHAPEL_JSON.scale },
        'waystation.chapel~1': { map: 'waystation.chapel', x: 4, y: 9, ...lit },
        'waystation.chapel~2': { map: 'waystation.chapel', x: 10, y: 9, ...lit },
        // the east pew facing the west one across the aisle
        'waystation.pew.e': { map: 'waystation.chapel', x: 9, y: 15, sprite: rest('pew_long_e'), scale: REST_CHAPEL_JSON.scale },
        // the priest's night table, Firstlight's sister's
        'waystation.nightstand': { map: 'waystation.chapel', x: 17, y: 10, sprite: packPiece(FIRSTLIGHT_CHAPEL_JSON, 'nightstand'), scale: FIRSTLIGHT_CHAPEL_JSON.scale },
      }
    })(),
    // the Chapel of the First Dawn's things (tools/src/art/first-dawn-chapel.py): its first hearth cold, its old pews
    // broken as the roof left them, the fallen stone
    ...((): Catalog['placedSprites'] => {
      const at = (id: string, x: number, y: number, piece: string) => [id, { map: 'chapel', x, y, sprite: packPiece(FIRST_DAWN_JSON, piece), scale: FIRST_DAWN_JSON.scale }] as const
      return Object.fromEntries([
        at('chapel~1', 8, 8, 'hearth'), at('chapel~2', 6, 8, 'candle_a'), at('chapel~3', 10, 8, 'candle_b'),
        at('chapel~4', 5, 12, 'pew_broken'), at('chapel~5', 5, 15, 'pew_overgrown'), at('chapel~6', 11, 12, 'pew_broken'),
        at('chapel~7', 12, 15, 'r_block'),
      ])
    })(),
    // the first three maps keep their own pictures where the generic props would change them: the Ford's signpost east
    'ford~p': { map: 'ford', x: 40, y: 14, sprite: t(ELEM, 0, 2) },
    // Firstlight's churchyard as the user drew its graves (tools/src/demo/village.ts): the first row's gravestones a
    // headstone with a cross over a bed of earth, the second's a pointed one between pinnacles over grass
    ...Object.fromEntries(([['meadow~g', 4, 26, 'cross'], ['meadow~h', 6, 26, 'cross'], ['meadow~i', 8, 26, 'cross'], ['meadow~j', 4, 28, 'gothic'], ['meadow~k', 6, 28, 'gothic'], ['village.gravestone', 8, 28, 'gothic']] as const).map(([id, x, y, design]) => [id, { map: 'meadow', x, y, ...grave(design) }])),
  },
  composites: {
    'composite:garden_pavilion': (() => {
      const b = BUILDINGS.manor_gazebo
      const top = Math.min(...b.slices.map(s => s.row - s.th + 1))
      return { width: b.w * 16, height: (b.d - top) * 16, parts: b.slices.map(s => ({ sprite: px(b.img, s.x, s.y, s.tw * 16, s.th * 16), x: s.col * 16, y: (s.row - s.th + 1 - top) * 16 })) }
    })(),
  },
  // -------------------------------------------------------------------------------------------
  // Blobs. Every block below was checked two ways: (1) rendering a random island through
  // BLOB47 and looking at it, (2) per-tile neighbour classification. All listed blocks match.
  // "outside" = what the non-terrain part of edge tiles shows; the renderer should draw that
  // terrain (or anything, for transparent/self-bordered blocks) under / next to the blob.
  // -------------------------------------------------------------------------------------------
  blobs: {
    // Dirt road on the yellow-green grass. Outside: grass (TilesetFloor row 12).
    path: { img: FLOOR, col: 0, row: 7 },
    // A way trodden through snow (ground.ts inSnow): the snow block's own path, white with a grey rim. Outside: the
    // lavender of the snow's drifts, so the snow runs on round it without a seam.
    path_snow: { img: FLOOR, col: 0, row: 14 },
    // Water with a brown bank + white foam, on the same yellow-green grass. Outside: grass.
    water: { img: WATER, col: 0, row: 6 },
    // Same block as water (the pack has no darker water on grass). Outside: grass.
    deepwater: { img: WATER, col: 0, row: 6 },
    // Darker furrowed soil. Outside: the DARK green grass of TilesetFloor (11,12) — on the
    // yellow-green grass this shows as a thin darker-green hedge ring around the field.
    farmland: { img: FLOOR, col: 11, row: 7 },
    // Sand and mud as the dirt road is drawn on grass (the project's own: tools/src/art/flanks.ts recolours the road's
    // block): soft edges against the grass round a beach or a mud flat, none beside water, a road or other ground —
    // there it runs on as itself. (Both were plain tiles, a hard square on the grass, until 2026-10-21.)
    sand: { img: 'lsw/Tiles/Sand.png', col: 0, row: 0, edgeOn: ON_GRASS },
    mud: { img: 'lsw/Tiles/Mud.png', col: 0, row: 0, edgeOn: ON_GRASS },
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
    // The showcase's grounds (docs/showcase.md §3.5): pale limestone panels (a parvis, a nave), and the dark flags of a
    // fortress's wards and the walk on its walls. Self-bordered.
    paving: { img: IFLOOR, col: 0, row: 0 },
    flagstone: { img: IFLOOR, col: 11, row: 12 },
    rampart: { img: IFLOOR, col: 11, row: 12 },
    // the showcase's own (tools/src/art/floors.ts): each block draws its own rim
    carpet_royal: { img: FLOORS, col: 0, row: 0 },
    runner: { img: FLOORS, col: 11, row: 0 },
    plaza: { img: FLOORS, col: 22, row: 0 },
    flowerbed: { img: FLOORS, col: 33, row: 0 },
    // White snow drifts. Outside: TRANSPARENT — whatever the renderer draws under the tile
    // (grass, dirt…) shows around the drift edges.
    snow: { img: FLOORB, col: 0, row: 0 },
    // the Vale's salt crust (docs/chapter-3.md §11): drawn as the snow's drifts, a white the region's straw grade warms
    salt: { img: FLOORB, col: 0, row: 0 },
    // Wooden deck / jetty (front edge with posts on the south side). Outside: TRANSPARENT — draw
    // the water (or ground) under it. Plain plank tiles are also listed in `plain.bridge`.
    bridge: { img: WATER, col: 0, row: 12 },
    // the world map: the sea with its beach and inked coast, the river between open banks (the ground beside it shows)
    ow_sea: { img: WM_TILES, col: 0, row: 0 },
    ow_river: { img: WM_TILES, col: 0, row: 5, over: 'ow_plain' },
    // a bridge is the river's cell gone over: drawn as the river (it joins its banks), the planks a mark on it
    ow_bridge: { img: WM_TILES, col: 0, row: 5, over: 'ow_plain' },
    // the roads, joined where they meet (the continent's turn every way)
    ow_road: { img: WM_TILES, col: 0, row: 10, over: 'ow_plain' },
    // every other ground laid over the plains, each giving way along a drawn rim to the ground below it: the lowest
    // first (docs/continent.md §2; tools/src/art/worldmap.ts LAID, its blocks in this order)
    ...Object.fromEntries(
      ['ow_steppe', 'ow_dust', 'ow_salt', 'ow_fields', 'ow_hills', 'ow_marsh', 'ow_highland', 'ow_snow', 'ow_badlands', 'ow_deadwood', 'ow_forest', 'ow_mountain', 'ow_city'].map((id, i) => [
        id,
        { img: WM_GROUNDS, col: 0, row: i * 5, over: 'ow_plain', layer: i + 1, fills: id === 'ow_fields' ? 3 : 2 },
      ]),
    ),
  },

  // -------------------------------------------------------------------------------------------
  // Plain ground tiles (variants picked per position). Opaque 16x16 unless noted.
  // -------------------------------------------------------------------------------------------
  plain: {
    // the showcase's floors (tools/src/art/floors.ts): variants picked by position
    lattice: [0, 1, 2, 3].map((c) => [FLOORS, c, 5] as [string, number, number]),
    marble: [4, 5, 6, 7].map((c) => [FLOORS, c, 5] as [string, number, number]),
    flags: [8, 9, 10, 11, 12, 13].map((c) => [FLOORS, c, 5] as [string, number, number]),
    parquet: [14, 15].map((c) => [FLOORS, c, 5] as [string, number, number]),
    // the world map's plains: grass, now and then a tuft, a flower, a stone (the other grounds are laid over them: blobs)
    ow_plain: [0, 1, 2, 3, 4, 5].map((c) => [WM_TILES, c, 15] as [string, number, number]),
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
    salt: [[FLOOR, 1, 15], [FLOOR, 1, 15], [FLOOR, 1, 15], [FLOOR, 0, 18]],
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
    // a wooden wall burnt black (the pack has none: the wall, darkened by its tint in ground.ts)
    burnt_wall: [[HOUSE, 11, 5], [HOUSE, 12, 5]],
    // the walls of tents, huts and igloos, drawn alone (a building draws its own picture over them): a palisade's
    // and a stone wall's pieces
    canvaswall: [[HOUSE, 11, 5], [HOUSE, 12, 5]],
    thatchwall: [[HOUSE, 11, 5], [HOUSE, 12, 5]],
    snowwall: [[HOUSE, 11, 9], [HOUSE, 12, 9]],
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
  // Terrain objects (one per tile; overhang upwards). All from TilesetNature unless noted.
  // -------------------------------------------------------------------------------------------
  // what grows or stands loose sits a few pixels off the grid: tall grass, flowers, bushes, and the world map's woods,
  // mountains, hills, reeds, mesas and snowy pines, so none of them stands in rows
  looseObjects: ['drygrass', 'flowers', 'bush', 'ow_forest', 'ow_mountain', 'ow_hills', 'ow_deadwood', 'ow_marsh', 'ow_badlands', 'ow_snow'],
  snowSurfaceMaps: ['summit'],
  terrainObjectLooks: {
    summit: COURTYARD_TERRAIN_LOOKS,
    // the Ford's piers and its footbridge, drawn from the crossing's art packs as the gap stands
    ford: FORD_FOOTBRIDGE,
    // Presentation only: original flower terrain and harvesting stay at each cell.
    foot: Object.fromEntries(Array.from({ length: 14 * 10 }, (_, i) => {
      const x = 14 + i % 14, y = 9 + Math.floor(i / 14)
      return [`${x},${y}`, { terrain: 'flowers', sprite: px('lsw/Fixtures/FootShrine.png', 80 + ((x + y * 2) % 3) * 16, 0, 16, 16, 8, 15) }]
    })),
  },
  // the river under the dead tree's trunk once it is felled across it (the trunk is drawn over: terrainObjectLooks.ford)
  groundLooks: {
    ford: Object.fromEntries([29, 30, 31, 32, 33, 34].map((x) => [`${x},10`, { terrain: 'bridge', as: 'water', when: FELLED }])),
  },
  // a room's furniture by its map's theme (tools/src/art/interior-furniture.py)
  fixtureThemes: INTERIOR_THEMES,
  terrainObjectGaps: {
    summit: { terrain: 'drygrass', cells: [[5, 9], [8, 10], [6, 12]] },
  },
  terrainObjects: {
    tree: [
      px(NATURE, 0, 0, 32, 32, 16, 31), // round green, 2x2
      px(NATURE, 256, 0, 32, 32, 16, 32), // round green
      px(NATURE, 288, 0, 32, 32, 16, 32), // round green, yellow base
      px(NATURE, 96, 0, 32, 32, 15, 32), // bushy tree with roots
      px(NATURE, 96, 128, 32, 32, 15, 32), // small round tree on a trunk
      px(NATURE, 48, 288, 48, 48, 24, 48), // big 3x3 green
    ],
    // one season at a time: autumn, blossom and snow are their own terrains, never mixed in a wood
    tree_autumn: [px(NATURE, 144, 288, 48, 48, 24, 48)],
    tree_blossom: [px(NATURE, 224, 0, 32, 32, 16, 31), px(NATURE, 0, 288, 48, 48, 24, 48)],
    pine: [px(NATURE, 32, 0, 32, 32, 16, 31)],
    pine_snow: [px(NATURE, 128, 0, 32, 32, 16, 32), px(NATURE, 160, 0, 32, 32, 16, 32)],
    // the knight's thorn hedge across the East Road: his briars, close set (tools/src/art/chapter1.ts)
    thornhedge: [px('lsw/Fixtures/Briar.png', 0, 0, 16, 16, 8, 15)],
    bush: [t(NATURE, 1, 10), t(NATURE, 2, 10), t(NATURE, 6, 10), t(NATURE, 10, 10), t(NATURE, 10, 8), t(NATURE, 8, 11), t(NATURE, 4, 11), t(NATURE, 5, 11)],
    rock: [
      t(NATURE, 15, 9), t(NATURE, 18, 9), t(NATURE, 7, 12), t(NATURE, 8, 12),
      px(NATURE, 208, 128, 32, 32, 16, 31), // big brown rock
      px(NATURE, 256, 128, 32, 32, 16, 31), // big grey rock
    ],
    // a rock in the snow (ground.ts objectLook): the slate boulders under their caps of snow, and the small ones
    rock_snow: [
      px(NATURE, 32, 192, 32, 32, 16, 31), // big boulder capped with snow
      px(NATURE, 0, 192, 32, 32, 16, 31), // big slate boulder
      t(NATURE, 4, 12), // small rock, snow on its shoulder
      t(NATURE, 9, 12), // two small crags under snow
      t(NATURE, 6, 12), // two slate stones
      t(NATURE, 7, 12), // a slate stone
      t(NATURE, 4, 12),
      t(NATURE, 9, 12),
    ],
    stump: [t(NATURE, 4, 8), t(NATURE, 14, 18), t(NATURE, 12, 13), px(NATURE, 0, 128, 32, 32, 16, 29), px(NATURE, 32, 128, 32, 32, 16, 29)],
    // the world map: woods, mountains and hills as inked marks, one to a cell; a wood's heart and a range's high peaks
    // (`_inner`, where all four sides are the same) drawn out to the cell's sides, so they stand as one mass
    ow_forest: ['woods', 'woods2', 'woods3', 'woods4'].map(wm),
    ow_forest_inner: ['canopy', 'canopy2', 'canopy3', 'canopy4'].map(wm),
    ow_mountain: ['mountains', 'mountains2', 'mountains3', 'mountains4'].map(wm),
    ow_mountain_inner: ['peaks', 'peaks2', 'peaks3', 'peaks4'].map(wm),
    ow_hills: ['hills', 'hills2', 'hills3', 'hills4', 'none'].map(wm),
    ow_deadwood: ['deadwood', 'deadwood2', 'deadwood3'].map(wm),
    ow_marsh: ['reeds', 'reeds2', 'reeds3', 'none'].map(wm),
    ow_badlands: ['mesa', 'mesa2', 'mesa3', 'none'].map(wm),
    ow_bridge: [wm('bridge')],
    // a snowfield's pines under snow, here and there
    ow_snow: ['snowpines', 'snowpines2', 'snowpines3', 'none', 'none'].map(wm),
    // Bare dead trees (the pack has no burnt trees; these read as charred).
    charred_tree: [px(NATURE, 64, 0, 32, 32, 16, 31), t(NATURE, 4, 9)],
    // Tall grass tufts. The pack's tufts are green: tint them golden (e.g. 0xe0c060) for dry
    // grass. The renderer leaves some tiles bare, so a meadow never reads as planted rows.
    drygrass: [t(NATURE, 3, 10), t(NATURE, 4, 10), t(NATURE, 5, 10), t(NATURE, 7, 10), t(NATURE, 9, 10), t(DETAIL, 3, 2)],
    flowers: [t(NATURE, 0, 11), t(NATURE, 1, 11), t(NATURE, 3, 11), t(NATURE, 6, 11), t(NATURE, 2, 11), t(DETAIL, 5, 2), t(DETAIL, 2, 0)],
    // Grey dead-grass tufts for burnt ground.
    ash: [t(NATURE, 8, 13), t(NATURE, 9, 13)],
  },

  // -------------------------------------------------------------------------------------------
  // Prefabs. Grids: '#' solid, '.' drawn & walkable, 'D' door (the tile you walk into), ' ' empty.
  // -------------------------------------------------------------------------------------------
  prefabs: {
    // What a building's walls are made of is its solid cells' terrain (docs/building.md §10): plaster and stone are
    // 'wall' (the default), timber 'woodwall', a tent's canvas, a hut's thatch, an igloo's snow their own.
    // Four 4x3 cottages (roof rows 0-1, wall row 2, door = the dark arch at column 1).
    house_orange: pf(HOUSE, 0, 0, ['####', '####', '#D##']),
    house_plaster: pf(HOUSE, 4, 0, ['####', '####', '#D##']),
    house_thatch: pf(HOUSE, 8, 0, ['####', '####', '#D##']),
    house_red: pf(HOUSE, 12, 0, ['####', '####', '#D##']),
    // Wooden house seen corner-on, door centre.
    house_wood: pf(HOUSE, 26, 0, ['###', '###', '#D#'], 'woodwall'),
    // Front-gabled wooden cabin (3x3), door centre.
    cabin: pf(HOUSE, 19, 19, ['###', '###', '#D#'], 'woodwall'),
    // Shop with a hanging sign on the roof; door centre.
    shop: pf(HOUSE, 16, 0, ['###', '###', '#D#'], 'woodwall'),
    // General store: tall right wing (sign, round window) + low left wing with the door.
    store: pf(HOUSE, 29, 0, ['  ##', '####', '####', '#D##'], 'woodwall'),
    // Tea house with lanterns (4x3): lattice door at col 1 is closed; the open doorway is col 2.
    teahouse: pf(HOUSE, 19, 0, ['####', '####', '##D#'], 'woodwall'),
    // Inn: big two-storey A-frame (4x5), door at col 1 of the bottom row.
    inn: pf(HOUSE, 25, 14, ['####', '####', '####', '####', '#D##'], 'woodwall'),
    // Thatched longhouse: thatch roof piece (rows 7-11) stacked on the ground-floor piece (12-13).
    longhouse: pf(HOUSE, 25, 7, [' ## ', '####', '####', '####', '####', '####', '#D##'], 'woodwall'),
    // Smithy: orange canvas forge hut, door centre.
    smithy: pf(HOUSE, 0, 7, ['###', '###', '#D#'], 'canvaswall'),
    // Straw hut (3 wide x 2 tall), door centre.
    hut_straw: pf(HOUSE, 3, 8, ['###', '#D#'], 'thatchwall'),
    // Stone temple with sun emblem, door centre.
    temple: pf(HOUSE, 23, 0, ['###', '###', '#D#']),
    // Shrine: seated statue holding a glowing orb (2x2, not enterable).
    shrine: pf(HOUSE, 3, 15, ['##', '##']),
    shrine_stone: pf(HOUSE, 3, 19, ['##', '##']),
    statue_bear: pf(HOUSE, 1, 15, ['..', '##', '##']),
    statue_frog: pf(HOUSE, 3, 17, ['##', '##']),
    // Pottery kiln / furnace building (3x4, the opening is a fire mouth, not a door).
    kiln: pf(HOUSE, 29, 4, ['###', '###', '###', '###']),
    igloo: pf(HOUSE, 0, 11, ['###', '###', '#D#'], 'snowwall'),
    // Narrower igloo drawn off-centre in its 3 tiles (x 7..41 of 48); door in the middle column.
    igloo_small: pf(HOUSE, 3, 11, ['###', '###', '#D#'], 'snowwall'),
    igloo_brick: pf(HOUSE, 6, 11, ['###', '###', '#D#'], 'snowwall'),
    // Camp tents (tileset_camp): plain, patched, torn. Door = the dark opening, centre.
    tent: pf(CAMP, 4, 0, ['###', '###', '#D#'], 'canvaswall'),
    tent_patched: pf(CAMP, 7, 0, ['###', '###', '#D#'], 'canvaswall'),
    tent_torn: pf(CAMP, 10, 0, ['###', '###', '#D#'], 'canvaswall'),
    // A wooden watchtower on legs, its ladder in front (3x5), and a round log tower (3x6): a fort's towers.
    watchtower: pf(HOUSE, 16, 6, ['###', '###', '###', '###', '###'], 'woodwall'),
    tower_round: pf(HOUSE, 19, 3, ['###', '###', '###', '###', '###', '###'], 'woodwall'),
    // A stone pillar (1x2): its cap overhead, its base in the way — a gate's posts, an old wall's columns. (The sheet's
    // pillar is two tiles tall: a third row under it was a cell in the way with nothing drawn on it.)
    pillar: pf(HOUSE, 0, 19, ['.', '#']),
    // A knight of grey stone (2x2), his shield before him and his sword over his shoulder: the Order of the Thorn's effigies.
    statue_knight: pf(HOUSE, 5, 21, ['##', '##']),
    // Banners on a pole (1x2), a colour each: a region's colours over its forts and squares (backdrop.ts BANNER).
    banner_cream: pf(HOUSE, 22, 20, ['.', '#']),
    banner_red: pf(HOUSE, 23, 20, ['.', '#']),
    banner_grey: pf(HOUSE, 24, 20, ['.', '#']),
    banner_green: pf(HOUSE, 25, 20, ['.', '#']),
    banner_purple: pf(HOUSE, 27, 20, ['.', '#']),
    banner_yellow: pf(HOUSE, 28, 20, ['.', '#']),
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
    // every joining piece of the three fences (FENCE_PIECES): rail_es, fence_nsw, stonewall_x …
    ...fencePieces(),
    // the project's own buildings (tools/src/art/arch): a strip a footprint row, `<building>@<row>` (BUILDINGS)
    ...buildingPrefabs(),
    ...COURTYARD_PREFABS,
    // Firstlight's chapel's runner, deep red with its gold lines, laid as ground from the altar to the door
    // (tools/src/art/firstlight-chapel.py; village.ts lays it)
    // the Chapel of the First Dawn's floor, laid as ground over its whole map (tools/src/art/first-dawn-chapel.py; vigil.ts lays it)
    // its bell's beam and rope in the tower (the same; vigil.ts hangs it where the old rope was)
    dawnchapel_bell: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: th - 1, grid: Array<string>(th).fill(' '.repeat(tw)) }))(FIRST_DAWN_JSON.bell),
    // the Rest's chapel of the Five (tools/src/art/rest-chapel.py; pilgrimage.ts lays them): its runner and the priest's
    // rug as ground, the wood in his cell's corner standing on the cell it fills
    // the Scourging House's Chapel of the Pillar (tools/src/art/scourge-chapel.py; chapter2.ts lays them): the rugs under
    // the desk and the cupboard, the stair down in its stone frame, the steps up to the raised apse
    ...Object.fromEntries((['rug', 'rug_small', 'stair', 'steps'] as const).map((k) => [`scchapel_${k}`, (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(SCOURGE_CHAPEL_JSON[k])])),
    // the Scourging House's undercroft (tools/src/art/scourge-undercroft.py; chapter2.ts lays them): its floor with the red
    // channels, the drains, the blood and the bowl; the font of blood standing on its cell
    scundercroft_floor: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(SCOURGE_UNDERCROFT_JSON.floor),
    scundercroft_font: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: 1, grid: ['  ', '  ', ' #'] }))(SCOURGE_UNDERCROFT_JSON.font),
    // Nailgate's Chapel of the Nail (tools/src/art/nailgate-chapel.py; chapter4.ts lays them): its dais and runner, and the
    // doorposts bristling with nails, each standing on its cell
    ngchapel_floor: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(NAILGATE_CHAPEL_JSON.floor),
    ...Object.fromEntries(([['w', '# '], ['e', ' #']] as const).map(([k, last]) => [`ngchapel_post_${k}`, (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: 1, grid: ['  ', '  ', last] }))(NAILGATE_CHAPEL_JSON.posts[k])])),
    // Fairweight's Chapel of the Measure (tools/src/art/fairweight-chapel.py; chapter3.ts lays it): the altar's platform
    // the Church of Whiteveil (tools/src/art/whiteveil-church.py; chapter5.ts lays them): the green stone and the slab before
    // the altar; the arch over the stair down, standing on the stair's row, its piers solid either side of the way down
    wvchurch_floor: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(WHITEVEIL_CHURCH_JSON.floor),
    // the Most Holy Hall's nave (tools/src/art/holyhall-nave.py; finale.ts lays it): its floors, steps, runner and the slab, over the whole map
    holynave_floor: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(HOLY_NAVE_JSON.floor),
    // its piers, each solid on the middle of its picture's bottom row
    holynave_pier: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: th - 1, grid: [...Array<string>(th - 1).fill('   '), ' # '] }))(HOLY_NAVE_JSON.pier),
    // Sunwell Abbey's nave (tools/src/art/sunwell-nave.py; abbey.ts lays them): its floor over the whole map, the labyrinth
    // squared by its spandrels, the choir's steps, the slab under the high altar, the stair down, as ground; its piers,
    // each solid on the middle of its bottom row
    ...Object.fromEntries((['floor', 'labyrinth', 'steps', 'slab', 'stair'] as const).map((k) => [`sunnave_${k}`, (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(SUNWELL_NAVE_JSON.ground[k])])),
    sunnave_pier: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: th - 1, grid: [...Array<string>(th - 1).fill('   '), ' # '] }))(SUNWELL_NAVE_JSON.pier),
    wvchurch_stair: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: 3, grid: ['   ', '   ', '   ', '# #'] }))(WHITEVEIL_CHURCH_JSON.stair),
    fwchapel_steps: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(FAIRWEIGHT_CHAPEL_JSON.steps),
    wschapel_runner: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(REST_CHAPEL_JSON.runner),
    wschapel_rug: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(REST_CHAPEL_JSON.rug),
    wschapel_firewood: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, base: 1, grid: ['  ', '# '] }))(REST_CHAPEL_JSON.firewood),
    dawnchapel_floor: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(FIRST_DAWN_JSON.floor),
    flchapel_runner: (({ img, tw, th, pixelsPerTile }) => ({ img, x: 0, y: 0, tw, th, pixelsPerTile, grid: Array<string>(th).fill(' '.repeat(tw)), ground: true }))(FIRSTLIGHT_CHAPEL_JSON.runner),
    // Decorative original flower variants, with no collision or new interaction.
    foot_court_flower_0: pf(NATURE, 0, 11, [' ']),
    foot_court_flower_1: pf(NATURE, 1, 11, [' ']),
    foot_court_flower_2: pf(NATURE, 3, 11, [' ']),
    foot_court_flower_3: pf(DETAIL, 5, 2, [' ']),
    foot_court_flower_4: pf(NATURE, 4, 10, [' ']),
    foot_hunter_woodshed: { img: 'lsw/Fixtures/HunterYard.png', x: 0, y: 0, tw: 2, th: 3, grid: ['  ', '  ', '##'], base: 2 },
    foot_hunter_ribs: { img: 'lsw/Fixtures/HunterYard.png', x: 0, y: 64, tw: 2, th: 1, grid: ['  '], ground: true },
    foot_hunter_hide: { img: 'lsw/Fixtures/HunterYard.png', x: 32, y: 48, tw: 3, th: 1, grid: ['   '], ground: true },
    foot_hunter_chips: { img: 'lsw/Fixtures/HunterYard.png', x: 80, y: 48, tw: 3, th: 1, grid: ['   '], ground: true },
    foot_hunter_glove_stone: { img: 'lsw/Fixtures/HunterYard.png', x: 0, y: 48, tw: 2, th: 1, grid: ['  '], ground: true },
    foot_hunter_broken_rail: { img: 'lsw/Fixtures/HunterYard.png', x: 32, y: 64, tw: 2, th: 1, grid: ['  '], ground: true },
    // the wayside cross, the stone cross of the generic props at 64 pixels a tile (tools/src/art/generic-props.py)
    foot_waycross: { img: 'lsw/Fixtures/FootWaycross.png', x: 0, y: 0, tw: 2, th: 4, grid: ['  ', '  ', '  ', '# '], base: 3, pixelsPerTile: 64 },
    foot_shrine_courtyard: { img: 'lsw/Fixtures/FootCourtyard.png', x: 0, y: 0, tw: 14, th: 10, grid: Array(10).fill('              '), ground: true },
    foot_shrine_banner: { img: 'lsw/Fixtures/FootShrine.png', x: 64, y: 32, tw: 1, th: 2, grid: [' ', ' '], base: 1 },
    // Bridges run north-south (planks across, rails on the east/west sides). 4 wide x 3 long.
    bridge_ns: pf(HOUSE, 9, 15, ['....', '....', '....'], 'bridge'),
    bridge_stone_ns: pf(HOUSE, 9, 19, ['....', '....', '....'], 'bridge'),
    // Wooden dock platform (3x3 corner of the TilesetWater deck block; transparent outside).
    dock: pf(WATER, 0, 12, ['...', '...', '...'], 'bridge'),
    // Cliffs (TilesetRelief): plateau with a cliff face on its bottom row, and a sheer rock face.
    cliff: pf(RELIEF, 1, 0, ['###', '###', '###'], 'cave_wall'),
    cliff_sand: pf(RELIEF, 1, 5, ['###', '###', '###'], 'cave_wall'),
    // a mossy cliff face, three tiles tall, in columns: its left end, the middle (repeats), its right end
    cliff_l: pf(RELIEF, 4, 0, ['#', '#', '#']),
    cliff_m: pf(RELIEF, 5, 0, ['#', '#', '#']),
    cliff_r: pf(RELIEF, 6, 0, ['#', '#', '#']),
    cliff_wall: pf(RELIEF, 4, 0, ['###', '###', '###'], 'cave_wall'),
    cliff_wall_sand: pf(RELIEF, 4, 5, ['###', '###', '###'], 'cave_wall'),
    // a mine's mouth at a cliff's foot (3x3): the mossy rock, its timbered lintel, the dark way in at the bottom of the
    // middle column, open beside it to the west (where a track runs on into the rock at a map's edge)
    adit: pf(RELIEF_DETAIL, 0, 7, ['###', '###', '..#'], 'cave_wall'),
    // the project's own (tools/src/art/mill.ts): a mill's wheel stood in its race against the mill's wall (3x3, its
    // cells the race's water, laid as ground: the race runs on under it), and the millstones under their hopper on the
    // mill's floor (2x2)
    waterwheel: { ...pf('lsw/Fixtures/WaterWheel.png', 0, 0, ['###', '###', '###'], 'water'), ground: true },
    millstones: pf('lsw/Fixtures/Millstones.png', 0, 0, ['##', '##'], 'woodwall'),
    // the falls at the head of Vesper Ford (tools/src/art/ford-falls.ts): the river over the north cliff, eight cells
    // wide and the cliff's three tall, laid over the river's top rows (its cells stay the river's water)
    ford_falls: pf('lsw/Fixtures/FordFalls.png', 0, 0, ['########', '########', '########'], 'water'),
    // a grey stone standing out of a river's current, the water white round it (the same module; one cell, the river's water under it)
    river_rock: pf('lsw/Fixtures/RiverRock.png', 0, 0, ['#'], 'water'),
    // a lily pad on still water (TilesetWater: a pond's open water with the pad on it), laid on a pond's inner cells
    lily_pad: pf(WATER, 11, 3, ['#'], 'water'),
    // a bell's rope come down a tower's wall, its grip in reach of the floor (tools/src/art/bell-rope.ts; 1x2, walkable)
    bell_rope: pf('lsw/Fixtures/BellRope.png', 0, 0, ['.', '.']),
    // Desert lion-head wall fountain (2x3) and a square water basin (2x2).
    fountain_lion: pf(DESERT, 0, 6, ['##', '##', '##']),
    pool: pf(DESERT, 8, 7, ['##', '##'], 'water'),
    // Firstlight's warm spring: the desert sheet's pale pool (3x3), its cells the spring one wades into
    spring: { ...pf(DESERT, 17, 7, ['###', '###', '###'], 'spring'), ground: true },
    cloudtop_bridge: { img: 'lsw/Buildings/cloudtop-bridge.png', x: 0, y: 0, tw: 3, th: 4, grid: ['   ', '   ', '   ', '   '], ground: true, pixelsPerTile: CLOUDTOP_ART_TILE },
    ct_shelter_floor_edge: { ...pf(IFLOOR, 12, 7, [' ']), ground: true },
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

  // the rock of the relief (runtime assets/relief.ts): the Frostfang Coast's slate wherever ground rises
  // the Holy City's: its terraces, quays and the North Gate's walls are built of its limestone
  relief: { '*': SLATE, holy: LIMESTONE, redmarch: SANDSTONE, altar: CHALK, tithe: LOESS, palefen: PEAT },

  // -------------------------------------------------------------------------------------------
  // Fixtures. base = normal state; open / lit only where the pack draws that state.
  // -------------------------------------------------------------------------------------------
  fixtures: {
    'fixture:fixture': { base: t(DUNGEON, 2, 1), open: t(DUNGEON, 3, 1) },
    'fixture:container': { base: px('Items/Treasure/BigTreasureChest.png', 0, 0, 16, 14), open: px('Items/Treasure/BigTreasureChest.png', 16, 0, 16, 14) },
    // the containers: the chest and the crate shut, open with things in, open and empty (tools/src/art/
    // interior-furniture.py); the barrel and the sack shut and open (tools/src/art/containers.py)
    'fixture:chest': { base: furniture('chest'), open: furniture('chest_open'), emptied: furniture('chest_empty'), scale: INTERIOR_FURNITURE_JSON.scale },
    // the Most Holy Hall's (tools/src/art/holyhall-nave.py): the choir's stalls; the slab over the stair, lifted when it
    // bears `open` (rule slab/told)
    'fixture:choir_stalls': { base: packPiece(HOLY_NAVE_JSON, 'stalls_e'), scale: HOLY_NAVE_JSON.scale },
    'fixture:altar_slab': { base: packPiece(HOLY_NAVE_JSON, 'slab'), open: packPiece(HOLY_NAVE_JSON, 'slab_open'), scale: HOLY_NAVE_JSON.scale },
    'fixture:barrel': { base: container('barrel'), open: container('barrel_open'), scale: CONTAINERS_SCALE },
    'fixture:crate': { base: furniture('crate'), open: furniture('crate_open'), emptied: furniture('crate_empty'), scale: INTERIOR_FURNITURE_JSON.scale },
    // (plain or painted by the map's theme: fixtureThemes)
    'fixture:pot': { base: container('pot_plain'), scale: CONTAINERS_SCALE },
    'fixture:wardrobe': { base: t(ELEM, 2, 7, 1, 2) },
    // the dresser's standing mirror (TilesetElement (8,10))
    'fixture:mirror': { base: t(ELEM, 8, 10) },
    'fixture:shelf': { base: t(ELEM, 4, 7, 1, 2) },
    'fixture:bookshelf': { base: t(ELEM, 3, 7, 1, 2) },
    // the showcase's furniture, drawn by the oblique renderer (tools/src/art/arch/buildings/inside.ts, BUILDINGS_JSON.props)
    ...propFixtures(),
    'fixture:sack': { base: container('sack'), open: container('sack_open'), scale: CONTAINERS_SCALE },
    'fixture:furniture': { base: t(ELEM, 5, 7) },
    'fixture:table': { base: t(ELEM, 5, 7) },
    // a household's furniture (docs/release-1.md): the long table (3x1, centred on its cell like its footprint), the
    // round-topped chest of drawers, the dark two-door cupboard (its footprint is its cell and the one east: drawn from
    // the cell's left edge), the plant in its pot
    'fixture:long_table': { base: t(ELEM, 2, 10, 3, 1) },
    'fixture:drawers': { base: t(ELEM, 1, 7, 1, 2) },
    'fixture:cupboard': { base: t(ELEM, 6, 7, 2, 2, 8, 32) },
    'fixture:plant': { base: t(ELEM, 0, 7, 1, 2) },
    'fixture:chair': { base: t(ELEM, 0, 9) },
    'fixture:bed': { base: t(BED, 5, 3, 1, 2) },
    // a bench (tools/src/art/generic-props.py): each its own make, the backed one most (they stand in chapels and halls);
    // one south of a table, seen from behind, the plain one with no back
    'fixture:bench': { base: genericProp('pew'), variants: [genericProp('pew'), genericProp('pew'), genericProp('bench'), genericProp('worn')], back: genericProp('bench'), scale: GENERIC_PROPS_SCALE },
    // the camp's things: a bench by the fire (with a back or without), the cooking rack over the fire, the chopping
    // stump, firewood, a lantern post, the tent; the bench, the rack and the arms rack in two makes each (tools/src/art/outdoor.py)
    'fixture:log_bench': outdoor('log_bench'),
    'fixture:rack': outdoor('rack'),
    'fixture:arms_rack': outdoor('arms_rack'),
    // the Reed Bend's (tools/src/art/flanks.ts): the fisher's nets hung to dry on their pole, her rack of fish drying;
    // her rowboat is the pack's (the Ford's ferry raft is the same boat)
    'fixture:nets': { base: px('lsw/Fixtures/Nets.png', 0, 0, 32, 32, 16, 31) },
    'fixture:fish_rack': { base: px('lsw/Fixtures/FishRack.png', 0, 0, 32, 32, 16, 31) },
    'fixture:boat': { base: px(WATER, 416, 0, 32, 16, 16, 13) },
    // the Charcoal Dell's (tools/src/art/flanks.ts): the soot a kiln breathes onto the ground before its mouth
    'fixture:soot': { base: px('lsw/Fixtures/Soot.png', 0, 0, 48, 32, 24, 22), ground: true },
    'fixture:stump': { base: t(CAMP, 1, 5, 2, 2) },
    // the camp sheet's stack of split logs, their ends out (2x1)
    // logs bound, or split wood: each pile its own (tools/src/art/containers.py)
    'fixture:firewood': { base: container('firewood_logs'), variants: [container('firewood_logs'), container('firewood_split')], scale: CONTAINERS_SCALE },
    // (plain or rich by the map's theme, as the brazier, the lamp post and the candlestick: fixtureThemes)
    'fixture:lantern': { base: light('lantern_plain'), lit: light('lantern_plain_lit'), scale: LIGHTS_JSON.scale },
    'fixture:tent': { base: t(CAMP, 7, 0, 3, 3) },
    // the ferrykeeper's tool rack, her spare planks and her coil of rope (tools/src/art/ferry-camp.py)
    'fixture:tool_rack': { base: ferryCamp('stall') },
    'fixture:plank_stack': { base: ferryCamp('planks') },
    'fixture:rope_coil': { base: ferryCamp('rope') },
    // the watchman's wall hooks, bare (tools/src/art/watch-shelter.ts; the Cloudtop pair is drawn with its cloak by placedSprites)
    'fixture:cloak_hooks': { base: px('lsw/Fixtures/WatchShelter.png', 64, 0, 32, 24, 16, 44) },
    'fixture:tent_torn': { base: t(CAMP, 10, 0, 3, 3) },
    // small things of the ground, scattered by mask: each a thing (pick a flower, burn the reeds)
    'fixture:flowers': { base: t(DETAIL, 5, 2), variants: [t(DETAIL, 5, 2), t(NATURE, 6, 11), t(NATURE, 3, 11), t(DETAIL, 2, 0)], ground: true, loose: true },
    // reeds as reeds, clumps of cattails (tools/src/art/flanks.ts): the pack's grass tufts stood in for them until 2026-10-21
    'fixture:reeds': { base: px('lsw/Fixtures/Reeds.png', 0, 0, 16, 24, 8, 23), variants: [0, 1, 2, 3].map((i) => px('lsw/Fixtures/Reeds.png', i * 16, 0, 16, 24, 8, 23)), loose: true },
    'fixture:ferns': { base: t(NATURE, 4, 11), variants: [t(NATURE, 4, 11), t(NATURE, 5, 11), t(NATURE, 8, 11), t(NATURE, 9, 11)], loose: true },
    'fixture:leaves': { base: t(DETAIL, 0, 0), variants: [t(DETAIL, 0, 0), t(DETAIL, 1, 0), t(NATURE, 12, 11), t(NATURE, 13, 12)], ground: true, loose: true },
    'fixture:pebbles': { base: t(NATURE, 15, 18), variants: [t(NATURE, 15, 18), t(NATURE, 16, 18), t(NATURE, 17, 18), t(DETAIL, 9, 0)], ground: true, loose: true },
    'fixture:tuft': { base: t(NATURE, 4, 10), variants: [t(NATURE, 4, 10), t(NATURE, 5, 10), t(NATURE, 7, 10), t(NATURE, 8, 10), t(NATURE, 10, 10), t(DETAIL, 0, 2), t(DETAIL, 3, 2)], loose: true },
    'fixture:moss': { base: t(CAMP, 0, 8), variants: [t(CAMP, 0, 8), t(CAMP, 3, 8)], ground: true },
    'fixture:counter': { base: t(ELEM, 14, 0) },
    'fixture:stall': { base: t(ELEM, 7, 1, 1, 2) },
    'fixture:light': { base: px(ELEM, 96, 48, 16, 32, 8, 29) },
    // a ring of stones round its logs, or its sticks stood up over the fire: each campfire its own, cold and lit (tools/src/art/lights.py)
    'fixture:campfire': { base: light('campfire_ring'), variants: [light('campfire_ring'), light('campfire_tepee')], lit: light('campfire_ring_lit'), litVariants: [light('campfire_ring_lit'), light('campfire_tepee_lit')], scale: LIGHTS_JSON.scale },
    'fixture:brazier': { base: light('brazier_plain'), lit: light('brazier_plain_lit'), scale: LIGHTS_JSON.scale },
    'fixture:lamppost': { base: light('lamppost_plain'), lit: light('lamppost_plain_lit'), scale: LIGHTS_JSON.scale },
    'fixture:candles': { base: light('candles_plain'), lit: light('candles_plain_lit'), scale: LIGHTS_JSON.scale },
    'fixture:fireplace': { base: px(HOUSE, 464, 176, 32, 32, 16, 30) },
    'fixture:water': { base: t(ELEM, 6, 2) },
    // under its roof, or its bare frame (tools/src/art/outdoor.py)
    'fixture:well': outdoor('well'),
    'fixture:fountain': { base: px(DESERT, 128, 112, 32, 32, 16, 28) },
    'fixture:trough': { base: t(ELEM, 6, 10) },
    // a sign, a notice board, a commission board: the notice board under its roof (tools/src/art/generic-props.py)
    'fixture:sign': { base: genericProp('board'), scale: GENERIC_PROPS_SCALE },
    // a place on the overworld: a signpost where it is; the wild shows no mark of its own
    'site:place': { base: wm('waystone') },
    // the hand-made places, each by its kind; the Ford is its crossing
    ...Object.fromEntries(['village', 'town', 'farm', 'mill', 'hollow', 'barrow', 'mine', 'lair', 'pass', 'summit', 'shrine', 'camp', 'waystone', 'ford', 'watermill'].map((k) => [`site:${k}`, { base: wm(k) }])),
    // the backdrop's places, by their kinds (docs/continent.md §3)
    ...Object.fromEntries(['fort', 'ruin', 'graveyard', 'cathedral', 'city', 'tower', 'battlefield', 'cave', 'seat'].map((k) => [`site:${k}`, { base: wm(k) }])),
    'site:woods': { base: wm('woods-place') },
    // what one builds, set in its cell: drawn as the wall, the floor, the stairs of the place
    // the project's own (tools/src/art/structures.ts): a wall block (its fronts and tops, by
    // what stands beside it), stairs by the way up, the edge of a floor laid a storey up
    'structure:wall': { base: t(LSW_WALL, 16, 0) },
    'structure:floor': { base: t(IFLOOR, 12, 1) },
    'structure:floor_edge': { base: t(LSW_FLOOR, 0, 0) },
    'structure:stairs': { base: t(LSW_STAIRS, 0, 0) },
    'structure:door': { base: t(ELEM, 8, 13) },
    // an open door: the doorway's floor
    'structure:door_open': { base: t(IFLOOR, 12, 1) },
    // the wild: its ground is its picture
    'site:wild': { base: wm('none') },
    'fixture:noticeboard': { base: genericProp('board'), scale: GENERIC_PROPS_SCALE },
    'fixture:questboard': { base: genericProp('board'), scale: GENERIC_PROPS_SCALE },
    'fixture:craft': { base: t(HOUSE, 29, 15) },
    'fixture:anvil': { base: t(HOUSE, 29, 15) },
    'fixture:forge': { base: px(HOUSE, 496, 192, 32, 48, 16, 46) },
    'fixture:cauldron': { base: t(HOUSE, 32, 10), lit: t(HOUSE, 31, 10) },
    // No loom in the pack: a wooden frame with a strung rope (TilesetElement (11..13, 2..3)).
    // the project's own (tools/src/art/loom.ts): the pack's frame drawn for it before was its washing line's posts
    'fixture:loom': { base: px('lsw/Fixtures/Loom.png', 0, 0, 32, 32, 16, 31) },
    // the slender statue (7, 15) is the waypoint's alone: nothing else may look like one
    'fixture:sacred': { base: t(HOUSE, 5, 15, 2, 2) },
    'fixture:altar': { base: px(HOUSE, 48, 240, 32, 32, 16, 32) },
    // the stone altar on its two steps, four cells wide (Firstlight's chapel, tools/src/art/firstlight-chapel.py)
    'fixture:stone_altar': { base: chapel('altar').sprite, scale: FIRSTLIGHT_CHAPEL_JSON.scale },
    // the long pew along a nave (the Rest's chapel of the Five, tools/src/art/rest-chapel.py)
    'fixture:pew_long': { base: packPiece(REST_CHAPEL_JSON, 'pew_long'), scale: REST_CHAPEL_JSON.scale },
    // the Held Ground's heart: a longsword point down in a mound of earth (tools/src/art/planted-sword.ts)
    'fixture:planted_sword': { base: px('lsw/Fixtures/PlantedSword.png', 0, 0, 16, 32, 8, 31) },
    // the Pillar Yard's broken Scourging Post, and the red channel cut across the undercroft's floor (tools/src/art/chapter2.py)
    'fixture:scourging_post': { base: px('lsw/Fixtures/ScourgingPost.png', 0, 0, 16, 32, 8, 31) },
    'fixture:red_channel': { base: px('lsw/Fixtures/RedChannel.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:red_standard': { base: px('lsw/Fixtures/RedStandard.png', 0, 0, 16, 32, 8, 31) },
    // Chapter 3's (tools/src/art/chapter3.py): Fairweight's great scale (footprint 3x1, its beam and pans drawn above the base
    // row; the type's cell is the middle one), the Church's black weight, the Standing on the salt, grain-dust, the great pan
    // over the Scale Floor (footprint 2x1, drawn from its west cell), the wayside scale, a salt pan, the ledger on its stand
    'fixture:great_scale': { base: px('lsw/Fixtures/GreatScale.png', 0, 0, 48, 56, 24, 56) },
    'fixture:weight_of_sin': { base: px('lsw/Fixtures/WeightOfSin.png', 0, 0, 16, 16, 8, 15) },
    'fixture:standing_a': { base: px('lsw/Fixtures/StandingA.png', 0, 0, 16, 26, 8, 25) },
    'fixture:standing_b': { base: px('lsw/Fixtures/StandingB.png', 0, 0, 16, 26, 8, 25) },
    'fixture:standing_c': { base: px('lsw/Fixtures/StandingC.png', 0, 0, 16, 26, 8, 25) },
    'fixture:dust_heap': { base: px('lsw/Fixtures/DustHeap.png', 0, 0, 16, 16, 8, 15) },
    'fixture:hanging_pan': { base: px('lsw/Fixtures/HangingPan.png', 0, 0, 32, 48, 8, 48) },
    'fixture:wayside_scale': { base: px('lsw/Fixtures/WaysideScale.png', 0, 0, 16, 32, 8, 31) },
    'fixture:salt_pan': { base: px('lsw/Fixtures/SaltPan.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:ledger': { base: px('lsw/Fixtures/Ledger.png', 0, 0, 16, 20, 8, 19) },
    // the Vale's dead wheat, laid out and anchored as the ripe wheat is (fixture:wheat_ripe)
    'fixture:dead_wheat': { base: px('lsw/Fixtures/DeadWheat.png', 0, 0, 16, 24, 8, 24) },
    // what the later bosses leave on the floor (tools/src/art/nacht.py, astra.py): Nacht's grave-hands, Astra's dark
    'fixture:grave_hands': { base: px('lsw/Fixtures/GraveHands.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:night_pool': { base: px('lsw/Fixtures/NightPool.png', 0, 0, 16, 16, 8, 15), ground: true },
    // Chapter 4's (tools/src/art/chapter4.py): Nailgate's nailed doorpost, a grave post by the causeway, the Shroud in its
    // reliquary, the Holy Wood standing in the Ford of the Dead (32x48 over one cell, anchored at its foot's middle)
    'fixture:nail_post': { base: px('lsw/Fixtures/NailPost.png', 0, 0, 16, 24, 8, 23) },
    'fixture:grave_post': { base: px('lsw/Fixtures/GravePost.png', 0, 0, 16, 24, 8, 23) },
    'fixture:shroud': { base: px('lsw/Fixtures/Shroud.png', 0, 0, 16, 24, 8, 23) },
    'fixture:holy_wood_tree': { base: px('lsw/Fixtures/HolyWoodTree.png', 0, 0, 32, 48, 16, 47) },
    // Chapter 5's (tools/src/art/chapter5.py): a robe on a pole over a pilgrim's grave, a burial niche (a piece of wall face)
    // with its white-robed body and empty, the altar with the Lance in it (two cells, drawn from its west cell like the
    // hanging pan), the white-robed lying and kneeling (dark-inked to stand off a white floor), the robe-sewer's frame
    'fixture:robe_pole': { base: px('lsw/Fixtures/RobePole.png', 0, 0, 16, 32, 8, 31) },
    'fixture:niche': { base: px('lsw/Fixtures/Niche.png', 0, 0, 16, 16, 8, 15) },
    'fixture:niche_empty': { base: px('lsw/Fixtures/NicheEmpty.png', 0, 0, 16, 16, 8, 15) },
    'fixture:lance_altar': { base: px('lsw/Fixtures/LanceAltar.png', 0, 0, 32, 56, 8, 56) },
    'fixture:robed_sleeper': { base: px('lsw/Fixtures/RobedSleeper.png', 0, 0, 16, 16, 8, 15) },
    'fixture:robed_kneeling': { base: px('lsw/Fixtures/RobedKneeling.png', 0, 0, 16, 24, 8, 23) },
    'fixture:sewing_frame': { base: px('lsw/Fixtures/SewingFrame.png', 0, 0, 16, 24, 8, 23) },
    // the finale's (tools/src/art/finale.py): Astra's bier (three cells, drawn from its middle one like the great scale), an
    // instrument's niche in the Holiest's wall, the Confluence's other four channels (the red channel recoloured), a
    // Seal-bearer's statue on the Processional Way
    'fixture:bier': { base: px('lsw/Fixtures/Bier.png', 0, 0, 48, 32, 24, 32) },
    'fixture:instrument_niche': { base: px('lsw/Fixtures/InstrumentNiche.png', 0, 0, 16, 24, 8, 23) },
    'fixture:channel_dust': { base: px('lsw/Fixtures/ChannelDust.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:channel_black': { base: px('lsw/Fixtures/ChannelBlack.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:channel_white': { base: px('lsw/Fixtures/ChannelWhite.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:channel_thorn': { base: px('lsw/Fixtures/ChannelThorn.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:bearer_statue': { base: px('lsw/Fixtures/BearerStatue.png', 0, 0, 16, 40, 8, 39) },
    'fixture:statue': { base: t(HOUSE, 5, 15, 2, 2) },
    // a stone cross over a grave (tools/src/art/generic-props.py)
    'fixture:gravestone': { base: genericProp('cross'), scale: GENERIC_PROPS_SCALE },
    // what a person leaves (docs/npc-sandbox.md §2.8): a body is drawn from its look, lying (scene.ts); bones, a skull
    'fixture:body': { base: t(DETAIL, 13, 0) },
    'fixture:bones': { base: t(DETAIL, 13, 0) },
    'fixture:remains': { base: t(DETAIL, 13, 0) },
    // Chapter 1's own (tools/src/art/chapter1.ts): Pell's chalk drawings, the knight's briars
    'fixture:chalk_stone': { base: px('lsw/Fixtures/Chalk.png', 0, 0, 16, 16, 8, 15) },
    'fixture:chalk_door': { base: px('lsw/Fixtures/Chalk.png', 16, 0, 16, 16, 8, 15), ground: true },
    'fixture:chalk_bridge': { base: px('lsw/Fixtures/Chalk.png', 32, 0, 16, 16, 8, 15), ground: true },
    'fixture:chalk_man': { base: px('lsw/Fixtures/Chalk.png', 48, 0, 16, 16, 8, 15), ground: true },
    'fixture:briar': { base: px('lsw/Fixtures/Briar.png', 0, 0, 16, 16, 8, 15) },
    // a spider's web left on the ground (tools/src/art/drops.ts)
    'fixture:web': { base: px('lsw/Fixtures/Web.png', 0, 0, 16, 16, 8, 15), ground: true },
    // what the advancements' skills lay (content advancement.ts HAZARDS; tools/src/art/hazards.ts)
    'fixture:miasma': { base: px('lsw/Fixtures/Miasma.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:snare': { base: px('lsw/Fixtures/Snare.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:spikes': { base: px('lsw/Fixtures/Spikes.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:blast_trap': { base: px('lsw/Fixtures/BlastTrap.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:flame_wall': { base: px('lsw/Fixtures/FlameWall.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:holy_ground': { base: px('lsw/Fixtures/HolyGround.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:caltrops': { base: px('lsw/Fixtures/Caltrops.png', 0, 0, 16, 16, 8, 15), ground: true },
    'fixture:binding_sigil': { base: px('lsw/Fixtures/BindingSigil.png', 0, 0, 16, 16, 8, 15), ground: true },
    // what the dragon's fire leaves on the ground: a scorch of ash, its flames the burning overlay
    'fixture:embers': { base: t(NATURE, 8, 13), ground: true },
    // the Held Ground's edge (tools/src/art/haven.ts)
    'fixture:mist': { base: px('lsw/Fixtures/Mist.png', 0, 0, 16, 16, 8, 15) },
    // the fog at a boss's door: a column of gold-white mist two cells tall, three looks (tools/src/art/fog.ts)
    'fixture:fog': { base: px('lsw/Fixtures/Fog.png', 0, 0, 16, 32, 8, 31), variants: [0, 1, 2].map((k) => px('lsw/Fixtures/Fog.png', k * 16, 0, 16, 32, 8, 31)) },
    'fixture:seal_stone': { base: t(DUNGEON, 3, 2), lit: t(DUNGEON, 5, 2) },
    // the waypoint stone is a statue: it glows once woken (scene.ts lights what is attuned)
    'fixture:waypoint': { base: t(HOUSE, 7, 15, 1, 2) },
    'fixture:nature': { base: t(NATURE, 18, 9) },
    'fixture:boulder': { base: t(NATURE, 18, 9) },
    // the old mine's veins: a grey rock flecked with ore, a dark one for coal
    'fixture:vein_iron': { base: t(NATURE, 4, 14) },
    'fixture:vein_coal': { base: t(NATURE, 6, 15) },
    'fixture:vein_gold': { base: t(NATURE, 5, 14) },
    // a vein's spent face: a plain rock face, no ore showing
    'fixture:spentvein': { base: t(NATURE, 6, 16) },
    // bales or a sheaf: each its own (tools/src/art/containers.py)
    'fixture:haystack': { base: container('hay_bales'), variants: [container('hay_bales'), container('hay_sheaf')], scale: CONTAINERS_SCALE },
    // a felled log lying (the camp sheet's): the house sheet's plank drawn for it read as a bench
    'fixture:logpile': { base: px(CAMP, 16, 29, 32, 18, 16, 18) },
    // No static mushroom art: first frame of the (red-capped) Mushroom monster.
    'fixture:mushroom_ring': { base: t('Actor/Monster/Mushroom/mushroom.png', 0, 0) },
    'fixture:beehive': { base: t(ELEM, 12, 0) },
    // The Ford: the dead tree (two makes, tools/src/art/outdoor.py; the one at the narrows its own, placedSprites), the
    // slimes' hollow, the ferry's winch and raft.
    'fixture:dead_tree': outdoor('dead_tree'),
    // the hollow: a mossy rock mound with a cave mouth, drawn on the mouth's tile
    'fixture:burrow': { base: px(RELIEF_DETAIL, 0, 112, 48, 48, 24, 48) },
    // the ferry: a rope post on the landing, and the rowboat that crosses on the line
    'fixture:winch': { base: t(ELEM, 11, 2, 1, 2) },
    'fixture:ferry': { base: px(WATER, 416, 0, 32, 16, 16, 13) },
    'fixture:raft': { base: px(WATER, 416, 0, 32, 16, 16, 13) },
    'fixture:fence': { base: t(HOUSE, 11, 7), across: t(HOUSE, 11, 6) },
    'fixture:dummy': { base: t(ELEM, 15, 0) },
    // Crops (farming). The pack has no crop sheet: sprouts are ground details, young plants are
    // small nature tufts/bushes, wheat the project's own (tools/src/art/wheat.ts: the camp sheet's 'sheaf' was
    // kindling), ripe berries the
    // fruiting bush, the oak sapling the bare twig tree.
    'fixture:crop': { base: px('lsw/Crops/wheat/young.png', 0, 0, 16, 24, 8, 24) },
    'fixture:wheat': { base: px('lsw/Crops/wheat/ripe.png', 0, 0, 16, 24, 8, 24) },
    'fixture:wheat_sprout': { base: px('lsw/Crops/wheat/sprout.png', 0, 0, 16, 24, 8, 24) },
    'fixture:wheat_young': { base: px('lsw/Crops/wheat/young.png', 0, 0, 16, 24, 8, 24) },
    'fixture:wheat_ripe': { base: px('lsw/Crops/wheat/ripe.png', 0, 0, 16, 24, 8, 24) },
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
    // the Held Ground's water and machines (docs/logs/0005, 0006): the pack's tub for a rain barrel and its tall barrel for a
    // cask; the mill's own millstones (tools/src/art/mill.ts); a sprinkler and an apple tree drawn for them (the tree is the
    // pack's small tree, in fruit with apples on it)
    'fixture:rain_barrel': { base: t(ELEM, 6, 1) },
    'fixture:sprinkler': { base: px('lsw/Fixtures/Sprinkler.png', 0, 0, 16, 16, 8, 15) },
    'fixture:millstone': { base: px('lsw/Fixtures/Millstones.png', 0, 0, 32, 32, 16, 31) },
    'fixture:cask': { base: t(ELEM, 9, 1) },
    'fixture:apple_sapling': { base: t(NATURE, 5, 9) },
    'fixture:apple_tree': { base: px('lsw/Fixtures/AppleTree.png', 0, 0, 32, 32, 16, 31) },
    'fixture:apple_fruiting': { base: px('lsw/Fixtures/AppleTree.png', 32, 0, 32, 32, 16, 31) },
    ...CROP_FIXTURES,
    ...FLOWER_FIXTURES,
    'fixture:garden_pavilion': { base: px('composite:garden_pavilion', 0, 0, 48, 96, 24, 96) },
    'fixture:waterfall': { base: t(WATER, 1, 7) },
    // Building: a timber rack for the frame, a stake, a sign post and a ring of stones.
    'fixture:build': { base: px(CAMP, 128, 48, 32, 32, 16, 30) },
    'fixture:frame': { base: px(CAMP, 128, 48, 32, 32, 16, 30) },
    'fixture:stakes': { base: t(CAMP, 0, 5, 1, 2) },
    'fixture:post': { base: t(CAMP, 6, 5, 1, 2) },
    'fixture:ring': { base: px(CAMP, 160, 48, 32, 32, 16, 28) },
    // The Great Hearth: a wide ring of stones around old ash; lit, the embers glow.
    'fixture:hearth': { base: t(CAMP, 12, 5, 2, 2, 16, 24), lit: t(CAMP, 12, 3, 2, 2, 16, 24) },
    // a straw man in a blue smock or a red one (tools/src/art/outdoor.py)
    'fixture:scarecrow': outdoor('scarecrow'),
    // the pack's line on its posts with its laundry pegged on it, put together (tools/src/art/washing-line.ts)
    'fixture:washing_line': { base: px('lsw/Fixtures/WashingLine.png', 0, 0, 64, 32, 32, 31) },
    // empty, or loaded with a sack and a crate under a cloth: each its own (tools/src/art/containers.py)
    'fixture:cart': { base: container('cart_empty'), variants: [container('cart_empty'), container('cart_loaded')], scale: CONTAINERS_SCALE },
    'fixture:flower_cart': { base: t(ELEM, 2, 3, 2, 2, 16, 30) },
    'fixture:workbench': { base: t(HOUSE, 29, 8, 2, 1, 16, 16) },
  },

  // -------------------------------------------------------------------------------------------
  // Item icons.
  // -------------------------------------------------------------------------------------------
  items: {
    'item:acorn': icon('Items/Food/Nut.png', 15, 15),
    // a weapon's swing (scene.ts swingWeapon): the sword sweeps, the bow shoots, the staff points
    'item:sword': { ...icon('Items/Weapons/Sword2/Sprite.png', 6, 15), swing: 'sweep' },
    // the swordsman's katana and its scabbard (tools/src/art/swordsman.ts): the blade points up, as a sword's
    'item:katana': { ...icon('lsw/Items/Katana.png', 16, 16), swing: 'sweep' },
    'item:scabbard': icon('lsw/Items/Scabbard.png', 16, 16),
    // the cleric's cross and rosary (tools/src/art/cleric.ts): the cross swung as a mace is
    'item:cross': { ...icon('lsw/Items/Cross.png', 16, 16), swing: 'sweep' },
    'item:rosary': icon('lsw/Items/Rosary.png', 16, 16),
    // the professions' other off-hand pieces, each its own (tools/src/art/offhands.ts)
    'item:parrying_dagger': icon('lsw/Items/ParryingDagger.png', 16, 16),
    'item:quiver': icon('lsw/Items/Quiver.png', 16, 16),
    'item:tome': icon('lsw/Items/Tome.png', 16, 16),
    'item:dagger': icon('Items/Projectile/Kunai.png', 16, 16),
    'item:axe': icon('Items/Tool/Axe.png', 16, 16),
    'item:club': icon('Items/Weapons/Club/Sprite.png', 8, 14),
    'item:mace': icon('Items/Weapons/Hammer/Sprite.png', 9, 16),
    'item:hammer': icon('Items/Tool/Hammer.png', 16, 16),
    'item:spear': icon('Items/Weapons/Lance2/Sprite.png', 7, 21),
    // the project's own (tools/src/art/gear.ts): the pack's bow is its in-hand arc, which reads as a bowl
    'item:bow': { ...icon('lsw/Items/Bow.png', 16, 16), swing: 'shoot' },
    'item:wand': icon('Items/Weapons/MagicWand/SpriteInHand.png', 5, 10),
    'item:staff': { ...icon('Items/Weapons/MagicWand/Sprite.png', 5, 18), swing: 'point' },
    // Armour pieces only exist as 24x24 skill icons (with their coloured badge background).
    'item:helmet': icon('lsw/Items/Gear/Helmet.png', 24, 24),
    'item:armor': icon('lsw/Items/Gear/Armor.png', 24, 24),
    'item:boots': icon('lsw/Items/Gear/Boot.png', 24, 24),
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
    // raw beef, the steak, the egg: the project's own (tools/src/art/food.ts); the pack's read as a sausage and a nut
    'item:meat': icon('lsw/Items/RawBeef.png', 16, 16),
    'item:chicken': icon('lsw/Items/RawChicken.png', 16, 16),
    'item:chicken_cooked': icon('lsw/Items/RoastChicken.png', 16, 16),
    'item:meat_cooked': icon('lsw/Items/Steak.png', 16, 16),
    'item:mushroom': t('Actor/Monster/Mushroom/mushroom.png', 0, 0),
    'item:berries': t(DETAIL, 4, 0),
    'item:egg': icon('lsw/Items/Egg.png', 16, 16),
    'item:egg_boiled': icon('lsw/Items/BoiledEgg.png', 16, 16),
    'item:pie': t(HOUSE, 14, 17),
    'item:honey': icon('Items/Food/Honey.png', 16, 16),
    'item:wine': t(CAMP, 12, 7),
    // the cask's (docs/logs/0006): the camp's bottle, its glass recoloured amber for cider, red for fruit wine
    'item:cider': icon('lsw/Items/Cider.png', 16, 16),
    'item:fruit_wine': icon('lsw/Items/FruitWine.png', 16, 16),
    // the millstone's: the pack's sack of grain
    'item:flour': t(ELEM, 1, 1),
    'item:apple_seedling': t(NATURE, 5, 9),
    'item:ale': icon('Items/Resource/Water.png', 14, 14),
    'item:potion_red': icon('Items/Potion/LifePot.png', 9, 11),
    'item:potion_green': t(HOUSE, 21, 14),
    'item:potion_orange': t(HOUSE, 21, 15),
    'item:potion_purple': t(HOUSE, 21, 13),
    'item:log': t(CAMP, 8, 8),
    'item:plank': t(HOUSE, 31, 17),
    // what one builds, carried
    'structure:wall': t(HOUSE, 11, 5),
    'structure:floor': t(IFLOOR, 12, 1),
    'structure:stairs': t(ELEM, 6, 12),
    'structure:door': t(ELEM, 8, 13),
    'structure:door_open': t(ELEM, 8, 13),
    'fixture:bed': t(BED, 5, 3),
    'item:stick': icon('Items/Resource/Branch.png', 16, 16),
    'item:stone': icon('Items/Resource/Rock.png', 16, 16),
    // cut grass: one of the meadow's tufts
    'item:grass': t(NATURE, 4, 10),
    'item:coal': t(NATURE, 7, 12),
    'item:ore': t(NATURE, 6, 14),
    'item:ore_gold': t(NATURE, 4, 14),
    'item:herb': icon('Items/Resource/Grass.png', 16, 16),
    // the field's flowers, as the ground shows them; a bouquet, a fuller clump
    'item:flower': t(DETAIL, 5, 2),
    'item:bouquet': t(NATURE, 6, 11),
    'item:herb_red': t(DETAIL, 5, 2),
    'item:mushroom_blue': t('Actor/Monster/Mushroom2/mushroom2.png', 0, 0),
    'item:feather': icon('Items/Resource/feather.png', 16, 16),
    'item:bone': t(DETAIL, 14, 0),
    // what only monsters leave (tools/src/art/drops.ts)
    'item:slime_gel': icon('lsw/Items/SlimeGel.png', 16, 16),
    'item:venom_sac': icon('lsw/Items/VenomSac.png', 16, 16),
    'item:ectoplasm': icon('lsw/Items/Ectoplasm.png', 16, 16),
    'item:cloth': icon('Items/Scroll/Scroll.png', 14, 14),
    'item:leather': icon('Items/Object/Bag.png', 16, 16),
    'item:wool': t(NATURE, 10, 12),
    'item:wax': icon('Items/Food/SeedLargeWhite.png', 14, 13),
    'item:salt': t(NATURE, 10, 13),
    'item:ash': t(NATURE, 11, 12),
    'item:seed': icon('Items/Food/Seed1.png', 8, 8),
    'item:wheat': t(ELEM, 12, 4),
    ...CROP_ITEMS,
    ...FLOWER_ITEMS,
    // the main line's sets (docs/sets.md): a picture for every piece (tools/src/art/sets.ts)
    ...Object.fromEntries(SET_PIECES.map((p) => [p.sprite, icon(`lsw/Items/Sets/${p.set.id}/${p.piece.slot}.png`, 16, 16)])),
    'item:gem': icon('Items/Resource/GemRed.png', 15, 15),
    'item:coins': icon('Items/Object/MoneyBag.png', 14, 15),
    'item:ring': icon('lsw/Items/Gear/Ring.png', 24, 24),
    'item:amulet': icon('lsw/Items/Gear/Amulet.png', 24, 24),
    'item:goblet': icon('Items/Treasure/GoldCup.png', 9, 11),
    'item:crown': icon('Items/Resource/GemYellow.png', 14, 14),
    'item:shard': icon('Items/Resource/GemPurple.png', 16, 16),
    'item:book': icon('Items/Object/Book.png', 16, 16),
    'item:scroll': icon('Items/Scroll/ScrollEmpty.png', 16, 16),
    'item:letter': icon('Items/Other/Letter.png', 12, 9),
    'item:crown_of_thorns': icon('lsw/Items/CrownOfThorns.png', 16, 16),
    // Chapter 2's (tools/src/art/chapter2.py)
    'item:post_chain': icon('lsw/Items/ChainOfThePost.png', 16, 16),
    'item:war_drum': icon('lsw/Items/WarDrum.png', 16, 16),
    'item:novice_scourge': icon('lsw/Items/NoviceScourge.png', 16, 16),
    'item:left_banner': icon('lsw/Items/LeftBanner.png', 16, 16),
    'item:surgeon_ledger': icon('lsw/Items/SurgeonLedger.png', 16, 16),
    'item:offering_register': icon('lsw/Items/OfferingRegister.png', 16, 16),
    // Chapter 3's (tools/src/art/chapter3.py)
    'item:scale_of_hunger': icon('lsw/Items/ScaleOfHunger.png', 16, 16),
    'item:blue_scarf': icon('lsw/Items/BlueScarf.png', 16, 16),
    'item:granary_key': icon('lsw/Items/GranaryKey.png', 16, 16),
    // Chapter 4's (tools/src/art/chapter4.py) and Chapter 5's (chapter5.py)
    'item:holy_wood': icon('lsw/Items/HolyWood.png', 16, 16),
    'item:ferry_coin': icon('lsw/Items/FerryCoin.png', 16, 16),
    'item:jory_kite': icon('lsw/Items/JoryKite.png', 16, 16),
    'item:holy_lance': icon('lsw/Items/HolyLance.png', 16, 16),
    // the project's own (tools/src/art/gear.ts): what the pack has no picture of
    'item:pauldrons': icon('lsw/Items/Pauldrons.png', 16, 16),
    'item:belt': icon('lsw/Items/Belt.png', 16, 16),
    'item:earring': icon('lsw/Items/Earring.png', 16, 16),
    'item:oath_thorn': icon('lsw/Items/OathThorn.png', 16, 16),
    // an ingot (life.ts): the project's own (tools/src/art/skill-life-smithing.ts)
    'item:ingot': icon('lsw/Items/Ingot.png', 16, 16),
    // gear on the ground, before it is picked up (scene.ts): a wrapped bundle with a glint
    'item:loot': icon('lsw/Items/Loot.png', 16, 16),
    // one's belongings, bundled where one fell (content body/rise)
    'item:bundle': icon('Items/Object/Bag.png', 16, 16),
    // the homestead (tools/src/art/homestead.ts; bait is the pack's shrimp)
    'item:thornmark': icon('lsw/Items/Thornmark.png', 16, 16),
    'item:fertilizer': icon('lsw/Items/Fertilizer.png', 16, 16),
    'item:feed': icon('lsw/Items/Feed.png', 16, 16),
    'item:crate': icon('lsw/Items/Crate.png', 16, 16),
    'item:milk': icon('lsw/Items/Milk.png', 16, 16),
    'item:carp': icon('lsw/Items/Carp.png', 16, 16),
    'item:sunfish': icon('lsw/Items/Sunfish.png', 16, 16),
    'item:perch': icon('lsw/Items/Perch.png', 16, 16),
    'item:catfish': icon('lsw/Items/Catfish.png', 16, 16),
    'item:eel': icon('lsw/Items/Eel.png', 16, 16),
    'item:pike': icon('lsw/Items/Pike.png', 16, 16),
    'item:dawnscale': icon('lsw/Items/Dawnscale.png', 16, 16),
    'item:bait': icon('Items/Food/Shrimp.png', 16, 16),
    'item:warm_ember': icon('lsw/Items/WarmEmber.png', 16, 16),
    'item:ninth_nail': icon('lsw/Items/NinthNail.png', 16, 16),
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
    // the player: the dog-masked ninja (first is the default)
    player: ['NinjaMasked', 'NinjaGreen', 'NinjaBlue', 'NinjaRed', 'NinjaYellow'],
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
    ...SIN_ACTORS,
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
    // Grey horned beast for the wolf; the frost wolf the same sheet recoloured in ice (tools/src/art/recolours.ts).
    'creature:wolf': mon('Beast2', 'Beast2.png'),
    'creature:wolf:frost_wolf': FROST_WOLF,
    'creature:wolf:ice': FROST_WOLF,
    // Red-brown tusked "Bear" monster (4 directions). Animal/WildBoar exists but is a 2-frame
    // side-view strip (34x16) without directions.
    'creature:boar': mon('Bear'),
    'creature:bat': mon('BlueBat'),
    'creature:skeleton': charCreature('Skeleton'),
    // a Necromancer's guard of hell (content advancement.ts SUMMONS)
    'creature:skeleton_demon': charCreature('SkeletonDemon', 0xff8070),
    // a Phantom's shadow double: the spirit, gone violet
    'creature:phantom': mon('Spirit', 'SpriteSheet.png', 0x9a88ff),
    // an Evangelist's: one of the faithful (a monk of the Church), and an angel out of the gate of heaven, the spirit gilded
    'creature:disciple': charCreature('Monk'),
    'creature:seraph': mon('Spirit', 'SpriteSheet.png', 0xffe27a),
    // a zombie: the caveman, tinted the green of the grave
    'creature:zombie': own('Zombie'),
    'creature:ghost': mon('Spirit'),
    'creature:golem': own('StoneGolem'),
    'creature:golem:stone_golem': own('StoneGolem'),
    'creature:golem:earth': own('StoneGolem'),
    'creature:golem:ice_golem': own('IceGolem'),
    'creature:golem:ice': own('IceGolem'),
    'creature:imp': charCreature('DemonRed'),
    'creature:imp:fire_imp': charCreature('DemonRed'),
    'creature:wisp': own('StormWisp'),
    'creature:wisp:storm_wisp': own('StormWisp'),
    'creature:wisp:bog_wisp': own('BogWisp', 0xc4f2a8),
    'creature:clerk': ownChar('HollowClerk', 0xb8b4a0),
    'creature:restless': ownChar('Restless', 0xdcdad0),
    'creature:crab': own('Crab'),
    // the main quest's monsters
    'creature:spider': mon('SpiderRed'),
    // the sporecap: the pack's mushroom monster, whose first frame is also the mushroom and the fairy ring: recoloured a
    // sickly violet with spores drifting off it, so a sporecap among the Hollow's mushrooms is not taken for one of them
    'creature:fungus': SPORECAP,
    'creature:fungus:sporecap': SPORECAP,
    'creature:whelp': mon('Dragon'),
    // the meadow's animals: the project's own art (tools/src/art/animals.ts), not the pack's
    'creature:cow': { dir: 'lsw/Animal/Cow', sheet: 'SpriteSheet.png', cols: 4, rows: 4 },
    'creature:chicken': { dir: 'lsw/Animal/Chicken', sheet: 'SpriteSheet.png', cols: 4, rows: 4 },
    // the young (homestead.ts): their parents, smaller
    'creature:calf': { dir: 'lsw/Animal/Cow', sheet: 'SpriteSheet.png', cols: 4, rows: 4, scale: 0.7 },
    'creature:chick': { dir: 'lsw/Animal/Chicken', sheet: 'SpriteSheet.png', cols: 4, rows: 4, scale: 0.65 },
    // the Held Ground's sheep (docs/logs/0006): the cow's sheet in wool with a dark face — a placeholder until one is drawn
    'creature:sheep': { dir: 'lsw/Animal/Sheep', sheet: 'SpriteSheet.png', cols: 4, rows: 4 },
    'creature:lamb': { dir: 'lsw/Animal/Sheep', sheet: 'SpriteSheet.png', cols: 4, rows: 4, scale: 0.7 },
    // the companion, Lumi the fairy: the project's own art (tools/src/art/fairy.ts), a four-frame wingbeat, no directions
    'creature:fairy': { dir: 'lsw/Companion/Fairy', sheet: 'SpriteSheet.png', faceset: 'Faceset.png', cols: 4, rows: 1 },
    // Boss sheets are single-row strips: cols = animation frames (62x52 each), no directions.
    'boss:slime': { dir: 'Actor/Boss/GiantSlime', sheet: 'Idle.png', faceset: 'Faceset.png', cols: 5, rows: 1 },
    'boss:cyclops': { dir: 'Actor/Boss/DemonCyclop', sheet: 'Idle.png', faceset: 'Faceset.png', cols: 5, rows: 1 },
    // the dragon's head for now; the renderer composes wings and body around it (scene.ts)
    'boss:dragon': { dir: 'Actor/Boss/DragonGreen', sheet: 'Head.png', faceset: 'Faceset.png', cols: 1, rows: 1 },
  },

  fx: {
    ...SIN_FX,
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
    // what a weapon looses instead of a bolt (its `missile` prop): a bow's arrow, head to the right
    'missile:arrow': fx('Projectile/Arrow.png', 13, 5, 1, 1),
    // a thrown knife (Throwing Knives): the pack's kunai, point to the right
    'missile:knife': fx('Projectile/Kunai.png', 14, 5, 1, 1),
    // Status overlays (loop). Particle/Fire has 12 shrinking flames; the first 5 loop as a flicker.
    'ovl:burning': fx('Particle/Fire.png', 8, 12, 5, 10, { add: true, scale: 1.5 }),
    'ovl:wet': fx('Particle/Rain.png', 8, 8, 3, 6),
    'ovl:frozen': fx('Elemental/Ice/SpriteSheetFlake.png', 32, 32, 9, 8),
    'ovl:electrified': fx('Particle/Spark.png', 10, 8, 7, 14, { add: true }),
    'ovl:oiled': fx('Magic/Aura/SpriteSheet.png', 25, 24, 5, 8),
    'ovl:lit': fx('Particle/Fire.png', 8, 12, 4, 10, { add: true }),
    // the project's own (tools/src/art/spring.ts): green crosses rising round what mends; steam over a warm spring
    'ovl:mend': { img: 'lsw/Fx/Mend.png', fw: 16, fh: 16, frames: 4, fps: 6, scale: 1.4 },
    'ovl:steam': { img: 'lsw/Fx/Steam.png', fw: 16, fh: 16, frames: 4, fps: 4 },
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
    // a wall breaking (tools/src/art/damage.ts): its cracks a third, two thirds and nearly all gone, then the shade a
    // hole leaves under the eave still over it — laid over a building's pieces and built walls (render/pieces.ts)
    wallDamage: ui('lsw/Structures/damage.png', 16, 16, { frames: 4 }),
    // the hunger bar's drumstick (hud.ts)
    drumstick: ui('Items/Food/Meat.png', 15, 15),
    // the corner buttons (hud.ts): quests, build, bag, skills
    cornerQuests: ui('Items/Scroll/ScrollEmpty.png', 16, 16),
    cornerBuild: ui('Items/Tool/Hammer.png', 16, 16),
    cornerBag: ui('Items/Object/Bag.png', 16, 16),
    cornerSkills: ui('lsw/Ui/Star.png', 16, 16),
    cornerJournal: ui('Items/Object/Book.png', 16, 16),
    cornerCraft: ui('Items/Tool/Anvil.png', 16, 16),
    cornerOptions: ui('lsw/Ui/Gear.png', 16, 16),
    // Lumi's badge, left of the corner buttons: her panel — her portrait brought down to pixels in a gilt ring
    // (tools/src/art/lumi-icon.py, the game's icon too); her happy face under the pointer
    cornerCompanion: ui('lsw/Ui/LumiBadge.png', 60, 60),
    cornerCompanionHover: ui('lsw/Ui/LumiBadgeHappy.png', 60, 60),
    // over a profession trainer's head (scene.ts): crossed blades
    trainerMark: ui('Ui/Skill Icon/Items & Weapon/Guard.png', 24, 24),
    // a smith's: an anvil and a raised hammer (tools/src/art/smith-mark.ts)
    smithMark: ui('lsw/Ui/SmithMark.png', 24, 24),
    // the empty body slots' silhouettes (tools/src/art/equip-slots.ts), a frame each in the runtime's order (EQUIP_SLOT_FRAMES)
    equipSlots: ui('lsw/Ui/EquipSlots.png', 16, 16, { frames: 11, step: 16 }),
    // the dragon of Cinder Peak, in parts (scene.ts composes them round its head): a wing, two body segments, the tail
    dragonWing: ui('Actor/Boss/DragonGreen/Wing.png', 57, 57),
    dragonBody1: ui('Actor/Boss/DragonGreen/Body1.png', 31, 27),
    dragonBody2: ui('Actor/Boss/DragonGreen/Body2.png', 31, 27),
    dragonTail: ui('Actor/Boss/DragonGreen/BodyEnd.png', 29, 40),
    lifebarUnder: ui('Ui/Receptacle/LifeBarMiniUnder.png', 18, 4),
    lifebarProgress: ui('Ui/Receptacle/LifeBarMiniProgress.png', 18, 4),
    // Emote face bubbles emote1..emote30 (14x13), added below as ui['emote<N>'].
  },

  // The music (docs/music.md): a cue per map mood, in its versions for the hour and the weather, and the cues the runtime
  // asks for itself (title, battle, boss, and outdoor/indoor/dark for a map that names none) and the scenes ask for by
  // name. The wilds rest between their pieces (silence and the ambience); a village plays on with short rests. Every
  // file is levelled by its measured loudness (loudness.json, `npm run loudness`).
  music: {
    firstlight_route_night: { tracks: ['own/Audio/Musics/depersonalization-22.ogg'], enterImmediately: true },
    hollow_route_night: { tracks: ['own/Audio/Musics/depersonalization-23.ogg'], enterImmediately: true },
    cloudtop_route: { like: 'cloudtop', ignoreWeather: true, at: { night: 'firstlight_route_night' } },
    firstlight_route: { like: 'firstlight', ignoreWeather: true, at: { night: 'firstlight_route_night' } },
    dawnhill_route: { like: 'field', ignoreWeather: true, at: { night: 'firstlight_route_night' } },
    ford_route: { like: 'ford', ignoreWeather: true, at: { night: 'firstlight_route_night' } },
    woundstone_foot: { like: 'field', ignoreWeather: true, at: { night: 'firstlight_route_night' } },
    dusklea: { like: 'field', ignoreWeather: true, at: { night: 'hollow_route_night' } },
    hushwood: { like: 'forest', ignoreWeather: true, at: { night: 'hollow_route_night' } },
    thornwood_hollow: { like: 'hollow', ignoreWeather: true, at: { night: 'hollow_route_night' } },
    // the title: its own pieces, whatever place shows behind it
    title: { tracks: [M('38 - Intro'), M('22 - Dream')] },
    // waking on Cloudtop: wonder and loneliness in the snow
    cloudtop: { tracks: [M('19 - Ascension'), M('13 - Mystical')], rest: [45, 120], at: { night: 'field_night', storm: 'storm' } },
    // the wilds: a piece now and then, long rests between (Breath of the Wild, Minecraft)
    field: { tracks: [M('31 - Sunny'), M('23 - Road'), M('35 - Adventure')], rest: [60, 150], at: { dawn: 'field_dawn', dusk: 'field_dusk', night: 'field_night', rain: 'field_rain', storm: 'storm' } },
    field_dawn: { tracks: [M('22 - Dream'), M('19 - Ascension')], rest: [45, 110] },
    field_dusk: { tracks: [M('16 - Melancholia'), M('26 - Lost Village')], rest: [50, 120] },
    field_night: { tracks: [M('29 - Lament'), M('30 - Ruins'), M('9 - Quiet')], rest: [90, 200] },
    field_rain: { tracks: [M('16 - Melancholia'), M('7 - Sad Theme')], rest: [60, 140] },
    storm: { tracks: [M('28 - Tension')], rest: [20, 60] },
    // a village: plays on with short rests; its dusk by the fire, its night all but silent
    village: { tracks: [M('33 - Calm Village'), M('36 - Village'), M('4 - Village')], rest: [15, 40], at: { dusk: 'village_dusk', night: 'village_night', rain: 'village_rain', storm: 'village_rain' } },
    // Firstlight's daytime theme on the shared village music table.
    firstlight: { tracks: ['lsw/Audio/Musics/che-shui-ma-long.ogg'], rest: [15, 40], at: { dusk: 'village_dusk', night: 'village_night', rain: 'village_rain', storm: 'village_rain' } },
    village_dusk: { tracks: [M('27 - Chill'), M('6 - Story')], rest: [20, 60] },
    village_night: { tracks: [M('9 - Quiet'), M('22 - Dream')], rest: [120, 260] },
    village_rain: { tracks: [M('27 - Chill'), M('16 - Melancholia')], rest: [30, 80] },
    haven: { tracks: ['lsw/Audio/Musics/che-shui-ma-long.ogg'], rest: [5, 5] },
    // the mill on its brook, the river at the Reed Bend, the Ford
    millbrook: { tracks: [M('31 - Sunny'), M('39 - Boat'), M('33 - Calm Village')], rest: [30, 90], at: { dusk: 'village_dusk', night: 'village_night', rain: 'village_rain', storm: 'village_rain' } },
    river: { tracks: [M('39 - Boat'), M('18 - Aquatic')], rest: [40, 110], at: { dusk: 'river_dusk', night: 'field_night', rain: 'field_rain', storm: 'storm' } },
    river_dusk: { tracks: [M('26 - Lost Village'), M('7 - Sad Theme')], rest: [40, 110] },
    ford: { tracks: [M('26 - Lost Village'), M('39 - Boat')], rest: [40, 110], at: { dusk: 'field_dusk', night: 'field_night', rain: 'field_rain', storm: 'storm' } },
    // the woods: mystery by day, dark after it
    forest: { tracks: [M('11 - Clearing'), M('13 - Mystical')], rest: [50, 130], at: { dusk: 'dark_forest', night: 'dark_forest', rain: 'field_rain', storm: 'storm' } },
    dark_forest: { tracks: [M('37 - Dark Forest')], rest: [40, 120] },
    hollow: { tracks: [M('30 - Ruins'), M('37 - Dark Forest')], rest: [40, 100], at: { night: 'dark_forest', storm: 'storm' } },
    dell: { tracks: [M('30 - Ruins'), M('11 - Clearing')], rest: [50, 120], at: { dusk: 'dark_forest', night: 'dark_forest', rain: 'field_rain', storm: 'storm' } },
    ruins: { tracks: [M('30 - Ruins'), M('14 - Curse')], rest: [40, 100], at: { storm: 'storm' } },
    kneelfield: { tracks: [M('14 - Curse'), M('29 - Lament')], rest: [30, 90], at: { storm: 'storm' } },
    // under a roof: quiet, quieter by night; the shop; the chapel's chant
    interior: { tracks: [M('5 - Peaceful'), M('27 - Chill')], rest: [40, 120], at: { night: 'interior_night' } },
    interior_night: { tracks: [M('9 - Quiet'), M('22 - Dream')], rest: [120, 240] },
    shop: { tracks: [M('20 - Good Time'), M('32 - Manor')], rest: [10, 30] },
    temple: { tracks: [M('12 - Temple'), M('3 - Revelation')], rest: [20, 60] },
    // the dark: caves, the barrow and its crypts, the abbey's hall
    cave: { tracks: [M('2 - The Cave'), M('40 - Crypt')], rest: [30, 90] },
    crypt: { tracks: [M('40 - Crypt'), M('14 - Curse')], rest: [20, 60] },
    barrow_floors: 'own/Audio/Musics/depersonalization-26.ogg',
    dungeon: { tracks: [M('21 - Dungeon'), M('30 - Ruins')], rest: [20, 60] },
    // the world map: the road
    worldmap: { tracks: [M('23 - Road'), M('35 - Adventure')], rest: [10, 30] },
    // a map that names no mood (the backdrop's places, the wilds made from the seed)
    outdoor: { like: 'field' },
    indoor: { like: 'interior' },
    dark: { like: 'cave' },
    // a fight: quick in, held a few seconds past the last blow; darker by night
    battle: { tracks: [M('17 - Fight'), M('34  - Fight')], at: { night: 'battle_night' } },
    battle_night: { tracks: [M('28 - Tension'), M('34  - Fight')] },
    // a boss fight, while the camera holds over the arena (scene.ts frameBossFight); a kind's own, and its later phase
    boss: { tracks: [M('24 - Final Area')] },
    'boss:alberic': { tracks: [M('24 - Final Area')] },
    'boss:alberic:2': { tracks: [M('10 - Dark Castle')] },
    'boss:matthias': { tracks: [M('10 - Dark Castle')] },
    'boss:matthias:2': { tracks: [M('34  - Fight')] },
    // the later Seal-bearers and Astra (docs/chapter-3.md, chapter-4.md, chapter-5.md, finale.md): the weighing's unease,
    // the crypt's dead, the temple's choir, the last hall; each later phase a fight
    'boss:ele': { tracks: [M('13 - Mystical')] },
    'boss:ele:2': { tracks: [M('17 - Fight')] },
    'boss:nacht': { tracks: [M('40 - Crypt')] },
    'boss:nacht:2': { tracks: [M('34  - Fight')] },
    'boss:witnesses': { tracks: [M('12 - Temple')] },
    'boss:witnesses:2': { tracks: [M('19 - Ascension')] },
    'boss:astra': { tracks: [M('24 - Final Area')] },
    'boss:astra:2': { tracks: [M('10 - Dark Castle')] },
    'boss:astra:3': { tracks: [M('28 - Tension')] },
    'boss:dragon': { tracks: ['lsw/Audio/Musics/battle-thrill.ogg'] },
    // the scenes' music (a scene's `music` command)
    severin: { tracks: [M('14 - Curse')] },
    sorrow: { tracks: [M('7 - Sad Theme'), M('29 - Lament')] },
    revelation: { tracks: [M('3 - Revelation')] },
    ending: { tracks: [M('8 - End Theme'), M('25 - End Theme 2')] },
    credits: { tracks: [M('15 - Credit Theme')] },
  },
  noBattleMusic: ['ford', 'meadow', 'meadow.store', 'dawnhill', 'foot', 'summit', 'pasture', 'forest', 'hollow', 'barrow', 'ossuary'],
  noCrickets: ['pasture', 'forest', 'hollow'],
  loudness: LOUDNESS,

  // people with a portrait of their own (docs/character-art.md, docs/cast/): the dialogue's bust in place of their look's
  portraits: {
    'npc.nessa': { dir: 'lsw/Portraits/nessa', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true },
    'npc.lina': { dir: 'lsw/Portraits/lina', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true },
    'npc.ilse': { dir: 'lsw/Portraits/ilse', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true },
    'npc.severin': { dir: 'lsw/Portraits/severin', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true },
    'npc.tobin': { dir: 'lsw/Portraits/tobin', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true },
    'npc.hesper': { dir: 'lsw/Portraits/hesper', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true },
    // (her panel picture in layers too: tools/src/art/portraits/panel-layers.py — her panel flutters her wings and blinks)
    pip: { dir: 'lsw/Portraits/lumi', moods: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'], blink: true, talk: true, panel: true, panelLayers: true },
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
    // the jingles the music steps back for (scene.ts jingle): a level gained, a quest done, a seal's power taken up
    levelup: 'Audio/Jingles/LevelUp1.wav',
    quest: 'Audio/Jingles/Success3.wav',
    boon: 'Audio/Jingles/Secret2.wav',
    error: SND + 'Menu/Cancel.wav',
    death: 'Audio/Jingles/GameOver2.wav',
    // a monster's wind-up and its fall (the kits module's poses, render/scene.ts)
    hop: SND + 'Jump & Bounce/Bounce4.wav',
    howl: SND + 'Voice/Voice4.wav',
    impact: SND + 'Hit & Impact/Impact.wav',
    fell: SND + 'Hit & Impact/Hit1.wav',
  },
}

for (let i = 1; i <= 30; i++) CATALOG.ui['emote' + i] = ui(`Ui/Emote/emote${i}.png`, 14, 13)
// Named emotes (verified visually): '!' , '?', heart, '...' thinking.
Object.assign(CATALOG.ui, {
  emoteExclaim: CATALOG.ui.emote21,
  emoteQuestion: CATALOG.ui.emote23,
  emoteHeart: CATALOG.ui.emote27,
  emoteDots: CATALOG.ui.emote20,
  // the pointer over what the action handles (the runtime's ui/cursor.ts)
  cursorHand: ui('Items/Action/Interact.png', 16, 16),
})

// the portraits' moods, drawn by tools/src/art/faces.ts (npm run art:faces) for every faceset it can read
for (const a of [...Object.values(CATALOG.characters), ...Object.values(CATALOG.creatures)]) {
  const f = a.faceset ? (FACES as Record<string, ActorDef['faces']>)[`${a.dir}/${a.faceset}`] : undefined
  if (f) a.faces = f
}
