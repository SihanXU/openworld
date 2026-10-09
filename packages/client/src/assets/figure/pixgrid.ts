// The map sprite's grid types and helpers (docs/looks.md §3.2): see pixparts.ts for the letters.

export type Grid = string[]
export type Facing = 'down' | 'up' | 'side'

export interface HeadPart {
  /** Drawn over the figure, per facing. */
  front?: Partial<Record<Facing, Grid>>
  /** Drawn behind the figure (long hair down the back), per facing. */
  back?: Partial<Record<Facing, Grid>>
}

/** How an outfit paints the figure: a colour key and tone (0 light, 1 mid, 2 shade) per region letter. */
export interface OutfitPix {
  regions: Record<string, [string, number]>
  /** Drawn over the figure per facing: one grid for every walk frame, or one per frame. */
  over?: Partial<Record<Facing, Grid | Grid[]>>
}

export const pad = (n: number): Grid => Array(n).fill('................')
/** Rows set `y` rows down the frame. */
export const at = (y: number, rows: Grid): Grid => [...pad(y), ...rows]
