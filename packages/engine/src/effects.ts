// The fixed, typed set of effect primitives (design.md §6.1). Every primitive writes only the
// rule's host, spawns, or presents; `emit` sends an event to others, which answer for
// themselves. New behaviour is data (rules); only a new primitive is an engine change.

import type { Engine } from './engine.ts'
import { evalCond, matchSelector, rolesOf } from './rules.ts'
import type { AiData, Amount, Effect, EmitTo, Entity, GameEvent, Id, Impulse, Place, Pos, PropValue, Ref, RoleName, RoleRef, Text } from './types.ts'
import { GIVEN_LINE, chooseLine, memoryOf, raiseTopic } from './people.ts'
import { TICKS_PER_HOUR } from './calendar.ts'
import { cannotRead, gainXp, learnSkill, readSkill } from './progression.ts'
import { BOON_PREFIX, activeBoon, boonsOf, leaderOf, nearAttunedWaypoint } from './boons.ts'
import { canWield, cannotChoose, chooseProfession, itemProfession } from './profession.ts'
import { appear } from './appear.ts'
import { releaseSkill } from './bosses.ts'
import { NO_EXPIRY, WriteError } from './world.ts'
import { bountyKey, lawId, pardonKey } from './social.ts'
import { madeOf, qualityFor } from './recipes.ts'
import { restyled } from './looks.ts'

/** How many things one effect makes at once at most, unless the world says (`params.spawnMax`). */
const SPAWN_MAX = 64

export const PRIMITIVES: Record<Effect['op'], string> = {
  spawn: 'spawn {type, at: role ref, into?: tile|contents|hand, count?, still?} — create new things at a role\'s place (its tile, contents or hand); type may be "@prop:<role>.<key>" (a crop\'s yieldType); count may read a prop or a param; items on the ground pop out for the magnet unless still (then they are taken with F); what cannot be carried (not portable) is made on the holder\'s tile, never in a hand or bag',
  destroy: 'destroy {} — the host is gone (with what it holds); the essential (people) never are: they go down instead',
  transform: 'transform {into} — the host becomes another type ("@prop:key" reads the type from its own prop, e.g. emptyType). A cell is made of things (tile/<terrain>: the floor, what roots in the soil, what fills the volume): water becoming ice is the water transforming; becoming a type whose space in its cell another thing holds (rock into gravel, where a floor is), the host is gone instead; a carried host become a thing that cannot be carried is set down at its holder\'s feet',
  move: 'move {to: role ref, into?: tile|contents|hand} — the host moves itself to a role\'s tile, contents or hand',
  step: 'step {dir?} — the host steps one tile (dir, or the act\'s `dir` param): walls and the solid stop it (a bump), portals carry it',
  addStatus: 'addStatus {status, duration?} — the host gains a status (a threshold/gain event follows)',
  removeStatus: 'removeStatus {status} — the host loses a status (threshold/lose)',
  setProp: 'setProp {key, value}',
  addProp: 'addProp {key, delta, min?, max?} — delta and max are Amounts',
  addTag: 'addTag {tag}',
  removeTag: 'removeTag {tag}',
  hurt: 'hurt {amount, element?, pierce?, blow?} — the host loses health, or durability (hp; its defence applies unless pierce); at none, threshold/cross "broken". blow: a strike\'s — times how well the instrument (what struck, else the striker\'s own body) works on the host\'s material (the efficiency table), and nothing if the instrument is softer than it ("too hard")',
  wear: 'wear — the host (an actor) puts on the thing of its own it is offered (param item, by its slot prop: a helmet on the head; of a slot there are more of, as two rings, the first free), what was in that slot coming off; offered what it wears, it takes it off (world-model.md §6.8); a profession\'s piece (tag profession:<id>, the warrior\'s shield) goes on only for that profession',
  sleep: 'sleep — the host sleeps until it is time to rise (time passes at once for the one at the keys), and wakes with what it was missing given back as its room says (a bedroom: all; elsewhere: half)',
  fall: 'fall — with nothing under it on its storey, the host drops to the first floor below, struck by the drop beyond the safe height (the root of contact/end on)',
  breakdown: 'breakdown — the host breaks into what it is made of (its makeup × the world\'s recovery rate, in its material), what it holds spills out, and it is gone (the root outcome of broken for anything with a makeup)',
  heal: 'heal {amount}',
  feed: 'feed {amount} — the host\'s hunger rises by amount, up to its maxHunger',
  gainXp: 'gainXp {amount} — the host gains experience (times 1 + its stat xpRate); enough raises its level (props xp, level, skillPoints)',
  pocket: 'pocket — the host (an actor) steps into a pocket place (param map, x, y: a place one carries, the Held Ground) and remembers where it stood (its prop pocket.return); in that place already, it steps back out where it was',
  boon: 'boon — the host (a companion) is given a boon (param unlock: its id; carried at once if it carries none) or carries another it has (param boon), the latter only while its leader stands beside an attuned waypoint; a boon is its status boon_<id>, whose lead:<stat> props add to the leader\'s stats',
  foe: 'foe {} — whoever started the chain (the one who struck) becomes the host\'s foe, attacked on sight',
  open: 'open {} — the host opens or closes (toggles the `open` status)',
  dropContents: 'dropContents {still?, to?, keepWorn?, keep?, bundle?} — the host spills what it holds (its bag and its hand) onto its tile, or into a role\'s bag (to: a bundle opened); keepWorn: what it wears and the weapon in its hand stay with it; keep: so do things with any of these tags (important); bundle: what is spilled is packed into a new thing of that type on its tile',
  goto: 'goto {anchor, hours, activity?} — the host (a person) leaves its schedule for a named anchor of its map for some hours',
  topic: "topic {id, days?} — the story's only: something happened that people will talk about (default 4 days); it keeps topic.<id> (the day) and topic.<id>.days as its own props. Others notify the story",
  scene: 'scene {id} — the story\'s only: play a scripted scene',
  craft: 'craft {} — the host uses up what the act\'s recipe needs from what it carries and gets what it makes',
  grow: 'grow — the host\'s stage clock ran out (params status, at: its deadline): it becomes what its stage says next and leaves what the stage yields; a condition the stage needs, unmet, makes it wait (world-model.md §6.5; the root of time/timer)',
  lightning: 'lightning {power} — the world\'s: a bolt seeks what stands tall near the player and emits element lightning to it',
  ashore: 'ashore {} — the host gets out of where it cannot be, to the nearest free tile',
  fallback: 'fallback {} — the story\'s: run the broken invariant\'s authored fallback',
  emit: 'emit {impulse, to, params?, item?, other?, chance?, filter?} — send an impulse (strike, element, coat, restore, push, taken, receive, offered, handle, notify) to a role, "story", "world", {named: id}, {area: {at?, radius}}, {line: {from?, away, length, over?}} or {map: true}; params are values, Amounts, {typeOf: role} (what kind of thing a role is, kept even after it is gone) or {idOf: role} (which thing it is); filter and chance pick who receives it; the receiver answers for itself',
  vfx: 'vfx {at?, fx} — play a visual effect (at the host unless at names a role)',
  say: 'say {text, who?} — the host says a line ("@line": one of its own lines for the moment; "@given": its line for the item it was given); text fills {host} {actor} {target} {instrument} {other} {item} and {role.key}',
  log: 'log {text} — a message line ({role} = names, {role.key} = that role\'s prop, {param.key} = an event param; "@line": what the host has written on it, its text and text_zh)',
  emote: 'emote {mood: neutral|happy|sad|angry|surprised|shy} — an emote bubble over the host',
  restyle: 'restyle {parts?, colors?} — the host\'s look changes (docs/looks.md): a part per slot of the world\'s look table (hair: "hair.bob"; null empties the slot), a colour per key (hair, skin, eyes, <slot>.<n>; a colour id or #rrggbb); its map sprite, its portrait and its look:* tags follow, and the change is its own from then on',
  quest: 'quest {} — the host (a person, a notice board) is spoken to about quests (docs/quests.md §2.4): a quest under way that the word moves on (a hand-in, someone it sent you to) sees it; else the host says its offer (accept or decline in the talk panel), the waiting line of its quest, or its own line. Asked with param say = quest: param topic accept / decline takes on or turns down the offer named by param quest, any other topic is told to that quest',
  advance: "advance {} — a quest's: it sees news (a seen event, param news) and moves on: kills it counts, objectives its triggers mark done, the next stage whose trigger holds (and again, while one holds)",
  stage: "stage {n} — a quest's: it reaches stage n (a notice's SetStage), its journal line, objectives, hand-overs, reward, lines and effects, and looks again",
  accept: "accept {} — a quest's: an offer is taken on by the event's actor (its first stage)",
  decline: "decline {} — a quest's: an offer is turned down (a radiant one is withdrawn)",
  failQuest: "failQuest {} — a quest's: past its deadline or told so: an offer is withdrawn, a quest under way reaches its failing stage",
  begin: "begin {} — the story's (the Story Manager): it sees news; the quests that begin on it (auto, their trigger holding) begin, the radiant offers on it (their chance, cap and aliases) are made",
  startQuest: "startQuest {id?, offer?} — the story's or a quest's: the quest named (or param quest) begins for the event's actor (offer: is offered), its aliases filled, else it does not",
  facts: "facts {} — the story's: it keeps the facts it is told (params fact.<key>)",
  news: 'news {kind} — tells the quests what this event is (docs/quests.md §2.3): give (the actor handed the item to the host), deed, hungry',
  learn: 'learn {book?} — book: from the book it holds (the event\'s item: its param skill), no points and no skills before it, the book used up; else the host learns what its act names: param skill (spending its skill points) or param profession (at a trainer; a change gives back the profession branch)',
  appear: "appear {what?} — the world's: what appears by itself on the active map now (the map's own appearances and the world's that fit it, each at its pace, hours and weather, up to its max), or only the appearance given (world-model.md §6.9)",
  release: "release {} — the host's encounter skill lands on the cells its act telegraphed (params skill, ox, oy, ax, ay): a strike to each foe there, a push or pull and a coat as the skill says; the host heals or blinks itself",
  panel: "panel {panel} — the host (a trainer) opens one of the player's panels when the player spoke to it: 'profession'",
  own: 'own {to?} — the host is a role\'s now (its owner prop; no role: nobody\'s). A thing moved by one who is not its owner keeps whose it was (stolen is a thing held by one who does not own it)',
  witness: 'witness {} — the host (a seer) takes in what it saw (a seen event): the deed in it remembered (who did it if it knew them, else how they looked), its regard toward the doer lowered by the deed\'s weight, fear of the violent; on a presence: a face learnt, a stranger it remembered known again (docs/npc-sandbox.md)',
  tell: 'tell {to} — the host tells a role its fresh news (the deeds it knows of, not yet told it): it says the newest, and the role is told (notify what = news, param deeds)',
  hear: 'hear {} — the host takes in the news it is told (params deeds, from the source): second-hand, its regard toward the doers lowered by half the weight',
  regard: 'regard {toward?, delta} — the host\'s regard toward a role (default the actor) changes by delta (−100..100; a gain comes harder the higher it is)',
  settle: 'settle {toward?, deed?} — the host lets go the deeds it holds against a role (default the actor): all, or one kind',
  fear: 'fear {of?} — the host fears a role (default the actor) for a while: it keeps away from them',
  report: 'report {} — the host tells the watch where each deed it knows of was done (of a known doer, not told before, not settled): that watch is told (notify what = report, actor: the doer, params amount, key)',
  charge: "charge {clear?} — the watch's: the actor's bounty rises by param amount (a deed's key charged once); clear: the bounty is paid, the actor pardoned for all before now",
  surrender: 'surrender {} — the host gives back what it carries that is not its own (its owner is another), each to its owner (or the source, when none can take it)',
  die: 'die {} — the host (a person not essential) dies: it becomes its body (its `bodyType`), a container of what it carried and wore, its household\'s (else its own): taking from it is taking what is another\'s',
  pay: "pay {amount, to} — the host pays a role so much of the world's coin from its bag (as much as it has): the coin is the role's now",
  give: 'give {to} — the host gives a role the event\'s item from its bag: the role\'s now',
  sell: 'sell {} — the host (a merchant) sells the actor what it asks for (param item, of its stock) at its price (worth, markup, regard): hands it over, and the buyer is told to pay (notify what = pay, amount)',
  buy: 'buy {} — the host (a merchant) buys the instrument the actor offers (its own to sell, or what a fence takes) at its price: pays, and the seller is told to hand it over (notify what = give)',
  follow: 'follow {leader?} — the host follows a role (its follow prop: it walks after them, from map to map), or (no leader) stops',
  talk: 'talk {} — the host is spoken to: it knows the speaker by sight, warms to them once a day (the social talk number), and its talk panel opens for the one at the keys',
  fine: "fine {mul?, keep?} — the host (one who keeps the watch) fines the actor its bounty there (times mul: a bribe's): the actor is told to pay it to the host and (unless keep) to give back what is not theirs; the watch, that it is paid",
  imprison: "imprison {} — the host (one who keeps the watch) sends the actor to its watch's jail for hours as its bounty says: told to go (notify what = jail, params map, x, y, hours) and give back what is not theirs; the watch, that it is paid",
  jail: 'jail {} — the host goes to the jail named (params map, x, y) and is held there the hours (param hours): it gets up if down; time passes at once for the one at the keys',
  arrest: "arrest {} — the host (wanted where the actor keeps the watch) is stopped: the one at the keys chooses (the guard's talk opens: pay, jail, persuade, bribe, resist); anyone else yields — pays if it can, else goes to the cells; one down is taken to the cells",
  restock: 'restock {} — the host has its stock again once a day: its stock prop (types, `type*count` by `|`) made up, its coin up to its purse prop',
  calm: 'calm {} — the host (a person who fought) forgets its foes and puts its weapon away',
}

