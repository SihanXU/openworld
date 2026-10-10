// Things beyond the request, with a real model (the live profile; review, reflection and
// escalation off). Five acts whose plausible outcome is a thing the world already has elsewhere
// (the router must find it and make no new type), five whose outcome is a thing the world does
// not have (it must create it: named right, with a picture). Each case runs on a fresh library and
// follows the act as the game does: a rule writes only its host, so a knife on a haystack may
// answer with a cut sent to the haystack, which is the haystack's own hole, asked next. Up to
// four holes are answered, and the verdict is on the world afterwards: what appeared or changed.
// The record, the verdicts and the pictures (scaled 8x) are written to var/eval-objects/<time>/.
// Costs model calls (about $0.05-0.30 a case).
//
//   npm run eval:objects                  # all ten
//   npm run eval:objects -- flour         # the cases whose name contains it

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ModPort, RuleLibrary, buildSandbox, type Patch, type PixelArt, type Rule, type TypeDef } from '@lsw/engine'
import { BASE_RULES, STORY_RULES, buildOntology } from '@lsw/content'
import { modelFromEnv, openModder, type WorldEpisode } from '@lsw/modder'
import { png } from './art/png.ts'

interface Case {
  name: string
  held: string
  target: string
  statuses?: string[]
  /** find: the types a good answer makes (any of them); create: a new thing is expected */
  find?: string[]
}

const CASES: Case[] = [
  { name: 'knife on a haystack: cut grass', held: 'item/tool/knife', target: 'fixture/nature/haystack', find: ['item/material/grass', 'item/material/wheat'] },
  { name: 'sickle on reeds: cut grass', held: 'item/tool/sickle', target: 'fixture/nature/reeds', find: ['item/material/grass'] },
  { name: 'knife on a beehive: honey', held: 'item/tool/knife', target: 'fixture/nature/beehive', find: ['item/food/honey'] },
  { name: 'shovel on pebbles: stones', held: 'item/tool/shovel', target: 'fixture/nature/pebbles', find: ['item/material/stone'] },
  { name: 'feather dipped in ink: a quill', held: 'item/material/feather', target: 'item/misc/ink', find: ['item/misc/feather_quill'] },
  { name: 'iron ore in a lit forge: an ingot', held: 'item/material/iron_ore', target: 'fixture/craft/forge', statuses: ['lit'] },
  { name: 'salt on raw meat: cured meat', held: 'item/material/salt', target: 'item/food/meat/raw' },
  { name: 'frostcap in a lit cauldron: a frost potion', held: 'item/material/frostcap', target: 'fixture/craft/cauldron', statuses: ['lit'] },
  { name: 'knife on a pumpkin: a carved pumpkin', held: 'item/tool/knife', target: 'item/food/pumpkin' },
  { name: 'berries in a lit cauldron: jam', held: 'item/food/berries', target: 'fixture/craft/cauldron', statuses: ['lit'] },
]

const REPO = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
openModder({ data: mkdtempSync(join(tmpdir(), 'lsw-warm-')), model: null }) // loads .env
const model = modelFromEnv()
if (!model) throw new Error('no model: set LSW_MODEL_BACKEND (claude-code) or the OpenRouter key')
const onto = buildOntology()
const filter = process.argv[2]
const cases = CASES.filter((c) => !filter || c.name.includes(filter))
const out = join(REPO, 'var/eval-objects', new Date().toISOString().replace(/[:.]/g, '-'))
mkdirSync(out, { recursive: true })

const MAX_HOLES = 4
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function picture(id: string, art: PixelArt): string {
  const S = 8
  const rgba = new Uint8Array(16 * S * 16 * S * 4)
  art.grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const hex = art.palette[ch]
      if (ch === '.' || !hex) return
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) rgba.set([r, g, b, 255], (((y * S + dy) * 16 * S) + x * S + dx) * 4)
    }),
  )
  const file = `${id.replace(/\//g, '.')}.png`
  writeFileSync(join(out, file), png(16 * S, 16 * S, rgba))
  return file
}

