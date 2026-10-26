// The controlled evaluation (paper §7.1): are the answers plausible?
//
//   items          two sets of situations: held-out authored ones (a base rule removed, so the situations it answered
//                  are holes; the author's rule is the reference, condition C) and genuinely undefined ones (the
//                  coverage sweep's, stratified by the hand's family and the target's class)
//   answer <cond>  each situation answered: A, the modder (live, its rule replayed in the scene once its review and
//                  audit have run); B, a narrator (the same model told the scene and the world, saying what happens,
//                  no rule, no check); C, the authors' removed rule; and A without one part of the pipeline:
//                  no-brief, no-fixes, no-test, no-review, no-audit, no-router
//   judge          a model rates every outcome sentence (does it make sense, does it fit this world: 1–7) and chooses
//                  between the conditions on each situation, two at a time (TrueSkill over the choices)
//   report         the table (var/eval/controlled/table.json)
//
// A and C are told by one template from what the replay did; B is asked for a sentence in that template's style; the
// judge is not told which condition wrote what. Costs model calls (the anthropic backend: LSW_MODEL_BACKEND=anthropic).
//
//   npx tsx games/openworld/tools/src/eval/controlled.ts items [--n 30] [--seed 7]
//   npx tsx games/openworld/tools/src/eval/controlled.ts answer A|B|C|no-brief|... [--lanes 4]
//   npx tsx games/openworld/tools/src/eval/controlled.ts judge | report

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RuleLibrary, buildSandbox, scenarioEvent, textOf, type ModRequest, type Ontology, type Rule } from '@openworld/engine'
import { modelFromEnv, openModder, parseJson, type Model, type WorldEpisode } from '@openworld/ai'
import { BASE_RULES, GAME, STORY_RULES, TERRAINS, buildOntology } from '@openworld-game/content'
import { GENERIC_RULES, sweep, type Cell } from '../../../tools/src/coverage.ts'
import { cellRequest } from '../curriculum.ts'
import { trueskill, type Choice } from './trueskill.ts'

