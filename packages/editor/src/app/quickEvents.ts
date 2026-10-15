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
import { phrase } from './lang.ts'
import { esc, t, toast, tx } from './ui.ts'
import { adopt, adoptTexts } from './words.ts'

export type QuickKind = 'door' | 'chest' | 'sign' | 'bed' | 'person' | 'merchant' | 'giver'
const KINDS: [QuickKind, string, string][] = [
  ['door', phrase('Door'), phrase('a door to another map (and the way back)')],
  ['chest', phrase('Chest'), phrase('a chest and what is in it')],
  ['sign', phrase('Sign'), phrase('a sign with its words')],
  ['bed', phrase('Bed'), phrase('a bed to sleep in')],
  ['person', phrase('Person'), phrase('someone standing here, with a line')],
  ['merchant', phrase('Merchant'), phrase('someone who trades: a stock and a purse (the society module)')],
  ['giver', phrase('Quest giver'), phrase('someone with a favour: bring, defeat, or a word with someone')],
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
    const parts = [`<div class="tools quick">${KINDS.filter(([q]) => q !== 'merchant' || society).map(([q, label, tip]) => `<button data-quick="${q}" class="${q === this.kind ? 'on' : ''}" title="${esc(t(tip))}">${t(label)}</button>`).join('')}</div>`]
    const name = () => `<label>${t('name')} ${f.words(this.who.name, (w) => (this.who.name = w))}</label><label>${t('kind')} ${f.select(k.persons.length ? k.persons : [k.person], this.who.type, (v) => (this.who.type = v))}</label>`
    switch (this.kind) {
      case 'door':
        parts.push(`<label>${t('leads to')} ${f.select(n.maps, this.door.to, (v) => set(() => (this.door.to = v))())}</label>
          <label>${t('lands at')} ${f.num(this.door.x, (v) => (this.door.x = v ?? 0))} ${f.num(this.door.y, (v) => (this.door.y = v ?? 0))} ${f.button(t('Pick on the map'), () => void ctx.pick(t('where the door leads'), this.door.to).then((p) => p && set(() => Object.assign(this.door, { to: p.map, x: p.x, y: p.y }))()))}</label>
          <label>${t('its label')} ${f.words(this.door.label, (w) => (this.door.label = w))}</label>
          ${f.check(this.door.back, t('and a way back (picked after it is laid)'), (v) => (this.door.back = v))}`)
        break
      case 'chest':
        parts.push(`<label>${t('kind')} ${f.select(k.containers, this.box.type, (v) => (this.box.type = v))}</label><h3>${t('In it')}</h3>${rows(this.box.items, t('+ something in it'), k.items)}`)
        break
      case 'sign':
        parts.push(k.readable.length ? `<label>${t('kind')} ${f.select(k.readable, this.words.type, (v) => (this.words.type = v))}</label><label>${t('its words')} ${f.words(this.words.text, (w) => (this.words.text = w), { area: true })}</label>` : `<p class="muted">${t('The game has no readable fixture (a fixture kind tagged {tag}).', { tag: '<code>readable</code>' })}</p>`)
        break
      case 'bed':
        parts.push(k.beds.length ? `<label>${t('kind')} ${f.select(k.beds, this.bed.type, (v) => (this.bed.type = v))}</label>` : `<p class="muted">${t('The game has no bed kind.')}</p>`)
        break
      case 'person':
        parts.push(`${name()}<label>${t('a line')} ${f.words(this.who.line, (w) => (this.who.line = w))}</label>`)
        break
      case 'merchant':
        parts.push(`${name()}<h3>${t('What they sell')}</h3>${rows(this.shop.stock, t('+ a kind to stock'), k.items)}<label>${t('their purse')} ${f.num(this.shop.purse, (v) => (this.shop.purse = Math.max(0, v ?? 0)), { min: 0 })} ${t('coins')}</label>`)
        break
      case 'giver': {
        const fv = this.favour
        parts.push(`${name()}<label>${t('the favour')} ${f.words(fv.title, (w) => (fv.title = w), { placeholder: t('its title') })}</label>
          <label>${f.select([['bring', t('bring')], ['defeat', t('defeat')], ['talk', t('a word with')]], fv.kind, (v) => set(() => (fv.kind = v as Favour['kind']))())}
          ${fv.kind === 'talk' ? f.select(n.people.map((p): [string, string] => [p.id, tx(p.name) || p.id]), fv.to, (v) => (fv.to = v), { none: t('(choose someone)') }) : `${f.num(fv.count, (v) => (fv.count = Math.max(1, v ?? 1)), { min: 1 })} × ${f.text(fv.what, (v) => (fv.what = v), { list: 'dlQuickKinds' })}`}</label>
          <label>${t('they ask')} ${f.words(fv.ask, (w) => (fv.ask = w), { area: true })}</label>
          <label>${t('they thank')} ${f.words(fv.thanks, (w) => (fv.thanks = w))}</label>
          <label>${t('the reward')} ${f.num(fv.xp, (v) => (fv.xp = Math.max(0, v ?? 0)), { min: 0 })} xp, ${f.num(fv.itemCount, (v) => (fv.itemCount = Math.max(1, v ?? 1)), { min: 1 })} × ${f.select(k.items, fv.item, (v) => (fv.item = v), { none: t('nothing') })}</label>
          <datalist id="dlQuickKinds">${Object.keys(ctx.onto().types).filter((x) => x.startsWith(fv.kind === 'defeat' ? 'actor/creature' : 'item/')).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`)
        break
      }
    }
    parts.push(`<p class="muted">${t('Then click where it goes.')}</p>`)
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
    // the words the editor gives what was left empty: in the game's language (their translations into the tables)
    const name = this.who.name ?? { en: 'Someone', zh: '某人' }
    const en = tx(name)
    try {
      switch (this.kind) {
        case 'door': {
          const d = this.door
          const target = s.mapFile(d.to)
          if (!target) return toast(t('Choose the map it leads to.'), 'warn'), undefined
          const back = d.back ? await ctx.pick(t('the way back on {map} (it leads to the cell before this door)', { map: d.to }), d.to) : undefined
          if (d.back && !back) return undefined
          if (back && back.map !== d.to) return toast(t('The way back goes on {map}, where the door leads.', { map: d.to }), 'warn'), undefined
          const here = s.get<RawChunk>(file)!.map
          s.batch(t('a door to {map}', { map: d.to }), () => {
            s.change<RawChunk>(file, t('a door'), (ch) => door(ch, c, { map: d.to, x: d.x, y: d.y, label: d.label }, chars))
            if (back) s.change<RawChunk>(target, t('its way back'), (ch) => wayBack(here, c, { chunk: ch, at: back, label: here.name }, chars))
          })
          ctx.showMap(at.map)
          return {}
        }
        case 'chest': {
          let id = ''
          s.change<RawChunk>(file, t('a {kind} and what is in it', { kind: this.box.type.split('/').pop()! }), (ch) => (id = chest(ch, this.box.type, c, this.box.items, taken)))
          return { entity: id }
        }
        case 'sign': {
          if (!this.words.type) return toast(t('The game has no readable fixture.'), 'warn'), undefined
          let id = ''
          s.change<RawChunk>(file, t('a sign'), (ch) => (id = sign(ch, this.words.type, c, this.words.text ?? '…', taken)))
          return { entity: id }
        }
        case 'bed': {
          if (!this.bed.type) return toast(t('The game has no bed kind.'), 'warn'), undefined
          let id = ''
          s.change<RawChunk>(file, t('a bed'), (ch) => (id = setDown(ch, this.bed.type, c, taken).id))
          return { entity: id }
        }
        case 'person':
        case 'merchant': {
          const id = personId(en, taken)
          const coin = (ctx.onto() as { social?: { coin?: string } }).social?.coin
          s.batch(this.kind === 'person' ? t('a person: {name}', { name: en }) : t('a merchant: {name}', { name: en }), () => {
            const spec = { id, name: adopt(name) ?? id, type: this.who.type, at, line: this.who.line }
            s.add(`people/${id}.json`, this.kind === 'person' ? person(spec) : merchant({ ...spec, stock: this.shop.stock, purse: this.shop.purse, coin }), this.kind === 'person' ? t('a person: {name}', { name: en }) : t('a merchant: {name}', { name: en }))
          })
          return { person: id }
        }
        case 'giver': {
          const fv = this.favour
          if (fv.kind === 'talk' && !fv.to) return toast(t('Choose whom they send you to.'), 'warn'), undefined
          const id = personId(typeof name === 'string' ? name : name.en, taken)
          const title = fv.title ?? { en: `${en}'s Favour`, zh: `${en}的委托` }
          const qid = questId(typeof title === 'string' ? title : title.en, new Set(s.list<{ id: string }>('quests').map((q) => q.data.id)))
          const favour: Favour = fv.kind === 'talk' ? { kind: 'talk', to: fv.to, toName: fv.to } : { kind: fv.kind, what: fv.what, count: fv.count }
          const ask = fv.ask ?? (fv.kind === 'bring' ? { en: `Could you bring me ${fv.count} of these?`, zh: `能帮我带${fv.count}个来吗？` } : fv.kind === 'defeat' ? { en: `Could you deal with ${fv.count} of them?`, zh: `能帮我对付${fv.count}个吗？` } : { en: 'Would you have a word with someone for me?', zh: '能替我去找个人说句话吗？' })
          s.batch(t('a quest giver: {name}', { name: en }), () => {
            s.add(`people/${id}.json`, person({ id, name: adopt(name) ?? id, type: this.who.type, at, line: this.who.line }), t('a person: {name}', { name: en }))
            const q = favourQuest({ id: qid, title, giver: id, favour, ask, thanks: fv.thanks ?? { en: 'Thank you.', zh: '谢谢你。' }, reward: { xp: fv.xp, ...(fv.item && { items: [{ type: fv.item, count: fv.itemCount }] }) } })
            s.add(`quests/${qid}.json`, adoptTexts(`quests/${qid}.json`, q), t('the favour {id}', { id: qid }))
          })
          toast(t('{name} and the favour {id}: open it in the Quests mode to change its words and stages.', { name: en, id: qid }))
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