/** Primitives only the story's and the world's rules may use. */
export const RESIDENT_ONLY = new Set<Effect['op']>(['topic', 'scene', 'lightning', 'fallback', 'appear', 'begin', 'startQuest', 'facts', 'advance', 'stage', 'accept', 'decline', 'failQuest'])
/** Primitives only a quest's own rules may use (docs/quests.md: a quest writes only itself). */
export const QUEST_ONLY = new Set<Effect['op']>(['advance', 'stage', 'accept', 'decline', 'failQuest'])

export class EffectRunner {
  constructor(private eng: Engine) {}

  private ref(ev: GameEvent, r: RoleRef): Ref | undefined {
    const w = this.eng.world
    // the cell under a role: what makes it up on top
    if (r.startsWith('tileOf:')) {
      const p = w.refPos(this.roleRef(ev, r.slice(7) as RoleName))
      const top = p && w.cellTop(p.map, p.x, p.y)
      return top ? { e: top.id } : undefined
    }
    return this.roleRef(ev, r as RoleName)
  }

  private roleRef(ev: GameEvent, r: RoleName): Ref | undefined {
    return r === 'host' ? ev.host : ev.roles[r]
  }

  private hostEntity(ev: GameEvent): Entity | undefined {
    return 'e' in ev.host ? this.eng.world.get(ev.host.e) : undefined
  }

  private pos(ev: GameEvent, r: RoleRef): Pos | undefined {
    return this.eng.world.refPos(this.ref(ev, r))
  }

  amount(ev: GameEvent, a: Amount): number {
    let n: number
    if (typeof a === 'number') n = a
    else if ('param' in a) {
      const v = ev.params?.[a.param]
      n = (typeof v === 'number' ? v : 0) * (a.mul ?? 1) + (a.add ?? 0)
    } else {
      const v = this.eng.world.view(this.roleRef(ev, a.of))?.props[a.prop]
      n = (typeof v === 'number' ? v : 0) * (a.mul ?? 1) + (a.add ?? 0)
    }
    // a number the world can hold: no NaN (a prop that is a word), no Infinity (an overflow)
    if (!Number.isFinite(n)) throw new Error(`an amount that is not a finite number (${JSON.stringify(a)})`)
    return n
  }

  /** How many things one effect may make at once (a guard: the most the content makes is a few). */
  private most(n: number, what: string): number {
    const most = this.eng.world.onto.data.params?.spawnMax ?? SPAWN_MAX
    if (n > most) throw new Error(`${what} of ${n}: more than ${most} at once`)
    return n
  }

  private text(ev: GameEvent, who: Entity | undefined, t: Text): Text {
    // a companion repeats the latest beat's line (companion.ts)
    if (t === '@hint') return this.eng.story.hint() ?? { en: '…', zh: '……' }
    // what the story asks for now (the companion's guide)
    if (t === '@objective') return this.eng.story.objective() ?? { en: 'Nothing presses now. Go where you like!', zh: '现在没什么急事。想去哪就去哪吧！' }
    // a guide: what the story asks for now, else the latest beat's line
    if (t === '@guide') return this.eng.story.objective() ?? this.eng.story.hint() ?? { en: 'Nothing presses now. Go where you like!', zh: '现在没什么急事。想去哪就去哪吧！' }
    if (t === '@line') {
      const lines = who?.npc?.lines
      if (lines?.length) return lines[Math.floor(this.eng.world.rand() * lines.length)]
      const own = who && this.eng.world.prop(who, 'text')
      // a written thing in both languages: its `text` and its `text_zh`
      const zh = who && this.eng.world.prop(who, 'text_zh')
      if (typeof own === 'string') return typeof zh === 'string' ? { en: own, zh } : own
      return { en: '…', zh: '……' }
    }
    if (typeof t === 'string' && t.includes('{')) return this.fill(ev, t)
    if (typeof t === 'object') return { en: this.fill(ev, t.en), zh: t.zh ? this.fill(ev, t.zh, 'zh') : undefined }
    return t
  }

  /** Role names as they were when the outcome started (set by run). */
  private names?: Map<string, string>

