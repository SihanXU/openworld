// The whole wiki, one edition at a time (lang.ts): pages from wiki/pages (Chinese, the source) or wiki/en/pages (their
// English translations, paired by path), a page for every thing in the game that has none, the special pages, every
// link resolved, and the completeness check (every thing and every system has a page; the Chinese edition's).

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupName, loadGame, say, zh, type Ent, type Game, type ItemEnt, type MapEnt } from './game.ts'
import { L, lang, setLang, type Lang } from './lang.ts'
import { escapeAttr, escapeHtml, inline, parseFront, plain, render, slug, type Front } from './markup.ts'
import { TEMPLATE_EN, esc, fit, linkHref, runTemplate, type Ctx, type PageRef, type Translations } from './templates.ts'

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
export const WIKI = join(ROOT, 'wiki')
/** Each edition's hand-written pages. */
export const PAGES: Record<Lang, string> = { zh: join(WIKI, 'pages'), en: join(WIKI, 'en', 'pages') }

export interface Page extends PageRef {
  /** The page across the editions: `p:<path>` a hand page not about a game thing, `e:<id>` a thing's, `s:<name>` a special page, `c:<name>` a category. */
  key: string
  /** Repo-relative path of its file (hand-written pages). */
  file?: string
  front: Front
  body: string
  /** Its text without code, template names in Chinese (what the checks read). */
  scan: string
  status: string
  categories: string[]
  aliases: string[]
  special?: boolean
  html: string
  headings: { level: number; text: string; id: string }[]
  /** Links it makes: target title (and anchor). */
  out: { title: string; anchor?: string }[]
  errors: string[]
  /** The skeleton a new file for it starts from (generated pages, red links, a translation not yet made). */
  skeleton?: string
  /** Last change of its file (git). */
  updated?: string
  /** English edition: how its translation stands against the Chinese page (none: a page with no Chinese file to follow). */
  translation?: 'current' | 'outdated' | 'missing'
  /** The Chinese page it translates (English edition). */
  source?: Page
  /** The same page in the other edition, when there is one (filled once both are built). */
  other?: string
}

export interface SiteConf {
  站名: string
  仓库: string
  侧边栏: { 标题: string; 链接: string[] }[]
  门户: { 标题: string; 条目: [string, string][] }[]
  系统: { 按键: Record<string, string>; 面板: Record<string, string>; 规则: string[] }
}

/** The English edition's own words for the navigation (wiki/en/site.json): its name and the headings; the links are the Chinese site file's. */
interface SiteConfEn { name: string; headings: Record<string, string> }

export interface Built {
  lang: Lang
  pages: Map<string, Page>
  byKey: Map<string, Page>
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
  /** A title, an alias, a special page's or a category's name (and, in English, a Chinese one) → the page's title here. */
  resolve: (t: string) => string | undefined
}

const TYPE_OF_KIND: Record<string, string> = { item: '物品', fixture: '物品', structure: '物品', person: '人物', companion: '人物', creature: '怪物', boss: '首领', map: '地点', quest: '任务' }
const DIR_OF_KIND: Record<string, string> = { item: '物品', fixture: '物品', structure: '物品', person: '人物', companion: '人物', creature: '怪物', boss: '怪物', map: '地点', quest: '任务' }
const TYPES = new Set(['系统', '人物', '物品', '怪物', '首领', '地点', '任务', '设定', '章节', '列表', '帮助'])
/** A page type's English word (an English file may write either). */
export const TYPE_EN: Record<string, string> = { 系统: 'system', 人物: 'person', 物品: 'item', 怪物: 'monster', 首领: 'boss', 地点: 'location', 任务: 'quest', 设定: 'lore', 章节: 'chapter', 列表: 'list', 帮助: 'help' }
const TYPE_ZH = Object.fromEntries(Object.entries(TYPE_EN).map(([z, e]) => [e, z]))
/** The statuses a page may be in. */
const STATUS_ZH: Record<string, string> = { implemented: '已实现', planned: '规划中', tbd: '待设计', 'to be designed': '待设计' }

/** The categories the build gives, in English (front-matter categories of an English page are written in English). */
const CATEGORY_EN: Record<string, string> = {
  物品: 'Items', 设施: 'Fixtures', 建筑件: 'Structures', 居民: 'Residents', 怪物: 'Monsters', 首领: 'Bosses', 地点: 'Locations', 任务: 'Quests',
  主线任务: 'Main quests', 支线任务: 'Side quests', 委托任务: 'Favors', 指引任务: 'Guide quests', 玩法: 'Gameplay', 世界观: 'Lore', 剧情: 'Story', 列表: 'Lists', 帮助: 'Help',
  待完善: 'Stubs', 规划中: 'Planned', 待设计: 'To be designed', 企划: 'Design',
}
const category = (zhName: string): string => L(zhName, CATEGORY_EN[zhName] ?? groupName(zhName))

/** The special pages, by key: their titles in each edition. */
const SPECIALS: Record<string, [string, string]> = {
  最近更改: ['特殊：最近更改', 'Special:Recent changes'], 待完善: ['特殊：待完善', 'Special:Stubs'], 所有页面: ['特殊：所有页面', 'Special:All pages'],
  随机页面: ['特殊：随机页面', 'Special:Random page'], 数值: ['特殊：数值', 'Special:Values'], 完备性: ['特殊：完备性', 'Special:Completeness'], 搜索: ['特殊：搜索', 'Special:Search'],
}
export const specialTitle = (k: keyof typeof SPECIALS): string => L(...SPECIALS[k])
export const CATEGORY_PREFIX = (): string => L('分类：', 'Category:')

/** The hash of a Chinese page an English one records it was translated from (`source:`). */
export const sourceHash = (text: string): string => createHash('sha1').update(text.replace(/^﻿/, '').replace(/\r\n/g, '\n')).digest('hex').slice(0, 12)

