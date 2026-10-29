// The Held Ground (誓守之地, docs/chapter-1.md §12; content haven.ts): the camp the Oath-Thorn opens. A field round a
// planted sword, Alberic's pavilion and post beside it, a little tilled earth (no beasts: they are bought, crated, at the
// stall), a pond — and three rings of mist, each lifting when the steward widens the ground. Beyond each ring there is
// more: a grove and stones, then a meadow and water, then the old boundary stones and iron in the rock. It lies nowhere
// on the overworld.
//
// Redrawn on 2026-10-27 (docs/release-1.md §7), its ground laid for what it is: the held field trodden round the sword,
// worn paths out from it to the pavilion, the forge, the stall, the pond and the plots, the camp's wood and stores
// piled where they are used; the grove beyond the first ring in clumps among grey stones, the meadow beyond the second in
// flowers round its deep pool, the old ground beyond the third gone to heath and bare rock, the old trees closing all of
// it. The rings' banks lie on open ground only: a cell of a ring is mist, water or a tree, never a way round.

import { HAVEN, HAVEN_UPGRADES } from '@openworld-game/content'
import { MapBuilder, rng } from '../builder.ts'
import { L, GROUND_YIELD, appears } from '../kit.ts'
import { wildFloor } from '../wildfloor.ts'
import { noise, woods } from './country.ts'

const grassy = (t: string) => t === 'grass' || t === 'flowers' || t === 'drygrass'

