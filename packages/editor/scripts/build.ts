// The OpenWorld Editor built as a program of its own (docs/engine-split.md §15) → packages/editor/dist/:
//
//   editor/              the editor's page, built (served at /editor/)
//   player/              the engine's player, built (the playtest, and what an export copies)
//   server/cli.js        the server (server.ts) and its command line, one Node script with nothing to install
//   templates/starter/   the starter, the template of a new project (its data and its assets)
//   pack/                the Ninja Adventure pack's subset (CC0) projects take pictures and sounds from
//   package.json         `openworld-editor`, its bin
//
// Run it with `node packages/editor/dist/server/cli.js --open` (npm run editor:start); the desktop shell
// (packages/editor/desktop) carries the same folder.
//
//   npx tsx packages/editor/scripts/build.ts

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const EDITOR = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(EDITOR, '..', '..')
const OUT = join(EDITOR, 'dist')
const STARTER = join(REPO, 'games', 'starter')
const PACK = join(REPO, 'games', 'openworld', 'public', 'assets', 'na')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// the editor's page: its own root, served under /editor/
await build({
  configFile: false,
  root: EDITOR,
  base: '/editor/',
  publicDir: false,
  logLevel: 'warn',
  worker: { format: 'es' },
  build: { outDir: join(OUT, 'editor'), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 8000 },
})

// the player, as npm run build:player builds it (without the games built beside it)
await build({ configFile: join(REPO, 'packages', 'runtime', 'vite.config.ts'), configLoader: 'runner', logLevel: 'warn', build: { outDir: join(OUT, 'player'), emptyOutDir: true } })

// the server: one script for Node with everything in it (the engine, its modules, the format)
await build({
  configFile: false,
  root: EDITOR,
  logLevel: 'warn',
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: true,
    outDir: join(OUT, 'server'),
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: { input: { cli: join(EDITOR, 'src', 'server', 'cli.ts'), server: join(EDITOR, 'src', 'server', 'server.ts') }, output: { format: 'es', entryFileNames: '[name].js', banner: (c: { name: string }) => (c.name === 'cli' ? '#!/usr/bin/env node' : '') } },
  },
})

// the template and the pack
cpSync(STARTER, join(OUT, 'templates', 'starter'), {
  recursive: true,
  filter: (s) => !['test', 'tsconfig.json', 'node_modules', 'dist'].includes(relative(STARTER, s).split(sep)[0]),
})
if (existsSync(PACK)) cpSync(PACK, join(OUT, 'pack'), { recursive: true })
else console.warn(`no pack at ${PACK}: the editor is built without one`)

const version = (JSON.parse(readFileSync(join(STARTER, 'game.json'), 'utf8')) as { engine?: string }).engine ?? '1'
writeFileSync(
  join(OUT, 'package.json'),
  JSON.stringify({ name: 'openworld-editor', version: `0.${version}.0`, private: true, type: 'module', bin: { 'openworld-editor': 'server/cli.js' }, engines: { node: '>=22' } }, null, 2) + '\n',
)
console.log(`built the editor → ${relative(REPO, OUT)}  (node ${relative(REPO, join(OUT, 'server', 'cli.js'))} --open)`)
