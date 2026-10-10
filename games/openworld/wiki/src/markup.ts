// A page's text: front matter, [[links]], {{templates}}, Markdown. Templates and links become
// placeholders before Markdown runs and their HTML goes back in after, so a block template (a table, an
// infobox) never ends up inside a paragraph.

import { marked } from 'marked'

export interface Front {
  标题?: string
  类型?: string
  对象?: string
  分类: string[]
  状态?: string
  别名: string[]
  摘要?: string
}

const KEYS: Record<string, keyof Front> = {
  标题: '标题', title: '标题', 类型: '类型', type: '类型', 对象: '对象', game: '对象', object: '对象', 分类: '分类', categories: '分类',
  状态: '状态', status: '状态', 别名: '别名', aliases: '别名', 摘要: '摘要', summary: '摘要',
}

export function parseFront(src: string): { front: Front; body: string; errors: string[] } {
  const front: Front = { 分类: [], 别名: [] }
  const errors: string[] = []
  const text = src.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return { front, body: text, errors }
  const end = text.indexOf('\n---', 4)
  if (end < 0) return { front, body: text, errors: ['开头的 --- 没有结束'] }
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim()) continue
    const m = line.match(/^\s*([^:：]+?)\s*[:：]\s*(.*)$/)
    if (!m) { errors.push(`看不懂开头这一行：${line}`); continue }
    const key = KEYS[m[1].trim()]
    if (!key) { errors.push(`开头的键「${m[1]}」不认识`); continue }
    const value = m[2].trim()
    if (key === '分类' || key === '别名') (front[key] as string[]).push(...value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean))
    else (front as any)[key] = value
  }
  return { front, body: text.slice(end + 4).replace(/^[^\n]*\n/, ''), errors }
}

export interface TemplateCall { name: string; args: string[]; named: Record<string, string> }

/** Split `a|b|c` at the top level (not inside [[…]] or {{…}}). */
function splitArgs(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue }
    if ((two === '}}' || two === ']]') && depth > 0) { depth--; cur += two; i++; continue }
    if (s[i] === '|' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += s[i]
  }
  out.push(cur)
  return out
}

export function parseCall(inner: string): TemplateCall {
  const parts = splitArgs(inner)
  const name = parts[0].trim()
  const args: string[] = []
  const named: Record<string, string> = {}
  for (const p of parts.slice(1)) {
    const m = p.match(/^\s*([^=\s[\]{}|]+)\s*=(.*)$/s)
    if (m && !/^\s*https?:/.test(p)) named[m[1]] = m[2].trim()
    else args.push(p.trim())
  }
  return { name, args, named }
}

/** Find every top-level {{…}} in a text: [start, end, inner]. */
function findTemplates(s: string): [number, number, string][] {
  const out: [number, number, string][] = []
  let i = 0
  while (i < s.length) {
    const a = s.indexOf('{{', i)
    if (a < 0) break
    let depth = 0, j = a
    for (; j < s.length - 1; j++) {
      if (s[j] === '{' && s[j + 1] === '{') { depth++; j++; continue }
      if (s[j] === '}' && s[j + 1] === '}') { depth--; j++; if (depth === 0) break; continue }
    }
    if (depth !== 0) break
    out.push([a, j + 1, s.slice(a + 2, j - 1)])
    i = j + 1
  }
  return out
}

export interface RenderHooks {
  /** A template's HTML, and whether it is a block (never wrapped in a paragraph). */
  template(call: TemplateCall): { html: string; block: boolean }
  link(target: string, text: string | undefined): string
}

const PH = (n: number) => `\u0002${n}\u0003`
const PH_RE = /\u0002(\d+)\u0003/g

const slugCache = new Map<string, string>()
export function slug(text: string): string {
  if (!slugCache.has(text)) slugCache.set(text, text.trim().replace(/<[^>]+>/g, '').replace(/[\s]+/g, '_').replace(/[?#%"'<>&/\\]/g, ''))
  return slugCache.get(text)!
}

export interface Rendered { html: string; headings: { level: number; text: string; id: string }[] }

/** Render a page body: templates and links through the hooks, the rest as Markdown. */
export function render(body: string, hooks: RenderHooks): Rendered {
  const store: { html: string; block: boolean }[] = []
  const put = (html: string, block: boolean) => PH(store.push({ html, block }) - 1)
  let s = body
  // code is left alone: fenced blocks and inline spans
  s = s.replace(/^```[^\n]*\n[\s\S]*?\n```\s*$/gm, (m) => put(marked.parse(m) as string, true))
  s = s.replace(/`[^`\n]+`/g, (m) => put(marked.parseInline(m) as string, false))
  // spoiler blocks
  s = s.replace(/^\s*\{\{\s*剧透\s*(?:\|([^}]*))?\}\}\s*$/gm, (_, title) =>
    `\n${put(`<details class="spoiler"><summary>${escapeHtml((title ?? '').trim() || '剧透')}<span class="spoiler-hint">（点开查看）</span></summary><div class="spoiler-body">`, true)}\n`)
  s = s.replace(/^\s*\{\{\s*\/\s*剧透\s*\}\}\s*$/gm, () => `\n${put('</div></details>', true)}\n`)
  // templates, innermost text first: a template's arguments are rendered inline by the template
  let found = findTemplates(s)
  while (found.length) {
    let out = ''
    let last = 0
    for (const [a, b, inner] of found) {
      out += s.slice(last, a)
      const r = hooks.template(parseCall(inner))
      out += r.block ? `\n\n${put(r.html, true)}\n\n` : put(r.html, false)
      last = b
    }
    s = out + s.slice(last)
    found = findTemplates(s)
  }
  // links
  s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_, target: string, text?: string) => put(hooks.link(target.trim(), text?.trim()), false))
  let html = marked.parse(s, { gfm: true, breaks: false }) as string
  // a block template alone in a paragraph is the block itself
  html = html.replace(/<p>\s*((?:\u0002\d+\u0003\s*)+)<\/p>/g, (m, inner: string) => {
    const ids = [...inner.matchAll(/\u0002(\d+)\u0003/g)].map((x) => Number(x[1]))
    return ids.every((i) => store[i].block) ? inner : m
  })
  for (let k = 0; k < 4 && PH_RE.test(html); k++) html = html.replace(PH_RE, (_, n) => store[Number(n)].html)
  // headings get ids for [[页面#小节]]
  const headings: Rendered['headings'] = []
  html = html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    const id = slug(text)
    headings.push({ level: Number(level), text, id })
    return `<h${level} id="${escapeAttr(id)}"><span class="mw-headline">${inner}</span></h${level}>`
  })
  return { html, headings }
}

/** Inline text (a template's argument): links and Markdown emphasis, no paragraphs. */
export function inline(text: string, hooks: RenderHooks): string {
  const r = render(text, hooks).html.trim()
  return r.replace(/^<p>([\s\S]*)<\/p>$/, '$1')
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/** The plain text of some HTML (search). */
export const plain = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
