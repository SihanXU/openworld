// The people (docs/engine-split.md §6, RPG Maker's NPC events — but a person is content, not a script): who they
// are, where they stand when the game begins, their day as a 24-hour schedule over the maps' anchors, their
// keyed lines, and their look through the game's own character creator (runtime/src/ui/creator.ts).

import type { Entity, LineDef, Look, Mood } from '@openworld/engine'
import { generateCrowd, type PersonFile, type ScheduleFileEntry } from '@openworld/format'
import { Creator } from '@openworld/runtime/src/ui/creator.ts'
import { game, hasLooks } from '@openworld/runtime/src/game.ts'
import type { Ctx, Mode } from './context.ts'
import { dayHours } from './schedule.ts'
import { phrase } from './lang.ts'
import { esc, t, textField, toast, tx } from './ui.ts'
import { adopt, shown, sourceLang, together, written } from './words.ts'

const MOODS: Mood[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
/** The keys a line may be for (people.ts resolves them, most specific first). */
const KEYS = ['default', 'greeting:first', 'hour:morning', 'hour:day', 'hour:evening', 'hour:night', 'weather:rain', 'given']
/** A new person's first line, in the language the game is written in (none known: they wait for one). */
const HELLO: Record<string, string> = { en: 'Hello.', zh: '你好。', ja: 'こんにちは。', ko: '안녕하세요.', fr: 'Bonjour.', de: 'Hallo.', es: 'Hola.', ru: 'Здравствуйте.', pt: 'Olá.', it: 'Ciao.' }

export class PeopleMode implements Mode {
  id = 'people'
  label = phrase('People')
  private placing = false
  private creator?: Creator

  private file(ctx: Ctx): string | undefined {
    return ctx.store.list<PersonFile>('people').find((p) => p.data.id === ctx.sel.person)?.file
  }
  private edit(ctx: Ctx, why: string, fn: (p: PersonFile) => void): void {
    const f = this.file(ctx)
    if (f) ctx.store.change<PersonFile>(f, why, fn)
  }

  render(ctx: Ctx, left: HTMLElement, right: HTMLElement): void {
    const people = ctx.store.list<PersonFile>('people')
    left.innerHTML = `<h3>${t('People')}</h3>
      <input id="pplFilter" placeholder="${t('find someone by name, role or id')}">
      <div class="palette list people">${people.map((p) => `<button data-person="${esc(p.data.id)}" class="${p.data.id === ctx.sel.person ? 'on' : ''}"><span>${esc(shown(p.data.name) || p.data.id)}<small>${esc(shown(ctx.onto().types[p.data.type]?.name) || p.data.type.split('/').pop())} · ${esc(p.data.id)}</small></span></button>`).join('') || `<p class="muted">${t('Nobody yet.')}</p>`}</div>
      <details ${people.length ? '' : 'open'}><summary>${t('New person')}</summary>
        <label>${t('id')} <input id="npId" placeholder="npc.ada"></label>
        <label>${t('name')} <input id="npName"></label>
        <label>${t('kind')} <input id="npType" value="actor/person"></label>
        <button id="npMake">${t('Make them (on this map)')}</button>
      </details>
      <details><summary>${t('Many people')}</summary>
        <p class="muted">${t('A crowd from a seed: names, a day over this map\'s anchors, a line or two — each a person to change afterwards.')}</p>
        <label>${t('how many')} <input id="crN" type="number" min="1" max="200" value="6"></label>
        <label>${t('kind')} <input id="crType" value="actor/person"></label>
        <label>${t('seed')} <input id="crSeed" type="number" value="${Math.floor(Math.random() * 1e5)}"></label>
        <button id="crMake">${t('Make them')}</button>
      </details>`
    // the list narrowed as one types, without drawing it again (the field keeps its place)
    const pf = left.querySelector<HTMLInputElement>('#pplFilter')!
    pf.oninput = () => { const q = pf.value.trim().toLowerCase(); left.querySelectorAll<HTMLElement>('[data-person]').forEach((b) => (b.hidden = !!q && !(b.textContent ?? '').toLowerCase().includes(q))) }
    left.querySelectorAll<HTMLButtonElement>('[data-person]').forEach((b) => (b.onclick = () => {
      ctx.sel = { person: b.dataset.person }
      const p = people.find((x) => x.data.id === b.dataset.person)?.data
      if (p?.place.on === 'tile') ctx.showMap(p.place.map, { x: p.place.x, y: p.place.y })
      ctx.refresh()
    }))
    left.querySelector<HTMLButtonElement>('#npMake')!.onclick = () => {
      const v = (s: string) => left.querySelector<HTMLInputElement>(s)!.value.trim()
      const id = v('#npId')
      if (!/^[a-z][a-z0-9._-]*$/.test(id)) return toast(t('A person\'s id: lower case letters, digits, ".", "-" and "_" (npc.ada).'), 'warn')
      if (people.some((p) => p.data.id === id)) return toast(t('There is {id} already.', { id }), 'warn')
      const m = ctx.canvas.map
      const p: PersonFile = { id, type: v('#npType') || 'actor/person', name: v('#npName') || id, place: { on: 'tile', map: ctx.map, x: Math.floor((m?.width ?? 2) / 2), y: Math.floor((m?.height ?? 2) / 2) }, facing: 'down', npc: { role: (v('#npType') || 'actor/person').split('/').pop()!, schedule: [], person: { lines: [{ key: 'default', text: HELLO[sourceLang()] ?? '…' }] } } }
      ctx.store.add(`people/${id}.json`, p, t('a new person {id}', { id }))
      ctx.sel = { person: id }
      ctx.refresh()
    }
    left.querySelector<HTMLButtonElement>('#crMake')!.onclick = () => {
      const v = (s: string) => left.querySelector<HTMLInputElement>(s)!.value.trim()
      const m = ctx.store.maps().find((x) => x.data.map.id === ctx.map)?.data
      const anchors = Object.entries(m?.map.anchors ?? {})
      if (!m || !anchors.length) return toast(t('Name an anchor or two on this map first (the Map\'s Anchor tool): their days run over them.'), 'warn')
      const taken = new Set([...people.map((p) => p.data.id), ...ctx.store.maps().flatMap((x) => x.data.entities.map((e) => e.id))])
      const crowd = generateCrowd({ n: Math.max(1, Math.min(200, Number(v('#crN')) || 6)), seed: Number(v('#crSeed')) || 1, type: v('#crType') || 'actor/person', map: ctx.map, anchors: anchors.map(([a]) => `${ctx.map}:${a}`), taken, place: (i) => { const [, [x, y]] = anchors[i % anchors.length]; return { x: Math.max(0, Math.min(m.map.width - 1, x + (i % 3) - 1)), y: Math.max(0, Math.min(m.map.height - 1, y + (Math.floor(i / 3) % 3) - 1)) } } })
      // (its names and lines in the game's language; their words in the others the game keeps, into its tables)
      together(() => {
        for (const p of crowd) {
          p.name = adopt(p.name) ?? p.id
          for (const l of p.npc?.person?.lines ?? []) l.text = adopt(l.text) ?? ''
          ctx.store.add(`people/${p.id}.json`, p, t('a crowd: {id}', { id: p.id }))
        }
      })
      toast(t('{n} people made: {names}.', { n: crowd.length, names: crowd.map((p) => tx(p.name)).join(', ') }))
    }
    this.form(ctx, right)
  }

  private form(ctx: Ctx, right: HTMLElement): void {
    this.creator?.dispose()
    this.creator = undefined
    const f = this.file(ctx)
    const p = f ? ctx.store.get<PersonFile>(f) : undefined
    if (!p) return void (right.innerHTML = `<p class="muted">${t('Choose someone, or make a new person.')}</p>`)
    const anchors = ctx.store.maps().flatMap((m) => Object.keys(m.data.map.anchors ?? {}).map((a) => `${m.data.map.id}:${a}`))
    const types = Object.keys(ctx.onto().types).filter((k) => k.startsWith('actor/person'))
    const place = p.place.on === 'tile' ? p.place : undefined
    const sched = p.npc?.schedule ?? []
    const lines = p.npc?.person?.lines ?? []
    right.innerHTML = `<div class="db-head"><div><h2>${esc(shown(p.name) || p.id)}</h2><p class="muted"><code>${esc(p.id)}</code></p></div></div>
      <label>${t('name')} ${textField('data-f="name"', p.name)}</label>
      <label>${t('kind')} <select data-f="type">${[...new Set([p.type, ...types])].map((k) => `<option value="${esc(k)}" ${k === p.type ? 'selected' : ''}>${esc(shown(ctx.onto().types[k]?.name) || k.split('/').pop())} · ${esc(k.split('/').pop())}</option>`).join('')}</select></label>
      <label>${t('role')} <input data-f="role" value="${esc(p.npc?.role ?? '')}"></label>
      <label>${t('stands at')} <code>${esc(place ? `${place.map} ${place.x},${place.y}` : p.place.on)}</code> <button id="pPlace" class="${this.placing ? 'on' : ''}">${this.placing ? t('Click a cell…') : t('Place on the map')}</button></label>
      <label>${t('tags')} <input data-f="tags" value="${esc((p.tags ?? []).join(', '))}"></label>
      <h3>${t('Their day')}</h3>
      <table class="sched"><tr><th>${t('from')}</th><th>${t('to')}</th><th>${t('at')}</th><th>${t('doing')}</th><th></th></tr>
      ${sched.map((s, i) => `<tr data-row="${i}"><td><input data-s="from" type="number" min="0" max="24" value="${s.from}"></td><td><input data-s="to" type="number" min="0" max="24" value="${s.to}"></td>
        <td><select data-s="at">${s.at === undefined ? `<option selected value="">${esc(`${s.map} ${s.x},${s.y}`)}</option>` : ''}${anchors.map((a) => `<option ${a === s.at ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></td>
        <td><input data-s="activity" value="${esc(s.activity)}"></td><td><a data-s-del="${i}" class="x">✕</a></td></tr>`).join('')}
      </table>
      <button id="sAdd" ${anchors.length ? '' : `disabled title="${t('Name an anchor on a map first (the Map\'s Anchor tool)')}"`}>${t('Add an hour')}</button>
      ${dayProblems(sched)}
      <h3>${t('Lines')}</h3>
      ${lines.map((l, i) => `<div class="line" data-line="${i}">
        <select data-l="key">${[...new Set([l.key, ...KEYS])].map((k) => `<option ${k === l.key ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        <select data-l="mood">${MOODS.map((m) => `<option ${m === (l.mood ?? 'neutral') ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <label class="inline"><input data-l="once" type="checkbox" ${l.once ? 'checked' : ''}> ${t('once')}</label> <a data-l-del="${i}" class="x">✕</a>
        ${textField('data-l="text"', l.text, { area: true })}</div>`).join('')}
      <button id="lAdd">${t('Add a line')}</button>
      <h3>${t('Look')}</h3>
      ${hasLooks() ? '<div id="pCreator"></div>' : `<p class="muted">${t('This game has no look table: people are drawn from the catalogue\'s sheets by their role.')}</p>`}
      <button id="pDel" class="danger">${t('Remove {id}', { id: esc(p.id) })}</button>`

    right.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-f]').forEach((el) => (el.onchange = () => together(() => {
      const k = el.dataset.f!
      const name = k === 'name' ? written(p.name, el.value) : undefined
      this.edit(ctx, t('change {id}', { id: p.id }), (x) => {
        if (k === 'name') x.name = name ?? x.id
        else if (k === 'type') x.type = el.value
        else if (k === 'role' && x.npc) x.npc.role = el.value
        else if (k === 'tags') { x.tags = el.value.split(',').map((y) => y.trim()).filter(Boolean); if (!x.tags.length) delete x.tags }
      })
    })))
    right.querySelector<HTMLButtonElement>('#pPlace')!.onclick = () => ((this.placing = !this.placing), ctx.refresh())
    right.querySelectorAll<HTMLTableRowElement>('[data-row]').forEach((row) => row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-s]').forEach((el) => (el.onchange = () => this.edit(ctx, t('{id}\'s day', { id: p.id }), (x) => {
      const s = x.npc!.schedule[Number(row.dataset.row)] as Record<string, unknown>
      const k = el.dataset.s!
      if (k === 'at') { if (el.value) (s.at = el.value), delete s.map, delete s.x, delete s.y }
      else s[k] = k === 'from' || k === 'to' ? Number(el.value) : el.value
    }))))
    right.querySelectorAll<HTMLElement>('[data-s-del]').forEach((a) => (a.onclick = () => this.edit(ctx, t('{id}\'s day', { id: p.id }), (x) => x.npc!.schedule.splice(Number(a.dataset.sDel), 1))))
    right.querySelector<HTMLButtonElement>('#sAdd')!.onclick = () => this.edit(ctx, t('{id}\'s day', { id: p.id }), (x) => {
      x.npc ??= { role: x.type.split('/').pop()!, schedule: [] }
      const last = x.npc.schedule[x.npc.schedule.length - 1]
      x.npc.schedule.push({ from: last?.to ?? 8, to: Math.min(24, (last?.to ?? 8) + 4), at: anchors[0], activity: 'wander' } as ScheduleFileEntry)
    })
    right.querySelectorAll<HTMLElement>('[data-line]').forEach((box) => box.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-l]').forEach((el) => (el.onchange = () => together(() => {
      const k = el.dataset.l!
      const text = k === 'text' ? written(lines[Number(box.dataset.line)]?.text, el.value) : undefined
      this.edit(ctx, t('{id}\'s lines', { id: p.id }), (x) => {
        const l = x.npc!.person!.lines![Number(box.dataset.line)] as LineDef
        if (k === 'key') l.key = el.value
        else if (k === 'mood') { if (el.value === 'neutral') delete l.mood; else l.mood = el.value as Mood }
        else if (k === 'once') { if ((el as HTMLInputElement).checked) l.once = true; else delete l.once }
        else l.text = text ?? ''
      })
    }))))
    right.querySelectorAll<HTMLElement>('[data-l-del]').forEach((a) => (a.onclick = () => this.edit(ctx, t('{id}\'s lines', { id: p.id }), (x) => x.npc!.person!.lines!.splice(Number(a.dataset.lDel), 1))))
    right.querySelector<HTMLButtonElement>('#lAdd')!.onclick = () => this.edit(ctx, t('{id}\'s lines', { id: p.id }), (x) => {
      x.npc ??= { role: x.type.split('/').pop()!, schedule: [] }
      x.npc.person ??= {}
      ;(x.npc.person.lines ??= []).push({ key: 'default', text: '' })
    })
    const maker = right.querySelector<HTMLElement>('#pCreator')
    if (maker) this.creator = new Creator(maker, (typeof p.look === 'object' ? p.look : undefined) ?? lookOf(p), (look) => this.edit(ctx, t('{id}\'s look', { id: p.id }), (x) => ((x as Entity).look = look)))
    right.querySelector<HTMLButtonElement>('#pDel')!.onclick = () => {
      if (!confirm(t('Remove {id}? (Undo brings them back.)', { id: p.id }))) return
      ctx.store.remove(this.file(ctx)!, t('remove {id}', { id: p.id }))
      ctx.sel = {}
    }
  }

  cell(ctx: Ctx, c: { x: number; y: number }, ev: string): void {
    if (ev !== 'down' || !this.placing) return
    this.placing = false
    this.edit(ctx, t('where they stand'), (x) => (x.place = { on: 'tile', map: ctx.map, x: c.x, y: c.y }))
  }

  overlay(ctx: Ctx) {
    const f = this.file(ctx)
    const p = f ? ctx.store.get<PersonFile>(f) : undefined
    const anchors = new Map<string, { map: string; xy: [number, number] }>(ctx.store.maps().flatMap((m) => Object.entries(m.data.map.anchors ?? {}).map(([a, xy]) => [`${m.data.map.id}:${a}`, { map: m.data.map.id, xy }] as [string, { map: string; xy: [number, number] }])))
    return (g: Phaser.GameObjects.Graphics, T: number) => {
      if (!p) return
      for (const s of p.npc?.schedule ?? []) {
        const a = s.at !== undefined ? anchors.get(s.at) : { map: s.map!, xy: [s.x!, s.y!] as [number, number] }
        if (a && a.map === ctx.map) (g.lineStyle(2, 0x3ff0e0, 0.9), g.strokeRect(a.xy[0] * T + 2, a.xy[1] * T + 2, T - 4, T - 4))
      }
      if (p.place.on === 'tile' && p.place.map === ctx.map) (g.lineStyle(2, 0x6dff6d, 1), g.strokeCircle(p.place.x * T + T / 2, p.place.y * T + T / 2, T / 2))
    }
  }

  focus(ctx: Ctx, file: string): void {
    const p = ctx.store.get<PersonFile>(file)
    if (!p) return
    ctx.sel = { person: p.id }
    if (p.place.on === 'tile') ctx.showMap(p.place.map, { x: p.place.x, y: p.place.y })
  }
}

/** A day that leaves hours empty or covers one twice says so (a person with nothing to do stands where they are). */
function dayProblems(s: ScheduleFileEntry[]): string {
  if (!s.length) return `<p class="muted">${t('No day yet: they stand where they are.')}</p>`
  const { empty, twice } = dayHours(s)
  return [empty.length ? `<p class="warn">${t('Nothing to do at {hours}h.', { hours: empty.join(', ') })}</p>` : '', twice.length ? `<p class="warn">${t('Two things at once at {hours}h.', { hours: twice.join(', ') })}</p>` : ''].join('')
}

/** A look to begin the creator from: the game's own for this person (seeded by their id, as the game makes a crowd's). */
function lookOf(p: PersonFile): Look {
  return game().looks.generate(p.id, { sex: 'female', age: Number(p.props?.age ?? 30), role: p.npc?.role })
}
