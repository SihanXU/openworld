// One page as HTML: a MediaWiki-shaped frame (sidebar, tabs, search, infobox right, contents box,
// categories, footer) in the game's own colours, in the edition's language, with a way to the other edition.

import { BASE, L } from './lang.ts'
import { escapeAttr, escapeHtml as esc } from './markup.ts'
import { CATEGORY_PREFIX, TYPE_EN, newFileHref, pageSummary, specialTitle, type Built, type Page } from './site.ts'
import { linkHref } from './templates.ts'

const TYPE_LABEL: Record<string, string> = { 系统: '玩法', 人物: '人物', 物品: '物品', 怪物: '怪物', 首领: '首领', 地点: '地点', 任务: '任务', 设定: '世界观', 章节: '剧情', 列表: '列表', 帮助: '帮助' }
const TYPE_LABEL_EN: Record<string, string> = { 系统: 'Gameplay', 人物: 'Person', 物品: 'Item', 怪物: 'Monster', 首领: 'Boss', 地点: 'Location', 任务: 'Quest', 设定: 'Lore', 章节: 'Story', 列表: 'List', 帮助: 'Help' }

function toc(p: Page): string {
  const hs = p.headings.filter((h) => h.level <= 3)
  if (hs.length < 3 || p.special) return ''
  let n2 = 0, n3 = 0
  const items = hs.map((h) => {
    const num = h.level === 2 ? `${++n2}` : `${n2}.${++n3}`
    if (h.level === 2) n3 = 0
    return `<li class="toc-l${h.level}"><a href="#${encodeURIComponent(h.id)}"><span class="tocnum">${num}</span> ${esc(h.text)}</a></li>`
  })
  return `<nav class="toc"><div class="toc-title">${L('目录', 'Contents')}</div><ol>${items.join('')}</ol></nav>`
}

/** The contents box goes after the lead (before the first ## heading), as on MediaWiki. */
function withToc(p: Page): string {
  const t = toc(p)
  if (!t) return p.html
  const i = p.html.search(/<h2[ >]/)
  return i < 0 ? p.html + t : p.html.slice(0, i) + t + p.html.slice(i)
}

