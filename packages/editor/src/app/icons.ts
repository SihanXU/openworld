// The editor's own icons: small pixel pictures, drawn here as character grids ("k" ink, "a" half ink, "." none) in
// the manner of the game's 16x16 pack, which has none for an editor's tools. Shown as a CSS mask, so an icon takes
// the colour of the text around it (a chosen tool's dark on its light ground).

export type IconName =
  | 'select' | 'brush' | 'erase' | 'pick' | 'stamp' | 'mark'
  | 'free' | 'rect' | 'ellipse' | 'fill'
  | 'undo' | 'redo' | 'play' | 'more'

export const ICONS: Record<IconName, string[]> = {
  select: [
    'kk.kk.kk.kk.',
    'k..........k',
    '............',
    'k..........k',
    'k..........k',
    '............',
    '............',
    'k..........k',
    'k..........k',
    '............',
    'k..........k',
    '.kk.kk.kk.kk',
  ],
  brush: [
    '..........kk',
    '.........kkk',
    '........kkk.',
    '.......kkk..',
    '......kkk...',
    '.....kkk....',
    '....aak.....',
    '...aaaa.....',
    '..aaaa......',
    '.aaaa.......',
    'aaaa........',
    'aa..........',
  ],
  erase: [
    '............',
    '......kkkk..',
    '.....kaaaak.',
    '....kaaaaak.',
    '...kaaaaak..',
    '..kkkkaak...',
    '.k...kkk....',
    'k...kk......',
    'k..kk.......',
    '.kkk........',
    '............',
    'kkkkkkkkkk..',
  ],
  pick: [
    '.........kk.',
    '........kkkk',
    '.......kkkkk',
    '......kakkk.',
    '.....kak.k..',
    '....kak.....',
    '...kak......',
    '..kak.......',
    '.kak........',
    '.kk.........',
    'k...........',
    '............',
  ],
  stamp: [
    '....kkkk....',
    '....kaak....',
    '....kaak....',
    '....kaak....',
    '.....kk.....',
    '.....kk.....',
    '.kkkkkkkkkk.',
    'kaaaaaaaaaak',
    'kaaaaaaaaaak',
    'kkkkkkkkkkkk',
    '............',
    '.kkkkkkkkkk.',
  ],
  mark: [
    '.k..........',
    '.kkkkkkk....',
    '.kaaaaaakk..',
    '.kaaaaaaaak.',
    '.kaaaaaakk..',
    '.kkkkkkk....',
    '.k..........',
    '.k..........',
    '.k..........',
    '.k..........',
    '.k..........',
    'kkk.........',
  ],
  free: [
    '............',
    '..........k.',
    '.........k..',
    '........k...',
    '..kk...k....',
    '.k..k.k.....',
    'k....k......',
    '............',
    '............',
    '............',
    '............',
    '............',
  ],
  rect: [
    '............',
    '.kkkkkkkkkk.',
    '.k........k.',
    '.k........k.',
    '.k........k.',
    '.k........k.',
    '.k........k.',
    '.k........k.',
    '.kkkkkkkkkk.',
    '............',
    '............',
    '............',
  ],
  ellipse: [
    '............',
    '....kkkk....',
    '..kk....kk..',
    '.k........k.',
    'k..........k',
    'k..........k',
    '.k........k.',
    '..kk....kk..',
    '....kkkk....',
    '............',
    '............',
    '............',
  ],
  fill: [
    '....k.......',
    '...kak......',
    '..kaaak.....',
    '.kaaaaak....',
    'kaaaaaaak...',
    '.kaaaaak..a.',
    '..kaaak..aa.',
    '...kak...aa.',
    '....k...aaa.',
    '........aaa.',
    '.........a..',
    '............',
  ],
  undo: [
    '............',
    '...k........',
    '..kk........',
    '.kkkkkkkk...',
    '..kk.....k..',
    '...k......k.',
    '..........k.',
    '..........k.',
    '.........k..',
    '....kkkkk...',
    '............',
    '............',
  ],
  redo: [
    '............',
    '........k...',
    '........kk..',
    '...kkkkkkkk.',
    '..k.....kk..',
    '.k......k...',
    '.k..........',
    '.k..........',
    '..k.........',
    '...kkkkk....',
    '............',
    '............',
  ],
  play: [
    '............',
    '..k.........',
    '..kkk.......',
    '..kaakk.....',
    '..kaaaakk...',
    '..kaaaaaakk.',
    '..kaaaaaakk.',
    '..kaaaakk...',
    '..kaakk.....',
    '..kkk.......',
    '..k.........',
    '............',
  ],
  more: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '.kk..kk..kk.',
    '.kk..kk..kk.',
    '............',
    '............',
    '............',
    '............',
    '............',
  ],
}

const urls = new Map<string, string>()

/**
 * An icon's grid as a picture `size` px square, each cell a whole number of pixels where the size allows (crisp,
 * never smoothed): ink opaque, half ink at half alpha (a mask: only alpha counts).
 */
function urlOf(name: IconName, size: number): string {
  const key = `${name}@${size}`
  const had = urls.get(key)
  if (had) return had
  const grid = ICONS[name]
  const n = grid.length
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const at = (i: number) => Math.round((i * size) / n)
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return
    g.fillStyle = ch === 'k' ? '#000' : 'rgba(0,0,0,0.45)'
    g.fillRect(at(x), at(y), at(x + 1) - at(x), at(y + 1) - at(y))
  }))
  const url = c.toDataURL()
  urls.set(key, url)
  return url
}

/** An icon, as markup: a crisp square of `size` px in the colour of its text. */
export function icon(name: IconName, size = 24): string {
  return `<span class="px-ic" aria-hidden="true" style="width:${size}px;height:${size}px;--ic:url(${urlOf(name, size)})"></span>`
}
