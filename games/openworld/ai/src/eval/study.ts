// The human study (paper §7.1, Appendix D): the page on which people rate the controlled evaluation's outcomes, and
// the scoring of what they send back. No model.
//
//   build   each situation's frame drawn by the game's own renderer, the outcome sentences of A (the modder), B (the
//           narrator) and C (the authors), and the lists that share them out among participants → one page that holds
//           everything (var/eval/study/index.html)
//   score   the people's results (a folder of the JSON files the page sends or saves) → the table, and how far the
//           model judge agrees with them (var/eval/study/table.json)
//
//   serve   the page, and the results it sends written one file a participant (POST /submit)
//
//   npx tsx games/openworld/ai/src/eval/study.ts build [--lists 12] [--out var/eval/study]
//   npx tsx games/openworld/ai/src/eval/study.ts serve <results dir> [--port 8080] [--out var/eval/study]
//   npx tsx games/openworld/ai/src/eval/study.ts score <results dir> [--out var/eval/study]
//
// A list rates half the situations, each in one condition, and chooses between two conditions on a quarter of the
// others; across the lists every condition of every situation is rated and every pair chosen. The page takes
// ?list=<n> (else one drawn from the PROLIFIC_PID, else at random), ?submit=<url> (the results are POSTed there as
// JSON; served by `serve`, to its own /submit) and ?cc=<code> (at the end the participant is sent back to Prolific with
// that completion code); the results can also be saved as a file.

import { flags } from '@openworld/ai'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OntologyIndex, RuleLibrary } from '@openworld/engine'
import { BASE_RULES, CHAR_OF, STORY_RULES, buildOntology, generateLook } from '@openworld-game/content'
import { cellRequest } from '../curriculum.ts'
import { loadGame } from '../../../wiki/src/game.ts'
import { renderMap } from '../../../wiki/src/render-map.ts'
import { CATALOG } from '../../../wiki/src/bundle.ts'
import { decodePng, encodePng } from '../../../wiki/src/png.ts'
import { trueskill, type Choice } from './trueskill.ts'
import type { Cell } from '../../../tools/src/coverage.ts'

const argv = process.argv.slice(2)
const opt = flags(argv)
const CONTROLLED = 'var/eval/controlled'
const ASSETS = fileURLToPath(new URL('../../../public/assets/', import.meta.url))
const OUT = opt('out', 'var/eval/study')!
const read = <T,>(f: string): T => JSON.parse(readFileSync(join(CONTROLLED, f), 'utf8'))

interface Item { id: string; set: 'heldout' | 'undefined'; cell: Cell; heldOut?: string }
interface Answer { item: string; cond: string; sentence: string }
interface Rating { item: string; cond: string; sense: number; fit: number }

/** What a participant does: rate one outcome, or choose between two (shown in the order `shown`). */
type Trial =
  | { kind: 'rate'; item: string; cond: string; sense: number; fit: number; ms: number }
  | { kind: 'choose'; item: string; a: string; b: string; shown: [string, string]; winner: string; ms: number }
  | { kind: 'check'; id: string; sense?: number; fit?: number; choice?: number; pass: boolean; ms: number }
interface Result { participant: string; list: number; started: string; finished: string; trials: Trial[]; comment?: string }

const CONDS = (i: Item) => (i.set === 'heldout' ? ['A', 'B', 'C'] : ['A', 'B'])
const PAIRS = (i: Item): [string, string][] => (i.set === 'heldout' ? [['A', 'B'], ['A', 'C'], ['B', 'C']] : [['A', 'B']])

// ---------------------------------------------------------------- the frames

/**
 * A situation's frame, drawn as the game draws it: the one acting on the left, facing what they act on (a thing, a
 * person, a creature or the ground of the scene that asked), or alone when they act on themselves; what they hold in
 * their hand. A row above for the heads.
 */
