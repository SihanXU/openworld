// Render an SVG to PNG: node render.mjs <in.svg> <out.png> [width]. Needs @resvg/resvg-js.
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
const [src, dst, width] = process.argv.slice(2)
const r = new Resvg(readFileSync(src, 'utf8'), {
  fitTo: { mode: 'width', value: Number(width || 2200) },
  font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' },
})
writeFileSync(dst, r.render().asPng())
