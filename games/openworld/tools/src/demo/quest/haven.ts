// The Held Ground (誓守之地, docs/chapter-1.md §12; content haven.ts): the camp the Oath-Thorn opens. A field round a
// planted sword, Alberic's tent and post beside it, a little tilled earth (no beasts: they are bought, crated, at the stall), a pond — and
// three rings of mist, each lifting when the steward widens the ground. Beyond each ring there is more: a grove and
// stones, then a meadow and water, then the old boundary stones and iron in the rock. It lies nowhere on the overworld.

import { HAVEN, HAVEN_UPGRADES } from '@openworld-game/content'
import { MapBuilder } from '../builder.ts'
import { L, GROUND_YIELD, appears } from '../kit.ts'


export function buildHaven(): MapBuilder {
  const m = new MapBuilder(HAVEN.map, L('The Held Ground', '誓守之地'), 'village', HAVEN.w, HAVEN.h, 'grass', 'haven', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  const [hx, hy] = HAVEN.heart
  const dist = (x: number, y: number) => Math.hypot(x - hx, (y - hy) * 1.15)
  // the edge of everything: old trees, two deep
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) if (Math.min(x, y, m.w - 1 - x, m.h - 1 - y) < 2) m.set(x, y, 'tree')
  // beyond the first ring: a grove and loose stone; beyond the second: a meadow and water; beyond the third: iron in the rock
  for (let y = 2; y < m.h - 2; y++)
    for (let x = 2; x < m.w - 2; x++) {
      const d = dist(x, y)
      if (d > HAVEN.rings[0] + 1.5 && d < HAVEN.rings[1] - 1 && (x * 7 + y * 13) % 9 === 0) m.set(x, y, 'tree')
      if (d > HAVEN.rings[1] + 1.5 && d < HAVEN.rings[2] - 1 && (x * 5 + y * 3) % 7 === 0) m.set(x, y, 'flowers')
    }
  m.organic(hx + 14, hy - 3, 3.2, 2.2, 'water', { only: (t) => t === 'grass' || t === 'flowers' })
  // its middle is deep: pike bite there (homestead.ts)
  m.organic(hx + 14, hy - 3, 1.4, 0.9, 'deepwater', { only: (t) => t === 'water' })
  for (const [x, y] of [[hx - 19, hy - 8], [hx + 19, hy + 7], [hx - 17, hy + 12]] as const) m.fixture('fixture/nature/vein/iron', x, y)
  for (const [x, y] of [[hx - 18, hy], [hx + 18, hy], [hx, hy - 17], [hx, hy + 16]] as const) m.fixture('fixture/sacred/gravestone', x, y, { name: L('A boundary stone', '界石'), props: { text: 'A boundary stone, its carving worn: a thorn ring, and inside it, nothing kneeling.', text_zh: '一块界石，刻纹已经磨损：一圈荆棘，圈里没有任何下跪的身影。' } })
  // the heart: the knight's sword, planted point down, where the ground begins
  m.fixture('fixture/sacred/sword', hx, hy, {
    id: 'haven.heart',
    name: L('The planted sword', '插在地上的长剑'),
    tags: ['readable', 'haven-heart'],
    props: { text: 'Alberic\'s longsword, point down in the earth, a little crooked. The ground holds as far as he holds it.', text_zh: '阿尔贝里克的长剑，剑尖朝下插在土里，有点歪。他能守多远，这片土地就有多远。' },
  })
  // the steward's tent and post, a chest for what is kept here
  m.fixture('fixture/tent', hx - 4, hy - 3, { name: L("Alberic's tent", '阿尔贝里克的帐篷') })
  m.anchor('alberic.bed', hx - 4, hy - 1)
  m.anchor('alberic.post', hx + 1, hy + 1)
  // the knight's forge: he was a smith's son before he was a knight; here he keeps the fire and works the anvil by
  // day, and both are the steward's to lend (wiki 锻造)
  m.fixture('fixture/craft/forge', hx + 6, hy - 2, { id: 'haven.forge', name: L("Alberic's forge", '阿尔贝里克的熔炉'), statuses: { lit: -1, fireproof: -1 } })
  m.fixture('fixture/craft/anvil', hx + 6, hy, { id: 'haven.anvil', name: L("Alberic's anvil", '阿尔贝里克的铁砧') })
  m.anchor('alberic.anvil', hx + 5, hy - 1)
  // the beds of those who come to live here (content social.ts residence): one by the camp from the first, two in front
  // of each residents' tent once it stands (its plot: HAVEN_UPGRADES lodge1–3); a day spent by the fire
  m.anchor('home.camp', hx - 2, hy + 3)
  m.anchor('home.camp.day', hx - 1, hy + 1)
  for (const u of HAVEN_UPGRADES.filter((x) => x.id.startsWith('lodge') && x.plot)) {
    const [x, y] = u.plot!
    m.anchor(`home.${u.id}.a`, x - 1, y + 1)
    m.anchor(`home.${u.id}.b`, x + 1, y + 1)
  }
  m.fixture('fixture/container/chest', hx + 3, hy - 3, { id: 'haven.chest', statuses: { open: -1 }, name: L('The Held Ground\'s chest', '誓守之地的箱子') })
  // a little tilled earth, ready to sow
  for (let y = hy + 2; y < hy + 5; y++) for (let x = hx - 7; x < hx - 2; x++) m.set(x, y, 'farmland')
  // no beasts of its own: a cow, a calf, hens are bought crated at Alberic's stall and set down here
  // the fish pond (homestead.ts): cast a line in it (a rod is made at hand; bait from the stall makes them bite);
  // fish shadows glide in the water now and then, to say so
  m.fish = true
  m.organic(hx + 1, hy - 6, 3.2, 1.6, 'water', { only: (t) => t === 'grass' })
  m.fixture('fixture/sign', hx - 3, hy - 6, { props: { text: 'FISH POND — make a rod from two sticks and two grass, or buy one with bait at the stall. Sell your catch there. The farming shelf has seeds and buckets; fill a bucket here for the fields. Seeds say how long they grow.', text_zh: '鱼塘——两根树枝加两把草能做鱼竿，货摊也卖鱼竿、鱼饵并收鱼。农业页有种子和水桶，在这里装水就能浇地。种子说明里写着生长时间。' } })
  // Alberic's stall: three shelves (farming, ranching, fishing) and what it buys back (homestead.ts)
  // the Held Ground's only trade: fire does not take it (gone, it would be gone for good)
  m.fixture('fixture/furniture/stall/trade', hx + 3, hy + 1, { id: 'haven.stall', name: L("Alberic's stall", '阿尔贝里克的货摊'), statuses: { fireproof: -1 } })
  // the rings of mist: each a bank all round, lifting when the ground is widened past it (its `ring`)
  m.regions.held = [hx - 8, hy - 7, 17, 15]
  for (const [i, r] of HAVEN.rings.entries())
    for (let y = 2; y < m.h - 2; y++)
      for (let x = 2; x < m.w - 2; x++) {
        if (Math.abs(dist(x, y) - r) >= 0.6 || !m.free(x, y)) continue
        if (m.get(x, y) !== 'grass' && m.get(x, y) !== 'flowers') m.set(x, y, 'grass')
        m.fixture('fixture/nature/mist', x, y, { props: { ring: i + 1 } })
      }
  // the plots staked out at the heart for what the steward will build (haven.ts HAVEN_UPGRADES: each becomes its building)
  for (const u of HAVEN_UPGRADES) if (u.plot) m.fixture(`fixture/build/plot/${u.id}`, u.plot[0], u.plot[1], { id: `haven.plot.${u.id}` })
  m.appear = GROUND_YIELD
  return m
}

