// The upstream loop (docs/upstream.md): the AI proposes BASE rules where the learned layer shows a
// class answers alike, as a repository change with tests a person merges. The task is a content
// task of the SWE-style agent: a workspace with games/openworld/content writable and packages/engine
// read-only, an issue (the hole, the class, the evidence), and a verdict the agent cannot touch —
// the generated promotion test, the coverage regression, the content suite and the size bounds.
// A solved task becomes a branch and a pull request; nothing in the running world changes.
//
//   npm run upstream -- scan [--data var] [--sweep]            the candidates in the library now (no model)
//   npm run upstream -- propose <hole> <class> [--note …]      S3: by hand (a model, unless --dry)
//   npm run upstream -- propose --candidate <n> [--sweep]      the nth of the scan
//   npm run upstream -- status                                 the proposals made and how they stand

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DockerEnv, LocalEnv, SANDBOX_LIMITS, SelfState, applyPreset, chooseIsolation, hostUser, modelFromEnv, runAgent, sandboxImage, type AgentTask, type Env, type Isolation, type Model, type Preset } from '@openworld/ai'
import { PROMOTE, WorldLibrary, askedCounts, candidates, effectsOf, type Candidate } from '@openworld/ai'
import { BASE_RULES, STORY_RULES, buildOntology } from '@openworld-game/content'
import { isA, placed, type Expectation, type Ontology, type Scenario } from '@openworld/engine'
import { REPO, engineWorkspace } from './engine-tasks.ts'
import { sweep, type Cell, type Outcome } from '../../tools/src/coverage.ts'

/** The thresholds (docs/upstream.md §8, decided): K, S, N from the detector; L changed lines; proposals a day. */
export const UPSTREAM = { ...PROMOTE, L: 80, MAX_PER_DAY: 3 }

const CONTENT = 'games/openworld/content/src'
/** What a proposal may touch: the rules, and a type or status when one is needed. */
const WRITABLE = [`${CONTENT}/rules.ts`, `${CONTENT}/items.ts`, `${CONTENT}/ontology.ts`]
const PROMOTION = 'games/openworld/content/test/promotion.test.ts'
const TEMPLATE = fileURLToPath(new URL('../tasks/upstream/promotion.test.ts.tmpl', import.meta.url))
const COVERAGE = fileURLToPath(new URL('../../tools/src/coverage.ts', import.meta.url))
/** The judge's own files in the workspace (kept out of the diff, like the agent's .agent/). */
const JUDGE = '.upstream'
const TESTS = 'npx vitest run games/openworld/content'

// ------------------------------------------------------------------ the workspace

const walk = (dir: string, f: (p: string) => void): void => {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name)
    if (n.isDirectory()) walk(p, f)
    else f(p)
  }
}

/** One hash over a directory's files (paths and contents): the engine as it was when the task was made. */
export function hashDir(dir: string): string {
  const h = createHash('sha256')
  const files: string[] = []
  walk(dir, (p) => files.push(p))
  for (const p of files.sort()) h.update(relative(dir, p)).update('\0').update(readFileSync(p)).update('\0')
  return h.digest('hex')
}

/**
 * The engine and content packages as a repository of their own (engine-tasks.ts), with the engine
 * read-only: its files cannot be written by the agent's tools nor by its shell (a container runs as
 * the host user), and the verdict fails if its hash moved anyway. The judge's sweep runner lives in
 * `.upstream/`, excluded from the diff.
 */
export function contentWorkspace(): { dir: string; engineHash: string; dispose: () => void } {
  const ws = engineWorkspace({ prefix: 'lsw-upstream-' })
  const engine = join(ws.dir, 'packages', 'engine')
  const engineHash = hashDir(engine)
  walk(engine, (p) => chmodSync(p, 0o444))
  mkdirSync(join(ws.dir, JUDGE), { recursive: true })
  writeFileSync(join(ws.dir, JUDGE, 'coverage.ts'), readFileSync(COVERAGE, 'utf8'))
  // (the cells go to a file: the sweep is larger than a command's output may be)
  writeFileSync(join(ws.dir, JUDGE, 'sweep.ts'), "import { writeFileSync } from 'node:fs'\nimport { sweep } from './coverage.ts'\nwriteFileSync(new URL('./sweep.json', import.meta.url), JSON.stringify(sweep().cells))\n")
  mkdirSync(join(ws.dir, '.git', 'info'), { recursive: true })
  writeFileSync(join(ws.dir, '.git', 'info', 'exclude'), `${JUDGE}/\n`)
  return {
    dir: ws.dir,
    engineHash,
    dispose: () => {
      walk(engine, (p) => chmodSync(p, 0o644))
      ws.dispose()
    },
  }
}

