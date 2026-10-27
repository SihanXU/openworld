// A world task as a repository, so the modder works it the way it works any code task (and what
// it learns here — how to explore, test, fix — carries to SWE-style tasks):
//
//   ISSUE.md            the undefined outcome, as an issue
//   README.md           how this repository is laid out
//   MODSPEC.md          the authoring contract (rule shape, selectors, conditions, primitives…)
//   rules/<id>.json     every rule of the library, one per file (base rules and accepted patches)
//   ontology/*.json     types, statuses, terrains, elements, vfx
//   request.json        the full request: the event, its host and roles, the hole, context, the triggering scenario
//   validate.mjs        the tests: the engine's validator on the rules added under rules/patch/
//
// The agent adds rules (and, if needed, types/ or statuses/ files); collectPatch() turns what it
// added into a Patch. The world's own files cannot be changed: the validator rejects that.

import { createHash } from 'node:crypto'
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { REPO } from '../node.ts'
import { chooseIsolation, sandboxEnv, sh, type Env, type Isolation } from '../agent/env.ts'
import { type AgentTask } from '../agent/loop.ts'
import type { EntityInfo, LibraryData, ModRequest, ModSpec, Ontology, Patch, Rule, RuleLibrary, StatusDef, TypeDef } from '@openworld/engine'

const VALIDATE_CLI = fileURLToPath(new URL('./validate-cli.ts', import.meta.url))
const TSX = createRequire(import.meta.url).resolve('tsx/cli')
const DIRS = ['rules', 'types', 'statuses']

/** The engine's code as a container sees it: read-only, under /repo, without secrets. */
const IN_REPO = '/repo'
const asSeen = (p: string, iso: Isolation) => (iso === 'docker' ? `${IN_REPO}/${relative(REPO, p).split(sep).join('/')}` : p)

/** The validator, run from the engine's own code (never from a file the agent can edit). */
const validateCommand = (iso: Isolation) => `node ${sh(asSeen(TSX, iso))} ${sh(asSeen(VALIDATE_CLI, iso))} .`

function worldEnv(dir: string, iso: Isolation): Promise<Env> {
  const ro = (p: string) => ({ host: join(REPO, p), container: `${IN_REPO}/${p}` })
  return sandboxEnv(iso, dir, { mount: '/work', mounts: [ro('packages'), ro('node_modules'), ro('package.json'), ro('tsconfig.base.json')] })
}

export interface WorldRepoState {
  request: ModRequest
  /** The world's own ontology (without the library's types): what the validator checks against. */
  ontology: Ontology
  library: LibraryData
  /** patch rules this task may replace (a revision) */
  replaces: string[]
  /** Protected story prefixes, identical to final library admission. */
  protectedFacts?: string[]
}

export interface WorldRepo {
  dir: string
  task: AgentTask
  collect(): { patch?: Patch; problems: string[] }
  dispose(): Promise<void>
}

const hash = (s: string) => createHash('sha1').update(s).digest('hex')

/** Is `p` inside the folder `dir` (not the folder itself)? */
const inside = (dir: string, p: string) => {
  const r = relative(dir, p)
  return r !== '' && r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r)
}

/** A file's text as the repository holds it: a regular file, never read through a link at its last step. */
function readOwn(p: string): string {
  const fd = openSync(p, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    if (!fstatSync(fd).isFile()) throw new Error('not a regular file')
    return readFileSync(fd, 'utf8')
  } finally {
    closeSync(fd)
  }
}

/** A file of the repository: never outside it (a rule's file is named by its id, which the validator keeps to a path). */
function write(dir: string, rel: string, body: string): void {
  const p = resolve(dir, rel)
  if (!inside(dir, p)) throw new Error(`${rel} would be written outside the repository`)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
}

/**
 * The .json files under `sub`, as the repository holds them: a symbolic link is not followed (in a container the agent
 * may link to anything, and the host reads what it points to), it is a problem; so is what cannot be read.
 */
function files(dir: string, sub: string, problems: string[] = []): string[] {
  const out: string[] = []
  const walk = (rel: string) => {
    try {
      const at = join(dir, rel)
      const st = lstatSync(at, { throwIfNoEntry: false })
      if (!st) return
      if (st.isSymbolicLink()) problems.push(`${rel} is a symbolic link: write the file itself`)
      else if (st.isDirectory()) for (const n of readdirSync(at)) walk(`${rel}/${n}`)
      else if (st.isFile() && rel.endsWith('.json')) out.push(rel)
    } catch (err) {
      problems.push(`${rel}: ${(err as Error).message}`)
    }
  }
  walk(sub)
  return out
}