/** Template names as the checks read them: in Chinese, whichever language the page wrote them in. */
const canonical = (body: string): string => body.replace(/\{\{\s*(\/?)\s*([^|{}]+?)\s*(?=[|}])/g, (m, slash: string, name: string) => {
  const zhName = TEMPLATE_EN[name.trim().toLowerCase().replace(/_/g, ' ')]
  return zhName ? `{{${slash}${zhName}` : m
})

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

/** The fixed skeleton of a page about a thing (格式手册: each kind's section order), in the edition's language. */
export function skeleton(e: Ent | undefined, type: string, extra = ''): string {
  const k = e?.kind
  const en = lang() === 'en'
  const head = en
    ? `---\n${extra}summary: \n---\n`
    : `---\n类型: ${type}\n${e ? `对象: ${e.id}\n` : ''}摘要: \n---\n`
  const h = (zhName: string, enName: string) => `## ${L(zhName, enName)}`
  const t = (zhName: string, arg = '') => {
    const name = en ? Object.entries(TEMPLATE_EN).find(([, z]) => z === zhName)?.[0] ?? zhName : zhName
    return `{{${name}${arg ? `|${arg}` : ''}}}`
  }
  const lead = (name: string) => `**${name}**${L('是……', ' is…')}`
  if (k === 'person' || k === 'companion') return `${head}${t('信息框')}\n${t('引言', L(`一句代表性的台词|${e!.name}`, `a line that is like them|${e!.name}`))}\n${lead(e!.name)}\n\n${h('日程表', 'Schedule')}\n${t('日程表')}\n\n${h('人际关系', 'Relationships')}\n${t('人际关系')}\n\n${h('对话', 'Dialogue')}\n${t('对话')}\n\n${h('任务', 'Quests')}\n${t('相关任务')}\n\n${h('肖像', 'Portrait')}\n${t('肖像')}\n\n${h('设定', 'Background')}\n\n${h('趣闻', 'Trivia')}\n\n${h('历史', 'History')}\n\n${t('导航框', L('居民', 'residents'))}\n`
  if (k === 'item' || k === 'fixture' || k === 'structure') return `${head}${t('信息框')}\n${lead(e!.name)}\n\n${h('来源', 'Sources')}\n${t('来源')}\n\n${h('用途', 'Uses')}\n${t('用途')}\n\n${h('制作', 'Crafting')}\n${t('配方')}\n${k === 'item' ? `\n${h('变体', 'Variants')}\n${t('变体')}\n` : ''}\n${h('趣闻', 'Trivia')}\n\n${h('历史', 'History')}\n\n${t('导航框', k === 'item' ? L('物品', 'items') : L('设施', 'fixtures'))}\n`
  if (k === 'creature') return `${head}${t('信息框')}\n${lead(e!.name)}\n\n${h('出没', 'Habitat')}\n${t('出没')}\n\n${h('行为', 'Behavior')}\n\n${h('策略', 'Strategy')}\n\n${h('掉落', 'Drops')}\n${t('掉落')}\n\n${h('历史', 'History')}\n\n${t('导航框', L('怪物', 'monsters'))}\n`
  if (k === 'boss') return `${head}${t('信息框')}\n${lead(e!.name)}\n\n${h('出没', 'Habitat')}\n${t('出没')}\n\n${h('技能', 'Skills')}\n${t('首领技能')}\n\n${h('行为', 'Behavior')}\n\n${h('策略', 'Strategy')}\n\n${h('掉落', 'Drops')}\n${t('掉落')}\n\n${h('设定', 'Background')}\n\n${h('历史', 'History')}\n\n${t('导航框', L('怪物', 'monsters'))}\n`
  if (k === 'map') return `${head}${t('信息框')}\n${lead(e!.name)}\n\n${h('地图', 'Map')}\n${t('地图')}\n\n${h('区域', 'Areas')}\n\n${h('居民', 'Residents')}\n${t('居民')}\n\n${h('生物', 'Creatures')}\n${t('生物')}\n\n${h('物品与资源', 'Items and resources')}\n${t('物品分布')}\n\n${h('相连地点', 'Connections')}\n${t('相连地点')}\n\n${h('设定', 'Background')}\n\n${h('历史', 'History')}\n\n${t('导航框', L('地点', 'locations'))}\n`
  if (k === 'quest') return `${head}${t('信息框')}\n${lead(e!.name)}\n\n${h('目标', 'Objectives')}\n${t('任务目标')}\n\n${h('流程', 'Walkthrough')}\n\n${h('奖励', 'Rewards')}\n${t('任务奖励')}\n\n${h('对话', 'Dialogue')}\n${t('任务对话')}\n\n${h('历史', 'History')}\n\n${t('导航框', L('任务', 'quests'))}\n`
  return `${head}${L('一句话说明这是什么。', 'One sentence on what this is.')}\n\n${h('规则', 'Rules')}\n\n${h('历史', 'History')}\n\n`
}

/** What a generated page says before anyone writes it. */
function generatedBody(g: Game, e: Ent): string {
  const lead = (() => {
    switch (e.kind) {
      case 'item': case 'fixture': case 'structure': {
        const it = e as ItemEnt
        return L(
          `**${e.name}**（${it.en}）是游戏里的一种${it.kind === 'structure' ? '[[建筑件]]' : it.kind === 'fixture' ? `设施（${it.groupName}）` : `物品（${it.groupName}）`}。`,
          `**${e.name}** is ${it.kind === 'structure' ? 'a [[建筑件|structure]]' : it.kind === 'fixture' ? `a fixture (${it.groupName.toLowerCase()})` : `an item (${it.groupName.toLowerCase()})`} in the game.`,
        )
      }
      case 'person': {
        const home = (e as any).home ? g.mapOf((e as any).home)?.title : undefined
        return L(`**${e.name}**是${home ? `住在[[${home}]]的` : '只在剧情中出场的'}${(e as any).roleName}。`, `**${e.name}** is ${home ? `a ${(e as any).roleName} who lives in [[${home}]]` : `a ${(e as any).roleName} who appears only in the story`}.`)
      }
      case 'companion': return L(`**${e.name}**是一路跟着玩家的同伴。`, `**${e.name}** is the companion who follows the player all the way.`)
      case 'creature': return L(`**${e.name}**是一种[[怪物]]（${e.groupName}）。`, `**${e.name}** is a [[怪物|monster]] (${e.groupName}).`)
      case 'boss': return L(`**${e.name}**是一位[[首领]]。`, `**${e.name}** is a [[首领|boss]].`)
      case 'map': return L(`**${e.name}**是游戏里的一处[[地点]]。`, `**${e.name}** is a [[地点|location]] in the game.`)
      case 'quest': return L(`**${e.name}**是一个[[任务]]。`, `**${e.name}** is a [[任务|quest]].`)
    }
  })()
  return skeleton(e, TYPE_OF_KIND[e.kind]).replace(/^---[\s\S]*?---\n/, '').replace(/\*\*[^*]+\*\*(是……| is…)/, lead ?? '') + `\n{{${L('小作品', 'stub')}}}\n`
}

/** A page's text without its code (examples of templates in the help pages are not uses of them). */
export const scanText = (body: string) => body.replace(/^```[^\n]*\n[\s\S]*?\n```\s*$/gm, '').replace(/`[^`\n]+`/g, '')

const STATUS_BANNER: Record<string, string> = { 规划中: '{{规划中}}', 待设计: '{{待设计}}' }

export function buildSite(opts: { ref?: string; lang?: Lang; zh?: Built } = {}): Built {
  const edition: Lang = opts.lang ?? 'zh'
  if (edition === 'en' && !opts.zh) throw new Error('the English edition is built after the Chinese one')
  setLang(edition)
  const game = loadGame()
  const tr: Translations = JSON.parse(readFileSync(edition === 'en' ? join(WIKI, 'en', 'terms.json') : join(WIKI, '译名.json'), 'utf8'))
  const conf: SiteConf = JSON.parse(readFileSync(join(WIKI, 'site.json'), 'utf8'))
  if (edition === 'en') {
    const en: SiteConfEn = JSON.parse(readFileSync(join(WIKI, 'en', 'site.json'), 'utf8'))
    const head = (h: string) => en.headings[h] ?? h
    conf.站名 = en.name
    conf.侧边栏 = conf.侧边栏.map((s) => ({ ...s, 标题: head(s.标题) }))
    conf.门户 = conf.门户.map((s) => ({ ...s, 标题: head(s.标题) }))
  }
  const errors: string[] = []
  const warnings: string[] = []
  const missingTr = new Map<string, Set<string>>()
  const pages = new Map<string, Page>()
  const commit = git(['rev-parse', '--short', 'HEAD']) || 'local'
  const ref = opts.ref || git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'main'
  const dirOf = PAGES[edition]
  const relDir = relative(ROOT, dirOf).split(sep).join('/')

  // ---- hand-written pages
  const bound = new Set<string>()
  const updated = new Map<string, string>()
  for (const line of git(['log', '--format=%x1e%ad', '--date=short', '--name-only', '--', relDir]).split('\x1e')) {
    const [date, ...files] = line.trim().split('\n')
    for (const f of files) if (f && !updated.has(f)) updated.set(f, date)
  }
  const professionName = (id?: string) => {
    const p = game.professions.find((x) => x.id === id) ?? game.branches.find((x) => x.id === id)
    return p ? say(p.name) : undefined
  }
  const addHand = (file: string | undefined, path: string, front: Front, body: string, fe: string[], extra: Partial<Page> = {}) => {
    const rel = file ? relative(ROOT, file).split(sep).join('/') : undefined
    const where = rel ?? `${relDir}/${path}.md`
    const name = path.split('/').pop()!
    const dir = path.split('/').slice(0, -1).join('/')
    let ent: Ent | undefined
    if (front.对象) {
      ent = game.byId.get(front.对象)
      const known = game.professions.some((p) => p.id === front.对象) || game.branches.some((b) => b.id === front.对象)
      if (!ent && !known) errors.push(`${where}：${L('对象', 'object')}「${front.对象}」${L('在游戏里不存在', ' is not in the game')}`)
      else if (ent && bound.has(ent.id)) errors.push(`${where}：${L('对象', 'object')}「${front.对象}」${L('已经有另一个页面', ' already has another page')}`)
      else if (ent) bound.add(ent.id)
    }
    const type0 = front.类型 ? TYPE_ZH[front.类型.toLowerCase()] ?? front.类型 : undefined
    const type = type0 ?? (ent ? TYPE_OF_KIND[ent.kind] : '系统')
    if (!TYPES.has(type)) errors.push(`${where}：${L('类型', 'type')}「${type}」${L('不认识', ' is unknown')}`)
    const title = ent ? ent.title : (front.标题 ?? professionName(front.对象) ?? (edition === 'en' && extra.source ? extra.source.title : name))
    if (ent && front.标题 && front.标题 !== ent.title) warnings.push(`${where}：${L(`写游戏对象的页面，标题跟着游戏里的名字（${ent.title}），开头的「标题」不起作用`, `a page about a game thing takes its title from the game (${ent.title}); its “title” is ignored`)}`)
    if (pages.has(title)) { errors.push(`${where}：${L('标题', 'title')}「${title}」${L('和', ' clashes with ')} ${pages.get(title)!.file ?? pages.get(title)!.title}${L(' 重复', '')}`); return }
    const status = front.状态 ? STATUS_ZH[front.状态.toLowerCase()] ?? front.状态 : '已实现'
    const scan = scanText(canonical(body))
    pages.set(title, {
      key: ent ? `e:${ent.id}` : `p:${path}`, title, type, ent, dir, file: rel, front, body, scan, status, categories: front.分类, aliases: front.别名, summary: front.摘要,
      navboxes: new Set(), stub: /\{\{\s*小作品\s*\}\}/.test(scan), html: '', headings: [], out: [], errors: fe.map((x) => `${where}：${x}`), updated: rel ? updated.get(rel) : undefined,
      ...extra,
    })
  }
  const zhBuilt = opts.zh
  if (edition === 'zh') {
    for (const file of walk(dirOf)) {
      const { front, body, errors: fe } = parseFront(readFileSync(file, 'utf8'))
      addHand(file, relative(dirOf, file).split(sep).join('/').replace(/\.md$/, ''), front, body, fe)
    }
  } else {
    // every Chinese page, translated or not; then the English pages no Chinese file stands behind
    const paired = new Set<string>()
    for (const src of zhBuilt!.pages.values()) {
      if (!src.file) continue
      const path = relative(PAGES.zh, join(ROOT, src.file)).split(sep).join('/').replace(/\.md$/, '')
      const file = join(dirOf, `${path}.md`)
      const zhText = readFileSync(join(ROOT, src.file), 'utf8')
      const inherit = { 类型: src.front.类型, 对象: src.front.对象, 状态: src.front.状态 }
      if (existsSync(file)) {
        paired.add(file)
        const { front, body, errors: fe } = parseFront(readFileSync(file, 'utf8'))
        const translation = front.source === sourceHash(zhText) ? 'current' : 'outdated'
        addHand(file, path, { ...front, ...Object.fromEntries(Object.entries(inherit).filter(([, v]) => v != null)) } as Front, body, fe, { source: src, translation })
      } else {
        // not yet translated: a thing's page as the game's data writes it, any other in Chinese, under its Chinese title
        const ent = src.ent
        const body = ent ? generatedBody(game, game.byId.get(ent.id) ?? ent) : src.body
        const extraFront = `title: ${ent ? '' : src.title}\nsource: ${sourceHash(zhText)}\n`.replace(/^title: \n/, '')
        addHand(undefined, path, { ...inherit, 分类: [], 别名: [] } as Front, body, [], {
          source: src, translation: 'missing', stub: !!ent, skeleton: `---\n${extraFront}summary: \n---\n${src.body}`,
        })
      }
    }
    for (const file of walk(dirOf)) {
      if (paired.has(file)) continue
      const { front, body, errors: fe } = parseFront(readFileSync(file, 'utf8'))
      const path = relative(dirOf, file).split(sep).join('/').replace(/\.md$/, '')
      if (!front.对象) warnings.push(`${relative(ROOT, file).split(sep).join('/')}: no Chinese page at wiki/pages/${path}.md — an English-only page`)
      addHand(file, path, front, body, fe)
    }
  }

  // ---- a page for every thing that has none
  const all: Ent[] = [...game.items, ...game.fixtures, ...game.structures, ...game.people, ...game.creatures, ...game.bosses, ...game.maps, ...game.quests]
  for (const e of all) {
    if (bound.has(e.id)) continue
    if (pages.has(e.title)) { errors.push(L(`「${e.title}」既是手写页面的标题，又是游戏里${e.kind}的名字：请在那个页面开头写「对象: ${e.id}」，或者给它换个标题`, `“${e.title}” is both a hand-written page's title and the name of a ${e.kind} in the game: give that page “object: ${e.id}”, or another title`)); continue }
    const body = generatedBody(game, e)
    pages.set(e.title, {
      key: `e:${e.id}`, title: e.title, type: TYPE_OF_KIND[e.kind], ent: e, dir: DIR_OF_KIND[e.kind], front: { 分类: [], 别名: [] }, body, scan: scanText(canonical(body)), status: '已实现',
      categories: [], aliases: [], navboxes: new Set(), stub: true, html: '', headings: [], out: [], errors: [],
      skeleton: skeleton(e, TYPE_OF_KIND[e.kind], edition === 'en' ? `object: ${e.id}\n` : ''),
    })
  }

  // ---- aliases and the special pages' titles
  const alias = new Map<string, string>()
  for (const p of pages.values()) for (const a of p.aliases) {
    if (pages.has(a)) { if (a !== p.title) warnings.push(`${p.file}：${L('别名', 'alias')}「${a}」${L('已经是别的页面的标题，这个别名不起作用', ' is already another page’s title and does nothing')}`); continue }
    if (alias.has(a) && alias.get(a) !== p.title) warnings.push(`${p.file}：${L('别名', 'alias')}「${a}」${L('和', ' clashes with the alias of ')}「${alias.get(a)}」${L('的别名重复', '')}`)
    else alias.set(a, p.title)
  }
  const byKeyNow = () => new Map([...pages.values()].map((p) => [p.key, p]))
  let byKey = byKeyNow()
  const specials = Object.keys(SPECIALS).map((k) => specialTitle(k))
  const catPrefix = CATEGORY_PREFIX()
  const resolve = (t: string): string | undefined => {
    if (pages.has(t)) return t
    if (alias.has(t)) return alias.get(t)
    if (specials.includes(t) || t.startsWith(catPrefix)) return t
    if (edition === 'en' && zhBuilt) {
      // a title's first letter in either case, as a wiki takes it ([[campfire]] is Campfire)
      const cap = t.charAt(0).toUpperCase() + t.slice(1)
      if (pages.has(cap)) return cap
      if (alias.has(cap)) return alias.get(cap)
      // a Chinese title, alias, special page or category: the same page here
      if (t.startsWith('分类：')) return catPrefix + category(t.slice(3))
      const sp = Object.values(SPECIALS).find(([z]) => z === t)
      if (sp) return sp[1]
      const zt = zhBuilt.resolve(t)
      const zp = zt ? zhBuilt.pages.get(zt) : undefined
      const here = zp ? byKey.get(zp.key) : undefined
      if (here) return here.title
    }
    return undefined
  }

  // navbox membership (a hand navbox lists the pages that carry it)
  // (by the name as written and by the page it names: pages may write it in either language)
  for (const p of pages.values()) for (const m of p.scan.matchAll(/\{\{\s*导航框\s*\|\s*([^}|]+?)\s*\}\}/g)) {
    p.navboxes.add(m[1])
    const r = resolve(m[1])
    if (r) p.navboxes.add(r)
  }

  // default categories
  for (const p of pages.values()) {
    const cats = new Set(p.categories)
    const e = p.ent
    if (e) {
      cats.add(category(({ item: '物品', fixture: '设施', structure: '建筑件', person: '居民', companion: '居民', creature: '怪物', boss: '首领', map: '地点', quest: '任务' } as Record<string, string>)[e.kind]))
      if (e.kind === 'item' || e.kind === 'fixture') cats.add(e.groupName)
      if (e.kind === 'quest') cats.add(category(({ main: '主线任务', side: '支线任务', favor: '委托任务', guide: '指引任务' } as Record<string, string>)[(e as any).def.kind]))
      if (e.kind === 'creature') cats.add(e.groupName)
    } else cats.add(category(({ 系统: '玩法', 设定: '世界观', 章节: '剧情', 列表: '列表', 帮助: '帮助' } as Record<string, string>)[p.type] ?? p.type))
    if (p.stub) cats.add(category('待完善'))
    if (p.status !== '已实现') cats.add(category(p.status))
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
    const where = p.file ?? `${L('（自动生成）', '(generated) ')}${p.title}`
    const ctx: Ctx = {
      g: game, tr, page: p, pages,
      has: (t) => { const r = resolve(t); return !!r && pages.has(r) },
      link: (target, text) => {
        const [t0, anchor] = target.split('#')
        const t = t0 ? resolve(t0.trim()) : p.title
        p.out.push({ title: t ?? t0.trim(), anchor: anchor?.trim() })
        // a link written in the other language reads in this one
        const written = t0 ? t0.trim() : anchor ?? ''
        const crossed = edition === 'en' && t && t0 && !pages.has(t0.trim()) && !alias.has(t0.trim()) && /[㐀-鿿]/.test(t0)
        const label = escapeHtml(text ?? (crossed ? (t!.startsWith(catPrefix) ? t!.slice(catPrefix.length) : t!) : written))
        if (!t) {
          if (!redLinks.has(t0.trim())) redLinks.set(t0.trim(), new Set())
          redLinks.get(t0.trim())!.add(p.title)
          return `<a class="new" href="${newFileHref(conf, ref, t0.trim(), '系统', undefined)}" title="${escapeAttr(t0)}${L('（页面还不存在，点这里新建）', ' (no such page yet: click to create it)')}">${label}</a>`
        }
        return `<a href="${linkHref(t)}${anchor ? '#' + encodeURIComponent(slug(anchor)) : ''}"${t !== t0 && t0 ? ` title="${escapeAttr(t)}"` : ''}>${label}</a>`
      },
      inline: (md) => inline(md, hooks),
      error: (msg) => errs.push(`${where}：${msg}`),
      missing: (section, key) => { if (!missingTr.has(section)) missingTr.set(section, new Set()); missingTr.get(section)!.add(key) },
      history,
      values: () => `<table class="wikitable sortable"><thead><tr><th>${L('名字', 'Name')}</th><th>${L('值', 'Value')}</th><th>${L('含义', 'Meaning')}</th><th>${L('代码', 'Code')}</th></tr></thead><tbody>${Object.entries(game.values).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v.value)}</td><td>${esc(v.note)}</td><td><small>${esc(v.source)}</small></td></tr>`).join('')}</tbody></table>`,
      portal: () => portal(ctx, conf, game),
      include: (path) => {
        const f = join(ROOT, path)
        if (!existsSync(f) || !path.match(/^(docs|wiki)\/[^.]+\.md$/)) { errs.push(`${where}：{{原文|${path}}} ${L('找不到文件', 'finds no file')}`); return '' }
        return `<div class="original">${render(readFileSync(f, 'utf8').replace(/^#\s.*\n/, ''), hooks).html}</div>`
      },
    }
    const hooks = { template: (call: any) => runTemplate(ctx, call), link: (t: string, x?: string) => ctx.link(t, x) }
    const banner = STATUS_BANNER[p.status] && !p.scan.includes(STATUS_BANNER[p.status]) ? STATUS_BANNER[p.status] + '\n\n' : ''
    const r = render(banner + p.body, hooks)
    p.html = translationBanner(p) + r.html
    p.headings = r.headings
    p.errors.push(...errs)
  }
  for (const p of pages.values()) renderPage(p)

  // ---- checks: anchors, required data templates, completeness
  for (const p of pages.values()) {
    for (const l of p.out) {
      if (!l.anchor) continue
      const target = pages.get(l.title)
      if (target && !target.headings.some((h) => h.id === slug(l.anchor!)) && !target.html.includes(`id="${escapeAttr(slug(l.anchor!))}"`) && !target.html.includes(`id="${escapeAttr(l.anchor!)}"`)) p.errors.push(`${p.file ?? p.title}：[[${l.title}#${l.anchor}]] ${L('链到的小节不存在', 'links to a section that does not exist')}`)
    }
    if (p.ent && p.file && p.type === TYPE_OF_KIND[p.ent.kind]) {
      const need: Record<string, string[]> = {
        person: ['信息框', '日程表', '对话'], companion: ['信息框'], item: ['信息框', '来源', '用途'], fixture: ['信息框', '来源'], structure: ['信息框', '来源'],
        creature: ['信息框', '出没', '掉落', '怪物技能'], boss: ['信息框', '首领技能'], map: ['信息框', '地图', '相连地点'], quest: ['信息框', '任务目标', '任务奖励'],
      }
      for (const t of need[p.ent.kind] ?? []) if (!new RegExp(`\\{\\{\\s*${t}\\s*[|}]`).test(p.scan)) p.errors.push(`${p.file}：${L(`${TYPE_OF_KIND[p.ent.kind]}页面要包含 {{${t}}}`, `a ${TYPE_EN[TYPE_OF_KIND[p.ent.kind]]} page needs {{${Object.entries(TEMPLATE_EN).find(([, z]) => z === t)?.[0] ?? t}}}`)}`)
    }
  }
  const coverage = edition === 'zh' ? completeness(game, conf, pages, resolve, errors) : translationReport(pages)
  for (const p of pages.values()) errors.push(...p.errors)

  const built: Built = { lang: edition, pages, byKey, game, conf, errors, warnings, missingTr, redLinks, ref, commit, builtAt: new Date().toISOString().slice(0, 16).replace('T', ' '), coverage, resolve }
  addSpecialPages(built, renderPage)
  built.byKey = byKey = byKeyNow()
  return built
}

