import '@openworld/runtime/src/styles.css'
import '@openworld/runtime/src/ui/game.css'
import '@openworld/runtime/src/ui/polish.css'
import {
  attributeRow, badge, button, checkbox, confirmDialog, createWindow, currency, element, emptyState, field, icon,
  input, itemGrid, itemSlot, materialRow, notification, progress, select, shortcut, slider, tabs,
  type UiWindow,
} from '@openworld/runtime/src/ui/components/index.ts'
import { ContextMenu } from '@openworld/runtime/src/ui/context-menu.ts'
import { locale } from '@openworld/runtime/src/ui/common.ts'
import { createQuestSample } from './ui-lab-quests.ts'
import './ui-lab.css'

// A development-only, simulation-free component workbench. It is not a build entry.
const root = document.querySelector<HTMLElement>('#lab')!
const params = new URLSearchParams(location.search)
const zh = params.get('lang') !== 'en'
document.documentElement.lang = zh ? 'zh-CN' : 'en'
locale.value = zh ? 'zh' : 'en'
const L = (en: string, cn: string) => zh ? cn : en
const popup = new ContextMenu()
let current: UiWindow | undefined
let selected = 0
const history: string[] = []
const log = (message: string) => { history.push(message); status.textContent = message }
const status = element('p', 'lab-status', [L('Choose a window to explore.', '选择一个窗口，查看组件与布局。')])
status.setAttribute('role', 'status')

const header = element('header', 'lab-header', [
  element('a', 'lab-brand', ['OpenWorld']),
  element('span', 'lab-subtitle', [L('Interface workshop', '界面工坊')]),
  element('a', 'lab-language', [zh ? 'English' : '中文']),
])
header.querySelector<HTMLAnchorElement>('.lab-brand')!.href = '/'
header.querySelector<HTMLAnchorElement>('.lab-language')!.href = zh ? '?lang=en' : '?lang=zh'
const intro = element('section', 'lab-intro', [element('h1', '', [L('A place for every adventure.', '让每一次冒险，都有章可循。')]), element('p', '', [L('Shared windows, familiar controls. Resize the browser to explore each layout.', '统一的窗口、熟悉的操作。调整浏览器大小，查看各组件如何随空间重排。')])])
const palette = element('div', 'lab-palette')
for (const [name, token] of [[L('Ink','深墨'), 'ink'], [L('Walnut','暖木'), 'frame'], [L('Paper','纸张'), 'paper'], [L('Inset','凹面'), 'inset'], [L('Brass','旧金'), 'gold'], [L('Moss','苔绿'), 'green']]) {
  const swatch = element('span', 'lab-swatch', [name]); swatch.style.setProperty('--swatch', `var(--ui-${token})`); palette.append(swatch)
}
const launchers = element('nav', 'lab-launchers')
for (const [id, en, cn, description] of [
  ['bag', 'Inventory', '背包与装备', '物品格、属性、双栏与堆叠布局'],
  ['quests', 'Journal', '任务日志', '列表详情、长文本与任务状态'],
  ['settings', 'Settings', '游戏设置', '表单、选择、音量与键盘焦点'],
  ['trade', 'Trading post', '旅途商店', '材料、价格、禁用与交易反馈'],
  ['components', 'Components', '基础组件', '按钮、页签、确认框与边缘菜单'],
]) {
  const launch = button({ label: L(en, cn), onClick: () => open(id) })
  launch.dataset.sample = id
  launch.append(element('small', '', [zh ? description : 'Open the interactive sample']))
  launchers.append(launch)
}
const states = element('section', 'lab-states', [element('h2', '', [L('Small details. One language.', '细节各有分工，风格始终一致。')]), element('div', 'lab-row', [button({ label: L('Continue','继续旅程'), tone: 'primary' }), button({ label: L('Back','返回') }), button({ label: L('Unavailable','暂不可用'), disabled: true }), badge(L('Tracked','追踪中'), 'good'), shortcut('Esc')]), progress(62,100,L('Experience','经验')), notification(L('Your progress has been saved.','旅途进度已保存。'),'good')])
root.append(header, intro, palette, launchers, states, status)