const argv = process.argv.slice(2)
const opt = (k: string, d?: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
const DIR = opt('data', 'var/eval/controlled')!
mkdirSync(DIR, { recursive: true })
const onto = buildOntology()
const read = <T,>(f: string): T => JSON.parse(readFileSync(join(DIR, f), 'utf8'))
const write = (f: string, x: unknown) => writeFileSync(join(DIR, f), JSON.stringify(x, null, 1))

interface Item {
  id: string
  set: 'heldout' | 'undefined'
  cell: Cell
  /** the authored rule removed (held-out situations) */
  heldOut?: string
}

/** The base rules without one of them (a held-out situation's world). */
const rulesWithout = (id?: string): Rule[] => [...BASE_RULES.filter((r) => r.id !== id), ...STORY_RULES]
const libWithout = (id?: string) => new RuleLibrary(rulesWithout(id))

// ---------------------------------------------------------------- items

let seed = Number(opt('seed', '7'))
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const familyOf = (type: string) => type.split('/').slice(0, 2).join('/') || 'hand'
const targetClass = (t: string) => (t.startsWith('fixture/') ? 'fixture' : t.startsWith('tile:') ? 'ground' : t)
/** Up to n from the groups in turn (each shuffled), so every group is drawn from before any twice. */
function stratified<T>(xs: T[], key: (x: T) => string, n: number): T[] {
  const groups = new Map<string, T[]>()
  for (const x of shuffle(xs)) groups.set(key(x), [...(groups.get(key(x)) ?? []), x])
  const out: T[] = []
  for (let round = 0; out.length < n && [...groups.values()].some((g) => g.length > round); round++)
    for (const g of groups.values()) if (g[round] !== undefined && out.length < n) out.push(g[round])
  return out
}

function items(): void {
  const n = Number(opt('n', '30'))
  const cells = sweep(onto).cells.filter((c) => c.verb === 'use')
  // held out: an authored rule that answers a use, whose situation becomes a hole without it
  const byRule = new Map<string, Cell>()
  for (const c of cells) if (c.outcome === 'specific' && c.rule && !GENERIC_RULES[c.rule] && BASE_RULES.some((r) => r.id === c.rule) && !byRule.has(c.rule)) byRule.set(c.rule, c)
  const held: Item[] = []
  for (const [rule, cell] of stratified([...byRule], ([, c]) => familyOf(c.hand), byRule.size)) {
    if (held.length >= n) break
    if (!cellRequest(cell, onto, libWithout(rule))) continue
    held.push({ id: `h${held.length + 1}`, set: 'heldout', cell, heldOut: rule })
  }
  // undefined: by the hand's family and the target's class
  const open = stratified(cells.filter((c) => c.outcome === 'undefined'), (c) => `${familyOf(c.hand)}|${targetClass(c.target)}`, n * 3)
  const und: Item[] = []
  for (const cell of open) {
    if (und.length >= n) break
    if (cellRequest(cell, onto, libWithout())) und.push({ id: `u${und.length + 1}`, set: 'undefined', cell })
  }
  write('items.json', [...held, ...und])
  console.log(`${held.length} held-out (of ${byRule.size} authored rules that answer a use), ${und.length} undefined`)
}

// ---------------------------------------------------------------- what happened, told

const nameOf = (o: Ontology, type: string) => textOf(o.types[type]?.name) || type.split('/').pop()!.replace(/_/g, ' ')
const terrainName = (id: string) => textOf(TERRAINS.find((t) => t.id === id)?.name) || id.replace(/_/g, ' ')
const TARGET_WORDS: Record<string, string> = { person: 'a villager', creature: 'a green slime', self: 'yourself', item: 'a stone lying on the ground' }

/** The player's act, as the cell says it: what was held, on what. */
function actOf(cell: Cell): string {
  const hand = cell.hand ? `the ${nameOf(onto, cell.hand)}` : 'your bare hand'
  const t = cell.target
  const [type, state] = t.split('#')
  const target = TARGET_WORDS[t] ?? (t.startsWith('tile:') ? `the ${terrainName(t.slice(5))}` : `the ${nameOf(onto, type)}${state ? ` (${state})` : ''}`)
  return `You use ${hand} on ${target}`
}

/**
 * The outcome of a situation under a library, in one sentence: the player's act, then what the replay of the event
 * that asked changed — statuses gained and lost, things made, gone or become another, health lost or gained — and
 * what was said or written.
 */
function told(cell: Cell, req: ModRequest, lib: RuleLibrary, o: Ontology): string {
  const sb = buildSandbox(req.scenario, o, lib)
  const w = sb.world
  const snap = () => new Map(Object.values(w.state.entities).filter((e: any) => !['story', 'world'].includes(e.id) && e.place?.on !== 'none').map((e: any) => [e.id, { type: e.type as string, st: Object.keys(e.statuses ?? {}), hp: e.props?.hp as number | undefined }]))
  const before = snap()
  const ev = scenarioEvent(req.scenario, sb)
  sb.dispatch(ev)
  for (let t = 0; t < 20; t++) sb.tick()
  const after = snap()
  const label = (type: string) => (type.startsWith('tile/') ? terrainName(type.slice(5)) : nameOf(o, type))
  const who = (id: string) => (id === 'actor' || before.get(id)?.type.startsWith('actor/person/player') ? 'you' : `the ${label((before.get(id) ?? after.get(id))!.type)}`)
  const statusName = (s: string) => textOf((o.statuses as any)[s]?.name)
  const parts: string[] = []
  for (const [id, a] of after) {
    const b = before.get(id)
    if (!b) continue
    if (a.type !== b.type) parts.push(`${who(id)} become${who(id) === 'you' ? '' : 's'} ${label(a.type)}`)
    for (const x of a.st.filter((x) => !b.st.includes(x) && statusName(x))) parts.push(`${who(id)} ${who(id) === 'you' ? 'are' : 'is'} ${statusName(x)}`)
    for (const x of b.st.filter((x) => !a.st.includes(x) && statusName(x))) parts.push(`${who(id)} ${who(id) === 'you' ? 'are' : 'is'} no longer ${statusName(x)}`)
    if (typeof a.hp === 'number' && typeof b.hp === 'number' && a.hp !== b.hp) parts.push(`${who(id)} ${a.hp < b.hp ? 'lose' : 'gain'}${who(id) === 'you' ? '' : 's'} ${Math.abs(a.hp - b.hp)} health`)
  }
  for (const id of before.keys()) if (!after.has(id) && !before.get(id)!.type.startsWith('tile/')) parts.push(`${who(id)} is gone`)
  const made = new Map<string, number>()
  for (const [id, a] of after) if (!before.has(id) && !a.type.startsWith('tile/')) made.set(a.type, (made.get(a.type) ?? 0) + 1)
  for (const [type, k] of made) parts.push(`${k > 1 ? `${k} ${label(type)}` : `a ${label(type)}`} appear${k > 1 ? '' : 's'}`)
  const words = w.fx.filter((f: any) => f.t === 'log' || f.t === 'say').map((f: any) => `"${textOf(f.text)}"`).slice(0, 2)
  const happened = [...parts.slice(0, 4), ...words]
  return `${actOf(cell)}: ${happened.length ? happened.join('; ') : 'nothing happens'}.`
}

/** The scene as a rater (and the narrator) is told it: the act, and who is there, what they are. */
function sceneOf(cell: Cell, req: ModRequest): string {
  const ps = [req.event.host, ...Object.values(req.event.roles)].filter(Boolean) as { role: string; name: string; type: string; statuses?: string[]; tags?: string[] }[]
  const seen = new Set<string>()
  const lines = ps.filter((p) => !seen.has(p.type) && seen.add(p.type)).map((p) => `- ${p.name} (${p.type}${p.statuses?.length ? `; ${p.statuses.join(', ')}` : ''}${p.tags?.length ? `; ${p.tags.slice(0, 6).join(', ')}` : ''})`)
  return `${actOf(cell)}.\nIn the scene:\n${lines.join('\n')}\nPlace: ${req.context.map.name}, hour ${Math.floor(req.context.hour)}.`
}

const WORLD_BRIEF = 'A 2D role-playing world on the Frostfang Coast, a cold northern land of villages, fords, forests and barrows. Its people keep the faith of the Five Sufferings (a martyr bore five punishments to end a Long Night); things are made of materials (wood, iron, cloth, stone…), and the elements (fire, water, ice, lightning, wind, earth) act on them as physics.'

// ---------------------------------------------------------------- answers

const ABLATIONS: Record<string, (h: any) => any> = {
  A: (h) => h,
  'no-brief': (h) => ({ ...h, design: { ...h.design, brief: false } }),
  'no-fixes': (h) => ({ ...h, design: { ...h.design, fixes: false } }),
  'no-test': (h) => ({ ...h, design: { ...h.design, tests: 'model' } }),
  'no-review': (h) => ({ ...h, review: { ...h.review, enabled: false } }),
  'no-audit': (h) => ({ ...h, audit: { ...h.audit, enabled: false } }),
  'no-router': (h) => ({ ...h, design: { ...h.design, router: false } }),
}

interface Answer {
  item: string
  cond: string
  sentence: string
  /** the modder's: accepted, valid at its first answer, after repairs; the player's wait; cost */
  accepted?: boolean
  firstValid?: boolean
  ms?: number
  cost?: number
  calls?: number
  rules?: string[]
  route?: string[]
  error?: string
}

async function pool<T, R>(xs: T[], lanes: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length)
  let next = 0
  await Promise.all(Array.from({ length: lanes }, async () => {
    for (let i = next++; i < xs.length; i = next++) out[i] = await f(xs[i])
  }))
  return out
}

