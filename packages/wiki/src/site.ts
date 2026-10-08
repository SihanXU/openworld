// The whole wiki: pages from wiki/pages, a page for every thing in the game that has none, the special
// pages, every link resolved, and the completeness check (every thing and every system has a page).

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGame, zh, type Ent, type Game, type ItemEnt, type MapEnt } from './game.ts'
import { escapeAttr, escapeHtml, inline, parseFront, plain, render, slug, type Front } from './markup.ts'
import { esc, fit, linkHref, runTemplate, type Ctx, type PageRef, type Translations } from './templates.ts'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const WIKI = join(ROOT, 'wiki')
const PAGES = join(WIKI, 'pages')

export interface Page extends PageRef {
  /** Repo-relative path of its file (hand-written pages). */
  file?: string
  front: Front
  body: string
  status: string
  categories: string[]
  aliases: string[]
  special?: boolean
  html: string
  headings: { level: number; text: string; id: string }[]
  /** Links it makes: target title (and anchor). */
  out: { title: string; anchor?: string }[]
  errors: string[]
  /** The skeleton a new file for it starts from (generated pages, red links). */
  skeleton?: string
  /** Last change of its file (git). */
  updated?: string
}

export interface SiteConf {
  站名: string
  仓库: string
  侧边栏: { 标题: string; 链接: string[] }[]
  门户: { 标题: string; 条目: [string, string][] }[]
  系统: { 按键: Record<string, string>; 面板: Record<string, string>; 规则: string[] }
}

export interface Built {
  pages: Map<string, Page>
  game: Game
  conf: SiteConf
  errors: string[]
  warnings: string[]
  missingTr: Map<string, Set<string>>
  redLinks: Map<string, Set<string>>
  ref: string
  commit: string
  builtAt: string
  coverage: string
}

const TYPE_OF_KIND: Record<string, string> = { item: '物品', fixture: '物品', structure: '物品', person: '人物', companion: '人物', creature: '怪物', boss: '首领', map: '地点', quest: '任务' }
const DIR_OF_KIND: Record<string, string> = { item: '物品', fixture: '物品', structure: '物品', person: '人物', companion: '人物', creature: '怪物', boss: '怪物', map: '地点', quest: '任务' }
const TYPES = new Set(['系统', '人物', '物品', '怪物', '首领', '地点', '任务', '设定', '章节', '列表', '帮助'])

function git(args: string[]): string {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).trim() } catch { return '' }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : f.endsWith('.md') ? [p] : []
  })
}

/** The fixed skeleton of a page about a thing (格式手册: each kind's section order). */
export function skeleton(e: Ent | undefined, type: string): string {
  const k = e?.kind
  const head = `---\n类型: ${type}\n${e ? `对象: ${e.id}\n` : ''}摘要: \n---\n`
  if (k === 'person' || k === 'companion') return `${head}{{信息框}}\n{{引言|一句代表性的台词|${e!.zh}}}\n**${e!.zh}**是……\n\n## 日程表\n{{日程表}}\n\n## 人际关系\n{{人际关系}}\n\n## 对话\n{{对话}}\n\n## 任务\n{{相关任务}}\n\n## 肖像\n{{肖像}}\n\n## 设定\n\n## 趣闻\n\n## 历史\n\n{{导航框|居民}}\n`
  if (k === 'item' || k === 'fixture' || k === 'structure') return `${head}{{信息框}}\n**${e!.zh}**是……\n\n## 来源\n{{来源}}\n\n## 用途\n{{用途}}\n\n## 制作\n{{配方}}\n${k === 'item' ? '\n## 变体\n{{变体}}\n' : ''}\n## 趣闻\n\n## 历史\n\n{{导航框|${k === 'item' ? '物品' : '设施'}}}\n`
  if (k === 'creature') return `${head}{{信息框}}\n**${e!.zh}**是……\n\n## 出没\n{{出没}}\n\n## 行为\n\n## 策略\n\n## 掉落\n{{掉落}}\n\n## 历史\n\n{{导航框|怪物}}\n`
  if (k === 'boss') return `${head}{{信息框}}\n**${e!.zh}**是……\n\n## 出没\n{{出没}}\n\n## 技能\n{{首领技能}}\n\n## 行为\n\n## 策略\n\n## 掉落\n{{掉落}}\n\n## 设定\n\n## 历史\n\n{{导航框|怪物}}\n`
  if (k === 'map') return `${head}{{信息框}}\n**${e!.zh}**是……\n\n## 地图\n{{地图}}\n\n## 区域\n\n## 居民\n{{居民}}\n\n## 生物\n{{生物}}\n\n## 物品与资源\n{{物品分布}}\n\n## 相连地点\n{{相连地点}}\n\n## 设定\n\n## 历史\n\n{{导航框|地点}}\n`
  if (k === 'quest') return `${head}{{信息框}}\n**${e!.zh}**是……\n\n## 目标\n{{任务目标}}\n\n## 流程\n\n## 奖励\n{{任务奖励}}\n\n## 对话\n{{任务对话}}\n\n## 历史\n\n{{导航框|任务}}\n`
  return `${head}一句话说明这是什么。\n\n## 规则\n\n## 历史\n\n`
}

