// The asset catalogue contract: how the renderer finds every sprite in the Ninja Adventure
// pack (CC0, by Pixel-boy & AAA). Paths are relative to the pack root
// ("assets/ninja-adventure/Ninja Adventure - Asset Pack/"); the copy script mirrors every
// referenced file to games/openworld/public/assets/na/<same path>, and the editor copies a pack
// file a project takes to its assets/na/. A path that begins with `lsw/` or `own/` is the game's
// own art instead, under its assets/ (`own/`: what the editor imports).

import type { Mood } from '@openworld/engine'
import type { ReliefPalette } from './relief.ts'

/** A rectangle in an image, in pixels, plus the anchor that sits on the entity's tile. */
export interface SpriteDef {
  img: string
  x: number
  y: number
  w: number
  h: number
  /**
   * Anchor inside the rect (pixels from the rect's top-left) that is placed at the
   * BOTTOM-CENTRE of the tile the thing occupies. A 16x16 tile-sized sprite: ax=8, ay=16.
   * A 32x32 round tree whose trunk base sits in the tile: e.g. ax=16, ay=30.
   */
  ax: number
  ay: number
  /** Animation: `frames` frames laid out horizontally every `step` px (default w). */
  frames?: number
  step?: number
  fps?: number
}

/**
 * How a weapon is seen in the striker's hand for a moment (scene.ts swingWeapon): `sweep`, swept in an arc across the
 * way they face, its picture's point up (a sword); `shoot`, raised, drawn and loosed, its picture pointing up-left (a
 * bow); `point`, raised overhead and brought down to point, its head glinting (a staff). None: the blow alone shows.
 */
export type Swing = 'sweep' | 'shoot' | 'point'

/** An item's icon, and a weapon's swing. */
export interface ItemSpriteDef extends SpriteDef {
  swing?: Swing
}

/** The body slots in the order of the frames of the catalogue's `ui.equipSlots` strip (a second ring is a ring). */
export const EQUIP_SLOT_FRAMES: readonly string[] = ['ear', 'head', 'neck', 'shoulders', 'body', 'hands', 'ring', 'waist', 'weapon', 'feet', 'arm']

/**
 * A multi-tile structure stamped onto the map (houses, big decorations). The image covers
 * `tw` x `th` tiles; `grid` has one string per tile row with one char per tile:
 *   '#' solid (blocks movement)   '.' free (drawn, walkable — e.g. roof overhang shadow)
 *   'D' the door (walkable; the engine puts a portal here)   ' ' nothing (transparent)
 */
export interface PrefabDef {
  img: string
  x: number
  y: number
  tw: number
  th: number
  grid: string[]
  /** Terrain id the solid cells get in the engine (default 'wall'). */
  terrain?: string
  /** Drawn as ground (under whoever stands on it: a pool one wades into), not as a wall in front of them. */
  ground?: boolean
  /**
   * The grid row it is drawn at the depth of, if not its last solid one: a strip of a building (one footprint row of it,
   * the picture over it as tall as what is seen of the row) whose row may be walked under (an arcade, a gateway).
   */
  base?: number
  /** Drawn in front of whoever stands in its base row (an arcade, a gateway one walks under), not behind them. */
  front?: boolean
}

/** A named animation strip, with its original frame size and cadence. */
export interface ActorClipDef {
  sheet: string
  frames: number
  frameWidth: number
  frameHeight: number
  frameMs: number
  loop: boolean
}