// ------------------------------------------------------------------ the issue

/** The base rule a hole names, quoted from the content's source with its file and lines. */
export function holeSource(hole: string): { file: string; lines: [number, number]; text: string } | undefined {
  const id = hole.split('#')[0]
  const dir = join(REPO, CONTENT)
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(join(dir, name), 'utf8')
    const at = src.search(new RegExp(`id: ['"]${id.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`))
    if (at < 0) continue
    // back to the `rule({` this id belongs to (or the object's own brace), then forward over balanced braces
    const call = src.lastIndexOf('rule({', at)
    const start = call >= 0 ? call : src.lastIndexOf('{', at)
    let depth = 0
    let end = src.indexOf('{', start)
    for (; end < src.length; end++) {
      if (src[end] === '{') depth++
      else if (src[end] === '}' && --depth === 0) break
    }
    if (call >= 0 && src[end + 1] === ')') end++
    const text = src.slice(start, end + 1)
    const from = src.slice(0, start).split('\n').length
    return { file: `${CONTENT}/${name}`, lines: [from, from + text.split('\n').length - 1], text }
  }
  return undefined
}

/** The branch of a hole key in words: which conditions were taken, and which were not. */
function branchOf(hole: string): string {
  const path = hole.includes('#') ? hole.slice(hole.indexOf('#') + 1).split('&') : []
  if (!path.length) return 'its root leaf'
  return path.map((p) => (p.startsWith('!') ? `not ${p.slice(1)}` : `taken ${p}`)).join(', then ')
}

/** The leaf types of a class in the ontology (what a rule on the class would reach). */
export function leafTypes(onto: Ontology, ancestor: string): string[] {
  const all = Object.keys(onto.types)
  return all.filter((t) => isA(t, ancestor) && !all.some((o) => o !== t && o.startsWith(t + '/'))).sort()
}

/** A scene in a line: the event, and the types that take part. */
function sceneLine(sc: Scenario): string {
  const type = (k?: string) => (k ? sc.entities.find((e) => e.key === k)?.type ?? k : undefined)
  const roles = (['host', 'actor', 'instrument', 'item', 'target', 'other'] as const).flatMap((r) => (sc.event[r] ? [`${r}: ${type(sc.event[r])}`] : []))
  const params = sc.event.params && Object.keys(sc.event.params).length ? ` params ${JSON.stringify(sc.event.params)}` : ''
  return `${sc.event.kind ?? 'act/use'} — ${roles.join(', ')}${params}`
}

export interface IssueContext {
  onto: Ontology
  /** the scene each learned rule answered (library.asked) */
  scenes: Record<string, Scenario>
  /** sweep cells each learned rule answers, when a sweep with the learned rules was run */
  cellsByRule?: Record<string, number>
  /** S3: the person's note */
  note?: string
  L?: number
}

