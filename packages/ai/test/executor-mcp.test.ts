import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { runCodingAgentJob } from '../src/agent/executor.ts'
import { startAgentToolMcp } from '../src/agent/mcp.ts'

const temporary = () => mkdtempSync(join(tmpdir(), 'openworld-executor-'))
const fakeCli = String.raw`
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];let input='';
process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{
 const resumed=args.includes('--resume'),sid=resumed?arg('--resume'):'session-one';
 const emit=e=>process.stdout.write(JSON.stringify({...e,session_id:sid})+'\n');
 if(process.env.FAKE_MCP_FAIL==='1'){emit({type:'system',subtype:'init',mcp_servers:[{name:'world',status:'failed'}]});setInterval(()=>{},1000);return;}
 emit({type:'system',subtype:'init'});
 if(process.env.FAKE_SLOW==='1'){setTimeout(()=>emit({type:'result',subtype:'success',result:'late'}),10000);return;}
 const command=JSON.parse(arg('--settings')).hooks.PreToolUse[0].hooks[0].command;
 const encoded=command.match(/Buffer.from\('([^']+)'/)[1],script=Buffer.from(encoded,'base64').toString();
 const hook=resume=>spawnSync(process.execPath,['-e',script],{input:JSON.stringify({tool_name:'Agent',tool_input:resume?{resume:'child-one'}:{}}),encoding:'utf8'}).stdout;
 const hookResults=resumed?[hook(true)]:[hook(false),hook(false),hook(false)];
 emit({type:'system',subtype:'fixture',args,cwd:process.cwd(),input,hookResults});
 emit({type:'assistant',message:{content:[{type:'tool_use',id:'read',name:'Read',input:{file_path:'source.ts'}}]}});
 emit({type:'assistant',message:{content:[{type:'tool_use',id:'delegate',name:'Agent',input:resumed?{resume:'child-one'}:{prompt:'Inspect resources'}}]}});
 emit({type:'assistant',parent_tool_use_id:'delegate',message:{content:[{type:'text',text:'Resources inspected'}]}});
 emit({type:'user',message:{content:[{type:'tool_result',tool_use_id:'delegate',content:'child-one: finished'}]}});
 fs.writeFileSync(path.join(process.cwd(),'changed.txt'),'native agent executed');
 const secret=process.env.ANTHROPIC_API_KEY||'';process.stderr.write('key='+secret.slice(0,4));
 setTimeout(()=>{process.stderr.write(secret.slice(4)+'\n');emit({type:'result',subtype:'success',is_error:false,result:'completed '+secret,usage:{input_tokens:10,output_tokens:3},total_cost_usd:0.01,permission_denials:[{tool_name:'UnavailableTool'}]});},20);
});`