  /**
   * Fill {host} {actor} {target} {instrument} {other} {item} {source} with display names,
   * {role.key} with a prop and {param.key} with an event parameter. Names are the ones the roles
   * had when the outcome started: "you pour out {instrument}" reads right after it was emptied.
   */
  private fill(ev: GameEvent, s: string, locale: 'en' | 'zh' = 'en'): string {
    const filled = s.replace(/\{(host|actor|target|instrument|other|item|source|param)(?:\.(\w+))?\}/g, (_, role: RoleName | 'param', key?: string) => {
      if (role === 'param') return key && ev.params?.[key] !== undefined ? String(ev.params[key]) : '?'
      if (!key) {
        const name = this.names?.get(`${role}:${locale}`) ?? this.eng.nameOf(this.roleRef(ev, role), locale)
        // the one at the keys is "you": marked, so what follows agrees with it (agreeYou)
        return locale === 'en' && name === 'you' ? YOU : name
      }
      const v = this.eng.world.view(this.roleRef(ev, role))?.props[key]
      return v === undefined ? '?' : String(v)
    })
    return agreeYou(filled)
  }

  /** Run an outcome's effects on its event (the rule id names it in warnings). */
  run(effects: Effect[], ev: GameEvent, ruleId = '?'): void {
    const outer = this.names
    if (effects.some((e) => e.op === 'log' || e.op === 'say')) {
      this.names = new Map()
      for (const role of ['host', 'actor', 'target', 'instrument', 'other', 'item', 'source'] as RoleName[]) {
        const r = this.roleRef(ev, role)
        if (r) for (const l of ['en', 'zh'] as const) this.names.set(`${role}:${l}`, this.eng.nameOf(r, l))
      }
    }
    try {
      for (const eff of effects) {
        try {
          this.apply(eff, ev)
        } catch (err) {
          // a write outside an outcome or beyond its host is the engine's bug, not the rule's: it is not swallowed
          if (err instanceof WriteError) throw err
          this.eng.world.fx.push({ t: 'log', text: `rule ${ruleId}: ${(err as Error).message}`, tone: 'dev' })
          // a learned rule's outcome stops at its first refused effect, and the rule is charged for it;
          // a base rule refused what a learned rule sent it (a push to nowhere): the sender is charged
          if (this.eng.fault(ruleId, (err as Error).message)) return
          this.eng.fault(ev.by, (err as Error).message)
        }
      }
    } finally {
      this.names = outer
    }
  }

