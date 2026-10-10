// People in bulk (docs/engine-split.md §6): a village's worth of people from a seed — a name in both languages, a
// kind, where each stands, a day over the maps' anchors (sleep, work, a meal, the evening), a line or two. They
// are the format's person files, to be changed one by one afterwards like any other.

import type { Text } from '@openworld/engine'
import { rngOf } from './brushes.ts'
import type { PersonFile, ScheduleFileEntry } from './project.ts'

/** Given names, each with its Chinese (a mix of the world's own and plain ones). */
const NAMES: [string, string][] = [
  ['Ada', '艾达'], ['Bram', '布拉姆'], ['Cora', '科拉'], ['Dell', '戴尔'], ['Edda', '艾达'], ['Finn', '芬恩'], ['Greta', '格蕾塔'], ['Hal', '哈尔'],
  ['Ivo', '伊沃'], ['Juna', '朱娜'], ['Kit', '基特'], ['Lena', '莉娜'], ['Milo', '米洛'], ['Nell', '内尔'], ['Oskar', '奥斯卡'], ['Pia', '皮娅'],
  ['Quill', '奎尔'], ['Rhea', '瑞亚'], ['Sven', '斯文'], ['Tova', '托娃'], ['Ulf', '乌尔夫'], ['Vera', '维拉'], ['Wren', '雷恩'], ['Yara', '雅拉'],
]
const WORK = ['mind the field', 'mend the fence', 'gather wood', 'tend the garden', 'watch the road', 'carry water', 'sweep the yard', 'sort the stores']
const LINES: [string, string][] = [
  ['Fine weather for it.', '天气正合适。'], ['Mind your step.', '小心脚下。'], ['Not much happens here. I like it that way.', '这里没什么事。我就喜欢这样。'],
  ['Have you come far?', '你从远处来的吗？'], ['The days are long this time of year.', '这个时节白天很长。'], ['Back to work, then.', '那就接着干活吧。'],
]

export interface CrowdOptions {
  /** How many. */
  n: number
  seed: number
  /** Their kind (a type of person) and the map they stand on at the start. */
  type: string
  map: string
  /** The anchors their days run over (`map:anchor`): each person sleeps at one, works at another. */
  anchors: string[]
  /** Where each stands at the start, by index (default: the map's middle). */
  place?: (i: number) => { x: number; y: number }
  /** Ids already taken (the project's). */
  taken?: Set<string>
}

export function generateCrowd(o: CrowdOptions): PersonFile[] {
  const r = rngOf(o.seed)
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)]
  const taken = o.taken ?? new Set<string>()
  const out: PersonFile[] = []
  const names = [...NAMES]
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]] }
  for (let i = 0; i < o.n; i++) {
    const [en, zh] = names[i % names.length]
    const name: Text = i < names.length ? { en, zh } : { en: `${en} ${Math.floor(i / names.length) + 1}`, zh: `${zh}${Math.floor(i / names.length) + 1}` }
    let id = `npc.${en.toLowerCase()}`
    for (let k = 2; taken.has(id); k++) id = `npc.${en.toLowerCase()}${k}`
    taken.add(id)
    const home = pick(o.anchors)
    const work = o.anchors.length > 1 ? pick(o.anchors.filter((a) => a !== home)) : home
    const wake = 5 + Math.floor(r() * 3)
    const sleep = 20 + Math.floor(r() * 3)
    const schedule: ScheduleFileEntry[] = [
      { from: sleep, to: wake, at: home, activity: 'sleep' },
      { from: wake, to: 12, at: work, activity: pick(WORK) },
      { from: 12, to: 13, at: home, activity: 'eat' },
      { from: 13, to: 18, at: work, activity: pick(WORK) },
      { from: 18, to: sleep, at: home, activity: 'rest' },
    ]
    const [l1, l2] = [pick(LINES), pick(LINES)]
    out.push({
      id,
      type: o.type,
      name,
      place: { on: 'tile', map: o.map, ...(o.place?.(i) ?? { x: 0, y: 0 }) },
      facing: 'down',
      props: { age: 18 + Math.floor(r() * 50) },
      npc: { role: o.type.split('/').pop()!, schedule, person: { lines: [{ key: 'default', text: { en: l1[0], zh: l1[1] } }, ...(l2 !== l1 ? [{ key: 'default', text: { en: l2[0], zh: l2[1] } }] : [])] } },
    })
  }
  return out
}
