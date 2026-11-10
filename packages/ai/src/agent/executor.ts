// Complete coding-agent execution: native CLI tools + trusted MCP tools, with persistent per-job sessions.
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { taskEnvironment } from './env.ts'

export interface CodingAgentJob {
  id: string
  workspace: string
  order: string
  stateDirectory: string
  model?: string
  toolServerConfig?: Record<string, unknown> | string
  command?: string
  commandArgs?: string[]
  /** Only these explicit additions, plus ordinary executable/platform variables, reach the CLI. Never persisted. */
  env?: Record<string, string>
  timeoutMs?: number
  maxTurns?: number
  /** Maximum new delegate starts across the job, including resumed runs; default 2. */
  maxDelegates?: number
  resume?: boolean
  signal?: AbortSignal
  onEvent?: (event: Record<string, unknown>) => void
}
export interface CodingAgentResult {
  ok: boolean
  status: 'completed' | 'failed' | 'timeout' | 'interrupted'
  jobId: string
  sessionId?: string
  output: string
  exitCode: number | null
  durationMs: number
  usage?: Record<string, unknown>
  /** Retained CLI accounting is an estimate, not a verified provider invoice. */
  costBasis: 'cli-estimate-not-provider-price'
  permissionDenials: unknown[]
  delegates: { requested: number; starts: number; resumes: number; failed: number; childEvents: number }
  events: Record<string, unknown>[]
  eventsTruncated: boolean
  error?: string
  artifacts: { events: string; stderr: string; request: string; result: string }
  /** The CLI's final result remains separate from any host game verification. */
  cliResult?: Record<string, unknown>
}

function secretsOf(value: unknown, out: string[] = []): string[] {
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if (/(?:key|token|secret|password|auth)/i.test(key) && typeof item === 'string' && item.length >= 6) out.push(item)
    else if (item && typeof item === 'object') secretsOf(item, out)
  }
  return out
}

/** A real PreToolUse hook reserves delegate slots atomically, even if native agents launch concurrently. */
function delegateSettings(directory: string, limit: number): Record<string, unknown> {
  const script = `const fs=require('node:fs'),path=require('node:path');let raw='';process.stdin.on('data',d=>raw+=d);process.stdin.on('end',()=>{try{const event=JSON.parse(raw);if(!['Agent','Task'].includes(event.tool_name)||event.tool_input?.resume)return;const root=${JSON.stringify(join(directory, 'delegates'))};fs.mkdirSync(root,{recursive:true});for(let n=1;n<=${limit};n++){try{fs.mkdirSync(path.join(root,String(n)));return}catch(e){if(e.code!=='EEXIST')throw e}}console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'The job delegate-start limit is reached. Continue in the current agent or resume an existing delegate.'}}))}catch(e){console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Delegate budget could not be checked.'}}))}});`
  // Only base64 enters the shell command; job paths are data inside the trusted program.
  const command = `node -e "eval(Buffer.from('${Buffer.from(script).toString('base64')}','base64').toString())"`
  return { hooks: { PreToolUse: [{ matcher: 'Agent|Task', hooks: [{ type: 'command', command, timeout: 10 }] }] } }
}