function frames(items: Item[]): Record<string, string> {
  const onto = buildOntology()
  const index = new OntologyIndex(onto)
  const g = loadGame() as any
  const out: Record<string, string> = {}
  let n = 0
  for (const i of items) {
    const lib = new RuleLibrary([...BASE_RULES, ...STORY_RULES].filter((r) => r.id !== i.heldOut))
    const sc = cellRequest(i.cell, onto, lib)!.scenario as any
    const by = (k: string) => sc.entities.find((e: any) => e.key === k)
    const actor = by('actor')
    const held = sc.entities.find((e: any) => e.heldBy === 'actor')
    const target = by('target') ?? (sc.event.host !== 'instrument' ? by('host') : undefined)
    const tile = [sc.event.target, sc.event.host].find((t: unknown) => typeof t === 'string' && t.startsWith('tile:')) as string | undefined
    const self = sc.event.target === 'actor'
    const ground = (x: number, y: number) => CHAR_OF[sc.terrain[y]?.[x]] ?? CHAR_OF.grass
    const under = ground(actor.x, actor.y)
    const there = tile ? ground(...(tile.slice(5).split(',').map(Number) as [number, number])) : target ? ground(target.x, target.y) : under
    const mid = `study.${i.id}`
    const W = self ? 3 : 4
    // ground acted on fills the right of the scene (water, a wall, a bush, a road); a thing stands on its own ground
    const rows = Array.from({ length: 4 }, (_, y) => Array.from({ length: W }, (_, x) => (tile && x >= 2 ? there : !self && x === 2 && y === 2 ? there : under)).join(''))
    const ents: any[] = []
    const you = { id: `${mid}.you`, type: actor.type, place: { on: 'tile', map: mid, x: 1, y: 2 }, facing: self ? 'down' : 'right', look: generateLook('study.you', { sex: 'female', age: 30, role: 'traveller' }) } as any
    if (held) {
      g.chunks[0].entities.push({ id: `${mid}.held.${n++}`, type: held.type, place: { on: 'hand', holder: you.id } })
      you.held = g.chunks[0].entities.at(-1).id
    }
    ents.push(you)
    if (target && !self) {
      const statuses = (target.statuses ?? []).filter((s: string) => s !== 'stage')
      ents.push({
        id: `${mid}.target`, type: target.type, place: { on: 'tile', map: mid, x: 2, y: 2 },
        ...(statuses.length ? { statuses: Object.fromEntries(statuses.map((s: string) => [s, -1])) } : {}),
        ...(target.type.startsWith('actor/') ? { facing: 'left' } : {}),
        ...(target.type.startsWith('actor/person') ? { look: generateLook(`study.${i.id}.them`, { sex: 'male', age: 45, role: 'villager' }) } : {}),
      })
    }
    g.maps.push({ kind: 'map', id: mid, zh: '', en: '', title: '', group: 'study', map: { id: mid, width: W, height: rows.length, rows }, entities: ents })
    out[i.id] = `data:image/png;base64,${renderMap(g, mid, 4).png.toString('base64')}`
    // what is held, on its own (too small in the hand to read): its own picture, as the bag shows it
    const pic = held && icon(index, held.type)
    if (pic) out[`${i.id}.hand`] = pic
  }
  return out
}

/** A kind's picture from the game's catalogue, four times its size. */
function icon(index: OntologyIndex, type: string): string | undefined {
  const d = CATALOG.items[index.resolve(type).sprite ?? type]
  if (!d) return undefined
  const src = decodePng(readFileSync(ASSETS + (d.img.startsWith('lsw/') ? d.img : `na/${d.img}`)))
  const S = 4
  const rgba = new Uint8Array(d.w * S * d.h * S * 4)
  for (let y = 0; y < d.h * S; y++)
    for (let x = 0; x < d.w * S; x++) {
      const at = ((d.y + Math.floor(y / S)) * src.w + d.x + Math.floor(x / S)) * 4
      rgba.set(src.rgba.subarray(at, at + 4), (y * d.w * S + x) * 4)
    }
  return `data:image/png;base64,${encodePng(d.w * S, d.h * S, rgba).toString('base64')}`
}

// ---------------------------------------------------------------- the lists