/** ISSUE.md: the hole, the class, the evidence, the ask, the bounds (docs/upstream.md §3). */
export function issueFor(c: Candidate, ctx: IssueContext): string {
  const src = holeSource(c.hole)
  const leaves = leafTypes(ctx.onto, c.ancestor)
  const answered = new Set(c.types)
  const L = ctx.L ?? UPSTREAM.L
  const lines = [
    `# Upstream: a base rule for \`${c.ancestor}\` at \`${c.hole}\` (${c.kind})`,
    '',
    '## The hole',
    '',
    `The base rule \`${c.hole.split('#')[0]}\`${src ? ` (${src.file}:${src.lines[0]}-${src.lines[1]})` : ''} leaves \`${c.kind}\` undefined at ${branchOf(c.hole)}. The learned layer has been answering it one type at a time.`,
    ...(src ? ['', '```ts', src.text, '```'] : []),
    '',
    '## The class',
    '',
    `\`${c.ancestor}\`, whose leaf types are: ${leaves.map((t) => (answered.has(t) ? `**${t}**` : t)).join(', ')} (bold: answered by a learned rule at this hole).`,
    '',
    '## The evidence',
    '',
    c.signal === 'S1'
      ? `S1, sibling convergence: ${c.types.length} types under \`${c.ancestor}\` answer this hole with equivalent trees (${Math.round(c.share * 100)}% of the class's types reached here).`
      : c.signal === 'S2'
        ? `S2, a hole the class keeps falling into: \`${c.ancestor}\` was asked about ${c.asked ?? '?'} times at this hole, answered one type at a time.`
        : `S3, the person's request${ctx.note ? `: ${ctx.note}` : ''}.`,
    ...(ctx.note && c.signal !== 'S3' ? ['', `Note: ${ctx.note}`] : []),
    '',
    ...c.rules.flatMap((r) => {
      const sc = ctx.scenes[r.id]
      const cells = ctx.cellsByRule?.[r.id]
      return [
        `### \`${r.id}\` — host \`${r.host?.type}\``,
        '',
        ...(r.doc ? [r.doc, ''] : []),
        ...(sc ? [`The scene that asked: ${sceneLine(sc)}.`, ''] : []),
        ...(cells !== undefined ? [`It answers ${cells} cell(s) of the coverage sweep.`, ''] : []),
        '```json',
        JSON.stringify({ host: r.host, on: r.on, hole: r.hole, at: r.at, label: r.label, tree: r.tree }, null, 2),
        '```',
        '',
      ]
    }),
    '## The ask',
    '',
    `Write **one base rule** whose host is \`${c.ancestor}\` (or a narrower class under it; never an instance, never one leaf type) for \`${c.kind}\` that gives the outcomes above at this hole, and \`inherit\` for whatever it does not answer (so the AI may still answer the rest). Keep every existing base rule's outcome as it is. Add it to the GENERAL block of \`${CONTENT}/rules.ts\` (or the block its kind belongs to), with a \`doc\` saying what it does and why, and a \`label\` if a player's input reaches it (a used thing, something held out, a bare hand).`,
    '',
    'Make the rule say the class, not the instances: do not list the types above in a condition. Where the learned trees differ only in a type-specific value (the host\'s own type as `transform.into` or `spawn.type`), read it from the host (`@prop:...`) or its class.',
    '',
    '## Bounds',
    '',
    `- Touch only \`${CONTENT}/rules.ts\` (and \`items.ts\` / \`ontology.ts\` for at most one new type or status, when one is needed).`,
    `- At most ${L} changed lines; exactly one new \`rule({\`; \`BASE_RULES\` keeps exporting the rules.`,
    '- `packages/engine` is read-only. If the outcome needs a new primitive or condition, stop and say so in your submission: that is an engine task, not this one.',
    '',
    '## How it is judged',
    '',
    '1. Promotion: the scene each learned rule above answered must now resolve to a base rule (not a hole, not a learned rule) with the same outcome (the same statuses gained and lost, numbers moved the same way, the same things made or destroyed).',
    '2. No defined outcome changes: the coverage sweep before and after must agree on every cell that was defined, and what is newly defined must be at this hole, on this class.',
    `3. The content suite passes (\`${TESTS}\`).`,
    '4. The bounds above.',
    '',
  ]
  return lines.join('\n')
}

// ------------------------------------------------------------------ the promotion test

export interface PromotionCase {
  rule: string
  type: string
  hole: string
  scene: Scenario
  expect: Expectation[]
}

/**
 * What each learned rule of the candidate did in the scene that asked for it, as expectations
 * (derive.ts's, `resolvedBy` aside: the base, not the learned rule, is to answer now).
 */
export function promotionCases(c: Candidate, library: WorldLibrary): PromotionCase[] {
  const onto = library.fullOntology()
  const out: PromotionCase[] = []
  for (const r of c.rules) {
    const asked = library.asked.find((a) => a.rule === r.id)
    if (!asked) continue
    let expect: Expectation[] | undefined
    try {
      expect = effectsOf(asked.scenario, r, library.lib, onto)
    } catch {
      continue // a scene that no longer builds says nothing
    }
    if (!expect) continue // not this rule's event any more (the library moved on)
    out.push({ rule: r.id, type: r.host!.type!, hole: r.hole!, scene: asked.scenario, expect: expect.filter((e) => !('resolvedBy' in e)) })
  }
  return out
}

/** The promotion test from its template, the cases injected. */
export function promotionTest(cases: PromotionCase[]): string {
  const tmpl = readFileSync(TEMPLATE, 'utf8')
  if (!tmpl.includes('/*__CASES__*/ []')) throw new Error('promotion.test.ts.tmpl: no /*__CASES__*/ marker')
  return tmpl.replace('/*__CASES__*/ []', JSON.stringify(cases, null, 2))
}

// ------------------------------------------------------------------ the coverage regression

export type SweepMap = Record<string, { outcome: Outcome; rule?: string; open?: string }>

/** The sweep's cells by their coordinates (hand, target, act). */
export function sweepMap(cells: Pick<Cell, 'hand' | 'target' | 'verb' | 'outcome' | 'rule' | 'open'>[]): SweepMap {
  const out: SweepMap = {}
  for (const c of cells) out[`${c.hand}|${c.target}|${c.verb}`] = { outcome: c.outcome, rule: c.rule, open: c.open }
  return out
}

