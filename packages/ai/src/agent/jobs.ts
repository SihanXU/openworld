// Durable change targets and evidence. A model may plan work; only registered host checks verify it.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { AgentTool } from './tools.ts'

export type ChangePhase = 'planning' | 'research' | 'implementing' | 'verifying' | 'integrating' | 'complete'
export type ChangeTaskKind = 'research' | 'art' | 'mechanism' | 'item' | 'map' | 'integration' | 'verification'
export type ChangeTaskStatus = 'todo' | 'doing' | 'blocked' | 'verified'
export interface ChangeTaskInput { id: string; title: string; kind: ChangeTaskKind; parentId?: string; dependsOn?: string[]; notes?: string }
export interface ChangeTask extends ChangeTaskInput { status: ChangeTaskStatus; artifacts: string[]; evidence: string[] }
export interface ChangeArtifact { id: string; taskId: string; kind: string; path: string; sha256: string; bytes: number; note?: string; at: string }
export interface VerificationResult { ok: boolean; summary: string; errors?: string[]; artifacts?: string[]; details?: unknown }
export interface VerificationEvidence extends VerificationResult { id: string; taskId?: string; check: string; at: string; artifactHashes: Record<string, string> }
export interface ChangeJob {
  schema: 1
  id: string
  order: string
  phase: ChangePhase
  createdAt: string
  updatedAt: string
  target?: { kind: string; id: string; revision?: number }
  useTree?: unknown
  tasks: ChangeTask[]
  decisions: { text: string; tasks: string[]; at: string }[]
  artifacts: ChangeArtifact[]
  evidence: VerificationEvidence[]
  events: { action: string; taskId?: string; at: string; detail?: unknown }[]
}
export type ChangeVerifier = (job: Readonly<ChangeJob>, task?: Readonly<ChangeTask>) => Promise<VerificationResult> | VerificationResult
export interface ChangeJobsOptions { workspaceRoot?: string }
export interface JobToolsOptions { verifiers?: Record<string, ChangeVerifier>; finalizer?: ChangeVerifier }

const ID = /^[a-z][a-z0-9_-]{0,79}$/
const PHASES: ChangePhase[] = ['planning', 'research', 'implementing', 'verifying', 'integrating', 'complete']
const KINDS: ChangeTaskKind[] = ['research', 'art', 'mechanism', 'item', 'map', 'integration', 'verification']
const STATUSES: ChangeTaskStatus[] = ['todo', 'doing', 'blocked', 'verified']
const NOW = () => new Date().toISOString()
const CLONE = <T>(v: T): T => structuredClone(v)
const OBJECT = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const short = (v: unknown, name: string, max = 4000) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`${name} must be non-empty text of at most ${max} characters`); return v }
const ident = (v: unknown, name = 'id') => { if (typeof v !== 'string' || !ID.test(v)) throw new Error(`${name} must be a lower-case stable ID`); return v }
const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
function jsonValue(v: unknown): void {
  const raw = JSON.stringify(v)
  if (raw === undefined || raw.length > 65_536 || /"(?:__proto__|constructor|prototype)"\s*:/.test(raw)) throw new Error('useTree must be ordinary JSON data of at most 64 KiB')
  JSON.parse(raw)
}