/** What a generated page says before anyone writes it. */
function generatedBody(g: Game, e: Ent): string {
  const lead = (() => {
    switch (e.kind) {
      case 'item': case 'fixture': case 'structure': {
        const it = e as ItemEnt
        return `**${e.zh}**（${it.en}）是游戏里的一种${it.kind === 'structure' ? '[[建筑件]]' : it.kind === 'fixture' ? `设施（${it.group}）` : `物品（${it.group}）`}。`
      }
      case 'person': return `**${e.zh}**是${(e as any).home ? `住在[[${g.mapOf((e as any).home)?.title}]]的` : '只在剧情中出场的'}${(e as any).roleZh}。`
      case 'companion': return `**${e.zh}**是一路跟着玩家的同伴。`
      case 'creature': return `**${e.zh}**是一种[[怪物]]（${e.group}）。`
      case 'boss': return `**${e.zh}**是一位[[首领]]。`
      case 'map': return `**${e.zh}**是游戏里的一处[[地点]]。`
      case 'quest': return `**${e.zh}**是一个[[任务]]。`
    }
  })()
  return skeleton(e, TYPE_OF_KIND[e.kind]).replace(/^---[\s\S]*?---\n/, '').replace(/\*\*[^*]+\*\*是……/, lead ?? '') + '\n{{小作品}}\n'
}

const STATUS_BANNER: Record<string, string> = { 规划中: '{{规划中}}', 待设计: '{{待设计}}' }

