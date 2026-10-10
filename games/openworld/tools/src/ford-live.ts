// The AI interface on the Ford with a real model (the live profile; review, reflection and
// escalation off). Each scenario reaches one kind of hole through the game's own path — an
// undefined use, a blow on what cannot break, a hand on what does not say, a rope used on a
// creature, a person stuck, content broken (taking and putting are physics: never asked) — and
// the modder answers in-process, with a fresh library and self-state. The record, the episode
// and what the game did with the patch are printed and written to var/live-smoke/. Costs model
// calls (~$0.05 a scenario with Kimi K3).
//
//   npm run ford-live                 # all six
//   npm run ford-live -- "stump"      # the scenarios whose name contains it ("-stump": all but)

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Game, RuleLibrary, TICKS_PER_HOUR, tickAt, type Engine, type Entity, type Key, type UndefinedRecord } from '@openworld/engine'
import { BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { modelFromEnv, openModder, type WorldEpisode } from '@openworld/modder'
import { AT, STAND, buildFord } from './demo/world.ts'

openModder({ data: mkdtempSync(join(tmpdir(), 'lsw-warm-')), model: null }) // loads .env
const model = modelFromEnv()
if (!model) throw new Error('no model')
const modder = openModder({ data: mkdtempSync(join(tmpdir(), 'lsw-live-')), model })
const { state } = modder.opts
const h = state.harness()
state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, revise: false }, 'live smoke')
const onto = buildOntology()

interface Ford {
  game: Game
  eng: Engine
}
function fresh(): Ford {
  const { index, chunks } = buildFord()
  const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES, ...modder.opts.library.lib.patches()]))
  for (const c of chunks) game.loadChunk(decodeChunk(c))
  game.mods.timeoutTicks = 1e9 // the test waits for the model, not the clock
  game.mods.provider = {
    resolve: async (req) => {
      const r = await modder.resolve({ request: req }, 'live')
      return r.patch
    },
  }
  const eng = game.engine
  const w = eng.world
  eng.author(() => {
    w.setFact('seen.arrival', true)
    w.player.props!.quest = 1
    w.create('item/food/bread', { on: 'inside', holder: 'player' })
    eng.controls.sync()
  })
  return { game, eng }
}
const W = (f: Ford) => f.eng.world
const ofType = (f: Ford, type: string) => Object.values(W(f).state.entities).find((e) => e.type === type)!
const stand = (f: Ford, x: number, y: number, facing: Entity['facing'] = 'up') => f.eng.author(() => (W(f).place(W(f).player, { on: 'tile', map: 'ford', x, y }), (W(f).player.facing = facing)))
function hold(f: Ford, e: Entity): void {
  f.eng.author(() => W(f).place(e, { on: 'inside', holder: 'player' }))
  f.eng.controls.sync()
  f.eng.controls.select(W(f).player.slots!.indexOf(f.eng.controls.key(e)))
}
const run = (f: Ford, key: Key, x: number, y: number, layer?: number) => {
  const plan = f.eng.controls.plan(key, { x, y }, layer)
  if (!plan) throw new Error(`no plan for ${key} at ${x},${y}`)
  f.eng.controls.run(plan, true)
  return plan
}
const ticks = (f: Ford, n: number, until?: () => boolean) => {
  for (let i = 0; i < n; i++) {
    if (W(f).scene?.waiting === 'advance') f.eng.story.advance()
    f.eng.tick()
    if (until?.()) return true
  }
  return false
}

