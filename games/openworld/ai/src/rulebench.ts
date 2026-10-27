// The rule bench: does the modder's own reflection (docs/rsi.md §4.1) make it better at writing rules, as it works?
// A frozen set of holes of the coverage sweep, chosen as kinds of task that recur: N nodes (the reflection's unit:
// the event kind, the hole, the host's class and the other role's, cut at depth 2 of the type tree), K holes each,
// each of its own host type, so no hole is answered by another's patch (that is amortization, not reflection). Every
// arm works the same holes in the same order, from an empty self-state and an empty library of its own, live, and
// waits for its reflections before the next hole: so what one teaches is there for the next. What is measured, per
// hole: whether it was accepted, whether its first answer held, the calls, the tokens (the design's and the
// reflections'), the time; and all of it by the hole's place among its node's (the first of its kind … the K-th).
//
//   npm run rulebench -- build [--nodes 20 --per 10 --seed 1 --out games/openworld/ai/bench/rulebench.json]
//   npm run rulebench -- run --arm on|rules|off [--rep 1] [--bench <file>] [--data var/rulebench] [--label <name>]
//                                [--nodes n --per k: the small bench, the first n nodes and the first k holes of each]
//                                [--order interleaved|shuffled] [--checks on: the audit, the review and revisions too]
//   npm run rulebench -- report [--data var/rulebench]
//
// Arms: `on`, the self-state as it is (rules, notes, skills); `off`, memory and skills left out (SelfState ablation)
// and no reflection, the same harness otherwise; `rules`, the reflection with its skills left out (what the nodes'
// skills add over the global rules). The audit, the review and revisions after an answer ships are off in
// every arm (they are not what is measured, and the validator's economy and repeat checks stay). A rep shuffles the nodes' order (seeded), so a rep is a different stream of the same holes.

import { execSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Rng } from '@openworld/engine'
import { GAME } from '@openworld-game/content'
import { Modder, SelfState, WorldLibrary, modelFromEnv, type Ablation } from '@openworld/ai'
import { sweep, type Cell } from '../../tools/src/coverage.ts'
import { cellRequest } from './curriculum.ts'

const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const BENCH = join(REPO, 'games/openworld/ai/bench/rulebench.json')

export interface Bench {
  /** The commit whose base rules the holes are holes of (a later one may answer some: they are left out, and said so). */
  commit: string
  created: string
  nodes: { node: string; cells: Cell[] }[]
}

/** A class cut at depth 2 of the type tree (a terrain is "tile"; the sweep's "self" and "person" are people): one depth, so no node holds another. */
const classOf = (t: string | undefined) => (!t ? '-' : t.startsWith('tile') ? 'tile' : t === 'self' || t === 'person' ? 'actor/person' : t.split('/').slice(0, 2).join('/'))

/**
 * A hole's node, from the cell alone: its answer's place says the host and the kind (`type|kind|hole`); the other role
 * is what the act was done with or to (the target when the hand's thing is the host, else the hand, else the player).
 */
export function nodeOfCell(c: Cell): string | undefined {
  if (!c.open) return undefined
  const [host, kind, hole] = c.open.split('|')
  const other = host === c.hand ? c.target : c.hand || 'actor/person/player'
  return [kind, hole.split('#')[0], classOf(host), classOf(other)].join('|')
}

/**
 * N nodes of K holes each, every hole a place of its own (no two of the bench share a `type|kind|hole`). The kinds of
 * event are taken in turn, each its largest nodes first; a host's class is in two nodes at most and the other role's
 * in three (the sweep's largest classes, food and crops and the ground, would fill every node); a node left with fewer
 * than K places once the earlier ones have theirs is passed over.
 */
