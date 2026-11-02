// The companion's boons (docs/chapter-1.md §8, docs/lore.md): when a Seal-bearer falls, its seal's
// power breaks loose and the fairy Lumi takes up part of it, carrying it for her leader, one at a time, changed only beside an attuned waypoint statue
// (engine/src/boons.ts). Each boon is a status of the fairy (`boon_<id>`) whose `lead:<stat>`
// props add to the leader's stats. Five, one per seal; the first (the Crown of Thorns) is given at the end of Chapter 1,
// the second (the Scourging Post) when Matthias falls in Chapter 2.

import type { StatusDef, Text } from '@openworld/engine'

const L = (en: string, zh: string) => ({ en, zh })

export interface BoonDef {
  id: string
  name: { en: string; zh: string }
  doc: Text
  /** The seal whose power it is (1–5, docs/lore.md §4). */
  seal: number
  /** What it adds to the leader's stats (World.stat). */
  lead: Record<string, number>
}

export const BOONS: BoonDef[] = [
  // the First Seal, the Crown of Thorns: it wears the self's borders thin, and a thinner self learns faster
  { id: 'xp', seal: 1, name: L("Crown's Insight", '荆冠之悟'), doc: L('From the First Seal, the Crown of Thorns. Experience gained +100%.', '来自第一印·荆棘冠。获得的经验 +100%。'), lead: { xpRate: 1 } },
  // the Second Seal, the Scourge: the flesh made to bear what it is dealt (docs/chapter-2.md §8)
  { id: 'endure', seal: 2, name: L("Scourge's Endurance", '鞭痕之忍'), doc: L('From the Second Seal, the Scourging Post. Defence +3.', '来自第二印·鞭刑柱。防御 +3。'), lead: { def: 3 } },
  // the third seal's: the Scale of Hunger makes the flesh light (docs/chapter-3.md §8)
  { id: 'fast', seal: 3, name: L('Lightness of the Fast', '斋戒之轻'), doc: L('From the Third Seal, the Scale of Hunger. Movement +15%.', '来自第三印·饥刑之秤。移动速度 +15%。'), lead: { moveHaste: 0.15 } },
  // the fourth seal's: the nails fix the body fast (docs/chapter-4.md §8)
  { id: 'hold', seal: 4, name: L('Hold of the Nails', '圣钉之守'), doc: L('From the Fourth Seal, the Holy Wood of the Nails. Standing your ground, you take 20% less harm.', '来自第四印·钉刑圣木。站定不动时，受到的伤害 -20%。'), lead: { holdFast: 0.2 } },
  // the fifth seal's: what passes through (docs/chapter-5.md §8)
  { id: 'pierce', seal: 5, name: L('Passage of the Lance', '圣枪之贯'), doc: L('From the Fifth Seal, the Lance That Pierced the Heart. Critical chance +15%.', '来自第五印·穿心圣枪。暴击率 +15%。'), lead: { critChance: 0.15 } },
]

export const BOON_BY_ID: Record<string, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b]))

/** The boons as the fairy's statuses: no expiry, what each gives the leader as `lead:<stat>`, and the seal it is of (`seal`: the client's banner names it). */
export const BOON_STATUSES: StatusDef[] = BOONS.map((b) => ({
  id: `boon_${b.id}`,
  name: b.name,
  props: { ...Object.fromEntries(Object.entries(b.lead).map(([k, v]) => [`lead:${k}`, v])), seal: b.seal },
}))
