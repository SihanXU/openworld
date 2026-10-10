// The story (docs/engine-split.md §6: RPG Maker's event commands, the nearest thing being a scene's commands) and
// the quests. The story is one script of steps (world-model.md §6.12): each with the trigger it waits on; a scene
// takes control and plays its commands, a beat does not. A quest is Bethesda's: aliases, objectives, stages
// (docs/quests.md). Both are data the compiler checks; a field that is not a line of words is written as JSON.

import type { QuestDef, SceneCmd, StepDef } from '@openworld/engine'
import type { StoryFile } from '@openworld/format'
import type { Ctx, Mode } from './context.ts'
import { enOf, esc, textOf, toast, tx, zhOf } from './ui.ts'

/** A scene's command kinds (types.ts SceneCmd), each by the key that names it, with an example to start from. */
const CMDS: Record<string, SceneCmd> = {
  say: { say: 'player', text: { en: '…', zh: '……' } },
  move: { move: 'player', x: 0, y: 0 },
  face: { face: 'player', dir: 'down' },
  emote: { emote: 'player', mood: 'happy' },
  wait: { wait: 10 },
  fade: { fade: 'out' },
  place: { place: 'npc.someone', map: 'map', x: 0, y: 0 },
  fact: { fact: 'story.fact', value: 1 },
  topic: { topic: 'news' },
  give: { give: 'item/kind', count: 1 },
  warp: { warp: 'map', x: 0, y: 0 },
  status: { status: 'thing.id', add: 'lit' },
  stage: { stage: 'quest.id', n: 10 },
  tell: { tell: 'thing.id', params: { what: 'news' } },
  card: { card: { en: 'The end.', zh: '完。' } },
}
const kindOf = (c: SceneCmd): string => Object.keys(CMDS).find((k) => k in c) ?? '?'

/** A JSON field: its text, read back on change (and said so when it is not JSON). */
function jsonField(label: string, key: string, value: unknown, rows = 3): string {
  return `<label>${esc(label)} <textarea data-json="${esc(key)}" rows="${rows}">${esc(value === undefined ? '' : JSON.stringify(value))}</textarea></label>`
}
function readJson(el: HTMLTextAreaElement): { ok: true; value: unknown } | { ok: false } {
  const t = el.value.trim()
  if (!t) return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(t) }
  } catch (e) {
    toast(`${el.dataset.json}: not JSON — ${(e as Error).message}`, 'error')
    return { ok: false }
  }
}
const set = (o: Record<string, unknown>, k: string, v: unknown) => (v === undefined || v === '' || (Array.isArray(v) && !v.length) ? delete o[k] : (o[k] = v))

export class StoryMode implements Mode {
  id = 'story'
  label = 'Story'
  private sel?: string