/** Sheets with the pack's standard actor layout, or named animation strips. */
export interface ActorDef {
  /** Folder under Actor/ e.g. 'Character/Villager', 'Monster/Slime'. */
  dir: string // full folder path from the pack root, e.g. "Actor/Character/Villager"
  /** Sprite sheet file inside dir (e.g. 'SpriteSheet.png' or 'Slime.png'). */
  sheet: string
  /** 38x38 portrait, if the pack has one. */
  faceset?: string
  /** The portrait's moods (tools/src/art/faces.ts): a strip of the faceset and then each of `moods`. */
  faces?: { strip: string; moods: Mood[] }
  /** Columns = directions down, up, left, right; rows = frames. Character sheets: rows 0-3 walk, 4 attack, 5 jump?, 6 special — document what you find. */
  cols: number
  rows: number
  /** Nonstandard action atlases may keep transparent space below their feet. */
  anchorY?: number
  /** Horizontal foot pivot from the original frame's left edge; default is its centre. */
  anchorX?: number
  /** Separate, untrimmed animation sheets inside dir. The base sheet supplies the rest pose. */
  clips?: Record<string, ActorClipDef>
  /** The row a person stands in when not walking (a figure's sheet: the walk's four rows, then this one); default 0. */
  idleRow?: number
  /** World-space scale of the original pixel atlas, independent of camera zoom. */
  scale?: number
  /** Optional tint (0xRRGGBB) to recolour a monster for an element variant. */
  tint?: number
}

export interface FxDef {
  img: string
  /** frame size and count (frames laid out horizontally unless `vertical`). */
  fw: number
  fh: number
  frames: number
  fps: number
  vertical?: boolean
  /** Draw additively (fire, sparks, magic). */
  add?: boolean
  scale?: number
  /** Ground contact inside a generated effect; default is its center. */
  originY?: number
  /** Instantaneous directional beam, stretched over the encounter's locked line at release. */
  beam?: boolean
}

export interface Catalog {
  /**
   * Ground terrains drawn by the renderer's blob autotiler: the top-left tile (col,row)
   * of a 47-tile blob block laid out like TilesetFloor.png cols 0-9 rows 7-11
   * (10x4 block + a 5-tile 5th row). `img` is the tileset file. `edgeOn`: the terrains its
   * edge pieces are drawn against (what their outside pixels show, grass for a block on grass);
   * beside anything else the block runs on as itself. Without it, an edge against every other ground.
   */
  blobs: Record<string, { img: string; col: number; row: number; w?: number; h?: number; edgeOn?: string[] }>
  /** Plain ground tiles (variants chosen per position): terrain -> list of [img, col, row]. */
  plain: Record<string, [string, number, number][]>
  /** Small decals scattered on plain ground for variety (flowers, pebbles, leaves). */
  decals: Record<string, SpriteDef[]>
  /**
   * Terrain-driven objects: a terrain id whose tiles each render one of these sprites on top
   * of the ground (tree, pine, bush, rock, stump, charred_tree, drygrass tufts, flowers…).
   * The renderer picks a variant per position.
   */
  terrainObjects: Record<string, SpriteDef[]>
  /** Buildings and cliffs stamped by the map author: the look of the terrain under them. */
  prefabs: Record<string, PrefabDef>
  /**
   * Room wall frames for interiors, drawn nine-slice style: a square block of `size` x `size`
   * tiles at (col,row) in `img` whose outer ring is the wall (corners = 1 tile, edges repeat
   * their middle tile(s)); the inside is transparent (floor shows through).
   */
  rooms: Record<string, { img: string; col: number; row: number; size: number }>
  /**
   * The rock of the relief (MapData.heights; assets/relief.ts paints its faces, rims and stairs) by the region a map
   * lies in, `*` for any other. None: the runtime's slate.
   */
  relief?: Record<string, ReliefPalette>
  /** Fixture sprite keys used by the ontology ('fixture:chest', …) -> states. */
  /**
   * Fixtures by sprite key. `variants`: looks picked per thing (by its id); `ground`: drawn flat
   * on the ground, under whatever stands there; `loose`: set a little off the grid, never in rows.
   */
  fixtures: Record<string, { base: SpriteDef; open?: SpriteDef; lit?: SpriteDef; variants?: SpriteDef[]; ground?: boolean; loose?: boolean; /** its picture turned east or west (a fence running north-south) */ across?: SpriteDef }>
  /** Item sprite keys used by the ontology ('item:sword', …) -> 16x16 icon; a weapon's, how it is seen as it strikes (`swing`). */
  items: Record<string, ItemSpriteDef>
  /** Character looks for NPCs and the player: key -> sheet. */
  characters: Record<string, ActorDef>
  /** NPC role ('farmer', 'guard', …, and 'player') -> character keys that suit it (variety). */
  roles: Record<string, string[]>
  /** Creature sprite keys used by the ontology ('creature:slime', …) + variant -> sheet. */
  creatures: Record<string, ActorDef>
  /** VFX names used by rules ('steam', 'fire_burst', …) + status overlays ('ovl:burning', …). */
  fx: Record<string, FxDef>
  /**
   * UI: dialogue box, faceset box, etc. Some keys the runtime looks for: `<tag>Mark`, a sign drawn over the head of
   * anyone with that tag (a trainer's crossed blades: `trainerMark`); `equipSlots`, a strip of the empty body slots'
   * silhouettes, a frame each (every `step` px, default `w`) in the order of EQUIP_SLOT_FRAMES (none: a glyph each);
   * `cursorHand` and `emoteDots`, the pointer over what the hand (E) picks up or handles and over someone to talk
   * to (none: the arrow).
   */
  ui: Record<string, SpriteDef>
  /**
   * The music (docs/music.md): cues by name — a map's mood (MapData.music), and the names the runtime asks for itself:
   * `title`, `battle`, `boss` (`boss:<kind>` for one kind, `boss:<kind>:<phase>` for its later phases), and `outdoor`,
   * `indoor`, `dark` for a map that names no mood. A cue is a file, or a MusicCue. Paths relative to the pack root.
   */
  music: Record<string, string | MusicCue>
  /** Each music file's measured loudness (integrated LUFS, `npm run loudness`): every piece is played as loud as the rest. */
  loudness?: Record<string, number>
  sfx: Record<string, string>
  /**
   * People with a portrait of their own (docs/character-art.md), by person id: the dialogue shows it in place of the bust their look
   * composes. None: everyone's portrait is their look's.
   */
  portraits?: Record<string, PortraitSet>
}

