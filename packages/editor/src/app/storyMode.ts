// The story and the quests (docs/engine-split.md §6, §16 E2: RPG Maker's event pages, conditions and commands, all
// as forms). The story is one script of steps (world-model.md §6.12): each with the trigger it waits on; a scene
// takes control and plays its commands, a beat does not. A quest is Bethesda's: aliases, objectives, stages
// (docs/quests.md). A step's trigger, a scene's commands (a line shown as the game shows it), a quest's start,
// aliases, objectives and stages are forms; what has none yet (an invariant, a stage's effects) stays JSON.

import type { AliasDef, ObjectiveDef, PropValue, QuestDef, QuestStage, SceneCmd, StepDef, Text } from '@openworld/engine'
import type { StoryFile } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { Form, setKey, valueOf } from './form.ts'
import { CMD_KINDS, cmdForm, cmdKind, paintLines } from './sceneForms.ts'
import { datalists, namesOf, questTriggerForm, stepCondForm } from './triggers.ts'
import { factUses } from './usage.ts'
import { placeOf } from '@openworld/format'
import { phrase } from './lang.ts'
import { esc, t, toast, tx } from './ui.ts'
import { adopt, langName, previewLang, shown } from './words.ts'

const ID = /^[a-z0-9_]+$/

/** A record of plain values (the facts a step sets, a reward's facts): a row each, a row to add one. */
function valueRows(f: Form, rec: Record<string, PropValue> | undefined, set: (r: Record<string, PropValue> | undefined) => void, list = 'dlFacts'): string {
  return `<div class="rows">${Object.entries(rec ?? {}).map(([k, v]) => `<div class="row">${f.text(k, (nk) => set(setKey(rec, k, nk, v)), { list })} = ${f.text(String(v), (nv) => set(setKey(rec, k, k, valueOf(nv))))} ${f.link('✕', () => set(setKey(rec, k, undefined, undefined)), { cls: 'x' })}</div>`).join('')}<div class="row add">${f.text('', (nk) => nk && set(setKey(rec, undefined, nk, 1)), { list, placeholder: t('+ a fact') })}</div></div>`
}

/** Where a step is played from: its trigger's spot, its area's middle, its map's start or middle. */
function whereOf(ctx: Ctx, s: StepDef): { map: string; x: number; y: number } | undefined {
  const map = s.when?.map ?? (s.script?.find((c) => 'warp' in c) as { warp: string } | undefined)?.warp
  const m = map && ctx.store.maps().find((x) => x.data.map.id === map)?.data.map
  if (!m) return undefined
  if (s.when?.spot) return { map: m.id, x: s.when.spot.x, y: s.when.spot.y }
  const r = s.when?.region ? m.regions?.[s.when.region] : undefined
  if (r) return { map: m.id, x: r[0] + Math.floor(r[2] / 2), y: r[1] + Math.floor(r[3] / 2) }
  const st = ctx.store.game.start
  return st.map === m.id ? st : { map: m.id, x: Math.floor(m.width / 2), y: Math.floor(m.height / 2) }
}

/** What a step says first (its line, its hint, its scene's first words), as the editor's language has it: the step's name in the list. */
function stepWords(s: StepDef): string {
  const first = (v: unknown): Text | undefined => {
    if (Array.isArray(v)) for (const x of v) { const f = first(x); if (f) return f }
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      for (const k of ['text', 'line', 'say']) if (typeof o[k] === 'string' || (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && typeof (o[k] as Record<string, unknown>).en === 'string')) return o[k] as Text
      for (const x of Object.values(o)) if (x && typeof x === 'object') { const f = first(x); if (f) return f }
    }
    return undefined
  }
  const w = shown(s.say ?? s.hint ?? first(s.script))
  return w.length > 60 ? `${w.slice(0, 58)}…` : w
}

export class StoryMode implements Mode {
  id = 'story'
  label = phrase('Story')
  private sel?: string