/** Does not decide whether the game change is correct; the caller runs its independent host verifier. */
export async function runCodingAgentJob(job: CodingAgentJob): Promise<CodingAgentResult> {
  if (!job.id || !job.order.trim()) throw new Error('A coding job needs an identity and an order')
  const workspace = resolve(job.workspace), directory = resolve(job.stateDirectory)
  mkdirSync(directory, { recursive: true })
  const sessionFile = join(directory, 'session.json')
  const previous = existsSync(sessionFile) ? JSON.parse(readFileSync(sessionFile, 'utf8')) : undefined
  if (previous && (previous.jobId !== job.id || previous.workspace !== workspace)) throw new Error('The session directory belongs to another job or workspace')
  const secrets = [...secretsOf(job.env), ...secretsOf(typeof job.toolServerConfig === 'object' ? job.toolServerConfig : {})]
  const redact = (text: string) => secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), text)
  const clean = <T>(value: T): T => JSON.parse(redact(JSON.stringify(value)))
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`, prefix = join(directory, runId)
  const artifacts = { events: prefix + '.events.jsonl', stderr: prefix + '.stderr.log', request: prefix + '.request.json', result: prefix + '.result.json' }
  const limit = job.maxDelegates ?? 2
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 4) throw new Error('maxDelegates must be an integer from 0 to 4')
  const guidance = `Work on job ${job.id} in the supplied workspace. Read the saved task state first and continue its next actionable task. Use tool help and observed results to operate the game. Query the game's objects, implementation and resources through the available MCP and native tools when a specific decision or failure needs it. Read project instructions, maintain the task/use tree and recorded evidence, implement and verify the order. Do not ask the supervisor to provide source excerpts or case-specific implementation directions. You may start at most ${limit} new delegates across this job; reuse existing delegates when useful. Delegates must not create further delegates. Do not commit, push or open a PR. Report actual tool outcomes and unresolved failures precisely. Finish normally when your work is ready for independent host verification.`
  const tools = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Agent']
  // Bare mode suppresses native tools even when explicitly named. Use the full CLI with only job settings.
  const args = [...(job.commandArgs ?? []), '--setting-sources', '', '--disable-slash-commands', '-p', '--output-format', 'stream-json', '--verbose', '--tools', ...tools, '--permission-mode', 'acceptEdits', '--allowedTools', ...tools, 'Task', 'mcp__world__*', '--disallowedTools', 'Bash', '--append-system-prompt', guidance, '--settings', JSON.stringify(delegateSettings(directory, limit)),
    ...(job.model ? ['--model', job.model] : []), ...(job.maxTurns ? ['--max-turns', String(job.maxTurns)] : []),
    ...(job.toolServerConfig ? ['--strict-mcp-config', '--mcp-config', typeof job.toolServerConfig === 'string' ? job.toolServerConfig : JSON.stringify(job.toolServerConfig)] : []),
    ...(job.resume !== false && previous?.sessionId ? ['--resume', previous.sessionId] : []),
  ]
  writeFileSync(artifacts.request, JSON.stringify(clean({ jobId: job.id, workspace, order: job.order, command: job.command ?? 'claude', args, envNames: Object.keys(job.env ?? {}), resumed: job.resume !== false ? previous?.sessionId : undefined, maxDelegates: limit }), null, 2))
  writeFileSync(artifacts.events, ''); writeFileSync(artifacts.stderr, '')
  const start = Date.now(), events: Record<string, unknown>[] = [], delegates = { requested: 0, starts: 0, resumes: 0, failed: 0, childEvents: 0 }
  const delegateCalls = new Map<string, { resumed: boolean; counted: boolean }>()
  let final: Record<string, any> | undefined, sessionId: string | undefined = previous?.sessionId, error: string | undefined
  let timedOut = false, interrupted = false, truncated = false, stopStartup = () => {}
  const saveSession = () => {
    if (!sessionId) return
    const temporary = sessionFile + '.tmp'
    writeFileSync(temporary, JSON.stringify({ jobId: job.id, workspace, sessionId, updatedAt: new Date().toISOString() }, null, 2)); renameSync(temporary, sessionFile)
  }
  const event = (raw: Record<string, any>) => {
    // Per-token progress is transport telemetry, not an action or a verification result.
    if (raw.type === 'system' && raw.subtype === 'thinking_tokens') return
    const item = clean(raw)
    appendFileSync(artifacts.events, JSON.stringify(item) + '\n')
    if (events.length < 2000) events.push(item); else truncated = true
    if (typeof item.session_id === 'string' && item.session_id !== sessionId) { sessionId = item.session_id; saveSession() }
    if (job.toolServerConfig && item.type === 'system' && item.subtype === 'init' && Array.isArray(item.mcp_servers)) {
      const failed = item.mcp_servers.filter((s: { status?: string }) => s.status === 'failed')
      if (failed.length) { error = `Required MCP connection failed: ${failed.map((s: { name?: string }) => s.name).join(', ')}`; stopStartup() }
    }
    const accepted = (id: string) => {
      const call = delegateCalls.get(id)
      if (call && !call.counted) { call.counted = true; if (call.resumed) delegates.resumes++; else delegates.starts++ }
    }
    if (item.parent_tool_use_id) { delegates.childEvents++; accepted(item.parent_tool_use_id) }
    for (const block of Array.isArray(item.message?.content) ? item.message.content : []) {
      if (block?.type === 'tool_use' && ['Agent', 'Task'].includes(block.name)) {
        delegates.requested++; delegateCalls.set(block.id, { resumed: !!block.input?.resume, counted: false })
      }
      if (block?.type === 'tool_result' && delegateCalls.has(block.tool_use_id)) {
        if (block.is_error) delegates.failed++; else accepted(block.tool_use_id)
      }
    }
    if (item.type === 'result') final = item
    try { job.onEvent?.(item) } catch (cause) { error ??= redact(`Event observer failed: ${(cause as Error).message}`) }
  }
  const exitCode = await new Promise<number | null>(done => {
    const child = spawn(job.command ?? 'claude', args, { cwd: workspace, env: { ...taskEnvironment(), ...job.env }, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] })
    let buffer = '', stderr = '', ended = false, fallback: ReturnType<typeof setTimeout> | undefined
    const finish = (code: number | null) => {
      if (ended) return; ended = true
      clearTimeout(timer); clearTimeout(fallback); job.signal?.removeEventListener('abort', abort)
      if (buffer.trim()) parse(buffer)
      appendFileSync(artifacts.stderr, redact(stderr))
      child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); done(code)
    }
    const parse = (line: string) => {
      try { const value = JSON.parse(line); if (value && typeof value === 'object' && !Array.isArray(value)) event(value) }
      catch { appendFileSync(artifacts.stderr, `Non-JSON CLI stdout: ${redact(line).slice(0, 2000)}\n`) }
    }
    const stop = () => {
      if (child.pid) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.on('error', () => child.kill())
        } else { try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') } }
      }
      fallback = setTimeout(() => { error ??= 'CLI did not close after termination; descendant cleanup is unconfirmed'; finish(null) }, 3000)
    }
    const abort = () => { interrupted = true; stop() }
    stopStartup = stop
    const timer = setTimeout(() => { timedOut = true; stop() }, job.timeoutMs ?? 1_200_000)
    job.signal?.addEventListener('abort', abort, { once: true })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      buffer += chunk
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (line.trim()) parse(line) }
    })
    // Redact the assembled stream, so credentials split across arbitrary pipe chunks cannot leak.
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', cause => { error = redact(cause.message); finish(null) })
    child.on('close', code => finish(code))
    child.stdin.on('error', () => undefined)
    if (job.signal?.aborted) abort(); else child.stdin.end(job.order)
  })
  const permissionDenials = Array.isArray(final?.permission_denials) ? final.permission_denials : []
  const ok = !error && !timedOut && !interrupted && exitCode === 0 && !!final && !final.is_error && final.subtype === 'success'
  const result: CodingAgentResult = {
    ok, status: timedOut ? 'timeout' : interrupted ? 'interrupted' : ok ? 'completed' : 'failed', jobId: job.id, ...(sessionId && { sessionId }),
    output: typeof final?.result === 'string' ? final.result : '', exitCode, durationMs: Date.now() - start,
    ...(final?.usage && { usage: final.usage }), costBasis: 'cli-estimate-not-provider-price', permissionDenials, delegates, events, eventsTruncated: truncated,
    ...((error || !final) && { error: error ?? 'CLI ended without a terminal result event' }), artifacts, ...(final && { cliResult: final }),
  }
  saveSession(); writeFileSync(artifacts.result, JSON.stringify(clean(result), null, 2))
  return result
}