async function answerA(item: Item, cond: string, model: Model): Promise<Answer> {
  const modder = openModder({ game: { ...GAME, rules: rulesWithout(item.heldOut) }, data: mkdtempSync(join(tmpdir(), `lsw-ctl-${cond}-`)), model })
  const { library, state } = modder.opts
  // reflection shapes later episodes, not this answer: off in every condition (it costs, and nothing here comes after)
  state.setHarness(ABLATIONS[cond]({ ...state.harness(), reflect: { ...state.harness().reflect, enabled: false } }), `controlled ${cond}`)
  const req = cellRequest(item.cell, library.fullOntology(), library.lib)
  if (!req) return { item: item.id, cond, sentence: '', error: 'not a hole' }
  const reply = await modder.resolve({ request: req }, 'live')
  await modder.settled()
  const ep = state.episode(reply.episode!) as WorldEpisode
  // what a later player meets: the library as it stands once the review and the audit are done
  const sentence = told(item.cell, req, library.lib, library.fullOntology())
  return {
    item: item.id, cond, sentence,
    accepted: ep.outcome === 'accepted', firstValid: !!ep.attempts[0] && !ep.attempts[0].errors.length,
    ms: ep.ms, cost: ep.usage.cost, calls: ep.usage.calls, rules: ep.rules, route: ep.route,
  }
}

async function answerB(item: Item, model: Model): Promise<Answer> {
  const req = cellRequest(item.cell, onto, libWithout(item.heldOut))!
  const style = actOf(item.cell)
  const t0 = Date.now()
  const r = await model.chat([
    { role: 'system', content: `You are the game master of this world. ${WORLD_BRIEF}` },
    { role: 'user', content: `${sceneOf(item.cell, req)}\n\nSay what happens, as one sentence in exactly this style: "${style}: <what changes, separated by semicolons>." Say only what happens to the things in the scene (statuses gained or lost, things that appear or are gone, health lost), or "nothing happens". Reply with JSON {"sentence": "..."}.` },
  ], { json: true, reasoning: 'low' })
  const parsed = parseJson(r.content) as { sentence?: string } | undefined
  return { item: item.id, cond: 'B', sentence: parsed?.sentence ?? r.content.trim(), ms: Date.now() - t0, cost: r.usage?.cost, calls: 1 }
}

