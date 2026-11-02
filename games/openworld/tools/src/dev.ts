// npm run dev: the client and the modder service together, so undefined acts have someone to ask.
// The modder is skipped when one already answers on its port (started by hand, or another session).
// Client only: npm run dev:client.
//
// The modder's model is asked for at start (in a terminal), or given:
//   npm run dev -- --backend openrouter | claude-code | codex | anthropic | none   [--fast: claude-code's fast mode, codex's fast tier]
//   npm run dev -- --backend codex --model gpt-6-luna --effort medium   (the backend's model and effort; its default when left out)
//   (or LSW_MODEL_BACKEND and LSW_FAST=1 in the environment / .env)

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const PORT = Number(process.env.LSW_PORT ?? 8787)
const kids: ChildProcess[] = []

const BACKENDS = [
  ['openrouter', 'OpenRouter (LSW_MODEL from .env)'],
  ['claude-code', 'Claude Code: claude -p, Opus 5.5, effort low (signed in as you; no API key)'],
  ['codex', 'Codex: codex exec, gpt-6.1-sol, effort low (signed in as you; no API key)'],
  ['anthropic', "Anthropic's API: Opus 5.5, effort low (ANTHROPIC_API_KEY from .env)"],
  ['none', 'none: answer from the shared library only'],
] as const

/** --backend, else the environment (.env included), else ask in a terminal, else OpenRouter. */
async function chooseBackend(): Promise<string> {
  const i = process.argv.indexOf('--backend')
  const given = i >= 0 ? process.argv[i + 1] : (process.env.LSW_MODEL_BACKEND ?? undefined)
  if (given) {
    if (!BACKENDS.some(([k]) => k === given)) throw new Error(`--backend: unknown "${given}" (${BACKENDS.map(([k]) => k).join(' | ')})`)
    return given
  }
  if (!process.stdin.isTTY) return 'openrouter'
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  console.log('[dev] the modder\'s model:')
  BACKENDS.forEach(([, label], n) => console.log(`  ${n + 1}) ${label}`))
  const answer = (await rl.question(`[dev] choose 1-${BACKENDS.length} [1]: `)).trim()
  rl.close()
  return BACKENDS[Number(answer) - 1]?.[0] ?? 'openrouter'
}

function run(name: string, args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true, env })
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
if (existsSync('.env')) process.loadEnvFile('.env')
if (await modderAnswers()) console.log(`[dev] a modder already answers on :${PORT}`)
// a checkout without the AI (packages/ai) plays with no model: no modder to start
else if (!existsSync('packages/ai')) console.log('[dev] no AI in this checkout (packages/ai): the game plays with no model')
// watched: the modder validates against the content it loaded, so it restarts when the content changes
else {
  // --fast asks claude-code for fast mode (the account must allow it: extra usage on), codex for its fast tier
  const fast = process.argv.includes('--fast') ? { LSW_FAST: '1' } : {}
  // --model and --effort go to the modder, which names them as the chosen backend's own (chooseModel)
  const pass = ['model', 'effort'].flatMap((k) => (process.argv.includes(`--${k}`) ? [`--${k}`, process.argv[process.argv.indexOf(`--${k}`) + 1]] : []))
  run('modder', ['exec', '--', 'tsx', 'watch', 'packages/ai/scripts/modder.ts', '--game', 'games/openworld/content/src/game.ts', ...pass, 'serve', String(PORT)], { ...process.env, LSW_MODEL_BACKEND: await chooseBackend(), ...fast })
}
// the world the client serves is built from the content: built again first, so a content change is never
// played on a stale world (a new start the old world lacks fails the game at its first frame)
const built = spawnSync('npm', ['run', 'gen:world', '--silent'], { stdio: 'inherit', shell: true })
if (built.status !== 0) console.log('[dev] the world could not be built: the client serves the last one')
run('client', ['run', 'dev', '-w', '@openworld-game/client'])
