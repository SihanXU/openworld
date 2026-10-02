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
  threads: ['Threadbook', '织线簿'],
  options: ['Options', '选项'],
  journal: ['Journal', '日志'],
  organize: ['Organize', '整理'],
  fillStacks: ['Add to existing stacks', '填充已有堆叠'],
  dropHere: ['Drop', '丢下'],
  empty: ['empty', '空'],
  yes: ['Yes', '是'],
  no: ['No', '否'],
  health: ['Health', '生命'],
  day: ['Day', '第'],
  noThreads: ['No threads yet. Try something the world has never seen.', '还没有新的线。试试这个世界从没见过的事。'],
  learned: ['A new thread is woven', '织入了一根新线'],
  learning: ['The world pauses…', '世界停顿了一下……'],
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

/** The bag is the toolbar: ten slots, keys 1–0. */
export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

/** The controls, as shown in the intro and the Options tab. */
export function controlsTable(dev: boolean): string {
  const zh = locale.value === 'zh'
  const rows: [string, string, string][] = [
    ['WASD · ↑↓←→', 'move (Shift: walk)', '移动（Shift：慢走）'],
    ['E', 'hands: talk, open, read, push', '空手：说话、打开、阅读、推'],
    ['F', 'take: pick up, take down, take out', '拿：捡起、取下、取出'],
    ['left click', 'use the held thing on it (click yourself: eat, drink); weapons strike', '用手上的东西作用于它（点自己：吃、喝）；武器就是攻击'],
    ['right click', 'put the held thing there: place, store, hand it over', '把手上的东西放过去：放下、放进、交给别人'],
    ['hold any of these', 'choose which thing on the tile', '长按以上任一：选这一格里的哪一样'],
    ['1–0 · wheel', 'choose what to hold', '选择拿在手里的东西'],
    ['Esc · I · J', 'menu · inventory · Threadbook', '菜单 · 背包 · 织线簿'],
  ]
  if (dev) rows.push(['`', 'Mod Console (dev)', '模组控制台（开发）'])
  return `<table>${rows.map(([k, en, z]) => `<tr><td><kbd>${k}</kbd></td><td>${zh ? z : en}</td></tr>`).join('')}</table>`
}
