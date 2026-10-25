// A scene's commands as forms (docs/engine-split.md §16 E2, RPG Maker's event commands and their dialogs): a line
// with its speaker, mood and words, shown as the game's own dialogue box with the speaker's portrait; a move, a
// transfer or a placing picked on the map; a fact, a topic, a quest's stage, a status, a gift, chosen from the
// project's names. Each kind keeps the engine's shape (types.ts SceneCmd).

import type { Look, Mood, SceneCmd, Text } from '@openworld/engine'
import type { PersonFile } from '@openworld/format'
import type { Catalog } from '@openworld/runtime/src/assets/types.ts'
import { faceFrame, personLook } from '@openworld/runtime/src/assets/looks.ts'
import { hasLooks } from '@openworld/runtime/src/game.ts'
import { portraitOf, preparePortrait } from '@openworld/runtime/src/assets/figure/index.ts'
import type { Ctx } from './context.ts'
import { Form, valueOf } from './form.ts'
import { picUrl } from './thumbs.ts'
import { image } from './sheet.ts'
import { namesOf } from './triggers.ts'
import { phrase } from './lang.ts'
import { esc, t, toast, tx } from './ui.ts'
import { inLang, previewLang } from './words.ts'

export const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
const DIRS = ['down', 'up', 'left', 'right']

/** A scene's command kinds, each with its name and what a new one starts as. */
export const CMD_KINDS: [string, string, (ctx: Ctx) => SceneCmd][] = [
  ['say', phrase('Show a line'), () => ({ say: 'player', text: '…' })],
  ['move', phrase('Walk to'), (ctx) => ({ move: 'player', x: Math.floor((ctx.canvas.map?.width ?? 2) / 2), y: Math.floor((ctx.canvas.map?.height ?? 2) / 2) })],
  ['face', phrase('Turn'), () => ({ face: 'player', dir: 'down' })],
  ['emote', phrase('Show a mood'), () => ({ emote: 'player', mood: 'happy' })],
  ['wait', phrase('Wait'), () => ({ wait: 10 })],
  ['fade', phrase('Fade'), () => ({ fade: 'out' })],
  ['warp', phrase('Transfer the player'), (ctx) => ({ warp: ctx.map, x: 0, y: 0 })],
  ['place', phrase('Place someone'), (ctx) => ({ place: namesOf(ctx).people[0]?.id ?? '', map: ctx.map, x: 0, y: 0 })],
  ['give', phrase('Give the player'), () => ({ give: 'item/', count: 1 })],
  ['fact', phrase('Set a fact'), () => ({ fact: 'story.', value: 1 })],
  ['stage', phrase('A quest\'s stage'), (ctx) => ({ stage: namesOf(ctx).quests[0] ?? '', n: 10 })],
  ['topic', phrase('Raise a topic'), () => ({ topic: 'news', days: 1 })],
  ['status', phrase('A status on or off'), () => ({ status: '', add: '' })],
  ['tell', phrase('Tell someone'), () => ({ tell: '', params: { what: 'news' } })],
  ['card', phrase('A full-screen card'), () => ({ card: '…' })],
  ['picture', phrase('Show a picture'), () => ({ picture: 'own/' })],
]
export const cmdKind = (c: SceneCmd): string => CMD_KINDS.find(([k]) => k in c)?.[0] ?? '?'

/** Who can be named in a scene: the player, the people, and the things on the maps (by id). */
function whoField(f: Form, ctx: Ctx, cur: string, set: (v: string) => void): string {
  const people = namesOf(ctx).people
  const known = cur === 'player' || people.some((p) => p.id === cur)
  return `${f.select([['player', t('the player')], ...people.map((p): [string, string] => [p.id, tx(p.name) || p.id]), ['?', t('a thing by its id…')]], known ? cur : '?', (v) => v !== '?' && set(v))}${known ? '' : ` ${f.text(cur, set, { list: 'dlThings', placeholder: t('its id') })}`}`
}

/** A cell, its numbers and a button to pick it on the map (a map's own, when it names one). */
function cellField(f: Form, ctx: Ctx, why: string, map: string | undefined, x: number, y: number, set: (c: { map: string; x: number; y: number }) => void): string {
  const m = map ?? ctx.map
  return `${f.num(x, (v) => set({ map: m, x: v ?? 0, y }))} ${f.num(y, (v) => set({ map: m, x, y: v ?? 0 }))} ${f.button(t('Pick on the map'), () => void ctx.pick(why, m).then((p) => p && set(p)))}`
}