export interface SweepDiff {
  /** cells that were defined and now resolve otherwise (or not at all) */
  regressions: string[]
  /** cells newly defined that are not at the candidate's hole on its class: the rule reaches further than proposed */
  strays: string[]
  /** cells newly defined at the candidate's hole on its class */
  gained: number
}

/** No defined outcome changes; what is newly defined is the candidate's (docs/upstream.md §3, test 2). */
export function compareSweeps(before: SweepMap, after: SweepMap, c: Pick<Candidate, 'kind' | 'hole' | 'ancestor'>): SweepDiff {
  const out: SweepDiff = { regressions: [], strays: [], gained: 0 }
  for (const [key, was] of Object.entries(before)) {
    const now = after[key]
    if (was.outcome !== 'undefined') {
      if (!now) out.regressions.push(`${key}: gone from the sweep`)
      else if (now.outcome === 'undefined') out.regressions.push(`${key}: was ${was.rule}, now undefined`)
      else if (now.rule !== was.rule) out.regressions.push(`${key}: was ${was.rule}, now ${now.rule}`)
      continue
    }
    if (!now || now.outcome === 'undefined') continue
    const open = was.open ?? ''
    const i = open.indexOf('|')
    const j = open.indexOf('|', i + 1)
    const [type, kind, hole] = i < 0 || j < 0 ? ['', '', ''] : [open.slice(0, i), open.slice(i + 1, j), open.slice(j + 1)]
    if (kind === c.kind && hole === c.hole && isA(type, c.ancestor)) out.gained++
    else out.strays.push(`${key}: now ${now.rule} (was open at ${open || '?'})`)
  }
  return out
}

// ------------------------------------------------------------------ the bounds

export interface BoundsInput {
  /** `git diff --numstat` of the workspace */
  numstat: string
  /** `rule({` occurrences in rules.ts before and after */
  rulesBefore: number
  rulesAfter: number
  /** rules.ts still exports BASE_RULES */
  exportsBase: boolean
  engineChanged: boolean
  L?: number
}

/** The size and place of the change (docs/upstream.md §3, test 4): the reasons it is out of bounds, none when within. */
export function checkBounds(b: BoundsInput): string[] {
  const L = b.L ?? UPSTREAM.L
  const errors: string[] = []
  let changed = 0
  const files: string[] = []
  for (const line of b.numstat.split('\n')) {
    if (!line.trim()) continue
    const [added, deleted, ...rest] = line.split('\t')
    const file = rest.join('\t').trim()
    files.push(file)
    if (!WRITABLE.includes(file)) errors.push(`${file}: not a file a proposal may change (${WRITABLE.join(', ')})`)
    changed += added === '-' ? L + 1 : Number(added) + Number(deleted)
  }
  if (!files.includes(WRITABLE[0])) errors.push(`${WRITABLE[0]}: unchanged (the rule goes there)`)
  if (changed > L) errors.push(`${changed} lines changed, more than ${L}`)
  if (b.rulesAfter - b.rulesBefore !== 1) errors.push(`${b.rulesAfter - b.rulesBefore} new rule(s) in rules.ts, not one`)
  if (!b.exportsBase) errors.push('rules.ts no longer exports BASE_RULES')
  if (b.engineChanged) errors.push('packages/engine changed: it is read-only (a primitive is an engine task)')
  return errors
}