export function chooseHoles(cells: Cell[], o: { nodes: number; per: number; seed: number; hostMax?: number; otherMax?: number }): Bench['nodes'] {
  const rng = new Rng(o.seed)
  const by = new Map<string, Map<string, Cell>>()
  for (const c of cells) {
    const n = c.outcome === 'undefined' ? nodeOfCell(c) : undefined
    if (!n) continue
    const m = by.get(n) ?? by.set(n, new Map()).get(n)!
    // one hole a place (type|kind|hole): a second one would be answered by the first's patch
    if (!m.has(c.open!)) m.set(c.open!, c)
  }
  const big = [...by].filter(([, m]) => m.size >= o.per).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
  const kinds = [...new Set(big.map(([n]) => n.split('|')[0]))]
  const queues = kinds.map((k) => big.filter(([n]) => n.split('|')[0] === k))
  const used = new Set<string>()
  const hosts = new Map<string, number>()
  const others = new Map<string, number>()
  const chosen: Bench['nodes'] = []
  for (let i = 0; chosen.length < o.nodes && queues.some((q) => q.length); i++) {
    const q = queues[i % queues.length]
    while (q.length) {
      const [node, m] = q.shift()!
      const [, , host, other] = node.split('|')
      if ((hosts.get(host) ?? 0) >= (o.hostMax ?? 2) || (others.get(other) ?? 0) >= (o.otherMax ?? 3)) continue
      const pool = [...m.values()].filter((c) => !used.has(c.open!))
      if (pool.length < o.per) continue
      const picked: Cell[] = []
      while (picked.length < o.per) picked.push(...pool.splice(rng.int(0, pool.length - 1), 1))
      for (const c of picked) used.add(c.open!)
      hosts.set(host, (hosts.get(host) ?? 0) + 1)
      others.set(other, (others.get(other) ?? 0) + 1)
      chosen.push({ node, cells: picked })
      break
    }
  }
  return chosen
}

/**
 * The order an arm works the holes in, for a rep. `interleaved`: the first of every node, then the second … (the
 * nodes' order shuffled by the rep). `shuffled`: every hole in a random order of the rep's, as play would bring them.
 * A hole's place among its kind is where it falls in the stream (the first of its node to come, the second …).
 */
export function streamOf(bench: Bench, rep: number, order: 'interleaved' | 'shuffled' = 'interleaved'): { node: string; occurrence: number; cell: Cell }[] {
  const rng = new Rng(1000 + rep)
  const shuffle = <T>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = rng.int(0, i)
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
  let items: { node: string; cell: Cell }[]
  if (order === 'shuffled') items = shuffle(bench.nodes.flatMap((n) => n.cells.map((cell) => ({ node: n.node, cell }))))
  else {
    const nodes = shuffle([...bench.nodes])
    const per = Math.max(...nodes.map((n) => n.cells.length))
    items = []
    for (let k = 0; k < per; k++) for (const n of nodes) if (n.cells[k]) items.push({ node: n.node, cell: n.cells[k] })
  }
  const seen = new Map<string, number>()
  return items.map((x) => {
    const occurrence = (seen.get(x.node) ?? 0) + 1
    seen.set(x.node, occurrence)
    return { ...x, occurrence }
  })
}

export interface Row {
  arm: string
  rep: number
  step: number
  node: string
  occurrence: number
  cell: string
  outcome: string
  firstValid: boolean
  attempts: number
  calls: number
  input: number
  output: number
  ms: number
  /** what the reflections after it cost */
  reflect: { calls: number; input: number; output: number }
  lessons: number
  skills: number
}

const flagOf = (argv: string[], k: string, d?: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)
const label = (c: Cell) => `${c.verb} ${c.hand || '(empty hand)'} → ${c.target}`