  private steps(ctx: Ctx): { file: string; step: StepDef }[] {
    return ctx.store.list<StoryFile>('story').flatMap((f) => (f.data.steps ?? []).map((step) => ({ file: f.file, step })))
  }
  private edit(ctx: Ctx, file: string, why: string, fn: (s: StepDef) => void): void {
    ctx.store.change<StoryFile>(file, why, (sf) => { const s = sf.steps?.find((x) => x.id === this.sel); if (s) fn(s) })
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const steps = this.steps(ctx)
    left.innerHTML = `<h3>The story's steps</h3>
      <div class="palette list" style="max-height:60vh">${steps.map(({ step }) => `<div class="tree-row ${step.id === this.sel ? 'on' : ''}" data-step="${esc(step.id)}">${esc(step.id)}<small>${step.script ? 'scene' : 'beat'}${step.manual ? ' · manual' : ''}</small></div>`).join('') || '<p class="muted">No steps yet.</p>'}</div>
      <details><summary>New step</summary><label>id <input id="stNewId" placeholder="meet_mira"></label><button id="stNew">Make a scene</button></details>`
    left.querySelectorAll<HTMLElement>('[data-step]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.step), ctx.refresh())))
    left.querySelector<HTMLButtonElement>('#stNew')!.onclick = () => {
      const id = left.querySelector<HTMLInputElement>('#stNewId')!.value.trim()
      if (!/^[a-z0-9_]+$/.test(id)) return toast('A step\'s id: lower case, digits and _.', 'warn')
      if (steps.some((s) => s.step.id === id)) return toast(`There is a step ${id} already.`, 'warn')
      const file = ctx.store.list<StoryFile>('story')[0]?.file ?? 'story/story.json'
      this.sel = id
      const step: StepDef = { id, when: { map: ctx.map }, script: [{ say: 'player', text: { en: '…', zh: '……' } }] }
      if (!ctx.store.get(file)) ctx.store.add(file, { steps: [step] }, `a new step ${id}`)
      else ctx.store.change<StoryFile>(file, `a new step ${id}`, (sf) => (sf.steps ??= []).push(step))
    }
    const sf = ctx.store.list<StoryFile>('story')[0]
    right.innerHTML = `<h3>The story as a whole</h3><p class="muted">What it keeps true, the facts only it may change, the weather it fixes${sf ? ` (in <code>${esc(sf.file)}</code>)` : ''}.</p>
      ${sf ? `${jsonField('invariants', 'invariants', sf.data.invariants, 5)}${jsonField('protected fact prefixes', 'protectedFacts', sf.data.protectedFacts, 2)}${jsonField('weather spans', 'weather', sf.data.weather, 3)}` : ''}`
    if (sf) right.querySelectorAll<HTMLTextAreaElement>('[data-json]').forEach((t) => (t.onchange = () => { const r = readJson(t); if (r.ok) ctx.store.change<StoryFile>(sf.file, `the story's ${t.dataset.json}`, (x) => set(x as Record<string, unknown>, t.dataset.json!, r.value)) }))
  }

  main(ctx: Ctx, el: HTMLElement): void {
    const at = this.steps(ctx).find((s) => s.step.id === this.sel)
    if (!at) return void (el.innerHTML = '<p class="muted">Choose a step on the left, or make one. A scene takes control and plays its commands in order; a beat only says, sets facts, and waits on its trigger.</p>')
    const s = at.step
    const script = s.script ?? []
    el.innerHTML = `<h3>${esc(s.id)}</h3><p class="muted">in <code>${esc(at.file)}</code></p>
      <div class="cols"><div>
        ${jsonField('when (its trigger: map, region, quest stages, facts, carrying …)', 'when', s.when, 3)}
        <label class="inline"><input type="checkbox" data-flag="manual" ${s.manual ? 'checked' : ''}> only when started (a scene effect)</label>
        <label class="inline"><input type="checkbox" data-flag="repeat" ${s.repeat ? 'checked' : ''}> again each day</label>
        <label>said by the companion <input data-t="say.en" value="${esc(enOf(s.say))}"> <input data-t="say.zh" value="${esc(zhOf(s.say))}"></label>
        <label>its hint <input data-t="hint.en" value="${esc(enOf(s.hint))}"> <input data-t="hint.zh" value="${esc(zhOf(s.hint))}"></label>
        ${jsonField('facts it sets', 'facts', s.facts, 2)}
        <button id="stDel" class="danger">Remove the step</button>
      </div><div>
        <h3>Its scene (${script.length} command${script.length === 1 ? '' : 's'})</h3>
        ${script.map((c, i) => `<div class="cmd" data-cmd="${i}"><select data-c="kind">${Object.keys(CMDS).map((k) => `<option ${k === kindOf(c) ? 'selected' : ''}>${k}</option>`).join('')}</select><input data-c="json" value="${esc(JSON.stringify(c))}"><a data-c="up">↑</a><a data-c="down">↓</a><a data-c="del" class="x">✕</a></div>`).join('')}
        <button id="cmdAdd">Add a command</button>
        <p class="muted">A command each line: say (who, text, mood), move, face, emote, wait (ticks), fade, place, fact, topic, give, warp, status, stage (a quest's), tell, card.</p>
      </div></div>`
    const edit = (why: string, fn: (s: StepDef) => void) => this.edit(ctx, at.file, why, fn)
    el.querySelectorAll<HTMLTextAreaElement>('[data-json]').forEach((t) => (t.onchange = () => { const r = readJson(t); if (r.ok) edit(`${s.id}: ${t.dataset.json}`, (x) => set(x as unknown as Record<string, unknown>, t.dataset.json!, r.value)) }))
    el.querySelectorAll<HTMLInputElement>('[data-flag]').forEach((c) => (c.onchange = () => edit(`${s.id}: ${c.dataset.flag}`, (x) => set(x as unknown as Record<string, unknown>, c.dataset.flag!, c.checked || undefined))))
    el.querySelectorAll<HTMLInputElement>('[data-t]').forEach((inp) => (inp.onchange = () => {
      const [k, lang] = inp.dataset.t!.split('.') as ['say' | 'hint', 'en' | 'zh']
      edit(`${s.id}: ${k}`, (x) => { const en = lang === 'en' ? inp.value : enOf(x[k]), zh = lang === 'zh' ? inp.value : zhOf(x[k]); set(x as unknown as Record<string, unknown>, k, en ? textOf(en, zh) : undefined) })
    }))
    el.querySelectorAll<HTMLElement>('[data-cmd]').forEach((row) => {
      const i = Number(row.dataset.cmd)
      const field = row.querySelector<HTMLInputElement>('[data-c="json"]')!
      row.querySelector<HTMLSelectElement>('[data-c="kind"]')!.onchange = (e) => edit(`${s.id}: a command`, (x) => (x.script![i] = structuredClone(CMDS[(e.target as HTMLSelectElement).value])))
      field.onchange = () => { try { const c = JSON.parse(field.value) as SceneCmd; edit(`${s.id}: a command`, (x) => (x.script![i] = c)) } catch (err) { toast(`Not JSON: ${(err as Error).message}`, 'error') } }
      row.querySelector<HTMLElement>('[data-c="up"]')!.onclick = () => i > 0 && edit(`${s.id}: the order`, (x) => x.script!.splice(i - 1, 0, ...x.script!.splice(i, 1)))
      row.querySelector<HTMLElement>('[data-c="down"]')!.onclick = () => edit(`${s.id}: the order`, (x) => { if (i < x.script!.length - 1) x.script!.splice(i + 1, 0, ...x.script!.splice(i, 1)) })
      row.querySelector<HTMLElement>('[data-c="del"]')!.onclick = () => edit(`${s.id}: a command`, (x) => { x.script!.splice(i, 1); if (!x.script!.length) delete x.script })
    })
    el.querySelector<HTMLButtonElement>('#cmdAdd')!.onclick = () => edit(`${s.id}: a command`, (x) => (x.script ??= []).push(structuredClone(CMDS.say)))
    el.querySelector<HTMLButtonElement>('#stDel')!.onclick = () => {
      if (!confirm(`Remove the step ${s.id}?`)) return
      ctx.store.change<StoryFile>(at.file, `remove ${s.id}`, (sf) => sf.steps!.splice(sf.steps!.findIndex((x) => x.id === s.id), 1))
      this.sel = undefined
    }
  }

  focus(ctx: Ctx, file: string): void {
    this.sel ??= ctx.store.get<StoryFile>(file)?.steps?.[0]?.id
  }
}

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
      <details><summary>New quest</summary><label>id <input id="qNewId" placeholder="lost_ring"></label><label>given by <select id="qNewGiver">${ctx.store.list<{ id: string }>('people').map((p) => `<option>${esc(p.data.id)}</option>`).join('')}</select></label><button id="qNew">Make a favour</button></details>`
    left.querySelectorAll<HTMLElement>('[data-quest]').forEach((r) => (r.onclick = () => ((this.sel = r.dataset.quest), ctx.refresh())))
    left.querySelector<HTMLButtonElement>('#qNew')!.onclick = () => {
      const id = left.querySelector<HTMLInputElement>('#qNewId')!.value.trim()
      if (!/^[a-z0-9_]+$/.test(id)) return toast('A quest\'s id: lower case, digits and _.', 'warn')
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
    const lines = ['offer', 'accepted', 'declined', 'waiting'] as const
    el.innerHTML = `<h3>${esc(q.id)}</h3><p class="muted">in <code>${esc(file)}</code></p>
      <div class="cols"><div>
        <label>kind <select data-v="kind">${['main', 'side', 'favor'].map((k) => `<option ${k === q.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>title <input data-t="title.en" value="${esc(enOf(q.title))}"> <input data-t="title.zh" value="${esc(zhOf(q.title))}"></label>
        <label>summary <input data-t="summary.en" value="${esc(enOf(q.summary))}"> <input data-t="summary.zh" value="${esc(zhOf(q.summary))}"></label>
        ${lines.map((k) => `<label>${k} line <input data-t="${k}.en" value="${esc(enOf(q[k]))}"> <input data-t="${k}.zh" value="${esc(zhOf(q[k]))}"></label>`).join('')}
        <label>repeat <select data-v="repeat"><option value="">once</option>${['daily', 'always'].map((k) => `<option ${k === q.repeat ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        ${jsonField('how it begins (auto, offer, news, manual)', 'start', q.start, 2)}
        ${jsonField('aliases', 'aliases', q.aliases, 4)}
        <button id="qDel" class="danger">Remove the quest</button>
      </div><div>
        ${jsonField('objectives', 'objectives', q.objectives, 8)}
        <h3>Stages</h3>
        ${q.stages.map((s, i) => `<label>stage ${s.n} <textarea data-stage="${i}" rows="4">${esc(JSON.stringify(s))}</textarea></label>`).join('')}
        <button id="stageAdd">Add a stage</button>
      </div></div>`
    const edit = (why: string, fn: (q: QuestDef) => void) => ctx.store.change<QuestDef>(file, why, fn)
    el.querySelectorAll<HTMLSelectElement>('[data-v]').forEach((s) => (s.onchange = () => edit(`${q.id}: ${s.dataset.v}`, (x) => set(x as unknown as Record<string, unknown>, s.dataset.v!, s.value || undefined))))
    el.querySelectorAll<HTMLInputElement>('[data-t]').forEach((inp) => (inp.onchange = () => {
      const [k, lang] = inp.dataset.t!.split('.') as [keyof QuestDef, 'en' | 'zh']
      edit(`${q.id}: ${k}`, (x) => { const cur = x[k] as never; const en = lang === 'en' ? inp.value : enOf(cur), zh = lang === 'zh' ? inp.value : zhOf(cur); set(x as unknown as Record<string, unknown>, k, en ? textOf(en, zh) : undefined) })
    }))
    el.querySelectorAll<HTMLTextAreaElement>('[data-json]').forEach((t) => (t.onchange = () => { const r = readJson(t); if (r.ok) edit(`${q.id}: ${t.dataset.json}`, (x) => set(x as unknown as Record<string, unknown>, t.dataset.json!, r.value)) }))
    el.querySelectorAll<HTMLTextAreaElement>('[data-stage]').forEach((t) => (t.onchange = () => { try { const s = JSON.parse(t.value); edit(`${q.id}: a stage`, (x) => (x.stages[Number(t.dataset.stage)] = s)) } catch (e) { toast(`Not JSON: ${(e as Error).message}`, 'error') } }))
    el.querySelector<HTMLButtonElement>('#stageAdd')!.onclick = () => edit(`${q.id}: a stage`, (x) => x.stages.push({ n: (x.stages[x.stages.length - 1]?.n ?? 0) + 10, log: { en: '…', zh: '……' } }))
    el.querySelector<HTMLButtonElement>('#qDel')!.onclick = () => { if (confirm(`Remove the quest ${q.id}?`)) (ctx.store.remove(file, `remove ${q.id}`), (this.sel = undefined)) }
  }

  focus(ctx: Ctx, file: string): void {
    this.sel = ctx.store.get<QuestDef>(file)?.id ?? this.sel
  }
}