const countRules = (src: string): number => (src.match(/\brule\(\{/g) ?? []).length

// ------------------------------------------------------------------ the task

export interface UpstreamTask {
  task: AgentTask
  cases: PromotionCase[]
  issue: string
  workspace: string
  dispose: () => Promise<void>
}

/**
 * The content task for a candidate: the workspace, the issue, and the verdict (promotion, coverage
 * regression, the content suite, the bounds). As an engine task, unattended it runs only in a
 * container; `localRun`: a person started it by hand. Without either there is no task.
 */
export async function upstreamTask(c: Candidate, o: { library: WorldLibrary; isolation?: Isolation; localRun?: boolean; note?: string; cellsByRule?: Record<string, number>; L?: number }): Promise<UpstreamTask | undefined> {
  const iso = o.isolation ?? (await chooseIsolation())
  if (iso === 'none' && !o.localRun) return undefined
  const onto = o.library.fullOntology()
  const scenes = Object.fromEntries(o.library.asked.filter((a) => c.rules.some((r) => r.id === a.rule)).map((a) => [a.rule, a.scenario]))
  const cases = promotionCases(c, o.library)
  if (!cases.length) throw new Error(`${c.ancestor} at ${c.hole}: none of its learned rules has a scene to promote`)
  const issue = issueFor(c, { onto, scenes, note: o.note, cellsByRule: o.cellsByRule, L: o.L })
  // the sweep over the content as it is: the regression's "before"
  const before = sweepMap(sweep(buildOntology()).cells)
  const ws = contentWorkspace()
  const rulesPath = join(ws.dir, WRITABLE[0])
  const rulesBefore = countRules(readFileSync(rulesPath, 'utf8'))
  let env: Env
  try {
    env =
      iso === 'docker'
        ? await DockerEnv.start({ image: await sandboxImage(), root: ws.dir, mount: ws.dir, mounts: [{ host: join(REPO, 'node_modules'), container: join(REPO, 'node_modules') }], user: hostUser(), limits: SANDBOX_LIMITS })
        : new LocalEnv(ws.dir)
  } catch (err) {
    ws.dispose()
    throw err
  }
  const id = `upstream:${c.hole}:${c.ancestor}`
  return {
    cases,
    issue,
    workspace: ws.dir,
    dispose: async () => {
      await env.dispose?.()
      ws.dispose()
    },
    task: {
      id,
      kind: 'upstream',
      statement: issue,
      env,
      localRun: iso === 'none' && o.localRun,
      tests: { command: TESTS, timeoutMs: 300_000 },
      request: { hole: c.hole, ancestor: c.ancestor, kind: c.kind, signal: c.signal, types: c.types, rules: c.rules.map((r) => r.id) },
      notes: 'This repository is the engine (packages/engine, read-only) and content (games/openworld/content) of a rule-based game world. The base rules are in games/openworld/content/src/rules.ts, written with the small DSL at its top (rule, IF, DO, AS, HOLE, is, tag, has, add…); a rule is the nature of a host class for one event kind, writes only its host and reaches others by emitting impulses. The tests are vitest.',
      verdict: async (env) => {
        const out: string[] = []
        let ok = true
        const part = (name: string, pass: boolean, text: string) => {
          ok &&= pass
          out.push(`## ${name}: ${pass ? 'pass' : 'FAIL'}`, text.trim(), '')
        }
        // 4. the bounds first: the promotion test is not yet in the tree, so the diff is the agent's alone
        await env.exec('git add -A -N . 2>/dev/null; true', { timeoutMs: 60_000 })
        const numstat = await env.exec('git -c core.autocrlf=false diff --numstat', { timeoutMs: 60_000 })
        const rules = existsSync(rulesPath) ? readFileSync(rulesPath, 'utf8') : ''
        const bounds = checkBounds({ numstat: numstat.stdout, rulesBefore, rulesAfter: countRules(rules), exportsBase: /export const BASE_RULES\b/.test(rules), engineChanged: hashDir(join(ws.dir, 'packages', 'engine')) !== ws.engineHash, L: o.L })
        part('bounds', !bounds.length, bounds.length ? bounds.map((e) => `- ${e}`).join('\n') : numstat.stdout)
        // 1. promotion
        const target = join(ws.dir, PROMOTION)
        writeFileSync(target, promotionTest(cases))
        try {
          const r = await env.exec(`npx vitest run ${PROMOTION}`, { timeoutMs: 300_000 })
          part('promotion', r.code === 0, `${r.stdout}\n${r.stderr}`.slice(-2500))
        } finally {
          rmSync(target, { force: true })
        }
        // 2. no defined outcome changes
        const sw = await env.exec(`npx tsx ${JUDGE}/sweep.ts`, { timeoutMs: 300_000 })
        const cellsFile = join(ws.dir, JUDGE, 'sweep.json')
        if (sw.code !== 0 || !existsSync(cellsFile)) part('coverage', false, `the sweep did not run:\n${sw.stderr.slice(-1500)}`)
        else {
          const diff = compareSweeps(before, sweepMap(JSON.parse(readFileSync(cellsFile, 'utf8')) as Cell[]), c)
          rmSync(cellsFile, { force: true })
          const pass = !diff.regressions.length && !diff.strays.length
          part('coverage', pass, [`${diff.gained} cell(s) newly answered at ${c.hole} on ${c.ancestor}`, ...diff.regressions.slice(0, 20).map((r) => `- changed: ${r}`), ...diff.strays.slice(0, 20).map((s) => `- beyond the proposal: ${s}`), ...(diff.regressions.length + diff.strays.length > 40 ? [`… ${diff.regressions.length + diff.strays.length} in all`] : [])].join('\n'))
        }
        // 3. the content suite
        const suite = await env.exec(TESTS, { timeoutMs: 300_000 })
        part('content suite', suite.code === 0, `${suite.stdout}\n${suite.stderr}`.slice(-2000))
        return { ok, output: out.join('\n') }
      },
    },
  }
}

// ------------------------------------------------------------------ the proposal: a branch and a pull request

export interface Proposal {
  hole: string
  ancestor: string
  kind: string
  branch: string
  url?: string
  at: string
  episode: string
  status: 'open' | 'merged' | 'declined' | 'failed'
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

export const branchFor = (c: Pick<Candidate, 'hole' | 'ancestor'>): string => `upstream/${slug(c.hole)}-${slug(c.ancestor)}`

/** The proposals made, in the data directory (one open per hole and class; a daily cap). */
export class Proposals {
  readonly file: string
  proposals: Proposal[]
  constructor(data: string) {
    this.file = join(data, 'upstream', 'open.json')
    this.proposals = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, 'utf8')) as { proposals: Proposal[] }).proposals : []
  }
  open(c: Pick<Candidate, 'hole' | 'ancestor'>): Proposal | undefined {
    return this.proposals.find((p) => p.status === 'open' && p.hole === c.hole && p.ancestor === c.ancestor)
  }
  madeToday(now = new Date()): number {
    const day = now.toISOString().slice(0, 10)
    return this.proposals.filter((p) => p.at.slice(0, 10) === day && p.status !== 'failed').length
  }
  add(p: Proposal): void {
    this.proposals.push(p)
    this.save()
  }
  save(): void {
    mkdirSync(join(this.file, '..'), { recursive: true })
    writeFileSync(this.file, JSON.stringify({ proposals: this.proposals }, null, 2) + '\n')
  }
}