async function run(argv: string[]): Promise<void> {
  const arm = flagOf(argv, 'arm') ?? 'on'
  if (arm !== 'on' && arm !== 'off' && arm !== 'rules') throw new Error('--arm on | rules | off')
  const rep = Number(flagOf(argv, 'rep', '1'))
  const full = JSON.parse(readFileSync(flagOf(argv, 'bench', BENCH)!, 'utf8')) as Bench
  // the small bench: the first nodes (of kinds of event in turn) and the first holes of each
  const nodes = Number(flagOf(argv, 'nodes', String(full.nodes.length)))
  const per = Number(flagOf(argv, 'per', '1000'))
  const bench: Bench = { ...full, nodes: full.nodes.slice(0, nodes).map((n) => ({ ...n, cells: n.cells.slice(0, per) })) }
  // the arm's name in the report (two versions of the code may both run `on`)
  const name = flagOf(argv, 'label', arm)!
  const root = flagOf(argv, 'data', join(REPO, 'var/rulebench'))!
  const data = join(root, `${name}-${rep}`)
  rmSync(data, { recursive: true, force: true })
  mkdirSync(data, { recursive: true })
  const model = modelFromEnv()
  if (!model) throw new Error('no model: LSW_MODEL_BACKEND=claude-code, or LSW_MODEL_KEY + LSW_MODEL')
  // rules: the global rules and the notes kept, the skills left out (what the nodes' skills add)
  const ablate: Ablation[] = arm === 'off' ? ['memory', 'skills'] : arm === 'rules' ? ['skills'] : []
  // an empty library and an empty self-state of the arm's own
  const library = new WorldLibrary(GAME.ontology(), GAME.rules, join(data, 'library.jsonl'))
  const state = SelfState.open(join(data, 'modder-state'), undefined, ablate)
  // the arm without it does not reflect at all (nothing it writes would be read, and its cost is not the work's)
  if (arm === 'off') state.setHarness({ ...state.harness(), reflect: { ...state.harness().reflect, enabled: false } }, 'rulebench: the arm without reflection')
  // the checks after an answer ships (the audit, the review, revisions) are not what is measured: off unless asked for
  // (--checks on), the same in every arm (the economy and the repeat check, which the validator runs, stay)
  if (flagOf(argv, 'checks', 'off') === 'off') {
    const h = state.harness()
    state.setHarness({ ...h, review: { ...h.review, enabled: false }, audit: { ...h.audit, enabled: false } as typeof h.audit, revise: false }, 'rulebench: no checks after shipping')
  }
  const modder = new Modder({ library, state, model, log: () => undefined, probes: GAME.probes, data })
  const order = flagOf(argv, 'order', 'interleaved') as 'interleaved' | 'shuffled'
  const stream = streamOf(bench, rep, order)
  const file = join(data, 'rows.jsonl')
  const reflected = () => state.journalOf('reflect').length
  console.log(`rulebench ${name} (${arm}) rep ${rep}: ${stream.length} holes of ${bench.nodes.length} nodes (bench at ${bench.commit.slice(0, 8)}), model ${model.name}`)
  for (const [i, s] of stream.entries()) {
    const req = cellRequest(s.cell, library.fullOntology(), library.lib)
    if (!req) {
      console.log(`[${i + 1}] ${label(s.cell)}: not a hole here (answered already): left out`)
      continue
    }
    const before = reflected()
    const t0 = Date.now()
    const reply = await modder.resolve({ request: req }, 'live')
    const ms = Date.now() - t0
    // what it teaches is kept before the next hole is asked
    await modder.settled()
    const ep = reply.episode ? state.episode(reply.episode) : undefined
    const refl = state.journalOf('reflect').slice(before) as { usage?: { calls?: number; input?: number; output?: number } }[]
    const row: Row = {
      arm: name,
      rep,
      step: i + 1,
      node: s.node,
      occurrence: s.occurrence,
      cell: label(s.cell),
      outcome: reply.outcome,
      firstValid: !!ep?.attempts[0] && !ep.attempts[0].errors.length,
      attempts: ep?.attempts.length ?? 0,
      calls: ep?.usage.calls ?? 0,
      input: ep?.usage.input ?? 0,
      output: ep?.usage.output ?? 0,
      ms,
      reflect: refl.reduce((a, r) => ({ calls: a.calls + (r.usage?.calls ?? 0), input: a.input + (r.usage?.input ?? 0), output: a.output + (r.usage?.output ?? 0) }), { calls: 0, input: 0, output: 0 }),
      lessons: state.lessons().length,
      skills: state.skills().length,
    }
    appendFileSync(file, JSON.stringify(row) + '\n')
    console.log(`[${i + 1}/${stream.length}] ${s.node} #${s.occurrence} ${row.cell}: ${row.outcome}${row.firstValid ? '' : ' (repaired)'} · ${row.calls} call(s) · ${((row.input + row.output) / 1000).toFixed(1)}k tokens · ${(ms / 1000).toFixed(1)} s`)
  }
}

// ---------------------------------------------------------------- the report

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** McNemar's exact test (two-sided) on paired outcomes: b, c the discordant pairs. */
export function mcnemar(b: number, c: number): number {
  const n = b + c
  if (!n) return 1
  let p = 0
  const k = Math.min(b, c)
  let choose = 1
  for (let i = 0; i <= k; i++) {
    if (i > 0) choose = (choose * (n - i + 1)) / i
    p += choose
  }
  return Math.min(1, (2 * p) / 2 ** n)
}

