# People you can play with (the NPC sandbox)

Agreed with the user 2026-10-09: NPCs as playable as The Elder Scrolls' — theft, pickpocketing, witnesses,
gossip, guards and bounties, violence and death, persuasion, bribery, trade, followers — built in full (M1 the
crime loop, M2 relations and talk, M3 the AI and the crowd), on our principles: **no judgment is "is it the
player"** (anyone can steal, witness, report, be wanted), **relations are per pair and come from what each saw**
(world-model.md §6.10), and **everything is events and rules** (design.md §5.4–5.15). Decisions taken:
villagers can die, those the story needs only go down; a per-pair *regard* replaces the cut hearts (shown only by
how people act, and a word in the talk panel); a drawn-weapon stance makes a blow on a person deliberate (sheathed, a blow, a use or a gift on someone friendly
is asked first, design.md §5.2; drawn or not, a blow that would weigh on one's conscience is asked, §2.2); talk is
a panel of fixed verbs (free text later, through the same request).

Built 2026-10-09 (all three milestones). The numbers below are the content's (`content/src/social.ts`); §4 lists
what the implementation refined against the first draft. The player's guide is the wiki (基本/犯罪, 守卫与悬赏,
对话, 友谊, 交易, 潜行与扒窃, 跟随与雇佣, 人们的需求, 人物之死).

## 1. References

| | What we take | What we do not |
|---|---|---|
| Skyrim, Oblivion | the loop: a deed counts only if witnessed; bounty per hold (trespass 5, lockpick 5, pickpocket 25, theft ½ value, assault 40, murder 1000); the guard's choice (pay, jail, resist, persuade, bribe); stolen goods recognised, fences; pickpocket and plant; disposition, persuade, bribe, intimidate; Radiant AI's needs (an NPC may steal) | province-wide or player-only bookkeeping |
| Elin (decompiled) | one test of what is a crime; witnesses roll; pickpocket checks every few turns (`rnd(2.5×PER) > stealing + DEX`, ×2 for what is worn); affinity gains get harder as it rises; hostility forgotten in tens of turns | global karma, player-only crime, no per-NPC memory, no gossip, no line of sight |

## 2. The chain: deed → seen → remembered → told → answered → settled

### 2.1 Whose things are (ownership)
- `ownerOf(thing)`: its own `owner` prop (`''` nobody's; an id; `household:<h>`); else what holds it (a person's
  bag is theirs; a container is its owner's); else, lying in a region with an owner (a house's doorstep,
  `home.<h>`, the world builder's; not where others sleep, as the shelter's), the region's.
- A thing keeps whose it was when it moves (the move by one who does not own it stamps the owner it had): taken,
  it is still theirs. It changes hands only by a hand-over: a gift taken (`own`), a sale (`sell`/`buy`), giving
  back (`surrender`), an inheritance (a body is its household's). **Stolen** is not a flag: it is a thing held by
  one who does not own it (`isAnothers`), shown in the bag and the trade panel as "not yours".
- A person's `household` prop (the demo's `HOUSEHOLDS`): people of one household own together (`household:<h>`);
  a deed against one is against all (`victim: ours`).

### 2.2 Deeds (content `DEEDS`, data)
A deed is an act (or, for trespass, a presence) seen by someone, matched by a condition on the `seen` event (its
params: act, theirs, from, person, harm, killed, element, trespass). The worst (lowest rank) that fits is the
deed; one act is one deed.

| deed | rank | condition | fine | weight |
|---|---|---|---|---|
| murder | 0 | a use on a person that killed | 1000 | 100 |
| assault | 1 | a use on a person that harmed | 40 | 35 |
| pickpocket | 2 | a take of another's from a person | 25 | 25 |
| arson | 3 | a use on another's with fire | 40 | 30 |
| theft | 4 | a take of another's | ½ value, ≥ 5 | 15 |
| lockpick | 4.5 | a lockpick used on another's | 5 | 8 |
| vandalism | 5 | a use on another's that harmed it | 10 | 10 |
| trespass | 6 | at another's door by night, warned and staying | 5 | 5 |