const COAUTHOR = 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>'
const GENERATED = '🤖 Generated with [Claude Code](https://claude.com/claude-code)'

/**
 * A solved task as a pull request: the workspace's diff applied on a branch from HEAD in a temporary
 * worktree of the real repository, committed with the evidence, pushed, and opened against main with
 * the `upstream` label. Never merged here.
 */
export function openProposal(o: { candidate: Candidate; diff: string; issue: string; verdict: string; episode: string; repo?: string; log?: (l: string) => void }): { branch: string; url: string } {
  const repo = o.repo ?? REPO
  const c = o.candidate
  const branch = branchFor(c)
  const git = (cmd: string, cwd = repo) => execSync(`git ${cmd}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const tmp = mkdtempSync(join(tmpdir(), 'lsw-proposal-'))
  const dir = join(tmp, 'wt')
  try {
    git(`worktree add -q -b ${branch} ${JSON.stringify(dir)} HEAD`)
    const patch = join(tmp, 'change.diff')
    writeFileSync(patch, o.diff.endsWith('\n') ? o.diff : o.diff + '\n')
    git(`apply --index ${JSON.stringify(patch)}`, dir)
    const title = `Upstream: ${c.ancestor} at ${c.hole} (${c.kind})`
    const message = [title, '', `A base rule proposed by the upstream loop (docs/upstream.md): ${c.signal}, ${c.types.length} type(s) under ${c.ancestor} — ${c.types.join(', ')}.`, `Subsumes the learned rules ${c.rules.map((r) => r.id).join(', ')}. Episode ${o.episode}.`, '', COAUTHOR].join('\n')
    const msg = join(tmp, 'message.txt')
    writeFileSync(msg, message + '\n')
    git(`-c user.name=upstream-loop -c user.email=upstream@lsw.local commit -q -F ${JSON.stringify(msg)}`, dir)
    git(`push -u origin ${branch}`, dir)
    const body = [o.issue, '', '## Verdict', '', o.verdict, '', GENERATED].join('\n')
    const bodyFile = join(tmp, 'body.md')
    writeFileSync(bodyFile, body)
    const pr = (label: boolean) => execSync(`gh pr create --base main --head ${branch} --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyFile)}${label ? ' --label upstream' : ''}`, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    let url: string
    try {
      url = pr(true)
    } catch (err) {
      // the label may not exist in the repository yet: the proposal still opens
      o.log?.(`gh pr create --label upstream failed (${(err as Error).message.split('\n')[0]}); opening without the label`)
      url = pr(false)
    }
    return { branch, url: url.split('\n').at(-1)! }
  } finally {
    try {
      git(`worktree remove --force ${JSON.stringify(dir)}`)
    } catch {
      /* already gone */
    }
    rmSync(tmp, { recursive: true, force: true })
  }
}

// ------------------------------------------------------------------ the driver

/** The candidates now, S1 and S2, with the sweep's reach when asked for. */
export function scan(library: WorldLibrary, o: { sweep?: boolean } = {}): { candidates: Candidate[]; cellsByRule?: Record<string, number> } {
  const onto = library.fullOntology()
  const counts = askedCounts(library)
  let cellsByRule: Record<string, number> | undefined
  if (o.sweep) {
    // every undefined cell says which type at which hole it would ask about: the class's reach
    for (const cell of sweep(onto).cells) if (cell.open && !counts.has(cell.open)) counts.set(cell.open, 0)
    cellsByRule = sweep(onto, [...BASE_RULES, ...STORY_RULES, ...library.patchRules()]).byRule
  }
  return { candidates: candidates(library, onto, counts), cellsByRule }
}

/** S3: a candidate by hand, from the live learned rules on the class at the hole. */
export function byHand(library: WorldLibrary, hole: string, ancestor: string, kind?: string): Candidate {
  const base = [...BASE_RULES, ...STORY_RULES].find((r) => r.id === hole.split('#')[0])
  if (!base) throw new Error(`no base rule "${hole.split('#')[0]}"`)
  const on = kind ?? base.on
  if (!on.includes('/')) throw new Error(`"${base.id}" answers a branch of kinds (${base.on}): say which with --kind`)
  if (ancestor.split('/').length < 2) throw new Error(`"${ancestor}" is a root, not a class`)
  const rules = library.patchRules().filter((r) => placed(r) && r.hole === hole && r.on === on && isA(r.host!.type!, ancestor))
  const types = [...new Set(rules.map((r) => r.host!.type!))].sort()
  return { kind: on, hole, ancestor, types, rules, share: types.length ? 1 : 0, signal: 'S3' }
}

export const describeCandidate = (c: Candidate): string => `${c.signal} ${c.ancestor} at ${c.hole} (${c.kind}): ${c.types.length} type(s) alike, ${Math.round(c.share * 100)}% of the class reached${c.asked !== undefined ? `, asked ${c.asked} times` : ''}: ${c.types.map((t) => t.split('/').pop()).join(', ')}`

export interface ProposeOptions {
  library: WorldLibrary
  state: SelfState
  data: string
  model?: Model
  /** proposals allowed today (UPSTREAM.MAX_PER_DAY) */
  max?: number
  L?: number
  note?: string
  cellsByRule?: Record<string, number>
  isolation?: Isolation
  localRun?: boolean
  /** build the task and print its issue; no model, no agent run */
  dry?: boolean
  log?: (l: string) => void
}

/**
 * One proposal: the guard rails (one open per hole and class, a daily cap), the task, the agent, the
 * verdict, the pull request, the record. Returns why nothing was proposed when nothing was.
 */
export async function propose(c: Candidate, o: ProposeOptions): Promise<{ outcome: 'accepted' | 'failed' | 'skipped' | 'dry'; reason?: string; url?: string; episode?: string }> {
  const book = new Proposals(o.data)
  const open = book.open(c)
  if (open) return { outcome: 'skipped', reason: `an open proposal for ${c.ancestor} at ${c.hole} already: ${open.url ?? open.branch}` }
  const max = o.max ?? UPSTREAM.MAX_PER_DAY
  if (book.madeToday() >= max) return { outcome: 'skipped', reason: `${max} proposal(s) made today already (--max)` }
  const t = await upstreamTask(c, { library: o.library, isolation: o.isolation, localRun: o.localRun, note: o.note, cellsByRule: o.cellsByRule, L: o.L })
  if (!t) return { outcome: 'skipped', reason: 'no container here, and not a local run: an unattended agent gets no shell on this machine' }
  try {
    if (o.dry) {
      o.log?.(t.issue)
      return { outcome: 'dry', reason: `${t.cases.length} promotion case(s); workspace ${t.workspace}` }
    }
    if (!o.model) throw new Error('no model (LSW_MODEL_KEY, LSW_MODEL)')
    if (!t.task.env.isolated) o.log?.('warning: no container here — the agent\'s commands and tests run on this machine')
    const r = await runAgent(t.task, { model: o.model, state: o.state, record: false, log: o.log })
    const ep = r.episode
    const added = r.diff?.match(/^\+.*\bid: ['"]([^'"]+)['"]/m)?.[1]
    if (added) ep.rules = [added]
    let url: string | undefined
    if (r.outcome === 'accepted' && r.diff) {
      try {
        const pr = openProposal({ candidate: c, diff: r.diff, issue: t.issue, verdict: r.verdict?.output ?? '', episode: ep.id, log: o.log })
        url = pr.url
        ep.submission = `${ep.submission ?? ''} · ${url}`.trim()
        book.add({ hole: c.hole, ancestor: c.ancestor, kind: c.kind, branch: pr.branch, url, at: new Date().toISOString(), episode: ep.id, status: 'open' })
      } catch (err) {
        ep.error = `proposal: ${(err as Error).message}`
        book.add({ hole: c.hole, ancestor: c.ancestor, kind: c.kind, branch: branchFor(c), at: new Date().toISOString(), episode: ep.id, status: 'failed' })
      }
    }
    o.state.recordEpisode(ep)
    o.state.noteSkillUse(ep.skillsRead, ep.outcome, ep.id)
    return { outcome: r.outcome, url, episode: ep.id, reason: r.verdict?.output.slice(-600) }
  } finally {
    await t.dispose()
  }
}

/** The proposals and how they stand: `gh` says which closed, merged or declined; without it, the record as it is. */
export function status(data: string, o: { gh?: boolean } = {}): Proposal[] {
  const book = new Proposals(data)
  if (o.gh !== false)
    for (const p of book.proposals) {
      if (p.status !== 'open' || !p.url) continue
      try {
        const s = JSON.parse(execSync(`gh pr view ${p.url} --json state`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as { state: string }
        if (s.state === 'MERGED') p.status = 'merged'
        else if (s.state === 'CLOSED') p.status = 'declined'
      } catch {
        /* no gh, or offline: the record stands */
      }
    }
  book.save()
  return book.proposals
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flag = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`)
    return i < 0 ? undefined : argv.splice(i, 2)[1]
  }
  const has = (k: string): boolean => {
    const i = argv.indexOf(`--${k}`)
    return i < 0 ? false : (argv.splice(i, 1), true)
  }
  if (existsSync(join(REPO, '.env'))) process.loadEnvFile(join(REPO, '.env'))
  const data = resolve(REPO, flag('data') ?? process.env.LSW_DATA ?? 'var')
  const withSweep = has('sweep')
  const dry = has('dry')
  const note = flag('note')
  const kind = flag('kind')
  const nth = flag('candidate')
  const max = flag('max')
  const L = flag('L')
  const stateDir = flag('state')
  const preset = flag('preset') as Preset | undefined
  const [cmd = 'scan', ...args] = argv
  const library = new WorldLibrary(buildOntology(), [...BASE_RULES, ...STORY_RULES], join(data, 'library.jsonl'))
  const log = (l: string) => console.log(l)

  if (cmd === 'scan') {
    const { candidates: found } = scan(library, { sweep: withSweep })
    if (!found.length) console.log(`no candidates (${library.patchRules().length} learned rules; K=${UPSTREAM.K}, S=${UPSTREAM.S}, N=${UPSTREAM.N})`)
    found.forEach((c, i) => console.log(`${i + 1}. ${describeCandidate(c)}`))
    return
  }
  if (cmd === 'status') {
    const all = status(data)
    if (!all.length) console.log('no proposals yet')
    for (const p of all) console.log(`${p.status.padEnd(8)} ${p.ancestor} at ${p.hole} (${p.kind}) · ${p.url ?? p.branch} · ${p.at.slice(0, 10)} · ${p.episode}`)
    return
  }
  if (cmd !== 'propose') throw new Error('usage: upstream scan [--sweep] | propose <hole> <class> [--kind k] [--note …] | propose --candidate <n> | status')
  let c: Candidate
  let cellsByRule: Record<string, number> | undefined
  if (nth) {
    const r = scan(library, { sweep: withSweep })
    c = r.candidates[Number(nth) - 1]
    cellsByRule = r.cellsByRule
    if (!c) throw new Error(`no candidate ${nth} (${r.candidates.length} found)`)
  } else {
    if (args.length < 2) throw new Error('usage: propose <hole> <class> [--kind k] [--note …]')
    c = byHand(library, args[0], args[1], kind)
    if (!c.rules.length) throw new Error(`no learned rule on ${c.ancestor} at ${c.hole} (${c.kind}): nothing to promote yet`)
  }
  console.log(describeCandidate(c))
  const state = SelfState.open(resolve(stateDir ?? join(data, 'modder-state')))
  if (preset) applyPreset(state, preset)
  const model = dry ? undefined : modelFromEnv()
  // a person runs this by hand: on this machine if there is no container (they see the warning)
  const r = await propose(c, { library, state, data, model, max: max ? Number(max) : undefined, L: L ? Number(L) : undefined, note, cellsByRule, localRun: true, dry, log })
  console.log(`${r.outcome}${r.url ? ` · ${r.url}` : ''}${r.episode ? ` · ${r.episode}` : ''}${r.reason ? `\n${r.reason}` : ''}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
