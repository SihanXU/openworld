// What grows from a few rules: the paper's Figure 5 (openworld-paper figures/src/fig-spread.html) as stars. Three
// base rules, the events they set off on a stormy day at the Ford, and where no rule answered, the model's rule.
// Positions are the figure's (960 x 700); `touch` names the world's stars each one is about.

export const ROOTS = {
  storm: { x: 72, y: 100, name: 'the storm', icon: 'bolt', code: ['world.on(storm) {', '  lightning(); rain() }'], touch: ['rule:world/clocks', 'map:ford'] },
  fire: { x: 72, y: 345, name: 'fire', icon: 'flame', code: ['thing.on(fire) {', '  if (flammable) burn() }'], touch: ['rule:core/element'] },
  seen: { x: 72, y: 565, name: 'being seen', icon: 'eye', code: ['person.on(seen, x) {', '  judge(x); tell(x) }'], touch: ['rule:people/see', 'map:meadow'] },
}

export const EVENTS = {
  tree: { x: 235, y: 42, pic: 'tree', c: [96, 176, 180], text: 'lightning sets\nthe dead tree alight', touch: ['type:fixture/nature/dead_tree', 'map:ford'] },
  camp: { x: 235, y: 172, pic: 'campfire', c: [96, 160, 110], text: 'rain soaks\nHesper’s campfire', touch: ['npc:npc.hesper'] },
  theft: { x: 235, y: 470, pic: 'theft', c: [128, 114, 140], text: 'Holt sees Vigo take\nMarta’s bread', touch: ['npc:npc.holt', 'npc:npc.vigo'] },
  marta: { x: 240, y: 640, pic: 'marta', c: [96, 112, 120], text: 'Marta saw it too', touch: ['npc:npc.marta'] },
  fallen: { x: 400, y: 38, pic: 'fallen', c: [96, 160, 150], text: 'the burnt tree falls\nacross the narrows', touch: ['map:ford'] },
  grass: { x: 400, y: 172, pic: 'grass', c: [96, 174, 150], text: 'sparks catch\nthe dry grass', touch: ['type:item/material/grass'] },
  hesper: { x: 360, y: 318, pic: 'hesper', c: [124, 116, 140], text: 'Hesper can’t\ntend her fire', model: ['person.on(stuck) {', '  wait_by(fire) }'], touch: ['npc:npc.hesper'] },
  bounty: { x: 400, y: 462, pic: 'bounty', c: [96, 160, 100], text: 'a bounty of\n5 coins on Vigo', touch: ['npc:npc.vigo'] },
  pell: { x: 400, y: 632, pic: 'tellPell', c: [128, 114, 140], text: 'she tells Pell', touch: ['npc:npc.pell'] },
  out: { x: 565, y: 108, pic: 'out', c: [96, 164, 150], text: 'the rain\nputs it out', touch: [] },
  hay: { x: 565, y: 232, pic: 'haystack', c: [96, 140, 140], text: 'the haystack\ncatches fire', touch: ['type:fixture/nature/haystack'] },
  cells: { x: 565, y: 470, pic: 'cells', c: [96, 170, 120], text: 'Vigo can’t pay:\nto the cells', touch: ['npc:npc.vigo'] },
  gus: { x: 565, y: 640, pic: 'tellGus', c: [128, 114, 140], text: 'Pell tells Gus', touch: ['npc:npc.gus'] },
  slime: { x: 735, y: 195, pic: 'slime', c: [104, 164, 120], text: 'the fire reaches\na fire slime', model: ['fire_slime.on(fire) {', '  grow() }'], touch: ['type:actor/creature/slime/fire_slime'] },
  lit: { x: 670, y: 318, pic: 'lit', c: [96, 154, 110], text: 'it dries; she\nlights it again', touch: ['npc:npc.hesper'] },
  wood: { x: 700, y: 410, pic: 'woodpile', c: [96, 140, 140], text: 'the woodpile\ncatches fire', touch: ['type:fixture/container/woodpile'] },
  back: { x: 768, y: 505, pic: 'back', c: [96, 112, 120], text: 'Marta gets her bread back', touch: ['npc:npc.marta'] },
  shun: { x: 730, y: 640, pic: 'gus', c: [96, 112, 120], text: 'Gus shuns Vigo', touch: ['npc:npc.gus'] },
  fence: { x: 868, y: 150, pic: 'fence', c: [96, 168, 170], text: 'the grown slime\nlights the fence', touch: ['type:fixture/fence'] },
  cows: { x: 868, y: 290, pic: 'cows', c: [120, 174, 150], text: 'the cows\nget out', touch: ['type:actor/creature/animal/cow'] },
  douse: { x: 828, y: 410, pic: 'douse', c: [124, 116, 140], text: 'Gus douses it', touch: ['npc:npc.gus'] },
  herd: { x: 890, y: 565, pic: 'herd', c: [124, 116, 140], text: 'Holt sees them,\nherds them home', touch: ['npc:npc.holt'] },
}

