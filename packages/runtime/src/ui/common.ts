// What every part of the DOM UI shares: the locale, the strings, small DOM helpers.

import type { Text } from '@openworld/engine'
import { gameIfAny, hasModule } from '../game.ts'
import { textOf } from '../render/scene.ts'

export type Locale = 'en' | 'zh'

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The player's language, remembered between visits (a page asked for one, `?lang=`, is in it and remembers nothing: the editor's playtest in its preview language). */
export const locale = {
  value: ((): Locale => {
    const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang')
    if (asked === 'en' || asked === 'zh') return asked
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

/** The interface's words by key (English, Chinese): what a game may say its own way (ClientGame.texts). */
export const STRINGS: Record<string, [string, string]> = {
  inventory: ['Inventory', '背包'],
  craft: ['Craft', '制作'],
  // a shop's panel (its title when the shop has no name of its own), what its offers' buttons say, and away from its counter
  shop: ['Shop', '商店'],
  shopBuy: ['Buy', '购买'],
  shopSell: ['Sell', '出售'],
  shopAway: ['Stand beside the {station} to trade.', '站到{station}旁边才能交易。'],
  // the bag's character sheet
  csLevel: ['Lv', '等级'],
  csNoProfession: ['No profession', '无职业'],
  csHealth: ['Health', '生命'],
  csFood: ['Food', '饱食'],
  csAttack: ['Attack', '攻击'],
  csWeapon: ['Weapon', '武器威力'],
  csDefence: ['Defence', '防御'],
  csCritical: ['Critical', '暴击'],
  csAttackTip: ['Your own attack and what you wear', '你自己的攻击，加上身上穿戴的'],
  csWeaponTip: ['Added when you strike with your weapon', '用武器打时再加上的'],
  csCritDamage: ['Crit damage', '暴击伤害'],
  csCritDamageTip: ['Damage dealt by a critical hit', '暴击时造成的伤害倍数'],
  csDodge: ['Dodge', '闪避'],
  csLifesteal: ['Lifesteal', '吸血'],
  csLifestealTip: ['Health drawn back per hit', '每次命中吸取的生命'],
  csCooldowns: ['Cooldowns', '冷却缩减'],
  csExperience: ['Experience', '经验获取'],
  csLuck: ['Luck', '幸运'],
  csLuckTip: ['Monsters drop rare parts and trophies more often', '怪物掉落稀有材料与专属装备的几率提高'],
  csMoveSpeed: ['Move speed', '移动速度'],
  csAttackSpeed: ['Attack speed', '攻击速度'],
  csKarma: ['Karma', '善恶'],
  csGood: ['Good', '善良'],
  csEvil: ['Evil', '邪恶'],
  csNeutral: ['Neutral', '中立'],
  csKarmaTip: ['Good deeds win the good over faster; evil deeds, the wicked', '善行使善良的人更快亲近你，恶行则让邪恶的人更快亲近你'],
  csFaith: ['Faith', '信念'],
  csFaithTip: ['How you stand with the Church: prayer at altars and shrines raises it, spreading unbelief lowers it; the story turns on it', '你与教会的关系：在祭坛和圣龛祈祷会升高，散布无神论会降低；会改变剧情走向'],
  csPack: ['Pack', '行囊'],
  csPurse: ['Coin carried', '身上带的钱'],
  'slot:ear': ['Earring', '耳环'],
  'slot:head': ['Head', '头'],
  'slot:neck': ['Necklace', '项链'],
  'slot:shoulders': ['Shoulders', '肩'],
  'slot:body': ['Armour', '护甲'],
  'slot:hands': ['Hands', '手'],
  'slot:ring': ['Ring', '戒指'],
  'slot:waist': ['Belt', '腰带'],
  'slot:weapon': ['Main hand', '主手'],
  'slot:feet': ['Feet', '脚'],
  'slot:arm': ['Off hand', '副手'],
  invHelp: [
    'Click to pick up, again to swap · Shift+click: toolbar ↔ bag · Tab: next row to the toolbar · pick up something wearable and click its slot on the left to put it on (or right click), click a worn piece to take it off · right click: use or put the held thing on it, or handle it',
    '点击拿起、再点击交换 · Shift+点击：快捷栏↔背包 · Tab：换一行到快捷栏 · 拿起装备点左边的装备栏穿上（右键也可以），点装备栏卸下 · 右键：对它用手上的东西、放进去、空手摆弄',
  ],
  // the tooltip: a creature's own piece (its kind's `trophy`), and whose
  tipTrophy: ['Trophy', '战利品'],
  tipDroppedBy: ['dropped by {kind}', '{kind}掉落'],
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
  skillNoProfession: ['No profession yet: a trainer sets you on one once you are ready.', '还没有职业：时候到了，会有导师为你指点。'],
  boonTitle: ['The Companion\'s Powers', '同伴的力量'],
  boonSealed: ['Not yet found', '尚未获得'],
  boonSealedDoc: ['A power is found as the story goes on.', '力量会随着故事获得。'],
  boonOne: ['One power is carried at a time.', '一次只能携带一种力量。'],
  boonAway: ['A power can be changed only beside a woken waypoint statue.', '只有在唤醒过的传送雕像旁才能切换力量。'],
  boonCarry: ['Carry', '携带'],
  boonCarried: ['Carried', '携带中'],
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
  q_favor: ['Favour', '委托'],
  qTab_active: ['Under way', '进行中'],
  qTab_done: ['Done', '已完成'],
  qTab_failed: ['Failed', '失败'],
  qTrack: ['Track', '追踪'],
  qTracked: ['Tracked', '追踪中'],
  qFailed: ['Failed', '失败'],
  qFrom: ['From', '委托人'],
  qLog: ['Journal', '日志'],
  qOptional: ['optional', '可选'],
  qBoard: ['Commission board', '委托板'],
  qBoardEmpty: ['Nobody wants anything done just now. Come back later.', '眼下没人有事相托。过些时候再来看看。'],
  qTake: ['Take it on', '接下'],
  optMarkers: ['Quest markers (map and screen edge)', '任务标记（地图和屏幕边缘）'],
  optTracker: ['Quest tracker', '任务追踪栏'],
  qNone: ['None', '暂无'],
  qEmpty: ['No quests taken on. Look for a yellow "!" over someone\'s head, and press E.', '还没有接任务。找头顶有黄色"！"的人，按 E 接受。'],
  qIdle: ['Nothing under way. Look for a yellow "!" over someone\'s head for more.', '没有进行中的任务。头顶有黄色"！"的人还有事相托。'],
  qDone: ['Done', '已完成'],
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
  aiSection: ['AI', 'AI'],
  aiPreset: ['Preset', '预设'],
  aiCustom: ['custom', '自定义'],
  aiOff: ['Off', '关'],
  aiLow: ['Low', '低'],
  aiMedium: ['Medium', '中'],
  aiHigh: ['High', '高'],
  aiThings: ['Things', '物件互动'],
  aiThingsTip: ['What you do to things that no rule covers', '你对东西做了规则没写的事'],
  aiPeople: ['People and creatures', '人与生物'],
  aiPeopleTip: ['What you do to people and creatures that no rule covers', '你对人或生物做了规则没写的事'],
  aiWorld: ['The world', '世界自发'],
  aiWorldTip: ['What happens by itself that no rule covers: someone stuck, something broken, a chain', '世界自己发生、规则没写的事：有人卡住、东西坏了、连锁反应'],
  aiCreate: ['New things', '造物'],
  aiCreateTip: ['Making kinds the world has none of: low not drawn, high drawn and checked', '造世界上没有的新东西：低档不画图，高档画完再检查'],
  aiPrefetch: ['Asking ahead', '预判'],
  aiPrefetchTip: ['Asking while you point at something, before you act (calls for acts you may never make)', '你指着东西时提前去问（可能为没做的事花调用）'],
  aiWait: ['The world waits up to {s} s for an answer at every level. A higher level does more in that time — it sees more, thinks harder, checks before the answer ships — so a stronger model carries a higher one. Answers are kept by level: a higher one serves the levels below it too.', '每一档世界都最多等 {s} 秒。档位越高，AI 在这段时间里做得越多：看得更多、想得更深、发出前检查更多，所以模型越强，能开的档越高。答案按档位分开保存，高档的答案低档也能用。'],
  aiNoService: ['No AI service connected: the setting still chooses which learned answers apply.', '未连接 AI 服务：设置仍决定用哪一档学到的答案。'],
  aiNoModel: ['The AI service has no model: it answers only from what was learned.', 'AI 服务没有接模型：只用已经学到的答案。'],
  aiModel: ['Model', '模型'],
  aiDetect: ['Detect', '检测'],
  aiDetectPlan: ['{n} questions × 3 levels = {m} runs (model calls)', '{n} 道题 × 3 档 = {m} 次（花模型调用）'],
  aiDetecting: ['Detecting… {n}/{m}', '检测中… {n}/{m}'],
  aiDetected: ['Detected {at}', '检测于 {at}'],
  aiStale: ['(for another model: detect again)', '（这是另一个模型的结果，请重新检测）'],
  aiInTime: ['answered in time · the slowest of nine in ten', '按时答出 · 九成以内最慢'],
  aiRecommend: ['Recommended', '推荐'],
  aiApply: ['Apply the recommendation', '应用推荐'],
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
  shared: ['another player (the shared library)', '别的玩家（共享规则库）'],
  roleInstrument: ['the thing in hand', '手上的东西'],
  roleTarget: ['it', '对象'],
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

/** The player's view preferences (docs/quests.md §2.5): kept in this browser, read with care (it may be blocked). */
export const prefs = {
  get(k: 'markers' | 'tracker'): boolean {
    try {
      return localStorage.getItem(`lsw.${k}`) !== 'off'
    } catch {
      return true
    }
  },
  set(k: 'markers' | 'tracker', on: boolean): void {
    try {
      localStorage.setItem(`lsw.${k}`, on ? 'on' : 'off')
    } catch {
      /* a blocked store: the choice lasts this page only */
    }
  },
}

export function t(k: string): string {
  const own = gameText(k)
  if (own !== undefined) return own
  const v = STRINGS[k]
  return v ? (locale.value === 'zh' ? v[1] : v[0]) : k
}

/** What the game itself says for a key (ClientGame.texts), if it says anything: words only a game has (a tier's lore). */
export function gameText(k: string): string | undefined {
  const own = gameIfAny()?.texts?.[k]
  return own === undefined ? undefined : typeof own === 'string' ? own : locale.value === 'zh' ? (own.zh ?? own.en) : own.en
}

export const MOOD_GLYPH: Record<string, string> = { happy: '♥', sad: '…', angry: '!!', surprised: '!', shy: '♡', neutral: '…' }

/** The toolbar (the bag's first row): ten slots, keys 1–0. */
export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** The controls, as shown in the intro and the Options tab. */
export function controlsTable(dev: boolean): string {
  const zh = locale.value === 'zh'
  // the keys of a module's panels show only where the game uses it (before a game: all of them)
  const skills = gameIfAny() ? hasModule('classes') : true
  const rows: [string, string, string][] = [
    ['WASD · ↑↓←→', 'move (Shift: walk)', '移动（Shift：慢走）'],
    ['B', 'build / farm mode; left click or E places, Esc / RMB exits', '建筑 / 种植模式；左键或 E 放置，Esc / 右键退出'],
    ['E · right click', 'the action, as the cursor shows: talk, open, read, pick up, set down a bed; on the ground or yourself, eat, drink or put on what you hold (pointed at yourself, any use of it); hold E: the bare hands on what you choose', '行动，光标显示要做什么：说话、打开、阅读、捡起、放下床这类东西；对着地面或自己时，吃、喝、穿戴手上的东西（指着自己时，任何用法都行）；长按 E：空手作用于选中的东西'],
    ['F', 'take: pick up, take down, take out', '拿：捡起、取下、取出'],
    ['G', 'put the held thing there: set down, put in, hand it over', '放：把手上的东西放下、放进去、交给别人'],
    ['left click', 'use the held thing on it; with empty hands, a blow; weapons strike; a wall, a floor or a bed in hand is set down there (hold and drag for a row)', '用手上的东西作用于它；空手就是一拳；武器就是攻击；拿着墙、地板、床这类东西就放在那里（按住拖动放一排）'],
    ['R', 'a floor in hand: the left click lays it in the ceiling (and back)', '手上拿着地板：左键改为铺天花板（再按切回）'],
    ['Space', 'attack: strike ahead (hold to keep striking)', '攻击：朝面前挥击（按住连续攻击）'],
    ...(skills ? [['Q', 'dash, once learned (swiftness)', '冲刺（学会迅捷分支的冲刺后）'] as [string, string, string]] : []),
    ['X', 'draw your weapon or put it away: drawn, a blow on a person is meant', '拔出或收起武器：拔出时，对人挥击才算真的动手'],
    ['V', 'sneak: slower, seen only up close and from the front; F on a person picks their pocket', '潜行：走得慢，只有近处、正面的人才看得见你；潜行时对人按 F 是扒窃'],
    ...(skills ? [['Shift+1–6', 'cast the skill in that slot of the skill bar (over the skill tree: put the skill there)', '施放技能栏那一格的技能（在技能树上：把指着的技能放进那一格）'] as [string, string, string]] : []),
    ['hold any of these', 'choose which of the things drawn there', '长按以上任一：选那个位置叠着的哪一样'],
    ['1–0 · wheel', 'choose what to hold', '选择拿在手里的东西'],
    ['Tab · Shift+Tab', 'the next (previous) row of the bag becomes the toolbar', '把背包的下一行（上一行）换到快捷栏'],
    skills
      ? ['Esc · I · C · K · U · M · L · J', 'menu · inventory · craft · skill tree · skills · map · quests · codex', '菜单 · 背包 · 制作 · 技能树 · 技能面板 · 地图 · 任务 · 图鉴']
      : ['Esc · I · C · M · L · J', 'menu · inventory · craft · map · quests · codex', '菜单 · 背包 · 制作 · 地图 · 任务 · 图鉴'],
  ]
  if (dev) rows.push(['`', 'Mod Console (dev)', '模组控制台（开发）'])
  return `<table>${rows.map(([k, en, z]) => `<tr><td><kbd>${k}</kbd></td><td>${zh ? z : en}</td></tr>`).join('')}</table>`
}

/**
 * A slot's frame for what is in it (2026-10-12, after Dungeon Fighter's item slots): gear sits on a dark ground in a
 * border of its quality's colour — crude grey, common white, fine blue, masterwork purple, Vowbound pink, Stigmatic
 * orange, a monster's own piece gold; anything else keeps the plain slot.
 */
export function gearFrame(it: { type: string; tags: string[] } | undefined): string {
  if (!it || !(it.tags.includes('wearable') || it.type.startsWith('item/weapon'))) return ''
  const q = it.tags.find((t) => t.startsWith('quality:'))?.slice(8)
  const tier = it.tags.includes('trophy') ? 'trophy' : (q ?? 'common')
  return ` gear q-${tier}`
}