export function report(rows: Row[]): string {
  const arms = [...new Set(rows.map((r) => r.arm))].sort()
  const out: string[] = []
  const line = (r: Row[]) => {
    const total = (x: Row) => x.input + x.output + x.reflect.input + x.reflect.output
    return `n ${r.length} · accepted ${(mean(r.map((x) => +(x.outcome === 'accepted'))) * 100).toFixed(0)}% · first answer held ${(mean(r.map((x) => +x.firstValid)) * 100).toFixed(0)}% · calls ${mean(r.map((x) => x.calls)).toFixed(2)} · design tokens ${(mean(r.map((x) => x.input + x.output)) / 1000).toFixed(1)}k · with reflection ${(mean(r.map(total)) / 1000).toFixed(1)}k · ${(mean(r.map((x) => x.ms)) / 1000).toFixed(1)} s`
  }
  out.push('# By arm')
  for (const a of arms) out.push(`- ${a}: ${line(rows.filter((r) => r.arm === a))}`)
  out.push('', '# By its place among its kind (1 = the first of its node)', '| place | ' + arms.map((a) => `${a}: first held · tokens · s`).join(' | ') + ' |', '|---|' + arms.map(() => '---|').join(''))
  const places = [...new Set(rows.map((r) => r.occurrence))].sort((a, b) => a - b)
  for (const k of places)
    out.push(
      `| ${k} | ` +
        arms
          .map((a) => {
            const r = rows.filter((x) => x.arm === a && x.occurrence === k)
            return `${(mean(r.map((x) => +x.firstValid)) * 100).toFixed(0)}% · ${(mean(r.map((x) => x.input + x.output)) / 1000).toFixed(1)}k · ${(mean(r.map((x) => x.ms)) / 1000).toFixed(1)}`
          })
          .join(' | ') +
        ' |',
    )
  const key = (r: Row) => `${r.rep}|${r.cell}`
  for (const [i, x] of arms.entries())
    for (const y of arms.slice(i + 1)) {
      const ys = new Map(rows.filter((r) => r.arm === y).map((r) => [key(r), r]))
      const pairs = rows.filter((r) => r.arm === x && ys.has(key(r))).map((r) => [r, ys.get(key(r))!] as const)
      const b = pairs.filter(([p, q]) => p.firstValid && !q.firstValid).length
      const c = pairs.filter(([p, q]) => !p.firstValid && q.firstValid).length
      out.push('', `# Paired, hole by hole (${x} against ${y})`, `- pairs ${pairs.length}; the first answer held in one arm only: ${x} ${b}, ${y} ${c} (McNemar exact p = ${mcnemar(b, c).toFixed(3)})`)
      out.push(`- design tokens, ${x} − ${y}: ${(mean(pairs.map(([p, q]) => p.input + p.output - q.input - q.output)) / 1000).toFixed(2)}k a hole; calls ${mean(pairs.map(([p, q]) => p.calls - q.calls)).toFixed(2)}; time ${(mean(pairs.map(([p, q]) => p.ms - q.ms)) / 1000).toFixed(2)} s`)
    }
  return out.join('\n')
}

async function main(): Promise<void> {
  const [cmd = 'report', ...argv] = process.argv.slice(2)
  if (cmd === 'build') {
    const cov = sweep(GAME.ontology(), GAME.rules)
    const nodes = chooseHoles(cov.cells, { nodes: Number(flagOf(argv, 'nodes', '20')), per: Number(flagOf(argv, 'per', '10')), seed: Number(flagOf(argv, 'seed', '1')) })
    const bench: Bench = { commit: execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim(), created: new Date().toISOString(), nodes }
    const out = flagOf(argv, 'out', BENCH)!
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(bench, null, 1) + '\n')
    console.log(`${nodes.length} nodes, ${nodes.reduce((a, n) => a + n.cells.length, 0)} holes → ${out}`)
    for (const n of nodes) console.log(`  ${n.node}: ${n.cells.length}`)
    return
  }
  if (cmd === 'run') return run(argv)
  const root = flagOf(argv, 'data', join(REPO, 'var/rulebench'))!
  const rows = existsSync(root) ? readdirSync(root).flatMap((d) => (existsSync(join(root, d, 'rows.jsonl')) ? readFileSync(join(root, d, 'rows.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row) : [])) : []
  console.log(rows.length ? report(rows) : `no runs under ${root}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
