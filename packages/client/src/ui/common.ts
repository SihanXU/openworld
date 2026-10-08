// What every part of the DOM UI shares: the locale, the strings, small DOM helpers.

import type { Text } from '@lsw/engine'
import { textOf } from '../render/scene.ts'

export type Locale = 'en' | 'zh'

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The player's language, remembered between visits. */
export const locale = {
  value: ((): Locale => {
    try {
      return (localStorage.getItem('lsw.locale') as Locale) || 'en'
    } catch {
      return 'en'
    }
  })(),
  set(l: Locale) {
    this.value = l
    try {
      localStorage.setItem('lsw.locale', l)
    } catch {
      /* private mode */
    }
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
  },
}

export const tx = (t: Text | undefined) => textOf(t, locale.value)

const STRINGS: Record<string, [string, string]> = {
  inventory: ['Inventory', '背包'],
  craft: ['Craft', '制作'],
  shop: ['The Stall', '货摊'],
  craftIt: ['Craft', '制作'],
  needMore: ['Not enough materials', '材料不够'],
  craftAll: ['All', '全部'],
  craftAllTip: ['Make as many as what you carry makes (or Shift-click Craft)', '用身上的材料做到做不了为止（或按住 Shift 点制作）'],
  toolKept: ['A tool it needs carried; not used up', '需要带着的工具，不会消耗'],
  level: ['Level', '等级'],
  xp: ['Experience', '经验'],
  skillPoints: ['Skill points', '技能点'],
  skills: ['Skills', '技能'],
  learn: ['Learn', '学习'],
  learnedSkill: ['Learned', '已学会'],
  needsSkill: ['Needs {s}', '需要先学{s}'],
  noPoints: ['No skill points: level up to earn one', '没有技能点：升级可获得'],
  ability: ['Ability', '能力'],
  toTitle: ['Save & back to title', '保存并返回标题'],
  savedSlot: ['Saved to slot {n}', '已保存到存档 {n}'],
  cvContinue: ['Continue', '继续游戏'],
  cvLoad: ['Load game', '读取存档'],
  cvLoading: ['Loading…', '载入中……'],
  cvFailed: ['The world could not start:', '世界没能开始：'],
  cvPickNew: ['New game — choose a slot', '新游戏——选择存档位'],
  cvPickLoad: ['Load game', '读取存档'],
  cvSlot: ['Slot {n}', '存档 {n}'],
  cvEmpty: ['Empty', '空'],
  cvDay: ['Day {n}', '第 {n} 天'],
  cvSavedAt: ['Saved', '保存于'],
  cvOldSave: ['A save from an earlier version', '旧版本的存档'],
  cvStartHere: ['Start here', '在此开始'],
  cvOverwrite: ['Overwrite & start', '覆盖并开始'],
  cvLoadThis: ['Load', '读取'],
  cvExport: ['Export', '导出'],
  cvExportTip: ['Save this slot as a file on your computer', '把这个存档保存为电脑上的文件'],
  cvImport: ['Import', '导入'],
  cvImportTip: ['Read a save file from your computer into this slot', '从电脑上的存档文件读入这个存档位'],
  cvDelete: ['Delete', '删除'],
  cvConfirmOverwrite: ['Slot {n} already holds a game. Replace it?', '存档 {n} 已经有进度了，要覆盖吗？'],
  cvConfirmDelete: ['Delete slot {n}? This cannot be undone (unless you exported it).', '删除存档 {n}？删除后无法恢复（除非你导出过）。'],
  cvBadFile: ['That file is not an OpenWorld save.', '这个文件不是 OpenWorld 的存档。'],
  cvIncompatible: ['That save is from another version of the world: a new game began in its slot.', '这个存档来自另一个版本的世界，已在该存档位开始新游戏。'],
  cvNote: ['Saves live in this browser (it autosaves as you play). Export one to keep it as a file, or to carry it to another browser.', '存档保存在这个浏览器里（游戏中会自动保存）。导出可以存成文件，或带到别的浏览器。'],
  skillNoProfession: ['No profession yet. At level 5, Bram the trainer sets you on one in the drill yard of Firstlight Village (crossed blades over his head): assassin, warrior, ranger or mage.', '还没有职业。到 5 级后，去初原村操练场找职业导师布拉姆（头顶有交叉双剑标记）选择：刺客、战士、游侠或法师。'],
  profTitle: ['Choose a profession', '选择职业'],
  profCurrent: ['Your profession', '当前职业'],
  profChoose: ['Choose', '选择'],
  profSwitch: ['Change to this', '转为此职业'],
  profKit: ['Starts with', '起始武器'],
  profNodes: ['skills', '个技能'],
  profReady: ['Choose the road you will walk. Its branch opens in your skill tree (K), and you are handed its weapon.', '选一条你要走的路。它的技能分支会出现在技能树（K）里，并会发给你一把对应的武器。'],
  profLevel: ['Come back at level {n} (you are level {l}). Until then, look over the roads.', '{n} 级才能选择职业（你现在 {l} 级）。先看看各条路吧。'],
  profSwitchNote: ['Changing gives back the {n} points spent in your profession branch: you spend them again in the new one. Other branches are kept.', '转职会返还职业分支上已加的 {n} 点技能点，需要在新职业里重新加点；其他分支保留。'],
  profConfirm: ['Change profession? The {n} points of your profession branch come back, and its skills are unlearned.', '确定转职吗？职业分支的 {n} 点技能点会返还，原职业技能会被重置。'],
  qTitle: ['Quests', '任务'],
  q_main: ['Main', '主线'],
  q_side: ['Side', '支线'],
  q_repeat: ['Repeatable', '重复'],
  qActive: ['Under way', '进行中'],
  qReady: ['Ready to hand in', '可以交付'],
  qNone: ['None', '暂无'],
  qEmpty: ['No quests taken on. Look for a yellow "!" over someone\'s head, and press E.', '还没有接任务。找头顶有黄色"！"的人，按 E 接受。'],
  zonePeaceful: ['Peaceful zone', '和平区域'],
  zoneCombat: ['Combat zone · monsters at night', '战斗区域 · 夜间有怪物'],
  worldMap: ['World map', '世界地图'],
  worldMapHint: ['Drag · wheel to zoom · click a glowing statue to travel', '拖动 · 滚轮缩放 · 点击发光的传送雕像即可传送'],
  wmHere: ['You', '我的位置'],
  wmTravel: ['click to travel', '点击传送'],
  wmAsleep: ['not woken yet', '尚未唤醒'],
  skillHint: ['Drag to look around · wheel to zoom', '拖动浏览 · 滚轮缩放'],
  skillCenter: ['Centre', '回到中心'],
  skillZoomIn: ['Zoom in', '放大技能树'],
  skillZoomOut: ['Zoom out', '缩小技能树'],
  skillOrigin: ['Every level brings a skill point. Learn outward from here.', '每升一级获得 1 技能点，从这里向外学习。'],
  skillDirections: ['Skill directions', '技能方向'],
  skillBranch: ['Branch', '分支'],
  skillProfession: ['Profession', '职业'],
  skillPending: ['Skills to be designed', '技能待设计'],
  levelUp: ['Level up! Level {n} · +1 skill point', '升级了！等级 {n} · 技能点 +1'],
  threads: ['Threadbook', '织线簿'],
  options: ['Options', '选项'],
  journal: ['Journal', '日志'],
  codex: ['Codex', '图鉴'],
  cxItems: ['Items', '道具'],
  cxPeople: ['People', '人物'],
  cxCreatures: ['Monsters', '怪物'],
  organize: ['Organize', '整理'],
  fillStacks: ['Add to existing stacks', '填充已有堆叠'],
  dropHere: ['Drop', '丢下'],
  empty: ['empty', '空'],
  yes: ['Yes', '是'],
  no: ['No', '否'],
  health: ['Health', '生命'],
  hunger: ['Hunger', '饱食度'],
  day: ['Day', '第'],
  noThreads: ['No threads yet. Try something the world has never seen.', '还没有新的线。试试这个世界从没见过的事。'],
  learned: ['A new thread is woven', '织入了一根新线'],
  learning: ['The world pauses…', '世界停顿了一下……'],
  creating: ['The world is making something new', '世界正在创造新物体'],
  noModder: ['No modder online, nothing learned', '没有连上 modder，这次没学到'],
  'weather.sun': ['Clear', '晴'],
  'weather.cloud': ['Cloudy', '多云'],
  'weather.rain': ['Rain', '雨'],
  'weather.storm': ['Storm', '暴风雨'],
  'weather.fog': ['Fog', '雾'],
  saved: ['Saved.', '已保存。'],
  loading: ['Loading', '加载中'],
  language: ['Language', '语言'],
  sound: ['Sound', '声音'],
  on: ['on', '开'],
  off: ['off', '关'],
  save: ['Save', '保存'],
  newGame: ['New game', '新游戏'],
  controls: ['Controls', '操作'],
  devConsole: ['Mod Console (dev)', '模组控制台（开发）'],
  you: ['you', '你'],
  world: ['the world', '世界'],
  wovenBy: ['woven by', '织者'],
  objective: ['Objective', '目标'],
  questsActive: ['Under way (L)', '进行中的任务（L）'],
  done: ['Done', '已完成'],
  lmb: ['L-click', '左键'],
  rmb: ['R-click', '右键'],
  chooseTarget: ['on which?', '对哪一个？'],
  useOn: ['Use {held} on it', '用{held}作用于它'],
  putIn: ['Put {held} into / onto it', '把{held}放进 / 放到它上'],
  handsOn: ['Handle it', '空手摆弄它'],
  moveOne: ['Move one', '移一个'],
  confirmNew: ['Start a new game? (the threads the world learned are kept)', '开始新游戏？（世界学会的线会保留）'],
}

