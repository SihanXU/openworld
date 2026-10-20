// `npm run continent`: the continent made again for the hand-made places, and written (generate.ts).
import { writeContinent } from './generate.ts'

const c = await writeContinent()
const by: Record<string, number> = {}
for (const p of c.places) by[p.region] = (by[p.region] ?? 0) + 1
console.log(`continent ${c.width}x${c.height}: ${c.places.length} places`, by)