// ------------------------------------------------------------------ the Held Ground's grounds (opened by its steward)

/** A ground of the Held Ground: a place of its own, ringed in old trees, a way back at its south edge. */
function ground(id: string, en: string, zh: string, fill: string, music = 'field'): MapBuilder {
  const m = new MapBuilder(id, L(en, zh), 'field', 32, 24, fill, music, 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Math.min(x, y, m.w - 1 - x, m.h - 1 - y) < 2) m.set(x, y, (x + y) % 3 ? 'tree' : 'pine')
  // the way back to the heart: a gap in the south edge, a path up from it
  for (let x = 15; x <= 17; x++) {
    for (let y = m.h - 2; y < m.h; y++) m.set(x, y, 'path')
    m.portal(x, m.h - 1, HAVEN.map, HAVEN.arrive[0] - 16 + x, HAVEN.arrive[1], L('The Held Ground', '誓守之地'))
  }
  m.path([[16, m.h - 2], [16, 17]], 'path', 2, { edge: 'dirt', edgeP: 0.2 })
  m.anchor('arrive', 16, 18)
  return m
}

/** The quarry: bare rock and gravel, boulders to break, veins of iron and coal and one of gold, stone that comes back. */
function buildQuarry(): MapBuilder {
  const m = ground('haven.quarry', 'The Quarry', '采石场', 'dirt')
  m.organic(16, 9, 12, 6, 'gravel', { only: (t) => t === 'dirt' })
  for (const [x, y, w, h] of [[3, 2, 9, 3], [21, 2, 9, 3], [2, 6, 3, 8], [27, 6, 3, 8]] as const) m.rect(x, y, w, h, 'rock')
  for (const [x, y] of [[8, 9], [12, 6], [20, 7], [24, 11], [10, 14], [22, 15], [15, 11]] as const) m.fixture('fixture/nature/boulder', x, y)
  for (const [x, y] of [[5, 5], [26, 5], [5, 15]] as const) m.fixture('fixture/nature/vein/iron', x, y)
  for (const [x, y] of [[13, 4], [19, 4], [26, 15]] as const) m.fixture('fixture/nature/vein/coal', x, y)
  m.fixture('fixture/nature/vein/gold', 16, 4)
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE QUARRY — stone for the walls of a kingdom that kneels to nobody.', text_zh: '采石场——为一个不向任何人下跪的王国提供城墙的石头。' } })
  m.appear = [appears('item/material/stone', ['dirt', 'gravel'], 10)]
  return m
}

