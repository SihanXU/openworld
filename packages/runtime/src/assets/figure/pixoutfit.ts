// The map sprite's outfits (docs/looks.md §3.2): how each paints the figure's regions (t u T torso, r R arms,
// n hands, l L legs, f feet) and what it draws over them per facing and walk frame — skirts, aprons, stoles,
// tabards. Frames 1 and 3 are the steps, the body one row lower. Colours: c C x key 1, d D y key 2, m M z key 3.

import { at, type Grid, type OutfitPix } from './pixgrid.ts'

type Tones = [string, string, string]
const K1: Tones = ['c', 'C', 'x']
const K2: Tones = ['d', 'D', 'y']
const K3: Tones = ['m', 'M', 'z']

/** Paint a template of `c C x` in other tones. */
const tone = (g: Grid, t: Tones): Grid => g.map((r) => r.replace(/c/g, t[0]).replace(/C/g, t[1]).replace(/x/g, t[2]))

/** The four walk frames of a front-and-back grid: standing (frames 0, 2) and stepping (1, 3, one row lower). */
const walk = (stand: Grid, step: Grid): Grid[] => [stand, step, stand, step]

// a skirt to the ankles, the feet showing under it
const SKIRT_DOWN = walk(
  at(22, ['....CCCCCCCC....', '...CCCCCCCCCC...', '...CCCCCCCCCC...', '..xCCCCCCCCCCx..', '..xxCCCCCCCCxx..', '...xxxxxxxxxx...']),
  at(23, ['....CCCCCCCC....', '...CCCCCCCCCC...', '..xCCCCCCCCCCx..', '..xxCCCCCCCCxx..', '...xxxxxxxxxx...']),
)
const SKIRT_SIDE = [
  at(22, ['.....CCCCCC.....', '....CCCCCCCC....', '....CCCCCCCC....', '...xCCCCCCCCx...', '...xxCCCCCCxx...', '....xxxxxxxx....']),
  at(23, ['....CCCCCCCC....', '...CCCCCCCCCC...', '..xCCCCCCCCCCx..', '..xxCCCCCCCCCxx.', '...xxxxxxxxxxx..']),
  at(22, ['.....CCCCCC.....', '....CCCCCCCC....', '....CCCCCCCC....', '...xCCCCCCCCx...', '...xxCCCCCCxx...', '....xxxxxxxx....']),
  at(23, ['....CCCCCCCC....', '...CCCCCCCCCC...', '.xCCCCCCCCCCx...', '.xxCCCCCCCCCxx..', '..xxxxxxxxxxx...']),
]
// a coat's skirts to the knee, the legs showing under them
const HEM_DOWN = walk(at(22, ['....CCCCCCCC....', '...CCCCCCCCCC...', '...xCCCCCCCCx...', '...xxxxxxxxxx...']), at(23, ['....CCCCCCCC....', '...CCCCCCCCCC...', '...xCCCCCCCCx...', '...xxxxxxxxxx...']))
const HEM_SIDE = [
  at(22, ['.....CCCCCC.....', '....CCCCCCC.....', '....xCCCCCCx....', '....xxxxxxxx....']),
  at(23, ['....CCCCCCCC....', '...CCCCCCCCCC...', '...xCCCCCCCCx...', '...xxxxxxxxxx...']),
  at(22, ['.....CCCCCC.....', '....CCCCCCC.....', '....xCCCCCCx....', '....xxxxxxxx....']),
  at(23, ['....CCCCCCCC....', '...CCCCCCCCCC...', '...xCCCCCCCCx...', '...xxxxxxxxxx...']),
]
// a robe's sleeves widening at the hands
const SLEEVES_DOWN = walk(at(20, ['..xCC......CCx..', '..xxx......xxx..']), at(21, ['..xCC......CCx..', '..xxx......xxx..']))

/** Rows shifted one lower (a step frame of a grid drawn for standing). */
const lower = (g: Grid): Grid => ['................', ...g.slice(0, -1)]
/** A grid for standing, and the same one row lower for the steps. */
const bob = (g: Grid): Grid[] => [g, lower(g), g, lower(g)]
/** Several grids laid over each other ('.' lets the one under show). */
const merge = (...gs: Grid[]): Grid => {
  const h = Math.max(...gs.map((g) => g.length))
  return Array.from({ length: h }, (_, y) => {
    const row = [...'................']
    for (const g of gs) [...(g[y] ?? '')].forEach((ch, x) => ch !== '.' && (row[x] = ch))
    return row.join('')
  })
}
const mergeFrames = (...fs: (Grid | Grid[])[]): Grid[] => [0, 1, 2, 3].map((i) => merge(...fs.map((f) => (typeof f[0] === 'string' ? (f as Grid) : (f as Grid[])[i]))))

