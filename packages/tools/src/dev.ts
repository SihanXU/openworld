// npm run dev: the client and the modder service together, so undefined acts have someone to ask.
// The modder is skipped when one already answers on its port (started by hand, or another session).
// Client only: npm run dev:client.

import { spawn, type ChildProcess } from 'node:child_process'

const PORT = Number(process.env.LSW_PORT ?? 8787)
const kids: ChildProcess[] = []

function run(name: string, args: string[]): void {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true })
  const tag = (chunk: Buffer) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => `[${name}] ${l}\n`)
      .join('')
  child.stdout?.on('data', (c: Buffer) => process.stdout.write(tag(c)))
  child.stderr?.on('data', (c: Buffer) => process.stderr.write(tag(c)))
  child.on('exit', (code) => {
    console.log(`[${name}] exited (${code})`)
    if (name === 'client') stop()
  })
  kids.push(child)
}

function stop(): void {
  for (const k of kids) if (k.exitCode === null) k.kill()
  process.exit()
}

async function modderAnswers(): Promise<boolean> {
  try {
    return (await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(1500) })).ok
  } catch {
    return false
  }
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
if (await modderAnswers()) console.log(`[dev] a modder already answers on :${PORT}`)
// watched: the modder validates against the content it loaded, so it restarts when the content changes
else run('modder', ['exec', '--', 'tsx', 'watch', 'packages/modder/src/cli.ts', 'serve', String(PORT)])
run('client', ['run', 'dev', '-w', '@lsw/client'])