export function buildSite(opts: { ref?: string } = {}): Built {
  const game = loadGame()
  const tr: Translations = JSON.parse(readFileSync(join(WIKI, '译名.json'), 'utf8'))
  const conf: SiteConf = JSON.parse(readFileSync(join(WIKI, 'site.json'), 'utf8'))
  const errors: string[] = []
  const warnings: string[] = []
  const missingTr = new Map<string, Set<string>>()
  const pages = new Map<string, Page>()
  const commit = git(['rev-parse', '--short', 'HEAD']) || 'local'
  const ref = opts.ref || git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'main'

  // ---- hand-written pages
  const bound = new Set<string>()
  const updated = new Map<string, string>()
  for (const line of git(['log', '--format=%x1e%ad', '--date=short', '--name-only', '--', 'wiki/pages']).split('\x1e')) {
    const [date, ...files] = line.trim().split('\n')
    for (const f of files) if (f && !updated.has(f)) updated.set(f, date)
  }
  for (const file of walk(PAGES)) {
    const rel = relative(ROOT, file).split(sep).join('/')
    const { front, body, errors: fe } = parseFront(readFileSync(file, 'utf8'))
    const name = file.split(sep).pop()!.replace(/\.md$/, '')
    const dir = relative(PAGES, file).split(sep).slice(0, -1).join('/')
    let ent: Ent | undefined
    if (front.对象) {
      ent = game.byId.get(front.对象)
      const known = game.professions.some((p) => p.id === front.对象) || game.branches.some((b) => b.id === front.对象)
      if (!ent && !known) errors.push(`${rel}：对象「${front.对象}」在游戏里不存在`)
      else if (ent && bound.has(ent.id)) errors.push(`${rel}：对象「${front.对象}」已经有另一个页面`)
      else if (ent) bound.add(ent.id)
    }
    const type = front.类型 ?? (ent ? TYPE_OF_KIND[ent.kind] : '系统')
    if (!TYPES.has(type)) errors.push(`${rel}：类型「${type}」不认识`)
    const title = ent ? ent.title : (front.标题 ?? name)
    if (ent && front.标题 && front.标题 !== ent.title) warnings.push(`${rel}：写游戏对象的页面，标题跟着游戏里的名字（${ent.title}），开头的「标题」不起作用`)
    if (pages.has(title)) { errors.push(`${rel}：标题「${title}」和 ${pages.get(title)!.file} 重复`); continue }
    pages.set(title, {
      title, type, ent, dir, file: rel, front, body, status: front.状态 ?? '已实现', categories: front.分类, aliases: front.别名, summary: front.摘要,
      navboxes: new Set(), stub: /\{\{\s*小作品\s*\}\}/.test(body), html: '', headings: [], out: [], errors: fe.map((x) => `${rel}：${x}`), updated: updated.get(rel),
    })
  }

  // ---- a page for every thing that has none
  const all: Ent[] = [...game.items, ...game.fixtures, ...game.structures, ...game.people, ...game.creatures, ...game.bosses, ...game.maps, ...game.quests]
  for (const e of all) {
    if (bound.has(e.id)) continue
    if (pages.has(e.title)) { errors.push(`「${e.title}」既是手写页面的标题，又是游戏里${e.kind}的名字：请在那个页面开头写「对象: ${e.id}」，或者给它换个标题`); continue }
    pages.set(e.title, {
      title: e.title, type: TYPE_OF_KIND[e.kind], ent: e, dir: DIR_OF_KIND[e.kind], front: { 分类: [], 别名: [] }, body: generatedBody(game, e), status: '已实现',
      categories: [], aliases: [], navboxes: new Set(), stub: true, html: '', headings: [], out: [], errors: [], skeleton: skeleton(e, TYPE_OF_KIND[e.kind]),
    })
  }

  // ---- aliases and the special pages' titles
  const alias = new Map<string, string>()
  for (const p of pages.values()) for (const a of p.aliases) {
    if (pages.has(a)) { if (a !== p.title) warnings.push(`${p.file}：别名「${a}」已经是别的页面的标题，这个别名不起作用`); continue }
    if (alias.has(a) && alias.get(a) !== p.title) warnings.push(`${p.file}：别名「${a}」和「${alias.get(a)}」的别名重复`)
    else alias.set(a, p.title)
  }
  const SPECIAL = ['特殊：最近更改', '特殊：待完善', '特殊：所有页面', '特殊：随机页面', '特殊：数值', '特殊：完备性', '特殊：搜索']
  const resolve = (t: string): string | undefined => (pages.has(t) ? t : alias.get(t) ?? (SPECIAL.includes(t) || t.startsWith('分类：') ? t : undefined))

  // navbox membership (a hand navbox lists the pages that carry it)
  for (const p of pages.values()) for (const m of p.body.matchAll(/\{\{\s*导航框\s*\|\s*([^}|]+?)\s*\}\}/g)) p.navboxes.add(m[1])

  // default categories
  for (const p of pages.values()) {
    const cats = new Set(p.categories)
    const e = p.ent
    if (e) {
      cats.add(({ item: '物品', fixture: '设施', structure: '建筑件', person: '居民', companion: '居民', creature: '怪物', boss: '首领', map: '地点', quest: '任务' } as Record<string, string>)[e.kind])
      if (e.kind === 'item' || e.kind === 'fixture') cats.add(e.group)
      if (e.kind === 'quest') cats.add(({ main: '主线任务', side: '支线任务', repeat: '重复任务' } as Record<string, string>)[(e as any).def.kind])
      if (e.kind === 'creature') cats.add(e.group)
    } else cats.add(({ 系统: '玩法', 设定: '世界观', 章节: '剧情', 列表: '列表', 帮助: '帮助' } as Record<string, string>)[p.type] ?? p.type)
    if (p.stub) cats.add('待完善')
    if (p.status !== '已实现') cats.add(p.status)
    p.categories = [...cats].filter(Boolean)
  }

  // ---- the history of merged work
  const history = git(['log', '--merges', '--first-parent', '--date=short', '--format=%x1e%ad%x1f%s%x1f%b', 'HEAD']).split('\x1e').flatMap((r) => {
    const [date, subject, body] = r.trim().split('\x1f')
    const m = subject?.match(/^Merge pull request #(\d+) from ([^\s]+)/)
    return m ? [{ date, pr: m[1], branch: m[2], title: (body ?? '').trim().split('\n')[0] || m[2] }] : []
  })

  // ---- render
  const redLinks = new Map<string, Set<string>>()
  const renderPage = (p: Page) => {
    const errs: string[] = []
    const where = p.file ?? `（自动生成）${p.title}`
    const ctx: Ctx = {
      g: game, tr, page: p, pages,
      link: (target, text) => {
        const [t0, anchor] = target.split('#')
        const t = t0 ? resolve(t0.trim()) : p.title
        p.out.push({ title: t ?? t0.trim(), anchor: anchor?.trim() })
        const label = escapeHtml(text ?? (t0 ? t0 : anchor ?? ''))
        if (!t) {
          if (!redLinks.has(t0.trim())) redLinks.set(t0.trim(), new Set())
          redLinks.get(t0.trim())!.add(p.title)
          return `<a class="new" href="${newFileHref(conf, ref, t0.trim(), '系统', undefined)}" title="${escapeAttr(t0)}（页面还不存在，点这里新建）">${label}</a>`
        }
        return `<a href="${linkHref(t)}${anchor ? '#' + encodeURIComponent(slug(anchor)) : ''}"${t !== t0 && t0 ? ` title="${escapeAttr(t)}"` : ''}>${label}</a>`
      },
      inline: (md) => inline(md, hooks),
      error: (msg) => errs.push(`${where}：${msg}`),
      missing: (section, key) => { if (!missingTr.has(section)) missingTr.set(section, new Set()); missingTr.get(section)!.add(key) },
      history,
      values: () => `<table class="wikitable sortable"><thead><tr><th>名字</th><th>值</th><th>含义</th><th>代码</th></tr></thead><tbody>${Object.entries(game.values).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v.value)}</td><td>${esc(v.note)}</td><td><small>${esc(v.source)}</small></td></tr>`).join('')}</tbody></table>`,
      portal: () => portal(ctx, conf, game, pages),
      include: (path) => {
        const f = join(ROOT, path)
        if (!existsSync(f) || !path.match(/^(docs|wiki)\/[^.]+\.md$/)) { errs.push(`${where}：{{原文|${path}}} 找不到文件`); return '' }
        return `<div class="original">${render(readFileSync(f, 'utf8').replace(/^#\s.*\n/, ''), hooks).html}</div>`
      },
    }
    const hooks = { template: (call: any) => runTemplate(ctx, call), link: (t: string, x?: string) => ctx.link(t, x) }
    const banner = STATUS_BANNER[p.status] && !p.body.includes(STATUS_BANNER[p.status]) ? STATUS_BANNER[p.status] + '\n\n' : ''
    const r = render(banner + p.body, hooks)
    p.html = r.html
    p.headings = r.headings
    p.errors.push(...errs)
  }
  for (const p of pages.values()) renderPage(p)

  // ---- checks: anchors, required data templates, completeness
  for (const p of pages.values()) {
    for (const l of p.out) {
      if (!l.anchor) continue
      const target = pages.get(l.title)
      if (target && !target.headings.some((h) => h.id === slug(l.anchor!)) && !target.html.includes(`id="${escapeAttr(slug(l.anchor!))}"`) && !target.html.includes(`id="${escapeAttr(l.anchor!)}"`)) p.errors.push(`${p.file ?? p.title}：[[${l.title}#${l.anchor}]] 链到的小节不存在`)
    }
    if (p.ent && p.file && p.type === TYPE_OF_KIND[p.ent.kind]) {
      const need: Record<string, string[]> = {
        person: ['信息框', '日程表', '对话'], companion: ['信息框'], item: ['信息框', '来源', '用途'], fixture: ['信息框', '来源'], structure: ['信息框', '来源'],
        creature: ['信息框', '出没', '掉落'], boss: ['信息框', '首领技能'], map: ['信息框', '地图', '相连地点'], quest: ['信息框', '任务目标', '任务奖励'],
      }
      for (const t of need[p.ent.kind] ?? []) if (!new RegExp(`\\{\\{\\s*${t}\\s*[|}]`).test(p.body)) p.errors.push(`${p.file}：${TYPE_OF_KIND[p.ent.kind]}页面要包含 {{${t}}}`)
    }
  }
  const coverage = completeness(game, conf, pages, resolve, errors, warnings)
  for (const p of pages.values()) errors.push(...p.errors)

  const built: Built = { pages, game, conf, errors, warnings, missingTr, redLinks, ref, commit, builtAt: new Date().toISOString().slice(0, 16).replace('T', ' '), coverage }
  addSpecialPages(built, resolve, renderPage)
  return built
}