/** One command's fields; `set` is given the command after a change; `place`: where the command is (its words' place, for the preview). */
export function cmdForm(f: Form, ctx: Ctx, c: SceneCmd, set: (c: SceneCmd) => void, place?: string): string {
  const n = namesOf(ctx)
  const k = cmdKind(c)
  const x = c as Record<string, unknown>
  switch (k) {
    case 'say': {
      const s = c as { say: string; text: Text; mood?: Mood }
      return `<div class="row">${whoField(f, ctx, s.say, (v) => set({ ...s, say: v }))} ${f.select(MOODS, s.mood ?? 'neutral', (m) => set({ ...s, ...(m === 'neutral' ? { mood: undefined } : { mood: m as Mood }) }))}</div>${f.words(s.text, (t) => set({ ...s, text: t ?? '' }), { area: true })}<div class="preview" data-line="${esc(JSON.stringify({ who: s.say, mood: s.mood, text: s.text, place: place && `${place}.text` }))}"></div>`
    }
    case 'move': { const m = c as { move: string; x: number; y: number }; return `${whoField(f, ctx, m.move, (v) => set({ ...m, move: v }))} ${t('to')} ${cellField(f, ctx, t('where they walk to'), undefined, m.x, m.y, (p) => set({ ...m, x: p.x, y: p.y }))}` }
    case 'face': { const m = c as { face: string; dir: 'down' }; return `${whoField(f, ctx, m.face, (v) => set({ ...m, face: v }))} ${f.select(DIRS, m.dir, (d) => set({ ...m, dir: d as 'down' }))}` }
    case 'emote': { const m = c as { emote: string; mood: Mood }; return `${whoField(f, ctx, m.emote, (v) => set({ ...m, emote: v }))} ${f.select(MOODS, m.mood, (d) => set({ ...m, mood: d as Mood }))}` }
    case 'wait': return `${f.num(Number(x.wait), (v) => set({ wait: v ?? 1 }), { min: 1 })} ${t('ticks')} <span class="muted">(${(Number(x.wait) / 10).toFixed(1)} s)</span>`
    case 'fade': return f.select([['out', t('to black')], ['in', t('back from black')]], String(x.fade), (v) => set({ fade: v as 'out' }))
    case 'warp': { const m = c as { warp: string; x: number; y: number }; return `${f.select(n.maps, m.warp, (v) => set({ ...m, warp: v }))} ${t('at')} ${cellField(f, ctx, t('where the player is taken'), m.warp, m.x, m.y, (p) => set({ warp: p.map, x: p.x, y: p.y }))}` }
    case 'place': { const m = c as { place: string; map: string; x: number; y: number }; return `${whoField(f, ctx, m.place, (v) => set({ ...m, place: v }))} ${t('on')} ${f.select(n.maps, m.map, (v) => set({ ...m, map: v }))} ${t('at')} ${cellField(f, ctx, t('where they are placed'), m.map, m.x, m.y, (p) => set({ ...m, map: p.map, x: p.x, y: p.y }))}` }
    case 'give': { const m = c as { give: string; count?: number }; return `${f.num(m.count ?? 1, (v) => set({ ...m, count: v ?? 1 }), { min: 1 })} × ${f.text(m.give, (v) => set({ ...m, give: v }), { list: 'dlKinds', placeholder: t('a kind') })}` }
    case 'fact': { const m = c as { fact: string; value: unknown }; return `${f.text(m.fact, (v) => set({ fact: v, value: m.value as never }), { list: 'dlFacts', placeholder: t('the fact') })} = ${f.text(String(m.value ?? ''), (v) => set({ fact: m.fact, value: valueOf(v) }))}` }
    case 'stage': { const m = c as { stage: string; n: number }; const q = n.quest(m.stage); return `${f.select(n.quests, m.stage, (v) => set({ ...m, stage: v }))} ${t('to')} ${q ? f.select(q.stages.map((s): [string, string] => [String(s.n), `${s.n}${s.log ? ` — ${tx(s.log)}` : ''}`]), String(m.n), (v) => set({ ...m, n: Number(v) })) : f.num(m.n, (v) => set({ ...m, n: v ?? 0 }))}` }
    case 'topic': { const m = c as { topic: string; days?: number }; return `${f.text(m.topic, (v) => set({ ...m, topic: v }))} ${t('for')} ${f.num(m.days, (v) => set({ ...m, ...(v ? { days: v } : { days: undefined }) }), { min: 1, placeholder: t('days') })} ${t('days')}` }
    case 'status': {
      const m = c as { status: string; add?: string; remove?: string }
      const on = m.remove === undefined
      return `${f.text(m.status, (v) => set({ ...m, status: v }), { list: 'dlThings', placeholder: t('a thing\'s id') })} ${f.select([['add', t('gains')], ['remove', t('loses')]], on ? 'add' : 'remove', (v) => set(v === 'add' ? { status: m.status, add: m.remove ?? m.add ?? '' } : { status: m.status, remove: m.add ?? m.remove ?? '' }))} ${f.text(on ? m.add : m.remove, (v) => set(on ? { status: m.status, add: v } : { status: m.status, remove: v }), { list: 'dlStatuses', placeholder: t('a status') })}`
    }
    case 'tell': { const m = c as { tell: string; params: Record<string, never> }; return `${whoField(f, ctx, m.tell, (v) => set({ ...m, tell: v }))} ${f.json(m.params, (v) => set({ ...m, params: (v ?? {}) as never }), (msg) => toast(msg, 'error'), 1)}` }
    case 'card': {
      const m = c as { card: Text; art?: string }
      return `${f.words(m.card, (t) => set({ ...m, card: t ?? '' }), { area: true })}<div class="row">${t('over a picture')} ${f.text(m.art ?? '', (v) => set({ card: m.card, ...(v.trim() && { art: v.trim() }) }), { placeholder: t('none (a path under assets/: own/…)') })}</div>`
    }
    case 'picture': {
      const m = c as { picture: string | null }
      return `${f.text(m.picture ?? '', (v) => set({ picture: v.trim() || null }), { placeholder: t('a path under assets/ (own/…); empty takes the picture away') })} <span class="muted">${t('the lines go on over it until the scene ends')}</span>`
    }
  }
  return f.json(c, (v) => set(v as SceneCmd), (msg) => toast(msg, 'error'), 2)
}

