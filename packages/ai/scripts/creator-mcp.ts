// The complete coding agent gets active world queries, task records and native host checks through MCP.
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startAgentToolMcp } from '../src/agent/mcp.ts'
import { ChangeJobs, jobTools, type ChangeVerifier } from '../src/agent/jobs.ts'
import { CreatorSession, type CreatorSessionConfig } from '../src/service/creator-session.ts'
import { CreatorPreview, recordedPreviewMatches } from '../src/service/creator-preview.ts'
import { sourceVersion } from '../src/agent/source-version.ts'

console.log = (...args: unknown[]) => console.error(...args)
const configPath = process.argv[process.argv.indexOf('--context') + 1]
if (!configPath || !process.argv.includes('--context')) throw new Error('--context <job-config.json> required')
const config = JSON.parse(readFileSync(resolve(configPath), 'utf8')) as CreatorSessionConfig & { jobStore: string; clientDirectory?: string }
const session = await CreatorSession.open(config)
const jobs = new ChangeJobs(config.jobStore, { workspaceRoot: config.root })
const preview = config.clientDirectory ? new CreatorPreview(session, { clientDirectory: config.clientDirectory }) : undefined
const history = resolve(config.directory, 'domain-tools.jsonl')
const latest = (kind: string) => [...session.state.checks].reverse().find(c => c.kind === kind)
const stageChecks: Record<string, ChangeVerifier> = {
  proposal: () => {
    const ok = Object.keys(session.state.drafts).length > 0
    return { ok, summary: ok ? 'A native draft is staged' : 'Stage a native proposal first' }
  },
  trial: () => {
    const drafts = Object.values(session.state.drafts)
    const pending = drafts.flatMap(d => {
      const draft = (d.item ?? d.map)!
      const check = latest(`trial:${draft.id}`)
      return check?.passed && (check.result as { revision?: number })?.revision === draft.revision ? [] : [draft.id]
    })
    const ok = drafts.length > 0 && !pending.length
    return { ok, summary: ok ? 'Current drafts passed isolated trial' : 'Trial the exact current draft revisions', details: { pending } }
  },
  adoption: () => {
    try {
      if (!Object.keys(session.integrationDrafts()).length) throw new Error('Adopt at least one native draft')
      return { ok: true, summary: 'Current revisions are adopted and enabled in the candidate' }
    } catch (error) { return { ok: false, summary: (error as Error).message } }
  },
  'browser-play': () => {
    const check = latest('browser-play')
    const proof = check?.result as { sourceHash?: string; candidateHash?: string; snapshotFile?: string } | undefined
    const ok = !!check?.passed && proof?.sourceHash === sourceVersion(config.root)
      && recordedPreviewMatches(config.directory, session.game.save(), proof.candidateHash, proof.snapshotFile)
    return { ok, summary: ok ? 'Native inputs were captured for the current candidate' : 'Play and capture the current candidate with native inputs' }
  },
  publication: () => {
    const ok = session.state.published && !!latest('save-reload')?.passed
    return { ok, summary: ok ? 'The current candidate survived save/reload' : 'Publish the current candidate and check save/reload' }
  },
}
const finalCheck: ChangeVerifier = () => {
  const sourceHash = sourceVersion(config.root), errors: string[] = []
  for (const kind of ['types', 'tests', 'browser-play']) {
    const check = latest(kind), result = check?.result as { sourceHash?: string; candidateHash?: string; snapshotFile?: string } | undefined
    if (!check?.passed) errors.push(`Run and pass ${kind}`)
    else if (result?.sourceHash !== sourceHash) errors.push(`${kind} evidence is stale after source changes`)
    else if (kind === 'browser-play' && !recordedPreviewMatches(config.directory, session.game.save(), result.candidateHash, result.snapshotFile)) errors.push('Browser evidence is stale after the candidate changed; open and play the current candidate')
  }
  if (!session.state.published) errors.push('Publish the candidate after save/reload checks')
  if (!Object.values(session.state.drafts).some(d => d.adopted)) errors.push('No adopted content')
  else if (session.state.published) {
    try { session.integrationDrafts() } catch (error) { errors.push((error as Error).message) }
  }
  return { ok: !errors.length, summary: errors.length ? 'The actual candidate has remaining acceptance work' : 'Current source, trial/adoption, real UI inputs and save/reload passed', errors, details: { sourceHash, checks: [...new Map(session.state.checks.map(c => [c.kind, c.passed]))].map(([kind, passed]) => ({ kind, passed })), browser: (latest('browser-play')?.result as { file?: string } | undefined)?.file } }
}
const taskCheck: ChangeVerifier = (job, task) => {
  const errors: string[] = []
  if (!task) return finalCheck(job)
  const content = Object.values(session.state.drafts)
  if (task.kind === 'research') {
    const historyText = (() => { try { return readFileSync(history, 'utf8') } catch { return '' } })()
    if (!/"name":"(?:search_world|inspect_world|search_implementation|get_use_tree)"/.test(historyText)) errors.push('Query the actual world/use tree/implementation')
    if (!job.useTree) errors.push('Record the use/implementation tree')
  } else if (task.kind === 'item' && !content.some(d => d.item && d.adopted)) errors.push('Adopt and verify an actual item/use revision')
  else if (task.kind === 'map' && !content.some(d => d.map && d.adopted)) errors.push('Adopt and verify an actual map')
  else if (['mechanism', 'art'].includes(task.kind) && !task.artifacts.length) errors.push('Register the real source/resource artifact for this task')
  if (['verification', 'integration'].includes(task.kind)) return finalCheck(job, task)
  return { ok: !errors.length, summary: errors.length ? errors.join('; ') : `Actual ${task.kind} artifacts are present`, errors }
}
let actions: Promise<unknown> = Promise.resolve()
const reads = /^(?:search_world|inspect_world|get_use_tree|search_implementation|inspect_implementation|read_change_job|creator_status|creation_contract|get_creation_catalogue|inspect_draft|inspect_map|mechanism_status)$/
const server = startAgentToolMcp({ name: 'openworld-creator', tools: [...session.tools(), ...(preview?.tools() ?? []), ...jobTools(jobs, config.jobId, { verifiers: { actual: taskCheck, ...stageChecks }, finalizer: finalCheck })],
  callTool: (tool, args, context) => {
    const run = async () => {
      if (context.signal.aborted) throw new Error('Cancelled')
      const start = Date.now()
      try {
        const result = preview && /^(?:open|inspect|act|capture|replay)_playtest$/.test(tool.name) ? await preview.withSignal(context.signal, async () => tool.run(args)) : await tool.run(args)
        appendFileSync(history, JSON.stringify({ at: new Date().toISOString(), name: tool.name, args, result, ms: Date.now() - start }) + '\n')
        return result
      } catch (error) {
        appendFileSync(history, JSON.stringify({ at: new Date().toISOString(), name: tool.name, args, error: String(error), ms: Date.now() - start }) + '\n')
        throw error
      }
    }
    if (reads.test(tool.name)) return run()
    const next = actions.then(run)
    actions = next.catch(() => undefined)
    return next
  },
})
try { await server.closed } finally { await preview?.close(); session.close() }