describe('complete native coding-agent executor', () => {
  it('runs native tools, retains trajectory, enforces delegate slots, redacts credentials and resumes the same job', async () => {
    const root = temporary(), script = join(root, 'fake.cjs'), stateDirectory = join(root, 'state')
    writeFileSync(script, fakeCli)
    const base = { id: 'job-one', workspace: root, stateDirectory, model: 'test-model', command: process.execPath, commandArgs: [script], env: { ANTHROPIC_API_KEY: 'credential-secret-value' }, toolServerConfig: { mcpServers: { world: { command: 'node', args: ['server.cjs', 'job-one'] } } }, timeoutMs: 5000 }
    const first = await runCodingAgentJob({ ...base, order: 'Search and extend the world.' })
    expect(first).toMatchObject({ ok: true, status: 'completed', sessionId: 'session-one', costBasis: 'cli-estimate-not-provider-price', delegates: { requested: 1, starts: 1, resumes: 0, childEvents: 1 } })
    expect(first.output).toBe('completed [REDACTED]')
    expect(first.permissionDenials).toEqual([{ tool_name: 'UnavailableTool' }])
    const fixture: any = first.events.find(e => e.subtype === 'fixture')
    expect(fixture.args).toContain('--mcp-config')
    expect(fixture.args.slice(fixture.args.indexOf('--tools') + 1, fixture.args.indexOf('--permission-mode'))).toEqual(['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Agent'])
    expect(fixture.args.slice(fixture.args.indexOf('--disallowedTools') + 1, fixture.args.indexOf('--append-system-prompt'))).toEqual(['Bash'])
    expect(fixture.args).toContain('mcp__world__*')
    expect(fixture.args).not.toContain('--bare')
    expect(fixture.args).not.toContain('--no-session-persistence')
    expect(fixture.input).toBe('Search and extend the world.')
    expect(fixture.hookResults.slice(0, 2)).toEqual(['', ''])
    expect(JSON.parse(fixture.hookResults[2]).hookSpecificOutput.permissionDecision).toBe('deny')
    expect(readFileSync(join(root, 'changed.txt'), 'utf8')).toBe('native agent executed')
    for (const path of Object.values(first.artifacts)) expect(readFileSync(path, 'utf8')).not.toContain('credential-secret-value')
    expect(readFileSync(first.artifacts.stderr, 'utf8')).toBe('key=[REDACTED]\n')
    const second = await runCodingAgentJob({ ...base, order: 'Host verification found one issue; repair it.' })
    expect(second.ok).toBe(true)
    const resumed: any = second.events.find(e => e.subtype === 'fixture')
    expect(resumed.args).toContain('--resume')
    expect(resumed.args[resumed.args.indexOf('--resume') + 1]).toBe('session-one')
    expect(resumed.hookResults).toEqual([''])
    expect(second.delegates.resumes).toBe(1)
    await expect(runCodingAgentJob({ ...base, id: 'another-job', order: 'Do something.' })).rejects.toThrow('another job')
  })

  it('returns timeout with the partial session preserved instead of inventing a terminal result', async () => {
    const root = temporary(), script = join(root, 'slow.cjs'); writeFileSync(script, fakeCli)
    const result = await runCodingAgentJob({ id: 'slow', workspace: root, stateDirectory: join(root, 'state'), order: 'Work.', command: process.execPath, commandArgs: [script], env: { FAKE_SLOW: '1' }, timeoutMs: 150 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe('timeout')
    expect(result.durationMs).toBeLessThan(4500)
    expect(result.output).toBe('')
  })

  it('stops at an actual required MCP startup failure instead of letting the model improvise a missing workflow', async () => {
    const root = temporary(), script = join(root, 'failed.cjs'); writeFileSync(script, fakeCli)
    const result = await runCodingAgentJob({ id: 'mcp-failed', workspace: root, stateDirectory: join(root, 'state'), order: 'Use the world tools.', command: process.execPath, commandArgs: [script], env: { FAKE_MCP_FAIL: '1' }, toolServerConfig: { mcpServers: { world: { command: 'missing' } } }, timeoutMs: 5000 })
    expect(result).toMatchObject({ ok: false, status: 'failed', error: 'Required MCP connection failed: world' })
    expect(existsSync(join(root, 'changed.txt'))).toBe(false)
    expect(result.durationMs).toBeLessThan(4500)
  })
})

describe('MCP stdio AgentTool transport', () => {
  it('serves initialization, discovery, async calls and errors as newline JSON-RPC without stdout logging', async () => {
    const input = new PassThrough(), output = new PassThrough(), diagnostics = new PassThrough(), responses: any[] = []
    let buffer = '', diagnosticsText = '', factories = 0
    output.on('data', chunk => { buffer += chunk; let end: number; while ((end = buffer.indexOf('\n')) >= 0) { responses.push(JSON.parse(buffer.slice(0, end))); buffer = buffer.slice(end + 1) } })
    diagnostics.on('data', chunk => { diagnosticsText += chunk })
    const server = startAgentToolMcp({ input, output, error: diagnostics, tools: async () => { factories++; return [
      { name: 'inspect', description: 'Inspect an object.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, run: async args => JSON.stringify({ id: args.id, uses: ['cast'] }) },
      { name: 'fail', description: 'Fails.', parameters: { type: 'object' }, run: () => { throw new Error('wrong revision') } },
    ] } })
    const request = (id: number, method: string, params?: unknown) => input.write(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params !== undefined && { params }) }) + '\n')
    request(0, 'tools/list')
    request(1, 'initialize', { protocolVersion: '2025-06-18' })
    input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    request(2, 'tools/list')
    request(3, 'tools/call', { name: 'inspect', arguments: { id: 'focus' } })
    request(4, 'tools/call', { name: 'fail', arguments: {} })
    request(5, 'tools/call', { name: 'absent' })
    request(6, 'tools/call', { name: 'inspect', arguments: [] })
    request(7, 'unknown-method')
    input.write('not-json\n'); input.end()
    await server.closed
    const at = (id: number | null) => responses.find(r => r.id === id)
    expect(at(0).error.code).toBe(-32000)
    expect(at(1).result.serverInfo.name).toBe('world')
    expect(at(2).result.tools[0]).toMatchObject({ name: 'inspect', inputSchema: { required: ['id'] } })
    expect(JSON.parse(at(3).result.content[0].text)).toEqual({ id: 'focus', uses: ['cast'] })
    expect(at(4).result).toMatchObject({ isError: true, content: [{ text: 'wrong revision' }] })
    expect(at(5).error.code).toBe(-32602)
    expect(at(6).error.code).toBe(-32602)
    expect(at(7).error.code).toBe(-32601)
    expect(at(null).error.code).toBe(-32700)
    expect(factories).toBeGreaterThan(1)
    expect(diagnosticsText).toBe('')
  })

  it('passes a cancellation signal to a trusted per-job async handler', async () => {
    const input = new PassThrough(), output = new PassThrough(), responses: any[] = []
    output.on('data', chunk => { for (const line of String(chunk).trim().split('\n')) if (line) responses.push(JSON.parse(line)) })
    let entered!: () => void
    const ready = new Promise<void>(resolve => { entered = resolve })
    const server = startAgentToolMcp({ input, output, tools: [{ name: 'trial', description: 'Trial.', parameters: { type: 'object' }, run: () => 'unused' }], callTool: async (_tool, _args, context) => {
      entered(); await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true })); return 'cancelled result'
    } })
    input.write('{"jsonrpc":"2.0","id":1,"method":"initialize"}\n')
    input.write('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"trial","arguments":{}}}\n')
    await ready
    input.write('{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":2}}\n'); input.end()
    await server.closed
    expect(responses.find(r => r.id === 2).error.code).toBe(-32800)
  })
})