export function buildHaven(): MapBuilder {
  const m = new MapBuilder(HAVEN.map, L('The Held Ground', '誓守之地'), 'village', HAVEN.w, HAVEN.h, 'grass', 'haven', 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  const [hx, hy] = HAVEN.heart
  const dist = (x: number, y: number) => Math.hypot(x - hx, (y - hy) * 1.15)
  const [r1, r2, r3] = HAVEN.rings
  /** On a ring's bank (where its mist lies), with a cell's margin. */
  const bank = (x: number, y: number, pad = 0.6) => HAVEN.rings.some((r) => Math.abs(dist(x, y) - r) < pad + 0.6)
  // what the steward will build, and the anchors the people keep: the ground round them stays open
  const plots = HAVEN_UPGRADES.filter((u) => u.plot).map((u) => u.plot!)
  const kept = (x: number, y: number) => plots.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1)
  // the ground in its rings: beyond the first, a grove among grey stones; beyond the second, a meadow; beyond the third,
  // heath and bare rock
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const d = dist(x, y)
      const n = noise(x, y, 4, 501)
      if (d > r3 + 0.6) m.set(x, y, n > 0.45 ? 'drygrass' : 'grass')
      else if (d > r2 + 0.6 && d < r3 - 0.6 && n > 0.5) m.set(x, y, 'flowers')
    }
  // the old trees round it all
  woods(m, (x, y) => dist(x, y) < r3 + 2.5, { depth: 3, swell: 2.5, pines: 0.35, seed: 501 })
  for (let y = 2; y < m.h - 2; y++)
    for (let x = 2; x < m.w - 2; x++) {
      const d = dist(x, y)
      if (bank(x, y) || kept(x, y)) continue
      // the grove: clumps where the noise swells, a grey stone among them now and then
      if (d > r1 + 1.2 && d < r2 - 1.2 && noise(x, y, 3, 502) > 0.6) m.set(x, y, noise(x, y, 2, 503) > 0.7 ? 'rock' : rng.chance(0.3) ? 'pine' : 'tree')
      // the old ground: outcrops of bare rock, a lone pine
      if (d > r3 + 1.2 && noise(x, y, 3, 504) > 0.72) m.set(x, y, 'rock')
      else if (d > r3 + 1.2 && rng.chance(0.03)) m.set(x, y, 'pine')
    }
  // the deep pool in the meadow; its middle is deep: pike bite there (homestead.ts)
  m.organic(hx + 14, hy - 3, 3.2, 2.2, 'water', { only: grassy })
  m.organic(hx + 14, hy - 3, 1.4, 0.9, 'deepwater', { only: (t) => t === 'water' })
  for (const [x, y] of [[hx - 19, hy - 8], [hx + 19, hy + 7], [hx - 17, hy + 12]] as const) {
    m.organic(x + 0.5, y - 0.6, 1.6, 1.1, 'rock', { only: grassy })
    m.set(x, y, 'drygrass')
    m.fixture('fixture/nature/vein/iron', x, y)
  }
  for (const [x, y] of [[hx - 18, hy], [hx + 18, hy], [hx, hy - 17], [hx, hy + 16]] as const) {
    m.set(x, y, 'grass')
    m.fixture('fixture/sacred/gravestone', x, y, { name: L('A boundary stone', '界石'), props: { text: 'A boundary stone. Its carving is worn: a ring of thorns, and nothing inside the ring.', text_zh: '一块界石。刻纹已经磨损了：一圈荆棘，圈里什么也没有。' } })
  }
  // the held field: trodden bare round the sword, worn paths out to the pavilion, the forge, the stall, the pond and the
  // plots, the tilled earth west of it
  m.organic(hx, hy + 0.5, 2.6, 2.2, 'dirt', { rough: 0.3, only: grassy })
  for (const [x, y] of [[hx - 4, hy - 1], [hx + 5, hy + 1], [hx + 1, hy - 4], [hx, hy + 6], [hx - 5, hy + 2]] as const) m.path([[hx, hy + 1], [x, y]], 'dirt', 1, { over: (c) => c === 'grass' || c === 'flowers' })
  for (let y = hy + 2; y < hy + 5; y++) for (let x = hx - 7; x < hx - 2; x++) m.set(x, y, 'farmland')
  // the heart: the knight's sword, planted point down, where the ground begins
  m.fixture('fixture/sacred/sword', hx, hy, {
    id: 'haven.heart',
    name: L('The planted sword', '插在地上的长剑'),
    tags: ['readable', 'haven-heart'],
    props: { text: 'Alberic\'s longsword, driven point down into the earth, a little crooked. Its grip is wrapped in new cloth.', text_zh: '阿尔贝里克的长剑，剑尖朝下插在土里，有点歪。剑柄上缠着新换的布。' },
  })
  // the steward's pavilion and post, a chest for what is kept here
  m.fixture('fixture/tent/pavilion', hx - 4, hy - 3, { name: L("Alberic's tent", '阿尔贝里克的帐篷') })
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
  // no beasts of its own: a cow, a calf, hens are bought crated at Alberic's stall and set down here
  // the fish pond (homestead.ts): cast a line in it (a rod is made at hand; bait from the stall makes them bite);
  // fish shadows glide in the water now and then, to say so
  m.fish = true
  m.organic(hx + 1, hy - 6, 3.2, 1.6, 'water', { only: (t) => t === 'grass' || t === 'dirt' })
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
        if (!grassy(m.get(x, y))) m.set(x, y, 'grass')
        m.fixture('fixture/nature/mist', x, y, { props: { ring: i + 1 } })
      }
  // the plots staked out at the heart for what the steward will build (haven.ts HAVEN_UPGRADES: each becomes its building)
  for (const u of HAVEN_UPGRADES) if (u.plot) m.fixture(`fixture/build/plot/${u.id}`, u.plot[0], u.plot[1], { id: `haven.plot.${u.id}` })
  // the camp's own: wood split for the forge, the stall's casks and sacks, hay by the tilled earth, a cart, a rug of
  // wares spread by the stall (stamped pictures, never things)
  const open = (x: number, y: number) => !bank(x, y, 0.2) && !kept(x, y) && !Object.values(m.anchors).some(([ax, ay]) => Math.abs(ax - x) <= 1 && Math.abs(ay - y) <= 1)
  for (const [name, x, y] of [['decor_firewood', hx + 8, hy - 2], ['decor_casks', hx + 5, hy + 2], ['decor_sacks', hx + 4, hy + 3], ['decor_hay', hx - 8, hy + 3], ['decor_cart', hx - 7, hy + 6], ['decor_crates', hx + 2, hy - 4]] as [string, number, number][])
    if (open(x, y) && m.free(x, y)) m.building(name, x, y)
  m.sprinkle('fixture/nature/flowers', 0.06, (x, y, t) => t === 'grass' && dist(x, y) < r1 - 1)
  m.sprinkle('fixture/nature/reeds', 0.4, (x, y, t) => grassy(t) && m.near(x, y, (u) => u === 'water'))
  m.sprinkle('fixture/nature/tuft', 0.06, (x, y, t) => t === 'drygrass')
  m.sprinkle('fixture/nature/leaves', 0.12, (x, y, t) => grassy(t) && m.near(x, y, (u) => u === 'tree' || u === 'pine'))
  wildFloor(m, 1, (x, y) => dist(x, y) < r1)
  m.appear = GROUND_YIELD
  return m
}

// ------------------------------------------------------------------ the Held Ground's grounds (opened by its steward)

