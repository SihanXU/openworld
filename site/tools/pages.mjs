// The project page, the game and the wiki as one GitHub Pages site: the gh-pages branch of this repository, served at
// openworldrpg.ai (sihanxu.github.io/openworld and sihanxu.me/openworld are sent there by GitHub).
//   node site/tools/pages.mjs <game dist> [outDir] [--wiki <wiki build>] [--push]   (default var/pages)
// The game is built without a modder (npm run build, no VITE_MODDER_URL): on Pages it asks the player's own model
// only (docs/byok.md). The page goes at the root, the game under play/, with CNAME and .nojekyll. --push makes the
// folder the branch's one commit and force-pushes it: the branch keeps no history, so the site's bytes never pile up.
// --wiki: the wiki (games/openworld/wiki/src/build.ts --out <dir>) under wiki/. Its pages ask for the game's pictures at
// /assets/ (where the game was once served, at a host's root): the ones they name are copied there from the game's build.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const at = argv.indexOf('--wiki')
const WIKI = at >= 0 ? argv[at + 1] : undefined
const args = argv.filter((a, i) => !a.startsWith('--') && !(at >= 0 && i === at + 1))
const [GAME, OUT = 'var/pages'] = args
const DOMAIN = 'openworldrpg.ai'
if (!GAME || !existsSync(join(GAME, 'index.html'))) throw new Error('usage: node site/tools/pages.mjs <game dist> [outDir] [--wiki <wiki build>] [--push]')

execFileSync(process.execPath, ['site/tools/publish.mjs', OUT], { stdio: 'inherit' })
rmSync(join(OUT, 'play'), { recursive: true, force: true })
cpSync(GAME, join(OUT, 'play'), { recursive: true })
writeFileSync(join(OUT, 'CNAME'), `${DOMAIN}\n`)
console.log(`${OUT}: the page, the game under play/, CNAME ${DOMAIN}`)

if (WIKI) {
  if (!existsSync(join(WIKI, 'index.html'))) throw new Error(`--wiki ${WIKI}: no wiki build there`)
  for (const d of ['wiki', 'assets']) rmSync(join(OUT, d), { recursive: true, force: true })
  cpSync(WIKI, join(OUT, 'wiki'), { recursive: true })
  // the pictures its pages, stylesheets and scripts name (a file's name may hold spaces), from the game's own
  const named = new Set()
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (['.html', '.css', '.js'].includes(extname(f))) for (const m of readFileSync(p, 'utf8').matchAll(/\/assets\/([^"'()?#<>\n]+\.\w+)/g)) named.add(decodeURIComponent(m[1]))
    }
  }
  walk(WIKI)
  const missing = []
  for (const a of named) {
    const from = join(GAME, 'assets', a)
    if (!existsSync(from) || !statSync(from).isFile()) { missing.push(a); continue }
    mkdirSync(dirname(join(OUT, 'assets', a)), { recursive: true })
    cpSync(from, join(OUT, 'assets', a))
  }
  console.log(`wiki/: the wiki, ${named.size - missing.length} of the game's pictures under assets/${missing.length ? `; not in the game: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}` : ''}`)
}

if (process.argv.includes('--push')) {
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  const git = (...a) => execFileSync('git', a, { cwd: resolve(OUT), stdio: 'inherit' })
  rmSync(join(OUT, '.git'), { recursive: true, force: true })
  git('init', '-q', '-b', 'gh-pages')
  git('add', '-A')
  git('commit', '-q', '-m', `Pages: the project page, the game and the wiki (${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()})`)
  git('push', '-f', remote, 'gh-pages')
  rmSync(join(OUT, '.git'), { recursive: true, force: true })
}
