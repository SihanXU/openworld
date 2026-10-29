// The live evaluations of the modder on OpenWorld, with a real model (the live profile; review, reflection and
// escalation off): each runs the modder in-process on a fresh library and self-state, as the game asks it, and
// writes what it did under var/. They cost model calls.
//
//   npm run ford-live -- [filter]        the six kinds of hole on the Ford (fordLive)
//   npm run eval:objects -- [filter]     five acts to find a known thing, five to create a new one (objects)
//   npm run eval:affordance -- [filter]  a bare hand on the affordance set (affordance)
//   a filter keeps the cases whose name contains it ("-stump": all but, for the Ford)

import { mkdtempSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { patchRules, Game, RuleLibrary, ModPort, buildSandbox, AGAIN_AFTER, textOf, type Engine, type Patch, type Rule, type UndefinedRecord, type PixelArt, type TypeDef, type Scenario } from '@openworld/engine'
import { GAME, BASE_RULES, STORY_RULES, buildOntology, decodeChunk } from '@openworld-game/content'
import { openModder, sleep, modelFromEnv, REPO, type Harness, type Modder, type Model, type WorldEpisode } from '@openworld/ai'
import { buildFord } from '../../tools/src/demo/world.ts'
import { SCENARIOS, W, ready, ticks, type Ford } from '../../tools/src/fordScenarios.ts'
import { png } from '../../tools/src/art/png.ts'

/** The model the environment names (live evaluations need one). */
function liveModel(): Model {
  const model = modelFromEnv()
  if (!model) throw new Error('no model: set LSW_MODEL_BACKEND (claude-code, anthropic) or the OpenRouter key')
  return model
}

/** A modder in the live profile on a fresh library and self-state (`prefix` in the temp dir): review, reflection and escalation off. */
export function liveModder(model: Model, prefix: string, label: string, more: Partial<Harness> = {}): Modder {
  const modder = openModder({ game: GAME, data: mkdtempSync(join(tmpdir(), prefix)), model })
  const { state } = modder.opts
  const h = state.harness()
  state.setHarness({ ...h, review: { ...h.review, enabled: false }, reflect: { ...h.reflect, enabled: false }, escalate: false, ...more }, label)
  return modder
}

/** The modder answers what the port asks, live (the port waits for the model, not the clock): its patches and episodes as they come. */
export function answering(port: ModPort, modder: Modder): { patches: Patch[]; episodes: string[] } {
  const patches: Patch[] = []
  const episodes: string[] = []
  port.timeoutTicks = 1e9
  port.provider = {
    resolve: async (req) => {
      const reply = await modder.resolve({ request: req }, 'live')
      if (reply.episode) episodes.push(reply.episode)
      if (reply.patch) patches.push(reply.patch)
      return reply.patch
    },
  }
  return { patches, episodes }
}

/** Follow the act: each answer is replayed, and what it sends on may be the next hole; up to `max` holes or five minutes, then `settle` ticks. */
export async function follow(eng: Engine, port: ModPort, t0: number, max: number, settle: number): Promise<void> {
  while (Date.now() - t0 < 300_000) {
    eng.tick()
    if (!port.records.some((r) => r.status === 'pending' || r.awaiting)) break
    if (port.records.length > max) break
    await sleep(200)
  }
  for (let i = 0; i < settle; i++) eng.tick()
}

export const rulesOf = (patches: Patch[]): Rule[] => patches.flatMap(patchRules)

/** The episodes of these ids that the modder's self-state holds. */
export const episodesOf = (modder: Modder, ids: string[]): WorldEpisode[] =>
  ids.map((id) => modder.opts.state.episode(id) as WorldEpisode | undefined).filter((e): e is WorldEpisode => !!e)

// ---------------------------------------------------------------- the affordance set
// The affordance set (design.md §5.17): a bare hand (E) on things the base rules leave undefined, each labelled
// with what a player would reasonably expect. Positives have a common use for the act — something to sit on, lie
// on, kneel at, drink from — and must get real state; negatives have none — a rock, a fence, moss — and must get a
// short line or nothing, no invented mechanics. It measures the modder's judgment both ways: neither shrugs nor
// invents. The cases are checked without a model (test/modder-affordance.test.ts): each is still a hole.

export interface AffordanceCase {
  name: string
  target: string
  /** what a player would expect of a bare hand on it: a use (real state), or words only (a line, or nothing) */
  expect: 'use' | 'words'
  /** the use, in words (for the record) */
  use?: string
  /** the thing is someone's: its owner stands by (context.whose) */
  owned?: boolean
}

export const AFFORDANCE_CASES: AffordanceCase[] = [
  { name: 'chair', target: 'fixture/furniture/chair', expect: 'use', use: 'sit' },
  { name: 'bench', target: 'fixture/furniture/bench', expect: 'use', use: 'sit' },
  { name: 'log bench', target: 'fixture/furniture/bench/log', expect: 'use', use: 'sit' },
  { name: 'stump', target: 'fixture/nature/stump', expect: 'use', use: 'sit' },
  { name: 'haystack', target: 'fixture/nature/haystack', expect: 'use', use: 'lie in it' },
  { name: 'well', target: 'fixture/water/well', expect: 'use', use: 'draw water, drink' },
  { name: 'fountain', target: 'fixture/water/fountain', expect: 'use', use: 'drink, wash' },
  { name: "someone's chair", target: 'fixture/furniture/chair', expect: 'use', use: 'sit (its owner by)', owned: true },
  { name: 'boulder', target: 'fixture/nature/boulder', expect: 'words' },
  { name: 'fence', target: 'fixture/fence', expect: 'words' },
  { name: 'statue', target: 'fixture/sacred/statue', expect: 'words' },
  { name: 'lamppost', target: 'fixture/light/lamppost', expect: 'words' },
  { name: 'mist', target: 'fixture/nature/mist', expect: 'words' },
  { name: 'dead tree', target: 'fixture/nature/dead_tree', expect: 'words' },
  { name: 'table', target: 'fixture/furniture/table', expect: 'words' },
  { name: 'counter', target: 'fixture/furniture/counter', expect: 'words' },
]

/** The scene of a case: the player beside the thing (and, for an owned one, its owner beside them). */
export function caseScene(c: AffordanceCase): Scenario {
  return {
    entities: [
      { key: 'actor', type: 'actor/person/player', x: 2, y: 2 },
      { key: 'it', type: c.target, x: 2, y: 1, ...(c.owned && { props: { owner: 'owner' } }) },
      ...(c.owned ? [{ key: 'owner', type: 'actor/person', x: 3, y: 1 }] : []),
    ],
    event: {},
  }
}

/** A bare hand on the case's thing, through the engine's own path: the engine and the port that holds its question. */
export function askCase(c: AffordanceCase, lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES])): { eng: Engine; port: ModPort } {
  const eng = buildSandbox(caseScene(c), buildOntology(), lib)
  const port = new ModPort(eng)
  eng.act('hands', 'actor', { e: 'it' }, { instrument: null })
  return { eng, port }
}

