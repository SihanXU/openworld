// The companion's boons (docs/chapter-1.md §8, docs/lore.md): when a Seal-bearer falls, its seal's
// power breaks loose and the fairy Pip takes up part of it, carrying it for her leader, one at a time, changed only beside an attuned waypoint statue
// (engine/src/boons.ts). Each boon is a status of the fairy (`boon_<id>`) whose `lead:<stat>`
// props add to the leader's stats. Five, one per seal; the first (the Crown of Thorns) is given at the end of Chapter 1.

import type { StatusDef, Text } from '@lsw/engine'

const L = (en: string, zh: string) => ({ en, zh })

export interface BoonDef {
  id: string
  name: { en: string; zh: string }
  doc: Text
  /** What it adds to the leader's stats (World.stat). */
  lead: Record<string, number>
}

export const BOONS: BoonDef[] = [
  // the First Seal, the Crown of Thorns: it wears the self's borders thin, and a thinner self learns faster
  { id: 'xp', name: L("Crown's Insight", '荆冠之悟'), doc: L('From the First Seal, the Crown of Thorns. Experience gained +100%.', '来自第一印·荆棘冠。获得的经验 +100%。'), lead: { xpRate: 1 } },
]

export const BOON_BY_ID: Record<string, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b]))

/** The boons as the fairy's statuses: no expiry, what each gives the leader as `lead:<stat>`. */
export const BOON_STATUSES: StatusDef[] = BOONS.map((b) => ({
  id: `boon_${b.id}`,
  name: b.name,
  props: Object.fromEntries(Object.entries(b.lead).map(([k, v]) => [`lead:${k}`, v])),
}))
