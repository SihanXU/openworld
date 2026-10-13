// The story and the quests (docs/engine-split.md §6, §16 E2: RPG Maker's event pages, conditions and commands, all
// as forms). The story is one script of steps (world-model.md §6.12): each with the trigger it waits on; a scene
// takes control and plays its commands, a beat does not. A quest is Bethesda's: aliases, objectives, stages
// (docs/quests.md). A step's trigger, a scene's commands (a line shown as the game shows it), a quest's start,
// aliases, objectives and stages are forms; what has none yet (an invariant, a stage's effects) stays JSON.

import type { AliasDef, ObjectiveDef, PropValue, QuestDef, QuestStage, SceneCmd, StepDef } from '@openworld/engine'
import type { StoryFile } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { Form, setKey, valueOf } from './form.ts'
import { CMD_KINDS, cmdForm, cmdKind, paintLines } from './sceneForms.ts'
import { datalists, namesOf, questTriggerForm, stepCondForm } from './triggers.ts'
import { factUses } from './usage.ts'
import { esc, toast, tx } from './ui.ts'

const ID = /^[a-z0-9_]+$/

/** A record of plain values (the facts a step sets, a reward's facts): a row each, a row to add one. */
function valueRows(f: Form, rec: Record<string, PropValue> | undefined, set: (r: Record<string, PropValue> | undefined) => void, list = 'dlFacts'): string {
  return `<div class="rows">${Object.entries(rec ?? {}).map(([k, v]) => `<div class="row">${f.text(k, (nk) => set(setKey(rec, k, nk, v)), { list })} = ${f.text(String(v), (nv) => set(setKey(rec, k, k, valueOf(nv))))} ${f.link('✕', () => set(setKey(rec, k, undefined, undefined)), { cls: 'x' })}</div>`).join('')}<div class="row add">${f.text('', (nk) => nk && set(setKey(rec, undefined, nk, 1)), { list, placeholder: '+ a fact' })}</div></div>`
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

export class StoryMode implements Mode {
  id = 'story'
  label = 'Story'
  private sel?: string
  private lang: 'en' | 'zh' = 'en'

  private steps(ctx: Ctx): { file: string; step: StepDef }[] {
    return ctx.store.list<StoryFile>('story').flatMap((f) => (f.data.steps ?? []).map((step) => ({ file: f.file, step })))
  }
  private edit(ctx: Ctx, file: string, why: string, fn: (s: StepDef) => void): void {
    ctx.store.change<StoryFile>(file, why, (sf) => { const s = sf.steps?.find((x) => x.id === this.sel); if (s) fn(s) })
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const steps = this.steps(ctx)
    const f = new Form()
    const summary = (s: StepDef) => [s.script ? `scene, ${s.script.length}` : 'beat', s.when?.map, s.when?.after && `after ${s.when.after}`, s.manual && 'started by an effect'].filter(Boolean).join(' · ')
    left.innerHTML = `<h3>The story's steps</h3>
      <div class="palette list" style="max-height:60vh">${steps.map(({ step }) => `<div class="tree-row ${step.id === this.sel ? 'on' : ''}" data-step="${esc(step.id)}">${esc(step.id)}<small>${esc(summary(step))}</small></div>`).join('') || '<p class="muted">No steps yet.</p>'}</div>
      <details ${steps.length ? '' : 'open'}><summary>New step</summary><label>id <input id="stNewId" placeholder="meet_mira"></label>
        <div class="row">${f.button('A scene', () => this.make(ctx, left, true), { title: 'it takes control and plays its commands' })}${f.button('A beat', () => this.make(ctx, left, false), { title: 'it only says, sets facts and waits on its trigger' })}</div></details>`
    left.querySelectorAll<HTMLElement>('[data-step]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.step), ctx.refresh())))
    f.wire(left)
    const sf = ctx.store.list<StoryFile>('story')[0]
    const files = [...ctx.store.list('story'), ...ctx.store.list('quests'), ...ctx.store.list('people'), ...ctx.store.maps(), ...ctx.store.list('rules')]
    const facts = [...factUses(files)].sort(([a], [b]) => a.localeCompare(b))
    const g = new Form()
    const set = (k: keyof StoryFile, v: unknown) => sf && ctx.store.change<StoryFile>(sf.file, `the story's ${k}`, (x) => (v === undefined ? delete x[k] : ((x as Record<string, unknown>)[k] = v)))
    right.innerHTML = `<h3>The story's facts</h3>
      <table class="facts">${facts.map(([k, us]) => `<tr><td><a data-fact="${esc(k)}">${esc(k)}</a></td><td class="muted">${us.filter((u) => u.how === 'set').length} set · ${us.filter((u) => u.how === 'read').length} read</td></tr>`).join('') || '<tr><td class="muted">none yet</td></tr>'}</table>
      <h3>The story as a whole</h3>
      ${sf ? `<label>facts only the story changes (their prefixes) ${g.text((sf.data.protectedFacts ?? []).join(', '), (v) => set('protectedFacts', v.split(',').map((x) => x.trim()).filter(Boolean).length ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined), { placeholder: 'glade.' })}</label>
        <details><summary>What it keeps true (invariants, ${sf.data.invariants?.length ?? 0})</summary>${g.json(sf.data.invariants, (v) => set('invariants', v), (m) => toast(m, 'error'), 6)}</details>
        <details><summary>The weather it fixes</summary>${g.json(sf.data.weather, (v) => set('weather', v), (m) => toast(m, 'error'), 3)}</details>` : '<p class="muted">No story file yet: make a step.</p>'}`
    right.querySelectorAll<HTMLElement>('[data-fact]').forEach((a) => (a.onclick = () => ctx.open('find', undefined, `fact:${a.dataset.fact}`)))
    g.wire(right)
  }

  private make(ctx: Ctx, left: HTMLElement, scene: boolean): void {
    const id = left.querySelector<HTMLInputElement>('#stNewId')!.value.trim()
    if (!ID.test(id)) return toast('A step\'s id: lower case, digits and _.', 'warn')
    if (this.steps(ctx).some((s) => s.step.id === id)) return toast(`There is a step ${id} already.`, 'warn')
    const file = ctx.store.list<StoryFile>('story')[0]?.file ?? 'story/story.json'
    this.sel = id
    const step: StepDef = scene ? { id, when: { map: ctx.map }, script: [{ say: 'player', text: { en: '…', zh: '……' } }] } : { id, when: { map: ctx.map }, say: { en: '…', zh: '……' } }
    if (!ctx.store.get(file)) ctx.store.add(file, { steps: [step] }, `a new step ${id}`)
    else ctx.store.change<StoryFile>(file, `a new step ${id}`, (sf) => (sf.steps ??= []).push(step))
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const at = this.steps(ctx).find((s) => s.step.id === this.sel)
    if (!at) return void (el.innerHTML = '<p class="muted">Choose a step on the left, or make one. A scene takes control and plays its commands in order; a beat only says, sets facts, and waits on its trigger.</p>')
    const s = at.step
    const script = s.script ?? []
    const f = new Form()
    const edit = (why: string, fn: (s: StepDef) => void) => this.edit(ctx, at.file, why, fn)
    const put = <K extends keyof StepDef>(k: K, v: StepDef[K] | undefined) => edit(`${s.id}: ${k}`, (x) => (v === undefined ? delete x[k] : (x[k] = v)))
    const cmds = script.map((c, i) => `<div class="cmdcard"><div class="row"><b>${i + 1}</b> ${f.select(CMD_KINDS.map(([k, l]) => [k, l]), cmdKind(c), (k) => edit(`${s.id}: a command`, (x) => (x.script![i] = CMD_KINDS.find(([kk]) => kk === k)![2](ctx))))}<span class="grow"></span>${f.link('↑', () => i > 0 && edit(`${s.id}: the order`, (x) => x.script!.splice(i - 1, 0, ...x.script!.splice(i, 1))), { title: 'earlier' })} ${f.link('↓', () => edit(`${s.id}: the order`, (x) => { if (i < x.script!.length - 1) x.script!.splice(i + 1, 0, ...x.script!.splice(i, 1)) }), { title: 'later' })} ${f.link('⧉', () => edit(`${s.id}: a command`, (x) => x.script!.splice(i + 1, 0, structuredClone(c))), { title: 'again below' })} ${f.link('✕', () => edit(`${s.id}: a command`, (x) => { x.script!.splice(i, 1); if (!x.script!.length) delete x.script }), { cls: 'x', title: 'remove' })}</div>
        ${cmdForm(f, ctx, c, (nc: SceneCmd) => edit(`${s.id}: a command`, (x) => (x.script![i] = nc)))}</div>`)
    el.innerHTML = `${datalists(ctx)}<div class="row"><h3 class="grow">${esc(s.id)} <small class="muted">${s.script ? 'a scene' : 'a beat'} · in <code>${esc(at.file)}</code></small></h3>
        ${f.button('▶ Play from this scene', () => void ctx.playtest(whereOf(ctx, s), { scene: s.id }), { title: 'save, and a new game on its map with this step begun at once' })}
        ${f.button('Where it is used', () => ctx.open('find', undefined, s.id))}
        ${f.button('Remove the step', () => { if (!confirm(`Remove the step ${s.id}?`)) return; ctx.store.change<StoryFile>(at.file, `remove ${s.id}`, (sf) => sf.steps!.splice(sf.steps!.findIndex((x) => x.id === s.id), 1)); this.sel = undefined }, { cls: 'danger' })}</div>
      <div class="cols"><div>
        <div class="box"><h3>When it plays</h3>${stepCondForm(f, ctx, s.when, (c) => put('when', c))}
          <div class="chips">${f.check(s.manual, 'only when an effect starts it', (v) => put('manual', v || undefined))}${f.check(s.repeat, 'again each day', (v) => put('repeat', v || undefined))}</div></div>
        <div class="box"><h3>As it plays</h3>
          <label>the companion says ${f.words(s.say, (t) => put('say', t))}</label>
          <label>its hint, when the companion is asked ${f.words(s.hint, (t) => put('hint', t))}</label>
          <label>the facts it sets</label>${valueRows(f, s.facts, (r) => put('facts', r))}</div>
      </div><div>
        <div class="row"><h3 class="grow">Its scene (${script.length} command${script.length === 1 ? '' : 's'})</h3><span class="muted">lines in</span> ${f.select([['en', 'English'], ['zh', '中文']], this.lang, (l) => ((this.lang = l as 'en'), ctx.refresh()))}</div>
        ${cmds.join('') || '<p class="muted">No commands: a beat. Add one to make it a scene that takes control.</p>'}
        <div class="row add">${f.select(CMD_KINDS.map(([k, l]) => [k, l]), '', (k) => k && edit(`${s.id}: a command`, (x) => (x.script ??= []).push(CMD_KINDS.find(([kk]) => kk === k)![2](ctx))), { none: '+ a command' })}</div>
      </div></div>`
    f.wire(el)
    paintLines(ctx, el, this.lang)
  }

  focus(ctx: Ctx, file: string, at?: string): void {
    this.sel = at ?? this.sel ?? ctx.store.get<StoryFile>(file)?.steps?.[0]?.id
  }
}

// ------------------------------------------------------------------ the quests

const START_KINDS: [string, string][] = [['auto', 'by itself, when its trigger holds'], ['offer', 'offered by someone (accept or decline)'], ['manual', 'only when an effect begins it'], ['news', 'radiant: on news (JSON)']]
const COUNT_KINDS: [string, string][] = [['', 'done by a trigger'], ['carry', 'counts what the taker carries'], ['kill', 'counts what the taker fells'], ['fact', 'counts a fact of the story']]

export class QuestsMode implements Mode {
  id = 'quests'
  label = 'Quests'
  private sel?: string

  private file(ctx: Ctx): string | undefined {
    return ctx.store.list<QuestDef>('quests').find((q) => q.data.id === this.sel)?.file
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const quests = ctx.store.list<QuestDef>('quests')
    left.innerHTML = `<h3>Quests</h3>
      <div class="palette list" style="max-height:60vh">${quests.map((q) => `<div class="tree-row ${q.data.id === this.sel ? 'on' : ''}" data-quest="${esc(q.data.id)}">${esc(tx(q.data.title))}<small>${esc(q.data.id)} · ${esc(q.data.kind)}</small></div>`).join('') || '<p class="muted">No quests yet.</p>'}</div>
      <details><summary>New quest</summary><label>id <input id="qNewId" placeholder="lost_ring"></label><label>given by <select id="qNewGiver">${ctx.store.list<{ id: string }>('people').map((p) => `<option>${esc(p.data.id)}</option>`).join('')}</select></label><button id="qNew">Make a favour</button>
        <p class="muted">A person's favour with a picked shape (bring, defeat, a word with someone) is quicker from the map: the Things layer's Quick tool, "Quest giver".</p></details>`
    left.querySelectorAll<HTMLElement>('[data-quest]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.quest), ctx.refresh())))
    left.querySelector<HTMLButtonElement>('#qNew')!.onclick = () => {
      const id = left.querySelector<HTMLInputElement>('#qNewId')!.value.trim()
      if (!ID.test(id)) return toast('A quest\'s id: lower case, digits and _.', 'warn')
      if (quests.some((q) => q.data.id === id)) return toast(`There is a quest ${id} already.`, 'warn')
      const giver = left.querySelector<HTMLSelectElement>('#qNewGiver')!.value
      const q: QuestDef = {
        id, kind: 'side', title: { en: 'A Favour', zh: '一个忙' }, summary: { en: '{giver} asks a favour.', zh: '{giver}请你帮个忙。' },
        aliases: giver ? { giver: { id: giver, essential: true } } : {},
        objectives: [{ id: 'back', text: { en: 'Back to {giver}', zh: '回去找{giver}' }, target: 'giver', talk: true }],
        stages: [{ n: 10, log: { en: '{giver} asks a favour.', zh: '{giver}请你帮个忙。' }, show: ['back'] }, { n: 100, on: { talk: 'giver' }, done: ['back'], complete: true, reward: { xp: 10 }, log: { en: 'Done.', zh: '完成了。' } }],
        start: giver ? { auto: { talk: 'giver' } } : { manual: true },
      }
      this.sel = id
      ctx.store.add(`quests/${id}.json`, q, `a new quest ${id}`)
    }
    right.innerHTML = `<h3>Quests</h3><p class="muted">A quest under way is a thing whose props are its state: its aliases filled as it begins, its objectives counted, its stages reached by their triggers (docs/quests.md). {alias} names an alias in its words.</p>`
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const file = this.file(ctx)
    const q = file ? ctx.store.get<QuestDef>(file) : undefined
    if (!q || !file) return void (el.innerHTML = '<p class="muted">Choose a quest on the left, or make one.</p>')
    const f = new Form()
    const bad = (m: string) => toast(m, 'error')
    const edit = (why: string, fn: (q: QuestDef) => void) => ctx.store.change<QuestDef>(file, why, fn)
    const put = <K extends keyof QuestDef>(k: K, v: QuestDef[K] | undefined) => edit(`${q.id}: ${k}`, (x) => (v === undefined ? delete x[k] : (x[k] = v)))
    const aliases = Object.keys(q.aliases ?? {})
    const objIds = (q.objectives ?? []).map((o) => o.id)
    const parts: string[] = []
    parts.push(`${datalists(ctx)}<div class="row"><h3 class="grow">${esc(tx(q.title))} <small class="muted">${esc(q.id)} · in <code>${esc(file)}</code></small></h3>${f.button('Where it is used', () => ctx.open('find', undefined, q.id))}${f.button('Remove the quest', () => { if (confirm(`Remove the quest ${q.id}?`)) (ctx.store.remove(file, `remove ${q.id}`), (this.sel = undefined)) }, { cls: 'danger' })}</div>`)
    // the quest itself
    const lines = ['offer', 'accepted', 'declined', 'waiting'] as const
    const start = q.start
    const sk = 'auto' in start ? 'auto' : 'offer' in start && !('news' in start) ? 'offer' : 'news' in start ? 'news' : 'manual'
    const startBody =
      sk === 'auto' ? `when ${questTriggerForm(f, ctx, q, (start as { auto: never }).auto, (t) => put('start', t ? { auto: t } : { manual: true }))}`
      : sk === 'offer' ? `by ${f.select(aliases, (start as { offer: string }).offer, (a) => put('start', { ...(start as { offer: string }), offer: a }))} once ${questTriggerForm(f, ctx, q, (start as { when?: never }).when, (t) => put('start', { ...(start as { offer: string }), ...(t ? { when: t } : { when: undefined }) }))}`
      : sk === 'news' ? f.json(start, (v) => put('start', v as QuestDef['start']), bad, 2) : ''
    parts.push(`<div class="cols"><div class="box"><h3>The quest</h3>
      <label>kind ${f.select(['main', 'side', 'favor'], q.kind, (v) => put('kind', v as QuestDef['kind']))} · repeat ${f.select([['', 'once'], ['daily', 'each day'], ['always', 'at once again']], q.repeat ?? '', (v) => put('repeat', (v || undefined) as QuestDef['repeat']))} · fails after ${f.num(q.deadline, (v) => put('deadline', v), { min: 1, placeholder: 'never' })} game hours</label>
      <label>title ${f.words(q.title, (t) => put('title', t ?? q.id))}</label>
      <label>summary ${f.words(q.summary, (t) => put('summary', t ?? ''), { area: true })}</label>
      ${lines.map((k) => `<label>the giver's line: ${k} ${f.words(q[k], (t) => put(k, t))}</label>`).join('')}
      </div><div class="box"><h3>How it begins</h3>
      <label>${f.select(START_KINDS, sk, (v) => put('start', v === 'auto' ? { auto: { talk: aliases[0] ?? 'giver' } } : v === 'offer' ? { offer: aliases[0] ?? 'giver' } : v === 'news' ? { news: 'talk', offer: aliases[0] ?? 'giver' } : { manual: true }))}</label>
      <div class="trigline">${startBody}</div>
      <h3>Who and what it is about (aliases)</h3>${this.aliases(f, ctx, q, (a) => put('aliases', a))}</div></div>`)
    // objectives
    const objs = (q.objectives ?? []).map((o, i) => {
      const set = (no: ObjectiveDef | undefined) => edit(`${q.id}: an objective`, (x) => { if (no) x.objectives![i] = no; else x.objectives!.splice(i, 1) })
      const ck = o.count ? Object.keys(o.count)[0] : ''
      const cv = o.count ? (Object.values(o.count)[0] as unknown) : undefined
      const targets = ([] as string[]).concat(o.target ?? [])
      return `<div class="cmdcard"><div class="row"><b>${esc(o.id)}</b> ${f.text(o.id, (v) => v && ID.test(v) && set({ ...o, id: v }))}<span class="grow"></span>${f.link('✕', () => set(undefined), { cls: 'x' })}</div>
        <label>what it asks ${f.words(o.text, (t) => set({ ...o, text: t ?? '' }))}</label>
        <div class="chips">points at ${aliases.map((a) => f.check(targets.includes(a), `{${a}}`, (on) => { const t = on ? [...targets, a] : targets.filter((y) => y !== a); set({ ...o, ...(t.length ? { target: t.length === 1 ? t[0] : t } : { target: undefined }) }) })).join('')} ${f.check(o.talk, 'someone to speak to (?)', (v) => set({ ...o, talk: v || undefined }))} ${f.check(o.optional, 'optional', (v) => set({ ...o, optional: v || undefined }))}</div>
        <div class="row">${f.select(COUNT_KINDS, ck, (k) => set({ ...o, count: k === 'carry' ? { carry: { type: 'item/' } } : k === 'kill' ? { kill: { type: 'actor/creature/' } } : k === 'fact' ? { fact: 'story.' } : undefined }))}
          ${ck === 'carry' || ck === 'kill' ? `${typeof cv === 'string' ? f.select(aliases, cv, (a) => set({ ...o, count: { [ck]: a } as never })) : f.text((cv as { type?: string })?.type, (t) => set({ ...o, count: { [ck]: { ...(cv as object), type: t } } as never }), { list: 'dlKinds' })} need ${f.num(o.need ?? 1, (v) => set({ ...o, need: v ?? 1 }), { min: 1 })}` : ck === 'fact' ? `${f.text(String(cv), (v) => set({ ...o, count: { fact: v } }), { list: 'dlFacts' })} need ${f.num(o.need ?? 1, (v) => set({ ...o, need: v ?? 1 }), { min: 1 })}` : `<span class="trigline">${questTriggerForm(f, ctx, q, o.on, (t) => set({ ...o, ...(t ? { on: t } : { on: undefined }) }))}</span>`}</div>
        <label>said when done ${f.words(o.say, (t) => set({ ...o, say: t }))}</label></div>`
    })
    parts.push(`<div class="box"><div class="row"><h3 class="grow">Objectives</h3>${f.button('+ An objective', () => edit(`${q.id}: an objective`, (x) => (x.objectives ??= []).push({ id: `o${(x.objectives?.length ?? 0) + 1}`, text: { en: '…', zh: '……' } })))}</div>${objs.join('') || '<p class="muted">None: the stages say what to do.</p>'}</div>`)
    // stages
    const stages = q.stages.map((s, i) => this.stage(f, ctx, q, s, aliases, objIds, (ns) => edit(`${q.id}: stage ${s.n}`, (x) => { if (ns) x.stages[i] = ns; else x.stages.splice(i, 1) })))
    parts.push(`<div class="box"><div class="row"><h3 class="grow">Stages</h3>${f.button('+ A stage', () => edit(`${q.id}: a stage`, (x) => x.stages.push({ n: (x.stages[x.stages.length - 1]?.n ?? 0) + 10, log: { en: '…', zh: '……' } })))}</div><p class="muted">The first is where it begins; each later one is reached by its trigger (or a notice), and one may complete or fail it.</p>${stages.join('')}</div>`)
    parts.push(`<details><summary>Its topics in the talk panel (${q.topics?.length ?? 0})</summary>${f.json(q.topics, (v) => put('topics', v as QuestDef['topics']), bad, 3)}</details>`)
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
        what === 'id' ? f.text(a.id, (v) => put({ ...a, id: v }), { list: 'dlThings', placeholder: 'a person or a thing by id' })
        : what === 'place' ? f.select(places, a.place, (v) => put({ ...a, place: v }))
        : f.json(a[what as 'find'], (v) => put({ ...a, [what]: v }), (m) => toast(m, 'error'), 2)
      return `<div class="cond"><span class="lbl">{${esc(name)}}</span>${f.select([['id', 'this one'], ['place', 'a place'], ['find', 'found (JSON)'], ['make', 'made (JSON)']], what, (w) => put(w === 'place' ? { place: ctx.map } : w === 'find' ? { find: { type: 'item/' } } : w === 'make' ? { make: { type: 'item/' } } : { id: '' }))} ${body}
        <span class="chips">${f.check(a.essential, 'cannot die', (v) => put({ ...a, essential: v || undefined }))}${f.check(a.keep, 'a quest item', (v) => put({ ...a, keep: v || undefined }))}${f.check(a.optional, 'may stay empty', (v) => put({ ...a, optional: v || undefined }))}</span>${f.link('✕', () => put(undefined), { cls: 'x' })}</div>`
    }
    return `<div class="conds">${Object.entries(rec).map(([k, a]) => row(k, a)).join('')}<div class="row add">${f.text('', (k) => k && ID.test(k) && set({ ...rec, [k]: { id: '' } }), { placeholder: '+ an alias (giver, ring, place …)' })}</div></div>`
  }

  private stage(f: Form, ctx: Ctx, q: QuestDef, s: QuestStage, aliases: string[], objIds: string[], set: (s: QuestStage | undefined) => void): string {
    const put = <K extends keyof QuestStage>(k: K, v: QuestStage[K] | undefined) => set({ ...s, [k]: v } as QuestStage)
    const chips = (k: 'show' | 'done' | 'fail', label: string) => `<span class="chips">${label} ${objIds.map((o) => f.check(s[k]?.includes(o), o, (on) => { const l = on ? [...(s[k] ?? []), o] : (s[k] ?? []).filter((x) => x !== o); put(k, l.length ? l : undefined) })).join('') || '<span class="muted">(no objectives)</span>'}</span>`
    const r = s.reward ?? {}
    const putR = (nr: typeof r) => put('reward', Object.keys(nr).some((k) => (nr as Record<string, unknown>)[k] !== undefined) ? nr : undefined)
    const items = r.items ?? []
    const takes = s.take ?? []
    return `<div class="cmdcard stage"><div class="row"><b>stage</b> ${f.num(s.n, (v) => put('n', v ?? s.n), { min: 0 })} ${f.check(s.complete, 'completes it', (v) => put('complete', v || undefined))} ${f.check(s.failed, 'fails it', (v) => put('failed', v || undefined))}<span class="grow"></span>${f.link('✕', () => set(undefined), { cls: 'x' })}</div>
      <div class="trigline">reached when ${questTriggerForm(f, ctx, q, s.on, (t) => put('on', t))} <span class="muted">${s.on ? '' : '(none: where it begins, or a notice sets it)'}</span></div>
      <label>the journal's line ${f.words(s.log, (t) => put('log', t))}</label>
      <label>said on reaching it ${f.words(s.say, (t) => put('say', t))} by ${f.select(aliases, s.by, (v) => put('by', v || undefined), { none: 'the one spoken to, else the giver' })}</label>
      <div class="row">${chips('show', 'shows')}</div><div class="row">${chips('done', 'done')}</div><div class="row">${chips('fail', 'failed')}</div>
      <details ${takes.length || items.length || r.xp ? 'open' : ''}><summary>Taken, and the reward</summary>
        ${takes.map((t, i) => `<div class="row">takes ${f.num(t.count, (v) => put('take', takes.map((x, j) => (j === i ? { ...x, count: v ?? 1 } : x))), { min: 1 })} × ${typeof t.match === 'string' ? f.select(aliases, t.match, (v) => put('take', takes.map((x, j) => (j === i ? { ...x, match: v } : x)))) : f.text(t.match.type, (v) => put('take', takes.map((x, j) => (j === i ? { ...x, match: { type: v } } : x))), { list: 'dlKinds' })} ${f.link('✕', () => put('take', takes.filter((_, j) => j !== i).length ? takes.filter((_, j) => j !== i) : undefined), { cls: 'x' })}</div>`).join('')}
        <div class="row add">${f.text('', (v) => v && put('take', [...takes, { match: { type: v }, count: 1 }]), { list: 'dlKinds', placeholder: '+ something taken from the taker' })}</div>
        <label>experience ${f.num(r.xp, (v) => putR({ ...r, xp: v }), { min: 0 })}</label>
        ${items.map((it, i) => `<div class="row">gives ${f.num(it.count, (v) => putR({ ...r, items: items.map((x, j) => (j === i ? { ...x, count: v ?? 1 } : x)) }), { min: 1 })} × ${f.text(it.type, (v) => putR({ ...r, items: items.map((x, j) => (j === i ? { ...x, type: v } : x)) }), { list: 'dlKinds' })} ${f.link('✕', () => putR({ ...r, items: items.filter((_, j) => j !== i).length ? items.filter((_, j) => j !== i) : undefined }), { cls: 'x' })}</div>`).join('')}
        <div class="row add">${f.text('', (v) => v && putR({ ...r, items: [...items, { type: v, count: 1 }] }), { list: 'dlKinds', placeholder: '+ a thing given' })}</div>
        <label>facts the story keeps</label>${valueRows(f, r.facts, (rec) => putR({ ...r, facts: rec }))}
      </details>
      <details><summary>Its hint, the stages it follows, its effects (JSON)</summary>
        <label>the companion's hint ${f.words(s.hint, (t) => put('hint', t))}</label>
        <label>follows only ${f.text((s.from ?? []).join(', '), (v) => { const l = v.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0); put('from', l.length ? l : undefined) }, { placeholder: 'any lower stage' })}</label>
        <label>its effects ${f.json(s.do, (v) => put('do', v as QuestStage['do']), (m) => toast(m, 'error'), 2)}</label>
        <label>its lessons ${f.json(s.lessons, (v) => put('lessons', v as QuestStage['lessons']), (m) => toast(m, 'error'), 2)}</label>
      </details></div>`
  }

  focus(ctx: Ctx, file: string): void {
    this.sel = ctx.store.get<QuestDef>(file)?.id ?? this.sel
  }
}