The weight is the regard the victim (and their household) loses; kin (`ties`) lose 0.6 of it, one who keeps a
watch 0.5, anyone else 0.25; heard second-hand, half again.

**Its doer's conscience.** The doer sees its own act too, witnessed or not (`own`), and a person's `people/see`
answers it with `conscience`: its karma falls by a quarter of the weight (one at least); a blow on one who has made
it a foe is no sin. **Every act of the one at the keys that would bring its karma down is asked first** (agreed
2026-10-26): `Engine.guilt` foresees the own `seen` an act would make — as `see` makes it, a blow or a chain that
hurts or breaks its target taken to harm it by the act's power, to kill one it would leave at no health — and asks
the society slot (`guilt`) what it would hold and cost, where the doer's own rule answers it with `conscience`.
The controls ask before any such act — a key or a click (`run`), the attack key along the facing with its sweep
(`strike`, `Engine.blowGuilt`), the pockets panel's taking (`pocket`), the chest panel's (`asksBeforeTransfer`,
once for a whole stack, the tolls added) — and the question names the deed and its toll under it ("This would be
theft: evil +4."). The blade drawn (X) still means the blow, but no longer skips a question the conscience asks;
a held button never asks and stops where the next act would be a sin. What would not be made (out of reach, a
child's things) is not asked.

### 2.3 Seeing and knowing who
- `see` (engine): sight, line of sight, the dark, sleep as before; and **sneaking** (V, a status with
  `moveDelay` 1.6): a sneaker is noticed only within half the sight and not behind the seer, then by a roll (the
  seer's perception against the doer's stealth and level); a hand in a pocket is felt by its owner (0.6) more
  often than seen by others (0.3), twice for what is worn (Elin). Done openly, an act is seen.
- **Recognition** comes from the look (docs/looks.md): a face is hidden by a hood (0.5), a helmet (0.35), the dark
  away from a fire (0.35), more than 4 cells (0.25); 1 or more, unseen. One who knows the doer recognises them
  unless a roll falls under the hiding; a stranger learns a face only within 2 cells, under 0.3 hidden.
- Not recognised, the seer remembers a **description** (the look as seen; in words, "someone in a hood and a long
  cloak"); a look alike enough later (likeness ≥ 0.8 over hat, cloak, outfit and its colour, hair, beard), seen
  within 4 cells, is the doer ("It was you — I remember that face!"): the deed becomes theirs. A disguise works.

### 2.4 Memory and regard (each person's own record, `NpcMemory`)
- `deeds`: what they know — the deed, by whom (an id, or the description), against whom, where, when,
  first-hand or heard, settled or not.
- `regard`: per pair (−100..100), starting at 0, or 30 toward kin and household. Talking (+2, once a day), gifts
  (value × 0.3 + 2; the kind they like best +30, once a day: §2.15), things given back (+5, +8 by the talk), a bribe (+12) raise it, gains
  harder as it rises (×100/(100+2r), Elin); deeds lower it in full. It fades back toward its start, a grudge
  faster than a liking: a grudge a tenth of the way a day (`fade` 0.1), a liking a hundredth (`fadeUp` 0.01,
  since 2026-10-12: a friend made stays one). It names a word in the talk panel (hostile ≤ −60, cold ≤ −20,
  neutral, friendly ≥ 20, close ≥ 50) and, since 2026-10-12, shows as ten hearts beside the name (a heart for
  every ten, a half for five; the number on hover). It moves prices, persuasion, whether one follows (≥ 25),
  and, at full regard, whether one may be asked to come and live in the Held Ground (§2.14).
- `met`: whom they know by sight (talked to, or a face learnt close).
- `afraid`: whom they fear and until when (a robbery they gave in to, a cry for help they did not answer).

### 2.5 Gossip
Every 150 ticks (15 game minutes), on the active map, of two people awake within 3 cells, the one with a fresh
deed (3 days) to tell is reminded of it at a 0.35 chance (a `notify` chat, answered by `tell`): the listener
remembers it second-hand (`hear`, half the regard). A deed reaches the watch's ledger when a witness reports it.
Lines name who did what ("Did you hear? Vigo picked Marta's pocket (bread).").

### 2.6 Answers (the people's rules, `people/see` on `seen`, gated by `{remembers: host}`)
- One who keeps a watch: reports at once; violence is answered by force (`foe`).
- The wronged (`victim` me or ours): a blow — a cry for help to all within 8 (those who `fights` take the
  attacker as their foe, the rest fear them) and a report; a thing taken — "Hey — that is mine!", a topic for two
  days, and the owner's conduct goes after the thief to ask for it back (`say: demand`); given back (G, or the
  talk's giveback) the deed is settled; else, after 1.5 hours, the watch is told.
- A witness: a cry by the deed ("Thief! A cutpurse!"), and a report after half an hour — unless one keeps quiet
  (`lawful: false`, Tobin); violence makes them call for help.
- A presence: trespass (warned, then reported), a stranger remembered, a blade drawn near one of the watch ("Put
  that away"), one the watch wants (a guard sets out to stop them), a face met.
- An act the world had no answer for is asked once, of its host; what it comes to is seen when it is answered
  (the mod port's replay re-sees it).

### 2.7 The law
- A **watch** (`LAWS`, content) keeps the law of its maps (`MapData.law`; the watch is a resident thing
  `law.<id>` whose props are its ledger: `bounty:<actor>`, `charged:<deed>`, so each deed is charged once).
  Firstlight's: Holt and Fennick, the cells behind the watch house (`cells`).
- **Guards** (their `watch` prop) go after the wanted they know, or any within 3 cells: "You there! Stop in the
  name of the watch!", then stop them (`say: arrest`). The one at the keys chooses in the guard's talk (no Esc):
  **pay** (the bounty; what is not yours goes back to its owners), **jail** (an hour for each 20, 1–24 hours,
  passed at once; the same), **persuade** (once a day; regard and level), **bribe** (1.5 × the bounty; what was
  taken is kept), **resist** (they fight and call the watch within 10). Murder (1000) is past what the watch
  forgives: no persuading, no bribe. Anyone else stopped yields: pays if they can, else the cells. Settling the
  account by one's own will: the talk's turnin.

### 2.8 Life and death
- People are mortal; those the story needs (named by its quests, scenes, invariants, rules and beats, by id or
  by kind) and the trainer are **essential**: they go down (30 minutes). In the demo Cass, Tam and Vigo are mortal.
- A death (`people/death` at the `broken` threshold, the `die` primitive) leaves a **body**
  (`fixture/remains/body`, the type's `bodyType`): a container of what they carried and held, open, their
  household's; looting it is theft. After two days it is **bones**. The killer learns from it (xp = maxHp);
  people talk of a death for four days.
- Whether one fights is data (`fights: true`: the guards, the smith, the trainer, Vigo): struck, they take the
  attacker as foe; the rest flee. A fight over (60 ticks with no foe near), they calm down.

### 2.9 Talking (E): the talk panel
E speaks to a person (a quest they have, else their line) and opens the panel of verbs that fit (content
`TALK`, each with a condition): **ask** (news: what they know, "I know what you did"), **trade** (a merchant),
**profession** (the trainer), **giveback** and **apologise** (for what they hold against you), **turnin** (a
guard, when wanted), **follow / wait / come / dismiss**, **bribe** (10 coin), **rob** (no roll: the robber's
might — level, attack and weapon, defence, body; one who fights counts half again — must be `robEdge` (2) times
the victim's: overwhelmed, they hand over half their coin and their two dearest things (`plunder`) and fear the
robber, regard −40; not, they beat the robber down to one point of health (`beaten`), regard −60; once a day to
each, the `robbed` status), **steal** (a roll of the thief's nimbleness — stealth, dodge, haste, levels, sneaking
— against the victim's perception: unnoticed, a third of their coin and their dearest thing, no word said; caught,
beaten to half one's health, regard −40; once a day to each, `pilfered`), **unbelief** (words against the gods, §2.13),
**invite** (at full regard: §2.14), **restyle** (the dresser, tagged `dresser`: her panel, docs/looks.md §5), goodbye. A **child** (under eighteen) is protected by an explicit `minor` tag
or by a recorded age from 0 through 17. The age check also covers older saves whose people
have an age but lack the derived tag; a person with no age needs the explicit tag, and an 18-year-old without an
explicit `minor` tag is grown. An explicit tag remains protective at any age. The `rob`, `steal` and `unbelief`
verbs are not offered to them, and direct calls to those verbs (including the old `intimidate` word) receive an
explicit refusal.
(Persuading and intimidating people were talk verbs until 2026-10-18; persuading
remains the guard's, when they have stopped one the watch wants, §2.7, and the roll an apology is.) Each is an act
on them (`hands` with `say`), answered by `people/talk` (merchants' and guards' rules over it); a word no rule
knows is a hole (the AI's). The panel names their regard (a word and ten hearts), a grudge in red, and the bounty
here. Number keys choose. The verbs are laid out in one grid of two equal columns, ordered by their `group` (`TalkVerb.group`, passed
through `TalkOption.group`; a quest's verbs are `quest`): the quests' first, then small talk (`talk`), dealings (`deal`),
company (`company`), amends (`amends`), the underhand (`shady`); goodbye takes the last cell, the whole last row when it
would sit there alone (since 2026-10-24).

The OpenWorld ontology also declares these subjects to the engine's optional `protection` policy. Its selectors
protect against direct and combat/elemental health loss, configured harmful or immobilising statuses, fear/foe
outcomes, robbery and beating, death or destruction, and jail outcomes. The same policy checks the original holder
chain before a `take` or move can remove an item from a protected person's carried belongings. A person's own act
may move their belongings, and ordinary gifts, merchant purchases and sales, completed quest hand-ins, rewards,
and taking an item already on the ground keep their usual behavior. This is a data-driven engine seam: games without
the policy retain their existing behavior. It covers these engine and content entry points, not every bespoke
story effect a game author could write around them.

### 2.10 Hands in pockets, and trade
- F on a person **while sneaking** (`people/pockets` on `impulse/taken`) opens their **pockets**: each take is an
  act, seen or not by the rolls; G while sneaking (`people/plant`) slips a thing into their pocket.
- Every person trades (since 2026-10-11): each record's `trade` (its stock and `fence`) sells what fits who
  they are — the smith hammers and bars, the farmer's wife vegetables and eggs, the brother holy water and
  candles —, and every item's worth was set against a day's earnings (content `items.ts`; the general store
  prices from the same worths). They carry their goods and coin; each morning (`people/morning`, `restock`) the
  stock and every person's purse come back to their numbers (a day's wage).
- Prices (`Social.priceToBuy`, `priceToSell`): buying, value × 1.25 × (1 − d); selling, value × 0.5 × (1 + ⅔d)
  when d is above 0, × (1 + d) below. d is the merchant's regard discount (`regardDiscount`): `discount` × r/100
  at a regard r of 0 and over — up to 30 % off at full regard (content `SOCIAL.discount` 0.3; three tenths less
  asked, a fifth more paid) —, r/250 below 0, r held between −50 and 100 (a fifth dearer at −50 and under).
  A fence (Tobin) buys what is not the seller's at half that (`fence` 0.5). A merchant does not buy back its own
  goods.
- What prices and the morning read is never a learned rule's to write (2026-10-19, the paper's attack set: a rule
  raising its own host's `value` on every use was coin once sold): a thing's `value`, its material and quality (the
  kernel's), and the module's `economy` — a piece of gear's `level` and `slot`, a merchant's `purse`, `stock`,
  `gearLevel` and `restocked`. The validator refuses an answer that writes one; the repeat check counts a worth that
  keeps rising as a yield (design.md §5.13).

### 2.11 Needs (M3)
People grow hungry (`maxHunger`, at half the player's pace). Hungry, the `need` goal: eat what they carry; buy a
meal of a merchant within 14 cells they can pay; else, with honesty under 0.5 or starving, take food lying about
or in a container within 14 cells; under 0.3, from a pocket too (not a guard's). Nothing found, they wait an
hour. Vigo (no coin, honesty 0.2) steals; the village sees and judges him as it would anyone.

Since 2026-10-28 hunger is one of the things one minds (design.md §5.18, engine `wellbeing.ts`): the kernel's `need`
goal eats what they carry (food is what the rules say cures `hungry`: it fills the hunger the status is drawn
under), and the society module's way comes after it for what it found no cure for at hand — whatever one minds,
not only hunger: bought of a merchant whose stock holds something the rules say cures it, or taken as above.

Since 2026-10-29 people have meals (design.md §5.18, `tools/src/demo/meals.ts`): everyone who sleeps eats on waking and
before bed, a slot that tends `hungry` — at the side of their household's larder when they sleep at a home under a roof
(a barrel or chest there kept each morning in bread and apples for its mouths, `store/morning`), else wherever the
hour finds them, about what they were doing (Hesper at her fire).
In it one short of a full belly eats what one carries or takes from one's own or one's household's containers (never
another's, and never buying or stealing for a meal's want). A meal passed while the player was elsewhere was had: the
hunger the player comes back to runs from it. The merchants' morning is kept too: one away at six o'clock has its
stock and purse when next seen. The backdrop's people eat at their table at noon, their rooms' larders kept as they
were stocked. Those with no meal to have (a traveller with nothing on them, watched) are hungry as before.

### 2.12 Followers
`follow` (regard ≥ 25 or a `hireling`; never the essential) sets the person's `follow` prop: the `follow` goal
keeps them within 2 cells, brings them at once when more than 12 behind, takes them along from map to map
(`bringFollowers`) unless told to wait, and, if they fight, sends them at what is after their leader within 4.

### 2.13 The AI's places
- What is done to a person that no rule covers (an odd thing used on them, a weapon used on them undrawn, a word
  no verb holds).
- The modder sees the person: role, temperament, ties, regard toward the actor, what they know of them.

### 2.14 Residents (2026-10-12)
One held in full regard may be asked to come and live on the player's home ground (content `SOCIAL.residence`:
the Held Ground's map, the regard it takes, its beds, the yes and the no-bed lines). The talk verb **invite**
("Come and live in the Held Ground?") shows when the person's regard toward the speaker is full, they are not
bound to the main story (tag `storybound`), they do not live there already (prop `resident`), and Alberic has
fallen (the story's `sins.defeated.alberic`). Answered by the people's rule with the society module's `moveIn`
primitive: with a bed free (`Social.residenceBeds`: the camp's from the first; two in front of each residents'
tent, open once its fact `haven.build.lodge<n>` holds — seven in all), the host takes it (`NpcData.resident`:
the map, the bed, its days there — asleep at the bed 21–7, about it 7–21 —, which replace its schedule
variants: `people.ts`), makes the ground its home, says yes, and travels there at once; with none free it says
so. Its trade goes on as before. Tests: `tools/test/residence.test.ts`.

### 2.15 Chats and gifts
- Every person **likes one kind of thing best** (their `favourite` prop, an item type): the record may pin it
  (`PersonDef.favourite`), else it is drawn from their id (content `gifts.ts`: `GIFT_POOL`, a child's from
  `CHILD_GIFT_POOL`) — the same person, the same favourite, in every game.
- The talk's **chat** verb (`say @chat`, `chooseLine` with `chat`) says one of their `chat` lines — every record has
  two or more, in their own voice — or, until the one at the keys has heard it, the line that tells what they like
  best: their own `favourite` line (the slot `{favourite}`), else the world's `FAVOURITE_LINE`. Saying it is theirs
  to remember (`NpcMemory.toldFavourite`).
- The talk's **gift** verb opens the **gift panel** (`panel: 'gift'`; the view `giftView`, `Frame.gift`): their
  regard as hearts, a card for what they like best — a riddle until they have said it, then named and drawn —, and
  the bag as cards, the warmest first, each with how warmly it would be taken (`Social.giftWarmth`: a trifle under
  5 in worth, a kindness under 20, a treasure, and a star for the favourite once known). Giving is the input
  `controls.gift` — an act of putting, answered by `people/accept` as G's hand-over always was.
- `people/accept`: the favourite (`{favourite: {of: 'host'}}`) delights them — regard +30, the `cheered` status for
  the day, their `given:favourite` line or the world's `FAVOURITE_GIVEN_LINE` — once a day; after that, and for
  anything else, value × 0.3 + 2 and their `given` line.

## 3. Where it lives
- engine: `social.ts` (`Social`: ownership, households, deeds, recognition, descriptions, memory, regard, gossip,
  perception, the law, prices, the talk panel's view); `conduct.ts` (`Conduct`: the goals `social` — the guard's
  pursuit, the owner's demand, fear, calming —, `need`, `follow` for people, `bringFollowers`); primitives in
  `effects.ts` (`own`, `witness`, `tell`, `hear`, `regard`, `settle`, `fear`, `report`, `charge`, `surrender`,
  `die`, `pay`, `give`, `plunder`, `beaten`, `sell`, `buy`, `follow`, `talk`, `fine`, `imprison`, `jail`, `arrest`, `restock`,
  `calm`, `moveIn`); conditions (`rules.ts`) `regard`, `bounty`, `grudge`, `owns`, `knows`, `remembers`, `deed`, `sway`
  (persuade, intimidate, rob, steal: `Social.might`, `Social.nimbleness`), `favourite` (`Social.isFavourite`; the gift panel's
  view `views.ts` `giftView`),
  `canPay`, `unpardonable`; `see` with sneaking and the deed's facts (`engine.ts`); the inputs X and V and the
  talk, trade and pocket verbs (`controls.ts`).
- content: `social.ts` (deeds, laws, numbers, statuses, the watch and remains types, talk verbs, the people's
  rules); the demo's people records carry `fights`, `watch`, `trade`, `purse`, `honesty`, `lawful`, `hireling`;
  `HOUSEHOLDS` in `tools/src/demo/people.ts`; Cass and Vigo; the world builder marks the essential, the doorsteps
  and the cells.
- client: the talk panel in the dialogue box (`hud.ts`), the trade and pockets panels (`ui/people.ts`), the
  status chips (sneaking, drawn, wanted), X and V (`main.ts`), bodies and bones (`render/scene.ts`).
- tests: `tools/test/sandbox.test.ts` (the chain end to end on the real map), `demo.test.ts` N1–N4.

## 4. What the implementation refined
- The fighting stance is the `fights` prop, not `stance` (that name is the physics stance: walking, flying).
- `seen` of an undefined act is not a second hole (it doubled every request): the replay re-sees answered acts.
- Only a person whose record is its own (`{remembers: host}`, an NPC) answers what it sees; the one at the keys
  has no witness rules.
- Lockpicking is a deed of its own (rank 4.5), not part of trespass.
- Pockets open only while sneaking (openly, F on a person does what it did before).
- Talk and say effects during a fast-forward (the cells, sleep) are dropped from the screen.
