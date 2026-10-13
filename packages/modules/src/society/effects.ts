// The society module's primitives (docs/npc-sandbox.md): whose things are, what people saw and say, the watch's
// ledger and its cells, trade and coin, following, the talk panel. Each runs in its host's outcome.

import { NO_EXPIRY, TICKS_PER_HOUR, chooseLine, gearLevel, gearProps, type Effect, type EffectRunner, type Entity, type GameEvent, type Pos, type RoleName, rollAffixes } from '@openworld/engine'
import { bountyKey, lawId, pardonKey } from './social.ts'
import { socialOf } from './state.ts'

type SocialEffect = Effect

export function socialEffect(fx: EffectRunner, eff: SocialEffect, ev: GameEvent): void {
  const host = fx.hostEntity(ev)
  const eng = fx.eng
  const w = eng.world
  const s = socialOf(eng)
  const actor = ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
  const role = (r: RoleName | undefined, dflt?: Entity) => (r ? (r === 'host' ? host : w.get(fx.roleRef(ev, r)?.e)) : dflt)
  const toPlayer = (who: Entity | undefined) => !!who && who.id === w.state.player
  switch (eff.op) {
    case 'own': {
      if (!host) return
      const to = eff.to ? fx.roleRef(ev, eff.to) : undefined
      w.setProp(host, 'owner', to ? to.e : '')
      return
    }
    case 'witness': {
      if (!host?.npc || !actor) return
      if (ev.params?.act !== 'presence') {
        s.judge(host, ev)
        return
      }
      // a presence: a stranger remembered known again, a face learnt, a trespass taken in
      if (ev.params?.suspect === true) s.attribute(host, actor)
      if (ev.params?.meet === true) s.meet(host, actor.id)
      if (ev.params?.trespass === true) s.judge(host, ev)
      return
    }
    case 'tell': {
      const to = role(eff.to)
      if (!host?.npc || !to || to.id === host.id) return
      const told = s.tell(host, to)
      const newest = told[told.length - 1]
      const grudge = s.grudge(host, to.id)
      // (said aloud: "you" only to the one at the keys, who hears it as theirs)
      const you = toPlayer(to) ? to.id : undefined
      if (newest) w.fx.push({ t: 'say', who: host.id, to: to.id, text: { en: `Did you hear? ${s.deedWords(newest, 'en', you)}.`, zh: `你听说了吗？${s.deedWords(newest, 'zh', you)}。` } })
      else if (grudge) w.fx.push({ t: 'say', who: host.id, text: { en: `I know what you did. ${s.deedWords(grudge, 'en', to.id)}.`, zh: `我知道你干了什么。${s.deedWords(grudge, 'zh', to.id)}。` }, mood: 'angry' })
      else if (ev.kind === 'impulse/handle') {
        // no deed to tell: the place's fresh news (the story's topic, if they have a word on it), else quiet days
        const news = chooseLine(eng, host, { topicOnly: true })
        w.fx.push({ t: 'say', who: host.id, text: news?.text ?? { en: 'Nothing much has happened. Quiet days.', zh: '没出什么事。日子挺平静的。' }, ...(news?.mood && { mood: news.mood }) })
      }
      if (told.length) eng.queue({ kind: 'impulse/notify', host: { e: to.id }, roles: { source: ev.host }, params: { what: 'news', deeds: told.map((d) => s.key(d)).join('|') }, cause: ev.cause, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
      return
    }
    case 'hear': {
      const from = ev.roles.source ? w.get(ev.roles.source.e) : undefined
      const keys = String(ev.params?.deeds ?? '').split('|').filter(Boolean)
      if (host?.npc && from) s.hear(host, from, keys)
      return
    }
    case 'conscience':
      if (host) s.conscience(host, ev)
      return
    case 'moral':
      if (host && eff.op === 'moral') s.moral(host, eff.key, fx.amount(ev, eff.delta))
      return
    case 'moveIn': {
      // the host, asked by one it holds in full regard, comes to live on their home ground (a bed free there): its days
      // there from now on (NpcData.resident), and it goes at once; with no bed free it says so
      const r = s.params.residence
      if (!host?.npc || !r || !actor) return
      const bed = s.residenceBeds().find((b) => !b.who)
      if (!bed) return void w.fx.push({ t: 'say', who: host.id, text: r.full })
      host.npc.resident = {
        map: r.map,
        slot: bed.anchor,
        schedule: [
          { from: 21, to: 7, map: r.map, x: bed.at[0], y: bed.at[1], activity: 'sleep' },
          { from: 7, to: 21, map: r.map, x: bed.day[0], y: bed.day[1], activity: 'live' },
        ],
      }
      host.npc.home = { map: r.map, x: bed.at[0], y: bed.at[1] }
      host.npc.override = undefined
      w.setProp(host, 'resident', r.map)
      w.fx.push({ t: 'say', who: host.id, text: r.yes, mood: 'happy' })
      eng.travel(host, { map: r.map, x: bed.day[0], y: bed.day[1] })
      return
    }
    case 'regard': {
      const to = role(eff.toward, actor)
      if (host?.npc && to) s.changeRegard(host, to.id, fx.amount(ev, eff.delta))
      return
    }
    case 'settle': {
      const to = role(eff.toward, actor)
      if (host?.npc && to) s.settle(host, to.id, eff.deed)
      return
    }
    case 'fear': {
      const of = role(eff.of, actor)
      if (host?.npc && of) s.frighten(host, of.id)
      return
    }
    case 'report': {
      if (!host?.npc) return
      for (const d of host.npc.memory?.deeds ?? []) {
        if (!d.by || d.reported || s.settled(d)) continue
        const law = s.lawAt(d.map)
        if (!law || !w.get(lawId(law.id))) continue
        d.reported = true
        eng.queue({ kind: 'impulse/notify', host: { e: lawId(law.id) }, roles: { actor: { e: d.by }, source: ev.host }, params: { what: 'report', amount: d.fine, key: s.key(d), deed: d.deed }, cause: ev.cause, origin: 'world', depth: (ev.depth ?? 0) + 1 })
      }
      return
    }
    case 'charge': {
      if (!host || !actor) return
      const law = Object.values(w.onto.data.laws ?? {}).find((l) => lawId(l.id) === host.id)
      const name = (l: 'en' | 'zh') => (law ? (typeof law.name === 'string' ? law.name : l === 'zh' ? (law.name.zh ?? law.name.en) : law.name.en) : host.id)
      if (eff.clear) {
        if (w.num(host, bountyKey(actor.id)) > 0 && toPlayer(actor)) w.fx.push({ t: 'log', text: { en: `Your debt to ${name('en')} is settled.`, zh: `你欠${name('zh')}的已经了结。` }, tone: 'good' })
        w.setProp(host, bountyKey(actor.id), undefined)
        w.setProp(host, pardonKey(actor.id), w.state.tick)
        return
      }
      const key = String(ev.params?.key ?? '')
      if (key && w.prop(host, `charged:${key}`) !== undefined) return
      const n = Math.max(0, Math.round(fx.amount(ev, { param: 'amount' })))
      if (!n) return
      const now = w.num(host, bountyKey(actor.id)) + n
      w.setProp(host, bountyKey(actor.id), now)
      if (key) w.setProp(host, `charged:${key}`, w.state.tick)
      // a deed charged long ago is forgotten by the ledger (its key need not be kept)
      for (const [k, v] of Object.entries(host.props ?? {})) if (k.startsWith('charged:') && typeof v === 'number' && w.state.tick - v > 7 * TICKS_PER_HOUR * 24) w.setProp(host, k, undefined)
      const watch = name('en')
      if (toPlayer(actor)) w.fx.push({ t: 'log', text: { en: `${watch[0].toUpperCase()}${watch.slice(1)} wants you: bounty ${now}.`, zh: `${name('zh')}在通缉你：悬赏 ${now}。` }, tone: 'bad' })
      return
    }
    case 'surrender':
      if (host) giveBack(fx, host, ev.roles.source ? w.get(ev.roles.source.e) : undefined)
      return
    case 'die': {
      if (!host?.npc || w.hasTag(host, 'essential')) return
      const into = w.prop(host, 'bodyType')
      if (typeof into !== 'string' || !w.onto.hasType(into)) throw new Error(`${host.id} has no body to become (bodyType)`)
      const name = (l: 'en' | 'zh') => eng.nameOf({ e: host.id }, l)
      const named = { en: `${name('en')}'s body`, zh: `${name('zh')}的遗体` }
      // what it held goes in with what it carried; its statuses end with it
      const held = w.get(host.held)
      if (held) w.place(held, { on: 'inside', holder: host.id })
      for (const st of Object.keys(host.statuses ?? {})) w.clearStatus(ev.host, st)
      w.setProp(host, 'owner', s.householdOf(host) ?? host.id)
      delete host.npc
      delete host.ai
      delete host.combat
      eng.touch(ev.host)
      w.transform(host, into)
      host.name = named
      w.setStatus(ev.host, 'open', NO_EXPIRY)
      eng.touch(ev.host)
      eng.npcs.invalidate()
      // one a quest names is gone (docs/quests.md §2.3)
      if (eng.quests.aliased(host.id)) eng.quests.news({ kind: 'gone', target: host.id })
      return
    }
    case 'pay': {
      const to = role(eff.to)
      if (host && to && to.id !== host.id) payCoins(fx, host, to, Math.max(0, Math.floor(fx.amount(ev, eff.amount))))
      return
    }
    case 'give': {
      const to = role(eff.to)
      const item = ev.roles.item ? w.get(ev.roles.item.e) : undefined
      if (!host || !to || !item || item.id === host.id || to.id === host.id) return
      if (!((item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === host.id)) return
      handOver(fx, host, item, to)
      return
    }
    case 'sell': {
      const item = w.get(String(ev.params?.item ?? ''))
      if (!host || !actor || !item) return
      if (!s.stock(host).some((x) => x.id === item.id)) return void w.fx.push({ t: 'say', who: host.id, text: { en: "That's not for sale.", zh: '那个不卖。' } })
      const price = s.priceToBuy(item, host, actor)
      if (s.purse(actor) < price) return void w.fx.push({ t: 'say', who: host.id, text: { en: `That's ${price}. Come back with the coin.`, zh: `这个要 ${price}。钱带够了再来。` } })
      w.setProp(item, 'owner', actor.id)
      eng.touch({ e: item.id })
      w.place(item, { on: 'inside', holder: actor.id })
      eng.touch({ e: item.id })
      eng.queue({ kind: 'impulse/notify', host: { e: actor.id }, roles: { source: ev.host, actor: { e: actor.id } }, params: { what: 'pay', amount: price }, cause: ev.cause, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
      if (toPlayer(actor)) w.fx.push({ t: 'log', text: { en: `You buy ${eng.nameOf({ e: item.id }, 'en')} for ${price}.`, zh: `你花 ${price} 买下了${eng.nameOf({ e: item.id }, 'zh')}。` } })
      return
    }
    case 'buy': {
      const item = ev.roles.instrument ? w.get(ev.roles.instrument.e) : undefined
      if (!host || !actor || !item) return
      if (!s.buys(host, item, actor)) return void w.fx.push({ t: 'say', who: host.id, text: s.isAnothers(item, actor) ? { en: "I don't touch what isn't yours.", zh: '不是你的东西我不收。' } : { en: "I've no use for that.", zh: '那东西我用不上。' } })
      const price = s.priceToSell(item, actor, host)
      if (s.purse(host) < price) return void w.fx.push({ t: 'say', who: host.id, text: { en: "I can't pay what it's worth today.", zh: '今天我出不起这个价。' } })
      payCoins(fx, host, actor, price)
      eng.queue({ kind: 'impulse/notify', host: { e: actor.id }, roles: { source: ev.host, actor: { e: actor.id }, item: { e: item.id } }, params: { what: 'give' }, cause: ev.cause, origin: ev.origin, depth: (ev.depth ?? 0) + 1 })
      if (toPlayer(actor)) w.fx.push({ t: 'log', text: { en: `You sell ${eng.nameOf({ e: item.id }, 'en')} for ${price}.`, zh: `你以 ${price} 卖掉了${eng.nameOf({ e: item.id }, 'zh')}。` } })
      return
    }
    case 'follow': {
      if (!host?.npc) return
      const lead = role(eff.leader)
      w.setProp(host, 'follow', lead && lead.id !== host.id ? lead.id : undefined)
      w.setProp(host, 'waiting', undefined)
      delete host.npc.override
      return
    }
    case 'talk': {
      if (!host?.npc || !actor || actor.id === host.id) return
      s.meet(host, actor.id)
      const m = s.record(host)!
      const day = w.calendar().day
      if ((m.chatted ??= {})[actor.id] !== day) {
        m.chatted[actor.id] = day
        s.changeRegard(host, actor.id, s.params.talk)
      }
      if (toPlayer(actor)) w.fx.push({ t: 'talk', who: host.id })
      return
    }
    case 'fine': {
      const law = s.lawHere(host)
      const bounty = law && actor ? s.bounty(law.id, actor.id) : 0
      if (!host || !actor || !law || bounty <= 0) return
      const depth = (ev.depth ?? 0) + 1
      eng.queue({ kind: 'impulse/notify', host: { e: actor.id }, roles: { source: ev.host, actor: { e: actor.id } }, params: { what: 'pay', amount: Math.round(bounty * (eff.mul ?? 1)) }, cause: ev.cause, origin: ev.origin, depth })
      if (!eff.keep) eng.queue({ kind: 'impulse/notify', host: { e: actor.id }, roles: { source: ev.host, actor: { e: actor.id } }, params: { what: 'surrender' }, cause: ev.cause, origin: ev.origin, depth })
      eng.queue({ kind: 'impulse/notify', host: { e: lawId(law.id) }, roles: { actor: { e: actor.id }, source: ev.host }, params: { what: 'pardon' }, cause: ev.cause, origin: 'world', depth })
      return
    }
    case 'imprison': {
      const law = s.lawHere(host)
      const bounty = law && actor ? s.bounty(law.id, actor.id) : 0
      const jail = s.jailOf(law) ?? w.posOf(host)
      if (!host || !actor || !law || bounty <= 0 || !jail) return
      const depth = (ev.depth ?? 0) + 1
      eng.queue({ kind: 'impulse/notify', host: { e: actor.id }, roles: { source: ev.host, actor: { e: actor.id } }, params: { what: 'surrender' }, cause: ev.cause, origin: ev.origin, depth })
      eng.queue({ kind: 'impulse/notify', host: { e: actor.id }, roles: { source: ev.host, actor: { e: actor.id } }, params: { what: 'jail', map: jail.map, x: jail.x, y: jail.y, hours: s.jailHours(bounty) }, cause: ev.cause, origin: ev.origin, depth })
      eng.queue({ kind: 'impulse/notify', host: { e: lawId(law.id) }, roles: { actor: { e: actor.id }, source: ev.host }, params: { what: 'pardon' }, cause: ev.cause, origin: 'world', depth })
      return
    }
    case 'jail': {
      const p = ev.params
      if (!host || typeof p?.map !== 'string' || typeof p.x !== 'number' || typeof p.y !== 'number') return
      toJail(fx, host, ev, { map: p.map, x: p.x, y: p.y }, typeof p.hours === 'number' ? p.hours : 1)
      return
    }
    case 'arrest': {
      const law = s.lawHere(actor)
      const bounty = law && host ? s.bounty(law.id, host.id) : 0
      if (!host || !actor || !law || bounty <= 0 || w.prop(actor, 'watch') !== law.id) return
      const depth = (ev.depth ?? 0) + 1
      const pardon = () => eng.queue({ kind: 'impulse/notify', host: { e: lawId(law.id) }, roles: { actor: { e: host.id }, source: { e: actor.id } }, params: { what: 'pardon' }, cause: ev.cause, origin: 'world', depth })
      // one down before the watch is taken to the cells
      if (w.hasStatus(ev.host, 'down')) {
        giveBack(fx, host, actor)
        toJail(fx, host, ev, s.jailOf(law) ?? w.posOf(actor)!, s.jailHours(bounty))
        return pardon()
      }
      // the one at the keys chooses (the guard's talk opens); anyone else yields
      if (toPlayer(host)) return void w.fx.push({ t: 'talk', who: actor.id, arrest: true })
      giveBack(fx, host, actor)
      if (s.purse(host) >= bounty && !s.unpardonable(law, bounty)) payCoins(fx, host, actor, bounty)
      else toJail(fx, host, ev, s.jailOf(law) ?? w.posOf(actor)!, s.jailHours(bounty))
      pardon()
      return
    }
    case 'restock': {
      if (!host) return
      const day = w.calendar().day
      if (w.prop(host, 'restocked') === day) return
      w.setProp(host, 'restocked', day)
      const have = (type: string) => (host.contents ?? []).filter((id) => w.get(id)?.type === type).length
      for (const part of String(w.prop(host, 'stock') ?? '').split('|').filter(Boolean)) {
        const [type, count] = part.split('*')
        if (!w.onto.hasType(type)) continue
        // gear comes at the merchant's level (its `gearLevel` prop; the first), its main stats scaled to it (engine
        // recipes.ts), and rolls its extras as it is made (engine affixes.ts)
        const def = w.onto.resolve(type)
        const slot = def.props.slot
        const level = gearLevel(w.onto.data.params?.gearLevels, w.num(host, 'gearLevel', 1))
        const gear = () => (typeof slot === 'string' ? { props: { ...gearProps(def.props, undefined, undefined, level, w.onto.data.params?.gearLevels), ...rollAffixes(w.onto.data, slot, () => w.rand(), { level }) } } : {})
        for (let n = have(type); n < fx.most(Math.max(1, Number(count) || 1), 'a restock'); n++) eng.touch({ e: w.create(type, { on: 'inside', holder: host.id }, gear()).id })
      }
      const purse = w.num(host, 'purse', 0)
      for (let n = s.purse(host); n < Math.min(purse, 500); n++) eng.touch({ e: w.create(s.params.coin, { on: 'inside', holder: host.id }).id })
      return
    }
    case 'calm': {
      if (!host) return
      if (host.npc) delete host.ai
      if (w.hasStatus(ev.host, 'drawn')) eng.removeStatus(ev.host, 'drawn')
      return
    }
  }
}

/** Coins from one's bag to another's: theirs now (as much as one has, up to n). */
function payCoins(fx: EffectRunner, from: Entity, to: Entity, n: number): number {
  const w = fx.eng.world
  const coins = socialOf(fx.eng).coins(from).slice(0, n)
  for (const c of coins) {
    w.setProp(c, 'owner', undefined)
    fx.eng.touch({ e: c.id })
    w.place(c, { on: 'inside', holder: to.id })
    fx.eng.touch({ e: c.id })
  }
  return coins.length
}

/** A thing from one's bag to another: theirs now; worn, it comes off first. */
function handOver(fx: EffectRunner, from: Entity, item: Entity, to: Entity): void {
  const w = fx.eng.world
  for (const [k, v] of Object.entries(from.props ?? {})) if (k.startsWith('wear:') && v === item.id) w.setProp(from, k, undefined)
  w.setProp(item, 'owner', w.isAgent(to) ? to.id : undefined)
  fx.eng.touch({ e: item.id })
  w.place(item, { on: 'inside', holder: to.id })
  delete item.dropped
  fx.eng.touch({ e: item.id })
}

/** What one carries that is another's goes back, each to its owner (else to `fallback`, the one who takes it). */
function giveBack(fx: EffectRunner, host: Entity, fallback: Entity | undefined): number {
  const eng = fx.eng
  const w = eng.world
  const s = socialOf(eng)
  let n = 0
  for (const id of [...(host.contents ?? []), ...(host.held ? [host.held] : [])]) {
    const it = w.get(id)
    if (!it || it.frozenBy || !s.isAnothers(it, host)) continue
    const owner = s.ownerOf(it)!
    const to = s.peopleOf(owner).find((p) => p.id !== host.id) ?? fallback
    if (!to || to.id === host.id) continue
    for (const [k, v] of Object.entries(host.props ?? {})) if (k.startsWith('wear:') && v === it.id) w.setProp(host, k, undefined)
    w.setProp(it, 'owner', owner)
    eng.touch({ e: it.id })
    w.place(it, { on: 'inside', holder: to.id })
    eng.touch({ e: it.id })
    n++
  }
  if (n && host.id === w.state.player) w.fx.push({ t: 'log', text: { en: 'What was not yours is taken back.', zh: '不属于你的东西被收回了。' }, tone: 'warn' })
  return n
}

/** One goes to the cells for so many hours: up if down, the blade away; time passes at once for the one at the keys. */
function toJail(fx: EffectRunner, host: Entity, ev: GameEvent, at: Pos, hours: number): void {
  const eng = fx.eng
  const w = eng.world
  if (w.hasStatus(ev.host, 'down')) {
    w.clearStatus(ev.host, 'down')
    if (w.num(host, 'hp') < 1) w.setProp(host, 'hp', 1)
  }
  for (const st of ['drawn', 'sneaking']) if (w.hasStatus(ev.host, st)) eng.removeStatus(ev.host, st)
  if (host.ai && host.npc) delete host.ai
  const ticks = Math.round(Math.max(0.5, hours) * TICKS_PER_HOUR)
  if (w.onto.status('jailed')) w.setStatus(ev.host, 'jailed', w.state.tick + ticks)
  if (host.id === w.state.player) {
    eng.passTime(ticks)
    w.fx.push({ t: 'log', text: { en: `You are taken to the cells, and kept there ${Math.round(hours)} hours.`, zh: `你被关进了牢房，关了 ${Math.round(hours)} 个小时。` }, tone: 'warn' })
    if (w.posOf(host)?.map !== at.map) eng.travel(host, at)
    else eng.placeSelf(host, at)
  } else eng.placeSelf(host, at)
}