/**
 * A person's own portrait: a square bust per mood, transparent (`<dir>/<mood>.webp`, `neutral` always), drawn so every picture of the set
 * lines up to the pixel; where the set has them, each mood's blink (`<mood>-blink.webp`) and its mouth open in a word (`<mood>-talk.webp`).
 */
export interface PortraitSet {
  /** The folder under the game's assets (`lsw/Portraits/<person>`). */
  dir: string
  /** The moods it has a picture for; any other is shown as `neutral`. */
  moods: Mood[]
  /** Every mood of `moods` has its blink. */
  blink?: boolean
  /** Every mood of `moods` has its open mouth. */
  talk?: boolean
  /** Every mood of `moods` has a wider picture for a panel of the game's own (`<mood>-panel.webp`: the figure with what spreads beside it, a fairy's wings). */
  panel?: boolean
}

/** When in the day and the weather a cue may have a version of its own for (MusicCue.at). */
export type MusicMoment = 'dawn' | 'day' | 'dusk' | 'night' | 'rain' | 'storm' | 'snow' | 'fog'

/**
 * A piece of the music system: what it plays and how. Pieces with `rest` play once and leave silence after them, the
 * ambience alone (the wilds' music in Breath of the Wild, Minecraft); without, they follow one another without end.
 */
export interface MusicCue {
  /** The pieces, played in a shuffled order that never plays the same one twice running. */
  tracks?: string[]
  /** Another cue it is the same as (a mood that sounds like another). */
  like?: string
  /** Seconds of silence after each piece, [least, most]. */
  rest?: [number, number]
  /** How loud against the others, 0–1 (default 1). */
  volume?: number
  /** Its versions by the hour and the weather: the cue played instead (the weather's first, then the hour's). */
  at?: Partial<Record<MusicMoment, string>>
}

/** The structure sheets (the project's own art, in the game's assets/lsw/): walls, floors and stairs are drawn from them by their neighbours. */
export const LSW_WALL = 'lsw/Structures/wall.png'
export const LSW_FLOOR = 'lsw/Structures/floor.png'
export const LSW_STAIRS = 'lsw/Structures/stairs.png'