/** A fixed shuffle of the situations (the same lists every build). */
function permuted<T>(xs: T[], seed = 11): T[] {
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * List k rates the situations at even (k even) or odd places of the shuffle, the condition turning with k, and chooses
 * on half of the others, the pair turning with k: over twelve lists every situation is rated six times (each of its
 * conditions twice or three times) and chosen on three times (each pair of a held-out situation once).
 */
function lists(items: Item[], L: number) {
  const order = permuted(items)
  return Array.from({ length: L }, (_, k) => {
    const half = k % 2, turn = Math.floor(k / 2)
    const rate = order.flatMap((i, p) => (p % 2 === half ? [{ item: i.id, cond: CONDS(i)[(p + turn) % CONDS(i).length] }] : []))
    const rest = order.filter((_, p) => p % 2 !== half)
    const choose = rest.flatMap((i, j) => {
      if (j % 2 !== turn % 2) return []
      const [a, b] = PAIRS(i)[(j + Math.floor(k / 4)) % PAIRS(i).length]
      return [{ item: i.id, a, b }]
    })
    return { rate, choose }
  })
}

// ---------------------------------------------------------------- build

function build(): void {
  const items = read<Item[]>('items.json')
  const answers = ['A', 'B', 'C'].flatMap((c) => read<Answer[]>(`answers-${c}.json`)).filter((a) => a.sentence)
  // the act is the sentence's head, the same in every condition; what happens is the rest
  const split = (s: string) => {
    const at = s.indexOf(': ')
    // a quoted line closes the sentence: its own stop is enough
    const what = s.slice(at + 2).trim().replace(/([.!?…])"\.$/, '$1"')
    return { act: s.slice(0, at), what: what.charAt(0).toUpperCase() + what.slice(1) }
  }
  const situations: Record<string, { act: string; frame: string; hand?: string; outcomes: Record<string, string> }> = {}
  const pics = frames(items)
  for (const i of items) {
    const mine = answers.filter((a) => a.item === i.id)
    situations[i.id] = { act: split(mine[0].sentence).act, frame: pics[i.id], hand: pics[`${i.id}.hand`], outcomes: Object.fromEntries(mine.map((a) => [a.cond, split(a.sentence).what])) }
  }
  // attention checks: an absurd outcome, an instruction, a choice between a sensible and an absurd outcome
  const checks = [
    { id: 'absurd', kind: 'rate', item: 'h2', what: 'The grass turns to gold; the Acorn grows wings and flies to the moon; you turn into a frog.', expect: { senseAtMost: 3 } },
    { id: 'instructed', kind: 'rate', item: 'h15', what: 'This one checks that you are reading: please choose 2 on both questions.', expect: { sense: 2, fit: 2 } },
    { id: 'pick', kind: 'choose', item: 'h5', outcomes: ['The villager takes the Bread and eats it; "Thank you, friend."', 'The villager turns into a horse; the Bread explodes; the sun goes out.'], expect: { choice: 0 } },
  ]
  const L = Number(opt('lists', '12'))
  const data = { lists: lists(items, L), situations, checks }
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'study.html'), 'utf8').replace('__DATA__', () => JSON.stringify(data).replace(/</g, '\\u003c'))
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'index.html'), page)
  const sizes = data.lists.map((l) => `${l.rate.length}+${l.choose.length}`)
  console.log(`${items.length} situations, ${L} lists (rate+choose ${[...new Set(sizes)].join(', ')}, and ${checks.length} checks) → ${join(OUT, 'index.html')} (${(page.length / 1024).toFixed(0)} KB)`)
}

// ---------------------------------------------------------------- score

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys)
  const c = xs.reduce((s, x, k) => s + (x - mx) * (ys[k] - my), 0)
  return c / Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0))
}
const ranks = (xs: number[]) => {
  const order = xs.map((x, k) => [x, k] as const).sort((a, b) => a[0] - b[0])
  const r = new Array(xs.length)
  for (let k = 0; k < order.length; ) {
    let j = k
    while (j + 1 < order.length && order[j + 1][0] === order[k][0]) j++
    for (let m = k; m <= j; m++) r[order[m][1]] = (k + j) / 2 + 1
    k = j + 1
  }
  return r
}

