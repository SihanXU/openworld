// npm run wiki:translate -- status | stamp [file…] | relink [file…]
// The English edition's upkeep (lang.ts). An English page is wiki/en/pages/<the Chinese page's path>.md; its front
// matter's `source:` is the hash of the Chinese text it translates, so the build can tell when that text has moved on.
//   status  what is not translated yet, and what is out of date
//   stamp   records that these English pages (default: every one) translate the Chinese pages as they are now
//   relink  rewrites what a translator may leave in Chinese into the English edition's own words: link targets and
//           their #sections, raw /wiki/ hrefs, template names, and the template arguments that name pages, things or keys

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve as resolvePath, sep } from 'node:path'
import { buildBoth } from './build.ts'
import { setLang, linkHref } from './lang.ts'
import { slug } from './markup.ts'
import { PAGES, ROOT, sourceHash, type Built, type Page } from './site.ts'
import { ARG_EN, TEMPLATE_EN } from './templates.ts'
import { say } from './game.ts'

const CJK = /[㐀-鿿]/
/** Keys a Chinese page names in words. */
const KEY_EN: Record<string, string> = { 空格: 'Space', 左键: 'Left click', 右键: 'Right click', 长按: 'Hold', 滚轮: 'Wheel', 回车: 'Enter' }
/** Hand navboxes named for a group, not a page: the group's English name (every English page of the group writes it so). */
const NAVBOX_EN: Record<string, string> = { 基本: 'Basics', 生活: 'Life', 企划: 'Design', 人物: 'People', 战斗: 'Combat', 世界观: 'Lore', 界面: 'Interface', 帮助: 'Help' }

/** The English files named, or every one. */
function files(args: string[], en: Built): string[] {
  if (args.length) return args.map((f) => resolvePath(f))
  return [...en.pages.values()].filter((p) => p.file).map((p) => join(ROOT, p.file!))
}

/** The Chinese page an English file translates (by its path). */
function sourceOf(file: string): string | undefined {
  const rel = relative(PAGES.en, file)
  const zh = join(PAGES.zh, rel)
  return !rel.startsWith('..') && existsSync(zh) ? zh : undefined
}

/** A front-matter key set to a value (added before the closing --- if absent). */
function setFront(text: string, key: string, value: string): string {
  const t = text.replace(/\r\n/g, '\n')
  if (!t.startsWith('---\n')) return `---\n${key}: ${value}\n---\n${t}`
  const end = t.indexOf('\n---', 4)
  const head = t.slice(4, end).split('\n').filter((l) => l.trim())
  const i = head.findIndex((l) => l.match(/^\s*([^:：]+?)\s*[:：]/)?.[1] === key)
  if (i >= 0) head[i] = `${key}: ${value}`
  else head.push(`${key}: ${value}`)
  return `---\n${head.join('\n')}\n${t.slice(end + 1)}`
}

function stamp(paths: string[]): void {
  let n = 0
  for (const f of paths) {
    const src = sourceOf(f)
    if (!src) { console.warn(`${relative(ROOT, f)}: no Chinese page at the same path, nothing to stamp`); continue }
    const text = readFileSync(f, 'utf8')
    const next = setFront(text, 'source', sourceHash(readFileSync(src, 'utf8')))
    if (next !== text) { writeFileSync(f, next); n++ }
  }
  console.log(`stamped ${n} of ${paths.length}`)
}

function status(en: Built): void {
  const of = (s: Page['translation']) => [...en.pages.values()].filter((p) => p.source && p.translation === s)
  const show = (label: string, ps: Page[]) => { console.log(`${label}: ${ps.length}`); for (const p of ps) console.log(`  ${p.source!.file}  →  ${p.title}`) }
  console.log(`up to date: ${of('current').length}`)
  show('out of date', of('outdated'))
  show('not translated', of('missing'))
}