  apply(eff: Effect, ev: GameEvent): void {
    const eng = this.eng
    const w = eng.world
    const host = this.hostEntity(ev)
    if (RESIDENT_ONLY.has(eff.op) && (!host || !w.isPlaceless(host))) throw new Error(`${eff.op} is the story's and the world's only`)
    if (QUEST_ONLY.has(eff.op) && host?.type !== 'resident/quest') throw new Error(`${eff.op} is a quest's only`)
    switch (eff.op) {
      case 'spawn': {
        const type = this.typeOf(ev, eff.type)
        if (!type) return
        const at = this.ref(ev, eff.at)
        const into = eff.into ?? 'tile'
        const n = this.most(eff.count === undefined ? 1 : Math.max(0, Math.floor(this.amount(ev, eff.count))), 'a spawn')
        // what cannot be carried is not made into a hand or a bag: it is set down where its holder is
        const carried = into === 'tile' || w.onto.resolve(type).tags.includes('portable') ? into : 'tile'
        for (let i = 0; i < n; i++) {
          let place = this.placeFor(at, carried)
          if (!place) continue
          const made = w.create(type, place)
          // an actor never appears on top of another, or in a wall: it takes the nearest free tile
          if (place.on === 'tile' && w.isAgent(made) && !w.walkable(place.map, place.x, place.y, made.id)) {
            const free = eng.nearestFree({ map: place.map, x: place.x, y: place.y })
            if (free) w.place(made, (place = { on: 'tile', map: free.map, x: free.x, y: free.y }))
          }
          // a creature a rule brings (a dragon's whelps) comes with the behaviour its type names, at home where it appears
          if (place.on === 'tile' && w.isAgent(made) && w.hasTag(made, 'creature') && !made.ai) {
            const behaviour = (w.prop(made, 'behaviour') as AiData['behaviour'] | undefined) ?? 'melee'
            const temper = (w.prop(made, 'temper') as AiData['temper'] | undefined) ?? 'aggressive'
            made.facing = 'down'
            made.ai = { behaviour, temper, sight: w.num(made, 'sight', 6), home: { map: place.map, x: place.x, y: place.y } }
          }
          eng.touch({ e: made.id })
          // an item a rule drops on the ground pops out for the player's magnet (unless it lies still: taken with F)
          if (place.on === 'tile' && w.isPortable(made) && !eff.still) made.dropped = true
        }
        return
      }
      case 'destroy': {
        if (!host) return
        // the essential (people, the player) are never removed: they go down and come to
        if (w.hasTag(host, 'essential')) return
        eng.touch({ e: host.id }, true)
        w.destroy(host)
        return
      }
      case 'transform': {
        if (!host) return
        // `@prop:key` reads the target type from the host's own prop (e.g. emptyType)
        const into = eff.into.startsWith('@prop:') ? String(w.prop(host, eff.into.slice(6)) ?? '') : eff.into
        if (!into || !w.onto.hasType(into)) return
        // what cannot be lost (a person the story needs, the one at the keys) may change, into
        // anything that can still act, and stays essential as what it becomes (a hen, a frog)
        const essential = w.hasTag(host, 'essential')
        if (essential && !w.onto.resolve(into).tags.includes('agent')) throw new Error(`${host.id} cannot become a thing that cannot act (${into})`)
        // to become a thing that cannot be carried, it leaves the hand or the bag it is in for its holder's feet first
        // (and stays as it is where there is no room there)
        if (host.place.on !== 'tile' && !w.onto.resolve(into).tags.includes('portable')) {
          const down = this.placeFor({ e: host.id }, 'tile', host.id)
          if (!down) return
          w.place(host, down)
        }
        // becoming a thing that takes a space of its cell another holds, it gives way: it is gone (rock
        // turning to gravel where there is a floor already), as one destroyed
        const p = host.place.on === 'tile' ? host.place : undefined
        const taken = p && w.spacesOf({ ...host, type: into }).some((s) => w.entitiesAt(p.map, p.x, p.y, p.z ?? 0).some((o) => o.id !== host.id && w.spacesOf(o).includes(s)))
        if (taken) {
          if (w.hasTag(host, 'essential')) return
          eng.touch({ e: host.id }, true)
          w.destroy(host)
          return
        }
        const at = ev.kind === 'time/timer' && typeof ev.params?.at === 'number' ? ev.params.at : w.state.tick
        w.transform(host, into, at)
        if (essential && !w.hasTag(host, 'essential')) w.addTag(host, 'essential')
        // become a thing that turns (stakes, a fence) where it lies, it faces the way the one who made
        // it faced, as one set down does (its front toward them); one that turned already keeps its way
        const maker = ev.cause ? w.get(ev.cause) : undefined
        if (p && !host.facing && w.hasTag(host, 'turns') && maker?.facing) host.facing = maker.facing
        // its name was its old form's: what it is made of and how well stay in the new one's (a master
        // bucket filled is a master bucket of water); a name that said neither goes
        const quality = (w.onto.data.qualities ?? []).find((q) => q.tag && w.hasTag(host, q.tag))
        const material = (host.tags ?? []).find((t) => t.startsWith('material:'))?.slice('material:'.length)
        const renamed = madeOf(w.onto.data, w.onto, into, material, quality?.id).name
        if (renamed) host.name = renamed
        else delete host.name
        // a thing become another is whole as what it is now (a felled tree's stump, a regrown tree)
        if (host.props?.hp !== undefined && w.onto.resolve(into).props.maxHp !== undefined) w.setProp(host, 'hp', undefined)
        eng.touch({ e: host.id })
        return
      }
      case 'move': {
        if (!host) return
        // a floor above the ground that something rests on stays (a wall on it, a bed, someone
        // standing): what is on it is taken first (docs/building.md R5)
        if (w.bears(host)) return
        const place = this.placeFor(this.ref(ev, eff.to), eff.into ?? 'tile', host.id)
        if (!place) return
        // a thing moved by one who is not its owner keeps whose it was: taken, it is still theirs (docs/npc-sandbox.md §2.1)
        const was = eng.social.ownerOf(host)
        const mover = w.get(ev.roles.actor?.e ?? ev.cause)
        if (was && w.prop(host, 'owner') === undefined && mover && eng.social.relation(was, mover) === 'another') w.setProp(host, 'owner', was)
        eng.touch({ e: host.id })
        w.place(host, place)
        delete host.dropped
        // a thing that turns (stairs, a fence) set down faces the way the one who set it faced: its
        // front toward them (stairs go up away from them; a fence runs across their way)
        const setter = ev.cause ? w.get(ev.cause) : undefined
        if (place.on === 'tile' && w.hasTag(host, 'turns') && setter?.facing) host.facing = setter.facing
        eng.touch({ e: host.id })
        return
      }
      case 'step': {
        if (!host) return
        // a step to a place (a scene's direction, a person arriving through a portal), or one tile
        const p = ev.params
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return eng.placeSelf(host, { map: String(p.map ?? w.posOf(host)?.map ?? eng.activeMap), x: p.x, y: p.y })
        // to a map with no place named: in through what sent it (a site, world-model.md §5.6)
        if (typeof p?.map === 'string') return eng.enterFrom(host, p.map, ev.roles.source && w.get(ev.roles.source.e))
        let dir = eff.dir ?? (p?.dir as Entity['facing'])
        // away from a role (a gust from the one who cast it)
        const from = eff.away && this.pos(ev, eff.away)
        const at = w.posOf(host)
        if (from && at) {
          const dx = at.x - from.x
          const dy = at.y - from.y
          dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
        }
        if (dir) for (let i = 0; i < (eff.tiles ?? 1); i++) if (!eng.stepSelf(host, dir, ev)) break
        return
      }
      case 'ashore': {
        const p = w.posOf(host)
        if (!host || !p || host.place.on !== 'tile') return
        const free = eng.nearestFree(p)
        if (!free) return
        eng.touch({ e: host.id })
        w.place(host, { on: 'tile', ...free })
        eng.touch({ e: host.id })
        return
      }
      case 'addStatus': {
        // who gave it: the act's doer, or whoever started the chain (a fire one set burns in their name)
        const by = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : ev.cause
        return eng.applyStatus(ev.host, eff.status, eff.duration, by)
      }
      case 'removeStatus':
        return eng.removeStatus(ev.host, eff.status)
      case 'setProp': {
        if (!host) return
        const v = typeof eff.value === 'object' && eff.value !== null ? ev.params?.[eff.value.param] : eff.value
        if (v !== undefined) eng.setProp(host, eff.key, v, ev)
        return
      }
      case 'addProp': {
        if (!host) return
        let v = w.num(host, eff.key) + this.amount(ev, eff.delta)
        if (eff.min !== undefined) v = Math.max(eff.min, v)
        if (eff.max !== undefined) v = Math.min(this.amount(ev, eff.max), v)
        eng.setProp(host, eff.key, v, ev)
        return
      }
      case 'addTag':
        if (host) w.addTag(host, eff.tag)
        return
      case 'removeTag':
        if (host) w.removeTag(host, eff.tag)
        return
      case 'hurt': {
        // harm done in answer to an element is that element's (what resists it takes a share away)
        const element = eff.element ?? (ev.kind === 'impulse/element' && typeof ev.params?.element === 'string' ? ev.params.element : undefined)
        if (host) eng.hurt(host, this.amount(ev, eff.amount), element, eff.pierce, ev, eff.blow)
        return
      }
      case 'wear': {
        // one's own thing put on, or one held out to one (it comes to one as one takes it): worn in its slot
        // (what was there comes off), or taken off when it is on
        const item = ev.roles.item && 'e' in ev.roles.item ? w.get(ev.roles.item.e) : undefined
        const own = !!item && (item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === host?.id
        if (!host || !item || (!own && ev.kind !== 'impulse/offered')) return
        const slot = w.prop(item, 'slot')
        if (typeof slot !== 'string') return
        // a slot of a kind there are more of (two rings): the one it is in, else the first free, else the first
        const keys = w.wearKeys(slot)
        const worn = keys.find((k) => w.prop(host, k) === item.id)
        const key = worn ?? keys.find((k) => { const id = w.prop(host, k); const it = typeof id === 'string' ? w.get(id) : undefined; return !it || !((it.place.on === 'inside' || it.place.on === 'hand') && it.place.holder === host.id) }) ?? keys[0]
        const on = !!worn
        // a profession's piece (the warrior's shield) goes on only for its own (profession.ts)
        if (!on && !canWield(w, host, item)) {
          const need = itemProfession(w, item)!
          const name = w.onto.data.professions?.[need]?.name
          const n = (l: 'en' | 'zh') => (typeof name === 'string' ? name : name ? (l === 'zh' ? name.zh ?? name.en : name.en) : need)
          w.fx.push({ t: 'log', text: { en: `Only a${/^[aeiou]/i.test(n('en')) ? 'n' : ''} ${n('en')} can wear ${eng.nameOf({ e: item.id }, 'en')}.`, zh: `只有${n('zh')}能装备${eng.nameOf({ e: item.id }, 'zh')}。` }, tone: 'warn' })
          return
        }
        if (on) w.setProp(host, key, undefined)
        else eng.setProp(host, key, item.id, ev)
        // a weapon is taken up and put away, not put on
        const weapon = w.hasTag(item, 'weapon')
        const nm = (l: 'en' | 'zh') => eng.nameOf({ e: item.id }, l)
        if (host.id === w.state.player) w.fx.push({ t: 'log', text: on ? (weapon ? { en: `You put ${nm('en')} away.`, zh: `你收起了${nm('zh')}。` } : { en: `You take off ${nm('en')}.`, zh: `你脱下了${nm('zh')}。` }) : weapon ? { en: `You take up ${nm('en')}.`, zh: `你装备了${nm('zh')}。` } : { en: `You put on ${nm('en')}.`, zh: `你穿上了${nm('zh')}。` } })
        return
      }
      case 'sleep': {
        // until it is time to rise; what a night gives back: as much as the best room it lies in says (a bedroom all)
        if (!host) return
        const params = w.onto.data.params
        const at = w.posOf(host)
        const rest = Math.max(params?.rest ?? 0.5, ...(at ? w.regionsAt(at.map, at.x, at.y, at.z).map((r) => w.num(r, 'rest', 0)) : []))
        const missing = w.num(host, 'maxHp', 1) - w.num(host, 'hp', w.num(host, 'maxHp', 1))
        if (missing > 0) eng.setProp(host, 'hp', w.num(host, 'hp') + Math.ceil(missing * Math.min(1, rest)), ev)
        if (host.id === w.state.player) w.fx.push({ t: 'log', text: rest >= 1 ? { en: 'You sleep soundly, and wake rested.', zh: '你睡得很沉，醒来精神饱满。' } : { en: 'You sleep, after a fashion.', zh: '你勉强睡了一觉。' } })
        // the one at the keys sleeps the night through (the clock runs at once), asleep all the while:
        // lying still, and growing hungry slower (the hunger period's pace, data)
        if (host.id === w.state.player) w.setStatus({ e: host.id }, 'asleep', w.state.tick + eng.sleepUntil(params?.riseHour ?? 6))
        return
      }
      case 'fall': {
        // nothing under it on its storey: it drops to the first floor below, struck by the drop
        if (!host || host.place.on !== 'tile' || !host.place.z || w.occupant(host.place.map, host.place.x, host.place.y, 'floor', host.place.z)) return
        if (w.stanceOf(host) === 'air') return
        const { map, x, y } = host.place
        let z = host.place.z - 1
        while (z > 0 && !w.occupant(map, x, y, 'floor', z)) z--
        const from = host.place.z
        eng.touch({ e: host.id })
        // the cell it lands in may be taken (a hen under the floor, a boulder): it comes down beside it
        let to = { map, x, y, z }
        if (w.clashesAt(map, x, y, z, w.spacesOf(host), host.id).length) to = { ...to, ...eng.nearestFree(to, host) }
        w.place(host, { on: 'tile', ...to })
        eng.touch({ e: host.id })
        eng.fallBy(host, from - to.z, ev)
        return
      }
      case 'breakdown': {
        if (!host) return
        if (w.hasTag(host, 'essential')) return
        const at = w.posOf(host)
        const rate = w.onto.data.params?.recovery ?? 1
        const material = [...(host.tags ?? []), ...w.onto.resolve(host.type).tags].find((t) => t.startsWith('material:'))
        // what it leaves keeps its storey only where a floor other than itself is there to hold it (a
        // floor that broke leaves nothing to lie on): else it lands on the first floor below
        let z = at?.z ?? 0
        while (at && z > 0 && !w.entitiesAt(at.map, at.x, at.y, z).some((o) => o.id !== host.id && w.spacesOf(o).includes('floor'))) z--
        if (at)
          for (const [i, part] of (w.onto.resolve(host.type).makeup ?? []).entries()) {
            // the expected count: whole parts, and the fraction by chance
            const expect = (part.count * (part.chance ?? 1) * rate) / Math.max(1, w.onto.resolve(host.type).yields ?? 1)
            const n = this.most(Math.floor(expect) + (w.chance(eff, expect - Math.floor(expect), i) ? 1 : 0), 'a breakdown')
            for (let i = 0; i < n; i++) {
              const made = w.create(part.type, { on: 'tile', map: at.map, x: at.x, y: at.y, ...(z && { z }) }, material && w.onto.resolve(part.type).tags.includes('portable') ? { tags: [material] } : {})
              eng.touch({ e: made.id })
              // it pops out for the magnet, as anything a rule drops (what a body leaves lies still: taken with F)
              if (w.isPortable(made) && !eff.still) made.dropped = true
            }
          }
        // what it held spills where it stood
        for (const id of [...(host.contents ?? []), ...(host.held ? [host.held] : [])]) {
          const c = w.get(id)
          if (!c || !at) continue
          w.place(c, { on: 'tile', map: at.map, x: at.x, y: at.y, ...(z && { z }) })
          eng.touch({ e: c.id })
          if (!eff.still) c.dropped = true
        }
        eng.touch({ e: host.id }, true)
        w.destroy(host)
        return
      }
      case 'heal': {
        if (!host) return
        // whole points: a tenth of a body mends at least one
        const n = Math.ceil(this.amount(ev, eff.amount))
        // harm is a blow (hurt): it passes defence and the line where one goes down; a heal never takes
        if (n < 0) throw new Error(`a heal of ${n}`)
        const before = w.num(host, 'hp')
        eng.setProp(host, 'hp', Math.min(w.num(host, 'maxHp', 1), before + n), ev)
        // what it mended, shown (nothing to show at full health)
        const gained = w.num(host, 'hp') - before
        if (gained > 0) w.fx.push({ t: 'damage', who: host.id, amount: -gained })
        return
      }
      case 'feed': {
        // Hearty Meals (the skill): food fills half as much again
        const max = host ? w.num(host, 'maxHunger') : 0
        if (!host || max <= 0) return
        eng.setProp(host, 'hunger', Math.max(0, Math.min(max, Math.round(w.num(host, 'hunger', max) + this.amount(ev, eff.amount) * (w.hasTag(host, 'skill:hearty-meals') ? 1.5 : 1)))), ev)
        return
      }
      case 'gainXp': {
        // a thing that has a level can learn (any thing with the prop, not only people)
        if (!host || w.prop(host, 'level') === undefined) return
        // what raises its rate (a companion's boon: `xpRate` 1 doubles it)
        const n = Math.round(this.amount(ev, eff.amount) * (1 + Math.max(0, w.stat(host, 'xpRate'))))
        if (n <= 0) return
        const up = gainXp(w, host, n)
        if (host.id !== w.state.player) return
        w.fx.push({ t: 'log', text: { en: `+${n} XP`, zh: `+${n} 经验` }, tone: 'good' })
        if (up) {
          w.fx.push({ t: 'levelup', level: w.num(host, 'level', 1) })
          const p = w.posOf(host)
          if (p) w.fx.push({ t: 'vfx', fx: 'sparkle', map: p.map, x: p.x, y: p.y })
        }
        return
      }
      case 'foe': {
        const by = ev.roles.actor && 'e' in ev.roles.actor ? ev.roles.actor.e : ev.cause
        if (!host || !by || by === host.id || !w.get(by)) return
        // a person struck takes up a fight if it is one who fights (a guard, the smith: `fights`); else it fears the one who struck
        if (!host.ai && host.npc) {
          const at = w.posOf(host)
          if (w.prop(host, 'fights') !== true || !at) return eng.social.frighten(host, by)
          host.ai = { behaviour: 'melee', temper: 'wary', sight: w.num(host, 'sight', 6), home: { map: at.map, x: at.x, y: at.y }, leash: 12 }
          if (!w.hasStatus(ev.host, 'drawn') && w.onto.status('drawn')) eng.applyStatus(ev.host, 'drawn')
        }
        if (!host.ai) return
        const foes = (host.ai.foes ??= [])
        if (!foes.includes(by)) foes.push(by)
        return
      }
      case 'open':
        if (w.hasStatus(ev.host, 'open')) eng.removeStatus(ev.host, 'open')
        else eng.applyStatus(ev.host, 'open')
        return
      case 'dropContents': {
        const p = w.posOf(host)
        if (!host || !p) return
        // what it holds: its bag, and its hand — but what it keeps (what it wears, the weapon in its hand, the tags kept)
        const worn = new Set(eff.keepWorn ? w.worn(host).map((e) => e.id) : [])
        if (eff.keepWorn && host.held && w.hasTag(w.get(host.held)!, 'weapon')) worn.add(host.held)
        const spilled = [...(host.contents ?? []), ...(host.held ? [host.held] : [])]
          .map((id) => w.get(id))
          .filter((c): c is Entity => !!c && !worn.has(c.id) && !(eff.keep ?? []).some((t) => w.hasTag(c, t)))
        // into a role's bag (a bundle opened by whoever opens it), else onto the tile, packed in a bundle when it says so
        const to = eff.to ? this.ref(ev, eff.to) : undefined
        const into = to && 'e' in to ? w.get(to.e) : undefined
        if (eff.to && !into) return
        const pack = !into && eff.bundle && spilled.length ? w.create(eff.bundle, { on: 'tile', map: p.map, x: p.x, y: p.y }) : undefined
        if (pack) eng.touch({ e: pack.id })
        for (const c of spilled) {
          eng.touch({ e: c.id })
          w.place(c, into ? { on: 'inside', holder: into.id } : pack ? { on: 'inside', holder: pack.id } : { on: 'tile', map: p.map, x: p.x, y: p.y })
          eng.touch({ e: c.id })
          if (into || pack) delete c.dropped
          else if (!eff.still) c.dropped = true
        }
        if (into) eng.touch({ e: into.id })
        return
      }
      case 'goto': {
        const p = w.posOf(host)
        const a = p && w.map(p.map)?.anchors?.[eff.anchor]
        if (!host?.npc || !p || !a) return
        const hours = Math.max(0.1, Math.min(12, eff.hours))
        host.npc.override = { map: p.map, x: a[0], y: a[1], until: w.state.tick + Math.round(hours * TICKS_PER_HOUR), activity: eff.activity ?? eff.anchor }
        return
      }
      case 'topic': {
        const id = this.str(ev, eff.id)
        if (id && host) raiseTopic(eng, host, id, eff.days ?? (typeof ev.params?.days === 'number' ? ev.params.days : undefined))
        return
      }
      case 'quest': {
        // the host is spoken to about quests (docs/quests.md §2.4); the one speaking is the act's actor
        const a = ev.roles.actor
        const who = a && 'e' in a ? w.get(a.e) : undefined
        if (!host || !who) return
        const depth = (ev.depth ?? 0) + 1
        const tell = (to: Id, params: Record<string, PropValue>, kind: GameEvent['kind'] = 'impulse/notify') => eng.queue({ kind, host: { e: to }, roles: { actor: { e: who.id }, source: ev.host }, params, cause: ev.cause, origin: ev.origin, depth })
        const ref = typeof ev.params?.quest === 'string' && ev.params.quest ? ev.params.quest : undefined
        const topic = typeof ev.params?.topic === 'string' ? ev.params.topic : undefined
        if (ev.params?.say === 'quest' && ref && topic) {
          const q = w.get(ref)
          const d = q ? eng.quests.defOf(q) : eng.quests.def(ref)
          if (topic === 'accept' || topic === 'decline') {
            // an offer taken on or turned down: a radiant one is the quest's to answer, an authored one the story begins
            if (topic === 'accept') q ? tell(q.id, { what: 'accept' }) : d && tell('story', { what: 'accept', quest: d.id })
            else if (q) tell(q.id, { what: 'decline' })
            const line = topic === 'accept' ? d?.accepted : d?.declined
            if (line && host.npc) this.apply({ op: 'say', text: q ? eng.quests.fill(q, line) : line }, ev)
            return
          }
          // a topic of the quest's, told to it (it says what it says)
          if (q) eng.queue({ kind: 'seen', host: { e: q.id }, roles: { actor: { e: who.id }, target: { e: host.id } }, params: { news: 'talk', by: who.id, of: host.id, topic }, cause: ev.cause, origin: 'world', depth })
          return
        }
        const b = eng.quests.business(host.id, who)
        if (b.quest) eng.queue({ kind: 'seen', host: { e: b.quest.id }, roles: { actor: { e: who.id }, target: { e: host.id } }, params: { news: 'talk', by: who.id, of: host.id }, cause: ev.cause, origin: 'world', depth })
        else if (host.npc) {
          const offer = b.offers[0] && eng.quests.offerLine(b.offers[0].ref)
          this.apply({ op: 'say', text: offer ?? b.waiting ?? '@line' }, ev)
        }
        // business talked over is a meeting too: their first-meeting line is not kept for after it
        if ((b.quest || b.offers.length || b.waiting) && host.npc) { const mem = memoryOf(host); mem.talked ??= w.calendar().day }
        return
      }
      case 'advance':
        eng.quests.advance(ev)
        return
      case 'stage':
        eng.quests.setStage(ev, Math.floor(this.amount(ev, eff.n)))
        return
      case 'accept':
        eng.quests.accept(ev)
        return
      case 'decline':
        eng.quests.decline(ev)
        return
      case 'failQuest':
        eng.quests.fail(ev)
        return
      case 'begin':
        eng.quests.begin(ev)
        return
      case 'startQuest': {
        const d = eng.quests.def(eff.id ?? String(ev.params?.quest ?? ''))
        const a = ev.roles.actor
        if (d) eng.quests.start(d, ev, { taker: a && 'e' in a ? a.e : w.state.player, offer: eff.offer, ...(ev.roles.source && 'e' in ev.roles.source && { giver: ev.roles.source.e }) })
        return
      }
      case 'facts':
        if (!host) return
        for (const [k, v] of Object.entries(ev.params ?? {})) if (k.startsWith('fact.')) w.setProp(host, k.slice(5), v)
        return
      case 'news': {
        const r = (role: keyof GameEvent['roles']) => { const x = ev.roles[role]; return x && 'e' in x ? x.e : undefined }
        if (eff.kind === 'give') eng.quests.news({ kind: 'give', actor: r('actor'), target: host?.id, item: r('item') })
        else eng.quests.news({ kind: eff.kind, actor: r('actor'), target: host?.id, item: r('item') })
        return
      }
      case 'learn': {
        // the host's own: its tags, props and points; a profession's starter weapon is made in its bag
        if (!host) return
        const skill = eng.skills.get(String(ev.params?.skill ?? ''))
        // from a book in one's hands (the event's item): read, it is learned and the book is used up; else it says why
        if (eff.book) {
          const book = ev.roles.item && 'e' in ev.roles.item ? w.get(ev.roles.item.e) : undefined
          if (!skill || !book) return
          const why = cannotRead(host, skill, w.prop(host, 'profession'))
          const name = (l: 'en' | 'zh') => (typeof skill.name === 'string' ? skill.name : l === 'zh' ? skill.name.zh ?? skill.name.en : skill.name.en)
          if (why) {
            w.fx.push({ t: 'log', text: why === 'learned' ? { en: `You know ${name('en')} already.`, zh: `你已经会${name('zh')}了。` } : { en: 'This book is for another profession.', zh: '这本书是别的职业的。' }, tone: 'warn' })
            return
          }
          readSkill(w, host, skill)
          w.fx.push({ t: 'log', text: { en: `You read the book and learn ${name('en')}.`, zh: `你读完了技能书，学会了${name('zh')}。` }, tone: 'good' })
          if ((book.place.on === 'inside' || book.place.on === 'hand') && book.place.holder === host.id) (eng.touch({ e: book.id }), w.destroy(book))
          return
        }
        if (skill) {
          learnSkill(w, host, skill)
          return
        }
        const prof = eng.professions.get(String(ev.params?.profession ?? ''))
        if (!prof || cannotChoose(w, host, prof)) return
        const before = new Set(host.contents ?? [])
        chooseProfession(w, host, prof, [...eng.skills.values()])
        for (const id of host.contents ?? []) if (!before.has(id)) eng.touch({ e: id })
        return
      }
      case 'appear':
        appear(eng, eff.what)
        return
      case 'release':
        if (host) releaseSkill(eng, host, ev)
        return
      case 'pocket': {
        // the host's own: where it stands, kept on itself; then it goes (its companions follow as they do)
        if (!host) return
        const map = String(ev.params?.map ?? '')
        const at = w.posOf(host)
        if (!map || !at) return
        const back = w.prop(host, 'pocket.return')
        if (at.map === map) {
          const [m, x, y] = typeof back === 'string' ? back.split(',') : []
          if (!m) return
          w.setProp(host, 'pocket.return', undefined)
          eng.travel(host, { map: m, x: Number(x), y: Number(y) })
        } else {
          w.setProp(host, 'pocket.return', `${at.map},${at.x},${at.y}`)
          eng.travel(host, { map, x: Number(ev.params?.x ?? 0), y: Number(ev.params?.y ?? 0) })
        }
        return
      }
      case 'boon': {
        // a companion's boon (boons.ts): given by the story (param unlock), or chosen (param boon)
        // while its leader stands beside an attuned waypoint; it carries one at a time
        if (!host) return
        const give = ev.params?.unlock
        const pick = ev.params?.boon
        const carry = (id: string) => {
          for (const s of Object.keys(host.statuses ?? {})) if (s.startsWith(BOON_PREFIX) && s !== BOON_PREFIX + id) eng.removeStatus({ e: host.id }, s)
          if (!w.hasStatus({ e: host.id }, BOON_PREFIX + id)) eng.applyStatus({ e: host.id }, BOON_PREFIX + id)
        }
        const name = (id: string) => w.onto.status(BOON_PREFIX + id)?.name
        const said = (t: Text | undefined, l: 'en' | 'zh') => (typeof t === 'string' ? t : t ? (l === 'zh' ? t.zh ?? t.en : t.en) : '')
        if (typeof give === 'string' && give) {
          const had = boonsOf(w, host)
          if (had.includes(give)) return
          eng.setProp(host, 'boons', [...had, give].join(','), ev)
          if (!activeBoon(host)) carry(give)
          w.fx.push({ t: 'log', text: { en: `${eng.nameOf({ e: host.id }, 'en')} takes up a new power: ${said(name(give), 'en')}.`, zh: `${eng.nameOf({ e: host.id }, 'zh')}获得了新的力量：${said(name(give), 'zh')}。` }, tone: 'good' })
          return
        }
        if (typeof pick !== 'string' || !boonsOf(w, host).includes(pick) || activeBoon(host) === pick) return
        const leader = leaderOf(w, host)
        if (!leader || !nearAttunedWaypoint(w, leader)) {
          w.fx.push({ t: 'log', text: { en: 'A power can be changed only beside a woken waypoint statue.', zh: '只有在唤醒过的传送雕像旁才能切换力量。' }, tone: 'warn' })
          return
        }
        carry(pick)
        w.fx.push({ t: 'log', text: { en: `${eng.nameOf({ e: host.id }, 'en')} now carries ${said(name(pick), 'en')}.`, zh: `${eng.nameOf({ e: host.id }, 'zh')}现在携带着${said(name(pick), 'zh')}。` }, tone: 'good' })
        return
      }
      case 'panel': {
        // a panel is the player's: only when the player is the one who spoke
        const a = ev.roles.actor
        if (host && a && 'e' in a && a.e === w.state.player) w.fx.push({ t: 'panel', panel: eff.panel, by: host.id })
        return
      }
      case 'scene':
        eng.story.start(eff.id)
        return
      case 'fallback': {
        const inv = eng.invariants.find((i) => i.id === ev.params?.invariant)
        if (inv?.fallback?.length) this.run(inv.fallback, ev, `invariant/${inv.id}`)
        return
      }
      case 'craft': {
        const r = eng.recipes.get(String(ev.params?.recipe ?? ''))
        if (!host || !r) return
        if (!r.needs.every((n) => Number.isSafeInteger(n.count) && n.count > 0)) return
        const carried = [...(host.contents ?? []), ...(host.held ? [host.held] : [])].map((id) => w.get(id)!).filter(Boolean)
        if (!r.needs.every((n) => carried.filter((e) => e.type === n.type && !e.frozenBy).length >= n.count)) return
        // the tools it needs, carried (not used up)
        if (!(r.tools ?? []).every((tag) => carried.some((e) => !e.frozenBy && w.hasTag(e, tag)))) {
          w.fx.push({ t: 'log', text: { en: 'You need the right tool for that.', zh: '缺少需要的工具。' } })
          return
        }
        // a station's recipe is made beside one (a workbench within reach); the hands' anywhere
        if (r.station && r.station !== 'hands') {
          if (!w.stationsNear(host).has(r.station)) {
            // named as the world names it: the first kind of thing that is such a station (a stall's: "trading stall")
            const named = Object.values(w.onto.data.types).find((t) => t.tags?.includes(`station:${r.station}`))?.name
            const en = (typeof named === 'string' ? named : named?.en) ?? r.station
            const zh = (typeof named === 'object' && named.zh) || (r.station === 'workbench' ? '工作台' : en)
            w.fx.push({ t: 'log', text: { en: `That is made at a ${en}.`, zh: `这要在${zh}旁边做。` } })
            return
          }
        }
        // the main ingredient (the first) gives what is made its material
        let material: string | undefined
        for (const [i, n] of r.needs.entries()) {
          // the bag's first: the hand keeps what it holds while there are others of its kind
          const pool = carried.filter((e) => e.type === n.type && !e.frozenBy).sort((a, b) => Number(a.id === host.held) - Number(b.id === host.held))
          for (const e of pool.slice(0, n.count)) {
            if (i === 0) material ??= w.materialOf(e)?.id
            eng.touch({ e: e.id }, true)
            w.destroy(e)
          }
        }
        const quality = qualityFor(w.onto.data, w.num(host, 'level', 1), r.level ?? 1)
        const look = r.make.tags || r.make.name ? r.make : madeOf(w.onto.data, w.onto, r.make.type, material, quality)
        let made = w.create(r.make.type, { on: 'inside', holder: host.id }, structuredClone(look))
        eng.touch({ e: made.id })
        for (let i = 1; i < (r.count ?? 1); i++) (made = w.create(r.make.type, { on: 'inside', holder: host.id }, structuredClone(look))), eng.touch({ e: made.id })
        const p = w.posOf(host)
        if (p) w.fx.push({ t: 'pickup', item: made.id, sprite: r.sprite, name: r.name, map: p.map, x: p.x, y: p.y })
        return
      }
      case 'grow': {
        // a stage's clock ran out (world-model.md §6.5): it becomes the next, leaving what the stage yields
        if (!host) return
        const st = w.onto.resolve(host.type).stage
        const clock = st?.clock ?? 'stage'
        if (!st || ev.params?.status !== clock) return
        const at = typeof ev.params?.at === 'number' ? ev.params.at : w.state.tick
        if (st.needs && !evalCond(st.needs, rolesOf(ev, w), w, ev)) {
          // not yet (no light, someone standing on it): it waits, and looks again
          w.setStatus({ e: host.id }, clock, at + (st.wait ?? st.lasts ?? TICKS_PER_HOUR))
          return
        }
        for (const y of st.yields ?? []) this.apply({ op: 'spawn', type: y.type, at: 'tileOf:host', count: y.count ?? 1, still: true }, ev)
        if (st.fx) this.apply({ op: 'vfx', fx: st.fx, at: 'tileOf:host' }, ev)
        if (st.into) this.apply({ op: 'transform', into: st.into }, ev)
        // a stage with nothing next begins again (a hen lays, and lays again)
        else if (st.lasts) w.setStatus({ e: host.id }, clock, at + st.lasts)
        return
      }
      case 'lightning':
        eng.lightning(eff.power, ev)
        return
      case 'emit':
        return this.emit(eff, ev)
      case 'vfx': {
        const p = this.pos(ev, eff.at ?? 'host')
        if (p) w.fx.push({ t: 'vfx', fx: eff.fx, map: p.map, x: p.x, y: p.y })
        return
      }
      case 'say': {
        const ref = eff.who && host && w.isPlaceless(host) ? this.roleRef(ev, eff.who) : ev.host
        const who = ref && 'e' in ref ? w.get(ref.e) : undefined
        if (!who) return
        if (eff.text === '@given') {
          const item = ev.roles.item && 'e' in ev.roles.item ? w.get(ev.roles.item.e) : undefined
          const line = who.npc?.person?.lines?.length && item ? chooseLine(eng, who, { given: item, record: who.id === host?.id }) : undefined
          w.fx.push({ t: 'say', who: who.id, text: line?.text ?? GIVEN_LINE, mood: line?.mood })
          return
        }
        // a person with a line book says the line for this moment (people.ts)
        const line = eff.text === '@line' && who.npc?.person?.lines?.length ? chooseLine(eng, who, { record: who.id === host?.id }) : undefined
        if (line) w.fx.push({ t: 'say', who: who.id, text: line.text, mood: line.mood })
        else w.fx.push({ t: 'say', who: who.id, text: this.text(ev, who, eff.text) })
        return
      }
      case 'log':
        // the message line is the one at the keys': what another set going (a villager eating, a guard's blow on a
        // slime) is not written there, unless it befalls them
        if (ev.cause && ev.cause !== w.state.player && host?.id !== w.state.player && w.get(ev.cause) && w.isAgent(w.get(ev.cause)!)) return
        // "@line" reads what the host has written on it (a document read in hand)
        w.fx.push({ t: 'log', text: this.text(ev, eff.text === '@line' ? host : undefined, eff.text) })
        return
      case 'emote':
        if (host) w.fx.push({ t: 'emote', who: host.id, mood: eff.mood })
        return
      case 'restyle':
        if (host && typeof host.look === 'object') w.setLook(host, restyled(host.look, { parts: eff.parts, colors: eff.colors }))
        return
      default:
        return this.social(eff, ev, host)
    }
  }

  // ---------------------------------------------------------------- the people's social life (docs/npc-sandbox.md)

  private social(eff: Effect, ev: GameEvent, host: Entity | undefined): void {
    const eng = this.eng
    const w = eng.world
    const s = eng.social
    const actor = ev.roles.actor ? w.get(ev.roles.actor.e) : undefined
    const role = (r: RoleName | undefined, dflt?: Entity) => (r ? (r === 'host' ? host : w.get(this.roleRef(ev, r)?.e)) : dflt)
    const toPlayer = (who: Entity | undefined) => !!who && who.id === w.state.player
    switch (eff.op) {
      case 'own': {
        if (!host) return
        const to = eff.to ? this.roleRef(ev, eff.to) : undefined
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
      case 'regard': {
        const to = role(eff.toward, actor)
        if (host?.npc && to) s.changeRegard(host, to.id, this.amount(ev, eff.delta))
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
        const n = Math.max(0, Math.round(this.amount(ev, { param: 'amount' })))
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
        if (host) this.giveBack(host, ev.roles.source ? w.get(ev.roles.source.e) : undefined)
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
        if (host && to && to.id !== host.id) this.payCoins(host, to, Math.max(0, Math.floor(this.amount(ev, eff.amount))))
        return
      }
      case 'give': {
        const to = role(eff.to)
        const item = ev.roles.item ? w.get(ev.roles.item.e) : undefined
        if (!host || !to || !item || item.id === host.id || to.id === host.id) return
        if (!((item.place.on === 'inside' || item.place.on === 'hand') && item.place.holder === host.id)) return
        this.handOver(host, item, to)
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
        this.payCoins(host, actor, price)
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
        this.toJail(host, ev, { map: p.map, x: p.x, y: p.y }, typeof p.hours === 'number' ? p.hours : 1)
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
          this.giveBack(host, actor)
          this.toJail(host, ev, s.jailOf(law) ?? w.posOf(actor)!, s.jailHours(bounty))
          return pardon()
        }
        // the one at the keys chooses (the guard's talk opens); anyone else yields
        if (toPlayer(host)) return void w.fx.push({ t: 'talk', who: actor.id, arrest: true })
        this.giveBack(host, actor)
        if (s.purse(host) >= bounty && !s.unpardonable(law, bounty)) this.payCoins(host, actor, bounty)
        else this.toJail(host, ev, s.jailOf(law) ?? w.posOf(actor)!, s.jailHours(bounty))
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
          for (let n = have(type); n < this.most(Math.max(1, Number(count) || 1), 'a restock'); n++) eng.touch({ e: w.create(type, { on: 'inside', holder: host.id }).id })
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
  private payCoins(from: Entity, to: Entity, n: number): number {
    const w = this.eng.world
    const coins = this.eng.social.coins(from).slice(0, n)
    for (const c of coins) {
      w.setProp(c, 'owner', undefined)
      this.eng.touch({ e: c.id })
      w.place(c, { on: 'inside', holder: to.id })
      this.eng.touch({ e: c.id })
    }
    return coins.length
  }

  /** A thing from one's bag to another: theirs now; worn, it comes off first. */
  private handOver(from: Entity, item: Entity, to: Entity): void {
    const w = this.eng.world
    for (const [k, v] of Object.entries(from.props ?? {})) if (k.startsWith('wear:') && v === item.id) w.setProp(from, k, undefined)
    w.setProp(item, 'owner', w.isAgent(to) ? to.id : undefined)
    this.eng.touch({ e: item.id })
    w.place(item, { on: 'inside', holder: to.id })
    delete item.dropped
    this.eng.touch({ e: item.id })
  }

  /** What one carries that is another's goes back, each to its owner (else to `fallback`, the one who takes it). */
  private giveBack(host: Entity, fallback: Entity | undefined): number {
    const eng = this.eng
    const w = eng.world
    const s = eng.social
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
  private toJail(host: Entity, ev: GameEvent, at: Pos, hours: number): void {
    const eng = this.eng
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

  /** Send an impulse to its receivers; each answers for itself (design.md §5.8). */
  private emit(eff: Extract<Effect, { op: 'emit' }>, ev: GameEvent): void {
    const eng = this.eng
    const w = eng.world
    const params: Record<string, PropValue> = {}
    for (const [k, v] of Object.entries(eff.params ?? {})) {
      const x = this.param(ev, v)
      if (x !== undefined) params[k] = x
    }
    const item = eff.item ? this.roleRef(ev, eff.item) : undefined
    const other = eff.other ? this.roleRef(ev, eff.other) : undefined
    for (const to of this.receivers(eff.to, ev)) {
      const v = w.view(to)
      if (!v || (eff.filter && !matchSelector(eff.filter, v))) continue
      if (eff.chance !== undefined && !w.chance(eff, eff.chance)) continue
      eng.queue({
        kind: `impulse/${eff.impulse as Impulse}`,
        host: to,
        roles: {
          source: ev.host,
          actor: ev.roles.actor ?? (ev.cause ? { e: ev.cause } : undefined),
          instrument: ev.roles.instrument,
          item,
          other,
        },
        params,
        cause: ev.cause,
        origin: ev.origin,
        depth: (ev.depth ?? 0) + 1,
      })
    }
  }

  /** An emitted param: a value, an Amount, a param passed on as it is (`{param}` alone: a string goes through), or what kind of thing a role is. */
  param(ev: GameEvent, v: PropValue | Amount | { typeOf: RoleName } | { idOf: RoleName }): PropValue | undefined {
    if (typeof v !== 'object' || v === null) return v
    if ('typeOf' in v) return this.eng.world.view(this.roleRef(ev, v.typeOf))?.type
    // which thing a role is (a bed: the place one sleeps is one's home)
    if ('idOf' in v) return this.roleRef(ev, v.idOf)?.e
    if ('param' in v && v.mul === undefined && v.add === undefined) return ev.params?.[v.param]
    // a role's prop passed on as it is (a word too: a site's map)
    if ('prop' in v && v.mul === undefined && v.add === undefined) return this.eng.world.view(this.roleRef(ev, v.of))?.props[v.prop]
    return this.amount(ev, v)
  }

  /** A string field that may read an event param: `@param:key`. */
  str(ev: GameEvent, s: string): string {
    return s.startsWith('@param:') ? String(ev.params?.[s.slice(7)] ?? '') : s
  }

  /** Who an emission reaches: a role, a resident, a named thing, or a place of the host's map. */
  private receivers(to: EmitTo, ev: GameEvent): Ref[] {
    const eng = this.eng
    const w = eng.world
    if (typeof to === 'string') {
      if (to === 'story' || to === 'world') return w.get(to) ? [{ e: to }] : []
      if (to === 'watch') {
        const law = eng.social.lawHere(this.hostEntity(ev))
        return law && w.get(lawId(law.id)) ? [{ e: lawId(law.id) }] : []
      }
      const r = this.ref(ev, to)
      return r ? [r] : []
    }
    if ('named' in to) return w.get(to.named) ? [{ e: to.named }] : []
    if ('around' in to) {
      const c = w.posOf(this.hostEntity(ev))
      if (!c) return []
      const r = Math.min(12, Math.max(0, to.around))
      return w.entitiesOnMap(c.map).filter((e) => e.id !== ev.host.e && e.place.on === 'tile' && w.isAgent(e) && Math.max(Math.abs(e.place.x - c.x), Math.abs(e.place.y - c.y)) <= r).map((e) => ({ e: e.id }))
    }
    const self = (r: Ref) => r.e === ev.host.e
    // every thing in a cell: what stands there and what makes it up, top first
    const at = (map: string, x: number, y: number): Ref[] => (w.inBounds(map, x, y) ? w.entitiesAt(map, x, y).sort((a, b) => w.cellRank(b) - w.cellRank(a)).map((e) => ({ e: e.id })) : [])
    if ('map' in to) {
      const p = w.posOf(this.hostEntity(ev))
      const map = p?.map ?? eng.activeMap
      // the sky's: only what is out under it (world-model.md §5.3: rain does not fall under a roof)
      const under = (e: Entity) => {
        const at = w.posOf(e)
        return !!at && !w.covered(at.map, at.x, at.y, at.z)
      }
      return w.entitiesOnMap(map).filter((e) => !self({ e: e.id }) && (!to.sky || under(e))).map((e) => ({ e: e.id }))
    }
    if ('area' in to) {
      const c = this.pos(ev, to.area.at ?? 'host')
      if (!c) return []
      const out: Ref[] = []
      const r = Math.min(3, to.area.radius)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && (dx || dy)) out.push(...at(c.map, c.x + dx, c.y + dy))
      return out.filter((x) => !self(x))
    }
    // a line from beyond `from`, away from `away` (a felled tree falls away from the axe)
    const from = this.pos(ev, to.line.from ?? 'host')
    const away = this.pos(ev, to.line.away)
    if (!from || !away || from.map !== away.map) return []
    const dx = Math.sign(from.x - away.x)
    const dy = dx === 0 ? Math.sign(from.y - away.y) : 0
    if (!dx && !dy) return []
    const out: Ref[] = []
    for (let i = 1; i <= Math.min(8, to.line.length); i++) {
      const x = from.x + dx * i
      const y = from.y + dy * i
      if (!w.inBounds(from.map, x, y)) break
      const tags = w.onto.terrain(w.terrainAt(from.map, x, y))?.tags ?? []
      if (to.line.over && !to.line.over.every((t) => tags.includes(t))) break
      out.push(...at(from.map, x, y))
    }
    return out
  }

  /** A type named outright, or read from a role's prop: `@prop:host.yieldType`. */
  private typeOf(ev: GameEvent, type: string): string | undefined {
    const m = /^@prop:(host|actor|target|instrument|other|item|source)\.(\w+)$/.exec(type)
    if (!m) return type
    const v = this.eng.world.view(this.roleRef(ev, m[1] as RoleName))?.props[m[2]]
    return typeof v === 'string' && this.eng.world.onto.hasType(v) ? v : undefined
  }

  /** Where `into` lands relative to a role: its tile, its contents, or its hand. */
  private placeFor(at: Ref | undefined, into: 'tile' | 'contents' | 'hand', moving?: string): Place | undefined {
    const w = this.eng.world
    if (!at) return undefined
    const holder = w.get(at.e)
    if (!holder) return undefined
    // onto a cell (or what makes one up: it holds nothing): it comes to rest on the lowest storey
    // from there with room for it and something to hold it (building is this, world-model.md §6.6)
    if (into === 'tile' || w.isTerrain(holder)) {
      const p = w.posOf(holder)
      if (!p) return undefined
      const thing = moving ? w.get(moving) : undefined
      const z = thing ? w.settleZ(thing, p.map, p.x, p.y, p.z ?? 0) : (p.z ?? 0)
      if (z === undefined) return undefined
      return { on: 'tile', map: p.map, x: p.x, y: p.y, ...(z && { z }) }
    }
    if (into === 'hand' && (!holder.held || holder.held === moving)) return { on: 'hand', holder: holder.id }
    return { on: 'inside', holder: holder.id }
  }
}

/** A name slot filled with "you" (the one at the keys), marked until what follows it is made to agree. */
const YOU = '\u0001you\u0002'
const SECOND: Record<string, string> = { is: 'are', was: 'were', has: 'have', does: 'do', goes: 'go', aches: 'ache', "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", "doesn't": "don't" }
/** Words that end in s after a name and are no verb ("you always", "you perhaps"). */
const NOT_VERBS = new Set(['always', 'perhaps', 'sometimes', 'towards', 'afterwards', 'besides', 'backwards', 'forwards', 'upwards', 'downwards', 'as', 'yes', 'thus', 'less', 'this', 'his', 'its', 'us'])
/** What opens a clause before "you", so it is the one doing what follows (not "hands you this map"). */
const OPENS = /(^|[.!?;:,\u2014\u2013]\s*|["\u201c\u2018(]\s*|\b(?:and|but|then|so|while|as|when|until|before|after|because|if|or|now)\s+)$/i

/**
 * Lines are written about anyone ("{actor} comes up clean"), and a slot reads "you" when it is the
 * player: where "you" opens a clause the verb after it is made second person ("you come"), "'s" becomes
 * "your" anywhere, and "you" opening a sentence is capitalised. Only a marked "you" is touched (English).
 */
export function agreeYou(s: string): string {
  if (!s.includes(YOU)) return s
  const verb = (w: string): string => {
    const l = w.toLowerCase().replace('\u2019', "'")
    const curly = w.includes('\u2019')
    if (SECOND[l]) {
      const to = curly ? SECOND[l].replace("'", '\u2019') : SECOND[l]
      return w[0] === w[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to
    }
    if (NOT_VERBS.has(l) || !l.endsWith('s') || l.endsWith('ss') || l.endsWith('us') || l.length < 3) return w
    // dies, lies (die, lie) but carries, tries (carry, try)
    if (l.endsWith('ies')) return l.length <= 4 ? w.slice(0, -1) : w.slice(0, -3) + 'y'
    // washes, watches, fixes, buzzes, echoes (wash, watch, fix, buzz, echo); freezes, rises, tiptoes (freeze, rise, tiptoe)
    if (/(sh|ch|x|zz|ss|echo|veto|torpedo|embargo)es$/.test(l)) return w.slice(0, -2)
    return w.slice(0, -1)
  }
  let out = s.replace(new RegExp(`${YOU}['\u2019]s\\b`, 'g'), '\u0001your\u0002')
  out = out.replace(new RegExp(`${YOU} ([A-Za-z]+(?:['\u2019]t)?)`, 'g'), (m, w: string, at: number) => (OPENS.test(out.slice(0, at).replace(/[\u0001\u0002]/g, '')) ? `${YOU} ${verb(w)}` : m))
  return out
    .replace(/(^|[.!?]\s+|^["\u201c\u2018]|[.!?]\s+["\u201c\u2018])\u0001(you|your)\u0002/g, (_, pre: string, w: string) => `${pre}${w[0].toUpperCase()}${w.slice(1)}`)
    .replace(/[\u0001\u0002]/g, '')
}

