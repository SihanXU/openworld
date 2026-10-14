// A stand-in for the docker CLI, enough for DockerEnv and solve(): an "image" is a directory on this
// machine holding the image's filesystem (e.g. <dir>/testbed); a "container" is the record of its
// mounts; `exec` runs the command here, with the container's paths turned into the host's. Every call
// is logged to $FAKE_DOCKER_STATE/calls.jsonl for the tests to read.
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const state = process.env.FAKE_DOCKER_STATE
if (!state) throw new Error('FAKE_DOCKER_STATE is not set')
mkdirSync(state, { recursive: true })
const args = process.argv.slice(2)
appendFileSync(join(state, 'calls.jsonl'), JSON.stringify(args) + '\n')
const db = join(state, 'containers.json')
const containers = existsSync(db) ? JSON.parse(readFileSync(db, 'utf8')) : {}
const save = () => writeFileSync(db, JSON.stringify(containers))
const newId = () => `c${Object.keys(containers).length + 1}`
const posix = (p) => p.replace(/\\/g, '/')
const bash = process.platform === 'win32' ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((p) => existsSync(p)) ?? 'bash' : 'bash'

const [cmd, ...rest] = args
if (cmd === 'create') {
  const id = newId()
  containers[id] = { image: rest[0], mounts: [] }
  save()
  console.log(id)
} else if (cmd === 'cp') {
  const [from, to] = rest
  const [id, path] = from.split(/:(?=\/)/)
  cpSync(join(containers[id].image, path), to, { recursive: true })
} else if (cmd === 'rm') {
  // nothing to stop
} else if (cmd === 'run') {
  const mounts = []
  let wd = '/'
  let i = 0
  for (; i < rest.length; i++) {
    const a = rest[i]
    if (a === '-v') {
      // host:container[:ro] — the host side may hold a drive letter's colon
      const m = /^(.*):(\/[^:]*)(?::(ro|rw))?$/.exec(rest[++i])
      mounts.push([m[1], m[2]])
    } else if (a === '-w') wd = rest[++i]
    else if (['--network', '--user', '--memory', '--cpus', '--pids-limit'].includes(a)) i++
    else if (!a.startsWith('-')) break
  }
  const id = newId()
  containers[id] = { image: rest[i], mounts, wd }
  save()
  console.log(id)
} else if (cmd === 'exec') {
  const env = { ...process.env }
  let i = 0
  let wd = '/'
  for (; i < rest.length; i++) {
    if (rest[i] === '-i') continue
    if (rest[i] === '-e') {
      const [k, ...v] = rest[++i].split('=')
      env[k] = v.join('=')
    } else if (rest[i] === '-w') wd = rest[++i]
    else break
  }
  const c = containers[rest[i]]
  const script = rest.at(-1) // … timeout <secs> bash -lc <script>
  // the container's paths, longest first: a mounted file (the hook node) as a quoted path, a directory as a prefix
  const isFile = (p) => {
    try {
      return statSync(p).isFile()
    } catch {
      return false
    }
  }
  const toHost = (s) => {
    for (const [host, inside] of [...c.mounts].sort((a, b) => b[1].length - a[1].length)) s = s.split(inside).join(isFile(host) ? `'${posix(host)}'` : posix(host))
    return s
  }
  const cwd = toHost(wd).replace(/^'|'$/g, '')
  // git config --global must not reach the machine running the tests
  env.HOME = join(state, 'home')
  env.GIT_CONFIG_GLOBAL = join(state, 'gitconfig')
  mkdirSync(env.HOME, { recursive: true })
  const r = spawnSync(bash, ['-c', toHost(script)], { cwd, env, encoding: 'utf8' })
  process.stdout.write(r.stdout ?? '')
  process.stderr.write(r.stderr ?? '')
  process.exit(r.status ?? 1)
} else {
  console.error(`fake docker: unknown command ${cmd}`)
  process.exit(2)
}
