// The project page as the public repository holds it (GitHub Pages serves it as is): the page, the news post, the three
// pieces with what they read, and the hero's loop (site/tools/media.mjs first). Nothing of the tools, the video stage
// or the design mockups.  node site/tools/publish.mjs [outDir]   (default var/site)
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'site'
const OUT = process.argv[2] ?? 'var/site'
const FILES = [
  'index.html', 'base.css', 'page.css', 'base.js', 'page.js', 'motion.js', 'snippets.js', 'embed.js', 'lang.js',
  'news/launch/index.html', 'team/index.html', 'team/zh.html', 'news/launch/zh.html', 'news/launch/ai-en.webp', 'news/launch/ai-zh.webp',
  'starmap/index.html', 'starmap/starmap.js', 'starmap/story.js', 'starmap/graph.json', 'starmap/ev', 'starmap/clips',
  'scale/index.html', 'scale/scale.js', 'scale/assets',
  'explain/index.html', 'explain/explain.js', 'explain/clips',
  'media/hero.mp4', 'media/hero.jpg', 'media/places', 'media/cast',
]

const missing = FILES.filter((f) => !existsSync(join(SRC, f)))
if (missing.length) throw new Error(`missing: ${missing.join(', ')} (node site/tools/media.mjs for the media)`)
// keep a repository's own files (.git, README, CNAME) and replace the rest
if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (!['.git', 'README.md', 'CNAME', 'LICENSE'].includes(f)) rmSync(join(OUT, f), { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const f of FILES) cpSync(join(SRC, f), join(OUT, f), { recursive: true })
writeFileSync(join(OUT, '.nojekyll'), '')

let size = 0, count = 0
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (f === '.git') continue; const s = statSync(p); if (s.isDirectory()) walk(p); else { size += s.size; count++ } } }
walk(OUT)
console.log(`${OUT}: ${count} files, ${(size / 1e6).toFixed(1)} MB`)