/** Every thing, every system, every table has a page: what is missing fails the build. */
function completeness(g: Game, conf: SiteConf, pages: Map<string, Page>, resolve: (t: string) => string | undefined, errors: string[], warnings: string[]): string {
  const rows: string[] = []
  const check = (what: string, page: string | undefined, ok: boolean, note = '') => {
    rows.push(`<tr class="${ok ? 'ok' : 'bad'}"><td>${esc(what)}</td><td>${page ? `<a href="${linkHref(page)}">${esc(page)}</a>` : '—'}</td><td>${ok ? '✓' : '✗'}</td><td>${esc(note)}</td></tr>`)
    if (!ok) errors.push(`完备性：${what}${page ? `（应在「${page}」）` : ''}没有页面${note ? `：${note}` : ''}`)
  }
  const body = (t: string) => pages.get(resolve(t) ?? '')?.body ?? ''
  for (const [k, t] of Object.entries(conf.系统.按键)) check(`按键 ${k}`, t, !!resolve(t))
  for (const [k, t] of Object.entries(conf.系统.面板)) check(`面板 ${k}`, t, !!resolve(t))
  for (const t of conf.系统.规则) check(`系统 ${t}`, t, !!resolve(t) && !pages.get(resolve(t)!)!.stub, resolve(t) ? (pages.get(resolve(t)!)!.stub ? '还是小作品' : '') : '')
  const allBodies = [...pages.values()].map((p) => p.body).join('\n')
  for (const b of g.branches) check(`技能分支 ${b.name.zh}`, '技能', allBodies.includes(`{{技能树|${b.name.zh}}}`) || allBodies.includes(`{{技能树|${b.id}}}`), '要有 {{技能树|…}}')
  for (const p of g.professions) check(`职业 ${p.name.zh}`, p.name.zh, !!resolve(p.name.zh))
  for (const t of ['配方表', '建造表', '状态表', '地形表', '材质表', '品质表', '食物表', '作物表', '首领表', '怪物表', '居民表', '地点表', '传送雕像表', '夜行生物表', '恩赐表', '职业表', '房间用途表', '效率表', '传说武器表', '圣痕之力表']) check(`数据表 {{${t}}}`, undefined, allBodies.includes(`{{${t}`), '要在某个页面上出现')
  for (const k of ['main', 'side', 'repeat']) check(`任务表（${k}）`, '任务', /\{\{任务表(\|(主线|支线|重复))?\}\}/.test(body('任务')) || allBodies.includes('{{任务表}}'))
  const kinds: [string, Ent[]][] = [['物品', g.items], ['设施', g.fixtures], ['建筑件', g.structures], ['人物', g.people], ['怪物', g.creatures], ['首领', g.bosses], ['地点', g.maps], ['任务', g.quests]]
  for (const [k, list] of kinds) {
    const written = list.filter((e) => [...pages.values()].some((p) => p.ent === e && p.file && !p.stub)).length
    rows.push(`<tr class="${written === list.length ? 'ok' : 'part'}"><td>${k}</td><td>${list.length} 个，都有页面</td><td>✓</td><td>${written} 个有手写正文，${list.length - written} 个还是自动生成的小作品</td></tr>`)
  }
  void warnings
  return `<table class="wikitable coverage"><thead><tr><th>项目</th><th>页面</th><th>状态</th><th>说明</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

function portal(ctx: Ctx, conf: SiteConf, g: Game, pages: Map<string, Page>): string {
  const icon = (key: string) => {
    if (!key) return ''
    if (key.startsWith('skill:')) return `<span class="spr" style="width:32px;height:32px;background-image:url('/assets/lsw/skills/${key.slice(6)}.png');background-size:32px 32px"></span>`
    const e = g.byTitle.get(key) ?? (g.byName.get(key) ?? [])[0]
    return e ? fit((e as any).face ?? e.sprite, 32) : ''
  }
  return `<div class="portal">${conf.门户.map((s) => `<section class="portal-box"><h3>${esc(s.标题)}</h3><ul>${s.条目.map(([t, i]) => `<li>${icon(i || t) || '<span class="spr-ph"></span>'}${ctx.link(t)}</li>`).join('')}</ul></section>`).join('')}</div>`
  void pages
}

export function newFileHref(conf: SiteConf, ref: string, title: string, type: string, e: Ent | undefined, dir = ''): string {
  const d = dir || ({ 系统: '基本', 设定: '世界观' } as Record<string, string>)[type] || type
  return `https://github.com/${conf.仓库}/new/${encodeURIComponent(ref)}/wiki/pages/${encodeURIComponent(d)}?filename=${encodeURIComponent(title)}.md&value=${encodeURIComponent(skeleton(e, type))}`
}