function answerC(item: Item): Answer {
  const req = cellRequest(item.cell, onto, libWithout(item.heldOut))!
  return { item: item.id, cond: 'C', sentence: told(item.cell, req, libWithout(), onto) }
}

async function answer(cond: string): Promise<void> {
  const all = read<Item[]>('items.json')
  const list = cond === 'C' ? all.filter((i) => i.set === 'heldout') : all
  const model = cond === 'C' ? undefined : modelFromEnv()
  if (cond !== 'C' && !model) throw new Error('no model (LSW_MODEL_BACKEND=anthropic)')
  const file = `answers-${cond}.json`
  const done: Answer[] = existsSync(join(DIR, file)) ? read<Answer[]>(file) : []
  const todo = list.filter((i) => !done.some((a) => a.item === i.id && !a.error))
  const out = await pool(todo, Number(opt('lanes', '4')), async (item) => {
    try {
      const a = cond === 'C' ? answerC(item) : cond === 'B' ? await answerB(item, model!) : await answerA(item, cond, model!)
      console.log(`${item.id} ${cond}: ${a.sentence.slice(0, 140)}${a.cost ? `  $${a.cost.toFixed(3)}` : ''}`)
      return a
    } catch (err) {
      console.log(`${item.id} ${cond}: error ${(err as Error).message.slice(0, 200)}`)
      return { item: item.id, cond, sentence: '', error: (err as Error).message.slice(0, 300) }
    }
  })
  write(file, [...done.filter((a) => !a.error && !out.some((b) => b.item === a.item)), ...out])
}

// ---------------------------------------------------------------- the judge

interface Rating { item: string; cond: string; sense: number; fit: number }

async function judge(): Promise<void> {
  const model = modelFromEnv()
  if (!model) throw new Error('no model (LSW_MODEL_BACKEND=anthropic)')
  const all = read<Item[]>('items.json')
  const conds = Object.keys(ABLATIONS).concat(['B', 'C']).filter((c) => existsSync(join(DIR, `answers-${c}.json`)))
  const answers = conds.flatMap((c) => read<Answer[]>(`answers-${c}.json`)).filter((a) => a.sentence)
  const ratings: Rating[] = existsSync(join(DIR, 'ratings.json')) ? read('ratings.json') : []
  const system = `You judge outcomes in a game world. ${WORLD_BRIEF} You are shown a scene and one sentence saying what happens. You do not know who wrote it.`
  const sceneOfItem = new Map(all.map((i) => [i.id, sceneOf(i.cell, cellRequest(i.cell, onto, libWithout(i.heldOut))!)]))
  const todo = answers.filter((a) => !ratings.some((r) => r.item === a.item && r.cond === a.cond))
  const fresh = await pool(todo, 6, async (a) => {
    const r = await model.chat([{ role: 'system', content: system }, { role: 'user', content: `${sceneOfItem.get(a.item)}\n\nWhat happens: ${a.sentence}\n\nRate from 1 to 7: sense (does the outcome make sense for these things?) and fit (does it fit this world?). Reply with JSON {"sense": n, "fit": n}.` }], { json: true, reasoning: 'low' })
    const p = parseJson(r.content) as { sense?: number; fit?: number } | undefined
    return { item: a.item, cond: a.cond, sense: Number(p?.sense ?? 0), fit: Number(p?.fit ?? 0) }
  })
  write('ratings.json', [...ratings, ...fresh])
  // two at a time: A, B and C on each situation (C where there is one), the ablations against A
  const choices: Choice[] = existsSync(join(DIR, 'choices.json')) ? read('choices.json') : []
  const pairs: [string, string, string][] = []
  for (const i of all) {
    const have = (c: string) => answers.find((a) => a.item === i.id && a.cond === c)
    const main = ['A', 'B', ...(i.set === 'heldout' ? ['C'] : [])].filter(have)
    for (let x = 0; x < main.length; x++) for (let y = x + 1; y < main.length; y++) pairs.push([i.id, main[x], main[y]])
    for (const c of Object.keys(ABLATIONS).filter((c) => c !== 'A' && have(c))) pairs.push([i.id, 'A', c])
  }
  const todoPairs = pairs.filter(([id, a, b]) => !choices.some((c) => c.item === id && c.a === a && c.b === b))
  const freshChoices = await pool(todoPairs, 6, async ([id, a, b]) => {
    const sa = answers.find((x) => x.item === id && x.cond === a)!.sentence
    const sb = answers.find((x) => x.item === id && x.cond === b)!.sentence
    const flip = rnd() < 0.5
    const [one, two] = flip ? [sb, sa] : [sa, sb]
    const r = await model.chat([{ role: 'system', content: system }, { role: 'user', content: `${sceneOfItem.get(id)}\n\nOutcome 1: ${one}\nOutcome 2: ${two}\n\nWhich outcome makes more sense and fits this world better? Reply with JSON {"better": 1} or {"better": 2}.` }], { json: true, reasoning: 'low' })
    const p = parseJson(r.content) as { better?: number } | undefined
    const first = p?.better === 1
    const winner = (first !== flip) ? a : b
    return { item: id, a, b, winner }
  })
  write('choices.json', [...choices, ...freshChoices])
  console.log(`${fresh.length} ratings, ${freshChoices.length} choices`)
}

