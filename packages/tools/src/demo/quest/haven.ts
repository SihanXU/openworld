// The Held Ground (誓守之地, docs/chapter-1.md §12; content haven.ts): the camp the Oath-Thorn opens. A field round a
// planted sword, Alberic's tent and post beside it, a little tilled earth, a pen with a cow and two hens, a pond — and
// three rings of mist, each lifting when the steward widens the ground. Beyond each ring there is more: a grove and
// stones, then a meadow and water, then the old boundary stones and iron in the rock. It lies nowhere on the overworld.

import { HAVEN } from '@lsw/content'
import type { AiData } from '@lsw/engine'
import { MapBuilder } from '../builder.ts'
import { L, GROUND_YIELD } from '../kit.ts'

const GRAZER: Omit<AiData, 'home'> = { behaviour: 'passive', temper: 'wary', sight: 4, leash: 4 }

export function buildHaven(): MapBuilder {
  const m = new MapBuilder(HAVEN.map, L('The Held Ground', '誓守之地'), 'village', HAVEN.w, HAVEN.h, 'grass', 'Village', 'outdoor', 'frostfang')
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
  m.fixture('fixture/sacred/altar', hx, hy, {
    id: 'haven.heart',
    name: L('The planted sword', '插在地上的长剑'),
    tags: ['readable', 'haven-heart'],
    props: { text: 'Alberic\'s longsword, point down in the earth, a little crooked. The ground holds as far as he holds it.', text_zh: '阿尔贝里克的长剑，剑尖朝下插在土里，有点歪。他能守多远，这片土地就有多远。' },
  })
  // the steward's tent and post, a chest for what is kept here
  m.fixture('fixture/tent', hx - 4, hy - 3, { name: L("Alberic's tent", '阿尔贝里克的帐篷') })
  m.anchor('alberic.bed', hx - 4, hy - 1)
  m.anchor('alberic.post', hx + 1, hy + 1)
  m.fixture('fixture/container/chest', hx + 3, hy - 3, { id: 'haven.chest', statuses: { open: -1 }, name: L('The Held Ground\'s chest', '誓守之地的箱子') })
  // a little tilled earth, ready to sow
  for (let y = hy + 2; y < hy + 5; y++) for (let x = hx - 7; x < hx - 2; x++) m.set(x, y, 'farmland')
  // a pen: a cow and two hens to start a herd with
  for (const [x, y] of [[hx + 4, hy + 4], [hx + 6, hy + 3]] as const) m.creature('animal/chicken', x, y, { ...GRAZER })
  m.creature('animal/cow', hx + 5, hy + 5, { ...GRAZER })
  // the fish pond (homestead.ts): cast a line in it (a rod is made at hand; bait from the stall makes them bite);
  // fish shadows glide in the water now and then, to say so
  m.fish = true
  m.organic(hx + 1, hy - 6, 3.2, 1.6, 'water', { only: (t) => t === 'grass' })
  m.fixture('fixture/sign', hx - 3, hy - 6, { props: { text: 'FISH POND — a rod is made from two sticks and two grass. Bait from the stall.', text_zh: '鱼塘——两根树枝加两把草就能做鱼竿。鱼饵在货摊买。' } })
  // Alberic's stall: three shelves (farming, ranching, fishing) and what it buys back (homestead.ts)
  m.fixture('fixture/furniture/stall/trade', hx + 3, hy + 1, { id: 'haven.stall', name: L("Alberic's stall", '阿尔贝里克的货摊') })
  // the rings of mist: each a bank all round, lifting when the ground is widened past it (its `ring`)
  m.regions.held = [hx - 8, hy - 7, 17, 15]
  for (const [i, r] of HAVEN.rings.entries())
    for (let y = 2; y < m.h - 2; y++)
      for (let x = 2; x < m.w - 2; x++) {
        if (Math.abs(dist(x, y) - r) >= 0.6 || !m.free(x, y)) continue
        if (m.get(x, y) !== 'grass' && m.get(x, y) !== 'flowers') m.set(x, y, 'grass')
        m.fixture('fixture/nature/mist', x, y, { props: { ring: i + 1 } })
      }
  m.appear = GROUND_YIELD
  return m
}