function graph(tasks: ChangeTask[]): void {
  if (tasks.length > 80) throw new Error('A change job supports at most 80 focused tasks')
  const byId = new Map<string, ChangeTask>()
  for (const task of tasks) {
    ident(task.id, 'task id'); short(task.title, 'task title', 500)
    if (!KINDS.includes(task.kind) || !STATUSES.includes(task.status)) throw new Error(`Invalid kind/status for task ${task.id}`)
    if (byId.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`)
    byId.set(task.id, task)
  }
  for (const relation of ['dependency', 'parent'] as const) {
    const done = new Set<string>(), visiting = new Set<string>()
    const visit = (id: string) => {
      if (visiting.has(id)) throw new Error(`Task ${relation} cycle at ${id}`)
      if (done.has(id)) return
      const task = byId.get(id)
      if (!task) throw new Error(`Unknown task ${relation}: ${id}`)
      visiting.add(id)
      for (const parent of relation === 'dependency' ? task.dependsOn ?? [] : task.parentId ? [task.parentId] : []) visit(parent)
      visiting.delete(id); done.add(id)
    }
    for (const id of byId.keys()) visit(id)
  }
}

export class ChangeJobs {
  readonly dir: string
  readonly workspaceRoot: string
  constructor(dir: string, options: ChangeJobsOptions = {}) {
    this.dir = resolve(dir); this.workspaceRoot = resolve(options.workspaceRoot ?? dir); mkdirSync(this.dir, { recursive: true })
  }
  private file(id: string) { return resolve(this.dir, ident(id), 'job.json') }
  private validate(job: ChangeJob): void {
    if (!OBJECT(job) || job.schema !== 1 || !ID.test(job.id) || typeof job.order !== 'string' || !PHASES.includes(job.phase) || !Array.isArray(job.tasks) || !Array.isArray(job.artifacts) || !Array.isArray(job.evidence) || !Array.isArray(job.events) || !Array.isArray(job.decisions)) throw new Error('Invalid stored change job')
    graph(job.tasks)
    if (job.phase === 'complete' && (!job.tasks.length || job.tasks.some(t => t.status !== 'verified') || !job.evidence.some(e => !e.taskId && e.ok))) throw new Error('A complete job needs verified tasks and host completion evidence')
  }
  private write(job: ChangeJob, action: string, taskId?: string, detail?: unknown): ChangeJob {
    const at = NOW(), event = { action, ...(taskId && { taskId }), at, ...(detail !== undefined && { detail }) }
    job.updatedAt = at; job.events = [...job.events, event].slice(-200)
    this.validate(job)
    const file = this.file(job.id), folder = resolve(this.dir, job.id); mkdirSync(folder, { recursive: true })
    const temp = `${file}.${randomUUID()}.tmp`; writeFileSync(temp, JSON.stringify(job, null, 2) + '\n'); renameSync(temp, file)
    appendFileSync(resolve(folder, 'events.jsonl'), JSON.stringify(event) + '\n')
    return CLONE(job)
  }
  create(order: string, options: { id?: string; target?: ChangeJob['target'] } = {}): ChangeJob {
    const id = ident(options.id ?? `change_${randomUUID().replaceAll('-', '')}`), at = NOW()
    if (existsSync(this.file(id))) throw new Error(`Change job already exists: ${id}`)
    return this.write({ schema: 1, id, order: short(order, 'order', 20000), phase: 'planning', createdAt: at, updatedAt: at, ...(options.target && { target: CLONE(options.target) }), tasks: [], decisions: [], artifacts: [], evidence: [], events: [] }, 'created')
  }
  read(id: string): ChangeJob {
    const job = JSON.parse(readFileSync(this.file(id), 'utf8')) as ChangeJob
    if (job.id !== id) throw new Error('Stored job identity differs from its file')
    this.validate(job); return CLONE(job)
  }
  private task(job: ChangeJob, id: string): ChangeTask {
    const task = job.tasks.find(t => t.id === id)
    if (!task) throw new Error(`Unknown task: ${id}`)
    return task
  }
  private invalidate(job: ChangeJob, id: string): void {
    const affected = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      for (const t of job.tasks) {
        if (!affected.has(t.id) && (t.dependsOn ?? []).some(d => affected.has(d))) { affected.add(t.id); changed = true }
        if (affected.has(t.id) && t.parentId && !affected.has(t.parentId)) { affected.add(t.parentId); changed = true }
      }
    }
    for (const t of job.tasks) if (affected.has(t.id) && t.status === 'verified') t.status = 'todo'
    if (job.phase === 'complete') job.phase = 'implementing'
  }
  plan(id: string, input: { tasks?: ChangeTaskInput[]; useTree?: unknown }): ChangeJob {
    const job = this.read(id)
    if (input.useTree !== undefined) { jsonValue(input.useTree); if (JSON.stringify(input.useTree) !== JSON.stringify(job.useTree)) { job.useTree = CLONE(input.useTree); for (const t of job.tasks) this.invalidate(job, t.id) } }
    if (input.tasks) for (const row of input.tasks) {
      const old = job.tasks.find(t => t.id === row.id)
      const definition = { id: ident(row.id, 'task id'), title: short(row.title, 'task title', 500), kind: row.kind, ...(row.parentId && { parentId: ident(row.parentId) }), dependsOn: (row.dependsOn ?? []).map(d => ident(d)), ...(row.notes && { notes: short(row.notes, 'notes') }) }
      if (old) {
        const oldTarget = { id: old.id, title: old.title, kind: old.kind, parentId: old.parentId, dependsOn: old.dependsOn ?? [] }
        const newTarget = { id: definition.id, title: definition.title, kind: definition.kind, parentId: definition.parentId, dependsOn: definition.dependsOn }
        if (JSON.stringify(oldTarget) !== JSON.stringify(newTarget)) this.invalidate(job, old.id)
        Object.assign(old, definition)
      } else {
        job.tasks.push({ ...definition, status: 'todo', artifacts: [], evidence: [] })
        if (definition.parentId) this.invalidate(job, definition.parentId)
        if (job.phase === 'complete') job.phase = 'planning'
      }
    }
    graph(job.tasks)
    return this.write(job, 'planned')
  }
  updateTask(id: string, taskId: string, update: { status?: Exclude<ChangeTaskStatus, 'verified'>; notes?: string }): ChangeJob {
    const job = this.read(id), task = this.task(job, taskId)
    if (update.status && !['todo', 'doing', 'blocked'].includes(update.status)) throw new Error('Only a host verification may mark a task verified')
    if (update.status === 'doing') for (const d of task.dependsOn ?? []) if (this.task(job, d).status !== 'verified') throw new Error(`Verify dependency ${d} before starting ${taskId}`)
    this.invalidate(job, taskId)
    if (update.status) task.status = update.status
    if (update.notes !== undefined) task.notes = short(update.notes, 'notes')
    return this.write(job, 'task-updated', taskId)
  }
  setPhase(id: string, phase: Exclude<ChangePhase, 'complete'>): ChangeJob {
    if (!PHASES.includes(phase) || phase as string === 'complete') throw new Error('Job completion requires a host verifier')
    const job = this.read(id); job.phase = phase; return this.write(job, 'phase', undefined, phase)
  }
  decision(id: string, text: string, tasks: string[] = []): ChangeJob {
    const job = this.read(id); for (const task of tasks) this.task(job, task)
    job.decisions.push({ text: short(text, 'decision'), tasks, at: NOW() })
    return this.write(job, 'decision', undefined, { text, tasks })
  }
  failure(id: string, message: string, taskId?: string): ChangeJob {
    const job = this.read(id)
    if (taskId) { const task = this.task(job, taskId); this.invalidate(job, taskId); task.status = 'blocked'; task.notes = short(message, 'failure') }
    job.phase = 'implementing'
    return this.write(job, 'execution-failed', taskId, { message: short(message, 'failure') })
  }
  artifact(id: string, input: { taskId: string; kind: string; path: string; note?: string }): ChangeArtifact {
    const job = this.read(id), task = this.task(job, input.taskId), absolute = resolve(this.workspaceRoot, input.path), rel = relative(this.workspaceRoot, absolute)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Artifact must be inside the bound workspace')
    const real = realpathSync(absolute), actual = relative(realpathSync(this.workspaceRoot), real)
    if (actual === '..' || actual.startsWith(`..${sep}`) || isAbsolute(actual)) throw new Error('Artifact resolves outside the bound workspace')
    const bytes = readFileSync(absolute), hash = digest(bytes), old = job.artifacts.find(a => a.taskId === input.taskId && a.path === rel.split(sep).join('/'))
    if (old?.sha256 === hash) return CLONE(old)
    this.invalidate(job, task.id)
    const artifact: ChangeArtifact = { id: old?.id ?? `artifact_${randomUUID().replaceAll('-', '')}`, taskId: task.id, kind: short(input.kind, 'artifact kind', 100), path: rel.split(sep).join('/'), sha256: hash, bytes: bytes.length, ...(input.note && { note: short(input.note, 'artifact note') }), at: NOW() }
    job.artifacts = [...job.artifacts.filter(a => a.id !== artifact.id), artifact]
    if (!task.artifacts.includes(artifact.id)) task.artifacts.push(artifact.id)
    this.write(job, 'artifact', task.id, { id: artifact.id, path: artifact.path, sha256: hash })
    return CLONE(artifact)
  }
  private hashes(job: ChangeJob): Record<string, string> {
    return Object.fromEntries(job.artifacts.map(a => [a.path, digest(readFileSync(resolve(this.workspaceRoot, a.path)))]))
  }
  async verify(id: string, taskId: string, check: string, verifier: ChangeVerifier): Promise<VerificationEvidence> {
    const job = this.read(id), task = this.task(job, taskId)
    for (const d of task.dependsOn ?? []) if (this.task(job, d).status !== 'verified') throw new Error(`Verify dependency ${d} first`)
    const result = await verifier(CLONE(job), CLONE(task))
    if (!OBJECT(result) || typeof result.ok !== 'boolean' || typeof result.summary !== 'string') throw new Error('Host verifier must return ok and summary')
    const evidence: VerificationEvidence = { ...CLONE(result), id: `evidence_${randomUUID().replaceAll('-', '')}`, taskId, check: short(check, 'check', 100), at: NOW(), artifactHashes: this.hashes(job) }
    job.evidence.push(evidence); task.evidence.push(evidence.id)
    if (!result.ok) this.invalidate(job, taskId)
    task.status = result.ok ? 'verified' : 'blocked'; job.phase = 'verifying'
    this.write(job, result.ok ? 'verified' : 'verification-failed', taskId, evidence)
    return CLONE(evidence)
  }
  async complete(id: string, verifier: ChangeVerifier): Promise<VerificationEvidence> {
    const job = this.read(id)
    if (!job.tasks.length || job.tasks.some(t => t.status !== 'verified')) throw new Error('Verify every planned task before completing the job')
    const hashes = this.hashes(job)
    for (const a of job.artifacts) if (hashes[a.path] !== a.sha256) throw new Error(`Artifact changed since registration: ${a.path}`)
    for (const task of job.tasks) {
      const evidence = job.evidence.find(e => e.id === task.evidence.at(-1))
      if (!evidence?.ok) throw new Error(`Task ${task.id} lacks successful host evidence`)
      for (const [path, hash] of Object.entries(evidence.artifactHashes)) if (hashes[path] !== hash) throw new Error(`Artifact changed after verification: ${path}`)
    }
    const result = await verifier(CLONE(job))
    if (!OBJECT(result) || typeof result.ok !== 'boolean' || typeof result.summary !== 'string') throw new Error('Host verifier must return ok and summary')
    const evidence: VerificationEvidence = { ...CLONE(result), id: `evidence_${randomUUID().replaceAll('-', '')}`, check: 'complete', at: NOW(), artifactHashes: hashes }
    job.evidence.push(evidence); job.phase = result.ok ? 'complete' : 'verifying'
    this.write(job, result.ok ? 'completed' : 'completion-failed', undefined, evidence)
    return CLONE(evidence)
  }
}

const TASK_SCHEMA = { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, kind: { type: 'string', enum: KINDS }, parentId: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['id', 'title', 'kind'] }
export function jobTools(store: ChangeJobs, jobId: string, options: JobToolsOptions = {}): AgentTool[] {
  const tools: AgentTool[] = [
    { name: 'read_change_job', description: 'Resume this durable order, use/implementation tree, task targets, decisions, artifact hashes and host-verification evidence.', parameters: { type: 'object', properties: {} }, run: () => JSON.stringify(store.read(jobId)) },
    { name: 'plan_change_job', description: 'Record or extend the use/implementation tree and stable tasks. Tasks are TODO until actual host checks verify them. Preserve existing IDs.', parameters: { type: 'object', properties: { useTree: { type: 'object' }, tasks: { type: 'array', items: TASK_SCHEMA } } }, run: a => JSON.stringify(store.plan(jobId, a as { useTree?: unknown; tasks?: ChangeTaskInput[] })) },
    { name: 'update_change_task', description: 'Set a task todo/doing/blocked and record progress/failure notes. This cannot mark a task verified.', parameters: { type: 'object', properties: { taskId: { type: 'string' }, status: { type: 'string', enum: ['todo', 'doing', 'blocked'] }, notes: { type: 'string' } }, required: ['taskId'] }, run: a => JSON.stringify(store.updateTask(jobId, String(a.taskId ?? ''), { status: a.status as Exclude<ChangeTaskStatus, 'verified'> | undefined, notes: a.notes as string | undefined })) },
    { name: 'record_change_decision', description: 'Keep a reuse/rebuild/resource decision with the task IDs it affects. Decisions do not count as execution evidence.', parameters: { type: 'object', properties: { text: { type: 'string' }, tasks: { type: 'array', items: { type: 'string' } } }, required: ['text'] }, run: a => JSON.stringify(store.decision(jobId, String(a.text ?? ''), a.tasks as string[] | undefined)) },
    { name: 'record_change_artifact', description: 'Register an existing source/art/map/plan artifact in the bound workspace, with its actual bytes/hash. A changed artifact invalidates task/dependent verification.', parameters: { type: 'object', properties: { taskId: { type: 'string' }, kind: { type: 'string' }, path: { type: 'string' }, note: { type: 'string' } }, required: ['taskId', 'kind', 'path'] }, run: a => JSON.stringify(store.artifact(jobId, a as unknown as { taskId: string; kind: string; path: string; note?: string })) },
  ]
  if (options.verifiers && Object.keys(options.verifiers).length) tools.push({ name: 'verify_change_task', description: 'Choose the registered host check for the task’s current stage (for example trial before adoption). It records actual pass/failure evidence. The complete job has a separate final gate.', parameters: { type: 'object', properties: { taskId: { type: 'string' }, check: { type: 'string', enum: Object.keys(options.verifiers) } }, required: ['taskId', 'check'] }, run: async a => {
    const check = String(a.check ?? ''), verifier = options.verifiers?.[check]; if (!verifier) throw new Error('Unknown host check')
    return JSON.stringify(await store.verify(jobId, String(a.taskId ?? ''), check, verifier))
  } })
  if (options.finalizer) tools.push({ name: 'complete_change_job', description: 'Execute final host integration/acceptance after every task is verified and artifact hashes still match. Only this callback can complete the job.', parameters: { type: 'object', properties: {} }, run: async () => JSON.stringify(await store.complete(jobId, options.finalizer!)) })
  return tools
}