// ---------------------------------------------------------------- the table

function report(): void {
  const all = read<Item[]>('items.json')
  const ratings: Rating[] = existsSync(join(DIR, 'ratings.json')) ? read('ratings.json') : []
  const choices: Choice[] = existsSync(join(DIR, 'choices.json')) ? read('choices.json') : []
  const ts = trueskill(choices)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]
  const rows: Record<string, unknown>[] = []
  for (const cond of ['A', 'B', 'C', ...Object.keys(ABLATIONS).filter((c) => c !== 'A')]) {
    if (!existsSync(join(DIR, `answers-${cond}.json`))) continue
    const ans = read<Answer[]>(`answers-${cond}.json`).filter((a) => a.sentence || a.error)
    for (const set of ['all', 'heldout', 'undefined']) {
      const ids = new Set(all.filter((i) => set === 'all' || i.set === set).map((i) => i.id))
      const a = ans.filter((x) => ids.has(x.item))
      const r = ratings.filter((x) => x.cond === cond && ids.has(x.item))
      if (!a.length) continue
      rows.push({
        cond, set, n: a.length,
        sense: +mean(r.map((x) => x.sense)).toFixed(2), fit: +mean(r.map((x) => x.fit)).toFixed(2),
        trueskill: set === 'all' && ts[cond] ? +ts[cond].mu.toFixed(1) : undefined,
        accepted: a[0].accepted === undefined ? undefined : a.filter((x) => x.accepted).length / a.length,
        firstValid: a[0].firstValid === undefined ? undefined : a.filter((x) => x.firstValid).length / a.length,
        waitP50: a[0].ms === undefined ? undefined : +(pct(a.map((x) => x.ms ?? 0), 0.5) / 1000).toFixed(1),
        waitP90: a[0].ms === undefined ? undefined : +(pct(a.map((x) => x.ms ?? 0), 0.9) / 1000).toFixed(1),
        cost: a.some((x) => x.cost !== undefined) ? +mean(a.map((x) => x.cost ?? 0)).toFixed(3) : undefined,
      })
    }
  }
  write('table.json', { rows, trueskill: ts, choices: choices.length })
  for (const r of rows) console.log(JSON.stringify(r))
}

/**
 * One situation, one outcome? The narrator asked the same situation five times (the rule, being code, gives one
 * outcome every time): how many different outcomes it says, by what changes (the sentence after the act, its parts
 * as a set, case and punctuation aside).
 */
async function repeat(): Promise<void> {
  const model = modelFromEnv()
  if (!model) throw new Error('no model (LSW_MODEL_BACKEND=anthropic)')
  const all = read<Item[]>('items.json').filter((i) => i.set === 'undefined')
  const times = Number(opt('times', '5'))
  const out = await pool(all, 6, async (item) => {
    const said: string[] = []
    for (let k = 0; k < times; k++) said.push((await answerB(item, model)).sentence)
    const key = (x: string) => x.split(':').slice(1).join(':').toLowerCase().replace(/[^a-z0-9; ]/g, '').split(';').map((p) => p.trim()).filter(Boolean).sort().join(';')
    return { item: item.id, said, distinct: new Set(said.map(key)).size }
  })
  write('repeat-B.json', out)
  const d = out.map((x) => x.distinct)
  console.log(`narrator, ${times} times each on ${out.length} situations: one outcome on ${d.filter((x) => x === 1).length}; mean ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2)} different outcomes`)
}

const [cmd, arg] = argv
if (cmd === 'items') items()
else if (cmd === 'answer') await answer(arg)
else if (cmd === 'judge') await judge()
else if (cmd === 'report') report()
else if (cmd === 'repeat') await repeat()
else console.log('items | answer <cond> | judge | report')