export function t(k: string): string {
  const v = STRINGS[k]
  return v ? (locale.value === 'zh' ? v[1] : v[0]) : k
}

export const MOOD_GLYPH: Record<string, string> = { happy: '♥', sad: '…', angry: '!!', surprised: '!', shy: '♡', neutral: '…' }

/** The toolbar (the bag's first row): ten slots, keys 1–0. */
export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** The controls, as shown in the intro and the Options tab. */
export function controlsTable(dev: boolean): string {
  const zh = locale.value === 'zh'
  const rows: [string, string, string][] = [
    ['WASD · ↑↓←→', 'move (Shift: walk)', '移动（Shift：慢走）'],
    ['B', 'build / farm mode; left click or E places, Esc / RMB exits', '建筑 / 种植模式；左键或 E 放置，Esc / 右键退出'],
    ['E', 'hands: talk, open, read, push', '空手：说话、打开、阅读、推'],
    ['F', 'take: pick up, take down, take out', '拿：捡起、取下、取出'],
    ['Space', 'attack: strike ahead (hold to keep striking)', '攻击：朝面前挥击（按住连续攻击）'],
    ['Q', 'dash, once learned (swiftness)', '冲刺（学会迅捷分支的冲刺后）'],
    ['left click', 'use the held thing on it (click yourself: eat, drink); weapons strike', '用手上的东西作用于它（点自己：吃、喝）；武器就是攻击'],
    ['right click', 'put the held thing there: place, store, hand it over', '把手上的东西放过去：放下、放进、交给别人'],
    ['hold any of these', 'choose which of the things drawn there', '长按以上任一：选那个位置叠着的哪一样'],
    ['1–0 · wheel', 'choose what to hold', '选择拿在手里的东西'],
    ['Tab · Shift+Tab', 'the next (previous) row of the bag becomes the toolbar', '把背包的下一行（上一行）换到快捷栏'],
    ['Esc · I · C · K · M · L · J', 'menu · inventory · craft · skills · map · quests · Threadbook', '菜单 · 背包 · 制作 · 技能 · 地图 · 任务 · 织线簿'],
  ]
  if (dev) rows.push(['`', 'Mod Console (dev)', '模组控制台（开发）'])
  return `<table>${rows.map(([k, en, z]) => `<tr><td><kbd>${k}</kbd></td><td>${zh ? z : en}</td></tr>`).join('')}</table>`
}
