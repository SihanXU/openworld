// The legs and the shoes on the map (docs/looks.md §3.1): at 24x36 they are a few cells, so they are not drawn as
// grids but laid on the figure as colour: from the frame's lowest row up, a shoe repaints the feet (the bare skin,
// and the boots an outfit drew) in its colour, tall boots the shins too; stockings repaint the bare skin of the legs
// above the shoes. A long skirt over them leaves no skin to repaint, so they show only where they would.

/** How a legs or shoes part lies on the map: how many rows up from the soles it covers, an adult's and a child's. */
export interface BaseFeet {
  rows: [adult: number, child: number]
  /** A shoe covers whatever is on the feet (skin, an outfit's boots, a tall one the trouser legs); legs only skin. */
  over: 'feet' | 'skin'
}

export const BASE_FEET: Record<string, BaseFeet> = {
  'shoes.boots': { rows: [2, 2], over: 'feet' },
  'shoes.shoes': { rows: [1, 1], over: 'feet' },
  'shoes.buckled': { rows: [1, 1], over: 'feet' },
  'shoes.tall': { rows: [6, 4], over: 'feet' },
  'shoes.sandals': { rows: [1, 1], over: 'skin' },
  'legs.stockings': { rows: [10, 7], over: 'skin' },
  'legs.hose': { rows: [9, 6], over: 'skin' },
  'legs.wraps': { rows: [6, 4], over: 'skin' },
}
