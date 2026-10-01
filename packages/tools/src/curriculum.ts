// The offline inner loop: the coverage sweep lists every interaction the library leaves
// undefined; the curriculum hands a diverse sample of them to the modder, one by one, as if
// players had tried them. The shared library and the modder's self-state grow exactly as they
// do online (same files), so this is how the world is written large and how self-state
// checkpoints are produced between benchmark runs (docs/rsi.md). Do not run it while the
// service is running on the same data directory.
//
//   npm run curriculum -- [count=20] [seed=1]
//   (model from the environment, as for `npm run modder`; see packages/modder/src/model.ts)

import { fileURLToPath } from 'node:url'
import { ModPort, Rng, buildSandbox, type ModRequest, type Ontology, type RuleLibrary, type Scenario } from '@lsw/engine'
import { openModder } from '@lsw/modder'
import { FRONT, ORIGIN, sweep, targets, type Cell } from './coverage.ts'

const SIZE = 9 // the request window is 7×7 around the target (or around the actor, using a thing on itself)
const SHIFT = { x: 4 - FRONT.x, y: 4 - FRONT.y }

/** The ModRequest a player would raise for one swept cell, built through the real engine path. */
export function cellRequest(cell: Cell, onto: Ontology, lib: RuleLibrary): ModRequest | undefined {
  const target = targets(onto).find((t) => t.id === cell.target)
  if (!target) return undefined
  const small: Scenario = {
    terrain: Array.from({ length: 3 }, () => Array(3).fill('grass')),
    entities: [{ key: 'actor', type: 'actor/person/player', ...ORIGIN }],
    event: {},
  }
  if (cell.hand) small.entities.push({ key: 'held', type: cell.hand, ...ORIGIN, heldBy: 'actor' })
  const key = target.scenario(small)
  // re-centre the 3×3 sweep field in a larger one, so the window around the target is open ground
  const terrain = Array.from({ length: SIZE }, () => Array(SIZE).fill('grass'))
  small.terrain!.forEach((row, y) => row.forEach((t, x) => (terrain[y + SHIFT.y][x + SHIFT.x] = t)))
  const sc: Scenario = { terrain, entities: small.entities.map((e) => ({ ...e, x: e.x + SHIFT.x, y: e.y + SHIFT.y })), event: {} }
  const eng = buildSandbox(sc, onto, lib.clone())
  const port = new ModPort(eng)
  const ref = key.startsWith('tile:') ? { tile: { map: 'sandbox', x: FRONT.x + SHIFT.x, y: FRONT.y + SHIFT.y } } : { e: key }
  const res = eng.interact(cell.verb, 'actor', ref)
  return res.defined ? undefined : port.records[0]?.request
}

/** A spread-out sample: shuffled, then taken round-robin across targets so no single target dominates. */
export function pick(cells: Cell[], n: number, seed: number): Cell[] {
  const rng = new Rng(seed)
  const byTarget = new Map<string, Cell[]>()
  for (const c of rng.shuffle([...cells])) (byTarget.get(c.target) ?? byTarget.set(c.target, []).get(c.target)!).push(c)
  const queues = rng.shuffle([...byTarget.values()])
  const out: Cell[] = []
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift()!)
  return out
}

async function main(): Promise<void> {
  const n = Number(process.argv[2] ?? 20)
  const seed = Number(process.argv[3] ?? 1)
  const modder = openModder({ log: (l) => console.log(`  ${l}`) })
  if (!modder.model) {
    console.error('no model configured: set LSW_MODEL_URL + LSW_MODEL_KEY + LSW_MODEL, or LSW_MODEL_SCRIPT')
    process.exit(1)
  }
  const { library, state } = modder.opts
  const rulesNow = () => [...library.lib.rules.values()]
  const before = sweep(library.fullOntology(), rulesNow())
  const open = before.cells.filter((c) => c.outcome === 'undefined')
  console.log(`${open.length} undefined of ${before.cells.length} swept interactions; taking ${n} (seed ${seed}) with ${modder.model.name}`)
  const counts: Record<string, number> = {}
  for (const [i, cell] of pick(open, n, seed).entries()) {
    const req = cellRequest(cell, library.fullOntology(), library.lib)
    const label = `[${i + 1}/${n}] ${cell.verb} ${cell.hand || '(empty hand)'} → ${cell.target}`
    if (!req) {
      console.log(`${label}: already answered`)
      counts.answered = (counts.answered ?? 0) + 1
      continue
    }
    const reply = await modder.resolve({ request: req }, 'offline') // nobody waits: quality first
    counts[reply.outcome] = (counts[reply.outcome] ?? 0) + 1
    console.log(`${label}: ${reply.outcome}${reply.diagnostics?.length ? ` (${reply.diagnostics[0]})` : ''}`)
  }
  await modder.settled()
  const after = sweep(library.fullOntology(), rulesNow())
  console.log('\noutcomes', counts)
  console.log(`undefined interactions: ${before.totals.undefined} → ${after.totals.undefined}`)
  console.log('self-state', state.stats())
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
