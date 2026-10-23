// The site served as GitHub Pages serves it (byte ranges, so a film can be sought): node site/tools/serve.mjs site 8767
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
const [root, port] = process.argv.slice(2)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' }
createServer((req, res) => {
  let p = normalize(join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0])))
  let st; try { st = statSync(p); if (st.isDirectory()) { p = join(p, 'index.html'); st = statSync(p) } } catch { res.writeHead(404); return res.end() }
  const type = TYPES[extname(p)] ?? 'application/octet-stream'
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : st.size - 1
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 })
    return createReadStream(p, { start: a, end: b }).pipe(res)
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size })
  createReadStream(p).pipe(res)
}).listen(+port)