export function pageHtml(b: Built, p: Page): string {
  const { conf, ref, commit } = b
  const en = b.lang === 'en'
  const repo = conf.仓库
  const isHome = p.key === 'p:首页'
  const home = BASE[b.lang]
  const zhFileName = p.source?.file?.split('/').pop()?.replace(/\.md$/, '')
  const editHref = p.file
    ? `https://github.com/${repo}/edit/${encodeURIComponent(ref)}/${p.file.split('/').map(encodeURIComponent).join('/')}`
    : p.special ? '' : p.translation === 'missing' ? newFileHref(conf, ref, p.title, p.type, p.ent, p.dir, p.skeleton, zhFileName) : newFileHref(conf, ref, p.title, p.type, p.ent, p.dir)
  const editLabel = p.file ? L('编辑', 'Edit') : p.translation === 'missing' ? 'Translate' : L('创建', 'Create')
  const histHref = p.file ? `https://github.com/${repo}/commits/${encodeURIComponent(ref)}/${p.file.split('/').map(encodeURIComponent).join('/')}` : ''
  const talkHref = `https://github.com/${repo}/issues?q=${encodeURIComponent(`is:issue label:wiki "${p.title}"`)}`
  const newTalk = `https://github.com/${repo}/issues/new?labels=wiki&title=${encodeURIComponent(`${L('[维基]', '[wiki]')} ${p.title}`)}&body=${encodeURIComponent(`${L('页面', 'Page')}: http://35.239.4.44:5175${linkHref(p.title)}\n\n`)}`
  const navTitle = (t: string) => b.resolve(t) ?? t
  const navLabel = (t: string) => { const r = navTitle(t); return r.replace(/^特殊：|^Special:/, '') }
  const side = conf.侧边栏.map((s) => `<nav class="portlet"><h3>${esc(s.标题)}</h3><ul>${s.链接.map((t) => `<li><a href="${t === '首页' ? home : linkHref(navTitle(t))}">${esc(t === '首页' ? L('首页', 'Main page') : navLabel(t))}</a></li>`).join('')}</ul></nav>`).join('')
  const catPrefix = CATEGORY_PREFIX()
  const cats = p.categories.length && !p.special ? `<div class="catlinks">${L('分类：', 'Categories: ')}${p.categories.map((c) => `<a href="${linkHref(catPrefix + c)}">${esc(c)}</a>`).join(' | ')}</div>` : ''
  const generated = !p.file && !p.special && p.translation !== 'missing' ? `<div class="banner gen">${L('这一页由游戏数据自动生成。点「编辑」会新建它的文件，骨架已经填好，补上文字即可。', 'This page is generated from the game’s data. “Create” starts its file with the skeleton filled in: add the words.')}</div>` : ''
  const title = isHome ? conf.站名 : p.title
  const desc = escapeAttr(pageSummary(p))
  // the other edition: this page there, else its main page
  const otherHref = p.other ?? BASE[en ? 'zh' : 'en']
  const other = `<a class="tab lang" href="${otherHref}" hreflang="${en ? 'zh' : 'en'}" lang="${en ? 'zh' : 'en'}" title="${en ? '中文版' : 'English edition'}${p.other ? '' : en ? '（首页）' : ' (main page)'}">${en ? '中文' : 'English'}</a>`
  const typeLabel = en ? TYPE_LABEL_EN[p.type] ?? TYPE_EN[p.type] ?? p.type : TYPE_LABEL[p.type] ?? p.type
  return `<!doctype html>
<html lang="${en ? 'en' : 'zh-CN'}" data-base="${home}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}${isHome ? '' : ` - ${esc(conf.站名)}`}</title>
<meta name="description" content="${desc}">
${p.other ? `<link rel="alternate" hreflang="${en ? 'zh' : 'en'}" href="${p.other}">` : ''}
<link rel="icon" href="/assets/lsw/Items/CrownOfThorns.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Serif+SC:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/wiki/_/wiki.css?v=${commit}">
<script>try{var t=localStorage.getItem('wiki.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body class="${isHome ? 'home' : ''} type-${escapeAttr(p.type)}">
<div class="layout">
<aside class="sidebar" id="sidebar">
  <a class="logo" href="${home}"><img src="/assets/lsw/Items/CrownOfThorns.png" alt=""><span class="logo-text">OpenWorld<small>${L('中文维基', 'Wiki')}</small></span></a>
  ${side}
  <nav class="portlet"><h3>${L('游戏', 'Game')}</h3><ul><li><a href="/">${L('开始游戏', 'Play the game')}</a></li><li><a href="https://github.com/${repo}">${L('GitHub 仓库', 'GitHub repository')}</a></li><li><a href="${otherHref}" hreflang="${en ? 'zh' : 'en'}">${en ? '中文维基' : 'English wiki'}</a></li></ul></nav>
</aside>
<div class="main">
<header class="topbar">
  <button class="menu-btn" aria-label="${L('菜单', 'Menu')}" onclick="document.body.classList.toggle('nav-open')">☰</button>
  <div class="tabs left"><a class="tab sel" href="${linkHref(p.title)}">${p.special ? L('特殊页面', 'Special page') : L('页面', 'Page')}</a>${p.special ? '' : `<a class="tab" href="${talkHref}" title="${L('这一页的讨论（GitHub 议题）', 'Discussion of this page (GitHub issues)')}">${L('讨论', 'Talk')}</a><a class="tab tab-new" href="${newTalk}" title="${L('就这一页开一个新的讨论', 'Start a discussion of this page')}">＋</a>`}</div>
  <form class="search" action="${linkHref(specialTitle('搜索'))}" method="get" role="search"><input name="q" id="q" type="search" placeholder="${L('搜索 OpenWorld 维基', 'Search the OpenWorld Wiki')}" autocomplete="off" aria-label="${L('搜索', 'Search')}"><div class="suggest" id="suggest"></div></form>
  <div class="tabs right"><a class="tab sel" href="${linkHref(p.title)}">${L('阅读', 'Read')}</a>${editHref ? `<a class="tab" id="edit" href="${editHref}" title="${p.file ? L('在 GitHub 上编辑这一页', 'Edit this page on GitHub') : p.translation === 'missing' ? 'Translate this page on GitHub' : L('在 GitHub 上新建这一页', 'Create this page on GitHub')}">${editLabel}</a>` : ''}${histHref ? `<a class="tab" href="${histHref}">${L('查看历史', 'History')}</a>` : ''}${other}<button class="tab theme" id="theme" title="${L('切换明暗', 'Light or dark')}">◐</button></div>
</header>
<main class="content">
  ${isHome ? '' : `<h1 class="firstHeading">${esc(p.title)}</h1><div class="subtitle">${L(`来自${esc(conf.站名)}`, `From the ${esc(conf.站名)}`)}${p.special ? '' : ` · ${esc(typeLabel)}`}${p.updated ? ` · ${L('最后编辑于', 'last edited')} ${esc(p.updated)}` : ''}</div>`}
  ${generated}
  <div class="body">${withToc(p)}</div>
  ${cats}
</main>
<footer class="footer">
  <p>${L(
    `本站内容由 OpenWorld 项目组编写，数据表从游戏代码 <a href="https://github.com/${repo}/commit/${commit}">${esc(commit)}</a>（${esc(ref)}）生成于 ${esc(b.builtAt)}。`,
    `Written by the OpenWorld team and translated from the Chinese edition; the tables are generated from the game’s code <a href="https://github.com/${repo}/commit/${commit}">${esc(commit)}</a> (${esc(ref)}) at ${esc(b.builtAt)}.`,
  )}</p>
  <p>${L(
    `项目组成员都能在 GitHub 上编辑：见<a href="${linkHref(navTitle('编辑入门'))}">编辑入门</a>。游戏素材来自 Ninja Adventure（CC0）与项目自绘。`,
    `Everyone on the team can edit it on GitHub: see <a href="${linkHref(navTitle('编辑入门'))}">${esc(navTitle('编辑入门'))}</a>. Game art from Ninja Adventure (CC0) and the project's own.`,
  )}</p>
</footer>
</div>
</div>
<script src="/wiki/_/wiki.js?v=${commit}" defer></script>
</body>
</html>
`
}
