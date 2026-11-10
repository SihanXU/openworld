// The same trusted domain tools can serve a coding CLI over MCP stdio; game logic stays in their handlers.
import { createInterface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import type { AgentTool } from './tools.ts'

export interface McpToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
  structuredContent?: Record<string, unknown>
}
export interface AgentToolMcpOptions {
  tools: AgentTool[] | (() => AgentTool[] | Promise<AgentTool[]>)
  name?: string
  version?: string
  input?: Readable
  output?: Writable
  error?: Writable
  redact?: (text: string) => string
  callTool?: (tool: AgentTool, args: Record<string, unknown>, context: { requestId: string | number; signal: AbortSignal }) => string | McpToolResult | Promise<string | McpToolResult>
}

/** Newline-delimited JSON-RPC, as required by MCP stdio. stdout is reserved for protocol messages. */
export function startAgentToolMcp(options: AgentToolMcpOptions): { closed: Promise<void>; close(): void } {
  const input = options.input ?? process.stdin, output = options.output ?? process.stdout, diagnostics = options.error ?? process.stderr
  const redact = options.redact ?? ((text: string) => text)
  const reader = createInterface({ input, crlfDelay: Infinity }), pending = new Set<Promise<void>>()
  const calls = new Map<string | number, AbortController>()
  let initialized = false, closing = false, finish!: () => void
  const closed = new Promise<void>(resolve => { finish = resolve })
  const send = (message: unknown) => { if (!output.destroyed) output.write(redact(JSON.stringify(message)) + '\n') }
  const error = (id: unknown, code: number, message: string) => send({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
  const list = async () => {
    const tools = typeof options.tools === 'function' ? await options.tools() : options.tools
    const names = new Set<string>()
    for (const tool of tools) {
      if (names.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`)
      names.add(tool.name)
    }
    return tools
  }
  const handle = async (line: string): Promise<void> => {
    let request: any
    try { request = JSON.parse(line) } catch { error(null, -32700, 'Parse error'); return }
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string' || (request.id !== undefined && typeof request.id !== 'string' && typeof request.id !== 'number')) {
      error(request?.id, -32600, 'Invalid Request'); return
    }
    if (request.method === 'notifications/cancelled') { calls.get(request.params?.requestId)?.abort(); return }
    if (request.id === undefined) return // Initialized, progress and other notifications have no response.
    const id = request.id as string | number
    try {
      let result: unknown
      if (request.method === 'initialize') {
        const versions = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']
        initialized = true
        result = { protocolVersion: versions.includes(request.params?.protocolVersion) ? request.params.protocolVersion : '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: options.name ?? 'world', version: options.version ?? '1.0.0' } }
      } else if (request.method === 'ping') result = {}
      else if (!initialized) { error(id, -32000, 'Initialize the MCP server first'); return }
      else if (request.method === 'tools/list') result = { tools: (await list()).map(({ name, description, parameters }) => ({ name, description, inputSchema: parameters })) }
      else if (request.method === 'tools/call') {
        const tool = (await list()).find(tool => tool.name === request.params?.name)
        if (!tool) { error(id, -32602, 'Unknown tool'); return }
        const args = request.params?.arguments ?? {}
        if (!args || typeof args !== 'object' || Array.isArray(args)) { error(id, -32602, 'Tool arguments must be an object'); return }
        const controller = new AbortController(); calls.set(id, controller)
        try {
          const answer = options.callTool ? await options.callTool(tool, args, { requestId: id, signal: controller.signal }) : await tool.run(args)
          if (controller.signal.aborted) { error(id, -32800, 'Request cancelled'); return }
          result = typeof answer === 'string' ? { content: [{ type: 'text', text: answer }] } : answer
        } catch (cause) {
          result = { content: [{ type: 'text', text: redact((cause as Error).message) }], isError: true }
        } finally { calls.delete(id) }
      } else { error(id, -32601, 'Method not found'); return }
      send({ jsonrpc: '2.0', id, result })
    } catch (cause) {
      diagnostics.write(redact(`MCP handler error: ${(cause as Error).message}\n`))
      error(id, -32603, 'Internal error')
    }
  }
  reader.on('line', line => {
    if (closing || !line.trim()) return
    const task = handle(line); pending.add(task)
    void task.catch(cause => diagnostics.write(redact(`MCP transport error: ${(cause as Error).message}\n`))).finally(() => pending.delete(task))
  })
  reader.on('close', () => { closing = true; void Promise.allSettled([...pending]).then(() => finish()) })
  reader.on('error', cause => { diagnostics.write(redact(`MCP input error: ${cause.message}\n`)); reader.close() })
  output.on('error', () => reader.close())
  return { closed, close: () => { for (const call of calls.values()) call.abort(); reader.close() } }
}
