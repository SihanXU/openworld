// Red-team the modder for endless yield: acts on resources whose outcome is undefined are sent to a
// live modder; each answer is applied in a sandbox, and the act repeated twenty times. A case is
// flagged when what lies about grows (by count, or by the sum of the values the economy gives each
// type) with nothing spent. Usage: npx tsx games/openworld/tools/src/redteam-yield.ts [modder url]

import { ModPort, RuleLibrary, buildSandbox, type Engine, type Patch, type ModRequest } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'

const URL = process.argv[2] ?? 'http://localhost:8788'
const onto = buildOntology()

interface Case { name: string; held?: string; target: string; terrain?: string; key?: 'use' | 'hands' }
const ORE = 'item/material/iron_ore'
const CASES: Case[] = [
  { name: 'punch iron ore', target: ORE },
  { name: 'hands on iron ore', target: ORE, key: 'hands' },
  { name: 'pickaxe on iron ore', held: 'item/tool/pickaxe', target: ORE },
  { name: 'smith hammer on iron ore', held: 'item/tool/smith_hammer', target: ORE },
  { name: 'iron ore on iron ore', held: ORE, target: ORE },
  { name: 'stone on iron ore', held: 'item/material/stone', target: ORE },
  { name: 'axe on iron ore', held: 'item/weapon/blade/axe', target: ORE },
  { name: 'punch coal', target: 'item/material/coal' },
  { name: 'pickaxe on coal', held: 'item/tool/pickaxe', target: 'item/material/coal' },
  { name: 'iron ore on lit campfire', held: ORE, target: 'fixture/light/campfire' },
  { name: 'coal on lit campfire', held: 'item/material/coal', target: 'fixture/light/campfire' },
  { name: 'axe on plank', held: 'item/weapon/blade/axe', target: 'item/material/plank' },
  { name: 'pickaxe on stone', held: 'item/tool/pickaxe', target: 'item/material/stone' },
  { name: 'smith hammer on stone', held: 'item/tool/smith_hammer', target: 'item/material/stone' },
  { name: 'punch iron vein', target: 'fixture/nature/vein/iron' },
  { name: 'hands on iron vein', target: 'fixture/nature/vein/iron', key: 'hands' },
  { name: 'axe on iron vein', held: 'item/weapon/blade/axe', target: 'fixture/nature/vein/iron' },
  { name: 'sickle on haystack', held: 'item/tool/sickle', target: 'fixture/nature/haystack' },
  { name: 'knife on log', held: 'item/tool/knife', target: 'item/material/log' },
  { name: 'pickaxe on cave floor', held: 'item/tool/pickaxe', target: 'tile', terrain: 'cave_floor' },
]

/** What lies about, by type (things on the ground and in the bag). */
function stock(eng: Engine): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of Object.values(eng.world.state.entities)) if (e.type.startsWith('item/')) m.set(e.type, (m.get(e.type) ?? 0) + 1)
  return m
}

async function resolve(request: ModRequest): Promise<{ patch: Patch | null; outcome: string; ms: number }> {
  const t0 = Date.now()
  const res = await fetch(`${URL}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request, workspace: { patches: { rules: [], types: [], statuses: [] } } }) })
  const body = (await res.json()) as { patch?: Patch | null; outcome?: string }
  return { patch: body.patch ?? null, outcome: body.outcome ?? String(res.status), ms: Date.now() - t0 }
}

async function run(c: Case): Promise<string> {
  const terrain = Array.from({ length: 7 }, () => Array(7).fill(c.terrain ?? 'grass'))
  if (c.target === 'fixture/light/campfire') terrain[2][3] = 'grass'
  const entities = [{ key: 'actor', type: 'actor/person/player', x: 3, y: 3 }, ...(c.target !== 'tile' ? [{ key: 'target', type: c.target, x: 3, y: 2 }] : []), ...(c.held ? [{ key: 'held', type: c.held, x: 3, y: 3 }] : [])]
  const eng = buildSandbox({ terrain, entities, event: {} }, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES]))
  const w = eng.world
  eng.author(() => {
    if (c.held) w.place(w.get('held')!, { on: 'hand', holder: 'actor' })
    if (c.target === 'fixture/light/campfire') w.setStatus({ e: 'target' }, 'lit', -1)
  })
  eng.controls.sync()
  const key = c.key ?? 'use'
  const plan = eng.controls.plan(key, { x: 3, y: 2 })
  if (!plan) return `${c.name}: no plan`
  const port = new ModPort(eng)
  let asked: Promise<{ patch: Patch | null; outcome: string; ms: number }> | undefined
  port.provider = { resolve: (req) => (asked = resolve(req)).then((r) => r.patch) }
  const before = stock(eng)
  eng.controls.run(plan, true)
  if (w.state.question) eng.controls.answer(true)
  let note = plan.unknown ? 'asked' : 'defined'
  if (asked) {
    const r = await asked
    note = `${r.outcome} in ${Math.round(r.ms / 1000)}s${r.patch ? ` (${r.patch.artifacts.map((a) => (a.kind === 'rule' ? a.rule.id : a.kind)).join(', ')})` : ''}`
    await new Promise((ok) => setTimeout(ok, 50))
  }
  for (let i = 0; i < 40; i++) eng.tick()
  // the same act, twenty times more (whatever is there to act on: a new one of the target's type if it is gone)
  for (let i = 0; i < 20; i++) {
    const again = eng.controls.plan(key, { x: 3, y: 2 })
    if (!again) break
    eng.controls.run(again, true)
    if (w.state.question) eng.controls.answer(true)
    for (let k = 0; k < 12; k++) eng.tick()
  }
  const after = stock(eng)
  const grew = [...after].filter(([t, n]) => n > (before.get(t) ?? 0)).map(([t, n]) => `${t.split('/').pop()} ${before.get(t) ?? 0}→${n}`)
  const fell = [...before].filter(([t, n]) => (after.get(t) ?? 0) < n).map(([t, n]) => `${t.split('/').pop()} ${n}→${after.get(t) ?? 0}`)
  const flag = grew.length && !fell.length ? 'FLAG endless?' : grew.length ? 'converts' : 'ok'
  return `${flag.padEnd(14)} ${c.name}: ${note}; grew [${grew.join(', ')}] spent [${fell.join(', ')}]`
}

const only = process.argv[3]
for (const c of CASES.filter((c) => !only || c.name.includes(only))) {
  try {
    console.log(await run(c))
  } catch (e) {
    console.log(`ERROR          ${c.name}: ${(e as Error).message}`)
  }
}
