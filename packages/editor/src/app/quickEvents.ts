// The map's quick events (docs/engine-split.md §16 E2, RPG Maker's Quick Event Creation): the Things layer's Quick
// tool — choose a door, a chest, a sign, a bed, a person, a merchant or a quest giver, fill its few fields, click
// where it goes. Each is laid as one edit (one Undo) of the format's data (events.ts).

import type { Ontology, RawChunk, Text } from '@openworld/engine'
import type { PersonFile } from '@openworld/format'
import type { Ctx } from './context.ts'
import { chest, door, favourQuest, merchant, person, personId, questId, setDown, sign, wayBack, type Favour } from './events.ts'
import { Form } from './form.ts'
import { EditError, idsOf, type Cell } from './mapEdit.ts'
import { namesOf } from './triggers.ts'
import { esc, toast, tx } from './ui.ts'

export type QuickKind = 'door' | 'chest' | 'sign' | 'bed' | 'person' | 'merchant' | 'giver'
const KINDS: [QuickKind, string, string][] = [
  ['door', 'Door', 'a door to another map (and the way back)'],
  ['chest', 'Chest', 'a chest and what is in it'],
  ['sign', 'Sign', 'a sign with its words'],
  ['bed', 'Bed', 'a bed to sleep in'],
  ['person', 'Person', 'someone standing here, with a line'],
  ['merchant', 'Merchant', 'someone who trades: a stock and a purse (the society module)'],
  ['giver', 'Quest giver', 'someone with a favour: bring, defeat, or a word with someone'],
]

type Row = { type: string; count: number }

/** Does a kind carry a tag (its own, or one of the kinds above it)? */
function tagged(onto: Ontology, type: string, tag: string): boolean {
  for (let t = type; t; t = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : '') if ((onto.types[t]?.tags ?? []).includes(tag)) return true
  return false
}

export class QuickEvents {
  kind: QuickKind = 'chest'
  private door = { to: '', x: 0, y: 0, back: true, label: undefined as Text | undefined }
  private box = { type: '', items: [] as Row[] }
  private words = { type: '', text: undefined as Text | undefined }
  private bed = { type: '' }
  private who = { name: undefined as Text | undefined, type: '', line: undefined as Text | undefined }
  private shop = { stock: [] as Row[], purse: 20 }
  private favour = { kind: 'bring' as Favour['kind'], what: '', count: 3, to: '', title: undefined as Text | undefined, ask: undefined as Text | undefined, thanks: undefined as Text | undefined, xp: 20, item: '', itemCount: 1 }

