// The asset catalogue contract: how the renderer finds every sprite in the Ninja Adventure
// pack (CC0, by Pixel-boy & AAA). Paths are relative to the pack root
// ("assets/ninja-adventure/Ninja Adventure - Asset Pack/"); the copy script mirrors every
// referenced file to packages/client/public/assets/na/<same path>.

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
}

/** Sheets with the pack's standard actor layout. */
export interface ActorDef {
  /** Folder under Actor/ e.g. 'Character/Villager', 'Monster/Slime'. */
  dir: string // full folder path from the pack root, e.g. "Actor/Character/Villager"
  /** Sprite sheet file inside dir (e.g. 'SpriteSheet.png' or 'Slime.png'). */
  sheet: string
  /** 38x38 portrait, if the pack has one. */
  faceset?: string
  /** Columns = directions down, up, left, right; rows = frames. Character sheets: rows 0-3 walk, 4 attack, 5 jump?, 6 special — document what you find. */
  cols: number
  rows: number
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
}

export interface Catalog {
  /**
   * Ground terrains drawn by the renderer's blob autotiler: the top-left tile (col,row)
   * of a 47-tile blob block laid out like TilesetFloor.png cols 0-9 rows 7-11
   * (10x4 block + a 5-tile 5th row). `img` is the tileset file.
   */
  blobs: Record<string, { img: string; col: number; row: number; w?: number; h?: number }>
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
  /**
   * The detail layer (MapData.decor): purely visual sprites the map author places — stones at a
   * cliff's foot, tufts along a path, baskets by a stall. A group's variant is picked per position;
   * `sorted` groups stand up and are y-sorted with actors, the others lie on the ground.
   */
  decor: Record<string, { sorted?: boolean; sprites: SpriteDef[] }>
  /** Buildings and big decorations stamped by the map author. */
  prefabs: Record<string, PrefabDef>
  /**
   * Room wall frames for interiors, drawn nine-slice style: a square block of `size` x `size`
   * tiles at (col,row) in `img` whose outer ring is the wall (corners = 1 tile, edges repeat
   * their middle tile(s)); the inside is transparent (floor shows through).
   */
  rooms: Record<string, { img: string; col: number; row: number; size: number }>
  /** Fixture sprite keys used by the ontology ('fixture:chest', …) -> states. */
  fixtures: Record<string, { base: SpriteDef; open?: SpriteDef; lit?: SpriteDef }>
  /** Item sprite keys used by the ontology ('item:sword', …) -> 16x16 icon. */
  items: Record<string, SpriteDef>
  /** Character looks for NPCs and the player: key -> sheet. */
  characters: Record<string, ActorDef>
  /** NPC role ('farmer', 'guard', …, and 'player') -> character keys that suit it (variety). */
  roles: Record<string, string[]>
  /** Creature sprite keys used by the ontology ('creature:slime', …) + variant -> sheet. */
  creatures: Record<string, ActorDef>
  /** VFX names used by rules ('steam', 'fire_burst', …) + status overlays ('ovl:burning', …). */
  fx: Record<string, FxDef>
  /** UI: dialogue box, faceset box, etc. */
  ui: Record<string, SpriteDef>
  /** Music per map mood and sound effects per event. Paths relative to the pack root. */
  music: Record<string, string>
  sfx: Record<string, string>
}