const CLOTH = (t: Tones, arms: Tones | 'skin', legs: Tones, feet: [string, number]): Record<string, [string, number]> => {
  const key = (x: Tones) => (x === K1 ? 'outfit.1' : x === K2 ? 'outfit.2' : 'outfit.3')
  return {
    t: [key(t), 1], u: [key(t), 0], T: [key(t), 2],
    r: arms === 'skin' ? ['skin', 1] : [key(arms), 1], R: arms === 'skin' ? ['skin', 2] : [key(arms), 2],
    l: [key(legs), 1], L: [key(legs), 2], f: feet,
  }
}
const BOOTS: [string, number] = ['outfit.3', 2]

export const OUTFITS: Record<string, OutfitPix> = {
  'outfit.tunic': {
    regions: CLOTH(K1, K1, K2, BOOTS),
    over: { down: bob(at(22, ['....xCCCCCCx....', '....zzzzzzzz....'])), up: bob(at(22, ['....xCCCCCCx....', '....zzzzzzzz....'])), side: bob(at(22, ['.....xCCCCx.....', '.....zzzzzz.....'])) },
  },
  'outfit.dress': {
    regions: { ...CLOTH(K1, K2, K1, ['outfit.1', 2]) },
    over: { down: mergeFrames(bob(at(17, ['......dddd......'])), SKIRT_DOWN), up: SKIRT_DOWN, side: SKIRT_SIDE },
  },
  'outfit.workdress': {
    regions: { ...CLOTH(K1, K1, K1, ['outfit.3', 2]) },
    over: {
      down: mergeFrames(SKIRT_DOWN, bob(at(17, ['.....d....d.....', '.....dddddd.....', '.....dDDDDd.....', '.....dDDDDd.....', '.....dDDDDd.....', '.....dDDDDd.....', '.....dDDDDd.....', '.....dDDDDd.....', '.....yDDDDy.....', '......yyyy......'])), bob(at(19, ['...nn......nn...']))),
      up: mergeFrames(SKIRT_DOWN, bob(at(22, ['.......yy.......', '......y..y......']))),
      side: mergeFrames(SKIRT_SIDE, bob(at(17, ['..........d.....', '.........dd.....', '........dDd.....', '........dDd.....', '........dDd.....', '........dDDd....', '........dDDDd...', '........dDDDd...', '........yDDDy...', '.........yyy....']))),
    },
  },
  'outfit.shawl': {
    regions: { ...CLOTH(K1, K1, K1, ['outfit.1', 2]) },
    over: {
      down: mergeFrames(SKIRT_DOWN, bob(at(17, ['...dddddddddd...', '..dDDDDDDDDDDd..', '..yDDDDddDDDDy..', '...yyDDDDDDyy...', '......yDDy......', '.......yy.......']))),
      up: mergeFrames(SKIRT_DOWN, bob(at(17, ['...dddddddddd...', '..dDDDDDDDDDDd..', '..yDDDDDDDDDDy..', '...yyDDDDDDyy...', '.....yyDDyy.....', '.......yy.......']))),
      side: mergeFrames(SKIRT_SIDE, bob(at(17, ['....dddddddd....', '...dDDDDDDDDd...', '...yDDDDDDDDDy..', '....yyDDDDDyy...', '......yyyyy.....']))),
    },
  },
  'outfit.oilcloth': {
    regions: CLOTH(K1, K1, K2, ['outfit.2', 2]),
    over: { down: mergeFrames(HEM_DOWN, bob(at(17, ['....xxxxxxxx....', '.......xx.......', '.......xx.......', '.......xx.......', '.......xx.......']))), up: HEM_DOWN, side: HEM_SIDE },
  },
  'outfit.robe': {
    regions: CLOTH(K1, K1, K1, ['outfit.3', 2]),
    over: {
      down: mergeFrames(SKIRT_DOWN, SLEEVES_DOWN, bob(at(17, ['......dddd......', '.......dd.......', '................', '................', '................', '....mmmmmmmm....', '....zMz.........']))),
      up: mergeFrames(SKIRT_DOWN, SLEEVES_DOWN, bob(at(22, ['....mmmmmmmm....']))),
      side: mergeFrames(SKIRT_SIDE, bob(at(17, ['.....dd.........', '................', '................', '................', '................', '.....mmmmmm.....', '........zMz.....']))),
    },
  },
  'outfit.coat': {
    regions: { ...CLOTH(K1, K1, K1, ['outfit.1', 2]), l: ['outfit.1', 2], L: ['outfit.1', 2] },
    over: {
      down: mergeFrames(HEM_DOWN, bob(at(16, ['.....x....x.....', '.....xdddx......', '......dDDd......', '......dmDd......', '......dDDd......', '......dmDd......', '......dDDd......']))),
      up: mergeFrames(HEM_DOWN, bob(at(16, ['....xxxxxxxx....']))),
      side: mergeFrames(HEM_SIDE, bob(at(16, ['........x.......', '.........dd.....', '.........dD.....', '.........mD.....', '.........dD.....']))),
    },
  },
  'outfit.vestment': {
    regions: CLOTH(K1, K1, K1, ['outfit.1', 2]),
    over: {
      down: mergeFrames(SKIRT_DOWN, SLEEVES_DOWN, bob(at(17, ['.....mmmmmm.....', '......D..D......', '......D..D......', '......D..D......', '......D..D......', '......D..D......', '......D..D......', '......D..D......', '......D..D......', '......y..y......']))),
      up: mergeFrames(SKIRT_DOWN, SLEEVES_DOWN, bob(at(17, ['.....mmmmmm.....', '.......DD.......', '.......DD.......', '.......DD.......', '.......yy.......']))),
      side: mergeFrames(SKIRT_SIDE, bob(at(17, ['.......mmmm.....', '.........D......', '.........D......', '.........D......', '.........D......', '.........D......', '.........D......', '.........D......', '.........y......']))),
    },
  },
  'outfit.workshirt': {
    regions: CLOTH(K1, K1, K2, BOOTS),
    over: {
      down: bob(at(17, ['.....D....D.....', '.....D....D.....', '...nnD....Dnn...', '...nnD....Dnn...', '................', '....zzzzzzzz....'])),
      up: bob(at(17, ['......D..D......', '.......DD.......', '...nn..DD..nn...', '...nn..DD..nn...', '................', '....zzzzzzzz....'])),
      side: bob(at(17, ['.......D........', '.......D........', '.......nn.......', '.......nn.......', '................', '.....zzzzzz.....'])),
    },
  },
  'outfit.apron': {
    regions: { ...CLOTH(K2, 'skin', K3, ['outfit.1', 2]) },
    over: {
      down: mergeFrames(bob(at(17, ['.....x....x.....', '.....xCCCCx.....', '.....CCCCCC.....', '.....CccCCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....xCCCCx.....', '......xxxx......']))),
      up: bob(at(17, ['......x..x......', '.......xx.......', '.......xx.......', '.......xx.......', '.......xx.......', '....xxxxxxxx....'])),
      side: bob(at(17, ['.........x......', '........xC......', '........CCC.....', '........CCCC....', '........CCCC....', '........CCCC....', '........CCCC....', '........CCCx....', '........xxx.....'])),
    },
  },
  'outfit.travel': {
    regions: CLOTH(K1, K1, K2, BOOTS),
    over: {
      down: mergeFrames(HEM_DOWN.map((g) => g.map((r, y) => (y > 24 ? '................' : r))), bob(at(17, ['....m...........', '.....m..........', '......m.........', '.......m........', '........m.......', '.........mz.....', '.........zMz....']))),
      up: mergeFrames(HEM_DOWN.map((g) => g.map((r, y) => (y > 24 ? '................' : r))), bob(at(17, ['...........m....', '..........m.....', '.........m......', '........m.......', '.......m........', '....zMz.........']))),
      side: mergeFrames(HEM_SIDE.map((g) => g.map((r, y) => (y > 24 ? '................' : r))), bob(at(17, ['.......m........', '.......m........', '.......m........', '......mm........', '.....zMz........', '.....zzz........']))),
    },
  },
  'outfit.gambeson': {
    regions: { ...CLOTH(K2, K2, K2, BOOTS), L: ['outfit.2', 2], l: ['outfit.2', 2] },
    over: {
      down: bob(at(17, ['.....xCCCCx.....', '......CCCC......', '......CccC......', '......CCCC......', '......CCCC......', '....zzCCCCzz....', '......CCCC......', '......xCCx......'])),
      up: bob(at(17, ['.....xCCCCx.....', '......CCCC......', '......CCCC......', '......CCCC......', '......CCCC......', '....zzCCCCzz....', '......CCCC......', '......xCCx......'])),
      side: bob(at(17, ['.......xCC......', '.......CCC......', '.......CcC......', '.......CCC......', '.......CCC......', '.....zzCCCz.....', '.......CCC......', '.......xCx......'])),
    },
  },
  'outfit.plate': {
    regions: { ...CLOTH(K3, K3, K3, ['outfit.3', 2]) },
    over: {
      down: bob(at(17, ['...MM......MM...', '...mMxCCCCxMm...', '.....CCCCCC.....', '.....CdddCC.....', '.....CCddCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....dCCCCd.....', '......dddd......'])),
      up: bob(at(17, ['...MM......MM...', '...mMxCCCCxMm...', '.....CCCCCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....CCCCCC.....', '.....dCCCCd.....', '......dddd......'])),
      side: bob(at(17, ['.....MM.........', '.....MxCCC......', '.......CCCC.....', '.......CdCC.....', '.......CCCC.....', '.......CCCC.....', '.......CCCC.....', '.......dCCd.....', '........dd......'])),
    },
  },
  'outfit.gi': {
    regions: { ...CLOTH(K1, K1, K1, ['skin', 2]) },
    over: {
      down: bob(at(17, ['.....xx..xx.....', '......xxxx......', '.......xx.......', '................', '................', '....DDDDDDDD....', '.....D....D.....'])),
      up: bob(at(22, ['....DDDDDDDD....'])),
      side: bob(at(17, ['.........x......', '........xx......', '................', '................', '................', '.....DDDDDD.....', '.....D..........'])),
    },
  },
  'outfit.cloak': {
    regions: CLOTH(K2, K1, K2, BOOTS),
    over: {
      down: mergeFrames(bob(at(17, ['...xCCCCCCCCx...', '..xCCCCCCCCCCx..', '..CCCCcddcCCCC..', '..CCCCcddcCCCC..', '..CCCCcDDcCCCC..', '..CCCCcDDcCCCC..', '..xCCCcDDcCCCx..', '...xCCcDDcCCx...', '....xxc..cxx....']))),
      up: bob(at(17, ['...xCCCCCCCCx...', '..xCCCCCCCCCCx..', '..CCCCCCCCCCCC..', '..CCCCCCCCCCCC..', '..CCCCCCCCCCCC..', '..CCCCCCCCCCCC..', '..xCCCCCCCCCCx..', '...xCCCCCCCCx...', '....xCCCCCCx....', '.....xxxxxx.....'])),
      side: bob(at(17, ['....xCCCCCC.....', '...xCCCCCCCC....', '..xCCCCCCCCC....', '..CCCCCCCCcd....', '..CCCCCCCCcd....', '..CCCCCCCCcD....', '..xCCCCCCCcD....', '...xCCCCCCc.....', '....xxxxxx......'])),
    },
  },
  'outfit.adventurer': {
    regions: CLOTH(K1, K1, K2, BOOTS),
    over: {
      down: bob(at(17, ['................', '.....m....m.....', '.....mM..Mm.....', '.....mM..Mm.....', '.....mM..Mm.....', '....zzzMMzzz....'])),
      up: bob(at(17, ['................', '.....mmmmmm.....', '.....mMMMMm.....', '.....mMMMMm.....', '.....mMMMMm.....', '....zzzzzzzz....'])),
      side: bob(at(17, ['................', '......mmmm......', '......mMMM......', '......mMMM......', '......mMMM......', '.....zzzMzz.....'])),
    },
  },
  // children: torso rows 21-24, legs 25-26, feet 27
  'outfit.smock': {
    regions: { ...CLOTH(K1, K1, K2, ['outfit.2', 2]) },
    over: { down: bob(at(24, ['....xCCCCCCx....'])), up: bob(at(24, ['....xCCCCCCx....'])), side: bob(at(24, ['.....xCCCCx.....'])) },
  },
  'outfit.pinafore': {
    regions: { ...CLOTH(K2, K2, K2, ['outfit.1', 2]), l: ['skin', 1], L: ['skin', 2] },
    over: {
      down: bob(at(21, ['.....C....C.....', '.....CCCCCC.....', '.....CccCCC.....', '....CCCCCCCC....', '...xCCCCCCCCx...', '....xxxxxxxx....'])),
      up: bob(at(21, ['......C..C......', '.......CC.......', '.....CCCCCC.....', '....CCCCCCCC....', '...xCCCCCCCCx...', '....xxxxxxxx....'])),
      side: bob(at(21, ['........C.......', '.......CCC......', '......CCCCC.....', '.....CCCCCCC....', '....xCCCCCCCx...', '.....xxxxxxx....'])),
    },
  },
}

export { tone, K1, K2, K3 }