/** What the English reader is told about a page's translation. */
function translationBanner(p: Page): string {
  if (lang() !== 'en' || !p.source) return ''
  const zhHref = linkHref(p.source.title, 'zh')
  if (p.translation === 'missing') return `<div class="banner untranslated">This page has not been translated yet.${p.ent ? ' What follows is what the game’s own data says; the' : ' It is shown in the original; the'} <a href="${zhHref}" lang="zh">Chinese page</a> is the source. <a href="#edit" class="edit-link">Translate it</a>.</div>`
  if (p.translation === 'outdated') return `<div class="banner outdated">The <a href="${zhHref}" lang="zh">Chinese page</a> has changed since this translation was made: some of this may be out of date.</div>`
  return ''
}

/** Every thing, every system, every table has a page: what is missing fails the build (the Chinese edition: the source). */
function completeness(g: Game, conf: SiteConf, pages: Map<string, Page>, resolve: (t: string) => string | undefined, errors: string[]): string {
  const rows: string[] = []
  const check = (what: string, page: string | undefined, ok: boolean, note = '') => {
    rows.push(`<tr class="${ok ? 'ok' : 'bad'}"><td>${esc(what)}</td><td>${page ? `<a href="${linkHref(page)}">${esc(page)}</a>` : '—'}</td><td>${ok ? '✓' : '✗'}</td><td>${esc(note)}</td></tr>`)
    if (!ok) errors.push(`完备性：${what}${page ? `（应在「${page}」）` : ''}没有页面${note ? `：${note}` : ''}`)
  }
  const body = (t: string) => pages.get(resolve(t) ?? '')?.scan ?? ''
  for (const [k, t] of Object.entries(conf.系统.按键)) check(`按键 ${k}`, t, !!resolve(t))
  for (const [k, t] of Object.entries(conf.系统.面板)) check(`面板 ${k}`, t, !!resolve(t))
  for (const t of conf.系统.规则) check(`系统 ${t}`, t, !!resolve(t) && !pages.get(resolve(t)!)!.stub, resolve(t) ? (pages.get(resolve(t)!)!.stub ? '还是小作品' : '') : '')
  const allBodies = [...pages.values()].map((p) => p.scan).join('\n')
  for (const b of g.branches) check(`技能分支 ${b.name.zh}`, '技能', allBodies.includes(`{{技能树|${b.name.zh}}}`) || allBodies.includes(`{{技能树|${b.id}}}`), '要有 {{技能树|…}}')
  for (const p of g.professions) check(`职业 ${p.name.zh}`, p.name.zh, !!resolve(p.name.zh))
  for (const t of ['配方表', '建造表', '状态表', '地形表', '材质表', '品质表', '食物表', '作物表', '首领表', '怪物表', '居民表', '地点表', '传送雕像表', '夜行生物表', '恩赐表', '职业表', '房间用途表', '效率表', '传说武器表', '圣痕之力表', '货摊表', '价格表']) check(`数据表 {{${t}}}`, undefined, allBodies.includes(`{{${t}`), '要在某个页面上出现')
  for (const k of ['main', 'side', 'repeat']) check(`任务表（${k}）`, '任务', /\{\{任务表(\|(主线|支线|重复))?\}\}/.test(body('任务')) || allBodies.includes('{{任务表}}'))
  const kinds: [string, Ent[]][] = [['物品', g.items], ['设施', g.fixtures], ['建筑件', g.structures], ['人物', g.people], ['怪物', g.creatures], ['首领', g.bosses], ['地点', g.maps], ['任务', g.quests]]
  for (const [k, list] of kinds) {
    const written = list.filter((e) => [...pages.values()].some((p) => p.ent === e && p.file && !p.stub)).length
    rows.push(`<tr class="${written === list.length ? 'ok' : 'part'}"><td>${k}</td><td>${list.length} 个，都有页面</td><td>✓</td><td>${written} 个有手写正文，${list.length - written} 个还是自动生成的小作品</td></tr>`)
  }
  return `<table class="wikitable coverage"><thead><tr><th>项目</th><th>页面</th><th>状态</th><th>说明</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
}

/** How the English edition stands against the Chinese: translated, out of date, not yet translated. */
function translationReport(pages: Map<string, Page>): string {
  const of = (s: Page['translation']) => [...pages.values()].filter((p) => p.source && p.translation === s).sort((a, b) => a.title.localeCompare(b.title, 'en'))
  const list = (ps: Page[]) => (ps.length ? ps.map((p) => `<a href="${linkHref(p.title)}">${esc(p.title)}</a>`).join(' · ') : '—')
  const current = of('current'), outdated = of('outdated'), missing = of('missing')
  const total = current.length + outdated.length + missing.length
  return `<table class="wikitable coverage"><thead><tr><th>Translation</th><th>Pages</th><th>What to do</th></tr></thead><tbody>`
    + `<tr class="ok"><td>Up to date</td><td>${current.length} of ${total}</td><td>—</td></tr>`
    + `<tr class="${outdated.length ? 'part' : 'ok'}"><td>Out of date</td><td>${outdated.length}</td><td>The Chinese page changed after the translation: bring the English file up to date, then <code>npm run wiki:translate -- stamp &lt;file&gt;</code>.</td></tr>`
    + `<tr class="${missing.length ? 'part' : 'ok'}"><td>Not yet translated</td><td>${missing.length}</td><td>Write <code>wiki/en/pages/&lt;same path&gt;.md</code> (the page’s “Translate it” link starts one).</td></tr>`
    + `</tbody></table><h3>Out of date</h3><p>${list(outdated)}</p><h3>Not yet translated</h3><p>${list(missing)}</p>`
}

function portal(ctx: Ctx, conf: SiteConf, g: Game): string {
  const icon = (key: string) => {
    if (!key) return ''
    if (key.startsWith('skill:')) return `<span class="spr" style="width:32px;height:32px;background-image:url('/assets/lsw/skills/${key.slice(6)}.png');background-size:32px 32px"></span>`
    const e = g.byTitle.get(key) ?? (g.byName.get(key) ?? [])[0]
    return e ? fit(e.sprite, 32) : ''
  }
  // an icon named in site.json must be drawn: a name the game no longer has would leave a blank in its box
  const named = (t: string, i: string) => {
    const html = icon(i || t)
    if (i && !html) ctx.error(L(`门户：「${t}」的图标「${i}」在游戏里不存在`, `Portal: the icon "${i}" of "${t}" is not in the game`))
    return html
  }
  return `<div class="portal">${conf.门户.map((s) => `<section class="portal-box"><h3>${esc(s.标题)}</h3><ul>${s.条目.map(([t, i]) => `<li><span class="ico">${named(t, i)}</span>${ctx.link(t)}</li>`).join('')}</ul></section>`).join('')}</div>`
}

/** Where a new file for a page starts on GitHub: a Chinese page, or (in the English edition) a page's translation. */
export function newFileHref(conf: SiteConf, ref: string, title: string, type: string, e: Ent | undefined, dir = '', value?: string, name?: string): string {
  const d = dir || ({ 系统: '基本', 设定: '世界观' } as Record<string, string>)[type] || type
  const root = lang() === 'en' ? 'wiki/en/pages' : 'wiki/pages'
  const body = value ?? (lang() === 'en' && !e ? `---\ntitle: ${title}\nsummary: \n---\n` : skeleton(e, type, lang() === 'en' && e ? `object: ${e.id}\n` : ''))
  return `https://github.com/${conf.仓库}/new/${encodeURIComponent(ref)}/${root}/${encodeURIComponent(d)}?filename=${encodeURIComponent(name ?? (e ? e.zh : title))}.md&value=${encodeURIComponent(body)}`
}

