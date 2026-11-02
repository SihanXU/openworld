// What the advancements' skills lay on the ground (docs/advancement.md, content advancement.ts HAZARDS): a Necromancer's
// miasma, a Trapper's snare, spikes and blast trap, a Pyromancer's wall of flame, a Dawnbringer's holy ground, an
// assassin's caltrops, a Demon Hunter's binding sigil — 16×16, lying flat under whoever walks into them. (The Thornknight's briars are the White
// Knight's own picture.)
//
//   npx tsx games/openworld/tools/src/art/hazards.ts

import { writeIcon } from './png.ts'

const MIASMA = [
  '................',
  '......gg........',
  '....ggGGg..g....',
  '...gGGlGGggGg...',
  '..gGGGGGGGGGGg..',
  '..GGlGGdGGGlGg..',
  '.gGGGGGGGdGGGGg.',
  '.GGdGGGlGGGGdGg.',
  '.gGGGGGGGGlGGGg.',
  '..GGGlGGdGGGGg..',
  '..gGGGGGGGGGGg..',
  '...gGGdGGGlGg...',
  '....ggGGGGgg....',
  '......gggg......',
  '................',
  '................',
]
const SNARE = [
  '................',
  '................',
  '.......oo.......',
  '......orro......',
  '.....or..ro.....',
  '....or....ro....',
  '....r......r....',
  '...or......ro...',
  '...r........r...',
  '...or......ro...',
  '....rr....rr....',
  '.....rrrrrr.....',
  '..p...rRRr...p..',
  '.pPp..rRRr..pPp.',
  '..p....rr....p..',
  '................',
]
const SPIKES = [
  '................',
  '................',
  '..l.....l.....l.',
  '.lsl...lsl...lsl',
  '.sSs...sSs...sSs',
  'osSso.osSso.osSs',
  'oSSSo.oSSSo.oSSS',
  '.ooo...ooo...ooo',
  '.....l.....l....',
  '....lsl...lsl...',
  '....sSs...sSs...',
  '...osSso.osSso..',
  '...oSSSo.oSSSo..',
  '....ooo...ooo...',
  '................',
  '................',
]
const BLAST = [
  '................',
  '................',
  '....oooooooo....',
  '...oSSSSSSSSo...',
  '..oSSssssssSSo..',
  '..oSsRRRRRRsSo..',
  '..oSsRrrrrRsSo..',
  '..oSsRrYYrRsSo..',
  '..oSsRrYYrRsSo..',
  '..oSsRrrrrRsSo..',
  '..oSsRRRRRRsSo..',
  '..oSSssssssSSo..',
  '...oSSSSSSSSo...',
  '....oooooooo....',
  '................',
  '................',
]
const FLAME = [
  '................',
  '.......y........',
  '......yY...y....',
  '..y...YYy.yY....',
  '..Yy.yYOYyYY..y.',
  '.yYYyYOOOYYOy.Yy',
  '.YOOYOORROOOYYOY',
  'yOORROORRRORYOOY',
  'YORRRRRRRRRRRORY',
  'ORRRrRRRrRRRRRRO',
  'RRrrrRRrrrRRrRRR',
  'rrr.rrrr.rrrrrr.',
  '................',
  '................',
  '................',
  '................',
]
const HOLY = [
  '................',
  '.....hhhhhh.....',
  '...hhHHHHHHhh...',
  '..hHH..HH..HHh..',
  '.hH....HH....Hh.',
  '.hH.HHHHHHHH.Hh.',
  'hH......HH....Hh',
  'hH......HH....Hh',
  'hH......HH....Hh',
  'hH......HH....Hh',
  '.hH.....HH...Hh.',
  '.hH....HHHH..Hh.',
  '..hHH..HHHH.HHh.',
  '...hhHHHHHHhh...',
  '.....hhhhhh.....',
  '................',
]
const CALTROPS = [
  '................',
  '................',
  '...l.......l....',
  '..lsl.....lsl...',
  '...s.......s....',
  '.oSsSo...oSsSo..',
  '...o.......o....',
  '................',
  '.......l........',
  '......lsl.......',
  '.......s........',
  '.....oSsSo......',
  '.......o........',
  '................',
  '................',
  '................',
]
const SIGIL = [
  '................',
  '.....gGGGGg.....',
  '...gG......Gg...',
  '..G....vv....G..',
  '.g....vVVv....g.',
  '.G...v.VV.v...G.',
  'gG..v..VV..v..Gg',
  'G..vvvvVVvvvv..G',
  'G...v..VV..v...G',
  'gG...v.VV.v...Gg',
  '.G....vVVv....G.',
  '.g.....vv.....g.',
  '..G..........G..',
  '...gG......Gg...',
  '.....gGGGGg.....',
  '................',
]

writeIcon('Fixtures/Miasma.png', MIASMA, { g: '#9a86b0', G: '#7a5f98', d: '#5a3f78', l: '#b9e07a' })
writeIcon('Fixtures/Snare.png', SNARE, { o: '#3a2a1a', r: '#a6733a', R: '#7a5132', p: '#5a4a32', P: '#878d97' })
writeIcon('Fixtures/Spikes.png', SPIKES, { o: '#2a2830', s: '#878d97', S: '#5a6370', l: '#d4dae2' })
writeIcon('Fixtures/BlastTrap.png', BLAST, { o: '#1e1a18', S: '#47301f', s: '#5a6370', R: '#7a2a24', r: '#a23a3a', Y: '#ffcf5a' })
writeIcon('Fixtures/FlameWall.png', FLAME, { y: '#ffe88a', Y: '#ffc23a', O: '#f08a24', R: '#d4481e', r: '#8a2a14' })
writeIcon('Fixtures/HolyGround.png', HOLY, { h: '#c9a24a', H: '#ffe9a0' })
writeIcon('Fixtures/Caltrops.png', CALTROPS, { o: '#2a2830', s: '#5a6370', S: '#878d97', l: '#c8cbd6' })
writeIcon('Fixtures/BindingSigil.png', SIGIL, { g: '#8a6a2a', G: '#e8c060', v: '#8a5ac8', V: '#e0c8ff' })
console.log('hazards: 8 pictures → public/assets/lsw/Fixtures/')