// ---------------------------------------------------------------- the Ford's holes
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
export async function fordLive(only?: string): Promise<void> {
  const model = liveModel()
  const modder = liveModder(model, 'lsw-live-', 'live smoke', { revise: false })
  const { state } = modder.opts
  const onto = buildOntology()

  function fresh(): Ford {
    const { index, chunks } = buildFord()
    const game = Game.create(index, onto, new RuleLibrary([...BASE_RULES, ...STORY_RULES, ...modder.opts.library.lib.patches()]))
    for (const c of chunks) game.loadChunk(decodeChunk(c))
    answering(game.mods, modder)
    return ready({ game, eng: game.engine })
  }
  const out: unknown[] = []
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
    const last = state.episodes().at(-1)
    const ep = last && (state.episode(last.id) as WorldEpisode | undefined)
    const rules = ep?.patch ? patchRules(ep.patch) : []
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
}

// ---------------------------------------------------------------- things beyond the request
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
export async function objects(filter?: string): Promise<void> {
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

  const model = liveModel()
  const onto = buildOntology()
  const cases = CASES.filter((c) => !filter || c.name.includes(filter))
  const out = join(REPO, 'var/eval-objects', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(out, { recursive: true })

  const MAX_HOLES = 4

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
    types: { id: string; name: unknown; tags?: string[]; material?: unknown; makeup?: unknown; station?: string }[]
    pictures: string[]
  }
  const results: Result[] = []
  for (const c of cases) {
    const modder = liveModder(model, 'lsw-eval-', 'eval: objects')
    const eng = buildSandbox(
      { entities: [{ key: 'actor', type: 'actor/person/player', x: 2, y: 2 }, { key: 'held', type: c.held, x: 2, y: 2, heldBy: 'actor' }, { key: 'it', type: c.target, x: 2, y: 1, statuses: c.statuses }], event: {} },
      onto,
      new RuleLibrary([...BASE_RULES, ...STORY_RULES]),
    )
    const port = new ModPort(eng)
    const { patches, episodes } = answering(port, modder)
    const before = new Map(Object.values(eng.world.state.entities).map((e) => [e.id, e.type]))
    console.log(`\n=== ${c.name} (${c.find ? 'find' : 'create'})`)
    const t0 = Date.now()
    eng.act('use', 'actor', { e: 'it' })
    if (!port.records.length) {
      console.log('  not a hole any more: skipped')
      continue
    }
    await follow(eng, port, t0, MAX_HOLES, 20)
    const eps = episodesOf(modder, episodes)
    const rules = rulesOf(patches)
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
    const r: Result = { case: c.name, kind: c.find ? 'find' : 'create', pass, why, holes, routes: eps.map((e) => e.route ?? []), needed: eps.flatMap((e) => e.needed ?? []), calls, cost, s: (Date.now() - t0) / 1000, rules: rules.map((x) => ({ id: x.id, doc: x.doc })), types: types.map((t) => ({ id: t.id, name: t.name, tags: t.tags, material: t.props?.material, makeup: t.makeup, station: t.station })), pictures }
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
}

// ---------------------------------------------------------------- the affordance set, live
// The affordance set with a real model (design.md §5.17; the live profile; review, reflection and escalation off):
// a bare hand on each thing of the set, on a fresh library, followed as the game follows it (an answer that sends an
// impulse on may raise its receiver's hole next). The verdict is on the world afterwards, not on the words: a thing
// with a use passes when the answer judged it a use and the scene changed (the one who used it seated, a status,
// a thing made); a thing with none passes when the answer judged it words or nothing and the scene did not change.
// Written to var/eval/affordance/<time>.json. Costs model calls (one or two a case).
//
//   npm run eval:affordance               # the whole set
//   npm run eval:affordance -- chair      # the cases whose name contains it
export async function affordance(filter?: string): Promise<void> {
  const model = liveModel()
  const cases = AFFORDANCE_CASES.filter((c) => !filter || c.name.includes(filter))

  /** What the scene's things are: their type, statuses, numbers and cell, and how many things there are. */
  function stateOf(eng: Engine): string {
    const w = eng.world
    return JSON.stringify(Object.values(w.state.entities).filter((e) => !w.isPlaceless(e)).map((e) => [e.id, e.type, Object.keys(e.statuses ?? {}).sort(), e.props, e.place]))
  }

  interface Result {
    case: string
    expect: 'use' | 'words'
    affords?: string
    changed: boolean
    pass: boolean
    said: string[]
    rules: { id: string; doc?: string; affords?: string }[]
    holes: string
    /** asked again after two more tries, when the first answer gave words (the final answer) */
    again?: { asked: boolean; affords?: string; changed: boolean; pass: boolean; rule?: { id: string; doc?: string } }
    calls: number
    cost: number
    s: number
  }
  const results: Result[] = []
  for (const c of cases) {
    const modder = liveModder(model, 'lsw-afford-', 'eval: affordance')
    const t0 = Date.now()
    // the act raises its question as the game raises it
    const { eng, port } = askCase(c)
    const before = stateOf(eng)
    const { patches, episodes } = answering(port, modder)
    for (const r of port.records) port['ask'](r)
    console.log(`\n=== ${c.name} (${c.expect}${c.use ? `: ${c.use}` : ''})`)
    await follow(eng, port, t0, 3, 10)
    const rules = rulesOf(patches)
    const own = rules.find((r) => r.host?.type === c.target && r.on === 'impulse/handle')
    const changed = stateOf(eng) !== before
    const affords = own?.affords
    const pass = !!own && (c.expect === 'use' ? affords === 'use' && changed : affords !== 'use' && !changed)
    // words are provisional: the player tries twice more, as one who expected more would, and the answer then is final
    let again: Result['again']
    if (affords === 'words') {
      const was = stateOf(eng)
      const seen = patches.length
      for (let i = 1; i < AGAIN_AFTER; i++) {
        eng.act('hands', 'actor', { e: 'it' }, { instrument: null })
        eng.tick()
      }
      const t1 = Date.now()
      while (Date.now() - t1 < 300_000 && port.records.some((r) => r.status === 'pending' || r.awaiting)) {
        eng.tick()
        await sleep(200)
      }
      for (let i = 0; i < 10; i++) eng.tick()
      const next = rulesOf(patches.slice(seen)).find((r) => r.host?.type === c.target && r.on === 'impulse/handle')
      const moved = stateOf(eng) !== was
      again = { asked: !!next, affords: next?.affords, changed: moved, pass: !!next && (c.expect === 'use' ? next.affords === 'use' && moved : next.affords !== 'use' && !moved), rule: next && { id: next.id, doc: next.doc } }
    }
    // the episodes so far, the asking again's too
    const spent = episodesOf(modder, episodes)
    const said = [...eng.world.recent, ...eng.world.fx.flatMap((f) => (f.t === 'log' || f.t === 'say' ? [f.text] : []))].map((t) => textOf(t, 'en')).filter((t) => !/^You reach out|patch rejected/.test(t))
    const r: Result = {
      case: c.name,
      expect: c.expect,
      affords,
      changed,
      pass,
      said: [...new Set(said)].slice(-4),
      rules: rules.map((x) => ({ id: x.id, doc: x.doc, affords: x.affords })),
      again,
      holes: port.records.map((x) => `${x.request.event.host?.type.split('/').pop()} ${x.request.event.kind}: ${x.status}`).join('; '),
      calls: spent.reduce((a, e) => a + e.usage.calls, 0),
      cost: spent.reduce((a, e) => a + (e.usage.cost ?? 0), 0),
      s: (Date.now() - t0) / 1000,
    }
    results.push(r)
    console.log(`  ${pass ? 'PASS' : 'FAIL'} — judged ${affords ?? '(no answer)'}, the scene ${changed ? 'changed' : 'unchanged'} · ${r.calls} calls · ${r.s.toFixed(1)} s`)
    console.log(`  holes: ${r.holes}`)
    for (const x of r.rules) console.log(`  rule ${x.id} [${x.affords ?? '-'}]: ${x.doc ?? ''}`)
    for (const l of r.said) console.log(`  » ${l}`)
    if (again) console.log(`  again: ${again.asked ? `judged ${again.affords}, the scene ${again.changed ? 'changed' : 'unchanged'}: ${again.pass ? 'PASS' : 'FAIL'} — ${again.rule?.doc ?? ''}` : 'not asked'}`)
  }
  const of = (k: 'use' | 'words') => results.filter((r) => r.expect === k)
  const passed = (rs: Result[]) => rs.filter((r) => r.pass).length
  const cost = results.reduce((a, r) => a + r.cost, 0)
  /** The final verdict: the answer asked again where there was one, else the first. */
  const final = (r: Result) => (r.again?.asked ? r.again.pass : r.pass)
  const summary = { model: model.name, final: `${results.filter(final).length}/${results.length}`, finalInvented: of('words').filter((r) => (r.again?.asked ? r.again.affords === 'use' || r.again.changed : r.affords === 'use' || r.changed)).length, reasked: results.filter((r) => r.again?.asked).length, uses: `${passed(of('use'))}/${of('use').length}`, words: `${passed(of('words'))}/${of('words').length}`, accuracy: results.length ? passed(results) / results.length : 0, invented: of('words').filter((r) => r.affords === 'use' || r.changed).length, shrugged: of('use').filter((r) => r.affords !== 'use').length, calls: results.reduce((a, r) => a + r.calls, 0), cost }
  console.log(`\nSUMMARY ${JSON.stringify(summary)}`)
  const out = join(REPO, 'var/eval/affordance')
  mkdirSync(out, { recursive: true })
  const file = join(out, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify({ summary, results }, null, 2))
  console.log(`written ${file}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [which, filter] = process.argv.slice(2)
  const run = { ford: fordLive, objects, affordance }[which ?? '']
  if (!run) throw new Error('which evaluation? ford | objects | affordance')
  await run(filter)
}
