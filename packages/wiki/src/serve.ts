// npm run wiki — the wiki on http://localhost:5180/wiki/, rebuilt when a page, the site file or the
// translations change. The game's pictures come from packages/client/public/assets, as on the server.

import { createReadStream, existsSync, statSync, watch } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { ROOT, WIKI, buildSite } from './site.ts'
import { writeSite } from './build.ts'

const PORT = Number(process.env.WIKI_PORT ?? 5180)
const OUT = join(tmpdir(), 'openworld-wiki')
const ASSETS = join(ROOT, 'packages', 'client', 'public', 'assets')
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

let building = false
let again = false
function rebuild(): void {
  if (building) { again = true; return }
  building = true
  const t0 = Date.now()
  try {
    const b = buildSite()
    writeSite(b, OUT)
    console.log(`${new Date().toLocaleTimeString()} 重建：${b.pages.size} 页，${b.errors.length} 个错误，${b.redLinks.size} 个红链（${Date.now() - t0} ms）`)
    for (const e of b.errors.slice(0, 30)) console.log(`  错误：${e}`)
    if (b.errors.length > 30) console.log(`  ……还有 ${b.errors.length - 30} 个，见 特殊：完备性`)
  } catch (e) {
    console.error('构建失败：', e)
  }
  building = false
  if (again) { again = false; rebuild() }
}

let timer: NodeJS.Timeout | undefined
watch(WIKI, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 200) })
rebuild()

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  let path = decodeURIComponent(url.pathname)
  let root = OUT
  if (path === '/' || path === '/wiki') { res.writeHead(302, { Location: '/wiki/' }); res.end(); return }
  if (path.startsWith('/wiki/')) path = path.slice(5)
  else if (path.startsWith('/assets/')) { root = ASSETS; path = path.slice(7) }
  else { res.writeHead(404); res.end('not found'); return }
  let p = normalize(join(root, path))
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html')
  if (!existsSync(p)) {
    const nf = join(OUT, '特殊：所有页面', 'index.html')
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<p>没有这一页。</p><p><a href="/wiki/">回到首页</a></p>${existsSync(nf) ? '' : ''}`)
    return
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  createReadStream(p).pipe(res)
}).listen(PORT, () => console.log(`维基：http://localhost:${PORT}/wiki/`))
void sep