// a rule's reach (root to event) and one event's outcome setting off another
export const LINKS = [
  ['storm', 'tree'], ['storm', 'camp'], ['storm', 'out'],
  ['fire', 'tree'], ['fire', 'grass'], ['fire', 'hay'], ['fire', 'wood'],
  ['seen', 'theft'], ['seen', 'marta'], ['seen', 'herd'],
  ['tree', 'fallen'], ['tree', 'grass'], ['grass', 'out'], ['grass', 'hay'], ['camp', 'hesper'], ['hesper', 'lit'],
  ['hay', 'slime'], ['slime', 'fence'], ['fence', 'cows'], ['wood', 'douse'], ['cows', 'herd'],
  ['theft', 'bounty'], ['bounty', 'cells'], ['cells', 'back'], ['marta', 'back'], ['marta', 'pell'], ['pell', 'gus'], ['gus', 'shun'], ['gus', 'douse'],
]

// The film's opening (starmap.js): when each event opens out of its star and closes back into it, how large, and what
// it shows (a clip from clips/, else the figure's picture). The first are watched, full screen or large, with the
// figure's words under them; the rest come faster and smaller, several at once, then only flash. `from` is the star
// a spark flies from to light it (an event that begins a chain of its own has none).
//   size: full (the whole screen), big, mid, flash
export const OPENING = [
  { id: 'tree', size: 'full', open: 0, close: 3.5, clip: 'tree', words: true },
  { id: 'camp', size: 'big', from: 'tree', open: 4.1, close: 6.7, clip: 'camp', words: true },
  { id: 'theft', size: 'big', open: 7.0, close: 9.8, clip: 'theft', words: true },
  { id: 'hesper', size: 'big', from: 'camp', open: 10.2, close: 13.4, clip: 'hesper', card: true },
  { id: 'grass', size: 'mid', from: 'tree', open: 11.2, close: 12.6, clip: 'grass' },
  { id: 'bounty', size: 'mid', from: 'theft', open: 12.0, close: 13.4, clip: 'bounty' },
  { id: 'fallen', size: 'flash', from: 'tree', open: 12.4, close: 13.0 },
  { id: 'hay', size: 'mid', from: 'grass', open: 12.9, close: 14.2, clip: 'hay' },
  { id: 'marta', size: 'mid', from: 'theft', open: 13.2, close: 14.4, clip: 'marta' },
  { id: 'out', size: 'mid', from: 'grass', open: 13.5, close: 14.7, clip: 'out' },
  { id: 'lit', size: 'mid', from: 'hesper', open: 13.8, close: 15.0, clip: 'lit' },
  { id: 'cells', size: 'mid', from: 'bounty', open: 14.0, close: 15.1, clip: 'cells' },
  { id: 'slime', size: 'mid', from: 'hay', open: 14.3, close: 15.4, clip: 'slime' },
  { id: 'pell', size: 'mid', from: 'marta', open: 14.5, close: 15.6, clip: 'pell' },
  { id: 'wood', size: 'flash', from: 'hay', open: 14.9, close: 15.5 },
  { id: 'fence', size: 'flash', from: 'slime', open: 15.2, close: 15.8 },
  { id: 'back', size: 'flash', from: 'cells', open: 15.3, close: 15.9 },
  { id: 'cows', size: 'flash', from: 'fence', open: 15.5, close: 16.0 },
  { id: 'gus', size: 'flash', from: 'pell', open: 15.6, close: 16.1 },
  { id: 'herd', size: 'flash', from: 'cows', open: 15.8, close: 16.3 },
  { id: 'douse', size: 'flash', from: 'wood', open: 15.9, close: 16.4 },
  { id: 'shun', size: 'flash', from: 'gus', open: 16.0, close: 16.5 },
]