const items = [
  ['A well-worn sword','旧铁剑','Items/Weapons/Sword2/Sprite.png'],
  ['A traveller’s fishing rod','旅人的鱼竿','Items/Weapons/Fishing Rod/Sprite.png'],
  ['Oak hammer','橡木锤','Items/Weapons/Hammer/Sprite.png'],
  ['Amber ring','琥珀戒指','Ui/Skill Icon/Items & Weapon/Ring.png'],
  ['Leather boots','旅途短靴','Ui/Skill Icon/Items & Weapon/Boot.png'],
  ['A letter from the far bank','来自河对岸的一封长信','Ui/Skill Icon/Items & Weapon/Amulet.png'],
]
function itemArt(index: number): HTMLImageElement {
  const img = element('img'); img.src = `/assets/na/${items[index % items.length][2]}`; img.alt = ''; img.draggable = false; return img
}
function slots(): HTMLElement {
  const grid = itemGrid(Array.from({ length: 30 }, (_, i) => {
    const label = i < 12 ? L(items[i % items.length][0], items[i % items.length][1]) : L('Empty slot','空格子')
    const slot = itemSlot({ label, index: i, selected: i === selected, count: i < 12 ? i + 1 : 0, content: i < 12 ? itemArt(i) : undefined, onClick: () => { selected = i; grid.querySelectorAll<HTMLElement>('.ui-slot').forEach((n) => { n.classList.toggle('sel', n.dataset.index === String(i)); n.setAttribute('aria-pressed', String(n.dataset.index === String(i))) }); log(`${label} · ${i + 1}`) } })
    slot.addEventListener('contextmenu', (event) => { event.preventDefault(); popup.show(event.clientX,event.clientY, [[L('Use','使用'), () => log(label)], [L('Put down one','放下一个'), () => log(L('One item put down','已放下一个'))]]) })
    return slot
  }))
  return grid
}
function open(id: string): void {
  popup.close(); current?.destroy()
  if (id === 'quests') {
    const win = createQuestSample(() => { popup.close(); win.destroy(); current = undefined }, (tracked) => log(tracked ? L('Quest tracked','已追踪任务') : L('Quest untracked','已取消追踪')))
    current = win
    win.show()
    return
  }
  const titles: Record<string,string> = { bag: L('The traveller’s pack','旅人的行囊'), settings: L('Settings','游戏设置'), trade: L('The riverside trading post','渡口杂货铺'), components: L('The component chest','组件百宝箱') }
  const win = createWindow({ id: 'sample-window', title: titles[id], size: id === 'bag' ? 'lg' : 'md', onClose: () => { popup.close(); win.destroy(); current = undefined } })
  current = win
  win.surface.dataset.sample = id
  if (id === 'bag') {
    const card = element('section', 'cs')
    const stats = element('div', 'cs-stats', [attributeRow(L('Health','生命'), '40 / 40'), attributeRow(L('Attack','攻击'),'12'), attributeRow(L('Defence','防御'),'8'), attributeRow(L('Luck','幸运'),'+5%')])
    const figure = element('div', 'lab-figure', [icon('bag'), element('span', '', [L('The traveller','旅人')]), badge(L('Level 8','等级 8'),'good')])
    card.append(element('div','cs-head',[L('Character','角色装备')]), figure, stats)
    const side = element('section','inv-side',[element('div','lab-row',[element('h3','',[L('Pack','行囊')]),currency(128,L('coins','金币'))]),slots(),element('div','lab-row',[button({label:L('Organize','整理'),onClick:()=>log(L('Pack organized','行囊已整理'))}),button({label:L('Put down','放下'),disabled:true})]),element('p','inv-help ui-muted',[L('Click to select. Right-click for actions. Your items keep their order when the grid changes width.','点击选择，右键查看操作。窗口变窄时，物品格会重排，物品顺序保持一致。')])])
    win.body.append(element('div','inv-wrap',[card,side]))
  } else if (id === 'settings') {
    win.body.append(element('div','options',[
      field(L('Traveller’s name','旅人的名字'),input(L('Rowan','罗文'),(v)=>log(v))),
      field(L('Language','语言'),select([{value:'zh',label:'简体中文'},{value:'en',label:'English'}],zh?'zh':'en',()=>{})),
      field(L('Music','音乐'),slider(65,(v)=>log(`${v}%`),L('Music volume','音乐音量'))),
      field(L('Service address','服务地址'),input('https://example.com/a/very/long/service/address',()=>{},'url')),
      checkbox(L('Show quest markers','显示任务标记'),true,()=>{}),
      checkbox(L('Reduce motion','减少动态效果'),false,(on)=>{ document.body.classList.toggle('lab-reduce-motion',on) }),
      element('p','ui-muted',[L('Changes are kept while the viewport is resized.','调整窗口尺寸时，当前输入和选择会保留。')]),
    ]))
    win.footer.append(button({label:L('Restore defaults','恢复默认')}),button({label:L('Save settings','保存设置'),tone:'primary',onClick:()=>log(L('Settings saved','设置已保存'))}))
  } else if (id === 'trade') {
    win.body.append(currency(128,L('coins carried','随身金币')))
    items.forEach((item,i)=>win.body.append(element('div','lab-product',[itemArt(i),element('div','',[element('h3','',[L(item[0],item[1])]),materialRow(L('In stock','库存'),i+1,1)]),button({label:L('Buy · 24','购买 · 24'),disabled:i===4,onClick:()=>log(L('Purchased','购买成功'))})])))
  } else {
    win.body.append(tabs([{id:'all',label:L('All','全部')},{id:'available',label:L('Available','可用')},{id:'long',label:L('A very long tab label','一个特别长的页签名称')}],'all',log),element('div','lab-row',[button({label:L('Primary','主要操作'),tone:'primary'}),button({label:L('Default','普通操作')}),button({label:L('Disabled','禁用操作'),disabled:true})]),emptyState(L('No letters yet','还没有来信'),L('Someone you meet may have a story to share.','和路上的人聊聊，也许会收到新的消息。')),button({label:L('Open a confirmation','打开确认框'),onClick:async()=>log(await confirmDialog(L('Put away this chapter of your journey?','要收起这一段旅途的记录吗？'))?L('Confirmed','已确认'):L('Cancelled','已取消'))}),button({label:L('Open an edge menu','打开屏幕边缘菜单'),onClick:()=>popup.show(innerWidth-2,innerHeight-2,Array.from({length:12},(_,i)=>[`${L('Action','操作')} ${i+1}`,()=>log(String(i+1))]))}))
  }
  win.show()
}

Object.assign(window,{uiLab:{open,log:history,get current(){return current},popup}})
if (params.has('sample')) open(params.get('sample')!)