const SCENARIOS: { name: string; act: (f: Ford) => void }[] = [
  {
    name: 'bread used on the winch (act/use)',
    act: (f) => {
      hold(f, ofType(f, 'item/food/bread'))
      stand(f, ...STAND.winch)
      run(f, 'use', ...AT.winch)
    },
  },
  {
    name: 'the axe on the chopping stump (strike)',
    act: (f) => {
      const stump = ofType(f, 'fixture/nature/stump')
      const { x, y } = stump.place as { x: number; y: number }
      hold(f, ofType(f, 'item/weapon/blade/axe'))
      stand(f, x - 1, y, 'right')
      f.eng.controls.run(f.eng.controls.plan('use', { x, y, stack: [{ e: stump.id }] })!, true)
    },
  },
  {
    name: 'a bare hand on the raft (handle)',
    act: (f) => {
      stand(f, ...STAND.raft, 'right')
      run(f, 'hands', ...AT.raft)
    },
  },
  {
    name: 'a rope used on a fire slime (use)',
    act: (f) => {
      const slime = W(f).get('ford.fire_slime')!
      stand(f, ...STAND.road, 'right')
      f.eng.author(() => W(f).place(slime, { on: 'tile', map: 'ford', x: STAND.road[0] + 1, y: STAND.road[1] }))
      hold(f, ofType(f, 'item/tool/rope'))
      run(f, 'use', STAND.road[0] + 1, STAND.road[1])
    },
  },
  {
    name: 'Hesper cannot tend her soaked fire (stuck)',
    act: (f) => {
      W(f).state.tick = tickAt(2, 17.8)
      const fire = W(f).get('ford.campfire')!
      f.eng.author(() => {
        W(f).clearStatus({ e: fire.id }, 'lit')
        W(f).setStatus({ e: fire.id }, 'wet', W(f).state.tick + 4000)
      })
      stand(f, ...AT.spawn)
      ticks(f, TICKS_PER_HOUR, () => f.game.mods.records.length > 0)
    },
  },
  {
    name: 'the rope burns (broken)',
    act: (f) => {
      const rope = ofType(f, 'item/tool/rope')
      f.eng.author(() => W(f).place(rope, { on: 'tile', map: 'ford', x: STAND.road[0], y: STAND.road[1] }))
      f.eng.queue({ kind: 'impulse/element', host: { e: rope.id }, roles: {}, params: { element: 'fire', power: 2 }, origin: 'world' })
      ticks(f, 300, () => f.game.mods.records.length > 0)
    },
  },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const out: unknown[] = []
const only = process.argv[2]
for (const sc of SCENARIOS) {
  if (only && (only.startsWith('-') ? sc.name.includes(only.slice(1)) : !sc.name.includes(only))) continue
  const f = fresh()
  const t0 = Date.now()
  try {
    sc.act(f)
  } catch (err) {
    out.push({ scenario: sc.name, error: (err as Error).message })
    console.log(`\n## ${sc.name}\n  setup failed: ${(err as Error).message}`)
    continue
  }
  const rec: UndefinedRecord | undefined = f.game.mods.records[0]
  if (!rec) {
    out.push({ scenario: sc.name, error: 'no request raised' })
    console.log(`\n## ${sc.name}\n  no request raised`)
    continue
  }
  const heldWhileWaiting = Object.values(W(f).state.entities).filter((e) => e.frozenBy === rec.id).map((e) => e.id)
  while ((rec.status === 'pending' || rec.awaiting) && Date.now() - t0 < 120_000) await sleep(100)
  const ms = Date.now() - t0
  // what the game does with it now: the replay, and the same act again
  f.eng.trace.length = 0
  ticks(f, 5)
  const replayed = f.eng.trace.filter((t) => t.rule?.startsWith('patch/')).map((t) => `${t.ev.kind}@${'e' in t.ev.host ? t.ev.host.e : 'tile'} → ${t.rule}`)
  const ep = state.episodes().at(-1) ? (state.episode(state.episodes().at(-1)!.id) as WorldEpisode | undefined) : undefined
  const rules = (ep?.patch?.artifacts ?? []).flatMap((a) => (a.kind === 'rule' ? [a.rule] : []))
  const row = {
    scenario: sc.name,
    request: { summary: rec.request.summary, kind: rec.request.event.kind, host: rec.request.event.host?.type, hole: rec.request.hole, origin: rec.origin },
    heldWhileWaiting,
    status: rec.status,
    ms,
    episode: ep && { id: ep.id, outcome: ep.outcome, attempts: ep.attempts.map((a) => ({ phase: a.phase, errors: a.errors, fixes: (a as { fixes?: string[] }).fixes, derived: (a as { derived?: string[] }).derived })), usage: ep.usage, calls: ep.calls?.map((c) => ({ ms: c.ms, out: c.output, reasoning: c.reasoning, provider: c.provider })) },
    rules,
    replayed,
    stillHeld: Object.values(W(f).state.entities).filter((e) => e.frozenBy === rec.id).map((e) => e.id),
    fx: W(f).fx.filter((x) => x.t === 'log' || x.t === 'say').slice(-4).map((x) => ('text' in x ? (typeof x.text === 'string' ? x.text : x.text.en) : '')),
  }
  out.push(row)
  console.log(`\n## ${sc.name}`)
  console.log(`  request: ${row.request.summary} | ${row.request.kind} host ${row.request.host} hole ${row.request.hole.rule}${row.request.hole.path.length ? ' via ' + row.request.hole.path.join(' & ') : ''} (${row.request.origin}); held: ${heldWhileWaiting.join(',') || '—'}`)
  console.log(`  → ${rec.status} in ${(ms / 1000).toFixed(1)} s; episode ${ep?.outcome} after ${ep?.attempts.length} attempt(s), ${ep?.usage.calls} call(s), $${(ep?.usage.cost ?? 0).toFixed(4)}`)
  for (const a of ep?.attempts ?? []) console.log(`    ${a.phase}: ${a.errors.length ? a.errors.slice(0, 3).join(' | ') : 'valid'}`)
  for (const r of rules) console.log(`  rule ${r.id} [${r.on}] host ${JSON.stringify(r.host)}: ${r.doc ?? ''}\n    ${JSON.stringify(r.tree).slice(0, 600)}`)
  console.log(`  replay: ${replayed.join('; ') || '—'}; still held: ${row.stillHeld.join(',') || '—'}; lines: ${row.fx.join(' / ')}`)
}
mkdirSync('var/live-smoke', { recursive: true })
const file = `var/live-smoke/${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(file, JSON.stringify(out, null, 1))
let cost = state.episodes().reduce((s, e) => s + ((state.episode(e.id) as WorldEpisode | undefined)?.usage.cost ?? 0), 0)
// the auditor works after shipping: wait for it, then say what it found (and what it could not show)
await modder.settled()
const journal = join(state.dir, 'journal.jsonl')
const audits = existsSync(journal) ? readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.kind === 'audit') : []
console.log(`\n## the auditor (${audits.length} audit(s))`)
for (const a of audits) {
  console.log(`  ${a.episode} ${a.rules.join(', ')}: ${a.skipped ? `skipped (${a.skipped})` : a.error ? `FAILED (${a.error}): not audited` : a.confirmed.length ? `BROKEN — ${a.confirmed.map((f: { kind: string; title: string }) => `${f.kind}: ${f.title}`).join('; ')} → removed` : 'nothing confirmed'}; ${a.usage.calls} call(s), $${(a.usage.cost ?? 0).toFixed(4)}`)
  for (const u of a.unconfirmed) console.log(`    not shown: ${u}`)
  cost += a.usage.cost ?? 0
}
writeFileSync(file.replace(/\.json$/, '.audits.json'), JSON.stringify(audits, null, 1))
console.log(`\nwritten ${file}; total cost $${cost.toFixed(3)}`)