/** A ground of the Held Ground: a place of its own, ringed in old trees, a way back at its south edge. */
function ground(id: string, en: string, zh: string, fill: string, music = 'field', seed = 1): MapBuilder {
  const m = new MapBuilder(id, L(en, zh), 'field', 32, 24, fill, music, 'outdoor', 'frostfang')
  m.zone = 'peaceful'
  woods(m, (x, y) => x >= 13 && x <= 19 && y >= m.h - 8, { depth: 2.2, swell: 1.8, pines: 0.5, seed })
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (Math.min(x, y, m.w - 1 - x, m.h - 1 - y) < 1 && !(x >= 15 && x <= 17 && y === m.h - 1)) m.set(x, y, (x + y) % 3 ? 'tree' : 'pine')
  // the way back to the heart: a gap in the south edge, a path up from it
  for (let x = 15; x <= 17; x++) {
    for (let y = m.h - 2; y < m.h; y++) m.set(x, y, 'path')
    m.portal(x, m.h - 1, HAVEN.map, HAVEN.arrive[0] - 16 + x, HAVEN.arrive[1], L('The Held Ground', '誓守之地'))
  }
  m.path([[16, m.h - 2], [16, 17]], 'path', 2, { edge: 'dirt', edgeP: 0.1 })
  m.anchor('arrive', 16, 18)
  return m
}

/** The quarry: a pit cut into grey rock, its faces round the north, gravel on its floor, boulders to break, veins of iron and coal and one of gold, spoil heaped, stone that comes back. */
function buildQuarry(): MapBuilder {
  const m = ground('haven.quarry', 'The Oathstone Quarry', '誓石采石场', 'dirt', 'field', 511)
  // the faces: rock in a ragged horseshoe round the pit, the floor gravel, the spoil heaped where the barrows tipped it
  for (let y = 1; y < m.h - 1; y++)
    for (let x = 1; x < m.w - 1; x++) {
      if (m.get(x, y) === 'tree' || m.get(x, y) === 'pine') continue
      const d = Math.hypot((x - 16) / 13, (y - 9.5) / 8)
      if (d > 0.82 + (noise(x, y, 3, 512) - 0.5) * 0.25 && y < 16) m.set(x, y, 'rock')
      else if (d < 0.72 && noise(x, y, 3, 513) > 0.62) m.set(x, y, 'gravel')
    }
  for (const [x, y] of [[8, 9], [12, 6], [20, 7], [24, 11], [10, 14], [22, 15], [15, 11]] as const) (m.set(x, y, 'gravel'), m.fixture('fixture/nature/boulder', x, y))
  for (const [x, y] of [[5, 5], [26, 5], [5, 15]] as const) (m.set(x, y, 'gravel'), m.fixture('fixture/nature/vein/iron', x, y))
  for (const [x, y] of [[13, 4], [19, 4], [26, 15]] as const) (m.set(x, y, 'gravel'), m.fixture('fixture/nature/vein/coal', x, y))
  m.set(16, 4, 'gravel')
  m.fixture('fixture/nature/vein/gold', 16, 4)
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE OATHSTONE QUARRY — the Order cut its kneeling stones here. Stone for building; take what you need.', text_zh: '誓石采石场——骑士团当年在这里凿出跪石。盖房砌墙的石头，用多少，取多少。' } })
  for (const [name, x, y] of [['decor_stones', 9, 11], ['decor_stones', 21, 10], ['decor_stones', 18, 13], ['decor_cart', 19, 17], ['decor_crates', 12, 17], ['decor_stones', 6, 10]] as [string, number, number][]) if (m.free(x, y)) m.building(name, x, y)
  wildFloor(m, 1.2, (x, y) => x >= 15 && x <= 17 && y >= 17)
  m.appear = [appears('item/material/stone', ['dirt', 'gravel'], 10)]
  return m
}

/** The timberland: old woods to fell (they grow back) round a clearing of stumps, a stack of logs and a sawing trestle, mushrooms and berries under the trees. */
function buildTimber(): MapBuilder {
  const m = ground('haven.timber', 'The Wardwood', '守林', 'grass', 'forest', 521)
  for (let y = 2; y < m.h - 3; y++)
    for (let x = 2; x < m.w - 2; x++) {
      if (Math.abs(x - 16) <= 1 && y > 12) continue
      const clearing = Math.hypot((x - 16) / 5.5, (y - 14) / 3.5) < 1
      if (clearing) continue
      if (noise(x, y, 3, 522) > 0.38 && (x + y) % 2 === 0) m.set(x, y, noise(x, y, 4, 523) > 0.55 ? 'pine' : 'tree')
    }
  m.fixture('fixture/nature/logpile', 13, 17)
  // the stumps of what was felled in the clearing
  for (const [x, y] of [[12, 13], [18, 12], [21, 15], [14, 15]] as const) m.fixture('fixture/nature/stump', x, y)
  m.fixture('fixture/nature/mushroom_ring', 22, 9)
  for (const [x, y] of [[8, 8], [24, 14], [10, 15]] as const) (m.set(x, y, 'grass'), m.item('item/food/berries', x, y))
  m.set(22, 9, 'grass')
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE WARDWOOD — the Order kept these woods. Fell what you need; the trees grow back.', text_zh: '守林——骑士团守过的林子。要多少就砍多少，砍了还会长回来。' } })
  for (const [name, x, y] of [['decor_firewood', 19, 15], ['decor_firewood', 11, 13], ['decor_cart', 20, 17]] as [string, number, number][]) if (m.free(x, y)) m.building(name, x, y)
  m.sprinkle('fixture/nature/leaves', 0.2, (x, y, t) => t === 'grass' && m.near(x, y, (u) => u === 'tree' || u === 'pine'))
  wildFloor(m, 1.2, (x, y) => x >= 15 && x <= 17 && y >= 17)
  m.appear = [...GROUND_YIELD, appears('item/food/mushroom/raw', ['grass'], 4)]
  return m
}