/** The timberland: dense old woods to fell (they grow back), mushrooms and berries under them. */
function buildTimber(): MapBuilder {
  const m = ground('haven.timber', 'The Timberland', '林场', 'grass', 'forest')
  for (let y = 3; y < m.h - 4; y++) for (let x = 3; x < m.w - 3; x++) if (Math.abs(x - 16) > 2 && (x * 5 + y * 7) % 4 === 0) m.set(x, y, (x + y) % 2 ? 'tree' : 'pine')
  m.fixture('fixture/nature/logpile', 13, 17)
  m.fixture('fixture/nature/mushroom_ring', 22, 9)
  for (const [x, y] of [[8, 8], [24, 14], [10, 15]] as const) m.item('item/food/berries', x, y)
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE TIMBERLAND — fell what you need; the old woods grow back.', text_zh: '林场——需要多少就砍多少；老林子会长回来的。' } })
  m.appear = [...GROUND_YIELD, appears('item/food/mushroom/raw', ['grass'], 4)]
  return m
}

/** The lakeside: a deep lake with its fish, sand along the shore, reeds. */
function buildLake(): MapBuilder {
  const m = ground('haven.lake', 'The Lakeside', '湖畔', 'grass')
  m.organic(16, 9, 11, 5.5, 'sand', { only: (t) => t === 'grass' })
  m.organic(16, 9, 9.5, 4.5, 'water', { only: (t) => t === 'sand' })
  m.organic(16, 8, 6, 2.6, 'deepwater', { only: (t) => t === 'water' })
  m.fish = true
  for (const [x, y] of [[6, 10], [26, 10], [9, 14], [23, 14], [7, 6]] as const) if (m.free(x, y) && m.get(x, y) === 'sand') m.fixture('fixture/nature/reeds', x, y)
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE LAKESIDE — cast into deep water for pike and more golden carp. Eels at night, catfish in rain, a rare Dawnscale at first light. Stay on the bank: a rod reaches three cells.', text_zh: '湖畔——向深水甩竿能钓狗鱼，也更容易出金鳞鲤。夜里有鳗鱼，雨天有鲶鱼，清晨偶尔有晨鳞鱼。站在岸上就行：鱼竿够得着三格。' } })
  m.appear = GROUND_YIELD
  return m
}

/** The hot springs: warm pools in cold rock that mend whoever soaks in them; herbs and frostcap on the slopes. */
function buildSprings(): MapBuilder {
  const m = ground('haven.springs', 'The Hot Springs', '温泉谷', 'snow')
  for (const [x, y, w, h] of [[3, 2, 7, 4], [22, 2, 7, 4]] as const) m.rect(x, y, w, h, 'rock')
  m.organic(16, 11, 8, 5, 'grass', { only: (t) => t === 'snow' })
  for (const [x, y] of [[9, 8], [19, 7], [14, 12]] as const) m.scenery('spring', x, y)
  m.regions.spring = [8, 6, 16, 10]
  for (const [x, y] of [[6, 12], [25, 12], [7, 16]] as const) m.item('item/material/herb', x, y)
  for (const [x, y] of [[24, 16], [5, 9]] as const) m.item('item/material/frostcap', x, y)
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE HOT SPRINGS — sit a while, and it mends you.', text_zh: '温泉谷——泡一会儿，伤就好了。' } })
  m.appear = [appears('item/material/herb', ['grass'], 4)]
  return m
}

/** The Held Ground's grounds, each a place of its own its steward opens (HAVEN_UPGRADES' zones). */
export function buildHavenGrounds(): MapBuilder[] {
  return [buildQuarry(), buildTimber(), buildLake(), buildSprings()]
}