interface Result {
  case: string
  kind: 'find' | 'create'
  pass: boolean
  why: string
  holes: string
  routes: string[][]
  needed: string[]
  calls?: number
  cost?: number
  s: number
  rules: { id: string; doc?: string }[]
  types: { id: string; name: unknown; tags?: string[]; material?: unknown; makeup?: unknown }[]
  pictures: string[]
}
const results: Result[] = []
for (const c of cases) {
  const modder = openModder({ data: mkdtempSync(join(tmpdir(), 'lsw-eval-')), model })
  const { state } = modder.opts
  const h = state.harness()
  state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false }, 'eval: objects')
  const eng = buildSandbox(
    { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: c.held, x: 2, y: 2, heldBy: 'actor' }, { key: 'it', type: c.target, x: 2, y: 1, statuses: c.statuses }], event: {} },
    onto,
    new RuleLibrary([...BASE_RULES, ...STORY_RULES]),
  )
  const port = new ModPort(eng)
  port.timeoutTicks = 1e9 // the eval waits for the model, not the clock
  const patches: Patch[] = []
  const episodes: string[] = []
  port.provider = {
    resolve: async (req) => {
      const reply = await modder.resolve({ request: req }, 'live')
      if (reply.episode) episodes.push(reply.episode)
      if (reply.patch) patches.push(reply.patch)
      return reply.patch
    },
  }
  const before = new Map(Object.values(eng.world.state.entities).map((e) => [e.id, e.type]))
  console.log(`\n=== ${c.name} (${c.find ? 'find' : 'create'})`)
  const t0 = Date.now()
  eng.act('use', 'actor', { e: 'it' })
  if (!port.records.length) {
    console.log('  not a hole any more: skipped')
    continue
  }
  // follow the act: each answer is replayed, and what it sends on may be the next hole
  while (Date.now() - t0 < 300_000) {
    eng.tick()
    if (!port.records.some((r) => r.status === 'pending' || r.awaiting)) break
    if (port.records.length > MAX_HOLES) break
    await sleep(200)
  }
  for (let i = 0; i < 20; i++) eng.tick()
  const eps = episodes.map((id) => state.episode(id) as WorldEpisode | undefined).filter((e): e is WorldEpisode => !!e)
  const rules = patches.flatMap((p) => p.artifacts.flatMap((a) => (a.kind === 'rule' ? [a.rule as Rule] : [])))
  const types = patches.flatMap((p) => p.artifacts.flatMap((a) => (a.kind === 'type' ? [a.type as TypeDef] : [])))
  // what the world holds now that it did not: new things, and things that became another kind
  const makes = [...new Set(Object.values(eng.world.state.entities).filter((e) => before.get(e.id) !== e.type).map((e) => e.type))]
  let pass = false
  let why = ''
  const holes = port.records.map((r) => `${r.request.event.host?.type.split('/').slice(-2).join('/')} ${r.request.event.kind}: ${r.status}`).join('; ')
  if (!patches.length) why = `no patch (${holes})`
  else if (c.find) {
    pass = makes.some((t) => c.find!.includes(t)) && !types.length
    why = pass ? `made ${makes.join(', ')}` : types.length ? `created ${types.map((t) => t.id).join(', ')} instead of finding ${c.find.join(' | ')}` : `made ${makes.join(', ') || 'nothing'}, wanted ${c.find.join(' | ')}`
  } else {
    const named = types.filter((t) => typeof t.name === 'object' && t.name?.en && t.name?.zh)
    const drawn = types.filter((t) => t.art)
    pass = types.length > 0 && makes.some((m) => types.some((t) => t.id === m)) && drawn.length === types.length && named.length === types.length
    why = types.length ? `created ${types.map((t) => `${t.id} (${typeof t.name === 'object' ? `${t.name?.en} / ${t.name?.zh}` : t.name})${t.art ? '' : ' without a picture'}`).join(', ')}; the world now has ${makes.join(', ') || 'nothing new'}` : `created nothing; the world now has ${makes.join(', ') || 'nothing new'}`
  }
  const cost = eps.reduce((a, e) => a + (e.usage.cost ?? 0), 0)
  const calls = eps.reduce((a, e) => a + e.usage.calls, 0)
  const pictures = types.filter((t) => t.art).map((t) => picture(t.id, t.art!))
  const r: Result = { case: c.name, kind: c.find ? 'find' : 'create', pass, why, holes, routes: eps.map((e) => e.route ?? []), needed: eps.flatMap((e) => e.needed ?? []), calls, cost, s: (Date.now() - t0) / 1000, rules: rules.map((x) => ({ id: x.id, doc: x.doc })), types: types.map((t) => ({ id: t.id, name: t.name, tags: t.tags, material: t.props?.material, makeup: t.makeup })), pictures }
  results.push(r)
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${why}`)
  console.log(`  holes: ${holes}`)
  console.log(`  routes ${r.routes.map((x) => x.join(' → ')).join(' | ')}${r.needed.length ? ` (needed: ${r.needed.join(', ')})` : ''} · ${r.calls} calls · $${(r.cost ?? 0).toFixed(3)} · ${r.s.toFixed(1)} s`)
  for (const x of r.rules) console.log(`  rule ${x.id}: ${x.doc}`)
}
const sum = (k: 'find' | 'create') => {
  const rs = results.filter((r) => r.kind === k)
  return `${k} ${rs.filter((r) => r.pass).length}/${rs.length}`
}
const cost = results.reduce((a, r) => a + (r.cost ?? 0), 0)
console.log(`\nSUMMARY ${model.name}: ${sum('find')} · ${sum('create')} · $${cost.toFixed(2)} in all · written ${out}`)
writeFileSync(join(out, 'results.json'), JSON.stringify({ model: model.name, results }, null, 2))