function score(dir: string): void {
  const items = read<Item[]>('items.json')
  const setOf = new Map(items.map((i) => [i.id, i.set]))
  const results: Result[] = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  // who is kept: at least two of the three checks passed, and not faster than 2.5 s a rating (median)
  const kept = results.filter((r) => {
    const checks = r.trials.filter((t) => t.kind === 'check') as Extract<Trial, { kind: 'check' }>[]
    const rates = r.trials.filter((t) => t.kind === 'rate').map((t) => t.ms).sort((a, b) => a - b)
    return checks.filter((c) => c.pass).length >= 2 && (rates[Math.floor(rates.length / 2)] ?? 0) >= 2500
  })
  const rates = kept.flatMap((r) => r.trials.filter((t): t is Extract<Trial, { kind: 'rate' }> => t.kind === 'rate'))
  const choices: Choice[] = kept.flatMap((r) => r.trials.filter((t): t is Extract<Trial, { kind: 'choose' }> => t.kind === 'choose').map((t) => ({ item: t.item, a: t.a, b: t.b, winner: t.winner })))
  const ts = trueskill(choices)
  const rows = ['A', 'B', 'C'].flatMap((cond) =>
    ['all', 'heldout', 'undefined'].flatMap((set) => {
      const r = rates.filter((t) => t.cond === cond && (set === 'all' || setOf.get(t.item) === set))
      return r.length ? [{ cond, set, n: r.length, sense: +mean(r.map((t) => t.sense)).toFixed(2), fit: +mean(r.map((t) => t.fit)).toFixed(2), trueskill: set === 'all' && ts[cond] ? +ts[cond].mu.toFixed(1) : undefined }] : []
    }),
  )
  const pairs: Record<string, [number, number]> = {}
  for (const c of choices) (pairs[`${c.a} vs ${c.b}`] ??= [0, 0])[c.winner === c.a ? 0 : 1]++
  // the model judge against the people: on each rated outcome, and on each pair the people chose on
  const judged = read<Rating[]>('ratings.json')
  const both = [...new Set(rates.map((t) => `${t.item}|${t.cond}`))].flatMap((k) => {
    const [item, cond] = k.split('|')
    const j = judged.find((x) => x.item === item && x.cond === cond)
    const h = rates.filter((t) => t.item === item && t.cond === cond)
    return j ? [{ human: mean(h.map((t) => t.sense)), judge: j.sense, humanFit: mean(h.map((t) => t.fit)), judgeFit: j.fit }] : []
  })
  const judgeChoices = read<Choice[]>('choices.json')
  let agree = 0, compared = 0
  for (const k of new Set(choices.map((c) => `${c.item}|${c.a}|${c.b}`))) {
    const [item, a, b] = k.split('|')
    const mine = choices.filter((c) => c.item === item && c.a === a && c.b === b)
    const forA = mine.filter((c) => c.winner === a).length
    const j = judgeChoices.find((c) => c.item === item && c.a === a && c.b === b)
    if (!j || forA * 2 === mine.length) continue
    compared++
    if ((forA * 2 > mine.length ? a : b) === j.winner) agree++
  }
  const table = {
    participants: results.length, kept: kept.length, ratings: rates.length, choices: choices.length,
    rows, pairs, trueskill: ts,
    judge: {
      outcomes: both.length,
      sense: { pearson: +pearson(both.map((x) => x.human), both.map((x) => x.judge)).toFixed(2), spearman: +pearson(ranks(both.map((x) => x.human)), ranks(both.map((x) => x.judge))).toFixed(2) },
      fit: { pearson: +pearson(both.map((x) => x.humanFit), both.map((x) => x.judgeFit)).toFixed(2), spearman: +pearson(ranks(both.map((x) => x.humanFit)), ranks(both.map((x) => x.judgeFit))).toFixed(2) },
      choices: { compared, agree },
    },
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'table.json'), JSON.stringify(table, null, 1))
  console.log(JSON.stringify(table, null, 1))
}

// ---------------------------------------------------------------- serve

/** The built page, sending to this server; each participant's results kept as a file of `dir`. */
function serve(dir: string): void {
  const page = readFileSync(join(OUT, 'index.html'), 'utf8').replace('"__SUBMIT__"', '"submit"')
  mkdirSync(dir, { recursive: true })
  const port = Number(opt('port', '8080'))
  createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(page)
    }
    if (req.method === 'POST' && path === '/submit') {
      let body = ''
      req.on('data', (c) => {
        body += c
        if (body.length > 2_000_000) req.destroy()
      })
      req.on('end', () => {
        try {
          const r = JSON.parse(body) as Result
          if (typeof r.participant !== 'string' || !Array.isArray(r.trials)) throw new Error('not a result')
          const name = `${r.participant.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'anon'}-${Date.now()}.json`
          writeFileSync(join(dir, name), JSON.stringify(r, null, 1))
          console.log(`${new Date().toISOString()} ${name}: list ${r.list}, ${r.trials.length} trials`)
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end('{"ok":true}')
        } catch {
          res.writeHead(400)
          res.end()
        }
      })
      return
    }
    res.writeHead(404)
    res.end()
  }).listen(port, () => console.log(`the study on http://localhost:${port}/ (results → ${dir})`))
}

const [cmd, arg] = argv
if (cmd === 'build') build()
else if (cmd === 'serve' && arg) serve(arg)
else if (cmd === 'score' && arg) score(arg)
else console.log('build [--lists 12] | serve <results dir> [--port 8080] | score <results dir>')
