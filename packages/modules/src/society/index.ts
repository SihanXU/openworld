// The society module (docs/npc-sandbox.md): the people as playable as The Elder Scrolls' — whose things are,
// deeds and witnesses, recognition, memory and regard, gossip, the watch and bounties, arrest, death and bodies,
// talk, trade, pockets, followers, needs. It fills the kernel's society slot, brings its primitives, conditions
// and goals (social, need, and following for people), and keeps the watches as residents.

import { registerModule, type EngineModule, type Entity } from '@openworld/engine'
import { Conduct } from './conduct.ts'
import { SOCIAL_CONDS } from './conds.ts'
import { socialEffect } from './effects.ts'
import { Social, lawId } from './social.ts'
import { conductOf } from './state.ts'

export * from './conduct.ts'
export * from './social.ts'
export * from './state.ts'
export * from './views.ts'

export const societyModule: EngineModule = {
  id: 'society',
  effects: {
    own: socialEffect,
    witness: socialEffect,
    tell: socialEffect,
    hear: socialEffect,
    regard: socialEffect,
    settle: socialEffect,
    fear: socialEffect,
    report: socialEffect,
    charge: socialEffect,
    surrender: socialEffect,
    die: socialEffect,
    pay: socialEffect,
    give: socialEffect,
    sell: socialEffect,
    moveIn: socialEffect,
    conscience: socialEffect,
    moral: socialEffect,
    buy: socialEffect,
    follow: socialEffect,
    talk: socialEffect,
    fine: socialEffect,
    imprison: socialEffect,
    jail: socialEffect,
    arrest: socialEffect,
    restock: socialEffect,
    calm: socialEffect,
  },
  conds: SOCIAL_CONDS,
  goals: {
    // a person afraid keeps away, one who keeps the watch stops the wanted, an owner asks back what was taken
    social: { paced: true, urgent: true, run: (eng, e, sc) => conductOf(eng).social(e, sc) },
    // a person who follows someone walks after them
    follow: { paced: false, run: (eng, e, sc) => conductOf(eng).follow(e, sc) },
    // a hungry person eats, buys a meal, or takes one
    need: { paced: true, run: (eng, e, sc) => conductOf(eng).need(e, sc) },
  },
  spec: {
    primitives: {
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
      conscience: 'conscience {} — the host saw its own deed (a seen event with params own): its karma (−100..100) falls by a quarter of the deed\'s weight, witnessed or not; a blow against one who fought it first is none',
      moral: 'moral {key: karma | faith, delta} — the host\'s karma (good and evil: how fast the good or the wicked warm to it) or faith (how it stands with the Church) moves by delta, within −100..100',
      moveIn: 'moveIn {} — the host, asked by the actor (whom it holds in full regard: residence.at at least), comes to live on the world\'s home ground (social.residence): a free bed there (its fact holds, nobody in it) becomes its home, its days spent there from now on (residence.days, over its schedule), and it goes at once, following nobody; with none free it says so (residence.full); below that regard, or living there already, no change',
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
    },
    conditions: [
      '{regard: {of: role, toward: role, cmp}} — what one person thinks of another (−100..100, its regard: talk, gifts and help raise it, deeds lower it)',
      '{grudge: {of: role, toward: role, deed?}} — one holds an unsettled deed against another (done to them, their household or kin): any, or one kind (theft, assault …)',
      '{owns: [roleA, roleB]} — roleA owns roleB (its own or its household\'s)',
      '{knows: [roleA, roleB]} — roleA knows roleB by sight',
      '{deed: true | id} — the seen event holds a deed (theft, pickpocket, assault, murder, vandalism, arson, trespass)',
      '{sway: {of: role, by: role, how: persuade|intimidate, bonus?}} — a roll of roleB swaying roleA',
      '{bounty: {role, cmp}} — what the role owes the watch of where the host is',
      '{canPay: {role, mul?}} — the role carries coin enough for its bounty here (times mul)',
      '{unpardonable: role} — the role\'s bounty here is past what the watch pardons',
    ],
  },
  install(eng) {
    const w = eng.world
    const social = new Social(eng)
    w.ext.set('society.social', social)
    w.ext.set('society.conduct', new Conduct(eng))
    eng.society = {
      ownerOf: (e) => social.ownerOf(e),
      relation: (owner, to) => social.relation(owner, to),
      isAnothers: (thing, who) => social.isAnothers(thing, who),
      value: (thing) => social.value(thing),
      notices: (seer, doer, facts, d, sight) => social.notices(seer, doer, facts, d, sight),
      victim: (against, seer) => social.victim(against, seer),
      frighten: (e, of) => social.frighten(e, of),
      fightOn: (e, sc) => conductOf(eng).fightOn(e, sc),
      watchOf(e) {
        const law = social.lawHere(e)
        return law ? { e: lawId(law.id) } : undefined
      },
      brief: (e, toward) => ({ regard: social.regard(e, toward), knows: (e.npc?.memory?.deeds ?? []).filter((d) => d.by === toward).slice(-4).map((d) => social.deedWords(d, 'en')) }),
      deedName: (seen) => social.deedIn(seen)?.name,
    }
    // the watches: a resident each (its ledger is its props)
    eng.hooks.residents.push(() =>
      w.onto.hasType('resident/watch') ? Object.values(w.onto.data.laws ?? {}).map((law): Entity => ({ id: lawId(law.id), type: 'resident/watch', name: law.name, place: { on: 'resident' } })) : [],
    )
    // the people look about them and talk among themselves (docs/npc-sandbox.md §2.3, §2.5): events, their answers their own
    eng.hooks.tick.push({
      phase: 'behaviour',
      run: (active) => {
        const sp = social.params
        if (w.state.tick % Math.max(1, sp.perceiveEvery) === 0) social.perceive(active)
        if (w.state.tick % Math.max(1, sp.gossipEvery) === 0) social.gossip(active)
      },
    })
    // those who follow the one at the keys come with them onto a map
    eng.hooks.enterMap.push((map) => conductOf(eng).bringFollowers(map))
    // what one owes the watch of the map one is on, and the coin one carries
    eng.hooks.frame.push((f) => {
      const p = w.player
      const law = social.lawHere(p)
      const bounty = law ? social.bounty(law.id, p.id) : 0
      if (bounty > 0 && law) f.player.wanted = { bounty, by: law.name }
      f.player.purse = social.purse(p)
    })
  },
}

registerModule(societyModule)
