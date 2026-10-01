// A world task as a repository, so the modder works it the way it works any code task (and what
// it learns here — how to explore, test, fix — carries to SWE-style tasks):
//
//   ISSUE.md            the undefined interaction, as an issue
//   README.md           how this repository is laid out
//   MODSPEC.md          the authoring contract (rule shape, selectors, conditions, primitives…)
//   rules/<id>.json     every rule of the library, one per file (base rules and accepted patches)
//   ontology/*.json     types, statuses, terrains, elements, vfx
//   request.json        the full request: roles, context, the triggering scenario
//   validate.mjs        the tests: the engine's validator on the rules added under rules/patch/
//
// The agent adds rules (and, if needed, types/ or statuses/ files); collectPatch() turns what it
// added into a Patch. The world's own files cannot be changed: the validator rejects that.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalEnv, type AgentTask } from '@lsw/agent'
import type { LibraryData, ModRequest, ModSpec, Ontology, Patch, Rule, RuleLibrary, Scenario, StatusDef, TypeDef } from '@lsw/engine'

const VALIDATE_CLI = fileURLToPath(new URL('./validate-cli.ts', import.meta.url))
const DIRS = ['rules', 'types', 'statuses']

export interface WorldRepoState {
  request: ModRequest
  library: LibraryData
  /** patch rules this task may replace (a revision) */
  replaces: string[]
  regression: { scenario: Scenario; rule: string }[]
}

export interface WorldRepo {
  dir: string
  task: AgentTask
  collect(): { patch?: Patch; problems: string[] }
  dispose(): void
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex')

function write(dir: string, rel: string, body: string): void {
  const p = join(dir, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
}

function files(dir: string, sub: string): string[] {
  const root = join(dir, sub)
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (n.endsWith('.json')) out.push(relative(dir, p).split(sep).join('/'))
    }
  }
  walk(root)
  return out
}

export function modspecMarkdown(spec: ModSpec): string {
  const kv = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')
  return [
    `# ModSpec (${spec.version})`,
    '',
    spec.summary,
    '',
    '## Rule (rules/<id>.json)',
    kv(spec.rule),
    '',
    '## Selector (a role pattern in `when`)',
    kv(spec.selector),
    '',
    '## Conditions (`guard`)',
    ...spec.conditions.map((c) => `- ${c}`),
    '',
    '## Events (`on`)',
    kv(spec.events),
    '',
    '## Effect primitives (`do`)',
    kv(spec.primitives),
    '',
    '## Tests (`tests`: scenarios and expectations)',
    ...spec.expectations.map((c) => `- ${c}`),
    '',
    '## Authoring rules',
    ...spec.authoringRules.map((c) => `- ${c}`),
    '',
    'Types, statuses, terrains, elements and vfx are listed in ontology/.',
  ].join('\n')
}