  private steps(ctx: Ctx): { file: string; step: StepDef }[] {
    return ctx.store.list<StoryFile>('story').flatMap((f) => (f.data.steps ?? []).map((step) => ({ file: f.file, step })))
  }
  private edit(ctx: Ctx, file: string, why: string, fn: (s: StepDef) => void): void {
    ctx.store.change<StoryFile>(file, why, (sf) => { const s = sf.steps?.find((x) => x.id === this.sel); if (s) fn(s) })
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const steps = this.steps(ctx)
    const f = new Form()
    const summary = (s: StepDef) => [s.script ? t('scene, {n}', { n: s.script.length }) : t('beat'), s.when?.map, s.when?.after && t('after {step}', { step: s.when.after }), s.manual && t('started by an effect')].filter(Boolean).join(' · ')
    left.innerHTML = `<h3>${t('The story\'s steps')}</h3>
      <div class="palette list" style="max-height:60vh">${steps.map(({ step }) => `<div class="tree-row step ${step.id === this.sel ? 'on' : ''}" data-step="${esc(step.id)}" role="button" tabindex="0"><span>${esc(stepWords(step) || step.id)}</span><small>${esc(step.id)} · ${esc(summary(step))}</small></div>`).join('') || `<p class="muted">${t('No steps yet.')}</p>`}</div>
      <details ${steps.length ? '' : 'open'}><summary>${t('New step')}</summary><label>${t('id')} <input id="stNewId" placeholder="meet_mira"></label>
        <div class="row">${f.button(t('A scene'), () => this.make(ctx, left, true), { title: t('it takes control and plays its commands') })}${f.button(t('A beat'), () => this.make(ctx, left, false), { title: t('it only says, sets facts and waits on its trigger') })}</div></details>`
    left.querySelectorAll<HTMLElement>('[data-step]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.step), ctx.refresh())))
    f.wire(left)
    const sf = ctx.store.list<StoryFile>('story')[0]
    const files = [...ctx.store.list('story'), ...ctx.store.list('quests'), ...ctx.store.list('people'), ...ctx.store.maps(), ...ctx.store.list('rules')]
    const facts = [...factUses(files)].sort(([a], [b]) => a.localeCompare(b))
    const g = new Form()
    const set = (k: keyof StoryFile, v: unknown) => sf && ctx.store.change<StoryFile>(sf.file, t('the story\'s {key}', { key: k }), (x) => (v === undefined ? delete x[k] : ((x as Record<string, unknown>)[k] = v)))
    right.innerHTML = `<h3>${t('The story\'s facts')}</h3>
      <p class="muted">${t('A fact is a word the story remembers (a bell rung, a crown found): where each is set and read.')}</p>
      <ul class="things facts">${facts.map(([k, us]) => `<li><a data-fact="${esc(k)}">${esc(k)}</a><small>${t('{set} set · {read} read', { set: us.filter((u) => u.how === 'set').length, read: us.filter((u) => u.how === 'read').length })}</small></li>`).join('') || `<li class="muted">${t('none yet')}</li>`}</ul>
      <h3>${t('The story as a whole')}</h3>
      ${sf ? `<label>${t('facts only the story changes (their prefixes)')} ${g.text((sf.data.protectedFacts ?? []).join(', '), (v) => set('protectedFacts', v.split(',').map((x) => x.trim()).filter(Boolean).length ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined), { placeholder: 'glade.' })}</label>
        <details><summary>${t('What it keeps true (invariants, {n})', { n: sf.data.invariants?.length ?? 0 })}</summary>${g.json(sf.data.invariants, (v) => set('invariants', v), (m) => toast(m, 'error'), 6)}</details>
        <details><summary>${t('The weather it fixes')}</summary>${g.json(sf.data.weather, (v) => set('weather', v), (m) => toast(m, 'error'), 3)}</details>` : `<p class="muted">${t('No story file yet: make a step.')}</p>`}`
    right.querySelectorAll<HTMLElement>('[data-fact]').forEach((a) => (a.onclick = () => ctx.open('find', undefined, `fact:${a.dataset.fact}`)))
    g.wire(right)
  }

  private make(ctx: Ctx, left: HTMLElement, scene: boolean): void {
    const id = left.querySelector<HTMLInputElement>('#stNewId')!.value.trim()
    if (!ID.test(id)) return toast(t('A step\'s id: lower case, digits and _.'), 'warn')
    if (this.steps(ctx).some((s) => s.step.id === id)) return toast(t('There is a step {id} already.', { id }), 'warn')
    const file = ctx.store.list<StoryFile>('story')[0]?.file ?? 'story/story.json'
    this.sel = id
    const step: StepDef = scene ? { id, when: { map: ctx.map }, script: [{ say: 'player', text: '…' }] } : { id, when: { map: ctx.map }, say: '…' }
    if (!ctx.store.get(file)) ctx.store.add(file, { steps: [step] }, t('a new step {id}', { id }))
    else ctx.store.change<StoryFile>(file, t('a new step {id}', { id }), (sf) => (sf.steps ??= []).push(step))
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const at = this.steps(ctx).find((s) => s.step.id === this.sel)
    if (!at) return void (el.innerHTML = `<p class="muted">${t('Choose a step on the left, or make one. A scene takes control and plays its commands in order; a beat only says, sets facts, and waits on its trigger.')}</p>`)
    const s = at.step
    // where its commands are in its file (their words' places, for the line's preview)
    const si = ctx.store.get<StoryFile>(at.file)?.steps?.findIndex((x) => x.id === s.id) ?? -1
    const script = s.script ?? []
    const f = new Form()
    const edit = (why: string, fn: (s: StepDef) => void) => this.edit(ctx, at.file, why, fn)
    const put = <K extends keyof StepDef>(k: K, v: StepDef[K] | undefined) => edit(`${s.id}: ${k}`, (x) => (v === undefined ? delete x[k] : (x[k] = v)))
    const kinds = CMD_KINDS.map(([k, l]): [string, string] => [k, t(l)])
    const cmds = script.map((c, i) => `<div class="cmdcard"><div class="row"><b>${i + 1}</b> ${f.select(kinds, cmdKind(c), (k) => edit(t('{id}: a command', { id: s.id }), (x) => (x.script![i] = CMD_KINDS.find(([kk]) => kk === k)![2](ctx))))}<span class="grow"></span>${f.link('↑', () => i > 0 && edit(t('{id}: the order', { id: s.id }), (x) => x.script!.splice(i - 1, 0, ...x.script!.splice(i, 1))), { title: t('earlier') })} ${f.link('↓', () => edit(t('{id}: the order', { id: s.id }), (x) => { if (i < x.script!.length - 1) x.script!.splice(i + 1, 0, ...x.script!.splice(i, 1)) }), { title: t('later') })} ${f.link('⧉', () => edit(t('{id}: a command', { id: s.id }), (x) => x.script!.splice(i + 1, 0, structuredClone(c))), { title: t('again below') })} ${f.link('✕', () => edit(t('{id}: a command', { id: s.id }), (x) => { x.script!.splice(i, 1); if (!x.script!.length) delete x.script }), { cls: 'x', title: t('remove') })}</div>
        ${cmdForm(f, ctx, c, (nc: SceneCmd) => edit(t('{id}: a command', { id: s.id }), (x) => (x.script![i] = nc)), si >= 0 ? placeOf(at.file, ['steps', si, 'script', i]) : undefined)}</div>`)
    el.innerHTML = `${datalists(ctx)}<div class="row"><h3 class="grow">${esc(s.id)} <small class="muted">${s.script ? t('a scene') : t('a beat')} · ${t('in {file}', { file: `<code>${esc(at.file)}</code>` })}</small></h3>
        ${f.button(`▶ ${t('Play from this scene')}`, () => void ctx.playtest(whereOf(ctx, s), { scene: s.id }), { title: t('save, and a new game on its map with this step begun at once') })}
        ${f.button(t('Where it is used'), () => ctx.open('find', undefined, s.id))}
        ${f.button(t('Remove the step'), () => { if (!confirm(t('Remove the step {id}?', { id: s.id }))) return; ctx.store.change<StoryFile>(at.file, t('remove {id}', { id: s.id }), (sf) => sf.steps!.splice(sf.steps!.findIndex((x) => x.id === s.id), 1)); this.sel = undefined }, { cls: 'danger' })}</div>
      <div class="cols"><div>
        <div class="box"><h3>${t('When it plays')}</h3>${stepCondForm(f, ctx, s.when, (c) => put('when', c))}
          <div class="chips">${f.check(s.manual, t('only when an effect starts it'), (v) => put('manual', v || undefined))}${f.check(s.repeat, t('again each day'), (v) => put('repeat', v || undefined))}</div></div>
        <div class="box"><h3>${t('As it plays')}</h3>
          <label>${t('the companion says')} ${f.words(s.say, (w) => put('say', w))}</label>
          <label>${t('its hint, when the companion is asked')} ${f.words(s.hint, (w) => put('hint', w))}</label>
          <label>${t('the facts it sets')}</label>${valueRows(f, s.facts, (r) => put('facts', r))}</div>
      </div><div>
        <div class="row"><h3 class="grow">${script.length === 1 ? t('Its scene (1 command)') : t('Its scene ({n} commands)', { n: script.length })}</h3><span class="muted">${t('lines shown in {lang} (the preview language)', { lang: langName(previewLang()) })}</span></div>
        ${cmds.join('') || `<p class="muted">${t('No commands: a beat. Add one to make it a scene that takes control.')}</p>`}
        <div class="row add">${f.select(kinds, '', (k) => k && edit(t('{id}: a command', { id: s.id }), (x) => (x.script ??= []).push(CMD_KINDS.find(([kk]) => kk === k)![2](ctx))), { none: t('+ a command') })}</div>
      </div></div>`
    f.wire(el)
    paintLines(ctx, el)
  }

  focus(ctx: Ctx, file: string, at?: string): void {
    this.sel = at ?? this.sel ?? ctx.store.get<StoryFile>(file)?.steps?.[0]?.id
  }
}

// ------------------------------------------------------------------ the quests

const START_KINDS: [string, string][] = [['auto', phrase('by itself, when its trigger holds')], ['offer', phrase('offered by someone (accept or decline)')], ['manual', phrase('only when an effect begins it')], ['news', phrase('radiant: on news (JSON)')]]
const COUNT_KINDS: [string, string][] = [['', phrase('done by a trigger')], ['carry', phrase('counts what the taker carries')], ['kill', phrase('counts what the taker fells')], ['fact', phrase('counts a fact of the story')]]
/** A list's labels in the editor's language. */
const said = (l: [string, string][]): [string, string][] => l.map(([k, v]) => [k, t(v)])

export class QuestsMode implements Mode {
  id = 'quests'
  label = phrase('Quests')
  private sel?: string