function addSpecialPages(b: Built, resolve: (t: string) => string | undefined, renderPage: (p: Page) => void): void {
  const { pages } = b
  const add = (title: string, body: string, summary: string) => {
    const p: Page = { title, type: '列表', front: { 分类: [], 别名: [] }, body, status: '已实现', categories: [], aliases: [], navboxes: new Set(), stub: false, html: '', headings: [], out: [], errors: [], special: true, summary }
    pages.set(title, p)
    renderPage(p)
    p.errors = []
  }
  // recent changes: the wiki's own commits
  const log = git(['log', '-n', '150', '--date=format:%Y-%m-%d %H:%M', '--format=%x1e%h%x1f%ad%x1f%an%x1f%s', '--name-only', '--', 'wiki/'])
  const rows = log.split('\x1e').filter((x) => x.trim()).map((r) => {
    const [head, ...files] = r.trim().split('\n')
    const [hash, date, author, subject] = head.split('\x1f')
    const touched = files.filter(Boolean).map((f) => {
      const t = [...pages.values()].find((p) => p.file === f)
      return t ? `<a href="${linkHref(t.title)}">${esc(t.title)}</a>` : `<code>${esc(f.replace(/^wiki\//, ''))}</code>`
    })
    return `<tr><td>${esc(date)}</td><td>${esc(author)}</td><td>${esc(subject)}</td><td>${touched.join('、')}</td><td><a href="https://github.com/${b.conf.仓库}/commit/${hash}">${hash}</a></td></tr>`
  })
  add('特殊：最近更改', `维基源文件（仓库的 \`wiki/\` 目录）最近的改动，新的在前。游戏数据的改动会直接反映在各页面的数据表里，不列在这里；见[[版本历史]]。\n\n<table class="wikitable"><thead><tr><th>时间</th><th>作者</th><th>说明</th><th>页面</th><th>提交</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="5">还没有提交记录。</td></tr>'}</tbody></table>`, '维基最近的改动')
  // stubs and red links
  const stubs = [...pages.values()].filter((p) => p.stub).sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  const byType = new Map<string, Page[]>()
  for (const p of stubs) { if (!byType.has(p.type)) byType.set(p.type, []); byType.get(p.type)!.push(p) }
  const red = [...b.redLinks].sort((a, c) => c[1].size - a[1].size)
  add('特殊：待完善', `这里列出还没写完的页面（带「小作品」标记的），以及别的页面链过去、但还不存在的页面。挑一个，点进去按「编辑」就能补。\n\n## 还不存在的页面\n\n${red.length ? red.map(([t, from]) => `- [[${t}]]（被 ${[...from].slice(0, 6).map((f) => `[[${f}]]`).join('、')}${from.size > 6 ? ` 等 ${from.size} 页` : ''}链到）`).join('\n') : '没有。'}\n\n## 小作品\n\n共 ${stubs.length} 页。\n\n${[...byType].map(([t, ps]) => `### ${t}（${ps.length}）\n\n${ps.map((p) => `[[${p.title}]]`).join(' · ')}`).join('\n\n')}\n`, '还没写完的页面')
  // all pages
  const all = [...pages.values()].filter((p) => !p.special).sort((a, c) => a.title.localeCompare(c.title, 'zh'))
  const groups = new Map<string, Page[]>()
  for (const p of all) { if (!groups.has(p.type)) groups.set(p.type, []); groups.get(p.type)!.push(p) }
  add('特殊：所有页面', `本站共 ${all.length} 页。\n\n${[...groups].map(([t, ps]) => `## ${t}（${ps.length}）\n\n${ps.map((p) => `[[${p.title}]]`).join(' · ')}`).join('\n\n')}\n`, '所有页面')
  add('特殊：数值', `\`{{数值|名字}}\` 能用的数值。它们在构建时从游戏代码里读出来，代码改了，这里和所有用到它们的页面一起变。\n\n{{数值表}}\n`, '代码里的数值')
  add('特殊：完备性', `维基要包含游戏的全部内容。每次构建都会检查下表；有一项不满足，构建就会失败，网站保持上一个版本。\n\n<div class="coverage-box">${b.coverage}</div>\n\n## 构建时的错误\n\n${b.errors.length ? b.errors.map((e) => `- ${escapeHtml(e)}`).join('\n') : '没有。'}\n\n## 提醒\n\n${b.warnings.length ? b.warnings.map((e) => `- ${escapeHtml(e)}`).join('\n') : '没有。'}\n\n## 缺译名\n\n游戏数据里只有英文的词，在 \`wiki/译名.json\` 里补上中文：\n\n${[...b.missingTr].map(([s, ks]) => `- ${s}：${[...ks].map((k) => `\`${k}\``).join('、')}`).join('\n') || '没有。'}\n`, '完备性检查')
  add('特殊：随机页面', `<p id="random-go">正在跳转……</p>`, '随机打开一页')
  add('特殊：搜索', `<div id="search-results"></div>`, '搜索')
  // category pages
  const cats = new Map<string, Page[]>()
  for (const p of pages.values()) for (const c of p.categories) { if (!cats.has(c)) cats.set(c, []); cats.get(c)!.push(p) }
  for (const [c, ps] of cats) {
    const sorted = ps.sort((a, d) => a.title.localeCompare(d.title, 'zh'))
    add(`分类：${c}`, `这个分类下有 ${sorted.length} 页。\n\n<ul class="catlist">${sorted.map((p) => `<li><a href="${linkHref(p.title)}">${esc(p.title)}</a></li>`).join('')}</ul>\n`, `分类：${c}`)
  }
  void resolve
}

export const pageSummary = (p: Page): string => p.summary || plain(p.html).slice(0, 120)
export { zh, type MapEnt }
