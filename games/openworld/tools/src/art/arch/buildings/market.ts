// The Market (docs/showcase.md §4.4): Bruges's Markt and Florence's loggias, the halls of Ypres — rows of stalls under
// striped canvas, each a trade's (fruit, bread, fish, cloth, pots, candles, herbs, meat), the market hall with its open
// arcade and the guild's room over it, the weigh-house with the city's great balance (where the Black Steward's scales
// are kept), the market cross.

import type { Model } from '../oblique.ts'
import { archNS, box, drum, hip, spire, type Solid } from '../shapes.ts'
import { hall, S, stall } from '../kit.ts'

/** What lies on each stall's counter: rows of goods' keys (kit GOODS_KEYS). */
const WARES: Record<string, { canvas: Parameters<typeof stall>[0]['canvas']; goods: string[] }> = {
  fruit: { canvas: 'canvasRed', goods: [' r g r o g r ', 'rRgGrRoGgRrG', 'RRGGRRGGRRGG'] },
  bread: { canvas: 'canvasYellow', goods: [' bb  bbb bb ', 'bBBbbBBbbBBb', 'BBBBBBBBBBBB'] },
  fish: { canvas: 'canvasBlue', goods: [' ff  ff  ff ', 'fFFfFFfFFfFF', 'wwwwwwwwwwww'] },
  cloth: { canvas: 'canvasGreen', goods: [' ccc  CCC u ', 'cccCCCCuuuww', 'cccCCCCuuuww'] },
  pots: { canvas: 'canvasPlain', goods: [' pp  P  pp  ', 'pPPpPPPpPPpP', 'PPPPPPPPPPPP'] },
  candles: { canvas: 'canvasYellow', goods: [' y y y y y y', ' w w w w w w', 'wwwwwwwwwwww'] },
  herbs: { canvas: 'canvasGreen', goods: [' g G g G g G', 'gGgGgGgGgGgG', 'BBBBBBBBBBBB'] },
  meat: { canvas: 'canvasRed', goods: [' R  R  R  R ', 'rRRrRRrRRrRR', 'wwwwwwwwwwww'] },
}

/** The weigh-house: a little hall under a hipped roof, open to the square on its south side, the great balance in it. */
function weighHouse(): Model {
  const W = 5 * S
  const D = 4 * S
  const solids: Solid[] = [
    box(0, 0, 0, W, 6, 56, 'stone'),
    box(0, 0, 0, 6, D, 56, 'stone'),
    box(W - 6, 0, 0, W, D, 56, 'stone'),
    box(0, D - 6, 44, W, D, 56, 'stone'),
    hip(-4, -4, W + 4, D + 4, 56, 30, 'tile'),
    // the balance: its post, its beam, its pans
    box(W / 2 - 2, D / 2 - 2, 0, W / 2 + 2, D / 2 + 2, 40, 'timber'),
    box(W / 2 - 22, D / 2 - 1, 38, W / 2 + 22, D / 2 + 1, 41, 'iron'),
    drum(W / 2 - 20, D / 2, 8, 14, 17, 'gold'),
    drum(W / 2 + 20, D / 2, 8, 18, 21, 'gold'),
  ]
  const voids: Solid[] = [archNS(W / 2, D - 7, D + 1, 0, W - 18, 44, 'round')]
  return { name: 'market_weigh', footprint: ['#####', '#...#', '#...#', '#...#'], solids, voids, ornaments: [] }
}

/** The market cross: a stepped base, a shaft, a lantern head under a little spire. */
function marketCross(): Model {
  const W = 2 * S
  const c = W / 2
  const solids: Solid[] = [
    box(1, 1, 0, W - 1, W - 1, 6, 'stone'),
    box(5, 5, 6, W - 5, W - 5, 12, 'stone'),
    box(c - 3, c - 3, 12, c + 3, c + 3, 64, 'stone'),
    box(c - 6, c - 6, 64, c + 6, c + 6, 76, 'stone'),
    spire(c, c, 7, 76, 22, 8, 'stone'),
  ]
  return { name: 'market_cross', footprint: ['##', '##'], solids, voids: [], ornaments: [] }
}

export const MARKET: Record<string, () => Model> = {
  ...Object.fromEntries(Object.entries(WARES).map(([k, v]) => [`market_stall_${k}`, () => stall({ name: `market_stall_${k}`, ...v })])),
  market_hall: () => hall({ name: 'market_hall', w: 16, d: 8, wall: 'stone', roof: 'tile', storeys: 2, storeyH: 44, ridge: 'x', doors: [7, 8], doorKind: 'round', windows: 'round', arcade: true, timber: false, bell: true, chimneys: [3, 12], seed: 61 }),
  market_weigh: weighHouse,
  market_cross: marketCross,
  market_arcade: () => hall({ name: 'market_arcade', w: 14, d: 5, wall: 'plasterOchre', roof: 'tile', storeys: 2, storeyH: 30, ridge: 'x', doors: [6], windows: 'rect', timber: true, plinth: 'stone', arcade: true, sign: 'cloth', seed: 62 }),
}

