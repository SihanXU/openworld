// One page as HTML: a MediaWiki-shaped frame (sidebar, tabs, search, infobox right, contents box,
// categories, footer) in the game's own colours.

import { escapeAttr, escapeHtml as esc } from './markup.ts'
import { newFileHref, pageSummary, type Built, type Page } from './site.ts'
import { linkHref } from './templates.ts'

const TYPE_LABEL: Record<string, string> = { 系统: '玩法', 人物: '人物', 物品: '物品', 怪物: '怪物', 首领: '首领', 地点: '地点', 任务: '任务', 设定: '世界观', 章节: '剧情', 列表: '列表', 帮助: '帮助' }

function toc(p: Page): string {
  const hs = p.headings.filter((h) => h.level <= 3)
  if (hs.length < 3 || p.special) return ''
  let n2 = 0, n3 = 0
  const items = hs.map((h) => {
    const num = h.level === 2 ? `${++n2}` : `${n2}.${++n3}`
    if (h.level === 2) n3 = 0
    return `<li class="toc-l${h.level}"><a href="#${encodeURIComponent(h.id)}"><span class="tocnum">${num}</span> ${esc(h.text)}</a></li>`
  })
  return `<nav class="toc"><div class="toc-title">目录</div><ol>${items.join('')}</ol></nav>`
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
  const repo = conf.仓库
  const isHome = p.title === '首页'
  const editHref = p.file
    ? `https://github.com/${repo}/edit/${encodeURIComponent(ref)}/${p.file.split('/').map(encodeURIComponent).join('/')}`
    : p.special ? '' : newFileHref(conf, ref, p.title, p.type, p.ent, p.dir)
  const histHref = p.file ? `https://github.com/${repo}/commits/${encodeURIComponent(ref)}/${p.file.split('/').map(encodeURIComponent).join('/')}` : ''
  const talkHref = `https://github.com/${repo}/issues?q=${encodeURIComponent(`is:issue label:wiki "${p.title}"`)}`
  const newTalk = `https://github.com/${repo}/issues/new?labels=wiki&title=${encodeURIComponent(`[维基] ${p.title}`)}&body=${encodeURIComponent(`页面：http://35.239.4.44:5175${linkHref(p.title)}\n\n`)}`
  const side = conf.侧边栏.map((s) => `<nav class="portlet"><h3>${esc(s.标题)}</h3><ul>${s.链接.map((t) => `<li><a href="${t === '首页' ? '/wiki/' : linkHref(t)}">${esc(t.replace(/^特殊：/, ''))}</a></li>`).join('')}</ul></nav>`).join('')
  const cats = p.categories.length && !p.special ? `<div class="catlinks">分类：${p.categories.map((c) => `<a href="${linkHref('分类：' + c)}">${esc(c)}</a>`).join(' | ')}</div>` : ''
  const generated = !p.file && !p.special ? `<div class="banner gen">这一页由游戏数据自动生成。点「编辑」会新建它的文件，骨架已经填好，补上文字即可。</div>` : ''
  const title = isHome ? conf.站名 : p.title
  const desc = escapeAttr(pageSummary(p))
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}${isHome ? '' : ` - ${esc(conf.站名)}`}</title>
<meta name="description" content="${desc}">
<link rel="icon" href="/assets/lsw/Items/CrownOfThorns.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Serif+SC:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/wiki/_/wiki.css?v=${commit}">
<script>try{var t=localStorage.getItem('wiki.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body class="${isHome ? 'home' : ''} type-${escapeAttr(p.type)}">
<div class="layout">
<aside class="sidebar" id="sidebar">
  <a class="logo" href="/wiki/"><img src="/assets/lsw/Items/CrownOfThorns.png" alt=""><span class="logo-text">OpenWorld<small>中文维基</small></span></a>
  ${side}
  <nav class="portlet"><h3>游戏</h3><ul><li><a href="/">开始游戏</a></li><li><a href="https://github.com/${repo}">GitHub 仓库</a></li></ul></nav>
</aside>
<div class="main">
<header class="topbar">
  <button class="menu-btn" aria-label="菜单" onclick="document.body.classList.toggle('nav-open')">☰</button>
  <div class="tabs left"><a class="tab sel" href="${linkHref(p.title)}">${p.special ? '特殊页面' : '页面'}</a>${p.special ? '' : `<a class="tab" href="${talkHref}" title="这一页的讨论（GitHub 议题）">讨论</a><a class="tab tab-new" href="${newTalk}" title="就这一页开一个新的讨论">＋</a>`}</div>
  <form class="search" action="/wiki/${encodeURIComponent('特殊：搜索')}" method="get" role="search"><input name="q" id="q" type="search" placeholder="搜索 OpenWorld 维基" autocomplete="off" aria-label="搜索"><div class="suggest" id="suggest"></div></form>
  <div class="tabs right"><a class="tab sel" href="${linkHref(p.title)}">阅读</a>${editHref ? `<a class="tab" id="edit" href="${editHref}" title="${p.file ? '在 GitHub 上编辑这一页' : '在 GitHub 上新建这一页'}">${p.file ? '编辑' : '创建'}</a>` : ''}${histHref ? `<a class="tab" href="${histHref}">查看历史</a>` : ''}<button class="tab theme" id="theme" title="切换明暗">◐</button></div>
</header>
<main class="content">
  ${isHome ? '' : `<h1 class="firstHeading">${esc(p.title)}</h1><div class="subtitle">来自${esc(conf.站名)}${p.special ? '' : ` · ${esc(TYPE_LABEL[p.type] ?? p.type)}`}${p.updated ? ` · 最后编辑于 ${esc(p.updated)}` : ''}</div>`}
  ${generated}
  <div class="body">${withToc(p)}</div>
  ${cats}
</main>
<footer class="footer">
  <p>本站内容由 OpenWorld 项目组编写，数据表从游戏代码 <a href="https://github.com/${repo}/commit/${commit}">${esc(commit)}</a>（${esc(ref)}）生成于 ${esc(b.builtAt)}。</p>
  <p>项目组成员都能在 GitHub 上编辑：见<a href="${linkHref('编辑入门')}">编辑入门</a>。游戏素材来自 Ninja Adventure（CC0）与项目自绘。</p>
</footer>
</div>
</div>
<script src="/wiki/_/wiki.js?v=${commit}" defer></script>
</body>
</html>
`
}