function issueOf(req: ModRequest, revise?: { rules: Rule[]; notes: string[] }): string {
  const ent = (r: string, e?: ModRequest['event']['actor']) => (e ? `- ${r}: ${e.name} — \`${e.type}\`; tags ${e.tags.join(', ') || '—'}; statuses ${e.statuses.join(', ') || '—'}` : `- ${r}: none (empty-handed)`)
  return [
    revise ? `# Revise: ${req.summary}` : `# Undefined interaction: ${req.summary}`,
    '',
    'In the game world, a player just did this and no rule in `rules/` answers it:',
    '',
    `- verb: \`${req.event.verb}\``,
    ent('actor', req.event.actor),
    ent('target', req.event.target),
    ent('instrument', req.event.instrument),
    `- where: ${req.context.map.name} (${req.context.map.kind}), hour ${req.context.hour}`,
    '',
    'The full request, with the triggering scenario, is in `request.json`.',
    '',
    revise
      ? `This interaction is already answered by the rule(s) below, written quickly while the player waited. A reviewer asked for changes:\n${revise.notes.map((n) => `- ${n}`).join('\n')}\n\nReplace them: edit their files under rules/patch/ (or delete them and add new ones). Current rules: ${revise.rules.map((r) => `\`rules/${r.id}.json\``).join(', ')}.`
      : 'Define it: add the rule(s) that answer this CLASS of interaction under `rules/patch/` (one JSON rule per file; ids start with `patch/`; new types go in `types/`, new statuses in `statuses/`). Follow `MODSPEC.md` and the conventions of the existing rules.',
    '',
    'Done means `node validate.mjs` passes: your rule is valid, the interaction resolves to it, its tests pass and nothing that worked before breaks. Do not change existing files outside rules/patch/.',
  ].join('\n')
}

export function materializeWorld(o: { request: ModRequest; library: RuleLibrary; ontology: Ontology; spec: ModSpec; regression?: { scenario: Scenario; rule: string }[]; revise?: { rules: string[]; notes: string[] } }): WorldRepo {
  const dir = mkdtempSync(join(tmpdir(), 'lsw-world-'))
  const lib = o.library
  write(dir, 'ISSUE.md', issueOf(o.request, o.revise ? { rules: o.revise.rules.map((id) => lib.rules.get(id)!).filter(Boolean), notes: o.revise.notes } : undefined))
  write(
    dir,
    'README.md',
    '# A rule-based game world\n\nEvery mechanic is a rule in `rules/` (JSON). `MODSPEC.md` documents the rule format; `ontology/` lists the types, statuses, terrains, elements and vfx rules may use. `node validate.mjs` runs the engine\'s validator on the rules you add under `rules/patch/`.\n',
  )
  write(dir, 'MODSPEC.md', modspecMarkdown(o.spec))
  for (const r of lib.rules.values()) {
    const { source: _s, ...rule } = r
    write(dir, `rules/${r.id}.json`, JSON.stringify(rule, null, 2) + '\n')
  }
  for (const d of ['rules/patch', 'types', 'statuses']) mkdirSync(join(dir, d), { recursive: true })
  write(dir, 'ontology/types.json', JSON.stringify(o.spec.ontology.types, null, 1) + '\n')
  write(dir, 'ontology/statuses.json', JSON.stringify(o.spec.ontology.statuses, null, 1) + '\n')
  write(dir, 'ontology/terrains.json', JSON.stringify(o.spec.ontology.terrains, null, 1) + '\n')
  write(dir, 'ontology/elements.json', JSON.stringify(o.spec.ontology.elements) + '\n')
  write(dir, 'ontology/vfx.json', JSON.stringify(o.spec.assets.vfx) + '\n')
  write(dir, 'request.json', JSON.stringify(o.request, null, 2) + '\n')
  write(
    dir,
    'validate.mjs',
    `// the tests of this repository: the engine's validator on the rules under rules/patch/\nimport { spawnSync } from 'node:child_process'\nconst r = spawnSync('npx', ['tsx', ${JSON.stringify(VALIDATE_CLI)}, '.'], { stdio: 'inherit', shell: true })\nprocess.exit(r.status ?? 1)\n`,
  )
  const state: WorldRepoState = { request: o.request, library: lib.toJSON(), replaces: o.revise?.rules ?? [], regression: o.regression ?? [] }
  write(dir, '.lsw/state.json', JSON.stringify(state))
  const manifest = Object.fromEntries(DIRS.flatMap((d) => files(dir, d)).map((f) => [f, hash(readFileSync(join(dir, f), 'utf8'))]))
  write(dir, '.lsw/manifest.json', JSON.stringify(manifest))
  return {
    dir,
    task: {
      id: o.request.id,
      kind: 'world-repo',
      statement: readFileSync(join(dir, 'ISSUE.md'), 'utf8'),
      env: new LocalEnv(dir),
      tests: { command: 'node validate.mjs', timeoutMs: 180_000 },
      request: o.request,
    },
    collect: () => collectPatch(dir),
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  }
}

/**
 * What the agent added: new files under rules/, types/, statuses/ (and, in a revision, changes to
 * the rules it may replace). Changes to anything else are problems, not part of the patch.
 */
export function collectPatch(dir: string): { patch?: Patch; problems: string[] } {
  const manifest = JSON.parse(readFileSync(join(dir, '.lsw/manifest.json'), 'utf8')) as Record<string, string>
  const state = JSON.parse(readFileSync(join(dir, '.lsw/state.json'), 'utf8')) as WorldRepoState
  const replaceable = new Set(state.replaces.map((id) => `rules/${id}.json`))
  const problems: string[] = []
  const artifacts: Patch['artifacts'] = []
  for (const f of DIRS.flatMap((d) => files(dir, d))) {
    const body = readFileSync(join(dir, f), 'utf8')
    const known = manifest[f]
    if (known && known === hash(body)) continue
    if (known && !replaceable.has(f)) {
      problems.push(`${f} is part of the world: add new rules under rules/patch/ instead of changing it`)
      continue
    }
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch (err) {
      problems.push(`${f}: not valid JSON (${(err as Error).message})`)
      continue
    }
    if (f.startsWith('rules/')) {
      const rule = json as Rule
      if (!f.startsWith('rules/patch/')) problems.push(`${f}: new rules go under rules/patch/`)
      else if (rule?.id && `rules/${rule.id}.json` !== f) problems.push(`${f}: the file name must match the rule id ("${rule.id}" → rules/${rule.id}.json)`)
      artifacts.push({ kind: 'rule', rule })
    } else if (f.startsWith('types/')) artifacts.push({ kind: 'type', type: json as TypeDef })
    else artifacts.push({ kind: 'status', status: json as StatusDef })
  }
  for (const f of Object.keys(manifest)) if (!existsSync(join(dir, f)) && !replaceable.has(f)) problems.push(`${f} was deleted: the world's rules must stay`)
  return { patch: artifacts.length ? { artifacts, author: 'modder' } : undefined, problems }
}
