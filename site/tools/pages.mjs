// The project page and the game as one GitHub Pages site: the gh-pages branch of this repository, served at
// openworldrpg.ai (sihanxu.github.io/openworld and sihanxu.me/openworld are sent there by GitHub).
//   node site/tools/pages.mjs <game dist> [outDir] [--push]   (default var/pages)
// The game is built without a modder (npm run build, no VITE_MODDER_URL): on Pages it asks the player's own model
// only (docs/byok.md). The page goes at the root, the game under play/, with CNAME and .nojekyll. --push makes the
// folder the branch's one commit and force-pushes it: the branch keeps no history, so the site's bytes never pile up.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const [GAME, OUT = 'var/pages'] = args
const DOMAIN = 'openworldrpg.ai'
if (!GAME || !existsSync(join(GAME, 'index.html'))) throw new Error('usage: node site/tools/pages.mjs <game dist> [outDir] [--push]')

execFileSync(process.execPath, ['site/tools/publish.mjs', OUT], { stdio: 'inherit' })
rmSync(join(OUT, 'play'), { recursive: true, force: true })
cpSync(GAME, join(OUT, 'play'), { recursive: true })
writeFileSync(join(OUT, 'CNAME'), `${DOMAIN}\n`)
console.log(`${OUT}: the page, the game under play/, CNAME ${DOMAIN}`)

if (process.argv.includes('--push')) {
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  const git = (...a) => execFileSync('git', a, { cwd: resolve(OUT), stdio: 'inherit' })
  rmSync(join(OUT, '.git'), { recursive: true, force: true })
  git('init', '-q', '-b', 'gh-pages')
  git('add', '-A')
  git('commit', '-q', '-m', `Pages: the project page and the game (${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()})`)
  git('push', '-f', remote, 'gh-pages')
  rmSync(join(OUT, '.git'), { recursive: true, force: true })
}