  /** The kinds each event offers, from the game's types. */
  private kinds(ctx: Ctx) {
    const onto = ctx.onto()
    const all = Object.keys(onto.types).sort()
    const people = ctx.store.list<PersonFile>('people').map((p) => p.data.type)
    const common = people.sort((a, b) => people.filter((x) => x === b).length - people.filter((x) => x === a).length)[0]
    return {
      containers: all.filter((t) => /^fixture\/container\//.test(t) || typeof onto.types[t]?.props?.capacity === 'number'),
      readable: all.filter((t) => t.startsWith('fixture/') && tagged(onto, t, 'readable')),
      beds: all.filter((t) => /(^|\/)bed(\/|$)|bed$/.test(t)),
      persons: all.filter((t) => t.startsWith('actor/person') && !t.endsWith('/player')),
      person: common ?? (onto.types['actor/person/villager'] ? 'actor/person/villager' : 'actor/person'),
      items: all.filter((t) => t.startsWith('item/')),
    }
  }

  /** The left panel's form for the chosen event. */
  panel(ctx: Ctx, f: Form, refresh: () => void): string {
    const k = this.kinds(ctx)
    const n = namesOf(ctx)
    const society = (ctx.store.game.modules ?? []).includes('society')
    const set = (fn: () => void) => () => (fn(), refresh())
    const rows = (list: Row[], label: string, kinds: string[]) => `${list.map((r, i) => `<div class="row">${f.num(r.count, (v) => set(() => (r.count = Math.max(1, v ?? 1)))(), { min: 1 })} × ${f.select(kinds, r.type, (v) => set(() => (r.type = v))())} ${f.link('✕', set(() => list.splice(i, 1)), { cls: 'x' })}</div>`).join('')}<div class="row add">${f.select(kinds, '', (v) => v && set(() => list.push({ type: v, count: 1 }))(), { none: label })}</div>`
    this.box.type ||= k.containers[0] ?? ''
    this.words.type ||= k.readable[0] ?? ''
    this.bed.type ||= k.beds[0] ?? ''
    this.who.type ||= k.person
    this.door.to ||= n.maps.find((m) => m !== ctx.map) ?? ctx.map
    this.favour.what ||= k.items[0] ?? 'item/'
    const parts = [`<div class="tools quick">${KINDS.filter(([q]) => q !== 'merchant' || society).map(([q, label, tip]) => `<button data-quick="${q}" class="${q === this.kind ? 'on' : ''}" title="${esc(tip)}">${label}</button>`).join('')}</div>`]
    const name = () => `<label>name ${f.words(this.who.name, (t) => (this.who.name = t))}</label><label>kind ${f.select(k.persons.length ? k.persons : [k.person], this.who.type, (v) => (this.who.type = v))}</label>`
    switch (this.kind) {
      case 'door':
        parts.push(`<label>leads to ${f.select(n.maps, this.door.to, (v) => set(() => (this.door.to = v))())}</label>
          <label>lands at ${f.num(this.door.x, (v) => (this.door.x = v ?? 0))} ${f.num(this.door.y, (v) => (this.door.y = v ?? 0))} ${f.button('Pick on the map', () => void ctx.pick('where the door leads', this.door.to).then((p) => p && set(() => Object.assign(this.door, { to: p.map, x: p.x, y: p.y }))()))}</label>
          <label>its label ${f.words(this.door.label, (t) => (this.door.label = t))}</label>
          ${f.check(this.door.back, 'and a way back (picked after it is laid)', (v) => (this.door.back = v))}`)
        break
      case 'chest':
        parts.push(`<label>kind ${f.select(k.containers, this.box.type, (v) => (this.box.type = v))}</label><h3>In it</h3>${rows(this.box.items, '+ something in it', k.items)}`)
        break
      case 'sign':
        parts.push(k.readable.length ? `<label>kind ${f.select(k.readable, this.words.type, (v) => (this.words.type = v))}</label><label>its words ${f.words(this.words.text, (t) => (this.words.text = t), { area: true })}</label>` : '<p class="muted">The game has no readable fixture (a fixture kind tagged <code>readable</code>).</p>')
        break
      case 'bed':
        parts.push(k.beds.length ? `<label>kind ${f.select(k.beds, this.bed.type, (v) => (this.bed.type = v))}</label>` : '<p class="muted">The game has no bed kind.</p>')
        break
      case 'person':
        parts.push(`${name()}<label>a line ${f.words(this.who.line, (t) => (this.who.line = t))}</label>`)
        break
      case 'merchant':
        parts.push(`${name()}<h3>What they sell</h3>${rows(this.shop.stock, '+ a kind to stock', k.items)}<label>their purse ${f.num(this.shop.purse, (v) => (this.shop.purse = Math.max(0, v ?? 0)), { min: 0 })} coins</label>`)
        break
      case 'giver': {
        const fv = this.favour
        parts.push(`${name()}<label>the favour ${f.words(fv.title, (t) => (fv.title = t), { placeholder: 'its title' })}</label>
          <label>${f.select([['bring', 'bring'], ['defeat', 'defeat'], ['talk', 'a word with']], fv.kind, (v) => set(() => (fv.kind = v as Favour['kind']))())}
          ${fv.kind === 'talk' ? f.select(n.people.map((p): [string, string] => [p.id, tx(p.name) || p.id]), fv.to, (v) => (fv.to = v), { none: '(choose someone)' }) : `${f.num(fv.count, (v) => (fv.count = Math.max(1, v ?? 1)), { min: 1 })} × ${f.text(fv.what, (v) => (fv.what = v), { list: 'dlQuickKinds' })}`}</label>
          <label>they ask ${f.words(fv.ask, (t) => (fv.ask = t), { area: true })}</label>
          <label>they thank ${f.words(fv.thanks, (t) => (fv.thanks = t))}</label>
          <label>the reward ${f.num(fv.xp, (v) => (fv.xp = Math.max(0, v ?? 0)), { min: 0 })} xp, ${f.num(fv.itemCount, (v) => (fv.itemCount = Math.max(1, v ?? 1)), { min: 1 })} × ${f.select(k.items, fv.item, (v) => (fv.item = v), { none: 'nothing' })}</label>
          <datalist id="dlQuickKinds">${Object.keys(ctx.onto().types).filter((t) => t.startsWith(fv.kind === 'defeat' ? 'actor/creature' : 'item/')).map((t) => `<option value="${esc(t)}">`).join('')}</datalist>`)
        break
      }
    }
    parts.push('<p class="muted">Then click where it goes.</p>')
    return parts.join('')
  }

  /** Lay the chosen event at a cell of the map shown (one Undo). What to select after. */
  async place(ctx: Ctx, c: Cell): Promise<{ entity?: string; person?: string } | undefined> {
    const s = ctx.store
    const file = s.mapFile(ctx.map)
    if (!file) return undefined
    const taken = idsOf(s.maps().map((m) => m.data), s.list<PersonFile>('people').map((p) => p.data.id))
    const chars = s.game.terrainChars
    const at = { map: ctx.map, x: c.x, y: c.y }
    const name = this.who.name ?? { en: 'Someone', zh: '某人' }
    const en = typeof name === 'string' ? name : name.en
    try {
      switch (this.kind) {
        case 'door': {
          const d = this.door
          const target = s.mapFile(d.to)
          if (!target) return toast('Choose the map it leads to.', 'warn'), undefined
          const back = d.back ? await ctx.pick(`the way back on ${d.to} (it leads to the cell before this door)`, d.to) : undefined
          if (d.back && !back) return undefined
          if (back && back.map !== d.to) return toast(`The way back goes on ${d.to}, where the door leads.`, 'warn'), undefined
          const here = s.get<RawChunk>(file)!.map
          s.batch(`a door to ${d.to}`, () => {
            s.change<RawChunk>(file, 'a door', (ch) => door(ch, c, { map: d.to, x: d.x, y: d.y, label: d.label }, chars))
            if (back) s.change<RawChunk>(target, 'its way back', (ch) => wayBack(here, c, { chunk: ch, at: back, label: here.name }, chars))
          })
          ctx.showMap(at.map)
          return {}
        }
        case 'chest': {
          let id = ''
          s.change<RawChunk>(file, `a ${this.box.type.split('/').pop()} and what is in it`, (ch) => (id = chest(ch, this.box.type, c, this.box.items, taken)))
          return { entity: id }
        }
        case 'sign': {
          if (!this.words.type) return toast('The game has no readable fixture.', 'warn'), undefined
          let id = ''
          s.change<RawChunk>(file, 'a sign', (ch) => (id = sign(ch, this.words.type, c, this.words.text ?? '…', taken)))
          return { entity: id }
        }
        case 'bed': {
          if (!this.bed.type) return toast('The game has no bed kind.', 'warn'), undefined
          let id = ''
          s.change<RawChunk>(file, 'a bed', (ch) => (id = setDown(ch, this.bed.type, c, taken).id))
          return { entity: id }
        }
        case 'person':
        case 'merchant': {
          const id = personId(en, taken)
          const spec = { id, name, type: this.who.type, at, line: this.who.line }
          const coin = (ctx.onto() as { social?: { coin?: string } }).social?.coin
          s.add(`people/${id}.json`, this.kind === 'person' ? person(spec) : merchant({ ...spec, stock: this.shop.stock, purse: this.shop.purse, coin }), `${this.kind === 'person' ? 'a person' : 'a merchant'}: ${en}`)
          return { person: id }
        }
        case 'giver': {
          const fv = this.favour
          if (fv.kind === 'talk' && !fv.to) return toast('Choose whom they send you to.', 'warn'), undefined
          const id = personId(en, taken)
          const title = fv.title ?? { en: `${en}'s Favour`, zh: `${typeof name === 'string' ? name : (name.zh ?? name.en)}的委托` }
          const qid = questId(typeof title === 'string' ? title : title.en, new Set(s.list<{ id: string }>('quests').map((q) => q.data.id)))
          const favour: Favour = fv.kind === 'talk' ? { kind: 'talk', to: fv.to, toName: fv.to } : { kind: fv.kind, what: fv.what, count: fv.count }
          const ask = fv.ask ?? (fv.kind === 'bring' ? { en: `Could you bring me ${fv.count} of these?`, zh: `能帮我带${fv.count}个来吗？` } : fv.kind === 'defeat' ? { en: `Could you deal with ${fv.count} of them?`, zh: `能帮我对付${fv.count}个吗？` } : { en: 'Would you have a word with someone for me?', zh: '能替我去找个人说句话吗？' })
          s.batch(`a quest giver: ${en}`, () => {
            s.add(`people/${id}.json`, person({ id, name, type: this.who.type, at, line: this.who.line }), `a person: ${en}`)
            s.add(`quests/${qid}.json`, favourQuest({ id: qid, title, giver: id, favour, ask, thanks: fv.thanks ?? { en: 'Thank you.', zh: '谢谢你。' }, reward: { xp: fv.xp, ...(fv.item && { items: [{ type: fv.item, count: fv.itemCount }] }) } }), `the favour ${qid}`)
          })
          toast(`${en} and the favour ${qid}: open it in the Quests mode to change its words and stages.`)
          return { person: id }
        }
      }
    } catch (e) {
      if (e instanceof EditError) return toast(e.message, 'warn'), undefined
      throw e
    }
    return undefined
  }
}