function addSpecialPages(b: Built, renderPage: (p: Page) => void): void {
  const { pages } = b
  const add = (key: string, title: string, body: string, summary: string) => {
    const p: Page = { key, title, type: '列表', front: { 分类: [], 别名: [] }, body, scan: '', status: '已实现', categories: [], aliases: [], navboxes: new Set(), stub: false, html: '', headings: [], out: [], errors: [], special: true, summary }
    pages.set(title, p)
    renderPage(p)
    p.errors = []
  }
  const sort = (a: Page, c: Page) => a.title.localeCompare(c.title, b.lang)
  // recent changes: the edition's own commits
  const log = git(['log', '-n', '150', '--date=format:%Y-%m-%d %H:%M', '--format=%x1e%h%x1f%ad%x1f%an%x1f%s', '--name-only', '--', b.lang === 'en' ? 'wiki/en/' : 'wiki/'])
  const rows = log.split('\x1e').filter((x) => x.trim()).map((r) => {
    const [head, ...files] = r.trim().split('\n')
    const [hash, date, author, subject] = head.split('\x1f')
    const touched = files.filter(Boolean).map((f) => {
      const t = [...pages.values()].find((p) => p.file === f)
      return t ? `<a href="${linkHref(t.title)}">${esc(t.title)}</a>` : `<code>${esc(f.replace(/^wiki\//, ''))}</code>`
    })
    return `<tr><td>${esc(date)}</td><td>${esc(author)}</td><td>${esc(subject)}</td><td>${touched.join(L('、', ', '))}</td><td><a href="https://github.com/${b.conf.仓库}/commit/${hash}">${hash}</a></td></tr>`
  })
  add('s:最近更改', specialTitle('最近更改'), L(
    `维基源文件（仓库的 \`wiki/\` 目录）最近的改动，新的在前。游戏数据的改动会直接反映在各页面的数据表里，不列在这里；见[[版本历史]]。`,
    `The latest changes to the English pages (\`wiki/en/\` in the repository), newest first. Changes to the game's data show in the pages' tables directly and are not listed here; see [[版本历史]].`,
  ) + `\n\n<table class="wikitable"><thead><tr><th>${L('时间', 'Time')}</th><th>${L('作者', 'Author')}</th><th>${L('说明', 'Message')}</th><th>${L('页面', 'Pages')}</th><th>${L('提交', 'Commit')}</th></tr></thead><tbody>${rows.join('') || `<tr><td colspan="5">${L('还没有提交记录。', 'No commits yet.')}</td></tr>`}</tbody></table>`, L('维基最近的改动', 'Recent changes to the wiki'))
  // stubs and red links
  const stubs = [...pages.values()].filter((p) => p.stub).sort(sort)
  const typeName = (t: string) => L(t, TYPE_EN[t] ?? t)
  const byType = new Map<string, Page[]>()
  for (const p of stubs) { if (!byType.has(p.type)) byType.set(p.type, []); byType.get(p.type)!.push(p) }
  const red = [...b.redLinks].sort((a, c) => c[1].size - a[1].size)
  const sepr = L('、', ', ')
  add('s:待完善', specialTitle('待完善'), `${L('这里列出还没写完的页面（带「小作品」标记的），以及别的页面链过去、但还不存在的页面。挑一个，点进去按「编辑」就能补。', 'Pages not finished yet (marked as stubs), and pages other pages link to that do not exist yet. Pick one, open it and press “Edit”.')}\n\n## ${L('还不存在的页面', 'Pages that do not exist yet')}\n\n${red.length ? red.map(([t, from]) => `- [[${t}]]${L(`（被 ${[...from].slice(0, 6).map((f) => `[[${f}]]`).join(sepr)}${from.size > 6 ? ` 等 ${from.size} 页` : ''}链到）`, ` (linked from ${[...from].slice(0, 6).map((f) => `[[${f}]]`).join(sepr)}${from.size > 6 ? ` and ${from.size - 6} more` : ''})`)}`).join('\n') : L('没有。', 'None.')}\n\n## ${L('小作品', 'Stubs')}\n\n${L(`共 ${stubs.length} 页。`, `${stubs.length} pages.`)}\n\n${[...byType].map(([t, ps]) => `### ${typeName(t)}${L(`（${ps.length}）`, ` (${ps.length})`)}\n\n${ps.map((p) => `[[${p.title}]]`).join(' · ')}`).join('\n\n')}\n`, L('还没写完的页面', 'Pages not finished yet'))
  // all pages
  const all = [...pages.values()].filter((p) => !p.special).sort(sort)
  const groups = new Map<string, Page[]>()
  for (const p of all) { if (!groups.has(p.type)) groups.set(p.type, []); groups.get(p.type)!.push(p) }
  add('s:所有页面', specialTitle('所有页面'), `${L(`本站共 ${all.length} 页。`, `The wiki has ${all.length} pages.`)}\n\n${[...groups].map(([t, ps]) => `## ${typeName(t)}${L(`（${ps.length}）`, ` (${ps.length})`)}\n\n${ps.map((p) => `[[${p.title}]]`).join(' · ')}`).join('\n\n')}\n`, L('所有页面', 'All pages'))
  add('s:数值', specialTitle('数值'), `${L('`{{数值|名字}}` 能用的数值。它们在构建时从游戏代码里读出来，代码改了，这里和所有用到它们的页面一起变。', 'The values `{{value|name}}` can show. They are read from the game’s code when the wiki is built: when the code changes, so do this page and every page that uses them.')}\n\n{{数值表}}\n`, L('代码里的数值', 'Values from the code'))
  const list = (xs: string[]) => (xs.length ? xs.map((e) => `- ${escapeHtml(e)}`).join('\n') : L('没有。', 'None.'))
  if (b.lang === 'zh') add('s:完备性', specialTitle('完备性'), `维基要包含游戏的全部内容。每次构建都会检查下表：有一项不满足，仓库的自动检查（合并请求上的 wiki 检查）就不通过；网站照常更新，缺的项目在这里标红。链接、模板写错则会让服务器保留上一个版本。\n\n<div class="coverage-box">${b.coverage}</div>\n\n## 构建时的错误\n\n${list(b.errors)}\n\n## 提醒\n\n${list(b.warnings)}\n\n## 缺译名\n\n游戏数据里只有英文的词，在 \`wiki/译名.json\` 里补上中文：\n\n${[...b.missingTr].map(([s, ks]) => `- ${s}：${[...ks].map((k) => `\`${k}\``).join('、')}`).join('\n') || '没有。'}\n`, '完备性检查')
  else add('s:完备性', specialTitle('完备性'), `The Chinese edition is the source and is checked for completeness (every thing and system of the game has a page: see its <a href="${linkHref(SPECIALS.完备性[0], 'zh')}" lang="zh">completeness page</a>). The English edition follows it page by page; this is how far it has got.\n\n<div class="coverage-box">${b.coverage}</div>\n\n## Errors\n\n${list(b.errors)}\n\n## Warnings\n\n${list(b.warnings)}\n\n## Missing terms\n\nWords of the game's data the English term table lacks: add them to \`wiki/en/terms.json\`.\n\n${[...b.missingTr].map(([s, ks]) => `- ${s}: ${[...ks].map((k) => `\`${k}\``).join(', ')}`).join('\n') || 'None.'}\n`, 'Completeness and translation')
  add('s:随机页面', specialTitle('随机页面'), `<p id="random-go">${L('正在跳转……', 'Going…')}</p>`, L('随机打开一页', 'Open a random page'))
  add('s:搜索', specialTitle('搜索'), `<div id="search-results"></div>`, L('搜索', 'Search'))
  // category pages
  const cats = new Map<string, Page[]>()
  for (const p of pages.values()) for (const c of p.categories) { if (!cats.has(c)) cats.set(c, []); cats.get(c)!.push(p) }
  for (const [c, ps] of cats) {
    const sorted = ps.sort(sort)
    add(`c:${c}`, CATEGORY_PREFIX() + c, `${L(`这个分类下有 ${sorted.length} 页。`, `This category has ${sorted.length} pages.`)}\n\n<ul class="catlist">${sorted.map((p) => `<li><a href="${linkHref(p.title)}">${esc(p.title)}</a></li>`).join('')}</ul>\n`, CATEGORY_PREFIX() + c)
  }
}

/** Each page of one edition told where it is in the other. */
export function pairEditions(a: Built, b: Built): void {
  for (const [x, y] of [[a, b], [b, a]] as const) for (const p of x.pages.values()) {
    const q = y.byKey.get(p.key)
    if (q) p.other = linkHref(q.title, y.lang)
  }
}

export const pageSummary = (p: Page): string => p.summary || plain(p.html).slice(0, 120)
export { zh, type MapEnt }