  private file(ctx: Ctx): string | undefined {
    return ctx.store.list<QuestDef>('quests').find((q) => q.data.id === this.sel)?.file
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const quests = ctx.store.list<QuestDef>('quests')
    left.innerHTML = `<h3>${t('Quests')}</h3>
      <div class="palette list" style="max-height:60vh">${quests.map((q) => `<div class="tree-row ${q.data.id === this.sel ? 'on' : ''}" data-quest="${esc(q.data.id)}">${esc(tx(q.data.title))}<small>${esc(q.data.id)} · ${esc(q.data.kind)}</small></div>`).join('') || `<p class="muted">${t('No quests yet.')}</p>`}</div>
      <details><summary>${t('New quest')}</summary><label>${t('id')} <input id="qNewId" placeholder="lost_ring"></label><label>${t('given by')} <select id="qNewGiver">${ctx.store.list<{ id: string }>('people').map((p) => `<option>${esc(p.data.id)}</option>`).join('')}</select></label><button id="qNew">${t('Make a favour')}</button>
        <p class="muted">${t('A person\'s favour with a picked shape (bring, defeat, a word with someone) is quicker from the map: the Things layer\'s Quick tool, "Quest giver".')}</p></details>`
    left.querySelectorAll<HTMLElement>('[data-quest]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.quest), ctx.refresh())))
    left.querySelector<HTMLButtonElement>('#qNew')!.onclick = () => {
      const id = left.querySelector<HTMLInputElement>('#qNewId')!.value.trim()
      if (!ID.test(id)) return toast(t('A quest\'s id: lower case, digits and _.'), 'warn')
      if (quests.some((q) => q.data.id === id)) return toast(t('There is a quest {id} already.', { id }), 'warn')
      const giver = left.querySelector<HTMLSelectElement>('#qNewGiver')!.value
      this.sel = id
      // its first words in the game's language; the translations the editor knows for them, into the tables
      ctx.store.batch(t('a new quest {id}', { id }), () => {
        const w = (x: Text) => adopt(x) ?? ''
        const q: QuestDef = {
          id, kind: 'side', title: w({ en: 'A Favour', zh: '一个忙' }), summary: w({ en: '{giver} asks a favour.', zh: '{giver}请你帮个忙。' }),
          aliases: giver ? { giver: { id: giver, essential: true } } : {},
          objectives: [{ id: 'back', text: w({ en: 'Back to {giver}', zh: '回去找{giver}' }), target: 'giver', talk: true }],
          stages: [{ n: 10, log: w({ en: '{giver} asks a favour.', zh: '{giver}请你帮个忙。' }), show: ['back'] }, { n: 100, on: { talk: 'giver' }, done: ['back'], complete: true, reward: { xp: 10 }, log: w({ en: 'Done.', zh: '完成了。' }) }],
          start: giver ? { auto: { talk: 'giver' } } : { manual: true },
        }
        ctx.store.add(`quests/${id}.json`, q, t('a new quest {id}', { id }))
      })
    }
    right.innerHTML = `<h3>${t('Quests')}</h3><p class="muted">${esc(t('A quest under way keeps its own progress: the people and things it is about are filled in as it begins, its objectives count themselves, and each stage comes when its trigger holds. In its words, {alias} names one of the people or things it is about.', { alias: '{alias}' }))}</p>`
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const file = this.file(ctx)
    const q = file ? ctx.store.get<QuestDef>(file) : undefined
    if (!q || !file) return void (el.innerHTML = `<p class="muted">${t('Choose a quest on the left, or make one.')}</p>`)
    const f = new Form()
    const bad = (m: string) => toast(m, 'error')
    const edit = (why: string, fn: (q: QuestDef) => void) => ctx.store.change<QuestDef>(file, why, fn)
    const put = <K extends keyof QuestDef>(k: K, v: QuestDef[K] | undefined) => edit(`${q.id}: ${String(k)}`, (x) => (v === undefined ? delete x[k] : (x[k] = v)))
    const aliases = Object.keys(q.aliases ?? {})
    const objIds = (q.objectives ?? []).map((o) => o.id)
    const parts: string[] = []
    parts.push(`${datalists(ctx)}<div class="row"><h3 class="grow">${esc(tx(q.title))} <small class="muted">${esc(q.id)} · ${t('in {file}', { file: `<code>${esc(file)}</code>` })}</small></h3>${f.button(t('Where it is used'), () => ctx.open('find', undefined, q.id))}${f.button(t('Remove the quest'), () => { if (confirm(t('Remove the quest {id}?', { id: q.id }))) (ctx.store.remove(file, t('remove {id}', { id: q.id })), (this.sel = undefined)) }, { cls: 'danger' })}</div>`)
    // the quest itself
    const lines = ['offer', 'accepted', 'declined', 'waiting'] as const
    const start = q.start
    const sk = 'auto' in start ? 'auto' : 'offer' in start && !('news' in start) ? 'offer' : 'news' in start ? 'news' : 'manual'
    const startBody =
      sk === 'auto' ? `${t('when')} ${questTriggerForm(f, ctx, q, (start as { auto: never }).auto, (t) => put('start', t ? { auto: t } : { manual: true }))}`
      : sk === 'offer' ? `${t('by')} ${f.select(aliases, (start as { offer: string }).offer, (a) => put('start', { ...(start as { offer: string }), offer: a }))} ${t('once')} ${questTriggerForm(f, ctx, q, (start as { when?: never }).when, (t) => put('start', { ...(start as { offer: string }), ...(t ? { when: t } : { when: undefined }) }))}`
      : sk === 'news' ? f.json(start, (v) => put('start', v as QuestDef['start']), bad, 2) : ''
    parts.push(`<div class="cols"><div class="box"><h3>${t('The quest')}</h3>
      <label>${t('kind')} ${f.select(['main', 'side', 'favor'], q.kind, (v) => put('kind', v as QuestDef['kind']))} · ${t('repeat')} ${f.select([['', t('once')], ['daily', t('each day')], ['always', t('at once again')]], q.repeat ?? '', (v) => put('repeat', (v || undefined) as QuestDef['repeat']))} · ${t('fails after')} ${f.num(q.deadline, (v) => put('deadline', v), { min: 1, placeholder: t('never') })} ${t('game hours')}</label>
      <label>${t('title')} ${f.words(q.title, (w) => put('title', w ?? q.id))}</label>
      <label>${t('summary')} ${f.words(q.summary, (w) => put('summary', w ?? ''), { area: true })}</label>
      ${lines.map((k) => `<label>${t('the giver\'s line: {key}', { key: k })} ${f.words(q[k], (w) => put(k, w))}</label>`).join('')}
      </div><div class="box"><h3>${t('How it begins')}</h3>
      <label>${f.select(said(START_KINDS), sk, (v) => put('start', v === 'auto' ? { auto: { talk: aliases[0] ?? 'giver' } } : v === 'offer' ? { offer: aliases[0] ?? 'giver' } : v === 'news' ? { news: 'talk', offer: aliases[0] ?? 'giver' } : { manual: true }))}</label>
      <div class="trigline">${startBody}</div>
      <h3>${t('Who and what it is about (aliases)')}</h3>${this.aliases(f, ctx, q, (a) => put('aliases', a))}</div></div>`)
    // objectives
    const objs = (q.objectives ?? []).map((o, i) => {
      const set = (no: ObjectiveDef | undefined) => edit(t('{id}: an objective', { id: q.id }), (x) => { if (no) x.objectives![i] = no; else x.objectives!.splice(i, 1) })
      const ck = o.count ? Object.keys(o.count)[0] : ''
      const cv = o.count ? (Object.values(o.count)[0] as unknown) : undefined
      const targets = ([] as string[]).concat(o.target ?? [])
      return `<div class="cmdcard"><div class="row"><b>${esc(o.id)}</b> ${f.text(o.id, (v) => v && ID.test(v) && set({ ...o, id: v }))}<span class="grow"></span>${f.link('✕', () => set(undefined), { cls: 'x' })}</div>
        <label>${t('what it asks')} ${f.words(o.text, (w) => set({ ...o, text: w ?? '' }))}</label>
        <div class="chips">${t('points at')} ${aliases.map((a) => f.check(targets.includes(a), `{${a}}`, (on) => { const ts = on ? [...targets, a] : targets.filter((y) => y !== a); set({ ...o, ...(ts.length ? { target: ts.length === 1 ? ts[0] : ts } : { target: undefined }) }) })).join('')} ${f.check(o.talk, t('someone to speak to (?)'), (v) => set({ ...o, talk: v || undefined }))} ${f.check(o.optional, t('optional'), (v) => set({ ...o, optional: v || undefined }))}</div>
        <div class="row">${f.select(said(COUNT_KINDS), ck, (k) => set({ ...o, count: k === 'carry' ? { carry: { type: 'item/' } } : k === 'kill' ? { kill: { type: 'actor/creature/' } } : k === 'fact' ? { fact: 'story.' } : undefined }))}
          ${ck === 'carry' || ck === 'kill' ? `${typeof cv === 'string' ? f.select(aliases, cv, (a) => set({ ...o, count: { [ck]: a } as never })) : f.text((cv as { type?: string })?.type, (t) => set({ ...o, count: { [ck]: { ...(cv as object), type: t } } as never }), { list: 'dlKinds' })} ${t('need')} ${f.num(o.need ?? 1, (v) => set({ ...o, need: v ?? 1 }), { min: 1 })}` : ck === 'fact' ? `${f.text(String(cv), (v) => set({ ...o, count: { fact: v } }), { list: 'dlFacts' })} ${t('need')} ${f.num(o.need ?? 1, (v) => set({ ...o, need: v ?? 1 }), { min: 1 })}` : `<span class="trigline">${questTriggerForm(f, ctx, q, o.on, (t) => set({ ...o, ...(t ? { on: t } : { on: undefined }) }))}</span>`}</div>
        <label>${t('said when done')} ${f.words(o.say, (w) => set({ ...o, say: w }))}</label></div>`
    })
    parts.push(`<div class="box"><div class="row"><h3 class="grow">${t('Objectives')}</h3>${f.button(t('+ An objective'), () => edit(t('{id}: an objective', { id: q.id }), (x) => (x.objectives ??= []).push({ id: `o${(x.objectives?.length ?? 0) + 1}`, text: '…' })))}</div>${objs.join('') || `<p class="muted">${t('None: the stages say what to do.')}</p>`}</div>`)
    // stages
    const stages = q.stages.map((s, i) => this.stage(f, ctx, q, s, aliases, objIds, (ns) => edit(t('{id}: stage {n}', { id: q.id, n: s.n }), (x) => { if (ns) x.stages[i] = ns; else x.stages.splice(i, 1) })))
    parts.push(`<div class="box"><div class="row"><h3 class="grow">${t('Stages')}</h3>${f.button(t('+ A stage'), () => edit(t('{id}: a stage', { id: q.id }), (x) => x.stages.push({ n: (x.stages[x.stages.length - 1]?.n ?? 0) + 10, log: '…' })))}</div><p class="muted">${t('The first is where it begins; each later one is reached by its trigger (or a notice), and one may complete or fail it.')}</p>${stages.join('')}</div>`)
    parts.push(`<details><summary>${t('Its topics in the talk panel ({n})', { n: q.topics?.length ?? 0 })}</summary>${f.json(q.topics, (v) => put('topics', v as QuestDef['topics']), bad, 3)}</details>`)
    el.innerHTML = parts.join('')
    f.wire(el)
  }

  private aliases(f: Form, ctx: Ctx, q: QuestDef, set: (a: QuestDef['aliases']) => void): string {
    const rec = q.aliases ?? {}
    const n = namesOf(ctx)
    const places = n.maps.flatMap((m) => [m, ...n.regions(m).map((r) => `${m}:${r}`)])
    const row = (name: string, a: AliasDef) => {
      const put = (na: AliasDef | undefined, key = name) => set(setKey(rec, name, key, na) ?? {})
      const what = a.id !== undefined ? 'id' : a.place !== undefined ? 'place' : a.find ? 'find' : a.make ? 'make' : a.from ? 'from' : 'id'
      const body =
        what === 'id' ? f.text(a.id, (v) => put({ ...a, id: v }), { list: 'dlThings', placeholder: t('a person or a thing by id') })
        : what === 'place' ? f.select(places, a.place, (v) => put({ ...a, place: v }))
        : f.json(a[what as 'find'], (v) => put({ ...a, [what]: v }), (m) => toast(m, 'error'), 2)
      return `<div class="cond"><span class="lbl">{${esc(name)}}</span>${f.select([['id', t('this one')], ['place', t('a place')], ['find', t('found (JSON)')], ['make', t('made (JSON)')]], what, (w) => put(w === 'place' ? { place: ctx.map } : w === 'find' ? { find: { type: 'item/' } } : w === 'make' ? { make: { type: 'item/' } } : { id: '' }))} ${body}
        <span class="chips">${f.check(a.essential, t('cannot die'), (v) => put({ ...a, essential: v || undefined }))}${f.check(a.keep, t('a quest item'), (v) => put({ ...a, keep: v || undefined }))}${f.check(a.optional, t('may stay empty'), (v) => put({ ...a, optional: v || undefined }))}</span>${f.link('✕', () => put(undefined), { cls: 'x' })}</div>`
    }
    return `<div class="conds">${Object.entries(rec).map(([k, a]) => row(k, a)).join('')}<div class="row add">${f.text('', (k) => k && ID.test(k) && set({ ...rec, [k]: { id: '' } }), { placeholder: t('+ an alias (giver, ring, place …)') })}</div></div>`
  }

  private stage(f: Form, ctx: Ctx, q: QuestDef, s: QuestStage, aliases: string[], objIds: string[], set: (s: QuestStage | undefined) => void): string {
    const put = <K extends keyof QuestStage>(k: K, v: QuestStage[K] | undefined) => set({ ...s, [k]: v } as QuestStage)
    const chips = (k: 'show' | 'done' | 'fail', label: string) => `<span class="chips">${label} ${objIds.map((o) => f.check(s[k]?.includes(o), o, (on) => { const l = on ? [...(s[k] ?? []), o] : (s[k] ?? []).filter((x) => x !== o); put(k, l.length ? l : undefined) })).join('') || `<span class="muted">${t('(no objectives)')}</span>`}</span>`
    const r = s.reward ?? {}
    const putR = (nr: typeof r) => put('reward', Object.keys(nr).some((k) => (nr as Record<string, unknown>)[k] !== undefined) ? nr : undefined)
    const items = r.items ?? []
    const takes = s.take ?? []
    return `<div class="cmdcard stage"><div class="row"><b>${t('stage')}</b> ${f.num(s.n, (v) => put('n', v ?? s.n), { min: 0 })} ${f.check(s.complete, t('completes it'), (v) => put('complete', v || undefined))} ${f.check(s.failed, t('fails it'), (v) => put('failed', v || undefined))}<span class="grow"></span>${f.link('✕', () => set(undefined), { cls: 'x' })}</div>
      <div class="trigline">${t('reached when')} ${questTriggerForm(f, ctx, q, s.on, (w) => put('on', w))} <span class="muted">${s.on ? '' : t('(none: where it begins, or a notice sets it)')}</span></div>
      <label>${t('the journal\'s line')} ${f.words(s.log, (w) => put('log', w))}</label>
      <label>${t('said on reaching it')} ${f.words(s.say, (w) => put('say', w))} ${t('by')} ${f.select(aliases, s.by, (v) => put('by', v || undefined), { none: t('the one spoken to, else the giver') })}</label>
      <div class="row">${chips('show', t('shows'))}</div><div class="row">${chips('done', t('done'))}</div><div class="row">${chips('fail', t('failed'))}</div>
      <details ${takes.length || items.length || r.xp ? 'open' : ''}><summary>${t('Taken, and the reward')}</summary>
        ${takes.map((tk, i) => `<div class="row">${t('takes')} ${f.num(tk.count, (v) => put('take', takes.map((x, j) => (j === i ? { ...x, count: v ?? 1 } : x))), { min: 1 })} × ${typeof tk.match === 'string' ? f.select(aliases, tk.match, (v) => put('take', takes.map((x, j) => (j === i ? { ...x, match: v } : x)))) : f.text(tk.match.type, (v) => put('take', takes.map((x, j) => (j === i ? { ...x, match: { type: v } } : x))), { list: 'dlKinds' })} ${f.link('✕', () => put('take', takes.filter((_, j) => j !== i).length ? takes.filter((_, j) => j !== i) : undefined), { cls: 'x' })}</div>`).join('')}
        <div class="row add">${f.text('', (v) => v && put('take', [...takes, { match: { type: v }, count: 1 }]), { list: 'dlKinds', placeholder: t('+ something taken from the taker') })}</div>
        <label>${t('experience')} ${f.num(r.xp, (v) => putR({ ...r, xp: v }), { min: 0 })}</label>
        ${items.map((it, i) => `<div class="row">${t('gives')} ${f.num(it.count, (v) => putR({ ...r, items: items.map((x, j) => (j === i ? { ...x, count: v ?? 1 } : x)) }), { min: 1 })} × ${f.text(it.type, (v) => putR({ ...r, items: items.map((x, j) => (j === i ? { ...x, type: v } : x)) }), { list: 'dlKinds' })} ${f.link('✕', () => putR({ ...r, items: items.filter((_, j) => j !== i).length ? items.filter((_, j) => j !== i) : undefined }), { cls: 'x' })}</div>`).join('')}
        <div class="row add">${f.text('', (v) => v && putR({ ...r, items: [...items, { type: v, count: 1 }] }), { list: 'dlKinds', placeholder: t('+ a thing given') })}</div>
        <label>${t('facts the story keeps')}</label>${valueRows(f, r.facts, (rec) => putR({ ...r, facts: rec }))}
      </details>
      <details><summary>${t('Its hint, the stages it follows, its effects (JSON)')}</summary>
        <label>${t('the companion\'s hint')} ${f.words(s.hint, (w) => put('hint', w))}</label>
        <label>${t('follows only')} ${f.text((s.from ?? []).join(', '), (v) => { const l = v.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0); put('from', l.length ? l : undefined) }, { placeholder: t('any lower stage') })}</label>
        <label>${t('its effects')} ${f.json(s.do, (v) => put('do', v as QuestStage['do']), (m) => toast(m, 'error'), 2)}</label>
        <label>${t('its lessons')} ${f.json(s.lessons, (v) => put('lessons', v as QuestStage['lessons']), (m) => toast(m, 'error'), 2)}</label>
      </details></div>`
  }

  focus(ctx: Ctx, file: string): void {
    this.sel = ctx.store.get<QuestDef>(file)?.id ?? this.sel
  }
}