function modspecMarkdown(spec: ModSpec): string {
  const kv = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')
  return [
    `# ModSpec (${spec.version})`,
    '',
    spec.summary,
    '',
    '## Rule (rules/<id>.json)',
    kv(spec.rule),
    '',
    '## Tree (`tree`: the outcome)',
    kv(spec.tree),
    '',
    '## Selector (the `host` class, and `is` conditions on roles)',
    kv(spec.selector),
    '',
    '## Conditions (`if` in the tree)',
    ...spec.conditions.map((c) => `- ${c}`),
    '',
    '## Events (`on`)',
    kv(spec.events),
    '',
    '## Impulses (`emit`: how a rule affects others)',
    kv(spec.impulses),
    '',
    '## Effect primitives (`do` leaves; they act on the host)',
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

function issueOf(req: ModRequest, revise?: { rules: Rule[]; notes: string[] }, audit?: { notes: string[]; draft: Patch }): string {
  const ent = (r: string, e?: EntityInfo) => (e ? `- ${r}: ${e.name} — \`${e.type}\`; tags ${e.tags.join(', ') || '—'}; statuses ${e.statuses.join(', ') || '—'}` : `- ${r}: none`)
  const params = Object.entries(req.event.params ?? {})
  return [
    revise ? `# Revise: ${req.summary}` : `# Undefined outcome: ${req.summary}`,
    '',
    req.origin === 'world'
      ? 'In the game world, this happened by itself (no player asked) and its outcome is undefined. Keep the answer small and legible, never harm a person, never touch the story\'s facts:'
      : 'In the game world, a player\'s act led to this event, and its outcome is undefined:',
    '',
    `- event: \`${req.event.kind}\`${params.length ? ` (${params.map(([k, v]) => `${k} \`${v}\``).join(', ')})` : ''}`,
    ...(req.event.detail ? [`- detail: ${req.event.detail}`] : []),
    ent('host (the rule you write is its nature)', req.event.host),
    ...Object.entries(req.event.roles).map(([k, e]) => ent(k, e)),
    `- undefined at: \`rules/${req.hole.rule}.json\`${req.hole.path.length ? ` (branches ${req.hole.path.join(' → ')})` : ''}`,
    `- where: ${req.context.map.name} (${req.context.map.kind}), hour ${req.context.hour}`,
    '',
    'The full request, with the triggering scenario, is in `request.json`.',
    '',
    revise
      ? `This outcome is already answered by the rule(s) below, written quickly while the player waited. A reviewer asked for changes:\n${revise.notes.map((n) => `- ${n}`).join('\n')}\n\nReplace them: edit their files under rules/patch/ (or delete them and add new ones). Current rules: ${revise.rules.map((r) => `\`rules/${r.id}.json\``).join(', ')}.`
      : 'Define it: add the rule that answers this event for this host TYPE under `rules/patch/` (one JSON rule `{id, host, on, tree, doc}` per file; ids start with `patch/`; host is exactly {type: <the host\'s type>} and on the exact event kind, as the issue says; the harness sets the rule\'s place (hole, at) when it takes the patch; a case you do not answer ends in {"undefined": true}, never "inherit"; new types go in `types/`, new statuses in `statuses/`). A rule writes only its host; it affects others by emitting impulses. Follow `MODSPEC.md` and the conventions of the existing rules.',
    '',
    'Done means `node validate.mjs` passes: your rule is valid, the event resolves to it, its tests pass and nothing that worked before breaks. Do not change existing files outside rules/patch/.',
    ...(audit
      ? [
          '',
          '## An auditor broke your previous draft in the sandbox (shown with the patch and not without it)',
          ...audit.notes.map((n) => `- ${n}`),
          '',
          'Your previous draft (write a new one that cannot be broken this way: make it cost something, run out, or give less):',
          ...audit.draft.artifacts.flatMap((a) => (a.kind === 'rule' ? ['```json\n' + JSON.stringify({ ...a.rule, tests: undefined }) + '\n```'] : [])),
        ]
      : []),
  ].join('\n')
}

type WorldOptions = { request: ModRequest; library: RuleLibrary; ontology: Ontology; base: Ontology; spec: ModSpec; protectedFacts?: string[]; revise?: { rules: string[]; notes: string[] }; audit?: { notes: string[]; draft: Patch }; isolation?: Isolation }

/**
 * A world task in a container sees its workspace (written to), the engine's code (read-only)
 * and nothing else — not the repository's `.env`, not `var/`, no network; there the agent may run
 * any command. Without a container it gets no shell: file tools and the validator only
 * (`chooseIsolation`, packages/ai/src/agent/env.ts).
 */
export async function materializeWorld(o: WorldOptions): Promise<WorldRepo> {
  const iso = o.isolation ?? (await chooseIsolation())
  const dir = mkdtempSync(join(tmpdir(), 'lsw-world-'))
  try {
    return await worldRepo(dir, iso, o)
  } catch (err) {
    // (a container that did not start, a file that could not be written: the folder goes with the attempt)
    rmSync(dir, { recursive: true, force: true })
    throw err
  }
}

async function worldRepo(dir: string, iso: Isolation, o: WorldOptions): Promise<WorldRepo> {
  const lib = o.library
  write(dir, 'ISSUE.md', issueOf(o.request, o.revise ? { rules: o.revise.rules.map((id) => lib.rules.get(id)!).filter(Boolean), notes: o.revise.notes } : undefined, o.audit))
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
    `// the tests of this repository: the engine's validator on the rules under rules/patch/\nimport { spawnSync } from 'node:child_process'\nconst r = spawnSync(process.execPath, ${JSON.stringify([asSeen(TSX, iso), asSeen(VALIDATE_CLI, iso), '.'])}, { stdio: 'inherit' })\nprocess.exit(r.status ?? 1)\n`,
  )
  const state: WorldRepoState = { request: o.request, ontology: o.base, library: lib.toJSON(), replaces: o.revise?.rules ?? [], protectedFacts: [...(o.protectedFacts ?? [])] }
  write(dir, '.lsw/state.json', JSON.stringify(state))
  const manifest = Object.fromEntries(DIRS.flatMap((d) => files(dir, d)).map((f) => [f, hash(readFileSync(join(dir, f), 'utf8'))]))
  write(dir, '.lsw/manifest.json', JSON.stringify(manifest))
  const env = await worldEnv(dir, iso)
  return {
    dir,
    task: {
      id: o.request.id,
      kind: 'world-repo',
      statement: readFileSync(join(dir, 'ISSUE.md'), 'utf8'),
      env,
      // the validator itself, never the workspace's validate.mjs: the agent may edit that file
      tests: { command: validateCommand(iso), timeoutMs: 180_000 },
      request: o.request,
    },
    // what the agent left running stops first: nothing swaps a file for a link while the host reads the patch
    collect: () => {
      env.halt?.()
      return collectPatch(dir)
    },
    dispose: async () => {
      await env.dispose?.()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/**
 * What the agent added: new files under rules/, types/, statuses/ (and, in a revision, changes to
 * the rules it may replace). Changes to anything else are problems, not part of the patch.
 */
export function collectPatch(dir: string): { patch?: Patch; problems: string[] } {
  const problems: string[] = []
  // the harness's own files are in the workspace the agent writes: read as the repository's (no link out of it),
  // and one changed or unreadable is a problem, not a throw
  const own = <T>(rel: string): T | undefined => {
    try {
      const p = join(dir, rel)
      if (!lstatSync(p).isFile() || !inside(realpathSync(dir), realpathSync(p))) throw new Error('not a file of the repository')
      return JSON.parse(readOwn(p)) as T
    } catch (err) {
      problems.push(`${rel} is the harness's and cannot be read: ${(err as Error).message}`)
      return undefined
    }
  }
  const manifest = own<Record<string, string>>('.lsw/manifest.json')
  const state = own<WorldRepoState>('.lsw/state.json')
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(state?.replaces)) return { problems: problems.length ? problems : ['.lsw/ was changed: the harness\'s files must stay as they were'] }
  const replaceable = new Set(state.replaces.map((id) => `rules/${id}.json`))
  const artifacts: Patch['artifacts'] = []
  for (const f of DIRS.flatMap((d) => files(dir, d, problems))) {
    let body: string
    try {
      body = readOwn(join(dir, f))
    } catch (err) {
      problems.push(`${f}: ${(err as Error).message}`)
      continue
    }
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