// ------------------------------------------------------------------ the line, as the game shows it

/**
 * Draw every `.preview[data-line]` under an element as the game's dialogue box (the runtime's own styles): the
 * speaker's name, the words in the preview language (as its table translates them), the portrait — a look's bust
 * where the game has looks, else the catalogue's faceset for the speaker's character, in the line's mood.
 */
export function paintLines(ctx: Ctx, root: HTMLElement, lang = previewLang()): void {
  const people = new Map(ctx.store.list<PersonFile>('people').map((p) => [p.data.id, p.data]))
  const files = new Map(ctx.store.list<PersonFile>('people').map((p) => [p.data.id, p.file]))
  const player = ctx.store.game.player
  const cat = ctx.store.get<Catalog>('catalog.json')
  for (const box of root.querySelectorAll<HTMLElement>('.preview[data-line]')) {
    const { who, mood, text, place } = JSON.parse(box.dataset.line!) as { who: string; mood?: Mood; text: Text; place?: string }
    const p = who === 'player' ? (player as unknown as PersonFile) : people.get(who)
    const name = p?.name === undefined ? who : inLang(p.name, lang, who === 'player' ? 'game.json#player.name' : `${files.get(who)}#name`)
    const words = inLang(text, lang, place)
    box.innerHTML = `<div class="dialog line-preview"><div class="face"></div><div class="dtext"><div class="dname">${esc(name)}</div><div class="dline">${esc(words)}</div></div><div class="dmore">▼</div></div>`
    const face = box.querySelector<HTMLElement>('.face')!
    const look = p?.look
    if (look && typeof look === 'object' && hasLooks()) {
      void preparePortrait(look as Look, mood).then(() => {
        const c = portraitOf(look as Look, mood)
        if (!c) return
        face.replaceChildren(c)
        face.classList.add('bust')
        box.querySelector('.dialog')!.classList.add('bust')
      })
      continue
    }
    const a = cat?.characters?.[personLook(p?.id ?? who, p?.type ?? 'actor/person/villager', typeof look === 'string' ? look : undefined)]
    const f = faceFrame(a, mood)
    if (!f) {
      face.classList.add('hidden')
      continue
    }
    void image(picUrl(ctx.store.id, f.img)).then((img) => {
      const w = img.width / f.frames
      const c = document.createElement('canvas')
      c.width = w
      c.height = img.height
      const g = c.getContext('2d')!
      g.imageSmoothingEnabled = false
      g.drawImage(img, f.frame * w, 0, w, img.height, 0, 0, w, img.height)
      face.replaceChildren(c)
    }, () => face.classList.add('hidden'))
  }
}