/** The lakeside: a deep lake with its fish, a beach of sand along its south shore and a jetty out over it, reeds in the shallows. */
function buildLake(): MapBuilder {
  const m = ground('haven.lake', 'Stillmere', '静镜湖', 'grass', 'field', 531)
  for (let y = 1; y < m.h - 1; y++)
    for (let x = 1; x < m.w - 1; x++) {
      const d = Math.hypot((x - 16) / 11.5, (y - 8.5) / 6) + (noise(x, y, 3, 532) - 0.5) * 0.18
      if (d < 0.62) m.set(x, y, 'deepwater')
      else if (d < 0.88) m.set(x, y, 'water')
      else if (d < 1.05 && y > 7) m.set(x, y, 'sand')
    }
  // the jetty out from the beach
  for (let y = 11; y <= 14; y++) m.set(16, y, 'bridge')
  m.fish = true
  m.sprinkle('fixture/nature/reeds', 0.45, (x, y, t) => (t === 'sand' || t === 'grass') && m.near(x, y, (u) => u === 'water') && Math.abs(x - 16) > 1)
  m.fixture('fixture/sign', 14, 18, { props: { text: 'STILLMERE — cast into deep water for pike and more golden carp. Eels at night, catfish in rain, a rare Dawnscale at first light. Stay on the bank: a rod reaches three cells.', text_zh: '静镜湖——向深水甩竿能钓狗鱼，也更容易出金鳞鲤。夜里有鳗鱼，雨天有鲶鱼，清晨偶尔有晨鳞鱼。站在岸上就行：鱼竿够得着三格。' } })
  for (const [name, x, y] of [['decor_crates', 18, 16], ['decor_casks', 13, 16]] as [string, number, number][]) if (m.free(x, y)) m.building(name, x, y)
  wildFloor(m, 1, (x, y) => x >= 15 && x <= 17 && y >= 15)
  m.appear = GROUND_YIELD
  return m
}

/** The hot springs: warm pools on a green shelf in cold rock that mend whoever soaks in them; herbs and frostcap on the slopes. */
function buildSprings(): MapBuilder {
  const m = ground('haven.springs', 'The Mending Springs', '愈泉谷', 'snow', 'field', 541)
  for (let y = 1; y < 15; y++)
    for (let x = 1; x < m.w - 1; x++) {
      if (m.get(x, y) === 'tree' || m.get(x, y) === 'pine') continue
      const d = Math.hypot((x - 16) / 13, (y - 10) / 8)
      if (d > 0.85 + (noise(x, y, 3, 542) - 0.5) * 0.3) m.set(x, y, 'rock')
    }
  m.organic(16, 11, 8.5, 5.2, 'grass', { only: (t) => t === 'snow', rough: 0.3 })
  for (const [x, y] of [[9, 8], [19, 7], [14, 12]] as const) m.scenery('spring', x, y)
  m.regions.spring = [8, 6, 16, 10]
  for (const [x, y] of [[6, 12], [25, 12], [7, 16]] as const) (m.get(x, y) === 'rock' && m.set(x, y, 'snow'), m.item('item/material/herb', x, y))
  for (const [x, y] of [[24, 16], [5, 9]] as const) (m.get(x, y) === 'rock' && m.set(x, y, 'snow'), m.item('item/material/frostcap', x, y))
  m.fixture('fixture/sign', 14, 18, { props: { text: 'THE MENDING SPRINGS — sit a while, and it mends you.', text_zh: '愈泉谷——泡一会儿，伤就好了。' } })
  for (const [name, x, y] of [['decor_stones', 22, 13], ['decor_stones', 10, 13]] as [string, number, number][]) if (m.free(x, y)) m.building(name, x, y)
  wildFloor(m, 1, (x, y) => x >= 15 && x <= 17 && y >= 17)
  m.appear = [appears('item/material/herb', ['grass'], 4)]
  return m
}

/** The Held Ground's grounds, each a place of its own its steward opens (HAVEN_UPGRADES' zones). */
export function buildHavenGrounds(): MapBuilder[] {
  return [buildQuarry(), buildTimber(), buildLake(), buildSprings()]
}