/** Text with its code left alone: fn runs on the parts outside fenced blocks and inline code. */
const outsideCode = (text: string, fn: (s: string) => string) =>
  text.split(/(^```[^\n]*\n[\s\S]*?\n```[ \t]*$|`[^`\n]+`)/m).map((part, i) => (i % 2 ? part : fn(part))).join('')

function relink(paths: string[], zh: Built, en: Built): void {
  const ZH_NAME_TO_EN = Object.fromEntries(Object.entries(TEMPLATE_EN).map(([e, z]) => [z, e]).reverse())
  // the same page's English title, for a title written in Chinese
  const title = (t: string): string | undefined => (CJK.test(t) ? en.resolve(t) : undefined)
  // a section of a Chinese page, as the English page that translates it calls it (headings correspond by position)
  const section = (zhTitle: string | undefined, enTitle: string, anchor: string): string => {
    if (!CJK.test(anchor)) return anchor
    const zp = zhTitle ? zh.pages.get(zh.resolve(zhTitle) ?? '') : undefined
    const ep = en.pages.get(enTitle)
    const src = zp ?? ep?.source
    if (!src || !ep) return anchor
    const i = src.headings.findIndex((h) => h.id === slug(anchor) || h.text === anchor)
    const text = ep.headings[i]?.text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    return i >= 0 && text && !CJK.test(text) && !/[#|\]]/.test(text) ? text : anchor
  }
  // a game thing named in either language → its English title
  const thing = (name: string): string | undefined => {
    const e = zh.game.byTitle.get(name) ?? zh.game.byName.get(name)?.[0]
    return e ? en.game.byId.get(e.id)?.title : undefined
  }
  const status = (name: string) => { const s = en.game.statuses.find((x) => x.id === name || say(x.name) === name || (x.name as any)?.zh === name); return s ? say(s.name) : undefined }
  const skill = (name: string) => { const s = en.game.skills.find((x) => x.id === name || (x.name as any)?.zh === name); return s ? say(s.name) : undefined }
  const branch = (name: string) => { const b = [...en.game.branches, ...en.game.professions].find((x: any) => x.name.zh === name); return b ? say((b as any).name) : undefined }
  setLang('en')
  let changed = 0
  for (const f of paths) {
    const rel = relative(ROOT, f).split(sep).join('/')
    const page = [...en.pages.values()].find((p) => p.file === rel)
    const self = page?.title ?? ''
    const text = readFileSync(f, 'utf8')
    const end = text.startsWith('---') ? text.indexOf('\n---', 3) + 4 : 0
    const front = text.slice(0, end), body0 = text.slice(end)
    const body = outsideCode(body0, (s) => {
      // links
      s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (m, target: string, label?: string) => {
        const [t0, anchor] = target.split('#')
        const t = t0.trim()
        const to = t ? title(t) ?? t : self
        const a = anchor !== undefined ? section(t ? t : page?.source?.title, to, anchor.trim()) : undefined
        if (to === t && a === anchor?.trim()) return m
        return `[[${t ? to : ''}${a !== undefined ? `#${a}` : ''}${label !== undefined ? `|${label}` : ''}]]`
      })
      // raw hrefs to Chinese pages
      s = s.replace(/href="\/wiki\/([^"#?]+)(#[^"]*)?"/g, (m, path: string, hash?: string) => {
        let t: string
        try { t = decodeURIComponent(path).replace(/／/g, '/') } catch { return m }
        const to = title(t)
        return to ? `href="${linkHref(to, 'en')}${hash ?? ''}"` : m
      })
      // templates: their names, and the arguments that name a page, a thing or a key
      s = s.replace(/\{\{\s*([^|{}]+?)\s*((?:\|[^{}]*)?)\}\}/g, (m, name: string, rest: string) => {
        const z = TEMPLATE_EN[name.toLowerCase().replace(/_/g, ' ')] ?? name
        const enName = ZH_NAME_TO_EN[z]
        if (!enName) return m
        const args = rest ? rest.slice(1).split('|') : []
        const arg = (i: number, fn: (x: string) => string | undefined) => { if (args[i] !== undefined && CJK.test(args[i])) args[i] = fn(args[i].trim()) ?? args[i] }
        const inverse = ARG_EN[z] ? Object.fromEntries(Object.entries(ARG_EN[z]).map(([e, zz]) => [zz, e])) : {}
        if (z === '键') args.forEach((_, i) => arg(i, (x) => KEY_EN[x]))
        else if (z === '物品' || z === '人物' || z === '怪物' || z === '地点') arg(0, thing)
        else if (z === '状态') arg(0, status)
        else if (z === '技能') arg(0, skill)
        else if (z === '技能树') arg(0, branch)
        else if (z === '主条目' || z === '另见') args.forEach((_, i) => arg(i, title))
        else if (z === '导航框') arg(0, (x) => inverse[x] ?? title(x) ?? NAVBOX_EN[x])
        else if (ARG_EN[z]) arg(0, (x) => inverse[x])
        return `{{${enName}${args.length ? `|${args.join('|')}` : ''}}}`
      })
      return s
    })
    if (body !== body0) { writeFileSync(f, front + body); changed++ }
  }
  console.log(`relinked ${changed} of ${paths.length}`)
}

function main(): void {
  const [cmd, ...args] = process.argv.slice(2)
  if (!['status', 'stamp', 'relink'].includes(cmd ?? '')) { console.log('npm run wiki:translate -- status | stamp [file…] | relink [file…]'); process.exitCode = 1; return }
  const [zh, en] = buildBoth()
  if (cmd === 'status') status(en)
  else if (cmd === 'stamp') stamp(files(args, en))
  else relink(files(args, en), zh, en)
}

main()
